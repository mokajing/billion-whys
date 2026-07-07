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
