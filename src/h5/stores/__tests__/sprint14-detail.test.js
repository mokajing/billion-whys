import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useContentStore } from '../content.js'

// V8.5 第73轮 Sprint 14：feedbackLog entry 携带 id + feedbackDetailByDate 每日明细
// 验证：log entry.id / 老 entry 无 id 向后兼容 / detailByDate 倒序 / 跨日不串 / 空 / 无效入参

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

describe('Sprint 14 · feedbackLog entry.id + feedbackDetailByDate', () => {
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

  it('setAnswerFeedback(up) → feedbackLog entry 含 id 字段', () => {
    store.setAnswerFeedback('food-001', 'up')
    expect(store.feedbackLog).toHaveLength(1)
    expect(store.feedbackLog[0].id).toBe('food-001')
    expect(store.feedbackLog[0].action).toBe('up')
    expect(typeof store.feedbackLog[0].ts).toBe('number')
  })

  it('clearAnswerFeedback → reset entry 含 id 字段', () => {
    store.setAnswerFeedback('food-002', 'up')
    store.clearAnswerFeedback('food-002')
    const resetEntry = store.feedbackLog.find(e => e.action === 'reset')
    expect(resetEntry).toBeDefined()
    expect(resetEntry.id).toBe('food-002')
  })

  it('老 entry 无 id 字段：loadFeedbackLog 不报错（AI 小智向后兼容）', async () => {
    // 模拟 V8.4 时代老数据
    localStorageMock.setItem('bw_feedback_log', JSON.stringify([
      { action: 'up', ts: Date.now() - 1000 },
      { action: 'reset', ts: Date.now() - 500 },
    ]))
    setActivePinia(createPinia())
    const fresh = useContentStore()
    await fresh.init()
    expect(fresh.feedbackLog).toHaveLength(2)
    // 老 entry 没有 id 字段
    expect(fresh.feedbackLog[0].id).toBeUndefined()
    expect(fresh.feedbackLog[1].id).toBeUndefined()
  })

  it('feedbackDetailByDate(今天) 返回当日 entries 倒序', () => {
    // 同一天三条 entry
    const now = Date.now()
    vi.setSystemTime(now)
    store.setAnswerFeedback('food-001', 'up')
    vi.setSystemTime(now + 1000)
    store.setAnswerFeedback('food-002', 'down')
    vi.setSystemTime(now + 2000)
    store.clearAnswerFeedback('food-001')
    // 从 trend7d 取今天日期 label，保证与分桶逻辑同源（避免 UTC/本地时区不对称）
    const trend = store.feedbackTrend7d
    const todayLabel = trend[6].date
    const detail = store.feedbackDetailByDate(todayLabel)
    expect(detail).toHaveLength(3)
    // 倒序：最新在前
    expect(detail[0].action).toBe('reset')
    expect(detail[0].id).toBe('food-001')
    expect(detail[1].action).toBe('down')
    expect(detail[2].action).toBe('up')
    // 时间倒序
    expect(detail[0].ts).toBeGreaterThan(detail[1].ts)
    expect(detail[1].ts).toBeGreaterThan(detail[2].ts)
  })

  it('feedbackDetailByDate 跨日不串：只返回指定日', () => {
    const now = Date.now()
    vi.setSystemTime(now)
    store.setAnswerFeedback('food-001', 'up') // 今天
    // 推入 3 天前 entry（直接操作 feedbackLog 模拟历史数据）
    const threeDaysAgo = now - 3 * 86400000
    store.feedbackLog.push({ action: 'up', ts: threeDaysAgo, id: 'food-old' })
    // trend[6]=今天, trend[3]=3 天前
    const trend = store.feedbackTrend7d
    const todayDetail = store.feedbackDetailByDate(trend[6].date)
    expect(todayDetail).toHaveLength(1)
    expect(todayDetail[0].id).toBe('food-001')
    const oldDetail = store.feedbackDetailByDate(trend[3].date)
    expect(oldDetail).toHaveLength(1)
    expect(oldDetail[0].id).toBe('food-old')
  })

  it('feedbackDetailByDate 返回的 title 来自 questionMap（已加载问题）', () => {
    store.setAnswerFeedback('body-001', 'up')
    const trend = store.feedbackTrend7d
    const detail = store.feedbackDetailByDate(trend[6].date)
    expect(detail).toHaveLength(1)
    // title 来自 questionMap（body-001 在 seed library）
    expect(typeof detail[0].title).toBe('string')
    expect(detail[0].title.length).toBeGreaterThan(0)
  })

  it('feedbackDetailByDate(空字符串) 返回空数组', () => {
    expect(store.feedbackDetailByDate('')).toEqual([])
  })

  it('feedbackDetailByDate(无效日期) 返回空数组', () => {
    expect(store.feedbackDetailByDate('not-a-date')).toEqual([])
  })

  it('feedbackDetailByDate(7 天窗口外日期) 返回空数组', () => {
    // 30 天前的日期 label 不在 7 天窗口内
    const old = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    expect(store.feedbackDetailByDate(old)).toEqual([])
  })

  it('cap 200 截断后 entry 仍含 id 字段', () => {
    for (let i = 0; i < 220; i++) {
      store.setAnswerFeedback(`food-${i}`, 'up')
    }
    expect(store.feedbackLog).toHaveLength(200) // cap 200
    // 最新的 200 条都含 id
    for (const e of store.feedbackLog) {
      expect(e.id).toBeDefined()
    }
    // 最新一条是 food-219
    expect(store.feedbackLog[199].id).toBe('food-219')
  })
})
