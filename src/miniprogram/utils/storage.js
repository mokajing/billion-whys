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
}
