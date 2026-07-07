const content = require('../../utils/content')
const storage = require('../../utils/storage')
const { safeToast, safeModal, safeNavigateTo } = require('../../utils/safe-wx')
const analytics = require('../../utils/analytics')
const i18n = require('../../utils/i18n')
const minorProtection = require('../../utils/minor-protection')

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
    // V8.11 Sprint 20：当日反馈深度分布可视化（L2+L3>0 才显示）
    depthViz: { show: false, L1: 0, L2: 0, L3: 0, total: 0, l1Pct: 0, l2Pct: 0, l3Pct: 0, text: '', ariaLabel: '' },
    // V8.13 Sprint 22：累计参与度汇总卡片（H5 feedbackSummary + preview/replay 计数同构）
    summary: { total: 0, up: 0, down: 0, reset: 0, depthL2: 0, depthL3: 0, showDepth: false, depthTotal: 0 },
    previewCount: 0,
    replayCount: 0,
    // V8.14 Sprint 23：i18n 出海前置（locale 仅内部切换，UI 不暴露）
    locale: 'zh',
    t: i18n.dict('zh'),
    summaryAriaLabel: '累计反馈参与度汇总',
    summaryTotalText: '',
    summaryDepthText: '',
    summaryPreviewText: '',
    summaryReplayText: '',
    summaryEmptyText: '',
    // V8.18 Sprint 27：UI chrome 预计算字段
    statLibraryAria: '',
    statViewedAria: '',
    statStreakAria: '',
    statFavAria: '',
    statFeedbackAria: '',
    trendTitleText: '',
    trendBarAria: '',
    dayDetailAria: '',
    versionFooterText: '',
    // 未成年人保护：今日剩余时间
    remainingMin: 30,
    dailyUsedMin: 0,
    usagePct: 0,
    parentVerified: false,
    // V8.73 第137轮：年龄偏好切换（周教授+叶用户+苏体验+前端小凡）
    agePreference: '',
    ageOptions: [
      { value: '3-4', label: '3-4岁' },
      { value: '4-5', label: '4-5岁' },
      { value: '5-6', label: '5-6岁' },
    ],
  },

  onLoad() {
    try {
      const locale = i18n.getLocale()
      const version = (getApp() && getApp().globalData && getApp().globalData.version) || 'unknown'
      // V8.73 第137轮：加载年龄偏好
      const agePref = this._loadAgePreference()
      this.setData({
        locale,
        t: i18n.dict(locale),
        version,
        totalQuestions: content.getAll().length,
        versionFooterText: i18n.t('profile.versionFooter', { v: version }, locale),
        agePreference: agePref,
      })
      analytics.pageView('profile')
    } catch (_e) {
      safeToast({ title: i18n.t('profile.feedbackLoadToast', undefined, this.data.locale), icon: 'none' })
    }
  },

  onShow() {
    try {
      const locale = i18n.getLocale()
      const t = i18n.dict(locale)
      const history = content.getViewHistory()
      const viewedIds = new Set(history.map(v => v.id))
      const streak = content.calcStreak(history)
      const favCount = content.getFavorites().length
      const fbCount = content.getAnswerFeedbackCount()
      // V8.19 Sprint 28 i18n 第三批：streakMessage 6 条出海，en 用 "in a row" 口语
      let msg = ''
      if (streak === 0 && viewedIds.size > 0) msg = i18n.t('profile.streakMsg.returning', undefined, locale)
      else if (streak === 0 && viewedIds.size === 0) msg = i18n.t('profile.streakMsg.firstTime', undefined, locale)
      else if (streak >= 30) msg = i18n.t('profile.streakMsg.day30', undefined, locale)
      else if (streak >= 7) msg = i18n.t('profile.streakMsg.day7', undefined, locale)
      else if (streak >= 3) msg = i18n.t('profile.streakMsg.day3', undefined, locale)
      else if (streak >= 1) msg = i18n.t('profile.streakMsg.day1', undefined, locale)
      // V8.4 Sprint 13：7 天反馈趋势数据
      const trend = content.getFeedbackTrend7d()
      const maxCount = Math.max(1, ...trend.map(d => Math.max(d.up, d.down, d.reset)))
      const trendWithBars = trend.map(d => {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const dDate = new Date(d.date + 'T00:00:00')
        const diff = Math.round((today - dDate) / 86400000)
        // V8.19 Sprint 28 i18n 第三批：bar label 单字（zh）/3 字母（en），与 H5 dayLabel() 对齐
        let label
        if (diff === 0) label = i18n.t('profile.dayLabel.today', undefined, locale)
        else if (diff === 1) label = i18n.t('profile.dayLabel.yesterday', undefined, locale)
        else label = i18n.t('profile.weekday.' + dDate.getDay(), undefined, locale)
        const dayLabelStr = label
        const ariaLabel = d.total === 0
          ? i18n.t('profile.dayAria', { day: dayLabelStr, n: d.total }, locale)
          : i18n.t('profile.dayAriaWithDetail', { day: dayLabelStr, n: d.total }, locale)
        return Object.assign({}, d, {
          upH: d.up ? Math.max(8, Math.round((d.up / maxCount) * 48)) : 0,
          downH: d.down ? Math.max(8, Math.round((d.down / maxCount) * 48)) : 0,
          resetH: d.reset ? Math.max(8, Math.round((d.reset / maxCount) * 48)) : 0,
          label,
          ariaLabel,
        })
      })
      const trendTotal = trend.reduce((s, d) => s + d.total, 0)
      // V8.13 Sprint 22：累计参与度汇总
      const sum = content.getFeedbackSummary()
      const depthTotal = sum.depthL2 + sum.depthL3
      const summary = {
        total: sum.total,
        up: sum.up,
        down: sum.down,
        reset: sum.reset,
        depthL2: sum.depthL2,
        depthL3: sum.depthL3,
        depthTotal,
        showDepth: depthTotal > 0,
      }
      const previewCount = storage.getDetailActionCount('preview')
      const replayCount = storage.getDetailActionCount('replay')
      // 未成年人保护：使用时长统计
      const stats = minorProtection.getUsageStats()
      const usagePct = Math.min(100, Math.round((stats.dailyUsedMs / stats.dailyLimitMs) * 100))
      // P2-4 整改：拆为 3 次 setData 降低单次 payload
      // 1) 基础统计与 i18n locale（高频字段，立即渲染）
      this.setData({
        locale,
        t,
        viewedCount: viewedIds.size,
        streakDays: streak,
        favoriteCount: favCount,
        feedbackCount: fbCount,
        streakMessage: msg,
        remainingMin: stats.dailyRemainingMin,
        dailyUsedMin: stats.dailyUsedMin,
        usagePct,
        parentVerified: stats.parentVerified,
      })
      // 2) summary 与 aria 文案（依赖 summary/preview/replay 等计算结果）
      this.setData({
        summary,
        previewCount,
        replayCount,
        summaryAriaLabel: i18n.t('profile.summary.aria', undefined, locale),
        summaryTotalText: i18n.t('profile.summary.total', { n: summary.total }, locale),
        summaryDepthText: i18n.t('profile.summary.depth', { n: summary.depthTotal, a: summary.depthL2, b: summary.depthL3 }, locale),
        summaryPreviewText: i18n.t('profile.summary.preview', { n: previewCount }, locale),
        summaryReplayText: i18n.t('profile.summary.replay', { n: replayCount }, locale),
        summaryEmptyText: i18n.t('profile.summary.empty', undefined, locale),
        statLibraryAria: i18n.t('profile.statLibrary', undefined, locale) + ' ' + content.getAll().length,
        statViewedAria: i18n.t('profile.statViewed', undefined, locale) + ' ' + viewedIds.size,
        statStreakAria: i18n.t('profile.statStreak', undefined, locale) + ' ' + streak,
        statFavAria: i18n.t('profile.statFav', undefined, locale) + ' ' + favCount,
        statFeedbackAria: i18n.t('profile.statFeedback', undefined, locale) + ' ' + fbCount,
      })
      // 3) 反馈趋势图（独立卡片；缓存计算结果避免 onShow 重渲染时重算）
      this._trendCache = { trendWithBars, trendTotal, ts: Date.now() }
      this.setData({
        feedbackTrend7d: trendWithBars,
        feedbackTrendTotal: trendTotal,
        trendTitleText: i18n.t('profile.trendTitle', { n: trendTotal }, locale),
        trendBarAria: i18n.t('profile.trendBarAria', { n: trendTotal }, locale),
      })
    } catch (_e) {
      safeToast({ title: i18n.t('profile.dataLoadToast', undefined, this.data.locale), icon: 'none' })
    }
  },

  onFeedback() {
    this.setData({ showFeedback: !this.data.showFeedback })
  },

  // V8.5 Sprint 14：当日明细 accordion 切换；空列不展开（UX 苏体验：避免空状态抢镜）
  onTapDay(e) {
    const { date, total } = e.currentTarget.dataset
    if (!total) return
    const locale = this.data.locale
    if (this.data.expandedDay === date) {
      this.setData({
        expandedDay: '', detailList: [], detailHeader: '', dayDetailAria: '',
        depthViz: { show: false, L1: 0, L2: 0, L3: 0, total: 0, l1Pct: 0, l2Pct: 0, l3Pct: 0, text: '', ariaLabel: '' },
      })
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
    if (reset) parts.push(i18n.t('profile.detailResetCount', { n: reset }, locale))
    const d = new Date(date + 'T00:00:00')
    const weekday = i18n.t('profile.weekday.' + d.getDay(), undefined, locale)
    const month = i18n.t('profile.monthShort.' + d.getMonth(), undefined, locale)
    const partsStr = parts.length ? parts.join(' · ') : i18n.t('profile.detailNoFeedback', undefined, locale)
    const detailHeaderStr = i18n.t('profile.detailHeaderFormat', { month, date: d.getDate(), weekday, parts: partsStr }, locale)
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
      depthText: i18n.t('profile.depthText', { n: x.depth || 1 }, locale),
      depthAria: i18n.t('profile.depthAria', { n: x.depth || 1 }, locale),
      replayAria: x.id ? i18n.t('profile.replayAria', { title: x.title || '' }, locale) : '',
    }))
    // V8.11 第79轮 Sprint 20：当日反馈深度分布可视化（L2+L3>0 才显示）
    // Why: V8.9 把 depth 写进 feedbackLog 但 Profile 不可见——"埋了数据没界面"
    // CCO 文若水：文案用"读到第N层 X 次"，100% L1 不显示避免噪声
    const dist = content.getFeedbackDepthByDate(date)
    const L1 = dist.L1 || 0, L2 = dist.L2 || 0, L3 = dist.L3 || 0, totalDist = dist.total || 0
    const showDepthViz = (L2 + L3) > 0 && totalDist > 0
    const pct = (n) => totalDist > 0 ? Math.round((n / totalDist) * 100) : 0
    const depthParts = []
    if (L2) depthParts.push(i18n.t('profile.depthText', { n: 2 }, locale) + ' ' + L2 + ' 次')
    if (L3) depthParts.push(i18n.t('profile.depthText', { n: 3 }, locale) + ' ' + L3 + ' 次')
    this.setData({
      expandedDay: date,
      detailList: formatted,
      detailHeader: detailHeaderStr,
      dayDetailAria: i18n.t('profile.dayDetailAria', { day: date }, locale),
      depthViz: {
        show: showDepthViz,
        L1, L2, L3, total: totalDist,
        l1Pct: pct(L1),
        l2Pct: pct(L2),
        l3Pct: pct(L3),
        text: depthParts.join(' · '),
        ariaLabel: `今日反馈深度分布：第1层 ${L1} 次，第2层 ${L2} 次，第3层 ${L3} 次，共 ${totalDist} 次`,
      },
    })
  },

  onAbout() {
    const locale = this.data.locale
    safeModal({
      title: i18n.t('profile.aboutTitle', undefined, locale),
      content: i18n.t('profile.aboutContent', undefined, locale),
      showCancel: false,
    })
  },

  // V8.6 Sprint 15：当日明细列表项"再读一遍"→跳转 QuestionDetail
  // Why: 北极星漏斗最后1步闭环（CEO周远见）；UX 苏体验：跳转不收起 accordion，回来还在原位
  onTapDetailItem(e) {
    const { id } = e.currentTarget.dataset
    if (!id) return // 老 entry 无 id 不跳转（UX 苏体验：避免误导）
    analytics.feedbackDetailReplay(id)
    storage.incrementDetailActionCount('replay')
    safeNavigateTo('/pages/question/question?id=' + id)
  },

  // V8.12 第80轮 Sprint 21：当日明细列表项长按预览（UX 苏体验 + 毒舌老王"看完就回来"）
  // Why: V8.6 跳转-回来太重，妈妈长按可速览 layer1 答案；预览后再决定是否"再读一遍"
  // 法务张律放行：仅本地 questionMap 查表 + wx.showModal，无新数据收集；埋点 detail 仅 questionId 非儿童身份
  onPreviewDetail(e) {
    const { id } = e.currentTarget.dataset
    if (!id) return
    const locale = this.data.locale
    const preview = content.previewAnswerForId(id)
    analytics.feedbackDetailPreview(id)
    storage.incrementDetailActionCount('preview')
    if (!preview || !preview.snippet) {
      safeModal({
        title: preview && preview.title ? preview.title : i18n.t('profile.aboutTitle', undefined, locale),
        content: i18n.t('profile.previewEmpty', undefined, locale),
        showCancel: false,
        confirmText: i18n.t('profile.previewClose', undefined, locale),
      })
      return
    }
    safeModal({
      title: preview.title,
      content: preview.snippet,
      confirmText: i18n.t('profile.previewReplay', undefined, locale),
      cancelText: i18n.t('profile.previewClose', undefined, locale),
    }).then((confirm) => {
      if (confirm) {
        analytics.feedbackDetailReplay(id)
        storage.incrementDetailActionCount('replay')
        safeNavigateTo('/pages/question/question?id=' + id)
      }
    })
  },

  onPrivacy() {
    safeNavigateTo('/pages/privacy/privacy')
  },

  // 举报不当内容 → 跳转举报页
  onReport() {
    safeNavigateTo('/pages/report/report')
  },

  // 家长控制面板：展示使用统计
  onParentControl() {
    const stats = minorProtection.getUsageStats()
    const verifiedText = stats.parentVerified ? '已验证 ✓' : '未验证'
    const lastTs = stats.lastVerifiedAt
      ? new Date(stats.lastVerifiedAt).toLocaleDateString('zh-CN')
      : '无'
    const content =
      `家长验证状态：${verifiedText}\n` +
      `上次验证日期：${lastTs}\n` +
      `今日已使用：${stats.dailyUsedMin} 分钟 / 30 分钟\n` +
      `本次会话已使用：${stats.sessionUsedMin} 分钟 / 15 分钟\n\n` +
      `保护机制：\n` +
      `· 单次会话 ≤ 15 分钟\n` +
      `· 每日累计 ≤ 30 分钟\n` +
      `· 22:00 - 6:00 不可用`
    safeModal({
      title: '家长控制面板',
      content,
      showCancel: false,
      confirmText: '我知道了',
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

  // V8.73 第137轮：哥哥姐姐确认提示（周教授+叶用户+苏体验+前端小凡）
  // Why: 切换年龄段时弹出确认提示，保护孩子认知安全
  onAgeSwitch(e) {
    const age = e.currentTarget.dataset.age
    if (!age) return

    const currentAge = this.data.agePreference
    // 首次选择，直接确认
    if (!currentAge) {
      this._saveAgePreference(age)
      this.setData({ agePreference: age })
      safeToast({ title: '已切换为 ' + this._getAgeLabel(age), icon: 'success' })
      return
    }
    // 同一年龄，无需切换
    if (age === currentAge) return

    // 不同年龄，弹出确认提示
    const locale = this.data.locale || 'zh'
    const t = i18n.dict(locale)
    safeModal({
      title: '',
      content: t['discover.siblingConfirmText'].replace('{age}', this._getAgeLabel(age)),
      cancelText: t['discover.siblingConfirmCancel'],
      confirmText: t['discover.siblingConfirmOk'],
      success: (res) => {
        if (res.confirm) {
          this._saveAgePreference(age)
          this.setData({ agePreference: age })
          safeToast({ title: '已切换为 ' + this._getAgeLabel(age), icon: 'success' })
        }
      },
    })
  },

  _loadAgePreference() {
    try {
      const val = wx.getStorageSync('bw_age_preference')
      return val || ''
    } catch {
      return ''
    }
  },

  _saveAgePreference(age) {
    try {
      wx.setStorageSync('bw_age_preference', age)
    } catch {
      // silently ignore
    }
  },

  _getAgeLabel(age) {
    const opt = this.data.ageOptions.find(o => o.value === age)
    return opt ? opt.label : age
  },
})
