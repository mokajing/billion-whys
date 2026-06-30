/**
 * analytics.js - 归因/埋点上报
 *
 * 反 BUG-054 类问题：归因埋点必须在用户行为发生时即刻上报，不依赖后续动作
 * 反 BUG-057 类问题：反作弊不信客户端时间戳，但本端只用本地时间做事件流水
 */

const { isWx } = require('./safe-wx')
// V8.15 第83轮 Sprint 24：事件总线统一治理 — 同时落地 eventLog（供未来 batch upload）
// Why: CTO+后端老稳 — wx.reportEvent 只上报不落地，无法做单次 flush；eventLog 补齐本地通道
const storage = require('./storage')

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
  // V8.12 第80轮 Sprint 21：当日明细列表项长按预览埋点（COO林实干）
  // Why: 量化"快速扫描"行为，与 feedback_detail_replay 形成"预览-再读"漏斗；detail 仅 questionId 非儿童身份
  FEEDBACK_DETAIL_PREVIEW: 'feedback_detail_preview',
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

// V8.15 第83轮 Sprint 24：feedback_* 系列双写 — wx.reportEvent + 本地 eventLog
// Why: CTO 陈架构 — 保留 wx 侧实时上报（已上线不破坏），同时落地 eventLog 供未来 batch upload
// 法务张律放行：detail 仅 questionId 非儿童身份；meta 字段白名单（depth/layer/source）
function reportFeedbackEvent(eventName, id, meta) {
  report(eventName, { id })
  // 落地 eventLog（detail=questionId，meta 透传 depth 等）
  if (typeof storage !== 'undefined' && storage && typeof storage.emitEvent === 'function') {
    storage.emitEvent(eventName, id, meta)
  }
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
// V8.15 第83轮 Sprint 24：feedback_* 改走 reportFeedbackEvent 双写 eventLog（CTO+后端老稳）
function feedbackUp(id, depth) {
  reportFeedbackEvent(EVENT_NAMES.FEEDBACK_UP, id, depth != null ? { depth } : undefined)
}

function feedbackDown(id, depth) {
  reportFeedbackEvent(EVENT_NAMES.FEEDBACK_DOWN, id, depth != null ? { depth } : undefined)
}

function ctaExperiment(id) {
  report(EVENT_NAMES.CTA_EXPERIMENT, { id })
}

function layerExpand(id) {
  report(EVENT_NAMES.LAYER_EXPAND, { id })
}

// V8.3 第71轮 Sprint 12：重置反馈埋点，识别"反复重置"的questionId作为内容质量强信号
function feedbackReset(id, depth) {
  reportFeedbackEvent(EVENT_NAMES.FEEDBACK_RESET, id, depth != null ? { depth } : undefined)
}

// V8.6 第74轮 Sprint 15：当日明细列表项"再读一遍"跳转埋点（COO林实干）
// Why: 北极星漏斗最后1步：查看趋势→点开当日→看到具体问题→再读一遍；detail 仅 questionId，无儿童身份（法务张律放行）
// V8.15 Sprint 24：双写 eventLog（同 feedbackUp/Down/Reset）
function feedbackDetailReplay(id) {
  reportFeedbackEvent(EVENT_NAMES.FEEDBACK_DETAIL_REPLAY, id)
}

// V8.12 第80轮 Sprint 21：当日明细列表项长按预览埋点（COO林实干）
// Why: 量化"快速扫描"行为，与 feedback_detail_replay 形成"预览-再读"漏斗；detail 仅 questionId 非儿童身份
function feedbackDetailPreview(id) {
  reportFeedbackEvent(EVENT_NAMES.FEEDBACK_DETAIL_PREVIEW, id)
}

// V8.16 第84轮 Sprint 25：A/B 转化埋点薄封装 — feedback_up 即 ab_convert goal=feedback_up
// Why: COO — 量化 affirmation 文案对反馈率提升（B 桶假设 ≥10%）
// 后端老稳：走 storage.emitEvent eventLog 单一通道，detail=experiment:variant:goal，meta 留空
function abConvert(experimentKey, variant, goalName) {
  if (typeof storage !== 'undefined' && storage && typeof storage.emitABConvert === 'function') {
    storage.emitABConvert(experimentKey, variant, goalName)
  }
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
  feedbackDetailPreview,
  // V8.16 第84轮 Sprint 25
  abConvert,
}
