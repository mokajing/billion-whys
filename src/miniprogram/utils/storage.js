/**
 * storage.js - 本地持久化封装（基于 safe-wx）
 *
 * 单一 setter 入口，禁止外部直接覆写，避免缓存与持久化字段不一致
 * (反 BUG-056 类问题：缓存+持久化字段必须通过单一 setter 写入)
 */

const { safeGetStorageSync, safeSetStorageSync, safeRemoveStorageSync } = require('./safe-wx')
const { localDateKey } = require('./constants')

const KEYS = {
  VIEW_HISTORY: 'bw_view_history',
  VIEW_HISTORY_LEGACY: 'billion_whys_history',
  FAVORITES: 'bw_favorites',
  USER_PROFILE: 'bw_user_profile',
  SEARCH_HISTORY: 'bw_search_history',
  ANSWER_FEEDBACK: 'bw_answer_feedback',
  // V8.4 第72轮 Sprint 13：反馈行动流水（与 H5 stores/content.js FEEDBACK_LOG_KEY 同名同结构）
  FEEDBACK_LOG: 'bw_feedback_log',
  // V8.13 第81轮 Sprint 22：当日明细预览/再读本地计数（MP 端 analytics 不落地本地）
  DETAIL_ACTION_COUNT: 'bw_detail_action_count',
  // V8.14 第82轮 Sprint 23：i18n locale 持久化（出海前置）
  // Why: 法务张律放行 — locale 是用户偏好非儿童身份；本轮仅内部切换不向用户暴露
  LOCALE: 'bw_locale',
  // V8.15 第83轮 Sprint 24：事件总线统一治理 — eventLog 单一通道（与 H5 analytics.eventLog 同结构）
  // Why: CTO+后端老稳 — 未来 batch upload 走 eventLog 单一 endpoint；feedback_* 不再双轨存储
  // 法务张律放行：detail 仅 questionId 非儿童身份；meta 字段白名单（depth/layer/source）
  EVENT_LOG: 'bw_event_log',
}

function getViewHistory() {
  let history = safeGetStorageSync(KEYS.VIEW_HISTORY, [])
  if (!Array.isArray(history) || history.length === 0) {
    const old = safeGetStorageSync(KEYS.VIEW_HISTORY_LEGACY, [])
    if (Array.isArray(old) && old.length > 0) {
      history = old.filter(v => v && typeof v.timestamp === 'number' && v.id)
      safeSetStorageSync(KEYS.VIEW_HISTORY, history)
      safeRemoveStorageSync(KEYS.VIEW_HISTORY_LEGACY)
    }
  }
  return Array.isArray(history) ? history : []
}

function setViewHistory(history) {
  const trimmed = Array.isArray(history) ? history : []
  return safeSetStorageSync(KEYS.VIEW_HISTORY, trimmed)
}

function getFavorites() {
  const favs = safeGetStorageSync(KEYS.FAVORITES, [])
  return Array.isArray(favs) ? favs : []
}

function setFavorites(favs) {
  return safeSetStorageSync(KEYS.FAVORITES, Array.isArray(favs) ? favs : [])
}

function toggleFavorite(id) {
  if (!id) return false
  const favs = getFavorites()
  const idx = favs.indexOf(id)
  if (idx === -1) favs.push(id)
  else favs.splice(idx, 1)
  setFavorites(favs)
  return idx === -1
}

function isFavorite(id) {
  return getFavorites().includes(id)
}

function getUserProfile() {
  return safeGetStorageSync(KEYS.USER_PROFILE, null) || {}
}

function setUserProfile(profile) {
  return safeSetStorageSync(KEYS.USER_PROFILE, profile || {})
}

// 搜索历史：纯本地存储，最多 8 条，去重最新前置
// Why: 用户多次搜索时避免重复输入；与 H5 保持一致；零数据收集
const MAX_SEARCH_HISTORY = 8

