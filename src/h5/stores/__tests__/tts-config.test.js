import { describe, it, expect } from 'vitest'
import { TTS_PITCH, TTS_RATE, TTS_LANG, TTS_MAX_LENGTH } from '../../utils/constants'

// V7.7 第66轮 P0：TTS 适龄化配置（pitch=1.3→1.08, rate=0.82→0.88）
// Why: pitch>1.2 在 Safari 失真为蜂鸣、影响孩子辅音习得；
//      rate<0.85 拖慢不自然，破坏语言节奏感
// 心理学家周教授：1.05~1.10 是温暖+自然+跨浏览器安全的折中值
// How to apply: AudioBar.vue 必须使用这些常量；任何 TTS 调用都不应硬编码
describe('TTS age-appropriate config (V7.7 第66轮)', () => {
  it('pitch is in age-appropriate safe range [1.0, 1.15]', () => {
    expect(TTS_PITCH).toBeGreaterThanOrEqual(1.0)
    expect(TTS_PITCH).toBeLessThanOrEqual(1.15)
  })

  it('pitch is no longer the squeaky-cartoon value 1.3', () => {
    expect(TTS_PITCH).not.toBe(1.3)
    expect(TTS_PITCH).toBeLessThan(1.2)
  })

  it('rate is in natural-warm range [0.85, 0.95]', () => {
    expect(TTS_RATE).toBeGreaterThanOrEqual(0.85)
    expect(TTS_RATE).toBeLessThanOrEqual(0.95)
  })

  it('lang is zh-CN for child Mandarin exposure', () => {
    expect(TTS_LANG).toBe('zh-CN')
  })

  it('max length caps to prevent overflow on slow TTS engines', () => {
    expect(TTS_MAX_LENGTH).toBeLessThanOrEqual(300)
    expect(TTS_MAX_LENGTH).toBeGreaterThanOrEqual(100)
  })
})
