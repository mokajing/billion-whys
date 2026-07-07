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
 *
 * V8.53 Sprint 62 第117轮口径修正（毒舌老王 + CTO + 测试虫虫）：
 *  ① 新增 `unillustrated` 桶 —— 旧逻辑里"全 5 slot 空 image"的题因 slotPath 全空 → 无 dupGroups 无
 *    samePathGroups → 被误判为 "clean"。这是撒谎：clean 的语义是"有插画且全 distinct"，不是"没插画"。
 *    毒舌老王："一个把'什么都没有'算作'完美'的会计系统。" 本轮收紧：clean 必须所有 5 slot 均有非空
 *    image 路径且全 distinct；否则若有 ≥1 slot 空缺且无复用 → unillustrated（插画未完成 backlog）。
 *  ② 新增 baseline / postBaseline 双口径分离 —— Sprint 61 canonical 锁的是 live 274/37（含 3 题
 *    post-baseline sprint53 在 clean 内），post-Sprint-61 内容批涌入后 live 涨到 304/67 → 红灯。
 *    修法：scan 按 baselineEpoch 分桶，canonical 改锁 baseline-only 不变量（271/227/10/34/0 unill），
 *    post-baseline 是 append-only 增长（sprint53 的 3 + sprint61 的 30 = 33），独立会计不锁死数字。
 *  ③ 不加第 36 条红线；#33 baseline 813 文本 hash 集不动（零文本改动，只给 30 新题打 baselineEpoch 标记）。
 *  ④ baseline 会计口径不变 —— 227 debt / 10 samePath / 34 clean / 0 unill（baseline 271 题全有占位图，
 *     无 unillustrated；收紧 clean 定义不破坏 baseline 不变量，已测试虫虫验证）。
 */
function classifyQuestion(q) {
  // 收集非空 image 路径 + md5（仅非空 slot）
  const slotMd5 = {}
  const slotPath = {}
  for (const s of IMAGE_SLOTS) {
    const p = slotImagePath(q, s)
    if (!p) continue
    slotPath[s] = p
    const h = md5(p)
    if (h) slotMd5[s] = h
  }
  const filledSlots = Object.keys(slotPath).length

  // same-path 占位引用组（多 slot 引用同一路径字符串）
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

  // 无复用：判断是 clean 还是 unillustrated
  if (dupGroups.length === 0) {
    if (samePathGroups.length > 0) return { cls: 'samePath', filledSlots }
    // Sprint 62 收紧：clean 必须所有 5 slot 均有非空 image 且全 distinct；
    // 否则（有 slot 空缺）= unillustrated（插画未完成 backlog，非 clean）
    if (filledSlots < IMAGE_SLOTS.length) return { cls: 'unillustrated', filledSlots }
    return { cls: 'clean', filledSlots }
  }

  const maxSlots = Math.max(...dupGroups.map((g) => g.slots.length))
  let severity
  if (maxSlots >= 5) severity = 'full5'
  else if (maxSlots >= 4) severity = 'full4'
  else severity = 'partial'

  return {
    cls: 'debt',
    severity,
    groups: dupGroups.map((g) => ({ slots: g.slots, md5: g.md5.slice(0, 8) })),
  }
}

function isPostBaseline(q) {
  const ep = q && typeof q.baselineEpoch === 'string' ? q.baselineEpoch : ''
  return ep.startsWith('post')
}

