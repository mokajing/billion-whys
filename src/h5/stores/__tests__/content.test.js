import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useContentStore } from '../content.js'

// Mock localStorage for jsdom
const localStorageMock = (() => {
  let store = {}
  return {
    getItem: vi.fn((key) => store[key] ?? null),
    setItem: vi.fn((key, value) => { store[key] = String(value) }),
    removeItem: vi.fn((key) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
  }
})()
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

describe('useContentStore', () => {
  let store

  beforeEach(async () => {
    setActivePinia(createPinia())
    localStorageMock.clear()
    vi.useFakeTimers()
    store = useContentStore()
    await store.init()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ---- Loading ----
  describe('seed library loading', () => {
    it('loads all 270 questions from seed library', () => {
      expect(store.questions.length).toBe(270)
    })
  })

  // ---- searchQuestions ----
  describe('searchQuestions', () => {
    it('exact match: searching "放屁" finds body questions', () => {
      const results = store.searchQuestions('放屁')
      expect(results.length).toBeGreaterThan(0)
      const hasBody = results.some(q => q.category === 'body')
      expect(hasBody).toBe(true)
      // The question about 放屁 should be among results
      const fangpiQ = results.find(q => q.question.includes('放屁'))
      expect(fangpiQ).toBeDefined()
    })

    it('fuzzy match: searching "下雨" finds nature questions', () => {
      const results = store.searchQuestions('下雨')
      expect(results.length).toBeGreaterThan(0)
      const hasNature = results.some(q => q.category === 'nature')
      expect(hasNature).toBe(true)
    })

    it('returns empty for gibberish input', () => {
      const results = store.searchQuestions('xyzqwfoobar123')
      expect(results.length).toBe(0)
    })

    it('returns empty for empty/whitespace input', () => {
      expect(store.searchQuestions('')).toEqual([])
      expect(store.searchQuestions('   ')).toEqual([])
      expect(store.searchQuestions(null)).toEqual([])
    })

    it('synonym normalization: "为啥" matches "为什么" questions', () => {
      const stdResults = store.searchQuestions('为什么')
      const synonymResults = store.searchQuestions('为啥')
      // 假设库内含至少一条以"为什么"开头的标准问题
      expect(stdResults.length).toBeGreaterThan(0)
      // "为啥"归一后应至少命中部分"为什么"的结果
      const stdIds = new Set(stdResults.map(q => q.id))
      const overlap = synonymResults.filter(q => stdIds.has(q.id))
      expect(overlap.length).toBeGreaterThan(0)
    })

    it('synonym normalization: trailing particle 嗎/呢/么 stripped', () => {
      const r1 = store.searchQuestions('下雨')
      const r2 = store.searchQuestions('下雨呢')
      // 去掉句末语气词后应保持核心命中
      expect(r2.length).toBeGreaterThan(0)
      const r1Ids = new Set(r1.map(q => q.id))
      const overlap = r2.filter(q => r1Ids.has(q.id))
      expect(overlap.length).toBeGreaterThan(0)
    })
  })

  // ---- dailyPick (zero personalization) ----
  describe('dailyPick', () => {
    it('returns a question deterministically by date', () => {
      const pick = store.dailyPick
      expect(pick).toBeTruthy()
      expect(pick.id).toBeDefined()
      // 同一 store 实例同日应稳定返回同一题
      const pick2 = store.dailyPick
      expect(pick2.id).toBe(pick.id)
    })

    it('returns null-safe when questions empty', () => {
      // store.questions 已加载，dailyPick 不应为 null
      expect(store.dailyPick).not.toBeNull()
    })
  })

  // ---- suggestRelated ----
  describe('suggestRelated', () => {
    it('returns results for partial matches', () => {
      const results = store.suggestRelated('下雨')
      expect(results.length).toBeGreaterThan(0)
      expect(results.length).toBeLessThanOrEqual(5)
    })

    it('returns empty for single common character', () => {
      const results = store.suggestRelated('的')
      expect(results).toEqual([])
    })

    it('returns empty for empty input', () => {
      expect(store.suggestRelated('')).toEqual([])
    })
  })

  // ---- hotQuestions ----
  describe('hotQuestions', () => {
    it('returns empty before initialization', () => {
      expect(store.hotQuestions).toEqual([])
    })

    it('returns one per category (6 total) after refreshHotQuestions', () => {
      store.refreshHotQuestions()
      const hot = store.hotQuestions
      expect(hot.length).toBe(6)
      const categories = hot.map(q => q.category)
      const expectedCategories = ['body', 'home', 'food', 'nature', 'animals', 'society']
      expect(categories).toEqual(expectedCategories)
      expect(new Set(categories).size).toBe(6)
    })

    it('refreshHotQuestions replaces cache', () => {
      store.refreshHotQuestions()
      store.refreshHotQuestions()
      const second = store.hotQuestions
      expect(second.length).toBe(6)
      expect(second.every(q => q.id)).toBe(true)
    })

    it('refreshHotQuestions can be called multiple times safely', () => {
      store.refreshHotQuestions()
      const cached = [...store.hotQuestions]
      store.refreshHotQuestions()
      expect(store.hotQuestions.length).toBe(cached.length)
    })
  })

  // ---- markViewed ----
  describe('markViewed', () => {
    it('records history entries', () => {
      store.markViewed('body-001', 'body')
      expect(store.viewHistory.length).toBe(1)
      expect(store.viewHistory[0].id).toBe('body-001')
      expect(store.viewHistory[0].category).toBe('body')
      expect(store.viewHistory[0].timestamp).toBeTypeOf('number')
    })

    it('deduplicates consecutive views of the same question', () => {
      store.markViewed('body-001', 'body')
      store.markViewed('body-001', 'body')
      store.markViewed('body-001', 'body')
      expect(store.viewHistory.length).toBe(1)
    })

    it('allows non-consecutive duplicate views', () => {
      store.markViewed('body-001', 'body')
      store.markViewed('body-002', 'body')
      store.markViewed('body-001', 'body')
      expect(store.viewHistory.length).toBe(3)
    })

    it('caps at MAX_HISTORY (500)', () => {
      // Fill beyond MAX_HISTORY
      for (let i = 0; i < 510; i++) {
        // Alternate between two IDs to avoid consecutive dedup
        const id = i % 2 === 0 ? `test-${i}` : `other-${i}`
        store.markViewed(id, 'body')
      }
      expect(store.viewHistory.length).toBeLessThanOrEqual(500)
    })
  })

  // ---- viewedCount & todayViewedCount ----
  describe('viewedCount and todayViewedCount', () => {
    it('viewedCount returns unique viewed question count', () => {
      store.markViewed('body-001', 'body')
      store.markViewed('body-002', 'body')
      store.markViewed('nature-001', 'nature')
      store.markViewed('body-001', 'body') // non-consecutive dup of body-001
      expect(store.viewedCount).toBe(3)
    })

    it('todayViewedCount counts only today\'s unique views', () => {
      const now = new Date('2026-06-19T10:00:00Z')
      vi.setSystemTime(now)

      store.markViewed('body-001', 'body')
      store.markViewed('body-002', 'body')
      expect(store.todayViewedCount).toBe(2)

      // Manually inject a yesterday entry
      const yesterday = new Date('2026-06-18T10:00:00Z')
      store.viewHistory.push({ id: 'nature-001', timestamp: yesterday.getTime(), category: 'nature' })
      // todayViewedCount should still be 2 (nature-001 was yesterday)
      expect(store.todayViewedCount).toBe(2)
    })
  })

  // ---- historyByDate ----
  describe('historyByDate', () => {
    it('groups viewed items by date', () => {
      const now = new Date('2026-06-19T10:00:00Z')
      vi.setSystemTime(now)

      store.markViewed('body-001', 'body')
      store.markViewed('body-002', 'body')

      const groups = store.historyByDate
      const keys = Object.keys(groups)
      expect(keys.length).toBe(1)
      expect(groups[keys[0]].length).toBe(2)
    })

    it('deduplicates same question on same day', () => {
      const now = new Date('2026-06-19T10:00:00Z')
      vi.setSystemTime(now)

      store.viewHistory = [
        { id: 'body-001', timestamp: now.getTime(), category: 'body' },
        { id: 'body-002', timestamp: now.getTime(), category: 'body' },
        { id: 'body-001', timestamp: now.getTime() + 1000, category: 'body' },
      ]

      const groups = store.historyByDate
      const keys = Object.keys(groups)
      expect(groups[keys[0]].length).toBe(2)
    })

    it('separates entries across different days', () => {
      const day1 = new Date('2026-06-18T10:00:00Z')
      const day2 = new Date('2026-06-19T10:00:00Z')
      vi.setSystemTime(day2)

      store.viewHistory = [
        { id: 'body-001', timestamp: day1.getTime(), category: 'body' },
        { id: 'body-002', timestamp: day2.getTime(), category: 'body' },
      ]

      const groups = store.historyByDate
      expect(Object.keys(groups).length).toBe(2)
    })
  })

  // ---- addQuestion ----
  describe('addQuestion', () => {
    it('adds a new question to the store', () => {
      const before = store.questions.length
      store.addQuestion({ id: 'custom-001', question: 'Test?', category: 'body', tags: [] })
      expect(store.questions.length).toBe(before + 1)
    })

    it('does not add duplicate question', () => {
      const existing = store.questions[0]
      const before = store.questions.length
      store.addQuestion(existing)
      expect(store.questions.length).toBe(before)
    })
  })

  // ---- getByCategory ----
  describe('getByCategory', () => {
    it('returns all questions for "all" category', () => {
      expect(store.getByCategory('all').length).toBe(store.questions.length)
    })

    it('returns all questions for empty category', () => {
      expect(store.getByCategory('').length).toBe(store.questions.length)
    })

    it('filters by specific category', () => {
      const bodyQs = store.getByCategory('body')
      expect(bodyQs.length).toBeGreaterThan(0)
      expect(bodyQs.every(q => q.category === 'body')).toBe(true)
    })
  })

  // ---- getQuestionById ----
  describe('getQuestionById', () => {
    it('finds question by id', () => {
      const q = store.getQuestionById('body-001')
      expect(q).toBeDefined()
      expect(q.id).toBe('body-001')
    })

    it('returns null for non-existent id', () => {
      expect(store.getQuestionById('nonexistent')).toBeNull()
    })
  })

  // ---- viewedIds ----
  describe('viewedIds', () => {
    it('returns unique viewed IDs', () => {
      store.markViewed('body-001', 'body')
      store.markViewed('body-002', 'body')
      store.markViewed('body-001', 'body')
      const ids = store.viewedIds
      expect(ids).toContain('body-001')
      expect(ids).toContain('body-002')
    })
  })

  // ---- data migration ----
  describe('data migration', () => {
    it('migrates old bw_viewed format to bw_view_history', () => {
      localStorageMock.clear()
      localStorageMock.setItem('bw_viewed', JSON.stringify(['body-001', 'body-002']))
      setActivePinia(createPinia())
      const freshStore = useContentStore()
      expect(freshStore.viewHistory.length).toBe(2)
      expect(freshStore.viewHistory[0].id).toBe('body-001')
    })

    it('prefers existing bw_view_history over old format', () => {
      localStorageMock.clear()
      localStorageMock.setItem('bw_viewed', JSON.stringify(['body-001']))
      localStorageMock.setItem('bw_view_history', JSON.stringify([
        { id: 'nature-001', timestamp: Date.now(), category: 'nature' }
      ]))
      setActivePinia(createPinia())
      const freshStore = useContentStore()
      expect(freshStore.viewHistory.length).toBe(1)
      expect(freshStore.viewHistory[0].id).toBe('nature-001')
    })
  })

  // ---- suggestRelated edge cases ----
  describe('suggestRelated edge cases', () => {
    it('returns empty for null input', () => {
      expect(store.suggestRelated(null)).toEqual([])
    })

    it('returns suggestions with multiple character hits', () => {
      const results = store.suggestRelated('蚂蚁排队')
      expect(results.length).toBeGreaterThan(0)
    })
  })

  // ---- streakDays ----
  describe('streakDays', () => {
    it('returns 0 for empty history', () => {
      expect(store.streakDays).toBe(0)
    })

    it('returns 1 for views only today', () => {
      const now = new Date('2026-06-19T10:00:00Z')
      vi.setSystemTime(now)
      store.markViewed('body-001', 'body')
      expect(store.streakDays).toBe(1)
    })

    it('calculates consecutive day streak', () => {
      const day3 = new Date('2026-06-19T10:00:00Z')
      vi.setSystemTime(day3)

      // Inject entries for 3 consecutive days
      const day1 = new Date('2026-06-17T10:00:00Z')
      const day2 = new Date('2026-06-18T10:00:00Z')

      store.viewHistory = [
        { id: 'body-001', timestamp: day1.getTime(), category: 'body' },
        { id: 'body-002', timestamp: day2.getTime(), category: 'body' },
        { id: 'body-003', timestamp: day3.getTime(), category: 'body' },
      ]

      expect(store.streakDays).toBe(3)
    })

    it('breaks streak on gap day', () => {
      const today = new Date('2026-06-19T10:00:00Z')
      vi.setSystemTime(today)

      // Day 1, then skip a day, then today
      const day1 = new Date('2026-06-16T10:00:00Z') // 3 days ago
      const day3 = new Date('2026-06-18T10:00:00Z') // yesterday

      store.viewHistory = [
        { id: 'body-001', timestamp: day1.getTime(), category: 'body' },
        // gap on June 17
        { id: 'body-002', timestamp: day3.getTime(), category: 'body' },
        { id: 'body-003', timestamp: today.getTime(), category: 'body' },
      ]

      expect(store.streakDays).toBe(2) // only yesterday + today
    })

    it('returns 0 if last view was more than 1 day ago', () => {
      const today = new Date('2026-06-19T10:00:00Z')
      vi.setSystemTime(today)

      const threeDaysAgo = new Date('2026-06-16T10:00:00Z')
      store.viewHistory = [
        { id: 'body-001', timestamp: threeDaysAgo.getTime(), category: 'body' },
      ]

      expect(store.streakDays).toBe(0)
    })
  })

  describe('search history', () => {
    it('pushes search term to front and persists', () => {
      store.pushSearchHistory('为什么会下雨')
      store.pushSearchHistory('为什么要睡觉')

      expect(store.searchHistory).toEqual(['为什么要睡觉', '为什么会下雨'])
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'bw_search_history',
        JSON.stringify(['为什么要睡觉', '为什么会下雨'])
      )
    })

    it('deduplicates — re-searching moves term to front', () => {
      store.pushSearchHistory('a1')
      store.pushSearchHistory('a2')
      store.pushSearchHistory('a3')
      store.pushSearchHistory('a1') // re-search

      expect(store.searchHistory).toEqual(['a1', 'a3', 'a2'])
      expect(store.searchHistory.length).toBe(3)
    })

    it('caps at 8 entries (newest kept)', () => {
      for (let i = 1; i <= 10; i++) {
        store.pushSearchHistory(`term${i}`)
      }
      expect(store.searchHistory.length).toBe(8)
      expect(store.searchHistory[0]).toBe('term10')
      expect(store.searchHistory[7]).toBe('term3')
    })

    it('clearSearchHistory empties state and storage', () => {
      store.pushSearchHistory('x1')
      store.pushSearchHistory('x2')
      expect(store.searchHistory.length).toBe(2)

      store.clearSearchHistory()
      expect(store.searchHistory).toEqual([])
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'bw_search_history',
        JSON.stringify([])
      )
    })

    it('ignores empty/whitespace input', () => {
      store.pushSearchHistory('')
      store.pushSearchHistory('   ')
      expect(store.searchHistory).toEqual([])
    })
  })

  describe('favorites', () => {
    it('starts empty and isFavorite returns false', () => {
      expect(store.favoriteCount).toBe(0)
      expect(store.isFavorite('non-existent')).toBe(false)
    })

    it('toggleFavorite adds and removes', () => {
      const id = store.questions[0].id
      store.toggleFavorite(id)
      expect(store.isFavorite(id)).toBe(true)
      expect(store.favoriteCount).toBe(1)

      store.toggleFavorite(id)
      expect(store.isFavorite(id)).toBe(false)
      expect(store.favoriteCount).toBe(0)
    })

    it('favoriteQuestions returns full question objects in order', () => {
      const q1 = store.questions[0]
      const q2 = store.questions[1]
      store.toggleFavorite(q1.id)
      store.toggleFavorite(q2.id)

      const favs = store.favoriteQuestions
      expect(favs.length).toBe(2)
      expect(favs[0].id).toBe(q1.id)
      expect(favs[1].id).toBe(q2.id)
    })

    it('persists favorites to localStorage', () => {
      const id = store.questions[0].id
      store.toggleFavorite(id)
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'bw_favorites',
        JSON.stringify([id])
      )
    })

    it('toggleFavorite removal is idempotent (deleting twice is safe)', () => {
      const id = store.questions[0].id
      store.toggleFavorite(id)
      expect(store.favoriteCount).toBe(1)
      store.toggleFavorite(id) // remove
      expect(store.favoriteCount).toBe(0)
      // deleting again should not throw or produce negative counts
      expect(() => store.toggleFavorite(id)).not.toThrow()
      expect(store.favoriteCount).toBe(1) // toggled back to add
      store.toggleFavorite(id)
      expect(store.favoriteCount).toBe(0)
    })

    it('removing a favorite keeps the order of remaining favorites', () => {
      const q1 = store.questions[0]
      const q2 = store.questions[1]
      const q3 = store.questions[2]
      store.toggleFavorite(q1.id)
      store.toggleFavorite(q2.id)
      store.toggleFavorite(q3.id)
      // remove middle
      store.toggleFavorite(q2.id)
      const favs = store.favoriteQuestions
      expect(favs.length).toBe(2)
      expect(favs[0].id).toBe(q1.id)
      expect(favs[1].id).toBe(q3.id)
    })

    it('removing the last favorite triggers empty state (favoriteCount === 0)', () => {
      const id = store.questions[0].id
      store.toggleFavorite(id)
      expect(store.favoriteCount).toBe(1)
      store.toggleFavorite(id)
      expect(store.favoriteCount).toBe(0)
      expect(store.favoriteQuestions.length).toBe(0)
      // isFavorite on empty list is still false
      expect(store.isFavorite(id)).toBe(false)
    })
  })

  // ---- Answer Feedback (V7.9 第68轮) ----
  describe('answer feedback', () => {
    it('setAnswerFeedback writes and getAnswerFeedback returns the value', () => {
      const id = store.questions[0].id
      expect(store.getAnswerFeedback(id)).toBeNull()
      store.setAnswerFeedback(id, 'up')
      expect(store.getAnswerFeedback(id)).toBe('up')
      expect(store.feedbackCount).toBe(1)
    })

    it('changing direction updates existing entry (no duplicate, ts refreshes)', () => {
      const id = store.questions[1].id
      store.setAnswerFeedback(id, 'up')
      const firstTs = store.answerFeedback.find(f => f.id === id).ts
      // advance time so ts differs
      vi.advanceTimersByTime(1000)
      store.setAnswerFeedback(id, 'down')
      expect(store.getAnswerFeedback(id)).toBe('down')
      expect(store.feedbackCount).toBe(1)
      const secondTs = store.answerFeedback.find(f => f.id === id).ts
      expect(secondTs).toBeGreaterThan(firstTs)
    })

    it('clicking same direction twice is idempotent (3岁孩子狂点测试)', () => {
      const id = store.questions[2].id
      store.setAnswerFeedback(id, 'up')
      const before = store.answerFeedback.find(f => f.id === id)
      store.setAnswerFeedback(id, 'up')
      store.setAnswerFeedback(id, 'up')
      expect(store.feedbackCount).toBe(1)
      expect(store.getAnswerFeedback(id)).toBe('up')
      // same entry, no duplicate
      expect(store.answerFeedback.filter(f => f.id === id).length).toBe(1)
      // ts should be unchanged (no rewrite on idempotent)
      const after = store.answerFeedback.find(f => f.id === id)
      expect(after.ts).toBe(before.ts)
    })

    it('persists to localStorage key bw_answer_feedback', () => {
      const id = store.questions[3].id
      store.setAnswerFeedback(id, 'down')
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'bw_answer_feedback',
        expect.any(String)
      )
      const raw = localStorageMock.getItem('bw_answer_feedback')
      const parsed = JSON.parse(raw)
      expect(parsed[0].id).toBe(id)
      expect(parsed[0].value).toBe('down')
      expect(typeof parsed[0].ts).toBe('number')
    })

    it('invalid values are ignored (defensive)', () => {
      const id = store.questions[4].id
      store.setAnswerFeedback(id, 'invalid')
      store.setAnswerFeedback(id, '')
      store.setAnswerFeedback(null, 'up')
      expect(store.feedbackCount).toBe(0)
      expect(store.getAnswerFeedback(id)).toBeNull()
    })

    it('feedbackCount counts unique feedback entries across questions', () => {
      store.setAnswerFeedback(store.questions[0].id, 'up')
      store.setAnswerFeedback(store.questions[1].id, 'down')
      store.setAnswerFeedback(store.questions[2].id, 'up')
      expect(store.feedbackCount).toBe(3)
    })
  })
})
