const fs = require('fs')
const path = require('path')

const categories = ['animals', 'body', 'food', 'home', 'nature', 'society']
const allQuestions = []
// P1-3 分包：按分类拆分到 subpackages/<cat>/data.json
const byCategory = {}

// V9.00 第162轮：Schema 强制校验 —— 缺失 interactionHint/parentGuide 的条目 build 失败
// V9.09 第171轮：food 类门禁降级为 WARNING（字段补齐后恢复 ERROR）
// V9.16 第178轮：emotion 字段合法性校验（墨小暖 P0 LEG-004，emotion 必须为合法值）
// V9.18 第180轮：food 移入 BLOCKING（100%完备），L1>50升级为ERROR，comfortCategory零值ERROR门禁
// V9.22 第184轮：home 升级为 BLOCKING（毒舌老王一票否决生效，hint/guide 缺失阻断 build）
// V9.23 第185轮：home BLOCKING 通过（100%完备），新增安全词扫描（TD-0055），nature/society WARNING门禁
const REQUIRED_FIELDS = ['interactionType', 'parentGuide', 'rabbitEmotion', 'bearEmotion']
const L1_REQUIRED_FIELDS = ['interactionHint']
const INTERACTION_TYPES = ['触觉类', '动作类', '观察类', '感知类']
const VALID_EMOTIONS = ['brave', 'curious', 'protective', 'gentle', 'wise', 'warm',
                        'excited', 'proud', 'surprised', 'happy', 'thoughtful', 'playful',
                        'comforting']
// V9.25 第187轮：分类 BLOCKING —— 按类别隔离错误，哪类违规阻断哪类，其他类正常发布
// V9.24 R186: all 6 categories hint/guide 100%, upgrade to BLOCKING
// V9.26 第188轮：新增 comfort(T) L1 文本扫描统计（R188-007，WARNING 模式，阈值 0%）
// V9.26 第188轮：FOOD_SAFETY_WORDS 集成修复（R188-008，安全李姐+前端小凡）
const BLOCKING_CATEGORIES = ["body", "animals", "food", "home", "nature", "society"]
const WARNING_CATEGORIES = []

// V9.26 第188轮：comfort(T) 扫描配置（R188-007）
// 当前阶段 WARNING（阈值 0% 不触发阻断），Sprint 89 收尾升级 ERROR（阈值 95%）
const COMFORT_T_SCAN_ENABLED = true
const COMFORT_T_THRESHOLD = 0   // 0% = 不阻断，仅统计；95% = Sprint 89 收尾目标
const COMFORT_T_MODE = 'WARNING' // 'WARNING' → 'ERROR' when Sprint 89 closes

// V9.18 第180轮：L1 字数上限（>50字 ERROR）
const L1_MAX_CHARS = 50
// V9.20 第182轮：home 移入必填（comfortCategory 100%完成）
// V9.25 第187轮：升级为 REQUIRED_COMFORT_CATEGORIES_ALL（内联在循环中）

let schemaErrors = []
let schemaWarnings = []
let l1OverLengthErrors = []
let comfortCategoryErrors = []

// V9.25 第187轮：分类 BLOCKING —— 按类别隔离错误，分类阻断而非全局阻断
const categoryErrors = {}  // { cat: [error_strings] }
categories.forEach(cat => { categoryErrors[cat] = [] })

function addCategoryError(cat, msg) {
  categoryErrors[cat].push(msg)
  schemaErrors.push(msg)  // also track globally for summary
}

