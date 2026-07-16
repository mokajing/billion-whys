// V8.60 BUG-0006 修复：主包瘦身——启动时只加载 index (42KB)，全量数据异步加载
// 旧方案：const questions = require('../data/questions-data')  // 670KB 同步阻塞
// 新方案：先加载 index，异步加载全量数据；首屏渲染用 index 数据
// V8.61 Sprint 69：分包异步加载失败降级策略——弱网/分包加载失败时展示 index 数据 + 提示
// V9.18 第180轮：comfortCategory fallback（R180-013）——缺失时按 category 补充默认表情
const questionsIndex = require('../data/questions-index-data')
const { safeLoadSubpackage, safeToast } = require('./safe-wx')
const storage = require('./storage')
const analytics = require('./analytics')

let questions = questionsIndex  // 启动时使用 index 数据（轻量，42KB）
let _fullDataLoaded = false
let _fullDataPromise = null
let _loadErrorCount = 0  // V8.61：分包加载失败计数

// P1-3 分包类别（也用于异步加载全量数据）
const SUBPACKAGE_CATEGORIES = ['body', 'animals', 'food', 'home', 'nature', 'society']
const _subpackageLoaded = {}  // {cat: true} 标记已加载完成的分包

// V8.61 Sprint 69：降级提示——分包加载失败时提醒用户网络不佳
function _showDegradedNotice() {
  safeToast({
    title: '网络不佳，部分内容加载中',
    icon: 'none',
    duration: 3000,
  })
}

// CDN 动态数据加载：从 GitHub CDN 获取题目数据，无需发版即可更新内容
const CDN_DATA_BASE = 'https://cdn.jsdelivr.net/gh/mokajing/billion-whys@main/content/seed-library'
const CDN_DATA_FALLBACK = 'https://raw.githubusercontent.com/mokajing/billion-whys/main/content/seed-library'
const CACHE_KEY_PREFIX = 'bw_cat_data_'
const CACHE_VERSION_KEY = 'bw_data_version'
const CACHE_EXPIRY_MS = 3600000  // 1 hour cache

// 从 CDN 获取单个分类数据
function _fetchCategoryFromCDN(cat) {
  return new Promise((resolve) => {
    const url = `${CDN_DATA_BASE}/${cat}.json`
    const fallbackUrl = `${CDN_DATA_FALLBACK}/${cat}.json`

    const doRequest = (targetUrl, isFallback) => {
      if (typeof wx === 'undefined' || typeof wx.request !== 'function') {
        resolve(null)
        return
      }
      wx.request({
        url: targetUrl,
        method: 'GET',
        timeout: 10000,
        success: (res) => {
          if (res.statusCode === 200 && res.data && Array.isArray(res.data)) {
            // 缓存到本地
            try {
              wx.setStorageSync(`${CACHE_KEY_PREFIX}${cat}`, {
                data: res.data,
                timestamp: Date.now(),
              })
            } catch (_e) { /* 缓存失败不影响功能 */ }
            resolve(res.data)
          } else if (!isFallback) {
            doRequest(fallbackUrl, true)
          } else {
            resolve(null)
          }
        },
        fail: () => {
          if (!isFallback) {
            doRequest(fallbackUrl, true)
          } else {
            resolve(null)
          }
        },
      })
    }
    doRequest(url, false)
  })
}

// 从本地缓存获取分类数据
function _getCategoryFromCache(cat) {
  if (typeof wx === 'undefined' || typeof wx.getStorageSync !== 'function') return null
  try {
    const cached = wx.getStorageSync(`${CACHE_KEY_PREFIX}${cat}`)
    if (cached && cached.data && cached.timestamp) {
      const age = Date.now() - cached.timestamp
      if (age < CACHE_EXPIRY_MS) {
        return cached.data
      }
    }
  } catch (_e) { /* ignore */ }
  return null
}

