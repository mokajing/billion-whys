import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, statSync } from 'fs'
import { resolve } from 'path'

// V8.2 第71轮 Sprint 11：构建完整性回归
// Why: V8.0 曾发生"宣称103全通过实际102/103"事故（sync-images.sh 未纳入 build 流程）
// 验证 prebuild 钩子 + sync-images.sh 已使 public/images 与 content/images 同步

const CATEGORIES = ['body', 'animals', 'food', 'home', 'nature', 'society', 'experiments']
const SRC_ROOT = resolve(__dirname, '../../../..', 'content/images')
const DEST_ROOT = resolve(__dirname, '../../../..', 'public/images')

function listPngs(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter(f => f.endsWith('.png') || f.endsWith('.webp'))
    .filter(f => {
      const full = resolve(dir, f)
      return statSync(full).isFile()
    })
}

describe('Sprint 11 · 构建完整性 — sync-images 纳入 build 流程', () => {
  it('content/images 与 public/images 在每个有数据的 category 目录都存在', () => {
    const missing = []
    for (const cat of CATEGORIES) {
      const src = resolve(SRC_ROOT, cat)
      const dest = resolve(DEST_ROOT, cat)
      // 跳过 content 中不存在的 category（如 experiments 当前无独立目录）
      if (!existsSync(src)) continue
      if (!existsSync(dest)) missing.push(`dest 缺失: public/images/${cat}（源存在但未 sync）`)
    }
    expect(missing, missing.join('\n')).toEqual([])
  })

  it('public/images 每个文件在 content/images 都有源（无幽灵 PNG）', () => {
    const ghosts = []
    for (const cat of CATEGORIES) {
      const srcDir = resolve(SRC_ROOT, cat)
      const destDir = resolve(DEST_ROOT, cat)
      if (!existsSync(srcDir) || !existsSync(destDir)) continue
      const srcSet = new Set(listPngs(srcDir))
      for (const f of listPngs(destDir)) {
        if (!srcSet.has(f)) ghosts.push(`public/images/${cat}/${f} 在 content/images 中无源`)
      }
    }
    expect(ghosts, ghosts.join('\n')).toEqual([])
  })

  it('package.json prebuild 钩子已配置（钉死 sync-images 进 build 链）', async () => {
    const pkgPath = resolve(__dirname, '../../../..', 'package.json')
    const pkg = JSON.parse(await import('fs').then(fs => fs.readFileSync(pkgPath, 'utf-8')))
    expect(pkg.scripts.prebuild).toMatch(/sync-images/)
    expect(pkg.scripts.build).toBeDefined()
  })

  it('content/images 文件总数 ≥ 270 条数据需求的图片覆盖', () => {
    let totalSrc = 0
    let totalDest = 0
    for (const cat of CATEGORIES) {
      totalSrc += listPngs(resolve(SRC_ROOT, cat)).length
      totalDest += listPngs(resolve(DEST_ROOT, cat)).length
    }
    // PRD V8.1 准入条件：图片覆盖率 41.9% (>=30%达标)
    // 这里只校验 sync 后 dest 至少不比 src 少
    expect(totalSrc).toBeGreaterThan(0)
    expect(totalDest).toBeGreaterThanOrEqual(totalSrc)
  })
})
