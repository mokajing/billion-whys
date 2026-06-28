import { defineStore } from 'pinia'
import { normalizeKeyword, localDateKey } from '@/utils/constants'

const seedLoaders = import.meta.glob('@content/seed-library/*.json')

function migrateViewedData() {
  try {
    const oldData = localStorage.getItem('bw_viewed')
    const newData = localStorage.getItem('bw_view_history')
    if (oldData && !newData) {
      const ids = JSON.parse(oldData)
      const history = ids.map(id => ({ id, timestamp: Date.now(), category: '' }))
      localStorage.setItem('bw_view_history', JSON.stringify(history))
      localStorage.removeItem('bw_viewed')
      return history
    }
    return newData ? JSON.parse(newData) : []
  } catch {
    return []
  }
}

const MAX_HISTORY = 500

let saveTimer = null
// 300ms: shorter than analytics (500ms) because view history is user-critical data
function debounceSave(data) {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => flushSave(data), 300)
}

function flushSave(data) {
  clearTimeout(saveTimer)
  saveTimer = null
  try {
    localStorage.setItem('bw_view_history', JSON.stringify(data))
  } catch {
    try {
      const trimmed = data.slice(-Math.floor(MAX_HISTORY / 2))
      localStorage.setItem('bw_view_history', JSON.stringify(trimmed))
    } catch {
      console.warn('[BillionWhys] localStorage save failed — storage may be full') // eslint-disable-line no-console
    }
  }
}

let _latestHistory = null

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && _latestHistory) flushSave(_latestHistory)
  })
}

function loadFavorites() {
  try {
    const data = localStorage.getItem('bw_favorites')
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function saveFavorites(ids) {
  try {
    localStorage.setItem('bw_favorites', JSON.stringify(ids))
  } catch {
    try {
      const trimmed = ids.slice(-50)
      localStorage.setItem('bw_favorites', JSON.stringify(trimmed))
    } catch {
      console.warn('[BillionWhys] favorites save failed — storage may be full') // eslint-disable-line no-console
    }
  }
}

// 答案反馈：纯本地存储，{ id: 'up'|'down', ts: number } 数组结构预留服务端聚合
// Why: 闭合内容质量数据回路；零网络零画像；后端老稳要求 ts 字段供未来 batch upload
const ANSWER_FEEDBACK_KEY = 'bw_answer_feedback'

function loadAnswerFeedback() {
  try {
    const data = localStorage.getItem(ANSWER_FEEDBACK_KEY)
    const arr = data ? JSON.parse(data) : []
    return Array.isArray(arr) ? arr.filter(x => x && x.id && (x.value === 'up' || x.value === 'down')) : []
  } catch {
    return []
  }
}

function saveAnswerFeedback(arr) {
  try {
    localStorage.setItem(ANSWER_FEEDBACK_KEY, JSON.stringify(arr))
  } catch {
    try {
      const trimmed = arr.slice(-100)
      localStorage.setItem(ANSWER_FEEDBACK_KEY, JSON.stringify(trimmed))
    } catch {
      console.warn('[BillionWhys] answer feedback save failed — storage may be full') // eslint-disable-line no-console
    }
  }
}

// V8.4 第72轮 Sprint 13：反馈行动流水 — append-only log，与 bw_answer_feedback 解耦
// Why: bw_answer_feedback 是"当前状态"（reset 会物理删除），无法回答"过去7天反馈了N次"
// 后端老稳：log 字段 {action, ts}，预留 batch upload；测试虫虫：cap 200、90 天 prune
// V8.5 第73轮 Sprint 14：扩展为 {action, ts, id?} — id 可选，老数据无 id 时显示"已反馈(记录已迁移)"
// Why: Profile 趋势图点击展开每日明细需要 questionId 映射到问题标题（UX 苏体验 + 小美裁决）
const FEEDBACK_LOG_KEY = 'bw_feedback_log'
const FEEDBACK_LOG_MAX = 200
const FEEDBACK_LOG_RETENTION_DAYS = 90

function loadFeedbackLog() {
  try {
    const data = localStorage.getItem(FEEDBACK_LOG_KEY)
    const arr = data ? JSON.parse(data) : []
    if (!Array.isArray(arr)) return []
    const cutoff = Date.now() - FEEDBACK_LOG_RETENTION_DAYS * 86400000
    return arr
      .filter(x => x && (x.action === 'up' || x.action === 'down' || x.action === 'reset') && typeof x.ts === 'number' && x.ts >= cutoff)
      // id 字段可选，老数据无 id 仍保留（AI 小智要求向后兼容）
      .map(x => x.id ? { action: x.action, ts: x.ts, id: x.id } : { action: x.action, ts: x.ts })
  } catch {
    return []
  }
}

function saveFeedbackLog(arr) {
  try {
    const trimmed = arr.slice(-FEEDBACK_LOG_MAX)
    localStorage.setItem(FEEDBACK_LOG_KEY, JSON.stringify(trimmed))
  } catch {
    try {
      const trimmed = arr.slice(-Math.floor(FEEDBACK_LOG_MAX / 2))
      localStorage.setItem(FEEDBACK_LOG_KEY, JSON.stringify(trimmed))
    } catch {
      console.warn('[BillionWhys] feedback log save failed — storage may be full') // eslint-disable-line no-console
    }
  }
}

// 搜索历史：纯本地存储，最多 8 条，去重最新前置
// Why: 用户多次搜索时避免重复输入；零数据收集原则
const MAX_SEARCH_HISTORY = 8
const SEARCH_HISTORY_KEY = 'bw_search_history'

function loadSearchHistory() {
  try {
    const data = localStorage.getItem(SEARCH_HISTORY_KEY)
    const arr = data ? JSON.parse(data) : []
    return Array.isArray(arr) ? arr.filter(k => typeof k === 'string' && k.trim()) : []
  } catch {
    return []
  }
}

function saveSearchHistory(history) {
  try {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history))
  } catch {
    try {
      const trimmed = history.slice(-Math.floor(MAX_SEARCH_HISTORY / 2))
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(trimmed))
    } catch {
      console.warn('[BillionWhys] search history save failed — storage may be full') // eslint-disable-line no-console
    }
  }
}

