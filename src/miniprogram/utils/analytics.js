/**
 * analytics.js - 归因/埋点上报
 *
 * 反 BUG-054 类问题：归因埋点必须在用户行为发生时即刻上报，不依赖后续动作
 * 反 BUG-057 类问题：反作弊不信客户端时间戳，但本端只用本地时间做事件流水
 */

const { isWx } = require('./safe-wx')

const EVENT_NAMES = {
  PAGE_VIEW: 'page_view',
  QUESTION_VIEW: 'question_view',
  QUESTION_FAVORITE: 'question_favorite',
  SEARCH: 'search',
  TAB_SWITCH: 'tab_switch',
  SHARE: 'share',
  // V8.2 第71轮 Sprint 11：闭合 反馈→CTA→实验 增长漏斗（COO+AI小智）
  FEEDBACK_UP: 'feedback_up',
  FEEDBACK_DOWN: 'feedback_down',
  CTA_EXPERIMENT: 'cta_experiment',
  LAYER_EXPAND: 'layer_expand',
  // V8.3 第71轮 Sprint 12：重置反馈埋点 — 反复重置的questionId是内容质量强信号（AI小智）
  FEEDBACK_RESET: 'feedback_reset',
  // V8.6 第74轮 Sprint 15：当日明细列表项"再读一遍"跳转埋点 — 北极星漏斗最后1步闭环（COO林实干）
  FEEDBACK_DETAIL_REPLAY: 'feedback_detail_replay',
}

function now() {
  return Date.now()
}

function report(eventName, payload) {
  const data = Object.assign({ event: eventName, ts: now() }, payload || {})
  if (!isWx) {
    if (typeof console !== 'undefined') console.log('[analytics]', data)
    return
  }
  try {
    if (typeof wx.reportEvent === 'function') {
      wx.reportEvent(eventName, data)
    } else if (typeof wx.reportMonitor === 'function') {
      wx.reportMonitor(eventName, 1)
    }
  } catch (_e) { /* swallow */ }
}

function pageView(pagePath) {
  report(EVENT_NAMES.PAGE_VIEW, { path: pagePath })
}

function questionView(id, category) {
  report(EVENT_NAMES.QUESTION_VIEW, { id, category })
}

function questionFavorite(id, action) {
  report(EVENT_NAMES.QUESTION_FAVORITE, { id, action })
}

function search(keyword, hitCount) {
  report(EVENT_NAMES.SEARCH, { keyword: (keyword || '').slice(0, 32), hitCount })
}

function tabSwitch(tab) {
  report(EVENT_NAMES.TAB_SWITCH, { tab })
}

function share(path) {
  report(EVENT_NAMES.SHARE, { path })
}

// V8.2 第71轮 Sprint 11：反馈/CTA/分层展开埋点
// Why: 与 H5 analytics.trackEvent 同名同结构，detail 字段仅含 questionId（内部元数据，无儿童身份）
function feedbackUp(id) {
  report(EVENT_NAMES.FEEDBACK_UP, { id })
}

function feedbackDown(id) {
  report(EVENT_NAMES.FEEDBACK_DOWN, { id })
}

function ctaExperiment(id) {
  report(EVENT_NAMES.CTA_EXPERIMENT, { id })
}

function layerExpand(id) {
  report(EVENT_NAMES.LAYER_EXPAND, { id })
}

// V8.3 第71轮 Sprint 12：重置反馈埋点，识别"反复重置"的questionId作为内容质量强信号
function feedbackReset(id) {
  report(EVENT_NAMES.FEEDBACK_RESET, { id })
}

// V8.6 第74轮 Sprint 15：当日明细列表项"再读一遍"跳转埋点（COO林实干）
// Why: 北极星漏斗最后1步：查看趋势→点开当日→看到具体问题→再读一遍；detail 仅 questionId，无儿童身份（法务张律放行）
function feedbackDetailReplay(id) {
  report(EVENT_NAMES.FEEDBACK_DETAIL_REPLAY, { id })
}

module.exports = {
  EVENT_NAMES,
  report,
  pageView,
  questionView,
  questionFavorite,
  search,
  tabSwitch,
  share,
  feedbackUp,
  feedbackDown,
  ctaExperiment,
  layerExpand,
  feedbackReset,
  feedbackDetailReplay,
}