function getSearchHistory() {
  const arr = safeGetStorageSync(KEYS.SEARCH_HISTORY, [])
  if (!Array.isArray(arr)) return []
  return arr.filter(k => typeof k === 'string' && k.trim())
}

function pushSearchHistory(keyword) {
  const kw = (keyword || '').trim()
  if (!kw) return false
  const cur = getSearchHistory().filter(k => k !== kw)
  cur.unshift(kw)
  const trimmed = cur.slice(0, MAX_SEARCH_HISTORY)
  return safeSetStorageSync(KEYS.SEARCH_HISTORY, trimmed)
}

function clearSearchHistory() {
  return safeSetStorageSync(KEYS.SEARCH_HISTORY, [])
}

// 答案反馈：纯本地存储，{ id, value: 'up'|'down', ts } 数组结构
// Why: 闭合内容质量数据回路；与 H5 stores/content.js 同构；零网络零画像
function getAnswerFeedback() {
  const arr = safeGetStorageSync(KEYS.ANSWER_FEEDBACK, [])
  if (!Array.isArray(arr)) return []
  return arr.filter(x => x && x.id && (x.value === 'up' || x.value === 'down'))
}

function getAnswerFeedbackById(id) {
  if (!id) return null
  const entry = getAnswerFeedback().find(f => f.id === id)
  return entry ? entry.value : null
}

function setAnswerFeedback(id, value, depth) {
  if (!id) return false
  if (value !== 'up' && value !== 'down') return false
  const arr = getAnswerFeedback()
  const idx = arr.findIndex(f => f.id === id)
  let changed = true
  if (idx !== -1) {
    if (arr[idx].value === value) {
      // 幂等：同方向重复点不入流水（测试虫虫要求；与 H5 stores/content.js 一致）
      return true
    }
    arr[idx].value = value
    arr[idx].ts = Date.now()
  } else {
    arr.push({ id, value, ts: Date.now() })
  }
  const ok = safeSetStorageSync(KEYS.ANSWER_FEEDBACK, arr)
  if (ok && changed) appendFeedbackLog(value, id, depth) // V8.5 Sprint 14：携带 id；V8.9 Sprint 18：携带 depth
  return ok
}

function getAnswerFeedbackCount() {
  return getAnswerFeedback().length
}

// V8.3 第71轮 Sprint 12：清除指定 question 的反馈记录（H5 stores/content.js clearAnswerFeedback 同名同结构）
function clearAnswerFeedback(id, depth) {
  if (!id) return false
  const arr = getAnswerFeedback()
  const idx = arr.findIndex(f => f.id === id)
  if (idx === -1) return false
  arr.splice(idx, 1)
  const ok = safeSetStorageSync(KEYS.ANSWER_FEEDBACK, arr)
  if (ok) appendFeedbackLog('reset', id, depth) // V8.4 Sprint 13：reset 入流水；V8.5 Sprint 14：携带 id；V8.9 Sprint 18：携带 depth
  return ok
}

// V8.4 第72轮 Sprint 13：反馈行动流水 append-only log
// Why: bw_answer_feedback 是"当前状态"（reset 物理删除），无法回答"过去7天反馈了N次"
// 与 H5 stores/content.js feedbackLog 同构：{action:'up'|'down'|'reset', ts:number}，cap 200、90 天 prune
// V8.5 第73轮 Sprint 14：扩展为 {action, ts, id?} — id 可选，老数据无 id 时显示"已反馈(记录已迁移)"
// V8.9 第77轮 Sprint 18：扩展为 {action, ts, id?, depth?} — depth=1/2/3 反馈时可见的最深 Layer
const FEEDBACK_LOG_MAX = 200
const FEEDBACK_LOG_RETENTION_DAYS = 90