// 异步加载全量数据：优先 CDN 动态加载 → 本地缓存 → 分包降级
async function _loadFullDataAsync() {
  if (_fullDataLoaded) return
  if (_fullDataPromise) return _fullDataPromise

  _fullDataPromise = (async () => {
    try {
      const allData = []
      const cats = SUBPACKAGE_CATEGORIES
      let loadedCount = 0
      let cdnSuccess = false

      for (const cat of cats) {
        // 1. 尝试 CDN 动态获取（前后端分离，无需发版）
        let catData = await _fetchCategoryFromCDN(cat)
        if (catData && Array.isArray(catData) && catData.length > 0) {
          allData.push(...catData)
          loadedCount++
          cdnSuccess = true
          continue
        }

        // 2. 尝试本地缓存（CDN 失败时用过期缓存）
        const cached = _getCategoryFromCache(cat)
        if (cached && Array.isArray(cached) && cached.length > 0) {
          allData.push(...cached)
          loadedCount++
          continue
        }

        // 3. 降级：从分包加载（bundled，需发版才能更新）
        try {
          const ok = await safeLoadSubpackage(cat)
          if (ok) {
            const subData = require('../../subpackages/' + cat + '/data')
            if (Array.isArray(subData)) allData.push(...subData)
            loadedCount++
          }
        } catch (_e) {
          console.warn('[BillionWhys] Failed to load:', cat, _e)
        }
      }

      if (allData.length > 0) {
        questions = allData
        _rebuildQuestionMap()
        _fullDataLoaded = true
        console.log('[BillionWhys] Full data loaded:', allData.length, 'questions (CDN:', cdnSuccess + ')')
        if (loadedCount < cats.length) {
          _showDegradedNotice()
        }
      } else {
        _loadErrorCount++
        console.warn('[BillionWhys] All data sources failed, using index data only')
        _showDegradedNotice()
      }
    } catch (_e) {
      _loadErrorCount++
      console.error('[BillionWhys] Failed to load full data:', _e)
      _showDegradedNotice()
    }
    return _fullDataLoaded
  })()

  return _fullDataPromise
}

function _rebuildQuestionMap() {
  questionMap.clear()
  for (const q of questions) {
    // V9.18 第180轮：comfortCategory fallback（R180-013）
    // 当 comfortCategory 缺失时，按 category 类型补充默认 emotion
    if (!q.comfortCategory || q.comfortCategory.trim() === '') {
      const defaults = {
        home: { rabbitEmotion: 'curious', bearEmotion: 'gentle' },
        nature: { rabbitEmotion: 'curious', bearEmotion: 'wise' },
        society: { rabbitEmotion: 'curious', bearEmotion: 'wise' },
        food: { rabbitEmotion: 'curious', bearEmotion: 'gentle' },
        body: { rabbitEmotion: 'curious', bearEmotion: 'warm' },
        animals: { rabbitEmotion: 'curious', bearEmotion: 'gentle' },
      }
      const fallback = defaults[q.category] || { rabbitEmotion: 'curious', bearEmotion: 'gentle' }
      if (!q.rabbitEmotion || q.rabbitEmotion.trim() === '') {
        q.rabbitEmotion = fallback.rabbitEmotion
      }
      if (!q.bearEmotion || q.bearEmotion.trim() === '') {
        q.bearEmotion = fallback.bearEmotion
      }
    }

    // V9.19 第181轮：emotion 空值兜底（R181-013，前端小凡）
    // 当 comfortCategory 有值但 rabbitEmotion/bearEmotion 为空时，注入 fallback
    // 解决：comfortCategory已存在但emotion字段缺失的边缘情况
    const defaults = {
      home: { rabbitEmotion: 'curious', bearEmotion: 'gentle' },
      nature: { rabbitEmotion: 'curious', bearEmotion: 'wise' },
      society: { rabbitEmotion: 'curious', bearEmotion: 'wise' },
      food: { rabbitEmotion: 'curious', bearEmotion: 'gentle' },
      body: { rabbitEmotion: 'curious', bearEmotion: 'warm' },
      animals: { rabbitEmotion: 'curious', bearEmotion: 'gentle' },
    }
    const fallback = defaults[q.category] || { rabbitEmotion: 'curious', bearEmotion: 'gentle' }
    if (!q.rabbitEmotion || q.rabbitEmotion.trim() === '') {
      q.rabbitEmotion = fallback.rabbitEmotion
    }
    if (!q.bearEmotion || q.bearEmotion.trim() === '') {
      q.bearEmotion = fallback.bearEmotion
    }

    questionMap.set(q.id, q)
  }
}

function isFullDataLoaded() {
  return _fullDataLoaded
}

