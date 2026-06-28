import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// V8.1 第70轮 Sprint 10：试试互动实验 CTA 行为测试
// 验证 hasExperiment computed 逻辑（避免 mount 整页带来的 vue-router/Pinia 副作用）

function hasExperiment(q) {
  const exp = q?.experiment
  if (!exp) return false
  if (typeof exp === 'string') return exp.trim().length > 0
  return !!(exp.name || exp.steps || exp.experimentType)
}

describe('Sprint 10 · 试试互动实验 CTA 逻辑', () => {
  it('experiment 为对象且含 name → 显示 CTA', () => {
    expect(hasExperiment({ experiment: { name: '挤奶小游戏', steps: ['s1'] } })).toBe(true)
  })

  it('experiment 为对象但全空 → 不显示 CTA', () => {
    expect(hasExperiment({ experiment: {} })).toBe(false)
    expect(hasExperiment({ experiment: { foo: 'bar' } })).toBe(false)
  })

  it('experiment 为字符串 → 非空时显示 CTA', () => {
    expect(hasExperiment({ experiment: '讨论一下吧' })).toBe(true)
    expect(hasExperiment({ experiment: '   ' })).toBe(false)
    expect(hasExperiment({ experiment: '' })).toBe(false)
  })

  it('experiment 为 null/undefined → 不显示 CTA', () => {
    expect(hasExperiment({ experiment: null })).toBe(false)
    expect(hasExperiment({})).toBe(false)
    expect(hasExperiment(null)).toBe(false)
  })

  it('experiment 含 experimentType 但无 name/steps → 显示 CTA（observation/discussion 类型）', () => {
    expect(hasExperiment({ experiment: { experimentType: 'observation' } })).toBe(true)
    expect(hasExperiment({ experiment: { experimentType: 'discussion' } })).toBe(true)
  })

  it('真实 food-001 数据应显示 CTA（数据回归测试）', () => {
    const foodPath = resolve(__dirname, '../../../../content/seed-library/food.json')
    const food = JSON.parse(readFileSync(foodPath, 'utf-8'))
    const sample = food[0]
    expect(hasExperiment(sample)).toBe(true)
  })

  it('270条数据中每一条 experiment 都被正确识别（全量回归）', () => {
    const cats = ['body', 'home', 'food', 'nature', 'animals', 'society']
    let total = 0
    let withExp = 0
    for (const cat of cats) {
      const p = resolve(__dirname, `../../../../content/seed-library/${cat}.json`)
      const arr = JSON.parse(readFileSync(p, 'utf-8'))
      for (const q of arr) {
        total++
        if (hasExperiment(q)) withExp++
      }
    }
    expect(total).toBe(270)
    // 270条全部命中 hasExperiment（当前数据集设计如此）
    expect(withExp).toBe(270)
  })
})

