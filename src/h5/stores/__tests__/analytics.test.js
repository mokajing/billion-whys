import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAnalyticsStore } from '../analytics'

describe('Analytics Store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('initializes with UV=1 on first visit', () => {
    const store = useAnalyticsStore()
    expect(store.todayStats.uv).toBe(1)
    expect(store.todayStats.pv).toBe(0)
    expect(store.isNewSession).toBe(true)
  })

  it('tracks page views', () => {
    const store = useAnalyticsStore()
    store.trackPageView('/')
    store.trackPageView('/ask')
    store.trackPageView('/question/body-001')
    expect(store.todayStats.pv).toBe(3)
  })

  it('persists data to localStorage', () => {
    const store = useAnalyticsStore()
    store.trackPageView('/')
    vi.advanceTimersByTime(600)
    const raw = JSON.parse(localStorage.getItem('bw_analytics'))
    const today = new Date().toISOString().slice(0, 10)
    expect(raw[today].pv).toBe(1)
  })

  it('tracks events with name and detail', () => {
    const store = useAnalyticsStore()
    store.trackEvent('search', 'why sky blue')
    expect(store.todayStats.events).toHaveLength(1)
    expect(store.todayStats.events[0].name).toBe('search')
    expect(store.todayStats.events[0].detail).toBe('why sky blue')
  })

  it('caps events at 200 per day', () => {
    const store = useAnalyticsStore()
    for (let i = 0; i < 210; i++) {
      store.trackEvent('test', `event-${i}`)
    }
    expect(store.todayStats.events.length).toBeLessThanOrEqual(200)
  })

  it('totalDays counts unique days', () => {
    const store = useAnalyticsStore()
    store.trackPageView('/')
    expect(store.totalDays).toBeGreaterThanOrEqual(1)
  })

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem('bw_analytics', 'invalid-json')
    const store = useAnalyticsStore()
    expect(store.todayStats.uv).toBe(1)
  })

  it('preserves existing UV on returning visit', () => {
    const today = new Date().toISOString().slice(0, 10)
    localStorage.setItem('bw_analytics', JSON.stringify({
      [today]: { uv: 1, pv: 5, events: [] }
    }))
    const store = useAnalyticsStore()
    expect(store.isNewSession).toBe(false)
    expect(store.todayStats.uv).toBe(1)
    expect(store.todayStats.pv).toBe(5)
  })

  it('recovers UV when existing day data has uv=0', () => {
    const today = new Date().toISOString().slice(0, 10)
    localStorage.setItem('bw_analytics', JSON.stringify({
      [today]: { uv: 0, pv: 3, events: [] }
    }))
    const store = useAnalyticsStore()
    expect(store.todayStats.uv).toBe(1)
  })

  it('trackPageView initializes day data if missing', () => {
    const store = useAnalyticsStore()
    store.data = {}
    store.trackPageView('/')
    const today = new Date().toISOString().slice(0, 10)
    expect(store.data[today].pv).toBe(1)
    expect(store.data[today].uv).toBe(1)
  })

  it('trackEvent initializes day data if missing', () => {
    const store = useAnalyticsStore()
    store.data = {}
    store.trackEvent('search', 'test')
    const today = new Date().toISOString().slice(0, 10)
    expect(store.data[today].events).toHaveLength(1)
    expect(store.data[today].uv).toBe(1)
  })

  it('trackEvent uses empty string as default detail', () => {
    const store = useAnalyticsStore()
    store.trackEvent('click')
    expect(store.todayStats.events[0].detail).toBe('')
  })

  it('todayStats returns default when no data for today', () => {
    const store = useAnalyticsStore()
    store.data = {}
    expect(store.todayStats).toEqual({ uv: 0, pv: 0, events: [] })
  })
})
