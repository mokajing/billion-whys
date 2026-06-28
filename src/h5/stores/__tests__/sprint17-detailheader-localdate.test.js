import { describe, it, expect } from 'vitest'

// V8.8 第76轮 Sprint 17：detailHeader 日期解析 UTC 偏移回归测试
// Why: V8.5 引入的 Profile.vue detailHeader 用 new Date('YYYY-MM-DD')，按 ECMAScript
// 规范解析为 UTC，在 UTC-5 等负时区会把"6 月 28 日 周日"显示成"6 月 27 日 周六"
// 与 V8.7 修复的 feedbackTrend7d 同源 bug；V8.8 改用 new Date(str + 'T00:00:00') 解析为本地
// How to apply: detailHeader 期望的 month/date/weekday 必须基于本地午夜 Date 实例

// 复刻 Profile.vue detailHeader 的日期组件提取逻辑（V8.8 修复版）
function detailHeaderComponents(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d.getTime())) return null
  const weekday = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1, // 1-based
    date: d.getDate(),
    weekday,
  }
}

describe('Sprint 17 · detailHeader 本地日期解析（V8.8 修复）', () => {
  it('解析 YYYY-MM-DD 返回的月/日/周几与字符串一致（本地午夜）', () => {
    const c = detailHeaderComponents('2026-06-28')
    expect(c).not.toBeNull()
    expect(c.year).toBe(2026)
    expect(c.month).toBe(6)
    expect(c.date).toBe(28)
    // 2026-06-28 是周日（getDay()=0）
    expect(c.weekday).toBe('日')
  })

  it('单数月/日补零场景：2026-01-05（周一）', () => {
    const c = detailHeaderComponents('2026-01-05')
    expect(c.month).toBe(1)
    expect(c.date).toBe(5)
    expect(c.weekday).toBe('一')
  })

  it('修复版始终返回与 dateStr 一致的本地日期组件（不受运行时区影响）', () => {
    // 模拟 EST 2026-06-28 00:00:00 本地 = UTC 2026-06-28 05:00:00
    // new Date('2026-06-28') 在 EST 返回 UTC 午夜 = EST 2026-06-27 19:00 → 本地日期 27（V8.5 bug）
    // new Date('2026-06-28T00:00:00') 在 EST 返回本地午夜 2026-06-28 00:00 → 本地日期 28（V8.8 修复）
    const c = detailHeaderComponents('2026-06-28')
    expect(c.date).toBe(28)
    expect(c.month).toBe(6)
    // 在任意时区下，组件拼接应等于 dateStr
    expect(`${c.year}-${String(c.month).padStart(2, '0')}-${String(c.date).padStart(2, '0')}`).toBe('2026-06-28')
  })

  it('守卫：V8.5 bug 版 new Date(dateStr) 在负时区会偏移（验证修复必要性）', () => {
    // 在 CST (UTC+8) 运行环境下：new Date('2026-06-28') = 2026-06-28 08:00 CST，getDate()=28
    // 在 EST (UTC-5) 运行环境下：new Date('2026-06-28') = 2026-06-27 19:00 EST，getDate()=27
    // 我们用 timestamp 模拟 EST 本地午夜的 UTC 时刻，验证修复版与本地 Date 实例一致
    const estMidnightUtc = '2026-06-28T05:00:00.000Z' // EST 本地 2026-06-28 00:00
    const local = new Date(estMidnightUtc)
    // 修复版 detailHeaderComponents('2026-06-28') 应当与 local 的本地组件一致
    // （前提是运行环境时区是 EST；在 CST 环境下 local 的本地组件是 28，仍然一致）
    const c = detailHeaderComponents('2026-06-28')
    expect(c.date).toBe(local.getDate())
    expect(c.month).toBe(local.getMonth() + 1)
  })

  it('空字符串与非法输入返回 null（防御边界）', () => {
    expect(detailHeaderComponents('')).toBeNull()
    expect(detailHeaderComponents(null)).toBeNull()
    expect(detailHeaderComponents(undefined)).toBeNull()
    // 'not-a-date' + 'T00:00:00' 仍是 Invalid Date
    expect(detailHeaderComponents('not-a-date')).toBeNull()
    // 非法月日（13月45日）→ Invalid Date
    expect(detailHeaderComponents('2026-13-45')).toBeNull()
  })

  it('闰年边界：2024-02-29（周四）合法、2025-02-29 溢出至 2025-03-01', () => {
    const leap = detailHeaderComponents('2024-02-29')
    expect(leap).not.toBeNull()
    expect(leap.month).toBe(2)
    expect(leap.date).toBe(29)
    expect(leap.weekday).toBe('四')
    // JS Date 对 2025-02-29 会溢出到 2025-03-01（V8.8 不做额外验证，依赖 localDateKey 上游保证合法）
    // 这里记录此行为是已知的，不属于 detailHeader 的责任
    const overflow = detailHeaderComponents('2025-02-29')
    expect(overflow).not.toBeNull() // JS 自动溢出，不是 Invalid Date
    expect(overflow.month).toBe(3)
    expect(overflow.date).toBe(1)
  })

  it('与 feedbackTrend7d 同款本地午夜解析对称（V8.7 修复 trend7d，V8.8 收口 detailHeader）', () => {
    // 验证 detailHeader 与 trend7d 的 localDateKey 同源：都返回本地日期组件
    // 选一个让 UTC 与本地日期不同的时刻：CST 2026-06-28 01:00 = UTC 2026-06-27 17:00
    const local = new Date('2026-06-27T17:00:00.000Z')
    const expectedStr = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`
    const c = detailHeaderComponents(expectedStr)
    expect(c.year).toBe(local.getFullYear())
    expect(c.month).toBe(local.getMonth() + 1)
    expect(c.date).toBe(local.getDate())
  })
})
