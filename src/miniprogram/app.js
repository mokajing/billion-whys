const { safeSwitchTab } = require('./utils/safe-wx')

// 版本号单一源：build:mp-data 从 package.json 注入 data/version.json
// Why: 避免三处硬编码 0.2.0 漂移；H5 已用 vite define __APP_VERSION__
let version = '0.0.0'
let releaseDate = ''
try {
  const v = require('./data/version.json')
  version = v.version || version
  releaseDate = v.releaseDate || ''
} catch (_e) { /* 开发期未构建时降级 */ }

App({
  globalData: {
    appName: '十亿个什么与为什么',
    version,
    releaseDate,
  },

  onLaunch() {
    if (typeof wx !== 'undefined' && typeof wx.getUpdateManager === 'function') {
      const updateManager = wx.getUpdateManager()
      updateManager.onCheckForUpdate((res) => {
        if (!res.hasUpdate) return
        updateManager.onUpdateReady(() => {
          wx.showModal({
            title: '发现新版本',
            content: '新版本已准备好，是否重启应用？',
            success(modalRes) {
              if (modalRes.confirm) updateManager.applyUpdate()
            },
          })
        })
        updateManager.onUpdateFailed(() => {
          wx.showModal({
            title: '更新提示',
            content: '新版本下载失败，请删除小程序后重新搜索打开',
            showCancel: false,
          })
        })
      })
    }

    // 隐私合规：注册隐私授权回调（合规要求 __usePrivacyCheck__=true 时必须）
    if (typeof wx !== 'undefined' && typeof wx.onNeedPrivacyAuthorization === 'function') {
      wx.onNeedPrivacyAuthorization(function (resolve) {
        wx.showModal({
          title: '隐私保护提示',
          content: '为了保护您和孩子的好奇心探索体验，请在使用前阅读并同意《用户隐私保护指引》。',
          confirmText: '同意',
          cancelText: '拒绝',
          success: (res) => resolve({ event: res.confirm ? 'agree' : 'disagree' }),
          fail: () => resolve({ event: 'disagree' }),
        })
      })
    }
  },

  onPageNotFound() {
    safeSwitchTab('/pages/discover/discover')
  },

  onError(msg) {
    console.error('[BillionWhys] global error:', msg)
  },
})
