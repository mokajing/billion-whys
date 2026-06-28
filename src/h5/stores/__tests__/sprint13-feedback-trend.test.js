import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useContentStore } from '../content.js'

// V8.4 第72轮 Sprint 13：7 天反馈趋势可视化
// 验证 feedbackLog append-only / 幂等不入流水 / cap 200 / 90 天 prune / trend7d 结构

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

describe('Sprint 13 · feedbackLog 行动流水 + feedbackTrend7d', () => {
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

  it('setAnswerFeedback(up) → feedbackLog 入一条 up', () => {
    store.setAnswerFeedback('food-001', 'up')
    expect(store.feedbackLog).toHaveLength(1)
    expect(store.feedbackLog[0].action).toBe('up')
    expect(typeof store.feedbackLog[0].ts).toBe('number')
  })

  it('同方向重复点幂等：不入流水（测试虫虫要求）', () => {
    store.setAnswerFeedback('food-001', 'up')
    store.setAnswerFeedback('food-001', 'up') // 幂等
    store.setAnswerFeedback('food-001', 'up') // 幂等
    expect(store.feedbackLog).toHaveLength(1)
  })

  it('切换方向 up→down：入流水 down', () => {
    store.setAnswerFeedback('food-001', 'up')
    store.setAnswerFeedback('food-001', 'down')
    expect(store.feedbackLog).toHaveLength(2)
    expect(store.feedbackLog[1].action).toBe('down')
  })

  it('clearAnswerFeedback：入流水 reset', () => {
    store.setAnswerFeedback('food-001', 'up')
    store.clearAnswerFeedback('food-001')
    expect(store.feedbackLog).toHaveLength(2)
    expect(store.feedbackLog[1].action).toBe('reset')
  })

  it('feedbackTrend7d 返回 7 条，结构正确，今天在末尾', () => {
    store.setAnswerFeedback('food-001', 'up')
    const trend = store.feedbackTrend7d
    expect(trend).toHaveLength(7)
    const last = trend[6]
    const today = new Date().toISOString().slice(0, 10)
    expect(last.date).toBe(today)
    expect(last.up).toBe(1)
    expect(last.total).toBe(1)
    // 前面 6 天全 0
    expect(trend[0].total).toBe(0)
  })

  it('feedbackTrend7d 三色分离：up/down/reset 各自累计', () => {
    store.setAnswerFeedback('food-001', 'up')
    store.setAnswerFeedback('food-002', 'down')
    store.clearAnswerFeedback('food-001')
    const today = store.feedbackTrend7d[6]
    expect(today.up).toBe(1)
    expect(today.down).toBe(1)
    expect(today.reset).toBe(1)
    expect(today.total).toBe(3)
  })

  it('cap 200：超过 200 条自动截断保留最新 200 条', () => {
    for (let i = 0; i < 210; i++) {
      store.setAnswerFeedback('food-' + i, 'up')
    }
    expect(store.feedbackLog.length).toBeLessThanOrEqual(200)
    // 最新一条仍保留
    expect(store.feedbackLog[store.feedbackLog.length - 1].action).toBe('up')
  })

  it('90 天前的事件被 prune 不计入 trend', () => {
    // 手动塞一条 100 天前的事件
    const old = Date.now() - 100 * 86400000
    store.feedbackLog.push({ action: 'up', ts: old })
    // 触发 state 变更以让 pinia reactivity 更新
    store.feedbackLog = [...store.feedbackLog]
    const total = store.feedbackTrend7d.reduce((s, d) => s + d.total, 0)
    expect(total).toBe(0)
  })
})
