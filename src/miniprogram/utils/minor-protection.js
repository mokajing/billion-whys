/**
 * minor-protection.js - 未成年人保护核心模块
 *
 * 实现：
 *  - 家长验证（6 题题库随机抽 3 题）
 *  - 单次会话时间限制 15 分钟
 *  - 每日累计使用时间限制 30 分钟
 *  - 22:00-6:00 不可用时段
 *  - 时间记录使用 wx.setStorageSync / getStorageSync
 *
 * 设计原则（参考 docs/minor-protection.md 与 wx-minigame-audit-team 专家团方法论）：
 *  - 反作弊不信客户端：本地时间仅用于本地展示与拦截，不做计费
 *  - 守卫层：所有 wx.* 调用走 safe-wx.js
 *  - 不记录任何未成年人个人标识，只记录使用时长统计
 *
 * 导出函数：
 *  - verifyParent(): 校验当前是否已通过家长验证
 *  - checkTimeLimit(): 检查会话/日累计是否超时，返回状态
 *  - recordUsage(deltaMs): 记录使用时长（毫秒）
 *  - isDisabled(): 检查 22:00-6:00 不可用时段
 *  - getRemainingTime(): 获取今日剩余可用时间（分钟）
 *  - getQuestionPool(): 获取家长验证题库
 *  - markParentVerified(): 标记家长验证通过
 *  - getUsageStats(): 获取家长控制面板统计
 */

const { safeGetStorageSync, safeSetStorageSync } = require('./safe-wx')

const SESSION_LIMIT_MS = 15 * 60 * 1000   // 单次会话 15 分钟
const DAILY_LIMIT_MS = 30 * 60 * 1000     // 每日 30 分钟
const STORAGE_KEYS = {
  parentVerified: 'parent_verified',
  sessionStart: 'mp_session_start',
  sessionAccumMs: 'mp_session_accum_ms',   // 本次会话累计毫秒
  dailyAccumMs: 'mp_daily_accum_ms',       // 今日累计毫秒
  dailyDate: 'mp_daily_date',              // 今日日期字符串 YYYY-MM-DD
}

// 6 道家长身份验证题（题库静态嵌入，不联网）
// Why: docs/minor-protection.md §1.1.1 要求 6 题题库随机抽 3 题
const QUESTION_POOL = [
  {
    id: 'q1',
    question: '一个标准西瓜大约多重？',
    options: ['3kg', '30kg', '300kg'],
    answer: 0,
  },
  {
    id: 'q2',
    question: '下列哪个是成语？',
    options: ['鸡飞狗跳', '鸡飞猫跳', '鸡飞鸟跳'],
    answer: 0,
  },
  {
    id: 'q3',
    question: '现行《未成年人保护法》施行年份？',
    options: ['2006', '2015', '2021'],
    answer: 2,
  },
  {
    id: 'q4',
    question: '一周几天上学（义务教育阶段）？',
    options: ['4', '5', '6'],
    answer: 1,
  },
  {
    id: 'q5',
    question: '下列哪个不是城市名？',
    options: ['拉萨', '库尔勒', '鸭绿江'],
    answer: 2,
  },
  {
    id: 'q6',
    question: '孩子发烧多少度算高烧需就医？',
    options: ['38.5℃', '39.5℃', '40.5℃'],
    answer: 0,
  },
]

function todayStr() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * 检查是否处于 22:00-6:00 不可用时段
 * @returns {{disabled: boolean, message: string}}
 */
function isDisabled() {
  const h = new Date().getHours()
  if (h >= 22 || h < 6) {
    return {
      disabled: true,
      message: '现在是夜间休息时间（22:00-6:00），为了孩子的健康，本小程序暂不可用，请明天再来探索吧～',
    }
  }
  return { disabled: false, message: '' }
}

/**
 * 校验家长是否已通过验证
 * @returns {boolean}
 */
