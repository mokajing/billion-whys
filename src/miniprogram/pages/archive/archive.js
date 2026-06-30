const content = require('../../utils/content')
const { safeToast, safeSwitchTab, safeShowActionSheet } = require('../../utils/safe-wx')
const i18n = require('../../utils/i18n')

Page({
  data: {
    activeTab: 'history',
    historyGroups: [],
    streakDays: 0,
    totalViewed: 0,
    todayViewedCount: 0,
    isEmpty: true,
    favoriteList: [],
    favoriteCount: 0,
    // V8.18 Sprint 27：i18n 注入
    locale: 'zh',
    t: i18n.dict('zh'),
    tabFavoritesText: '',
    tabFavoritesAria: '',
    statViewedAria: '',
    statTodayAria: '',
    statStreakAria: '',
  },

  onShow() {
    const locale = i18n.getLocale()
    const t = i18n.dict(locale)
    this.setData({
      locale,
      t,
      tabFavoritesText: i18n.t('archive.tabFavoritesText', { n: this.data.favoriteCount }, locale),
      tabFavoritesAria: i18n.t('archive.tabFavoritesAria', { n: this.data.favoriteCount }, locale),
      statViewedAria: i18n.t('archive.statViewed', undefined, locale),
      statTodayAria: i18n.t('archive.statToday', undefined, locale),
      statStreakAria: i18n.t('archive.statStreak', undefined, locale),
    })
    this.loadHistory()
    this.loadFavorites()
  },

  onSwitchTab(e) {
    this.setData({ activeTab: e.currentTarget.dataset.tab })
  },

  loadFavorites() {
    try {
      const favIds = content.getFavorites()
      const list = favIds.map(id => content.getById(id)).filter(Boolean)
        .map(q => ({
          id: q.id,
          question: q.question,
          category: q.category,
          age: q.age,
          favAria: i18n.t('archive.favLongPressAria', { q: q.question }, this.data.locale),
        }))
      const count = list.length
      this.setData({
        favoriteList: list,
        favoriteCount: count,
        tabFavoritesText: i18n.t('archive.tabFavoritesText', { n: count }, this.data.locale),
        tabFavoritesAria: i18n.t('archive.tabFavoritesAria', { n: count }, this.data.locale),
      })
    } catch (_e) {
      this.setData({ favoriteList: [], favoriteCount: 0 })
    }
  },

  loadHistory() {
    try {
      const history = content.getViewHistory()
      if (history.length === 0) {
        this.setData({ historyGroups: [], streakDays: 0, totalViewed: 0, todayViewedCount: 0, isEmpty: true })
        return
      }

      const uniqueIds = new Set(history.map(v => v.id))
      const streak = content.calcStreak(history)

      const today = new Date().toDateString()
      const todayViewed = new Set(
        history.filter(v => new Date(v.timestamp).toDateString() === today).map(v => v.id)
      ).size

      const groups = {}
      const sorted = history.slice().sort((a, b) => b.timestamp - a.timestamp)
      const seen = new Set()
      for (const entry of sorted) {
        const date = new Date(entry.timestamp)
        const dateKey = (date.getMonth() + 1) + '月' + date.getDate() + '日'
        if (!groups[dateKey]) groups[dateKey] = []
        const dedupKey = dateKey + ':' + entry.id
        if (!seen.has(dedupKey)) {
          seen.add(dedupKey)
          const q = content.getById(entry.id)
          if (q) groups[dateKey].push({ id: q.id, question: q.question, category: q.category, age: q.age })
        }
      }

      const historyGroups = Object.keys(groups).map(date => ({ date, items: groups[date] }))

      this.setData({
        historyGroups,
        streakDays: streak,
        totalViewed: uniqueIds.size,
        todayViewedCount: todayViewed,
        isEmpty: false,
      })
    } catch (_e) {
      this.setData({ historyGroups: [], streakDays: 0, totalViewed: 0, todayViewedCount: 0, isEmpty: true })
      safeToast({ title: i18n.t('archive.loadErrorToast', undefined, this.data.locale), icon: 'none' })
    }
  },

  onQuestionTap(e) {
    content.safeNavigateTo('/pages/question/question?id=' + e.currentTarget.dataset.id)
  },

  onGoDiscover() {
    safeSwitchTab('/pages/discover/discover')
  },

  onFavoriteLongPress(e) {
    const id = e.currentTarget.dataset.id
    const item = this.data.favoriteList.find(f => f.id === id)
    const question = item ? item.question : ''
    const locale = this.data.locale
    safeShowActionSheet({
      itemList: [i18n.t('archive.confirmOk', undefined, locale)],
      itemColor: '#1A5C3A',
    }).then((tapIndex) => {
      if (tapIndex === 0) {
        content.toggleFavorite(id)
        this.loadFavorites()
        safeToast({ title: i18n.t('archive.toastRemoved', undefined, locale), icon: 'success' })
      }
    })
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
