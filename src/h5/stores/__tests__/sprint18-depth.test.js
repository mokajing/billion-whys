import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useContentStore } from '../content.js'

// V8.9 第77轮 Sprint 18：反馈深度归因 — feedbackLog entry 携带 depth 字段（1/2/3）
// Why: V8.6 北极星漏斗闭环后下一步"可分层归因" — depth=3+👍 是深度学习信号，depth=3+👎 是内容质量强信号
// How to apply: setAnswerFeedback(id, value, depth) / clearAnswerFeedback(id, depth) 写入；
//                feedbackDetailByDate 返回项含 depth；feedbackDepthByDate 返回 {L1,L2,L3,total}

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

// 模拟 QuestionDetail.vue onFeedback 的 depth 推导逻辑
// showDeeper=false → 1；showDeeper=true 且有 layer3 → 3；仅 layer2 → 2
function computeDepth(showDeeper, question) {
  if (!showDeeper) return 1
  if (question?.layer3) return 3
  if (question?.layer2) return 2
  return 1
}

describe('Sprint 18 · 反馈深度归因数据层', () => {
  let content

  beforeEach(async () => {
    setActivePinia(createPinia())
    localStorageMock.clear()
    vi.useFakeTimers()
    content = useContentStore()
    await content.init()
  })

  afterEach(() => { vi.useRealTimers() })

  it('setAnswerFeedback 携带 depth=3 写入 feedbackLog entry', () => {
    content.setAnswerFeedback('body-001', 'up', 3)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const detail = content.feedbackDetailByDate(key)
    expect(detail).toHaveLength(1)
    expect(detail[0].depth).toBe(3)
    expect(detail[0].action).toBe('up')
    expect(detail[0].id).toBe('body-001')
  })

  it('未传 depth 时默认为 1（向后兼容老调用方）', () => {
    content.setAnswerFeedback('body-002', 'up')
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const detail = content.feedbackDetailByDate(key)
    expect(detail[0].depth).toBe(1)
  })

  it('reset 也携带 depth 字段（保持 schema 一致）', () => {
    content.setAnswerFeedback('body-003', 'up', 2)
    content.clearAnswerFeedback('body-003', 2)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const detail = content.feedbackDetailByDate(key)
    expect(detail).toHaveLength(2)
    const resetEntry = detail.find(x => x.action === 'reset')
    expect(resetEntry.depth).toBe(2)
  })

  it('computeDepth 推导：showDeeper=false → depth=1', () => {
    expect(computeDepth(false, { layer2: {}, layer3: {} })).toBe(1)
  })

  it('computeDepth 推导：showDeeper=true + layer3 → depth=3', () => {
    expect(computeDepth(true, { layer2: {}, layer3: {} })).toBe(3)
  })

  it('computeDepth 推导：showDeeper=true + 仅 layer2 → depth=2', () => {
    expect(computeDepth(true, { layer2: {}, layer3: null })).toBe(2)
  })

  it('feedbackDepthByDate 返回 {L1,L2,L3,total} 分布', () => {
    content.setAnswerFeedback('body-001', 'up', 1)
    content.setAnswerFeedback('body-002', 'up', 2)
    content.setAnswerFeedback('body-003', 'up', 3)
    content.setAnswerFeedback('body-004', 'down', 3)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const dist = content.feedbackDepthByDate(key)
    expect(dist.L1).toBe(1)
    expect(dist.L2).toBe(1)
    expect(dist.L3).toBe(2)
    expect(dist.total).toBe(4)
  })

  it('老 entry 无 depth 字段时归入 L1（向后兼容）', () => {
    // 直接 push 一个无 depth 的老 entry 模拟 V8.6 数据
    content.feedbackLog.push({ action: 'up', ts: Date.now(), id: 'body-005' })
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const detail = content.feedbackDetailByDate(key)
    expect(detail[detail.length - 1].depth).toBe(1)
    const dist = content.feedbackDepthByDate(key)
    expect(dist.L1).toBeGreaterThanOrEqual(1)
  })

  it('feedbackDepthByDate 空日期返回全零', () => {
    const dist = content.feedbackDepthByDate('2030-01-01')
    expect(dist).toEqual({ L1: 0, L2: 0, L3: 0, total: 0 })
  })

  it('空字符串 dateStr feedbackDepthByDate 返回全零（边界防御）', () => {
    expect(content.feedbackDepthByDate('')).toEqual({ L1: 0, L2: 0, L3: 0, total: 0 })
    expect(content.feedbackDetailByDate('')).toEqual([])
  })

  it('depth=3 + 👎 组合可作为内容质量强信号（数据可观测性）', () => {
    content.setAnswerFeedback('body-006', 'down', 3)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const detail = content.feedbackDetailByDate(key)
    const downDeepEntry = detail.find(x => x.action === 'down' && x.depth === 3)
    expect(downDeepEntry).toBeDefined()
    expect(downDeepEntry.id).toBe('body-006')
  })
})
