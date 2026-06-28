import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RabbitFace from '../../components/RabbitFace.vue'

// V7.7 第66轮 P0：问问兔IP一致性巡检
// Why: emoji 🐰 在 Apple/Google/微信三平台渲染不同，破坏IP品牌一致性（PRD红线#7）
// 心理学家周教授+CCO+墨小暖联合建议：用inline SVG替代，前倾耳表达"好奇"而非"惊吓"
// How to apply: 任何新页面若需要展示问问兔头像/空状态，必须用 RabbitFace 而非 🐰 emoji
describe('RabbitFace IP component', () => {
  it('renders inline SVG with correct viewBox', () => {
    const wrapper = mount(RabbitFace, { props: { size: 32 } })
    const svg = wrapper.find('svg')
    expect(svg.exists()).toBe(true)
    expect(svg.attributes('viewBox')).toBe('0 0 48 48')
    expect(svg.attributes('width')).toBe('32')
    expect(svg.attributes('height')).toBe('32')
  })

  it('defaults to aria-hidden when no ariaLabel provided', () => {
    const wrapper = mount(RabbitFace)
    const svg = wrapper.find('svg')
    expect(svg.attributes('aria-hidden')).toBe('true')
    expect(svg.attributes('role')).toBe('img')
  })

  it('exposes aria-label when provided (decorative→meaningful)', () => {
    const wrapper = mount(RabbitFace, {
      props: { ariaLabel: '问问兔在等你' },
    })
    const svg = wrapper.find('svg')
    expect(svg.attributes('aria-label')).toBe('问问兔在等你')
    expect(svg.attributes('aria-hidden')).toBe('false')
  })

  it('rejects unsupported sizes via validator', () => {
    const props = RabbitFace.props.size
    expect(props.validator(13)).toBe(false)
    expect(props.validator(16)).toBe(true)
    expect(props.validator(48)).toBe(true)
  })

  it('uses default size 32 when not specified', () => {
    const wrapper = mount(RabbitFace)
    const svg = wrapper.find('svg')
    expect(svg.attributes('width')).toBe('32')
  })

  it('renders both ears (curious-forward, not upright-startled)', () => {
    const wrapper = mount(RabbitFace)
    const paths = wrapper.findAll('svg path')
    // 2 outer ears + 2 inner ear shadows + 1 nose = 5 paths
    expect(paths.length).toBeGreaterThanOrEqual(4)
  })

  // V8.0 第69轮：mood="bowing" 状态单元测试
  // Why: Sprint 9 问问兔鞠躬 SVG 动效替代 V7.9 静态🌟，需保证 mood prop 校验+腮红渲染
  describe('V8.0 mood="bowing" state', () => {
    it('accepts mood prop with validator (default | bowing)', () => {
      const props = RabbitFace.props.mood
      expect(props.validator('default')).toBe(true)
      expect(props.validator('bowing')).toBe(true)
      expect(props.validator('happy')).toBe(false)
      expect(props.validator('')).toBe(false)
    })

    it('defaults mood to "default"', () => {
      const wrapper = mount(RabbitFace)
      const svg = wrapper.find('svg')
      expect(svg.classes()).toContain('rabbit-face--default')
      expect(svg.classes()).not.toContain('rabbit-face--bowing')
    })

    it('applies rabbit-face--bowing class when mood="bowing"', () => {
      const wrapper = mount(RabbitFace, { props: { mood: 'bowing' } })
      const svg = wrapper.find('svg')
      expect(svg.classes()).toContain('rabbit-face--bowing')
    })

    it('renders cheek blush circles only in bowing state (彩虹姐 P1)', () => {
      const defaultWrapper = mount(RabbitFace)
      // 默认无腮红 circle (只有 2 眼 + 1 鼻 + 1 脸 + 2 耳外/内 = 7 circles/paths)
      const defaultBlush = defaultWrapper.findAll('svg circle').filter(c => {
        const fill = c.attributes('fill')
        return fill === '#FFC4B8'
      })
      expect(defaultBlush.length).toBe(0)

      const bowingWrapper = mount(RabbitFace, { props: { mood: 'bowing' } })
      const bowingBlush = bowingWrapper.findAll('svg circle').filter(c => {
        const fill = c.attributes('fill')
        return fill === '#FFC4B8'
      })
      expect(bowingBlush.length).toBe(2)
    })
  })
})
