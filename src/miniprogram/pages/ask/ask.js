const content = require('../../utils/content')
const storage = require('../../utils/storage')
const { safeToast } = require('../../utils/safe-wx')
const analytics = require('../../utils/analytics')

Page({
  data: {
    keyword: '',
    results: [],
    suggestions: [],
    hotQuestions: [],
    hints: [],
    hasSearched: false,
    recentSearches: [],
  },

  onLoad() {
    this._searchTimer = null
    try {
      const hot = content.hotQuestions()
      const hotProjected = hot.map(q => ({ id: q.id, question: q.question }))
      const all = content.getAll()
      const shuffled = all.slice()
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = tmp
      }
      this.setData({
        hotQuestions: hotProjected,
        hints: shuffled.slice(0, 5).map(q => q.question),
        recentSearches: storage.getSearchHistory(),
      })
      analytics.pageView('ask')
    } catch (_e) {
      safeToast({ title: '内容加载失败', icon: 'none' })
    }
  },

  onInput(e) {
    const keyword = e.detail.value
    this.setData({ keyword })
    clearTimeout(this._searchTimer)
    if (!keyword.trim()) {
      this.setData({ results: [], suggestions: [], hasSearched: false })
      return
    }
    this._searchTimer = setTimeout(() => this.doSearch(), 300)
  },

  doSearch() {
    const kw = this.data.keyword.trim()
    if (!kw) return
    const raw = content.search(kw)
    const results = raw.map(q => ({ id: q.id, question: q.question, tagsText: (q.tags || []).join(' · ') }))
    const rawSug = raw.length === 0 ? content.suggestRelated(kw) : []
    const suggestions = rawSug.map(q => ({ id: q.id, question: q.question, tagsText: (q.tags || []).join(' · ') }))
    storage.pushSearchHistory(kw)
    this.setData({
      results,
      suggestions,
      hasSearched: true,
      recentSearches: storage.getSearchHistory(),
    })
    analytics.search(kw, results.length)
  },

  onClear() {
    clearTimeout(this._searchTimer)
    this.setData({ keyword: '', results: [], suggestions: [], hasSearched: false })
  },

  onRecentTap(e) {
    const term = e.currentTarget.dataset.term
    if (!term) return
    this.setData({ keyword: term })
    this.doSearch()
  },

  onClearHistory() {
    storage.clearSearchHistory()
    this.setData({ recentSearches: [] })
  },

  onHintTap(e) {
    const hint = e.currentTarget.dataset.hint
    this.setData({ keyword: hint })
    this.doSearch()
  },

  onUnload() {
    clearTimeout(this._searchTimer)
  },

  onResultTap(e) {
    content.safeNavigateTo('/pages/question/question?id=' + e.currentTarget.dataset.id)
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
