import { describe, it, expect, beforeEach } from 'vitest'
import { existsSync } from 'fs'
import { resolve } from 'path'
import { useContentStore } from '../content.js'
import { setActivePinia, createPinia } from 'pinia'

describe('image integrity', () => {
  let store

  beforeEach(async () => {
    setActivePinia(createPinia())
    store = useContentStore()
    await store.init()
  })

  it('all layer image refs point to existing files', () => {
    const missing = []
    for (const q of store.questions) {
      for (const layer of ['layer1', 'layer2', 'layer3']) {
        const img = q[layer]?.image
        if (img) {
          const fullPath = resolve(__dirname, '../../../../public', img)
          if (!existsSync(fullPath)) {
            missing.push(`${q.id} ${layer}: ${img}`)
          }
        }
      }
    }
    expect(missing, `Missing image files:\n${missing.join('\n')}`).toEqual([])
  })

  it('all scienceImage refs point to existing files', () => {
    const missing = []
    for (const q of store.questions) {
      if (q.scienceImage) {
        const fullPath = resolve(__dirname, '../../../../public', q.scienceImage)
        if (!existsSync(fullPath)) {
          missing.push(`${q.id}: ${q.scienceImage}`)
        }
      }
    }
    expect(missing, `Missing scienceImage files:\n${missing.join('\n')}`).toEqual([])
  })

  it('image coverage stats', () => {
    let withLayer1 = 0
    let withAnyImage = 0
    let withScienceImage = 0
    const total = store.questions.length

    for (const q of store.questions) {
      if (q.layer1?.image) withLayer1++
      if (q.layer1?.image || q.layer2?.image || q.layer3?.image) withAnyImage++
      if (q.scienceImage) withScienceImage++
    }

    // eslint-disable-next-line no-console
    console.log(`Image coverage: ${withAnyImage}/${total} items (${(100 * withAnyImage / total).toFixed(1)}%)`)
    // eslint-disable-next-line no-console
    console.log(`  layer1: ${withLayer1}/${total}`)
    // eslint-disable-next-line no-console
    console.log(`  scienceImage: ${withScienceImage}/${total}`)

    expect(total).toBe(270)
  })
})
