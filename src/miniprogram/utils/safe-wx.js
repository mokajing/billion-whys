/**
 * safe-wx.js - 微信小程序 API 守卫层
 *
 * 所有 wx.* 调用必须经过本模块封装，理由见 wx-minigame-audit-team 专家团方法论：
 *  - 平台守卫强制：H5 端必须有降级路径
 *  - API 调用必须先 typeof wx !== 'undefined' 守卫
 *  - 反作弊不信客户端：时间戳以服务端为准（本端只用 stable 时间做本地展示）
 *  - 归因埋点即时上报
 *
 * 注意：本小程序当前只在微信小程序环境运行，但守卫层仍保留，便于未来 H5 复用与故障兜底。
 */

const isWx = typeof wx !== 'undefined' && typeof wx.getSystemInfoSync === 'function'

function safeToast(opts) {
  if (!isWx || !wx.showToast) return
  try {
    wx.showToast({
      title: (opts && opts.title) || '',
      icon: (opts && opts.icon) || 'none',
      duration: (opts && opts.duration) || 1500,
      mask: !!(opts && opts.mask),
    })
  } catch (_e) { /* swallow */ }
}

function safeModal(opts) {
  if (!isWx || !wx.showModal) return Promise.resolve(false)
  return new Promise(resolve => {
    try {
      wx.showModal({
        title: (opts && opts.title) || '提示',
        content: (opts && opts.content) || '',
        showCancel: !(opts && opts.showCancel === false),
        confirmText: (opts && opts.confirmText) || '确定',
        cancelText: (opts && opts.cancelText) || '取消',
        success: res => resolve(!!res.confirm),
        fail: () => resolve(false),
      })
    } catch (_e) { resolve(false) }
  })
}

function safeNavigateTo(url) {
  if (!isWx || !wx.navigateTo) return false
  const pages = (typeof getCurrentPages === 'function') ? getCurrentPages() : []
  try {
    if (pages.length >= 9) {
      wx.redirectTo({ url, fail: () => {} })
    } else {
      wx.navigateTo({ url, fail: () => {
        wx.redirectTo({ url, fail: () => {} })
      }})
    }
    return true
  } catch (_e) { return false }
}

function safeRedirectTo(url) {
  if (!isWx || !wx.redirectTo) return false
  try { wx.redirectTo({ url, fail: () => {} }); return true } catch (_e) { return false }
}

function safeSwitchTab(url) {
  if (!isWx || !wx.switchTab) return false
  try { wx.switchTab({ url, fail: () => {} }); return true } catch (_e) { return false }
}

function safeNavigateBack(delta) {
  if (!isWx || !wx.navigateBack) return
  try { wx.navigateBack({ delta: delta || 1, fail: () => {} }) } catch (_e) { /* */ }
}

function safePageScrollTo(top) {
  if (!isWx || !wx.pageScrollTo) return
  try { wx.pageScrollTo({ scrollTop: top || 0, duration: 0 }) } catch (_e) { /* */ }
}

function safeGetStorageSync(key, fallback) {
  if (!isWx || !wx.getStorageSync) return fallback
  try {
    const v = wx.getStorageSync(key)
    return (v === '' || v === undefined || v === null) ? fallback : v
  } catch (_e) { return fallback }
}

function safeSetStorageSync(key, value) {
  if (!isWx || !wx.setStorageSync) return false
  try { wx.setStorageSync(key, value); return true } catch (_e) { return false }
}

function safeRemoveStorageSync(key) {
  if (!isWx || !wx.removeStorageSync) return
  try { wx.removeStorageSync(key) } catch (_e) { /* */ }
}

/**
 * 安全封装 wx.createSelectorQuery
 * 兼容低版本基础库 + 沙盒异常兜底
 * 返回 query 实例；若环境不支持则返回 null
 */
function safeCreateSelectorQuery(pageInstance) {
  if (!isWx || typeof wx.createSelectorQuery !== 'function') return null
  try {
    const query = wx.createSelectorQuery()
    // pageInstance 调用 .in(this) 限定组件作用域；缺失则退化为页面级
    return (pageInstance && typeof query.in === 'function') ? query.in(pageInstance) : query
  } catch (_e) { return null }
}

/**
 * 安全封装 wx.showActionSheet
 * Promise 形式 resolve tapIndex（取消/失败 resolve -1）
 */