function verifyParent() {
  const v = safeGetStorageSync(STORAGE_KEYS.parentVerified, null)
  if (!v) return false
  // 验证信息含通过时间戳，30 天后需重新验证
  if (typeof v === 'object' && v.verified && v.timestamp) {
    const ageDays = (Date.now() - v.timestamp) / (24 * 60 * 60 * 1000)
    if (ageDays > 30) return false
    return true
  }
  return false
}

/**
 * 标记家长验证通过
 */
function markParentVerified() {
  safeSetStorageSync(STORAGE_KEYS.parentVerified, {
    verified: true,
    timestamp: Date.now(),
  })
}

/**
 * 获取家长验证题库（随机抽 3 题，乱序）
 * @returns {Array} 3 道题
 */
function getQuestionPool() {
  const shuffled = QUESTION_POOL.slice().sort(() => Math.random() - 0.5)
  return shuffled.slice(0, 3)
}

/**
 * 检查时间限制
 * @returns {{allowed: boolean, reason: string, sessionRemainingMs: number, dailyRemainingMs: number}}
 */
function checkTimeLimit() {
  const now = Date.now()
  // 夜间不可用
  const dis = isDisabled()
  if (dis.disabled) {
    return { allowed: false, reason: 'night', message: dis.message, sessionRemainingMs: 0, dailyRemainingMs: 0 }
  }

  // 初始化/翻日：确保 dailyAccum 属于今日
  let dailyDate = safeGetStorageSync(STORAGE_KEYS.dailyDate, '')
  let dailyAccum = safeGetStorageSync(STORAGE_KEYS.dailyAccumMs, 0)
  if (dailyDate !== todayStr()) {
    dailyDate = todayStr()
    dailyAccum = 0
    safeSetStorageSync(STORAGE_KEYS.dailyDate, dailyDate)
    safeSetStorageSync(STORAGE_KEYS.dailyAccumMs, 0)
  }

  // 会话累计
  let sessionStart = safeGetStorageSync(STORAGE_KEYS.sessionStart, 0)
  let sessionAccum = safeGetStorageSync(STORAGE_KEYS.sessionAccumMs, 0)
  if (!sessionStart) {
    sessionStart = now
    sessionAccum = 0
    safeSetStorageSync(STORAGE_KEYS.sessionStart, sessionStart)
    safeSetStorageSync(STORAGE_KEYS.sessionAccumMs, 0)
  }

  // 计算实时累计（自上次 sessionStart 至今）
  const liveSessionMs = sessionAccum + (now - sessionStart)
  const sessionRemainingMs = Math.max(0, SESSION_LIMIT_MS - liveSessionMs)
  const dailyRemainingMs = Math.max(0, DAILY_LIMIT_MS - dailyAccum)

  if (dailyRemainingMs <= 0) {
    return {
      allowed: false,
      reason: 'daily_exceeded',
      message: '今日累计使用已达 30 分钟上限，为了孩子的视力与健康，请明天再来～',
      sessionRemainingMs,
      dailyRemainingMs: 0,
    }
  }
  if (sessionRemainingMs <= 0) {
    return {
      allowed: false,
      reason: 'session_exceeded',
      message: '本次会话已达 15 分钟上限，请休息一会儿再继续～',
      sessionRemainingMs: 0,
      dailyRemainingMs,
    }
  }
  return {
    allowed: true,
    reason: 'ok',
    message: '',
    sessionRemainingMs,
    dailyRemainingMs,
  }
}

/**
 * 记录使用时长（毫秒）
 * 在 onShow / onHide / onLaunch 调用，把上次 sessionStart 至今的时间累计到 session 与 daily
 * @param {number} deltaMs 自上次 sessionStart 至今的毫秒数（可选，不传则计算）
 */
