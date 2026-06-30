const content = require('../../utils/content')
const { categories, categoryIcons } = require('../../utils/constants')
const { safeToast, safePageScrollTo } = require('../../utils/safe-wx')
const analytics = require('../../utils/analytics')
const i18n = require('../../utils/i18n')

const DEFAULT_SHOW = 8

Page({
  data: {
    categories: categories.map(c => ({ ...c, count: 0 })),
    activeCategory: 'all',
    displayQuestions: [],
    totalCount: 0,
    totalFiltered: 0,
    expanded: false,
    hasMore: false,
    categoryIcons,
    loadError: false,
    dailyPick: null,
    locale: i18n.getLocale(),
    t: i18n.dict(),
  },

  onLoad() {
    try {
      const all = content.getAll()
      const counts = {}
      all.forEach(q => { counts[q.category] = (counts[q.category] || 0) + 1 })
      const cats = this.data.categories.map(c => ({
        ...c,
        count: c.key === 'all' ? all.length : (counts[c.key] || 0),
      }))
      const pick = content.dailyPick()
      const dailyPick = pick ? {
        id: pick.id,
        question: pick.question,
        category: pick.category,
        categoryIcon: categoryIcons[pick.category] || '❓',
      } : null
      this.setData({
        categories: cats,
        totalCount: all.length,
        loadError: false,
        dailyPick,
        subtitleText: i18n.t('discover.subtitle', { n: all.length }),
        dailyPickAria: dailyPick ? (i18n.t('discover.dailyTag') + ' ' + dailyPick.question) : '',
      })
      this.refreshList()
      analytics.pageView('discover')
    } catch (_e) {
      this.setData({ totalCount: 0, displayQuestions: [], loadError: true })
      safeToast({ title: i18n.t('discover.loadError'), icon: 'none' })
    }
  },

  refreshList() {
    const cat = this.data.activeCategory
    const filtered = content.getByCategory(cat)
    const expanded = this.data.expanded
    const items = expanded ? filtered : filtered.slice(0, DEFAULT_SHOW)
    const display = items.map(q => ({
      id: q.id,
      question: q.question,
      age: q.age,
      category: q.category,
      tags: (q.tags || []).join(' · '),
      thumbImage: content.toWebP(q.layer1 && q.layer1.image ? q.layer1.image : ''),
    }))
    this.setData({
      displayQuestions: display,
      totalFiltered: filtered.length,
      hasMore: filtered.length > DEFAULT_SHOW && !expanded,
      expandMoreText: i18n.t('discover.expand', { n: filtered.length }),
      collapseText: i18n.t('discover.collapse'),
    })
  },

  onCategoryTap(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ activeCategory: key, expanded: false }, () => this.refreshList())
    safePageScrollTo(0)
    analytics.tabSwitch(key)
  },

  onRetry() {
    this.onLoad()
  },

  onQuestionTap(e) {
    content.safeNavigateTo('/pages/question/question?id=' + e.currentTarget.dataset.id)
  },

  onDailyPickTap() {
    if (!this.data.dailyPick) return
    content.safeNavigateTo('/pages/question/question?id=' + this.data.dailyPick.id)
  },

  onToggleExpand() {
    const wasExpanded = this.data.expanded
    this.setData({ expanded: !wasExpanded })
    this.refreshList()
    if (wasExpanded) safePageScrollTo(0)
  },

  onThumbError(e) {
    const idx = e.currentTarget.dataset.index
    this.setData({ ['displayQuestions[' + idx + '].thumbImage']: '' })
  },

  onShareAppMessage() {
    analytics.share('/pages/discover/discover')
    return {
      title: '十亿个什么与为什么 — 好奇心是最厉害的超能力',
      path: '/pages/discover/discover',
    }
  },

  onShareTimeline() {
    return {
      title: '十亿个什么与为什么 — 2-6岁好奇心即时响应',
    }
  },
})