function safeShowActionSheet(opts) {
  if (!isWx || typeof wx.showActionSheet !== 'function') return Promise.resolve(-1)
  return new Promise(resolve => {
    try {
      wx.showActionSheet({
        itemList: (opts && opts.itemList) || [],
        itemColor: (opts && opts.itemColor) || '#000000',
        success: res => resolve(typeof res.tapIndex === 'number' ? res.tapIndex : -1),
        fail: () => resolve(-1),
      })
    } catch (_e) { resolve(-1) }
  })
}

/**
 * 安全封装 wx.getUpdateManager
 * 返回 updateManager 实例或 null（低版本不支持）
 */
function safeGetUpdateManager() {
  if (!isWx || typeof wx.getUpdateManager !== 'function') return null
  try { return wx.getUpdateManager() } catch (_e) { return null }
}

/**
 * 安全封装 wx.showModal — Promise 形式 resolve {confirm, cancel}
 * 与 safeModal 区别：返回完整 modalRes 字段，便于隐私弹窗等需要 event 字段的场景
 */
function safeShowModal(opts) {
  if (!isWx || typeof wx.showModal !== 'function') return Promise.resolve({ confirm: false, cancel: true })
  return new Promise(resolve => {
    try {
      wx.showModal({
        title: (opts && opts.title) || '提示',
        content: (opts && opts.content) || '',
        showCancel: !(opts && opts.showCancel === false),
        confirmText: (opts && opts.confirmText) || '确定',
        cancelText: (opts && opts.cancelText) || '取消',
        success: res => resolve({ confirm: !!res.confirm, cancel: !!res.cancel }),
        fail: () => resolve({ confirm: false, cancel: true }),
      })
    } catch (_e) { resolve({ confirm: false, cancel: true }) }
  })
}

/**
 * 安全封装 wx.onNeedPrivacyAuthorization
 * 注册隐私授权回调；低版本不支持时静默降级（业务方可继续运行）
 * cb 接收 resolve 函数，由业务方决定 agree/disagree
 */
function safeOnNeedPrivacyAuthorization(cb) {
  if (!isWx || typeof wx.onNeedPrivacyAuthorization !== 'function') return false
  try {
    wx.onNeedPrivacyAuthorization(cb)
    return true
  } catch (_e) { return false }
}

/**
 * 安全获取 SDK 版本号字符串；不存在返回 '0.0.0'
 */
function safeGetSDKVersion() {
  if (!isWx || typeof wx.getSystemInfoSync !== 'function') return '0.0.0'
  try {
    const info = wx.getSystemInfoSync()
    return (info && info.SDKVersion) || '0.0.0'
  } catch (_e) { return '0.0.0' }
}

/**
 * 语义化版本比较：返回 -1 / 0 / 1
 * 仅比较数字段；非数字段视为 0
 */
function compareSDKVersion(target) {
  const cur = safeGetSDKVersion()
  const a = cur.split('.').map(x => parseInt(x, 10) || 0)
  const b = String(target || '0.0.0').split('.').map(x => parseInt(x, 10) || 0)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const ai = a[i] || 0
    const bi = b[i] || 0
    if (ai < bi) return -1
    if (ai > bi) return 1
  }
  return 0
}

/**
 * 安全封装 wx.loadSubpackage
 * 用于 P1-3 分包懒加载。Promise 形式 resolve true/false
 * 低版本不支持或分包名缺失时 resolve(false)
 */
function safeLoadSubpackage(name) {
  if (!isWx || typeof wx.loadSubpackage !== 'function') return Promise.resolve(false)
  return new Promise(resolve => {
    try {
      wx.loadSubpackage({
        name: name,
        success: () => resolve(true),
        fail: () => resolve(false),
      })
    } catch (_e) { resolve(false) }
  })
}

module.exports = {
  isWx,
  safeToast,
  safeModal,
  safeNavigateTo,
  safeRedirectTo,
  safeSwitchTab,
  safeNavigateBack,
  safePageScrollTo,
  safeGetStorageSync,
  safeSetStorageSync,
  safeRemoveStorageSync,
  // P1-2 新增守卫
  safeCreateSelectorQuery,
  safeShowActionSheet,
  safeGetUpdateManager,
  safeShowModal,
  safeOnNeedPrivacyAuthorization,
  safeGetSDKVersion,
  compareSDKVersion,
  // P1-3 分包懒加载
  safeLoadSubpackage,
}
