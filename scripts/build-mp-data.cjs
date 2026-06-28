const fs = require('fs')
const path = require('path')

const categories = ['animals', 'body', 'food', 'home', 'nature', 'society']
const allQuestions = []

categories.forEach(cat => {
  const filePath = path.join(__dirname, '../content/seed-library', cat + '.json')
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  allQuestions.push(...data)
})

const outDir = path.join(__dirname, '../src/miniprogram/data')
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

fs.writeFileSync(
  path.join(outDir, 'questions.json'),
  JSON.stringify(allQuestions)
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
console.log(`Wrote version ${pkg.version} (${releaseDate}) to miniprogram/data/version.json`)