// V8.61 Sprint 69：获取分包加载失败计数，供性能监控使用
function getLoadErrorCount() {
  return _loadErrorCount
}

function initAsync() {
  return _loadFullDataAsync()
}

// P1-3 分包懒加载：6 个分类分包数据按需加载
// V8.60 BUG-0006 修复：SUBPACKAGE_CATEGORIES 和 _subpackageLoaded 已移至文件顶部

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
  // V8.60 BUG-0007 修复：空 URL 请求守卫——path 为空或非字符串时返回空，避免 XHR 空 URL 请求
  if (!path || typeof path !== 'string' || !path.trim()) return ''
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
  // V8.60 BUG-0007 修复：空 URL 守卫
  if (!path || typeof path !== 'string' || !path.trim()) return ''
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

// V8.63 第127轮：今日 3 问年龄分层（周教授适龄性红线 + CPO 产品一致性）
// 从题库中按年龄标签筛选 3 题：3 岁 / 4-5 岁 / 5-6 岁各一题
// 情绪安全过滤：排除含死/血/鬼/怪物/消失/黑暗/孤独关键词的问题（安全李姐 P0 红线）
// 家庭结构多样性：排除含"爸爸说"/"妈妈带你去"等特定角色叙事的问题（社会学刘教授）
function dailyPicks(date) {
  if (!Array.isArray(questions) || questions.length === 0) return []
  // 情绪安全关键词黑名单（安全李姐 V8.63 P0 红线）
  const EMOTION_BLOCKLIST = ['死', '血', '鬼', '怪物', '消失', '黑暗', '孤独']
  // 需人工安全审核的关键词（V8.66 第130轮：CEO 裁决——"疼"不阻止入选但标记 needsSafetyReview: true）
  const HUMAN_REVIEW_KEYWORDS = ['疼']
  // 家庭结构特定角色叙事过滤（社会学刘教授 V8.63 P1）
  const FAMILY_ROLE_PATTERNS = ['爸爸说', '妈妈说', '妈妈带你去', '爸爸带你去', '妈妈告诉我', '爸爸告诉我']
  const d = date instanceof Date ? date : new Date()
  const dayKey = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
  const ageSlots = [
    { agePattern: /^3[-\s]?4|^3岁|^3-|3~4|2-3|2~3/, label: '3-4岁', fallback: /^3|^4/ },
    { agePattern: /^4[-\s]?5|^4岁|^4-|4~5|3-5/, label: '4-5岁', fallback: /^4|^5/ },
    { agePattern: /^5[-\s]?6|^5岁|^5-|5~6|4-6/, label: '5-6岁', fallback: /^5|^6/ },
  ]
  const picked = []
  const usedIds = new Set()
  for (const slot of ageSlots) {
    const seed = dayKey + picked.length * 31
    let candidates = questions
      .filter(q => q && q.id && !usedIds.has(q.id))
      .filter(q => {
        const age = (q.age || '').toLowerCase()
        if (slot.agePattern.test(age)) return true
        return slot.fallback.test(age)
      })
      .filter(q => {
        const text = (q.question || '') + ' ' + (q.tags || []).join(' ')
        return !EMOTION_BLOCKLIST.some(kw => text.includes(kw))
      })
      .filter(q => !FAMILY_ROLE_PATTERNS.some(p => (q.question || '').includes(p)))
    if (candidates.length === 0) {
      candidates = questions
        .filter(q => q && q.id && !usedIds.has(q.id))
        .filter(q => {
          const text = (q.question || '') + ' ' + (q.tags || []).join(' ')
          return !EMOTION_BLOCKLIST.some(kw => text.includes(kw))
        })
    }
    if (candidates.length > 0) {
      const pick = candidates[seed % candidates.length]
      const safetyReview = HUMAN_REVIEW_KEYWORDS.some(kw => (pick.question || "").includes(kw)); picked.push({ ...pick, ageLabel: slot.label, needsSafetyReview: safetyReview || false })
      usedIds.add(pick.id)
    }
  }
  return picked
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
  dailyPicks,
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
  // V8.61 Sprint 69：分包加载监控
  isFullDataLoaded,
  initAsync,
  getLoadErrorCount,
  SUBPACKAGE_CATEGORIES,
}
