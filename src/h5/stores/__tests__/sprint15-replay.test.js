import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useContentStore } from '../content.js'
import { useAnalyticsStore } from '../analytics.js'

// V8.6 第74轮 Sprint 15：当日明细列表项"再读一遍"跳转
// 验证：detail entry 的 id 字段可用于区分"可跳转/不可跳转" + analytics 记录 feedback_detail_replay 事件
// Why: 北极星漏斗最后1步闭环（CEO周远见）；UX 苏体验：无 id 项不渲染跳转避免误导

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

// 模拟 onReplayDetail 的核心逻辑（Profile.vue 中由 router.push + analytics.trackEvent 组成）
// 这里只验证数据层：entry.id 决定是否可跳转 + analytics 是否记录事件
function shouldReplay(entry) {
  return !!(entry && entry.id)
}

describe('Sprint 15 · 当日明细"再读一遍"跳转数据层', () => {
  let content
  let analytics

  beforeEach(async () => {
    setActivePinia(createPinia())
    localStorageMock.clear()
    vi.useFakeTimers()
    content = useContentStore()
    analytics = useAnalyticsStore()
    await content.init()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('新 entry（setAnswerFeedback 后）detail 项含 id，shouldReplay=true（可跳转）', () => {
    content.setAnswerFeedback('food-001', 'up')
    const trend = content.feedbackTrend7d
    const detail = content.feedbackDetailByDate(trend[6].date)
    expect(detail).toHaveLength(1)
    expect(detail[0].id).toBe('food-001')
    expect(shouldReplay(detail[0])).toBe(true)
  })

  it('老 V8.4 entry（无 id）detail 项 id 为 null，shouldReplay=false（不跳转）', async () => {
    // 模拟 V8.4 时代老数据
    localStorageMock.setItem('bw_feedback_log', JSON.stringify([
      { action: 'up', ts: Date.now() - 1000 },
    ]))
    setActivePinia(createPinia())
    const fresh = useContentStore()
    await fresh.init()
    const trend = fresh.feedbackTrend7d
    const detail = fresh.feedbackDetailByDate(trend[6].date)
    expect(detail).toHaveLength(1)
    // content.js feedbackDetailByDate 将无 id entry 规范化为 id: null（向后兼容）
    expect(detail[0].id).toBeNull()
    expect(shouldReplay(detail[0])).toBe(false)
  })

  it('reset entry 也含 id，可跳转（再评后也能再读）', () => {
    content.setAnswerFeedback('body-001', 'up')
    content.clearAnswerFeedback('body-001')
    const trend = content.feedbackTrend7d
    const detail = content.feedbackDetailByDate(trend[6].date)
    // set + reset 两条 entry
    expect(detail).toHaveLength(2)
    const resetEntry = detail.find(d => d.action === 'reset')
    expect(resetEntry).toBeDefined()
    expect(resetEntry.id).toBe('body-001')
    expect(shouldReplay(resetEntry)).toBe(true)
  })

  it('analytics.trackEvent("feedback_detail_replay", id) 被正确记录', () => {
    const id = 'nature-007'
    analytics.trackEvent('feedback_detail_replay', id)
    const today = new Date().toISOString().slice(0, 10)
    const events = analytics.data[today]?.events || []
    const evt = events.find(e => e.name === 'feedback_detail_replay')
    expect(evt).toBeDefined()
    expect(evt.detail).toBe(id)
    expect(typeof evt.ts).toBe('number')
  })

  it('无 id 项点击：trackEvent 不应被调用（行为契约）', () => {
    // 模拟 UI 层判断：item.id 为假值时不触发 trackEvent
    const entryNoId = { action: 'up', ts: Date.now(), id: undefined }
    if (shouldReplay(entryNoId)) {
      analytics.trackEvent('feedback_detail_replay', entryNoId.id)
    }
    const today = new Date().toISOString().slice(0, 10)
    const events = analytics.data[today]?.events || []
    const evt = events.find(e => e.name === 'feedback_detail_replay')
    expect(evt).toBeUndefined()
  })

  it('有 id 项点击：trackEvent 被调用且 detail 携带 questionId', () => {
    const entry = { action: 'up', ts: Date.now(), id: 'animals-003' }
    if (shouldReplay(entry)) {
      analytics.trackEvent('feedback_detail_replay', entry.id)
    }
    const today = new Date().toISOString().slice(0, 10)
    const events = analytics.data[today]?.events || []
    const evt = events.find(e => e.name === 'feedback_detail_replay')
    expect(evt).toBeDefined()
    expect(evt.detail).toBe('animals-003')
  })

  it('空字符串 id 视为不可跳转（防御边界）', () => {
    const entry = { action: 'up', ts: Date.now(), id: '' }
    expect(shouldReplay(entry)).toBe(false)
  })

  it('null entry 安全返回 false（防御边界）', () => {
    expect(shouldReplay(null)).toBe(false)
    expect(shouldReplay(undefined)).toBe(false)
    expect(shouldReplay({})).toBe(false)
  })

  it('detail 列表混合（有 id + 无 id）：UI 可分别渲染 clickable/disabled', async () => {
    // 一条新 entry 带 id
    content.setAnswerFeedback('food-001', 'up')
    // 一条老 entry 无 id，直接 push 到 feedbackLog
    content.feedbackLog.push({ action: 'down', ts: Date.now() - 500 })
    const trend = content.feedbackTrend7d
    const detail = content.feedbackDetailByDate(trend[6].date)
    expect(detail).toHaveLength(2)
    const clickable = detail.filter(shouldReplay)
    const disabled = detail.filter(d => !shouldReplay(d))
    expect(clickable).toHaveLength(1)
    expect(disabled).toHaveLength(1)
    expect(clickable[0].id).toBe('food-001')
    expect(disabled[0].id).toBeNull()
  })

  it('跳转用的 id 是 questionId 不是儿童身份（法务张律放行契约）', () => {
    content.setAnswerFeedback('body-001', 'up')
    const trend = content.feedbackTrend7d
    const detail = content.feedbackDetailByDate(trend[6].date)
    const id = detail[0].id
    // questionId 形如 category-NNN，非个人身份
    expect(typeof id).toBe('string')
    expect(id).toMatch(/^[a-z]+-\d+$/)
    // 不应包含任何个人信息字段
    expect(id).not.toMatch(/user|phone|name|email|idcard/i)
  })
})