function scanBaselineImageDebt() {
  const questions = loadAllQuestions()
  // all-scope 桶
  const debt = []
  const clean = []
  const samePathOnly = []
  const unillustrated = []
  // baseline / postBaseline 分桶
  const baseline = { total: 0, debt: 0, samePath: 0, clean: 0, unillustrated: 0, debtList: [], cleanList: [], samePathList: [], unillustratedList: [], bySeverity: { full5: 0, full4: 0, partial: 0 } }
  const postBaseline = { total: 0, debt: 0, samePath: 0, clean: 0, unillustrated: 0, ids: [], cleanList: [], unillustratedList: [] }

  for (const q of questions) {
    const post = isPostBaseline(q)
    const r = classifyQuestion(q)
    const id = q.id
    const cat = q.category

    if (post) postBaseline.total++
    else baseline.total++

    if (r.cls === 'debt') {
      const entry = { id, category: cat, severity: r.severity, groups: r.groups }
      debt.push(entry)
      if (post) { postBaseline.debt++; postBaseline.ids.push(id) }
      else {
        baseline.debt++; baseline.debtList.push(id)
        baseline.bySeverity[r.severity]++
      }
    } else if (r.cls === 'samePath') {
      samePathOnly.push(id)
      if (post) postBaseline.samePath++
      else { baseline.samePath++; baseline.samePathList.push(id) }
    } else if (r.cls === 'unillustrated') {
      const entry = { id, category: cat, filledSlots: r.filledSlots }
      unillustrated.push(entry)
      if (post) { postBaseline.unillustrated++; postBaseline.unillustratedList.push(id) }
      else { baseline.unillustrated++; baseline.unillustratedList.push(id) }
    } else {
      // clean
      clean.push(id)
      if (post) { postBaseline.clean++; postBaseline.cleanList.push(id) }
      else baseline.clean++; baseline.cleanList.push(id)
    }
  }

  return {
    // all-scope（向后兼容 + 总览）
    totalQuestions: questions.length,
    debtCount: debt.length,
    cleanCount: clean.length,
    samePathOnlyCount: samePathOnly.length,
    unillustratedCount: unillustrated.length,
    bySeverity: {
      full5: debt.filter((d) => d.severity === 'full5').length,
      full4: debt.filter((d) => d.severity === 'full4').length,
      partial: debt.filter((d) => d.severity === 'partial').length,
    },
    byCategory: CATEGORIES.reduce((acc, c) => {
      acc[c] = {
        debt: debt.filter((d) => d.category === c).length,
        clean: clean.filter((id) => id.startsWith(c + '-')).length,
        unillustrated: unillustrated.filter((u) => u.category === c).length,
      }
      return acc
    }, {}),
    // baseline-scoped（Sprint 61 canonical 不变量 — post-baseline 增长下稳定）
    baseline,
    // post-baseline-scoped（append-only 增长，独立会计）
    postBaseline,
    // all-scope 列表（向后兼容）
    debt,
    clean,
    samePathOnly,
    unillustrated,
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
    console.log('=== 十亿 baseline 同型复用债全量扫描 (Sprint 62 双口径) ===')
    console.log(`总题数:        ${result.totalQuestions}`)
    console.log(`[all] debt (同型复用): ${result.debtCount}`)
    console.log(`[all] clean (全 5 slot distinct): ${result.cleanCount}`)
    console.log(`[all] samePathOnly (占位引用): ${result.samePathOnlyCount}`)
    console.log(`[all] unillustrated (插画未完成): ${result.unillustratedCount}`)
    console.log('--- baseline-scoped（canonical 不变量）---')
    console.log(`baseline total=${result.baseline.total} debt=${result.baseline.debt} samePath=${result.baseline.samePath} clean=${result.baseline.clean} unillustrated=${result.baseline.unillustrated}`)
    console.log(`baseline bySeverity: ${JSON.stringify(result.baseline.bySeverity)}`)
    console.log('--- postBaseline-scoped（append-only 增长）---')
    console.log(`postBaseline total=${result.postBaseline.total} debt=${result.postBaseline.debt} samePath=${result.postBaseline.samePath} clean=${result.postBaseline.clean} unillustrated=${result.postBaseline.unillustrated}`)
    console.log('按圈层:', JSON.stringify(result.byCategory))
    console.log('\ndebt 题号清单 (baseline):')
    for (const id of result.baseline.debtList) {
      console.log(`  ${id}`)
    }
    if (result.postBaseline.unillustratedList.length) {
      console.log('\npost-baseline unillustrated（待首批插画）:')
      for (const id of result.postBaseline.unillustratedList) {
        console.log(`  ${id}`)
      }
    }
  }
}
