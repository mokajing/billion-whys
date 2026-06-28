import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RabbitFace from '../../components/RabbitFace.vue'
import BearFace from '../../components/BearFace.vue'

// V7.8 第66轮 P0：答答熊IP一致性补全
// Why: V7.7 仅落地 RabbitFace，QuestionDetail 的 🐻 emoji 仍跨平台渲染不一致，
// 触发 PRD 红线#7（IP一致性）。墨小暖指出：答答熊是知识引导者，
// 应有别于问问兔的视觉特征——圆耳(稳)、棕色(暖)、深棕鼻(可信)。
// How to apply: 凡需展示答答熊头像的位置必须用 BearFace，禁止 🐻 emoji
describe('BearFace IP component', () => {
  it('renders inline SVG with correct viewBox matching RabbitFace', () => {
    const wrapper = mount(BearFace, { props: { size: 32 } })
    const svg = wrapper.find('svg')
    expect(svg.exists()).toBe(true)
    expect(svg.attributes('viewBox')).toBe('0 0 48 48')
    expect(svg.attributes('width')).toBe('32')
    expect(svg.attributes('height')).toBe('32')
  })

  it('defaults to aria-hidden when no ariaLabel provided', () => {
    const wrapper = mount(BearFace)
    const svg = wrapper.find('svg')
    expect(svg.attributes('aria-hidden')).toBe('true')
    expect(svg.attributes('role')).toBe('img')
  })

  it('exposes aria-label when provided (decorative→meaningful)', () => {
    const wrapper = mount(BearFace, {
      props: { ariaLabel: '答答熊讲知识' },
    })
    const svg = wrapper.find('svg')
    expect(svg.attributes('aria-label')).toBe('答答熊讲知识')
    expect(svg.attributes('aria-hidden')).toBe('false')
  })

  it('rejects unsupported sizes via validator (parity with RabbitFace)', () => {
    const props = BearFace.props.size
    expect(props.validator(13)).toBe(false)
    expect(props.validator(16)).toBe(true)
    expect(props.validator(24)).toBe(true)
    expect(props.validator(48)).toBe(true)
  })

  it('uses default size 32 when not specified', () => {
    const wrapper = mount(BearFace)
    const svg = wrapper.find('svg')
    expect(svg.attributes('width')).toBe('32')
  })

  it('renders warm-brown face distinct from RabbitFace white', () => {
    const bear = mount(BearFace)
    const rabbit = mount(RabbitFace)
    // Bear face circle default color is warm tan #C8A47C
    const bearFace = bear.find('svg circle[cx="24"][cy="28"]')
    expect(bearFace.attributes('fill')).toBe('#C8A47C')
    // Rabbit face circle default is white #FFFFFF
    const rabbitFace = rabbit.find('svg circle[cx="24"][cy="28"]')
    expect(rabbitFace.attributes('fill')).toBe('#FFFFFF')
  })

  it('renders two round bear ears (not rabbit forward-tilt paths)', () => {
    const wrapper = mount(BearFace)
    // 答答熊耳为圆 circle，区别于问问兔的 path 前倾耳
    const earCircles = wrapper.findAll('svg circle[cx="13"][cy="13"]')
    expect(earCircles.length).toBe(1)
    const earCirclesRight = wrapper.findAll('svg circle[cx="35"][cy="13"]')
    expect(earCirclesRight.length).toBe(1)
  })

  it('renders muzzle ellipse (答答熊特有,问问兔无)', () => {
    const bear = mount(BearFace)
    const rabbit = mount(RabbitFace)
    const bearMuzzle = bear.find('svg ellipse[cx="24"][cy="33"]')
    expect(bearMuzzle.exists()).toBe(true)
    // 问问兔不应有 ellipse 口鼻区
    const rabbitMuzzle = rabbit.find('svg ellipse[cx="24"][cy="33"]')
    expect(rabbitMuzzle.exists()).toBe(false)
  })
})