categories.forEach(cat => {
  const filePath = path.join(__dirname, '../content/seed-library', cat + '.json')
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))

  const isBlocking = BLOCKING_CATEGORIES.includes(cat)
  const isWarning = WARNING_CATEGORIES.includes(cat)

  if (isBlocking || isWarning) {
    const level = isBlocking ? 'BLOCKING' : 'WARNING'
    const errorList = isBlocking ? schemaErrors : schemaWarnings

    data.forEach((entry, idx) => {
      const eid = entry.id || `index-${idx}`

      // Check layer1.interactionHint
      const l1 = entry.layer1
      if (!l1 || typeof l1 !== 'object') {
        const msg = `${eid}: layer1 not found or not an object — ${level}`
        errorList.push(msg)
        addCategoryError(cat, msg)
        return
      }
      for (const field of L1_REQUIRED_FIELDS) {
        const val = l1[field]
        if (!val || (typeof val === 'string' && val.trim().length === 0)) {
          const msg = `${eid}: layer1.${field} is missing or empty — ${level}`
          errorList.push(msg)
          addCategoryError(cat, msg)
        }
      }

      // Check root-level fields
      for (const field of REQUIRED_FIELDS) {
        const val = entry[field]
        if (!val || (typeof val === 'string' && val.trim().length === 0)) {
          const msg = `${eid}: ${field} is missing or empty — ${level}`
          errorList.push(msg)
          addCategoryError(cat, msg)
        }
      }

      // Check interactionType is valid
      if (entry.interactionType && !INTERACTION_TYPES.includes(entry.interactionType)) {
        const msg = `${eid}: interactionType="${entry.interactionType}" not in ${INTERACTION_TYPES.join(', ')} — ${level}`
        errorList.push(msg)
        addCategoryError(cat, msg)
      }

      // V9.16 第178轮：emotion 字段合法性校验（墨小暖 P0 LEG-004）
      // emotion 值必须为合法枚举值，否则前端渲染会出错
      for (const emoField of ['rabbitEmotion', 'bearEmotion']) {
        const val = entry[emoField]
        if (val && !VALID_EMOTIONS.includes(val)) {
          const msg = `${eid}: ${emoField}="${val}" is not a valid emotion (valid: ${VALID_EMOTIONS.join(', ')}) — ${level}`
          errorList.push(msg)
          addCategoryError(cat, msg)
        }
      }
    })
  }

  allQuestions.push(...data)
  byCategory[cat] = data

  // V9.18 第180轮：L1>50字 ERROR 门禁（R180-012）
  data.forEach((entry, idx) => {
    const eid = entry.id || `index-${idx}`
    const l1Text = entry.layer1 && entry.layer1.answer
    if (l1Text && typeof l1Text === 'string') {
      const charCount = l1Text.replace(/\s/g, '').length
      if (charCount > L1_MAX_CHARS) {
        l1OverLengthErrors.push(`${cat}/${eid}: L1 too long (${charCount} chars, max ${L1_MAX_CHARS})`)
      }
    }
  })

  // V9.18 第180轮：comfortCategory 零值 ERROR 门禁（R180-011）
  // V9.25 第187轮：所有6类均需 comfortCategory（home 在182轮完成，nature/society 在186轮完成）
  const REQUIRED_COMFORT_CATEGORIES_ALL = ['body', 'animals', 'food', 'home', 'nature', 'society']
  if (REQUIRED_COMFORT_CATEGORIES_ALL.includes(cat)) {
    data.forEach((entry, idx) => {
      const eid = entry.id || `index-${idx}`
      const cc = entry.comfortCategory
      if (!cc || (typeof cc === 'string' && cc.trim().length === 0)) {
        const msg = `${cat}/${eid}: comfortCategory is missing or empty`
        comfortCategoryErrors.push(msg)
        addCategoryError(cat, msg)
      }
    })

    // V9.25 第187轮：安全词扫描（分类 BLOCKING）
    // 扫描 home 和 food 类 hint/guide 中的危险词汇，检测到即分类阻断
    const constants = JSON.parse(fs.readFileSync(path.join(__dirname, '../content/constants.json'), 'utf8'))

    if (cat === 'home') {
      const safetyWords = (constants.HOME_SAFETY_WORDS && constants.HOME_SAFETY_WORDS.forbidden) || []
      if (safetyWords.length > 0) {
        data.forEach((entry, idx) => {
          const eid = entry.id || `index-${idx}`
          const hint = (entry.layer1 && entry.layer1.interactionHint) || ''
          for (const word of safetyWords) {
            if (hint.includes(word)) {
              const msg = `${cat}/${eid}: HOME SAFETY VIOLATION — hint contains forbidden word "${word}": ${hint.substring(0, 60)}...`
              addCategoryError(cat, msg)
            }
          }
        })
      }
    }

    // V9.25 第187轮：FOOD_SAFETY_WORDS 扫描（R187-007，安全李姐+王园长）
    // V9.26 第188轮：修复引用路径（R188-008，FOOD_SAFETY_WORDS_SCAN → FOOD_SAFETY_WORDS）
    if (cat === 'food') {
      const foodSafety = constants.FOOD_SAFETY_WORDS
      const foodForbidden = (foodSafety && foodSafety.forbidden) || []
      if (foodForbidden.length > 0) {
        data.forEach((entry, idx) => {
          const eid = entry.id || `index-${idx}`
          const hint = (entry.layer1 && entry.layer1.interactionHint) || ''
          const guide = entry.parentGuide || ''
          const combined = hint + ' ' + guide
          for (const word of foodForbidden) {
            if (combined.includes(word)) {
              const msg = `${cat}/${eid}: FOOD SAFETY VIOLATION — hint/guide contains forbidden word "${word}"`
              addCategoryError(cat, msg)
            }
          }
        })
      }
    }
  }
})