function getFeedbackLog() {
  const arr = safeGetStorageSync(KEYS.FEEDBACK_LOG, [])
  if (!Array.isArray(arr)) return []
  const cutoff = Date.now() - FEEDBACK_LOG_RETENTION_DAYS * 86400000
  return arr
    .filter(x => x && (x.action === 'up' || x.action === 'down' || x.action === 'reset') && typeof x.ts === 'number' && x.ts >= cutoff)
    .map(x => {
      const e = x.id ? { action: x.action, ts: x.ts, id: x.id } : { action: x.action, ts: x.ts }
      if (x.depth) e.depth = x.depth
      return e
    })
}

// V8.5 Sprint 14：appendFeedbackLog 接受可选 id 参数（与 H5 stores/content.js 同步）
// V8.9 Sprint 18：接受可选 depth 参数（1/2/3）
function appendFeedbackLog(action, id, depth) {
  if (action !== 'up' && action !== 'down' && action !== 'reset') return false
  const arr = getFeedbackLog()
  const entry = { action, ts: Date.now() }
  if (id) entry.id = id
  if (depth) entry.depth = depth
  arr.push(entry)
  return safeSetStorageSync(KEYS.FEEDBACK_LOG, arr.slice(-FEEDBACK_LOG_MAX))
}

// 返回过去 7 天（含今天）的反馈趋势：[{date, up, down, reset, total}]
function getFeedbackTrend7d() {
  const days = []
  const dayMs = 86400000
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayTs = today.getTime()
  for (let i = 6; i >= 0; i--) {
    const start = todayTs - i * dayMs
    days.push({
      date: localDateKey(new Date(start)),
      up: 0, down: 0, reset: 0, total: 0,
      _start: start, _end: start + dayMs,
    })
  }
  const log = getFeedbackLog()
  for (const e of log) {
    for (const d of days) {
      if (e.ts >= d._start && e.ts < d._end) {
        if (e.action === 'up') d.up++
        else if (e.action === 'down') d.down++
        else if (e.action === 'reset') d.reset++
        d.total++
        break
      }
    }
  }
  return days.map(({ date, up, down, reset, total }) => ({ date, up, down, reset, total }))
}

function getFeedbackTrend7dTotal() {
  return getFeedbackTrend7d().reduce((s, d) => s + d.total, 0)
}

// V8.5 第73轮 Sprint 14：按日期返回当日明细（倒序），供 Profile 趋势图点击展开
// 与 H5 stores/content.js feedbackDetailByDate 同构（同款本地午夜分桶，保证 label 对称）
// 返回 [{action, ts, id?, title?, depth?}]，title 来自 questionMap（无 id 老数据 title 为 null）
// V8.9 Sprint 18：携带 depth（1/2/3，老数据无 depth 当 1）
function getFeedbackDetailByDate(dateStr, questionMapArg) {
  if (!dateStr) return []
  const dayMs = 86400000
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayTs = today.getTime()
  const qMap = questionMapArg instanceof Map ? questionMapArg : new Map()
  for (let i = 6; i >= 0; i--) {
    const start = todayTs - i * dayMs
    const label = localDateKey(new Date(start))
    if (label !== dateStr) continue
    const end = start + dayMs
    return getFeedbackLog()
      .filter(e => e.ts >= start && e.ts < end)
      .map(e => ({
        action: e.action,
        ts: e.ts,
        id: e.id || null,
        title: e.id && qMap.has(e.id) ? (qMap.get(e.id).question || null) : null,
        depth: e.depth || 1,
      }))
      .sort((a, b) => b.ts - a.ts)
  }
  return []
}

// V8.9 第77轮 Sprint 18：按日期返回当日反馈深度分布（与 H5 stores/content.js feedbackDepthByDate 同构）
// Why: COO 北极星反馈率分层热力图基础；depth=3+👍/👎 是内容质量强信号
// 返回 {L1, L2, L3, total}，老 entry 无 depth 归入 L1
function getFeedbackDepthByDate(dateStr) {
  if (!dateStr) return { L1: 0, L2: 0, L3: 0, total: 0 }
  const dayMs = 86400000
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayTs = today.getTime()
  for (let i = 6; i >= 0; i--) {
    const start = todayTs - i * dayMs
    const label = localDateKey(new Date(start))
    if (label !== dateStr) continue
    const end = start + dayMs
    const result = { L1: 0, L2: 0, L3: 0, total: 0 }
    for (const e of getFeedbackLog()) {
      if (e.ts < start || e.ts >= end) continue
      const d = e.depth || 1
      if (d === 2) result.L2++
      else if (d === 3) result.L3++
      else result.L1++
      result.total++
    }
    return result
  }
  return { L1: 0, L2: 0, L3: 0, total: 0 }
}

