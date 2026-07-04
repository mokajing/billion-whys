// V8.52 第116轮 Sprint 61：baseline 同型复用债全量扫描脚本（build-time 工具，不进运行时）
// Why: Sprint 60 下轮议题候选「nature-001 之外 baseline 同型复用债全量扫描」本轮兑现。
//       毒舌老王："别等下一轮再发现一个" —— 本轮全量扫描发现：237/274 题承载 layer1/layer2/layer3/experiment
//       （含 scienceImage）distinct-path 同 md5 字节级复用，与 Sprint 58-60 修的 nature-001/046/047/048 完全同型。
//       Sprint 58 "同型复用非主导模式" 断言基于 nature-002/003 两题样本，对 nature-004~045 及 body/home/food/
//       animals/society 大多数题不成立 —— 本脚本把扫描常态化、可重复执行。
// CTO 陈架构：脚本是 build-time 工具，零运行时依赖、零网络、零身份字段；H5+MP 不需同构（不触双端运行时代码）。
// 测试虫虫：canonical test (sprint61-baseline-illustration-backlog.test.js) 调用本脚本 scanBaselineImageDebt()，
//           锁定 237 debt / 37 clean 起点不变量 + debt 单调递减断言（每 sprint 只降不升）。
// 法务张律：本脚本只读 content/images + content/seed-library/*.json，零写入零网络零身份字段，不触合规红线。
// 用法：node scripts/scan-baseline-image-debt.cjs [--json]
'use strict'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const REPO_ROOT = path.resolve(__dirname, '..')
const CONTENT_ROOT = path.join(REPO_ROOT, 'content')
const IMAGE_ROOT = path.join(CONTENT_ROOT, 'images')
const SEED_DIR = path.join(CONTENT_ROOT, 'seed-library')

const CATEGORIES = ['body', 'home', 'food', 'nature', 'animals', 'society']
// 5 个图片 slot：layer1/layer2/layer3/experiment 为插画 slot，scienceImage 为科学图 slot
const IMAGE_SLOTS = ['layer1', 'layer2', 'layer3', 'experiment', 'scienceImage']

function md5(p) {
  if (!fs.existsSync(p)) return null
  return crypto.createHash('md5').update(fs.readFileSync(p)).digest('hex')
}

function slotImagePath(q, slot) {
  const v = q[slot]
  const p = v && typeof v === 'object' ? v.image : v
  if (!p) return null
  // content json 里路径形如 images/nature/nature-001-layer1.webp，对应 content/images/...
  return path.join(CONTENT_ROOT, p)
}

function loadAllQuestions() {
  const all = []
  for (const cat of CATEGORIES) {
    const f = path.join(SEED_DIR, `${cat}.json`)
    if (!fs.existsSync(f)) continue
    const data = JSON.parse(fs.readFileSync(f, 'utf8'))
    for (const q of data) all.push(q)
  }
  return all
}

/**
 * 扫描全量题目的同型复用（distinct-path same-md5）债务。
 *
 * 分类口径（CTO + 科普陈博士 + CEO Sprint 61 裁决）：
 *  - debt = 存在 ≥2 个 distinct 路径但字节级同 md5 的 slot 组（真正的"同型复用"，nature-001 类）
 *  - clean = 所有 slot 路径的 md5 全 distinct
 *  - samePath（不在 debt 内）= 多 slot 引用同一路径字符串（占位引用，非字节复用；单独统计）
 *
 * 严重度：
 *  - full5 = 5 slot 全同 md5
 *  - full4 = 4 slot 同 md5
 *  - partial = 2-3 slot 同 md5
 *
 * 重分类（Sprint 61）：baseline 237 题占位状态记为 illustration-pending-upgrade（未插画 backlog），
 *  非 red line #1+#7 红灯（#1 守"科学错误"，#7 守"已插画题叙事清晰"）。
 */
function scanBaselineImageDebt() {
  const questions = loadAllQuestions()
  const debt = []
  const clean = []
  const samePathOnly = []

  for (const q of questions) {
    // 路径 + md5
    const slotMd5 = {}
    const slotPath = {}
    for (const s of IMAGE_SLOTS) {
      const p = slotImagePath(q, s)
      if (!p) continue
      slotPath[s] = p
      const h = md5(p)
      if (h) slotMd5[s] = h
    }

    // same-path 占位引用组
    const byPath = {}
    for (const s of Object.keys(slotPath)) {
      const p = slotPath[s]
      ;(byPath[p] = byPath[p] || []).push(s)
    }
    const samePathGroups = Object.values(byPath).filter((g) => g.length > 1)

    // distinct-path same-md5 组（真同型复用）
    const byHash = {}
    for (const s of Object.keys(slotMd5)) {
      const h = slotMd5[s]
      ;(byHash[h] = byHash[h] || []).push(s)
    }
    const dupGroups = Object.entries(byHash)
      .filter(([_, ss]) => ss.length > 1)
      .map(([h, ss]) => ({ md5: h, slots: ss, paths: ss.map((s) => slotPath[s]) }))
      .filter((g) => new Set(g.paths).size > 1) // distinct paths only

    if (dupGroups.length === 0) {
      if (samePathGroups.length > 0) samePathOnly.push(q.id)
      else clean.push(q.id)
      continue
    }

    const maxSlots = Math.max(...dupGroups.map((g) => g.slots.length))
    let severity
    if (maxSlots >= 5) severity = 'full5'
    else if (maxSlots >= 4) severity = 'full4'
    else severity = 'partial'

    debt.push({
      id: q.id,
      category: q.category,
      severity,
      groups: dupGroups.map((g) => ({ slots: g.slots, md5: g.md5.slice(0, 8) })),
    })
  }

  return {
    totalQuestions: questions.length,
    debtCount: debt.length,
    cleanCount: clean.length,
    samePathOnlyCount: samePathOnly.length,
    bySeverity: {
      full5: debt.filter((d) => d.severity === 'full5').length,
      full4: debt.filter((d) => d.severity === 'full4').length,
      partial: debt.filter((d) => d.severity === 'partial').length,
    },
    byCategory: CATEGORIES.reduce((acc, c) => {
      acc[c] = {
        debt: debt.filter((d) => d.category === c).length,
        clean: clean.filter((id) => id.startsWith(c + '-')).length,
      }
      return acc
    }, {}),
    debt,
    clean,
    samePathOnly,
  }
}

module.exports = { scanBaselineImageDebt, IMAGE_SLOTS, CATEGORIES }

// CLI 直接运行
if (require.main === require.main) {
  const result = scanBaselineImageDebt()
  const asJson = process.argv.includes('--json')
  if (asJson) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    console.log('=== 十亿 baseline 同型复用债全量扫描 (Sprint 61) ===')
    console.log(`总题数:        ${result.totalQuestions}`)
    console.log(`debt (同型复用): ${result.debtCount}`)
    console.log(`clean (全 distinct): ${result.cleanCount}`)
    console.log(`samePathOnly (占位引用): ${result.samePathOnlyCount}`)
    console.log('按严重度:', JSON.stringify(result.bySeverity))
    console.log('按圈层:', JSON.stringify(result.byCategory))
    console.log('\ndebt 题号清单:')
    for (const d of result.debt) {
      console.log(`  ${d.id} [${d.severity}] ${d.groups.map((g) => g.slots.join('+') + '(' + g.md5 + ')').join('; ')}`)
    }
  }
}