// V9.25 第187轮：分类 BLOCKING —— 按类别隔离，生成异常汇总报告
// 计算哪些类别有错误
const blockedCategories = categories.filter(cat => categoryErrors[cat].length > 0)
const cleanCategories = categories.filter(cat => categoryErrors[cat].length === 0)

if (schemaErrors.length > 0) {
  console.error(`\n========== [BUILD BLOCKING REPORT] Round 187 Category-Level BLOCKING ==========`)
  console.error(`Total errors: ${schemaErrors.length} across ${blockedCategories.length} categories`)
  console.error(`Blocked categories: ${blockedCategories.join(', ') || 'none'}`)
  console.error(`Clean categories: ${cleanCategories.join(', ') || 'none'}`)
  console.error(``)
  blockedCategories.forEach(cat => {
    console.error(`--- ${cat} (${categoryErrors[cat].length} errors) ---`)
    categoryErrors[cat].forEach(e => console.error(`  ${e}`))
  })
  console.error(``)
  if (cleanCategories.length > 0) {
    console.warn(`[INFO] ${cleanCategories.length} clean categories (${cleanCategories.join(', ')}) will be built normally.`)
    console.warn(`[INFO] Only blocked categories above need fixing.`)
  }
  console.error(`\nBuild ABORTED: Fix the above ${blockedCategories.length} blocked categories before building.\n`)
  process.exit(1)
}

// V9.18 第180轮：L1>50字 ERROR 门禁（R180-012）
if (l1OverLengthErrors.length > 0) {
  console.error(`\n[L1 LENGTH ERROR] ${l1OverLengthErrors.length} entries exceed ${L1_MAX_CHARS} chars (R180-012):`)
  l1OverLengthErrors.forEach(e => console.error(`  ${e}`))
  console.error(`\nBuild ABORTED: L1 length limit exceeded. Run body-l1-truncate.py to fix.\n`)
  process.exit(1)
}

// V9.18 第180轮：comfortCategory 零值 ERROR 门禁（R180-011）
if (comfortCategoryErrors.length > 0) {
  console.error(`\n[COMFORT CATEGORY ERROR] ${comfortCategoryErrors.length} entries missing comfortCategory (R180-011):`)
  comfortCategoryErrors.forEach(e => console.error(`  ${e}`))
  console.error(`\nBuild ABORTED: comfortCategory is required for body/animals/food categories.\n`)
  process.exit(1)
}

if (schemaWarnings.length > 0) {
  console.warn(`\n[SCHEMA WARNING] ${schemaWarnings.length} field validation warnings (non-blocking):`)
  schemaWarnings.forEach(w => console.warn(`  ${w}`))
}

// V9.14 第177轮：hint 字数 WARNING（>30字告警，LEG-008）
const HINT_MAX_CHARS = 30
let hintWarnings = []
allQuestions.forEach(entry => {
  const eid = entry.id || 'unknown'
  const hint = entry.hint || (entry.layer1 && entry.layer1.interactionHint)
  if (hint && typeof hint === 'string' && hint.length > HINT_MAX_CHARS) {
    hintWarnings.push(`${eid}: hint too long (${hint.length} chars, max ${HINT_MAX_CHARS}): "${hint.slice(0, 40)}..."`)
  }
})
if (hintWarnings.length > 0) {
  console.warn(`\n[HINT WARNING] ${hintWarnings.length} hints exceed ${HINT_MAX_CHARS} characters (LEG-008):`)
  hintWarnings.forEach(w => console.warn(`  ${w}`))
}