const questionMap = new Map()

export const useContentStore = defineStore('content', {
  state: () => ({
    questions: [],
    viewHistory: migrateViewedData(),
    favorites: loadFavorites(),
    searchHistory: loadSearchHistory(),
    answerFeedback: loadAnswerFeedback(),
    feedbackLog: loadFeedbackLog(),
    _hotQuestionsCache: null,
    _loading: false,
    ready: false,
    initError: false,
  }),
  getters: {
    getQuestionById: () => (id) => questionMap.get(id) || null,
    getByCategory: (state) => (category) => {
      if (!category || category === 'all') return state.questions
      return state.questions.filter(q => q.category === category)
    },
    totalCount: (state) => state.questions.length,
    viewedCount: (state) => new Set(state.viewHistory.map(v => v.id)).size,
    viewedIds: (state) => [...new Set(state.viewHistory.map(v => v.id))],
    isFavorite: (state) => (id) => state.favorites.includes(id),
    favoriteQuestions: (state) => state.favorites.map(id => questionMap.get(id)).filter(Boolean),
    favoriteCount: (state) => state.favorites.length,
    getAnswerFeedback: (state) => (id) => {
      const entry = state.answerFeedback.find(f => f.id === id)
      return entry ? entry.value : null
    },
    feedbackCount: (state) => state.answerFeedback.length,
    // V8.4 第72轮 Sprint 13：过去 7 天反馈行动趋势（含今天）
    // Why: COO 北极星反馈率 ≥5% 需"看得见"；心理学家周教授：重置用灰色不红色化
    // 返回 [{date, up, down, reset, total}]，最早 → 今天，共 7 条
    feedbackTrend7d: (state) => {
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
      for (const e of state.feedbackLog) {
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
    },
    // V8.5 第73轮 Sprint 14：按日期返回当日明细（倒序），供 Profile 趋势图点击展开
    // Why: COO+UX+小美 — 妈妈想"那天我到底反馈了啥"；CCO 文案 ≤1 行
    // 返回 [{action, ts, id?, title?, depth?}]，title 来自 questionMap（无 id 老数据 title 为 null）
    // depth 来自 V8.9 Sprint 18 快照（无 depth 老数据当 1）
    // 与 feedbackTrend7d 同样的本地午夜分桶逻辑，保证 date 标签对称匹配
    feedbackDetailByDate: (state) => (dateStr) => {
      if (!dateStr) return []
      const dayMs = 86400000
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayTs = today.getTime()
      // 7 天窗口内按 trend7d 同款分桶匹配
      for (let i = 6; i >= 0; i--) {
        const start = todayTs - i * dayMs
        const label = localDateKey(new Date(start))
        if (label !== dateStr) continue
        const end = start + dayMs
        return state.feedbackLog
          .filter(e => e.ts >= start && e.ts < end)
          .map(e => ({
            action: e.action,
            ts: e.ts,
            id: e.id || null,
            title: e.id && questionMap.has(e.id) ? (questionMap.get(e.id).question || null) : null,
            depth: e.depth || 1,
          }))
          .sort((a, b) => b.ts - a.ts)
      }
      // 7 天窗口外或无效日期：返回空（feedbackLog 90 天 prune 已限制可查范围）
      return []
    },
    // V8.9 第77轮 Sprint 18：按日期返回当日反馈深度分布
    // Why: COO 北极星反馈率从"扁平百分比"升级为"分层热力图"基础；depth=3+👍/👎 是内容质量强信号
    // 返回 {L1, L2, L3, total}，老 entry 无 depth 归入 L1
    feedbackDepthByDate: (state) => (dateStr) => {
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
        for (const e of state.feedbackLog) {
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
    },
    todayViewedCount: (state) => {
      const today = new Date().toDateString()
      return new Set(
        state.viewHistory.filter(v => new Date(v.timestamp).toDateString() === today).map(v => v.id)
      ).size
    },
    streakDays: (state) => {
      if (state.viewHistory.length === 0) return 0
      const toNoon = d => { const n = new Date(d); n.setHours(12, 0, 0, 0); return n }
      const days = [...new Set(state.viewHistory.map(v => new Date(v.timestamp).toDateString()))]
        .sort((a, b) => new Date(b) - new Date(a))
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
    },
    historyByDate: (state) => {
      const groups = {}
      const sorted = [...state.viewHistory].sort((a, b) => b.timestamp - a.timestamp)
      const seen = new Set()
      for (const entry of sorted) {
        const dateKey = new Date(entry.timestamp).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
        if (!groups[dateKey]) groups[dateKey] = []
        const dedupKey = `${dateKey}:${entry.id}`
        if (!seen.has(dedupKey)) {
          seen.add(dedupKey)
          groups[dateKey].push(entry)
        }
      }
      return groups
    },
    searchQuestions: (state) => (keyword) => {
      if (!keyword || !keyword.trim()) return []
      const kw = normalizeKeyword(keyword)
      if (!kw) return []
      if (kw.length === 1) {
        return state.questions.filter(q => {
          const haystack = (q.question + ' ' + (q.tags || []).join(' ')).toLowerCase()
          return haystack.includes(kw)
        })
      }
      const bigrams = []
      for (let i = 0; i < kw.length; i++) {
        bigrams.push(kw[i])
        if (i < kw.length - 1) bigrams.push(kw.substring(i, i + 2))
      }
      return state.questions
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
    },
    hotQuestions: (state) => {
      return state._hotQuestionsCache || []
    },
    dailyPick: (state) => {
      if (!Array.isArray(state.questions) || state.questions.length === 0) return null
      const d = new Date()
      const dayKey = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
      return state.questions[dayKey % state.questions.length]
    },
    suggestRelated: (state) => (keyword) => {
      if (!keyword || !keyword.trim()) return []
      const kw = normalizeKeyword(keyword)
      if (!kw) return []
      const chars = [...kw]
      if (chars.length < 2) return []
      return state.questions
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
    },
  },
  actions: {
    async init() {
      if (this.ready) return
      if (this._initPromise) return this._initPromise
      this._loading = true
      this.initError = false
      _latestHistory = null
      this._initPromise = (async () => {
      try {
        const modules = await Promise.all(
          Object.values(seedLoaders).map(load => load())
        )
        const all = []
        for (const mod of modules) {
          const questions = mod.default || mod
          if (Array.isArray(questions)) all.push(...questions)
        }
        questionMap.clear()
        for (const q of all) questionMap.set(q.id, q)
        this.questions = all
        this.ready = true
      } catch (err) {
        this.initError = true
        this._initPromise = null
        console.error('[BillionWhys] content init failed:', err) // eslint-disable-line no-console
      } finally {
        this._loading = false
      }
      })()
      return this._initPromise
    },
    async retryInit() {
      if (this._loading) return
      this.ready = false
      this.initError = false
      this._loading = false
      this._initPromise = null
      await this.init()
    },
    addQuestion(question) {
      if (!questionMap.has(question.id)) {
        this.questions.push(question)
        questionMap.set(question.id, question)
      }
    },
    markViewed(id, category = '') {
      const last = this.viewHistory[this.viewHistory.length - 1]
      if (last && last.id === id) return
      this.viewHistory.push({ id, timestamp: Date.now(), category })
      if (this.viewHistory.length > MAX_HISTORY) {
        this.viewHistory = this.viewHistory.slice(-MAX_HISTORY)
      }
      debounceSave(this.viewHistory)
      _latestHistory = this.viewHistory
    },
    refreshHotQuestions() {
      const categories = ['body', 'home', 'food', 'nature', 'animals', 'society']
      const picks = []
      for (const cat of categories) {
        const catQs = [...this.questions.filter(q => q.category === cat)]
        for (let i = catQs.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [catQs[i], catQs[j]] = [catQs[j], catQs[i]]
        }
        if (catQs.length > 0) picks.push(catQs[0])
      }
      this._hotQuestionsCache = picks.slice(0, 6)
    },
    toggleFavorite(id) {
      const idx = this.favorites.indexOf(id)
      if (idx === -1) {
        this.favorites.push(id)
      } else {
        this.favorites.splice(idx, 1)
      }
      saveFavorites(this.favorites)
    },
    pushSearchHistory(keyword) {
      const kw = (keyword || '').trim()
      if (!kw) return
      const filtered = this.searchHistory.filter(k => k !== kw)
      filtered.unshift(kw)
      this.searchHistory = filtered.slice(0, MAX_SEARCH_HISTORY)
      saveSearchHistory(this.searchHistory)
    },
    clearSearchHistory() {
      this.searchHistory = []
      saveSearchHistory([])
    },
    // V8.9 第77轮 Sprint 18：反馈深度归因 — 携带 depth 字段（1/2/3 = 反馈时可见的最深 Layer）
    // Why: V8.6 北极星漏斗闭环后下一步"可分层归因"；depth=3+👍 是深度学习信号，depth=3+👎 是内容质量强信号
    // How to apply: 调用方传 depth（QuestionDetail 由 showDeeper+layer3 推导）；老 entry 无 depth 当 L1
    setAnswerFeedback(id, value, depth) {
      if (!id) return
      if (value !== 'up' && value !== 'down') return
      const idx = this.answerFeedback.findIndex(f => f.id === id)
      if (idx !== -1) {
        if (this.answerFeedback[idx].value === value) {
          // 重复点击同方向：保持原值，不切换（幂等，符合3岁孩子狂点测试）
          // 也不入 feedbackLog — 测试虫虫要求：幂等动作不入流水
          return
        }
        this.answerFeedback[idx].value = value
        this.answerFeedback[idx].ts = Date.now()
      } else {
        this.answerFeedback.push({ id, value, ts: Date.now() })
      }
      saveAnswerFeedback(this.answerFeedback)
      // V8.4 Sprint 13：append 到行动流水
      // V8.5 Sprint 14：log entry 携带 id 字段，供 Profile 每日明细展示问题标题
      // V8.9 Sprint 18：log entry 携带 depth 字段（1/2/3），供 Profile 明细显示"读到第N层"徽章
      this.feedbackLog.push({ action: value, ts: Date.now(), id, depth: depth || 1 })
      this.feedbackLog = this.feedbackLog.slice(-FEEDBACK_LOG_MAX)
      saveFeedbackLog(this.feedbackLog)
    },
    // V8.3 第71轮 Sprint 12：清除指定 question 的反馈记录，让妈妈能"再评一次"
    // Why: 误点后悔药 + 反馈率北极星提升（COO+CEO裁决）；后端老稳预留：未来上云时
    // 改为软删除（deleted=true）以追溯内容质量信号，本轮 MVP 物理删除即可
    // V8.9 Sprint 18：reset 也带 depth（保持 schema 一致，测试虫虫裁决）
    clearAnswerFeedback(id, depth) {
      if (!id) return
      const idx = this.answerFeedback.findIndex(f => f.id === id)
      if (idx === -1) return
      this.answerFeedback.splice(idx, 1)
      saveAnswerFeedback(this.answerFeedback)
      // V8.4 Sprint 13：reset 入行动流水（心理学家周教授：reset 是反思行为不是错误，灰色不红色化）
      // V8.5 Sprint 14：log entry 携带 id 字段
      // V8.9 Sprint 18：log entry 携带 depth 字段
      this.feedbackLog.push({ action: 'reset', ts: Date.now(), id, depth: depth || 1 })
      this.feedbackLog = this.feedbackLog.slice(-FEEDBACK_LOG_MAX)
      saveFeedbackLog(this.feedbackLog)
    },
  },
})
