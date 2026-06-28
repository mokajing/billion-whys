const questions = require('../data/questions.json')
const storage = require('./storage')
const { safeToast, safeNavigateTo, safePageScrollTo } = require('./safe-wx')
const analytics = require('./analytics')

const questionMap = new Map()
for (const q of questions) questionMap.set(q.id, q)

function toWebP(path) {
  if (!path) return ''
  const p = path.startsWith('/') ? path : `/${path}`
  if (/\.webp$/i.test(p)) return p
  return p.replace(/\.(png|jpe?g)$/i, '.webp')
}

// 搜索同义词归一：与 H5 utils/constants.js 保持一致
// Why: 5岁以上孩子常问"为啥/为什麽"，搜索必须命中标准库的"为什么"
const SYNONYM_MAP = [
  { pattern: /为啥|为什麽|为什吗|为什麼/g, repl: '为什么' },
  { pattern: /怎麽办|怎么办|怎么着/g, repl: '怎么样' },
  { pattern: /甚麼|什麽/g, repl: '什么' },
  { pattern: /[吗呢嘛么]$/g, repl: '' },
]

function normalizeKeyword(keyword) {
  if (!keyword) return ''
  let kw = keyword.trim().toLowerCase()
  for (const { pattern, repl } of SYNONYM_MAP) {
    kw = kw.replace(pattern, repl)
  }
  return kw.trim()
}

// 今日好奇推荐：基于日期的确定性选择（零画像、零随机）
// 与 H5 utils/constants.js dailyPickQuestion 保持一致：date 可注入以便测试 DST/边界
function dailyPick(date) {
  if (!Array.isArray(questions) || questions.length === 0) return null
  const d = date instanceof Date ? date : new Date()
  const dayKey = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
  return questions[dayKey % questions.length]
}

function getAll() {
  return questions
}

function getByCategory(cat) {
  if (!cat || cat === 'all') return questions
  return questions.filter(q => q.category === cat)
}

function getById(id) {
  return questionMap.get(id) || null
}

