// V8.25 第93轮 Sprint 34：LocaleSwitcher MP 自定义组件（与 H5 LocaleSwitcher.vue 同构）
// Why: CEO 周远见 — 北极星漏斗第19阶；V9 出海翻译流水线就绪后翻 flag 即上
// 法务张律 一票否决：默认 flag-off 不渲染；en DICT 179 key 覆盖不全 + 内容 270 条仍 zh-only
// 前端小凡：双端同构；label 走 i18n.t() 查表（安全李姐红线）；零网络延续
// 心理学家周教授：纯 UI 协议层，无内容输出，未触发适龄红线
const i18n = require('../../utils/i18n')

Component({
  data: {
    enabled: false,
    currentBase: 'zh',
    ariaLabel: '',
    zhLabel: '',
    enLabel: '',
  },

  lifetimes: {
    attached() {
      this.refresh()
    },
  },

  methods: {
    // 法务张律：flag-off 时 enabled=false，wxml wx:if 不渲染
    refresh() {
      this.setData({
        enabled: i18n.isLocaleSwitcherEnabled(),
        currentBase: i18n.normalizeLocale(i18n.getLocale()),
        ariaLabel: i18n.t('locale.switcher.aria'),
        zhLabel: i18n.t('locale.switcher.zh'),
        enLabel: i18n.t('locale.switcher.en'),
      })
    },

    selectZh() {
      i18n.setLocale('zh')
      this.refresh()
    },

    selectEn() {
      i18n.setLocale('en')
      this.refresh()
    },
  },
})