// V8.13 第81轮 Sprint 22：累计参与度汇总 — 与 H5 stores/content.js feedbackSummary getter 同构
// Why: CEO 周远见 — 8 阶漏斗已建但 Profile 第一屏无累计值；毒舌老王：把累计抬到第一屏
// 法务张律放行：纯本地 feedbackLog 计数非儿童身份；隐私政策条款 5"反馈行动次数"已涵盖
function getFeedbackSummary() {
  const log = getFeedbackLog()
  let up = 0, down = 0, reset = 0, depthL2 = 0, depthL3 = 0, sevenDayTotal = 0
  const dayMs = 86400000
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayTs = today.getTime()
  const sevenStart = todayTs - 6 * dayMs
  for (const e of log) {
    if (e.action === 'up') up++
    else if (e.action === 'down') down++
    else if (e.action === 'reset') reset++
    const d = e.depth || 1
    if (d === 2) depthL2++
    else if (d === 3) depthL3++
    if (e.ts >= sevenStart && e.ts < todayTs + dayMs) sevenDayTotal++
  }
  return { total: log.length, up, down, reset, depthL2, depthL3, sevenDayTotal }
}

// V8.13 第81轮 Sprint 22：MP 端本地预览/再读计数 — H5 端从 analytics events 聚合
// Why: MP analytics.js 走 wx.reportEvent 不落地本地，需独立计数器；法务张律放行：纯本地行为计数非儿童身份
function getDetailActionCount(type) {
  if (type !== 'preview' && type !== 'replay') return 0
  const raw = safeGetStorageSync(KEYS.DETAIL_ACTION_COUNT, null)
  if (!raw) return 0
  const obj = typeof raw === 'string' ? JSON.parse(raw) : raw
  return Number(obj[type]) || 0
}

function incrementDetailActionCount(type) {
  if (type !== 'preview' && type !== 'replay') return
  const next = {
    preview: getDetailActionCount('preview'),
    replay: getDetailActionCount('replay'),
  }
  next[type] = next[type] + 1
  safeSetStorageSync(KEYS.DETAIL_ACTION_COUNT, next)
}

// V8.14 第82轮 Sprint 23：locale 持久化（i18n 出海前置）
// V8.21 第89轮 Sprint 30：locale 子标签持久化（en-GB/en-US/en-AU 等 BCP-47 subtag 原样存储，与 H5 同构）
// Why: 法务张律放行 — locale 是用户偏好非儿童身份；subtag 不引入新身份字段；本轮仅内部切换不向用户暴露
// CEO 裁决：getLocale 保留 subtag（'en-GB' 而非归一 'en'），subtag 信息一旦丢失难恢复；t() 内部各自 normalize
const SUPPORTED_BASES = ['zh', 'en']

function normalizeLocale(locale) {
  if (!locale || typeof locale !== 'string') return 'zh'
  const base = locale.toLowerCase().split('-')[0]
  return SUPPORTED_BASES.indexOf(base) >= 0 ? base : 'zh'
}

function getLocale() {
  const v = safeGetStorageSync(KEYS.LOCALE, 'zh')
  if (!v) return 'zh'
  const base = normalizeLocale(v)
  return base === 'zh' ? 'zh' : v
}

function setLocale(locale) {
  const base = normalizeLocale(locale)
  if (base === 'zh') {
    return safeSetStorageSync(KEYS.LOCALE, 'zh')
  }
  return safeSetStorageSync(KEYS.LOCALE, locale)
}