function search(keyword) {
  if (!keyword || !keyword.trim()) return []
  const kw = normalizeKeyword(keyword)
  if (!kw) return []
  if (kw.length === 1) {
    return questions.filter(q => {
      const haystack = (q.question + ' ' + (q.tags || []).join(' ')).toLowerCase()
      return haystack.includes(kw)
    })
  }
  const bigrams = []
  for (let i = 0; i < kw.length; i++) {
    bigrams.push(kw[i])
    if (i < kw.length - 1) bigrams.push(kw.substring(i, i + 2))
  }
  return questions
    .map(q => {
      const haystack = (q.question + ' ' + (q.tags || []).join(' ')).toLowerCase()
      if (haystack.includes(kw)) return { q, score: 100 }
      const hits = bigrams.filter(bg => haystack.includes(bg)).length
      const score = Math.round((hits / bigrams.length) * 80)
      return score >= 30 ? { q, score } : null
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .map(r => r.q)
}

function hotQuestions() {
  const cats = ['body', 'home', 'food', 'nature', 'animals', 'society']
  const picks = []
  for (const c of cats) {
    const catQs = questions.filter(q => q.category === c)
    for (let i = catQs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [catQs[i], catQs[j]] = [catQs[j], catQs[i]]
    }
    if (catQs.length > 0) picks.push(catQs[0])
  }
  return picks.slice(0, 6)
}

function suggestRelated(keyword) {
  if (!keyword || !keyword.trim()) return []
  const kw = normalizeKeyword(keyword)
  if (!kw) return []
  const chars = kw.split('')
  if (chars.length < 2) return []
  return questions
    .map(q => {
      const haystack = (q.question + ' ' + (q.tags || []).join(' ')).toLowerCase()
      const hits = chars.filter(c => haystack.includes(c)).length
      const rate = hits / chars.length
      return rate >= 0.4 ? { q, score: hits } : null
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(r => r.q)
}

function getViewHistory() {
  return storage.getViewHistory()
}

function calcStreak(history) {
  if (!history || history.length === 0) return 0
  const toNoon = d => { const n = new Date(d); n.setHours(12, 0, 0, 0); return n }
  const seen = {}
  const days = []
  for (const v of history) {
    const key = new Date(v.timestamp).toDateString()
    if (!seen[key]) { seen[key] = true; days.push(new Date(key)) }
  }
  days.sort((a, b) => new Date(b) - new Date(a))
  let streak = 1
  for (let i = 0; i < days.length - 1; i++) {
    const diffDays = Math.round((toNoon(days[i]) - toNoon(days[i + 1])) / 86400000)
    if (diffDays === 1) streak++
    else break
  }
  const today = toNoon(new Date())
  const lastDay = toNoon(days[0])
  if (Math.round((today - lastDay) / 86400000) > 1) return 0
  return streak
}

function markViewed(id, category) {
  try {
    let history = getViewHistory()
    if (history.length > 0 && history[history.length - 1].id === id) return
    history.push({ id, timestamp: Date.now(), category })
    if (history.length > 500) history.splice(0, history.length - 500)
    storage.setViewHistory(history)
    analytics.questionView(id, category)
  } catch (_e) { /* storage unavailable */ }
}

function parseIpScene(text) {
  if (!text) return []
  const parts = text.split(/((?:答答熊|问问兔)[：:])/).filter(Boolean)
  if (parts.length <= 1) return [{ role: 'rabbit', text: text }]
  const dialogues = []
  let current = ''
  const startsWithBear = /^答答熊[：:]$/.test(parts[0])
  let role = startsWithBear ? 'bear' : 'rabbit'
  for (const part of parts) {
    if (/^答答熊[：:]$/.test(part)) {
      if (current.trim()) dialogues.push({ role: role, text: current.trim() })
      role = 'bear'
      current = ''
    } else if (/^问问兔[：:]$/.test(part)) {
      if (current.trim()) dialogues.push({ role: role, text: current.trim() })
      role = 'rabbit'
      current = ''
    } else {
      current += part
    }
  }
  if (current.trim()) dialogues.push({ role: role, text: current.trim() })
  return dialogues
}

function safeNavigateToRoute(url) {
  safeNavigateTo(url)
}

function getFavorites() {
  return storage.getFavorites()
}

function isFavorite(id) {
  return storage.isFavorite(id)
}

function toggleFavorite(id) {
  const added = storage.toggleFavorite(id)
  analytics.questionFavorite(id, added ? 'add' : 'remove')
  return added
}

function getAnswerFeedback(id) {
  return storage.getAnswerFeedbackById(id)
}

function setAnswerFeedback(id, value, depth) {
  return storage.setAnswerFeedback(id, value, depth)
}

function getAnswerFeedbackCount() {
  return storage.getAnswerFeedbackCount()
}

// V8.3 第71轮 Sprint 12：清除指定 question 的反馈记录，让妈妈能"再评一次"
// Why: 误点后悔药 + 反馈率北极星提升（COO+CEO裁决）；后端老稳预留：未来上云改软删除
function clearAnswerFeedback(id, depth) {
  return storage.clearAnswerFeedback(id, depth)
}

// V8.4 第72轮 Sprint 13：过去 7 天反馈趋势（H5 stores/content.js feedbackTrend7d 同构）
// Why: COO 北极星反馈率 ≥5% 需"看得见"；心理学家周教授：重置用灰色不红色化
function getFeedbackTrend7d() {
  return storage.getFeedbackTrend7d()
}

function getFeedbackTrend7dTotal() {
  return storage.getFeedbackTrend7dTotal()
}

// V8.5 第73轮 Sprint 14：按日期返回当日明细（H5 stores/content.js feedbackDetailByDate 同构）
// Why: Profile 趋势图点击展开每日明细；妈妈想"那天我到底反馈了啥"
function getFeedbackDetailByDate(dateStr) {
  return storage.getFeedbackDetailByDate(dateStr, questionMap)
}

// V8.9 第77轮 Sprint 18：按日期返回当日反馈深度分布（H5 feedbackDepthByDate 同构）
function getFeedbackDepthByDate(dateStr) {
  return storage.getFeedbackDepthByDate(dateStr)
}

function notifyLoadError() {
  safeToast({ title: '内容加载失败', icon: 'none' })
}

function scrollTop() {
  safePageScrollTo(0)
}

module.exports = {
  getAll,
  getByCategory,
  getById,
  search,
  hotQuestions,
  dailyPick,
  normalizeKeyword,
  suggestRelated,
  toWebP,
  getViewHistory,
  calcStreak,
  markViewed,
  parseIpScene,
  safeNavigateTo: safeNavigateToRoute,
  getFavorites,
  isFavorite,
  toggleFavorite,
  getAnswerFeedback,
  setAnswerFeedback,
  getAnswerFeedbackCount,
  clearAnswerFeedback,
  getFeedbackTrend7d,
  getFeedbackTrend7dTotal,
  getFeedbackDetailByDate,
  getFeedbackDepthByDate,
  notifyLoadError,
  scrollTop,
}
