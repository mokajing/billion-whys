const questions = require('../data/questions.json')
const storage = require('./storage')
const { safeToast, safeNavigateTo, safePageScrollTo, safeLoadSubpackage } = require('./safe-wx')
const analytics = require('./analytics')

// P1-3 分包懒加载：6 个分类分包数据按需加载
// Why: 审核报告 P1-3 — 主包 questions.json 652KB，结构上拆为 6 个分包便于未来完全迁移
// 当前阶段：主包仍保留 questions.json 作为同步源（API 兼容），分包作为并行结构 + 异步预加载入口
// 后续阶段：调用方迁移到 getByIdAsync 后可移除主包 questions.json
const SUBPACKAGE_CATEGORIES = ['body', 'animals', 'food', 'home', 'nature', 'society']
const _subpackageLoaded = {}  // {cat: true} 标记已加载完成的分包

const questionMap = new Map()
for (const q of questions) questionMap.set(q.id, q)

// P0-3 图片 CDN 访问：通过 jsDelivr CDN 加速 GitHub 仓库图片
// Why: 审核报告 P0-3 — 小程序未配置 CDN 域名时图片无法加载；jsDelivr 不需要在小程序后台配置 request 合法域名即可访问
// 备用：raw.githubusercontent.com（速度较慢，作为 fallback）
const CDN_BASE = 'https://cdn.jsdelivr.net/gh/mokajing/billion-whys@main/content'
const CDN_FALLBACK = 'https://raw.githubusercontent.com/mokajing/billion-whys/main/content'

// 本地调试开关：开发者在微信开发者工具中关闭"不校验合法域名"时，可设置 USE_LOCAL_IMAGE=true 使用本地路径
let useLocalImage = false
try {
  if (typeof wx !== 'undefined' && typeof wx.getStorageSync === 'function') {
    useLocalImage = !!wx.getStorageSync('bw_use_local_image')
  }
} catch (_e) { /* dev tool only */ }

function toWebP(path) {
  if (!path) return ''
  // 标准化路径：去掉前导斜杠，统一相对路径
  let p = path.startsWith('/') ? path.slice(1) : path
  // 转 .webp
  if (!/\.webp$/i.test(p)) {
    p = p.replace(/\.(png|jpe?g)$/i, '.webp')
  }
  // 本地调试模式：返回相对路径（/开头，小程序可访问 src/miniprogram 下的资源）
  if (useLocalImage) {
    return '/' + p
  }
  // 默认走 CDN
  return CDN_BASE + '/' + p
}

// 备用 CDN URL（当主 CDN 加载失败时，前端 image 标签 binderror 中可切换）
function toWebPFallback(path) {
  if (!path) return ''
  let p = path.startsWith('/') ? path.slice(1) : path
  if (!/\.webp$/i.test(p)) {
    p = p.replace(/\.(png|jpe?g)$/i, '.webp')
  }
  return CDN_FALLBACK + '/' + p
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

// V8.13 第81轮 Sprint 22：累计参与度汇总（H5 feedbackSummary getter 同构）
function getFeedbackSummary() {
  return storage.getFeedbackSummary()
}

// V8.15 第83轮 Sprint 24：事件总线统一治理 — 转发 storage 的事件总线 API
// Why: H5 analytics.emitEvent 同构；后端老稳未来 batch upload 走 eventLog 单一通道
function emitEvent(name, detail, meta) {
  return storage.emitEvent(name, detail, meta)
}

function getEventLog() {
  return storage.getEventLog()
}

function countEvent(name) {
  return storage.countEvent(name)
}

function flushAll() {
  return storage.flushAll()
}

// V8.12 第80轮 Sprint 21：长按预览 — 仅 questionId 查 questionMap 取 layer1.answer 前 50 字
// Why: H5 stores/content.js previewAnswerForId 同构；UX 苏体验 + 毒舌老王"看完就回来"
// 法务张律放行：仅本地查表，无新数据收集
function previewAnswerForId(id) {
  if (!id) return null
  const q = questionMap.get(id)
  if (!q) return null
  const full = (q.layer1 && q.layer1.answer) ? String(q.layer1.answer) : ''
  if (!full) return { id, title: q.question || '', snippet: '', hasFull: false }
  const SNIPPET_LEN = 50
  const snippet = full.length > SNIPPET_LEN ? (full.slice(0, SNIPPET_LEN) + '…') : full
  return { id, title: q.question || '', snippet, hasFull: true }
}

function notifyLoadError() {
  safeToast({ title: '内容加载失败', icon: 'none' })
}

function scrollTop() {
  safePageScrollTo(0)
}

// P1-3 分包懒加载 API
// preloadCategoryAsync(cat): 异步预加载分类分包；不阻塞调用方
//   用于：进入 question 页时按 id 推断 category 后异步预加载，下次访问该分包时 require() 已就绪
//   返回 Promise<boolean>，true 表示分包已就绪
function preloadCategoryAsync(cat) {
  if (!cat || SUBPACKAGE_CATEGORIES.indexOf(cat) === -1) return Promise.resolve(false)
  if (_subpackageLoaded[cat]) return Promise.resolve(true)
  return safeLoadSubpackage(cat).then(ok => {
    if (ok) _subpackageLoaded[cat] = true
    return ok
  })
}

// isCategoryLoaded(cat): 同步查询分包是否已加载完成
function isCategoryLoaded(cat) {
  return !!_subpackageLoaded[cat]
}

// getCategoryFromId(id): 从 id 前缀推断 category（如 "body-005" -> "body"）
// 用于 question 页 onLoad 在调 getById 前确定要预加载哪个分包
function getCategoryFromId(id) {
  if (!id || typeof id !== 'string') return ''
  const dashIdx = id.indexOf('-')
  if (dashIdx <= 0) return ''
  const cat = id.substring(0, dashIdx)
  return SUBPACKAGE_CATEGORIES.indexOf(cat) !== -1 ? cat : ''
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
  toWebPFallback,
  CDN_BASE,
  CDN_FALLBACK,
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
  getFeedbackSummary,
  // V8.15 第83轮 Sprint 24：事件总线统一治理
  emitEvent,
  getEventLog,
  countEvent,
  flushAll,
  previewAnswerForId,
  notifyLoadError,
  scrollTop,
  // P1-3 分包懒加载 API
  preloadCategoryAsync,
  isCategoryLoaded,
  getCategoryFromId,
  SUBPACKAGE_CATEGORIES,
}