function recordUsage(deltaMs) {
  const now = Date.now()
  let sessionStart = safeGetStorageSync(STORAGE_KEYS.sessionStart, 0)
  if (!sessionStart) {
    sessionStart = now
    safeSetStorageSync(STORAGE_KEYS.sessionStart, sessionStart)
    return
  }
  const delta = (typeof deltaMs === 'number') ? deltaMs : (now - sessionStart)
  if (delta <= 0) return

  // 会话累计
  let sessionAccum = safeGetStorageSync(STORAGE_KEYS.sessionAccumMs, 0)
  sessionAccum += delta
  safeSetStorageSync(STORAGE_KEYS.sessionAccumMs, sessionAccum)

  // 日累计（翻日重置）
  let dailyDate = safeGetStorageSync(STORAGE_KEYS.dailyDate, '')
  let dailyAccum = safeGetStorageSync(STORAGE_KEYS.dailyAccumMs, 0)
  if (dailyDate !== todayStr()) {
    dailyDate = todayStr()
    dailyAccum = 0
  }
  dailyAccum += delta
  safeSetStorageSync(STORAGE_KEYS.dailyDate, dailyDate)
  safeSetStorageSync(STORAGE_KEYS.dailyAccumMs, dailyAccum)

  // 重置 sessionStart 为当前时间，等待下一段计时
  safeSetStorageSync(STORAGE_KEYS.sessionStart, now)
}

/**
 * 获取今日剩余可用时间（分钟，整数）
 */
function getRemainingTime() {
  const t = checkTimeLimit()
  if (!t.allowed) return 0
  return Math.floor(t.dailyRemainingMs / 60000)
}

/**
 * 获取家长控制面板统计
 * @returns {{dailyUsedMs, dailyLimitMs, dailyRemainingMin, sessionUsedMs, sessionLimitMs, parentVerified, lastVerifiedAt}}
 */
function getUsageStats() {
  // 翻日检查
  let dailyDate = safeGetStorageSync(STORAGE_KEYS.dailyDate, '')
  let dailyAccum = safeGetStorageSync(STORAGE_KEYS.dailyAccumMs, 0)
  if (dailyDate !== todayStr()) {
    dailyDate = todayStr()
    dailyAccum = 0
    safeSetStorageSync(STORAGE_KEYS.dailyDate, dailyDate)
    safeSetStorageSync(STORAGE_KEYS.dailyAccumMs, 0)
  }
  let sessionStart = safeGetStorageSync(STORAGE_KEYS.sessionStart, 0)
  let sessionAccum = safeGetStorageSync(STORAGE_KEYS.sessionAccumMs, 0)
  let sessionUsedMs = sessionAccum
  if (sessionStart) {
    sessionUsedMs = sessionAccum + (Date.now() - sessionStart)
  }
  const dailyRemainingMs = Math.max(0, DAILY_LIMIT_MS - dailyAccum)
  const v = safeGetStorageSync(STORAGE_KEYS.parentVerified, null)
  return {
    dailyUsedMs: dailyAccum,
    dailyLimitMs: DAILY_LIMIT_MS,
    dailyUsedMin: Math.floor(dailyAccum / 60000),
    dailyRemainingMin: Math.floor(dailyRemainingMs / 60000),
    sessionUsedMs,
    sessionLimitMs: SESSION_LIMIT_MS,
    sessionUsedMin: Math.floor(sessionUsedMs / 60000),
    parentVerified: verifyParent(),
    lastVerifiedAt: (v && v.timestamp) || 0,
  }
}

/**
 * 重置本次会话计时（用于切后台超过阈值后重新计时）
 */
function resetSession() {
  safeSetStorageSync(STORAGE_KEYS.sessionStart, Date.now())
  safeSetStorageSync(STORAGE_KEYS.sessionAccumMs, 0)
}

module.exports = {
  verifyParent,
  markParentVerified,
  getQuestionPool,
  checkTimeLimit,
  recordUsage,
  isDisabled,
  getRemainingTime,
  getUsageStats,
  resetSession,
  QUESTION_POOL,
  SESSION_LIMIT_MS,
  DAILY_LIMIT_MS,
}