// V9.22 第184轮：HOME_SAFETY_WORDS 安全扫描（R183-004/R184-004，安全李姐一票否决）
// 扫描 home 类 hint/guide 中是否包含禁止词，命中则阻断 build
const HOME_SAFETY_FORBIDDEN = [
  '煤气灶', '插座孔', '玩刀', '剪刀尖', '药瓶', '清洁剂',
  '高处', '爬窗台', '手指伸进', '通电', '煤气', '打开煤气'
]
let homeSafetyViolations = []
const homeData = byCategory['home'] || []
homeData.forEach(entry => {
  const eid = entry.id || 'unknown'
  const hint = (entry.layer1 && entry.layer1.interactionHint) || ''
  const guide = entry.parentGuide || ''
  const combined = hint + ' ' + guide
  HOME_SAFETY_FORBIDDEN.forEach(word => {
    if (combined.includes(word)) {
      homeSafetyViolations.push(`${eid}: contains forbidden word "${word}" in hint/guide`)
    }
  })
})
if (homeSafetyViolations.length > 0) {
  console.error(`\n[HOME SAFETY ERROR] ${homeSafetyViolations.length} home entries contain forbidden safety words (R183-004):`)
  homeSafetyViolations.forEach(v => console.error(`  ${v}`))
  console.error(`\nBuild ABORTED: Home safety validation failed. Fix forbidden words before building.\n`)
  process.exit(1)
}

// V9.26 第188轮：comfort(T) L1 文本扫描统计（R188-007，陈架构+前端小凡）
// 双通道扫描：从 constants.json 读取 COMFORT_PATTERNS，扫描所有条目的 L1 answer 文本
// 当前 WARNING 模式（阈值 0%），Sprint 89 收尾升级 ERROR（阈值 95%）
if (COMFORT_T_SCAN_ENABLED) {
  const constants = JSON.parse(fs.readFileSync(path.join(__dirname, '../content/constants.json'), 'utf8'))
  const comfortPatterns = constants.COMFORT_PATTERNS || []
  const comfortTStats = {}  // { cat: { total, withComfort, pct } }
  const comfortTMissing = []  // [{ cat, id, l1Text }]

  categories.forEach(cat => {
    const data = byCategory[cat] || []
    const total = data.length
    let withComfort = 0
    data.forEach(entry => {
      const l1Text = (entry.layer1 && entry.layer1.answer) || ''
      const l1Hint = (entry.layer1 && entry.layer1.interactionHint) || ''
      const combined = l1Text + ' ' + l1Hint
      const hasComfort = comfortPatterns.some(pattern => combined.includes(pattern))
      if (hasComfort) {
        withComfort++
      } else {
        comfortTMissing.push({ cat, id: entry.id || 'unknown', l1Text: l1Text.slice(0, 60) })
      }
    })
    const pct = total > 0 ? Math.round(withComfort / total * 100) : 0
    comfortTStats[cat] = { total, withComfort, pct }
  })

  // Print comfort(T) stats table
  console.warn(`\n[COMFORT(T) SCAN] L1 text comfort word coverage (R188-007, ${COMFORT_T_MODE} mode, threshold ${COMFORT_T_THRESHOLD}%):`)
  const totalAll = Object.values(comfortTStats).reduce((s, v) => s + v.total, 0)
  const comfortAll = Object.values(comfortTStats).reduce((s, v) => s + v.withComfort, 0)
  const pctAll = totalAll > 0 ? Math.round(comfortAll / totalAll * 100) : 0
  const totalBar = '█'.repeat(Math.round(pctAll / 10)) + '░'.repeat(10 - Math.round(pctAll / 10))
  categories.forEach(cat => {
    const s = comfortTStats[cat]
    const bar = '█'.repeat(Math.round(s.pct / 10)) + '░'.repeat(10 - Math.round(s.pct / 10))
    console.warn(`  ${cat.padEnd(8)} ${String(s.pct).padStart(3)}% ${bar} (${s.withComfort}/${s.total})`)
  })
  console.warn(`  ${'TOTAL'.padEnd(8)} ${String(pctAll).padStart(3)}% ${totalBar} (${comfortAll}/${totalAll})`)

  // Check per-category threshold
  const belowThreshold = categories.filter(cat => comfortTStats[cat].pct < COMFORT_T_THRESHOLD)
  if (COMFORT_T_MODE === 'ERROR' && belowThreshold.length > 0) {
    console.error(`\n[COMFORT(T) ERROR] ${belowThreshold.length} categories below ${COMFORT_T_THRESHOLD}% threshold:`)
    belowThreshold.forEach(cat => {
      console.error(`  ${cat}: ${comfortTStats[cat].pct}% (${comfortTStats[cat].withComfort}/${comfortTStats[cat].total})`)
    })
    console.error(`\nBuild ABORTED: comfort(T) coverage below threshold. Run gen-comfort-T-batch.py to fix.\n`)
    process.exit(1)
  }

  if (comfortTMissing.length > 0) {
    console.warn(`\n[COMFORT(T) MISSING] ${comfortTMissing.length} entries lack comfort words in L1 text:`)
    // Group by category
    categories.forEach(cat => {
      const missing = comfortTMissing.filter(m => m.cat === cat)
      if (missing.length > 0) {
        console.warn(`  ${cat} (${missing.length}): ${missing.map(m => m.id).join(', ')}`)
      }
    })
  }
}

