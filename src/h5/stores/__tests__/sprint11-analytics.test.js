import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAnalyticsStore } from '../analytics'

// V8.2 第71轮 Sprint 11：反馈/CTA/分层展开 埋点行为测试
// 验证 H5 QuestionDetail.vue 三处 trackEvent 调用契约
// （不 mount 整页，只测 store 行为；MP 同名同结构由 build 时手工核对）

describe('Sprint 11 · 反馈/CTA/分层展开 埋点', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('feedback_up 事件入队且 detail 为 questionId', () => {
    const store = useAnalyticsStore()
    store.trackEvent('feedback_up', 'body-001')
    const events = store.todayStats.events
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ name: 'feedback_up', detail: 'body-001' })
    expect(typeof events[0].ts).toBe('number')
  })

  it('feedback_down 事件入队且 detail 为 questionId', () => {
    const store = useAnalyticsStore()
    store.trackEvent('feedback_down', 'nature-007')
    expect(store.todayStats.events[0]).toMatchObject({
      name: 'feedback_down',
      detail: 'nature-007',
    })
  })

  it('cta_experiment 事件入队 — 闭合 反馈→CTA→实验 漏斗', () => {
    const store = useAnalyticsStore()
    store.trackEvent('cta_experiment', 'food-003')
    expect(store.todayStats.events[0].name).toBe('cta_experiment')
    expect(store.todayStats.events[0].detail).toBe('food-003')
  })

  it('layer_expand 事件入队 — 追踪 Layer2/3 展开动作', () => {
    const store = useAnalyticsStore()
    store.trackEvent('layer_expand', 'animals-042')
    expect(store.todayStats.events[0]).toMatchObject({
      name: 'layer_expand',
      detail: 'animals-042',
    })
  })

  it('完整漏斗：feedback_up → cta_experiment → layer_expand 按序入队', () => {
    const store = useAnalyticsStore()
    store.trackEvent('feedback_up', 'food-001')
    store.trackEvent('cta_experiment', 'food-001')
    store.trackEvent('layer_expand', 'food-001')
    const names = store.todayStats.events.map(e => e.name)
    expect(names).toEqual(['feedback_up', 'cta_experiment', 'layer_expand'])
    // 全部 detail 一致（同一 questionId）
    const details = store.todayStats.events.map(e => e.detail)
    expect(new Set(details).size).toBe(1)
  })

  it('detail 字段不包含 question 文本（安全李姐要求：避免反向泄露）', () => {
    const store = useAnalyticsStore()
    store.trackEvent('feedback_up', 'body-001')
    const detail = store.todayStats.events[0].detail
    expect(detail).not.toMatch(/[一-龥]/) // 不含中文字符（questionId 是 ascii）
  })

  it('多 questionId 反馈独立追踪', () => {
    const store = useAnalyticsStore()
    store.trackEvent('feedback_up', 'body-001')
    store.trackEvent('feedback_up', 'body-002')
    store.trackEvent('feedback_down', 'body-003')
    const upIds = store.todayStats.events
      .filter(e => e.name === 'feedback_up')
      .map(e => e.detail)
    expect(upIds).toEqual(['body-001', 'body-002'])
    const downIds = store.todayStats.events
      .filter(e => e.name === 'feedback_down')
      .map(e => e.detail)
    expect(downIds).toEqual(['body-003'])
  })

  it('事件持久化到 localStorage（visibilitychange hidden 触发 flush）', () => {
    const store = useAnalyticsStore()
    store.trackEvent('feedback_up', 'body-001')
    // 强制同步 flush（模拟页面隐藏）
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    document.dispatchEvent(new Event('visibilitychange'))
    const raw = JSON.parse(localStorage.getItem('bw_analytics'))
    const today = new Date().toISOString().slice(0, 10)
    expect(raw[today].events).toHaveLength(1)
    expect(raw[today].events[0].name).toBe('feedback_up')
  })
})
