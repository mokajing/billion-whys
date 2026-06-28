import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useContentStore } from '../content.js'
import { useAnalyticsStore } from '../analytics.js'

// V8.3 第71轮 Sprint 12：再评一次 CTA 行为测试
// 验证 clearAnswerFeedback + resetFeedback 埋点 feedback_reset

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

describe('Sprint 12 · 再评一次 CTA — clearAnswerFeedback', () => {
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

  it('已反馈 question 调用 clearAnswerFeedback 后 getAnswerFeedback 返回 null', () => {
    store.setAnswerFeedback('food-001', 'up')
    expect(store.getAnswerFeedback('food-001')).toBe('up')
    store.clearAnswerFeedback('food-001')
    expect(store.getAnswerFeedback('food-001')).toBeNull()
  })

  it('清除后 feedbackCount 同步减少（闭合反馈率北极星指标）', () => {
    store.setAnswerFeedback('food-001', 'up')
    store.setAnswerFeedback('food-002', 'down')
    expect(store.feedbackCount).toBe(2)
    store.clearAnswerFeedback('food-001')
    expect(store.feedbackCount).toBe(1)
    store.clearAnswerFeedback('food-002')
    expect(store.feedbackCount).toBe(0)
  })

  it('清除后可重新反馈（后悔药闭合：先 up→清除→改 down）', () => {
    store.setAnswerFeedback('food-001', 'up')
    expect(store.getAnswerFeedback('food-001')).toBe('up')
    store.clearAnswerFeedback('food-001')
    // 妈妈重新选择 down
    store.setAnswerFeedback('food-001', 'down')
    expect(store.getAnswerFeedback('food-001')).toBe('down')
  })

  it('清除不存在的 questionId 是幂等的（不报错、不影响其他记录）', () => {
    store.setAnswerFeedback('food-001', 'up')
    store.clearAnswerFeedback('non-existent-id')
    expect(store.getAnswerFeedback('food-001')).toBe('up')
    expect(store.feedbackCount).toBe(1)
  })

  it('清除空 id 直接返回，不做任何 storage 写入（防御）', () => {
    store.setAnswerFeedback('food-001', 'up')
    const before = localStorageMock.setItem.mock.calls.length
    store.clearAnswerFeedback('')
    store.clearAnswerFeedback(null)
    store.clearAnswerFeedback(undefined)
    // 没有触发新增的 storage 写入
    expect(localStorageMock.setItem.mock.calls.length).toBe(before)
    expect(store.feedbackCount).toBe(1)
  })

  it('清除后 localStorage 持久化（页面刷新后仍保持已清除状态）', () => {
    store.setAnswerFeedback('food-001', 'up')
    expect(localStorageMock.getItem('bw_answer_feedback')).toContain('food-001')
    store.clearAnswerFeedback('food-001')
    const persisted = JSON.parse(localStorageMock.getItem('bw_answer_feedback') || '[]')
    expect(persisted.find(f => f.id === 'food-001')).toBeUndefined()
  })

  it('重置埋点 feedback_reset 入队 analytics store（detail 仅 questionId，无儿童身份）', () => {
    const analytics = useAnalyticsStore()
    analytics.trackPageView('/question/food-001')
    // 模拟 resetFeedback() 调用
    store.setAnswerFeedback('food-001', 'up')
    store.clearAnswerFeedback('food-001')
    analytics.trackEvent('feedback_reset', 'food-001')
    const events = analytics.todayStats.events
    const resetEvent = events.find(e => e.name === 'feedback_reset')
    expect(resetEvent).toBeDefined()
    expect(resetEvent.detail).toBe('food-001')
    // detail 不包含 question 文本（安全李姐要求）
    expect(resetEvent.detail).not.toMatch(/为什么|什么/)
  })

  it('反复重置同一 questionId 累积多次 feedback_reset 事件（AI小智：内容质量强信号）', () => {
    const analytics = useAnalyticsStore()
    analytics.trackPageView('/question/food-001')
    for (let i = 0; i < 3; i++) {
      store.setAnswerFeedback('food-001', 'up')
      store.clearAnswerFeedback('food-001')
      analytics.trackEvent('feedback_reset', 'food-001')
    }
    const resets = analytics.todayStats.events.filter(e => e.name === 'feedback_reset')
    expect(resets.length).toBe(3)
  })
})
