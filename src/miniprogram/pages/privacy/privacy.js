// V8.23 Sprint 32 法务专项: 隐私政策正文 i18n 化
// Why: V8.18 法务张律一票否决 "隐私政策正文不与 UI chrome 同批翻译"，本轮收口
// 与 H5 src/h5/pages/Profile.vue 隐私面板共享同一组 i18n key (profile.privacy.* / profile.agreement.*)
// 毒舌老王: 原先 6 节冗余结构 → 统一为 H5 的 "5 条承诺 + 用户协议" 单一真相源
const i18n = require('../../utils/i18n')
const { safeNavigateBack } = require('../../utils/safe-wx')

Page({
  data: {
    version: '',
    releaseDate: '',
    t: i18n.dict('zh'),
    versionLine: '',
  },

  onLoad() {
    const app = getApp()
    const gd = app && app.globalData
    const locale = i18n.getLocale()
    let version = ''
    let releaseDate = ''
    if (gd) {
      version = gd.version || ''
      releaseDate = gd.releaseDate || ''
    }
    this.setData({
      version,
      releaseDate,
      t: i18n.dict(locale),
      versionLine: i18n.t('privacy.versionLine', { v: version || 'unknown', d: releaseDate || '—' }, locale),
    })
  },

  onBack() {
    safeNavigateBack(1)
  },

  onShareAppMessage() {
    return {
      title: '和宝宝一起探索十亿个为什么',
      path: '/pages/discover/discover',
    }
  },
  onShareTimeline() {
    return {
      title: '和宝宝一起探索十亿个为什么',
    }
  },
})
