#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

const SEED_DIR = path.join(__dirname, '..', 'content', 'seed-library')
const REQUIRED_FIELDS = ['id', 'category', 'question', 'age', 'tags', 'layer1', 'layer2', 'layer3', 'science', 'experiment', 'ipScene', 'scienceImage', 'warmClosing', 'locale', 'safetyLevel']
const VALID_SAFETY_LEVELS = ['A', 'B', 'C']
const VALID_EXPERIMENT_TYPES = ['hands-on', 'observation', 'discussion']
const LAYER_FIELDS = ['answer', 'image']
const CATEGORIES = ['body', 'home', 'food', 'nature', 'animals', 'society']

let errors = 0
let total = 0
const experimentTypeCounts = { 'hands-on': 0, 'observation': 0, 'discussion': 0 }
const allIds = new Set()

for (const cat of CATEGORIES) {
  const filePath = path.join(SEED_DIR, `${cat}.json`)
  if (!fs.existsSync(filePath)) {
    console.error(`MISSING FILE: ${cat}.json`)
    errors++
    continue
  }

  let data
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch (e) {
    console.error(`PARSE ERROR: ${cat}.json - ${e.message}`)
    errors++
    continue
  }

  if (!Array.isArray(data)) {
    console.error(`NOT ARRAY: ${cat}.json`)
    errors++
    continue
  }

  for (const q of data) {
    total++
    const prefix = `${q.id || 'UNKNOWN'}`

    for (const field of REQUIRED_FIELDS) {
      if (!(field in q)) {
        console.error(`${prefix}: missing field "${field}"`)
        errors++
      }
    }

    if (q.id) {
      if (allIds.has(q.id)) {
        console.error(`${prefix}: duplicate id`)
        errors++
      }
      allIds.add(q.id)
    }

    if (!Array.isArray(q.tags) || q.tags.length === 0) {
      console.error(`${prefix}: tags must be a non-empty array`)
      errors++
    } else if (!q.tags.every(t => typeof t === 'string')) {
      console.error(`${prefix}: tags must contain only strings`)
      errors++
    }

    if (q.id && !q.id.startsWith(cat + '-')) {
      console.error(`${prefix}: id should start with "${cat}-"`)
      errors++
    }

    if (q.category !== cat) {
      console.error(`${prefix}: category "${q.category}" != file "${cat}"`)
      errors++
    }

    for (const layer of ['layer1', 'layer2', 'layer3']) {
      if (q[layer]) {
        for (const f of LAYER_FIELDS) {
          if (!(f in q[layer])) {
            console.error(`${prefix}: ${layer} missing "${f}"`)
            errors++
          }
        }
        if (!q[layer].answer || q[layer].answer.trim() === '') {
          console.error(`${prefix}: ${layer}.answer is empty`)
          errors++
        }
        if (layer !== 'layer1' && !q[layer].followUp) {
          console.error(`${prefix}: ${layer} missing "followUp"`)
          errors++
        }
        if (layer !== 'layer1' && q[layer].followUp && q[layer].followUp.trim() === '') {
          console.error(`${prefix}: ${layer}.followUp is empty`)
          errors++
        }
      }
    }

    if (q.warmClosing !== undefined && q.warmClosing.trim() === '') {
      console.error(`${prefix}: warmClosing is empty`)
      errors++
    }

    if (q.locale && q.locale !== 'zh-CN') {
      console.error(`${prefix}: unexpected locale "${q.locale}"`)
      errors++
    }

    if (q.safetyLevel && !VALID_SAFETY_LEVELS.includes(q.safetyLevel)) {
      console.error(`${prefix}: invalid safetyLevel "${q.safetyLevel}" (must be A/B/C)`)
      errors++
    }

    // Validate experiment.experimentType
    if (q.experiment) {
      if (!q.experiment.experimentType) {
        console.error(`${prefix}: experiment missing "experimentType"`)
        errors++
      } else if (!VALID_EXPERIMENT_TYPES.includes(q.experiment.experimentType)) {
        console.error(`${prefix}: invalid experimentType "${q.experiment.experimentType}" (must be hands-on/observation/discussion)`)
        errors++
      } else {
        experimentTypeCounts[q.experiment.experimentType]++
      }
    }
  }
}

console.log(`\nValidated ${total} questions across ${CATEGORIES.length} categories`)
console.log(`\nExperiment Type Distribution:`)
for (const [type, count] of Object.entries(experimentTypeCounts)) {
  console.log(`  ${type}: ${count}`)
}
if (errors > 0) {
  console.error(`FAILED: ${errors} error(s) found`)
  process.exit(1)
} else {
  console.log('PASSED: All schema checks passed')
}
