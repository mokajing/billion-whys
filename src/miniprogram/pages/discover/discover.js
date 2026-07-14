const content = require('../../utils/content')
const { categories, categoryIcons } = require('../../utils/constants')
const { safeToast, safePageScrollTo } = require('../../utils/safe-wx')
const analytics = require('../../utils/analytics')
const i18n = require('../../utils/i18n')

const DEFAULT_SHOW = 8

// V8.70 第134轮：年龄偏好存储（localStorage 等效，纯设备端）
const AGE_PREF_KEY = 'bw_age_preference'
const AGE_DISMISS_KEY = 'bw_age_dismiss_ts'
const AGE_DISMISS_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000 // V8.71 第135轮：3天冷却期
const AGE_OPTIONS = ['3-4', '4-5', '5-6']

function loadAgePreference() {
  try {
    const val = wx.getStorageSync(AGE_PREF_KEY)
    return val && AGE_OPTIONS.indexOf(val) !== -1 ? val : ''
  } catch (_e) {
    return ''
  }
}

function saveAgePreference(age) {
  try {
    wx.setStorageSync(AGE_PREF_KEY, age)
  } catch (_e) {
    // storage full — silently ignore
  }
}

// V8.71 第135轮：年龄引导"以后再说"3天冷却期
function loadAgeDismissTs() {
  try {
    const val = wx.getStorageSync(AGE_DISMISS_KEY)
    const ts = val ? parseInt(val, 10) : 0
    return ts && !isNaN(ts) ? ts : 0
  } catch (_e) {
    return 0
  }
}

function saveAgeDismissTs(ts) {
  try {
    wx.setStorageSync(AGE_DISMISS_KEY, String(ts))
  } catch (_e) {
    // silently ignore
  }
}

function shouldShowAgeGuide() {
  if (loadAgePreference()) return false
  const dismissTs = loadAgeDismissTs()
  if (!dismissTs) return true
  return Date.now() - dismissTs >= AGE_DISMISS_COOLDOWN_MS
}

function ageFilter(questions, agePreference) {
  if (!agePreference) return questions
  const parts = agePreference.split('-')
  const min = parseInt(parts[0], 10)
  const max = parseInt(parts[1], 10)
  return questions.filter(function (q) {
    if (!q.age) return true
    var match = q.age.match(/(\d+)\s*[-~]\s*(\d+)/)
    if (!match) return true
    var qMin = parseInt(match[1], 10)
    var qMax = parseInt(match[2], 10)
    return qMin <= max && qMax >= min
  })
}

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
    // V8.70 第134轮：年龄自适应
    showAgeGuide: false,
    agePreference: '',
    ageOptions: [],
  },

  onLoad() {
    try {
      // V8.70 第134轮：年龄偏好加载
      const agePref = loadAgePreference()
      const ageOptions = [
        { value: '3-4', label: i18n.t('discover.ageOption34'), desc: i18n.t('discover.ageOption34Desc') },
        { value: '4-5', label: i18n.t('discover.ageOption45'), desc: i18n.t('discover.ageOption45Desc') },
        { value: '5-6', label: i18n.t('discover.ageOption56'), desc: i18n.t('discover.ageOption56Desc') },
      ]

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
      // V8.63 第127轮：今日 3 问年龄分层
      let picks = content.dailyPicks()
      // V8.70 第134轮：年龄偏好过滤
      if (agePref) {
        picks = ageFilter(picks, agePref)
      }
      // V8.66 第130轮：年龄色系映射（墨小暖+彩虹姐）
      function ageColor(label) {
        if (!label) return ''
        if (label.includes('3-4') || label.includes('3~4')) return 'pink'
        if (label.includes('4-5') || label.includes('4~5')) return 'orange'
        if (label.includes('5-6') || label.includes('5~6')) return 'yellow'
        return ''
      }
      const dailyPicks = picks.map(p => ({
        id: p.id,
        question: p.question,
        category: p.category,
        categoryIcon: categoryIcons[p.category] || '❓',
        ageLabel: p.ageLabel || '',
        ageColor: ageColor(p.ageLabel),
      }))
      this.setData({
        categories: cats,
        totalCount: all.length,
        loadError: false,
        dailyPick,
        dailyPicks,
        subtitleText: i18n.t('discover.subtitle', { n: all.length }),
        dailyPickAria: dailyPick ? (i18n.t('discover.dailyTag') + ' ' + dailyPick.question) : '',
        agePreference: agePref,
        ageOptions,
        // V8.71 第135轮：3天冷却期检查
        showAgeGuide: shouldShowAgeGuide(),
      })
      this.refreshList()
      analytics.pageView('discover')
      // V8.62 第126轮：异步加载分包全量数据（主包瘦身，不阻塞首屏渲染）
      content.initAsync().catch(() => {})
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

    // V8.70 第134轮：继续探索（最近 3 个浏览问题）
    let recentViewed = []
    try {
      const history = wx.getStorageSync('bw_view_history')
      const arr = history ? JSON.parse(history) : []
      const seen = {}
      const recent = []
      for (var i = arr.length - 1; i >= 0; i--) {
        const entry = arr[i]
        if (!entry || !entry.id) continue
        if (seen[entry.id]) continue
        seen[entry.id] = true
        const q = content.getById(entry.id)
        if (q) recent.push(q)
        if (recent.length >= 3) break
      }
      recentViewed = recent.map(function (q) {
        return {
          id: q.id,
          question: q.question,
          category: q.category,
        }
      })
    } catch (_e) {
      recentViewed = []
    }

    this.setData({
      displayQuestions: display,
      totalFiltered: filtered.length,
      hasMore: filtered.length > DEFAULT_SHOW && !expanded,
      expandMoreText: i18n.t('discover.expand', { n: filtered.length }),
      collapseText: i18n.t('discover.collapse'),
      recentViewed: recentViewed,
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

  onDailyPickTap(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    content.safeNavigateTo('/pages/question/question?id=' + id)
  },

  // V8.70 第134轮：年龄偏好事件
  onSelectAge(e) {
    const age = e.currentTarget.dataset.value
    if (AGE_OPTIONS.indexOf(age) === -1) return
    this.setData({ agePreference: age })
  },

  onConfirmAge() {
    if (!this.data.agePreference) return
    saveAgePreference(this.data.agePreference)
    this.setData({ showAgeGuide: false })
    // 重新加载今日3问（带年龄过滤）
    this.onLoad()
  },

  onDismissAge() {
    // V8.71 第135轮：记录"以后再说"时间戳，3天冷却后再次弹出
    saveAgeDismissTs(Date.now())
    this.setData({ showAgeGuide: false })
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