// V8.15 第83轮 Sprint 24：事件总线单一入口（MP 端 — 与 H5 analytics.emitEvent 同构）
// Why: CTO 陈架构 — feedback_* 系列此前走 wx.reportEvent 不落地本地，无法做 batch upload；
//   后端老稳：eventLog 落地后未来可单次 flush 全量同步；安全李姐：纯本地 storage 不触发网络
// 法务张律放行：detail 仅 questionId（category-NNN 格式）非儿童身份；meta 白名单防身份泄漏
// 测试虫虫：cap 200、90 天 prune，与 H5 同规格
const EVENT_LOG_MAX = 200
const EVENT_LOG_RETENTION_DAYS = 90

function getEventLog() {
  const arr = safeGetStorageSync(KEYS.EVENT_LOG, [])
  if (!Array.isArray(arr)) return []
  const cutoff = Date.now() - EVENT_LOG_RETENTION_DAYS * 86400000
  return arr
    .filter(x => x && typeof x.name === 'string' && typeof x.ts === 'number' && x.ts >= cutoff)
    .slice(-EVENT_LOG_MAX)
}

function emitEvent(name, detail, meta) {
  if (!name || typeof name !== 'string') return
  const log = getEventLog()
  const entry = { name, detail: String(detail || ''), ts: Date.now() }
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    const safe = {}
    for (const k of Object.keys(meta)) {
      if (['depth', 'layer', 'source'].includes(k)) safe[k] = meta[k]
    }
    if (Object.keys(safe).length > 0) entry.meta = safe
  }
  log.push(entry)
  safeSetStorageSync(KEYS.EVENT_LOG, log.slice(-EVENT_LOG_MAX))
}

// V8.15 Sprint 24：跨源事件计数 — 同时扫描 eventLog 与 detail_action_count（向后兼容）
// Why: 测试虫虫 — sprint22 老测试可能仍依赖 detail_action_count；双源聚合不破坏 API
function countEvent(name) {
  if (!name) return 0
  let n = 0
  const log = getEventLog()
  for (const ev of log) {
    if (ev && ev.name === name) n++
  }
  // 兼容旧路径：feedback_detail_preview/replay 仍可能在 detail_action_count 中
  if (name === 'feedback_detail_preview') n += getDetailActionCount('preview')
  if (name === 'feedback_detail_replay') n += getDetailActionCount('replay')
  return n
}

// V8.15 Sprint 24：flushAll 只读 hook — 供未来 batch upload 单次 flush（不触发网络）
// Why: 后端老稳 — 单一 endpoint 单一 schema；CTO：本轮只读，下一轮再设计上传
function flushAll() {
  return {
    feedbackLog: getFeedbackLog(),
    eventLog: getEventLog(),
    detailActionCount: safeGetStorageSync(KEYS.DETAIL_ACTION_COUNT, null) || null,
  }
}

// V8.16 第84轮 Sprint 25：照护者自我效能 A/B 框架（MP 端 — 与 H5 stores/ab.js 同构）
// Why: COO+CCO — V8.15 事件总线闭合后，北极星漏斗第11阶"妈妈自我效能"解锁
// CTO 陈架构：MVP 纯 Math.random coin-flip，不接后端、不读身份字段
// 法务张律红线：分桶算法禁止读取任何 device/account/locale 字段；bucket 是实验分配元数据非儿童身份
// 心理学家周教授红线：B 变体必须肯定行为而非施压后果（否决 guilt-trip 文案）
// 社会学刘教授：文案用"你"包容隔代抚养/单亲/双亲，不预设核心家庭叙事
// 测试虫虫：emitABExpose 必须幂等（同 experiment 只发一次），防 onShow 重渲染刷数
// 后端老稳：ab_* 走 V8.15 eventLog 单一通道，detail=experiment:variant:goal，meta 留空
//   事件总线 API 冻结，本轮不动 meta allowlist（sprint24 测试不破）
const AB_KEY = 'bw_ab_assignments'
const AB_EXPERIMENTS = {
  caregiver_affirmation_v1: {
    variants: ['A', 'B'],
    // CCO 文若水终稿 27 字；心理学家周教授放行（肯定型非施压）；社会学刘教授放行（主语"你"包容）
    // P2-5 整改：原 "你回答得真好——你的孩子会记住这一刻的" 对家长施压感边界模糊，
    // 改为更中性、肯定陪伴的表述，避免 guilt-trip 风险
    copy: {
      A: '',
      B: '你陪伴得真好——这一刻很珍贵。',
    },
  },
}

