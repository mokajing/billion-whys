const content = require('../../utils/content')
const { safeToast, safeModal, safeNavigateTo } = require('../../utils/safe-wx')
const analytics = require('../../utils/analytics')

// V8.5 Sprint 14：HH:MM 时间格式化
function formatHm(ts) {
  const d = new Date(ts)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

Page({
  data: {
    version: '',
    totalQuestions: 0,
    viewedCount: 0,
    streakDays: 0,
    favoriteCount: 0,
    feedbackCount: 0,
    streakMessage: '',
    showFeedback: false,
    feedbackTrend7d: [],
    feedbackTrendTotal: 0,
    // V8.5 Sprint 14：当日明细 accordion — 同时只展开 1 列（CEO 裁决避免移动端滚动地狱）
    expandedDay: '',
    detailList: [],
    detailHeader: '',
  },

  onLoad() {
    try {
      this.setData({
        totalQuestions: content.getAll().length,
        version: (getApp() && getApp().globalData && getApp().globalData.version) || 'unknown',
      })
      analytics.pageView('profile')
    } catch (_e) {
      safeToast({ title: '内容加载失败', icon: 'none' })
    }
  },

  onShow() {
    try {
      const history = content.getViewHistory()
      const viewedIds = new Set(history.map(v => v.id))
      const streak = content.calcStreak(history)
      const favCount = content.getFavorites().length
      const fbCount = content.getAnswerFeedbackCount()
      let msg = ''
      if (streak === 0 && viewedIds.size > 0) msg = '欢迎回来！问问兔一直在等你哦'
      else if (streak === 0 && viewedIds.size === 0) msg = '你好呀！一起开始好奇心探索吧！'
      else if (streak >= 30) msg = '🏆 连续探索30天！你是超级小探险家！'
      else if (streak >= 7) msg = '🌟 连续探索一周了，好奇心满满！'
      else if (streak >= 3) msg = '✨ 连续探索3天，继续加油！'
      else if (streak >= 1) msg = '🌱 今天也来探索了，真棒！'
      // V8.4 Sprint 13：7 天反馈趋势数据
      const trend = content.getFeedbackTrend7d()
      const maxCount = Math.max(1, ...trend.map(d => Math.max(d.up, d.down, d.reset)))
      const trendWithBars = trend.map(d => {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const dDate = new Date(d.date + 'T00:00:00')
        const diff = Math.round((today - dDate) / 86400000)
        let label
        if (diff === 0) label = '今天'
        else if (diff === 1) label = '昨天'
        else label = '周' + ['日', '一', '二', '三', '四', '五', '六'][dDate.getDay()]
        return Object.assign({}, d, {
          upH: d.up ? Math.max(8, Math.round((d.up / maxCount) * 48)) : 0,
          downH: d.down ? Math.max(8, Math.round((d.down / maxCount) * 48)) : 0,
          resetH: d.reset ? Math.max(8, Math.round((d.reset / maxCount) * 48)) : 0,
          label,
        })
      })
      const trendTotal = trend.reduce((s, d) => s + d.total, 0)
      this.setData({
        viewedCount: viewedIds.size,
        streakDays: streak,
        favoriteCount: favCount,
        feedbackCount: fbCount,
        streakMessage: msg,
        feedbackTrend7d: trendWithBars,
        feedbackTrendTotal: trendTotal,
      })
    } catch (_e) {
      safeToast({ title: '数据加载失败', icon: 'none' })
    }
  },

  onFeedback() {
    this.setData({ showFeedback: !this.data.showFeedback })
  },

  // V8.5 Sprint 14：当日明细 accordion 切换；空列不展开（UX 苏体验：避免空状态抢镜）
  onTapDay(e) {
    const { date, total } = e.currentTarget.dataset
    if (!total) return
    if (this.data.expandedDay === date) {
      this.setData({ expandedDay: '', detailList: [], detailHeader: '' })
      return
    }
    const list = content.getFeedbackDetailByDate(date)
    const up = list.filter(x => x.action === 'up').length
    const down = list.filter(x => x.action === 'down').length
    const reset = list.filter(x => x.action === 'reset').length
    // CCO 文若水：≤1 行中性文案；心理学家周教授：reset 用"再评一次"避免评判
    const parts = []
    if (up) parts.push(`👍${up}`)
    if (down) parts.push(`👎${down}`)
    if (reset) parts.push(`再评${reset}`)
    const d = new Date(date + 'T00:00:00')
    const weekday = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
    const formatted = list.map(x => ({
      action: x.action,
      icon: x.action === 'up' ? '👍' : (x.action === 'down' ? '👎' : '↻'),
      time: formatHm(x.ts),
      title: x.title || '已反馈（记录已迁移）',
      // V8.6 Sprint 15：携带 id 用于"再读一遍"跳转；老 entry 无 id 时为空字符串
      id: x.id || '',
      hasId: !!x.id,
      // V8.9 Sprint 18：携带 depth 用于"读到第N层"徽章；depth>1 才显示（避免 depth=1 噪声）
      depth: x.depth || 1,
      showDepth: (x.depth || 1) > 1,
    }))
    this.setData({
      expandedDay: date,
      detailList: formatted,
      detailHeader: `${d.getMonth() + 1} 月 ${d.getDate()} 日 周${weekday} · ${parts.join(' · ') || '无反馈'}`,
    })
  },

  onAbout() {
    safeModal({
      title: '十亿个什么与为什么',
      content: '面向2-6岁儿童家庭的好奇心即时响应引擎',
      showCancel: false,
    })
  },

  // V8.6 Sprint 15：当日明细列表项"再读一遍"→跳转 QuestionDetail
  // Why: 北极星漏斗最后1步闭环（CEO周远见）；UX 苏体验：跳转不收起 accordion，回来还在原位
  onTapDetailItem(e) {
    const { id } = e.currentTarget.dataset
    if (!id) return // 老 entry 无 id 不跳转（UX 苏体验：避免误导）
    analytics.feedbackDetailReplay(id)
    safeNavigateTo('/pages/question/question?id=' + id)
  },

  onPrivacy() {
    safeNavigateTo('/pages/privacy/privacy')
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
