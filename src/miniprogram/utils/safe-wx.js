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
}
