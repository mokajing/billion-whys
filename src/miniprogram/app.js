const {
  safeSwitchTab,
  safeRedirectTo,
  safeToast,
  safeSetStorageSync,
  safeGetStorageSync,
  safeRemoveStorageSync,
  safeGetUpdateManager,
  safeShowModal,
  safeOnNeedPrivacyAuthorization,
  compareSDKVersion,
} = require('./utils/safe-wx')
const minorProtection = require('./utils/minor-protection')
// V8.60 BUG-0006 修复：延迟加载全量内容数据，避免启动时同步 require 670KB 阻塞
let contentUtils = null
function _getContentUtils() {
  if (!contentUtils) {
    try { contentUtils = require('./utils/content') } catch (_e) { /* dev mode */ }
  }
  return contentUtils
}

// 版本号单一源：build:mp-data 从 package.json 注入 data/version.json
// Why: 避免三处硬编码 0.2.0 漂移；H5 已用 vite define __APP_VERSION__
let version = '0.0.0'
let releaseDate = ''
try {
  const v = require('./data/version-data')
  version = v.version || version
  releaseDate = v.releaseDate || ''
} catch (_e) { /* 开发期未构建时降级 */ }

// P1-7 隐私弹窗拒绝次数计数（本地存储键；超过 3 次触发家长教育 modal）
const PRIVACY_REJECT_COUNT_KEY = 'bw_privacy_reject_count'
const PRIVACY_REJECT_THRESHOLD = 3

App({
  globalData: {
    appName: '十亿个什么与为什么',
    version,
    releaseDate,
  },

  onLaunch() {
    // V8.60 BUG-0006 修复：启动时异步预加载全量内容数据，不阻塞首屏渲染
    // 首屏使用 index 数据（42KB），全量数据在后台异步加载
    const content = _getContentUtils()
    if (content && typeof content.initAsync === 'function') {
      content.initAsync().catch(() => { /* 静默失败，index 数据已足够首屏 */ })
    }

    // P1-1 基础库版本守卫：低于 2.10.4 弹窗引导升级
    // Why: project.config.json 已声明 minimumLibVersion=2.10.4；运行时二次校验兜底
    if (compareSDKVersion('2.10.4') < 0) {
      safeShowModal({
        title: '基础库版本过低',
        content: '当前微信版本较旧，部分功能可能无法使用。请升级微信至最新版本后重试。',
        showCancel: false,
        confirmText: '我知道了',
      })
    }

    // 未成年人保护：首次启动家长验证
    // Why: docs/minor-protection.md §1.1，未验证则跳转家长验证页
    if (!minorProtection.verifyParent()) {
      safeRedirectTo('/pages/parent-verify/parent-verify')
    } else {
      // 已验证：检查是否处于不可用时段
      const dis = minorProtection.isDisabled()
      if (dis.disabled) {
        safeToast({ title: dis.message, icon: 'none', duration: 4000 })
      }
    }

    // 启动会话计时起点
    safeSetStorageSync('mp_session_start', Date.now())

    // P1-2 整改：所有 wx.* 调用统一走 safe-wx 守卫
    const updateManager = safeGetUpdateManager()
    if (updateManager) {
      updateManager.onCheckForUpdate((res) => {
        if (!res.hasUpdate) return
        updateManager.onUpdateReady(() => {
          safeShowModal({
            title: '发现新版本',
            content: '新版本已准备好，是否重启应用？',
          }).then((modalRes) => {
            if (modalRes.confirm) {
              try { updateManager.applyUpdate() } catch (_e) { /* swallow */ }
            }
          })
        })
        updateManager.onUpdateFailed(() => {
          safeShowModal({
            title: '更新提示',
            content: '新版本下载失败，请删除小程序后重新搜索打开',
            showCancel: false,
          })
        })
      })
    }

    // 隐私合规：注册隐私授权回调（合规要求 __usePrivacyCheck__=true 时必须）
    // P1-7 拒绝 3 次后触发家长教育 modal，引导用户了解为何需要隐私同意
    safeOnNeedPrivacyAuthorization((resolve) => {
      safeShowModal({
        title: '隐私保护提示',
        content: '为了保护您和孩子，请先阅读并同意《用户隐私保护指引》。',
        confirmText: '同意',
        cancelText: '拒绝',
      }).then((res) => {
        if (res.confirm) {
          // 同意：清零拒绝计数
          safeSetStorageSync(PRIVACY_REJECT_COUNT_KEY, 0)
          resolve({ event: 'agree' })
          return
        }
        // 拒绝：累计计数；超过阈值展示家长教育 modal
        const cnt = (safeGetStorageSync(PRIVACY_REJECT_COUNT_KEY, 0) || 0) + 1
        safeSetStorageSync(PRIVACY_REJECT_COUNT_KEY, cnt)
        if (cnt >= PRIVACY_REJECT_THRESHOLD) {
          safeShowModal({
            title: '需要您的同意',
            content: '本小程序为 2-6 岁儿童家长提供好奇心问答服务，需阅读并同意《用户隐私保护指引》后方可使用。我们承诺仅收集最小必要信息（详见指引），可随时在"我的-隐私设置"撤回同意。',
            showCancel: false,
            confirmText: '我知道了',
          }).then(() => resolve({ event: 'disagree' }))
        } else {
          resolve({ event: 'disagree' })
        }
      })
    })

    // P2-8 内存警告监听：level 10+ (TRIM_MEMORY_BACKGROUND 及以上) 时清空 eventLog/feedbackLog 防 OOM
    // Why: 审核报告 P2-8 — 低端安卓机长跑可能 OOM；本地日志为可重建数据，优先释放
    if (typeof wx !== 'undefined' && typeof wx.onMemoryWarning === 'function') {
      try {
        wx.onMemoryWarning((res) => {
          console.warn('[BillionWhys] memory warning level:', res && res.level)
          if (!res || typeof res.level !== 'number' || res.level < 10) return
          // 10 = TRIM_MEMORY_BACKGROUND；15 = TRIM_MEMORY_RUNNING_LOW；20 = TRIM_MEMORY_RUNNING_CRITICAL
          // 仅在 level >= 15 (RUNNING_LOW) 时清理日志，避免后台抖动频繁触发
          if (res.level < 15) return
          safeRemoveStorageSync('bw_event_log')
          safeRemoveStorageSync('bw_feedback_log')
        })
      } catch (_e) { /* swallow */ }
    }
  },

  onShow() {
    // 未成年人保护：每次进入检查时间限制
    if (minorProtection.verifyParent()) {
      const t = minorProtection.checkTimeLimit()
      if (!t.allowed) {
        safeToast({ title: t.message, icon: 'none', duration: 4000 })
      } else {
        // 重置 session 计时起点（每次回到前台重新计时）
        safeSetStorageSync('mp_session_start', Date.now())
      }
    }
  },

  onHide() {
    // 离开小程序时记录使用时长
    if (minorProtection.verifyParent()) {
      minorProtection.recordUsage()
    }
  },

  onPageNotFound() {
    safeSwitchTab('/pages/discover/discover')
  },

  onError(msg) {
    console.error('[BillionWhys] global error:', msg)
  },
})