const outDir = path.join(__dirname, '../src/miniprogram/data')
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

// Bug fix: WeChat MP cannot require .json files directly; must use .js wrappers.
// We write BOTH .json (for reference) and .js (for require) versions.
// The local package.json with type:commonjs ensures Node treats .js as CJS.

// 主包全量数据
fs.writeFileSync(path.join(outDir, 'questions.json'), JSON.stringify(allQuestions))
fs.writeFileSync(
  path.join(outDir, 'questions-data.js'),
  '// AUTO-GENERATED. Do not edit. Source: content/seed-library/*.json\n' +
  '"use strict";\n' +
  'module.exports = ' + JSON.stringify(allQuestions) + ';\n'
)

// P1-3 分包：写入 src/miniprogram/subpackages/<cat>/data.{json,js}
const subRoot = path.join(__dirname, '../src/miniprogram/subpackages')
if (!fs.existsSync(subRoot)) fs.mkdirSync(subRoot, { recursive: true })
categories.forEach(cat => {
  const subDir = path.join(subRoot, cat)
  if (!fs.existsSync(subDir)) fs.mkdirSync(subDir, { recursive: true })
  // Write both .json and .js for subpackages
  fs.writeFileSync(path.join(subDir, 'data.json'), JSON.stringify(byCategory[cat]))
  fs.writeFileSync(
    path.join(subDir, 'data.js'),
    '// AUTO-GENERATED.\n"use strict";\nmodule.exports = ' + JSON.stringify(byCategory[cat]) + ';\n'
  )
  // Local package.json to force CommonJS
  fs.writeFileSync(path.join(subDir, 'package.json'), '{"type": "commonjs"}\n')
})

// 索引文件
const indexData = allQuestions.map(q => ({
  id: q.id,
  category: q.category,
  age: q.age,
  question: q.question,
  tags: q.tags || [],
  safetyLevel: q.safetyLevel || 'A',
}))
fs.writeFileSync(path.join(outDir, 'questions-index.json'), JSON.stringify(indexData))
fs.writeFileSync(
  path.join(outDir, 'questions-index-data.js'),
  '// AUTO-GENERATED.\n"use strict";\nmodule.exports = ' + JSON.stringify(indexData) + ';\n'
)

// 版本号
const pkg = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8')
)
const releaseDate = new Date().toISOString().slice(0, 10)
fs.writeFileSync(
  path.join(outDir, 'version.json'),
  JSON.stringify({ version: pkg.version, releaseDate })
)
fs.writeFileSync(
  path.join(outDir, 'version-data.js'),
  '// AUTO-GENERATED.\n"use strict";\nmodule.exports = ' +
  JSON.stringify({ version: pkg.version, releaseDate }) + ';\n'
)
// V8.61 Sprint 69：同步生成 version-data.cjs 避免版本三方不一致
fs.writeFileSync(
  path.join(outDir, 'version-data.cjs'),
  'module.exports = ' +
  JSON.stringify({ version: pkg.version, releaseDate }) + ';\n'
)


// Local package.json to force CommonJS for data/ folder
fs.writeFileSync(path.join(outDir, 'package.json'), '{"type": "commonjs"}\n')

console.log(`Built ${allQuestions.length} questions into miniprogram/data/`)
console.log(`Built ${categories.length} subpackages under miniprogram/subpackages/`)
console.log(`Built lightweight index (${indexData.length} entries)`)
console.log(`Wrote version ${pkg.version} (${releaseDate})`)
console.log(`Generated .js wrappers for WeChat MP require compatibility`)
