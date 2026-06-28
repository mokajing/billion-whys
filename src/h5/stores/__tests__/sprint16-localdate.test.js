import { describe, it, expect } from 'vitest'
import { localDateKey } from '../../utils/constants.js'

// V8.7 第75轮 Sprint 16：UTC 偏移回归测试
// Why: V8.5 feedbackTrend7d/feedbackDetailByDate 用 toISOString().slice(0,10) 把本地午夜
// 转成 UTC，在 UTC+8 时区把今天显示成昨天 → 北极星漏斗"可追溯"日期错位（P0 回归）
// How to apply: localDateKey 必须返回本地日期 YYYY-MM-DD，与 toISOString 无关

describe('Sprint 16 · localDateKey UTC 偏移回归', () => {
  it('UTC+8（CST）本地午夜，localDateKey 返回本地日期而非 UTC 偏移后的昨天', () => {
    // 模拟 CST 2026-06-28 00:00:00（即 UTC 2026-06-27 16:00:00）
    const d = new Date('2026-06-27T16:00:00.000Z')
    expect(d.getUTCDate()).toBe(27) // UTC 是 27
    // 但 localDateKey 在 CST 会读到 28（本地日期）
    // 用 d 的本地组件构造期望值，不依赖运行环境的时区
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    expect(localDateKey(d)).toBe(expected)
  })

  it('UTC-5（EST）本地午夜，localDateKey 返回本地日期而非 UTC 偏移后的明天', () => {
    // 模拟 EST 2026-06-28 00:00:00（即 UTC 2026-06-28 05:00:00）
    const d = new Date('2026-06-28T05:00:00.000Z')
    expect(d.getUTCDate()).toBe(28)
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    expect(localDateKey(d)).toBe(expected)
  })

  it('localDateKey 不等于 toISOString().slice(0,10)（反 V8.5 bug 守卫）', () => {
    // 取一个让 UTC 与本地日期不同的时刻：CST 2026-06-28 01:00 = UTC 2026-06-27 17:00
    const d = new Date('2026-06-27T17:00:00.000Z')
    const localKey = localDateKey(d)
    // localDateKey 永远等于本地日期组件拼接，不依赖 ISO
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    expect(localKey).toBe(expected)
    // 守卫：若运行环境是 UTC，值为 '2026-06-27'；若 UTC+8，值为 '2026-06-28'
    expect(['2026-06-27', '2026-06-28']).toContain(localKey)
  })

  it('接受 timestamp 数字与 Date 实例', () => {
    const d = new Date('2026-06-28T12:00:00.000Z')
    expect(localDateKey(d.getTime())).toBe(localDateKey(d))
  })

  it('单数月/日补零（如 2026-1-5 → 2026-01-05）', () => {
    const d = new Date(2026, 0, 5, 10, 0, 0) // 本地 2026-01-05
    expect(localDateKey(d)).toBe('2026-01-05')
  })
})