// 内存级幂等曝光标记（同 experiment 只发一次 ab_expose）
const _abExposed = {}

function getABAssignments() {
  const obj = safeGetStorageSync(AB_KEY, {})
  return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {}
}

function setABAssignments(obj) {
  return safeSetStorageSync(AB_KEY, obj || {})
}

// 返回该 experiment 当前桶；不存在则 coin-flip 持久化
// Why: 法务张律红线 — 纯 Math.random，不读取任何身份字段做分层
function getABVariant(experimentKey) {
  const config = AB_EXPERIMENTS[experimentKey]
  if (!config) return 'A'
  const assignments = getABAssignments()
  const existing = assignments[experimentKey]
  if (existing && config.variants.includes(existing)) return existing
  const idx = Math.random() < 0.5 ? 0 : 1
  const picked = config.variants[idx] || config.variants[0]
  assignments[experimentKey] = picked
  setABAssignments(assignments)
  return picked
}

function getABCopy(experimentKey) {
  const config = AB_EXPERIMENTS[experimentKey]
  if (!config) return ''
  const variant = getABAssignments()[experimentKey]
  if (!variant || !config.variants.includes(variant)) return ''
  return config.copy[variant] || ''
}

// 幂等曝光埋点：同 experiment 只发一次 ab_expose
// Why: 测试虫虫 — onShow 在 tab 切换时可能重复触发
function emitABExpose(experimentKey, variant) {
  if (!experimentKey || !variant) return
  if (_abExposed[experimentKey]) return
  _abExposed[experimentKey] = true
  emitEvent('ab_expose', `${experimentKey}:${variant}`)
}

// 目标转化埋点：调用点判断目标已达成（如 feedbackUp）即触发
function emitABConvert(experimentKey, variant, goalName) {
  if (!experimentKey || !variant) return
  emitEvent('ab_convert', `${experimentKey}:${variant}:${goalName || 'default'}`)
}

// 测试辅助：重置内存 exposed 标记（仅单测调用）
function _resetABExposed() {
  for (const k of Object.keys(_abExposed)) delete _abExposed[k]
}

module.exports = {
  KEYS,
  getViewHistory,
  setViewHistory,
  getFavorites,
  setFavorites,
  toggleFavorite,
  isFavorite,
  getUserProfile,
  setUserProfile,
  getSearchHistory,
  pushSearchHistory,
  clearSearchHistory,
  getAnswerFeedback,
  getAnswerFeedbackById,
  setAnswerFeedback,
  getAnswerFeedbackCount,
  clearAnswerFeedback,
  getFeedbackLog,
  appendFeedbackLog,
  getFeedbackTrend7d,
  getFeedbackTrend7dTotal,
  getFeedbackDetailByDate,
  getFeedbackDepthByDate,
  getFeedbackSummary,
  getDetailActionCount,
  incrementDetailActionCount,
  getLocale,
  setLocale,
  // V8.15 第83轮 Sprint 24：事件总线统一治理
  getEventLog,
  emitEvent,
  countEvent,
  flushAll,
  // V8.16 第84轮 Sprint 25：A/B 框架
  AB_EXPERIMENTS,
  getABVariant,
  getABCopy,
  emitABExpose,
  emitABConvert,
  _resetABExposed,
}
