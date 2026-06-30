const fs = require('fs')
const path = require('path')

const categories = ['animals', 'body', 'food', 'home', 'nature', 'society']
const allQuestions = []
// P1-3 分包：按分类拆分到 subpackages/<cat>/data.json
const byCategory = {}

categories.forEach(cat => {
  const filePath = path.join(__dirname, '../content/seed-library', cat + '.json')
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  allQuestions.push(...data)
  byCategory[cat] = data
})

const outDir = path.join(__dirname, '../src/miniprogram/data')
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

// 主包仍保留全量 questions.json 作为兼容兜底（content.js 优先走分包，分包加载失败时可降级）
fs.writeFileSync(
  path.join(outDir, 'questions.json'),
  JSON.stringify(allQuestions)
)

// P1-3 分包：写入 src/miniprogram/subpackages/<cat>/data.json
const subRoot = path.join(__dirname, '../src/miniprogram/subpackages')
if (!fs.existsSync(subRoot)) fs.mkdirSync(subRoot, { recursive: true })
categories.forEach(cat => {
  const subDir = path.join(subRoot, cat)
  if (!fs.existsSync(subDir)) fs.mkdirSync(subDir, { recursive: true })
  fs.writeFileSync(
    path.join(subDir, 'data.json'),
    JSON.stringify(byCategory[cat])
  )
})

// 索引文件：主包加载时仅读取轻量索引（id/category/age/question/tags）供发现页/搜索使用
const indexData = allQuestions.map(q => ({
  id: q.id,
  category: q.category,
  age: q.age,
  question: q.question,
  tags: q.tags || [],
  safetyLevel: q.safetyLevel || 'A',
}))
fs.writeFileSync(
  path.join(outDir, 'questions-index.json'),
  JSON.stringify(indexData)
)

// 版本号单一源：从 package.json 注入 MP，避免 app.js/profile.js/privacy.wxml 三处硬编码漂移
const pkg = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8')
)
const releaseDate = new Date().toISOString().slice(0, 10)
fs.writeFileSync(
  path.join(outDir, 'version.json'),
  JSON.stringify({
    version: pkg.version,
    releaseDate,
  })
)

console.log(`Built ${allQuestions.length} questions into miniprogram/data/questions.json`)
console.log(`Built ${categories.length} subpackages under miniprogram/subpackages/`)
console.log(`Built lightweight index (${indexData.length} entries) into miniprogram/data/questions-index.json`)
console.log(`Wrote version ${pkg.version} (${releaseDate}) to miniprogram/data/version.json`)
