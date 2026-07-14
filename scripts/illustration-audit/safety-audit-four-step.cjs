/**
 * V8.87 Sprint 78 第150轮：插画安全审核四步流程
 * 负责：安全李姐 + 周教授 + 张律 + 陈博士
 *
 * 四步标准化流程（安全李姐一票否决权）：
 *   1. prompt 逆向审核 —— 检查生图 prompt 是否含恐怖/血腥/敏感词
 *   2. 情绪适龄性清单 —— 5 条标准：色调温暖、无恐怖元素、无血腥、角色友好、L1 安抚
 *   3. 人脸特征检测 —— 检查插画中是否出现具象人脸特征（法务张律）
 *   4. 科学准确性审核 —— 检查插画中的科学表达是否准确（陈博士，独立于安全审核）
 *
 * 安全审核（步骤 1-3）和科学审核（步骤 4）解耦，各自独立 PASS/FAIL。
 * 两者都 PASS 才允许上线。
 *
 * 使用方式：
 *   node scripts/illustration-audit/safety-audit-four-step.cjs --topic=body-001
 */

const fs = require('fs')
const path = require('path')

// ── 步骤 1：prompt 逆向审核 ──
const PROMPT_HORROR_KEYWORDS = [
  '血', 'blood', '切口', 'incision', '解剖', 'anatomy',
  '锋利', 'sharp', '刀', 'knife', '针', 'needle',
  '黑暗', 'dark', '巨物', 'giant', '怪物', 'monster',
  '骷髅', 'skeleton', '骨头', 'bone', '牙齿提取', 'teeth',
  'realistic', '真实', 'x-ray', 'x光', 'realistic face',
  '人脸', 'face detail', 'portrait', '肖像',
]

const PROMPT_CHILD_UNSAFE_KEYWORDS = [
  'anatomy', 'realistic', 'skeleton', 'x-ray', 'dissection',
  'incision', 'blood', 'gore', 'horror', 'scary',
]

const PROMPT_FACE_KEYWORDS = [
  'face', '人脸', 'portrait', '肖像', 'realistic face',
  'detailed face', 'human face', 'person',
]

function step1_promptReverseAudit(prompt) {
  const issues = []
  const promptLower = (prompt || '').toLowerCase()

  for (const kw of PROMPT_HORROR_KEYWORDS) {
    if (promptLower.includes(kw.toLowerCase())) {
      issues.push(`prompt 含敏感词: "${kw}"`)
    }
  }

  // 认知适配检查（CCO 文若水要求）
  const childUnsafe = PROMPT_CHILD_UNSAFE_KEYWORDS.filter(kw =>
    promptLower.includes(kw.toLowerCase())
  )
  if (childUnsafe.length > 0) {
    issues.push(`prompt 含不适合儿童认知的词汇: ${childUnsafe.join(', ')}`)
  }

  return {
    step: 1,
    name: 'prompt 逆向审核',
    passed: issues.length === 0,
    issues,
    summary: issues.length === 0
      ? 'PASS — prompt 未发现敏感词或不适龄词汇'
      : `FAIL — ${issues.length} 个问题`,
  }
}

// ── 步骤 2：情绪适龄性清单（5 条标准） ──
const COMFORT_PATTERNS = [
  '保护', '没关系', '安全', '正常', '聪明',
  '打招呼', '帮助', '照顾', '温暖', '开心',
  '没事', '放心', '勇敢', '自然', '很棒',
  '健康', '爱', '拥抱', '陪伴',
]

function step2_emotionSafetyAudit({ topic, category, layer1Text, imageMeta }) {
  const issues = []

  // 标准 1：画面不含血液、切口、解剖结构
  // (基于 prompt 和 topic 判定，实际图片需人工审核)
  // 已由步骤 1 覆盖 prompt 关键词

  // 标准 2：画面不含恐怖元素
  const topicLower = (topic || '').toLowerCase()
  if (category === 'body') {
    if (topicLower.includes('心脏') || topicLower.includes('heart')) {
      // 心脏主题特殊检查
    }
    if (topicLower.includes('骨骼') || topicLower.includes('骨') || topicLower.includes('bone')) {
      issues.push('[标准2] body 圈层骨骼主题需确认插画为卡通形象，非写实骨骼')
    }
    if (topicLower.includes('大脑') || topicLower.includes('脑') || topicLower.includes('brain')) {
      issues.push('[标准2] body 圈层大脑主题需确认插画为卡通形象，非解剖图')
    }
  }

  // 标准 3：色调温暖
  // (实际图片需 color-check.js 分析，此处仅做标记)
  // 在完整流程中接入 color-check.js 的 checkSaturation

  // 标准 4：角色表情友好
  // (实际图片需人工审核，此处仅做标记)

  // 标准 5：L1 回答包含安抚语句
  if (layer1Text) {
    const hasComfort = COMFORT_PATTERNS.some(p => (layer1Text || '').includes(p))
    if (!hasComfort) {
      issues.push('[标准5] L1 回答缺少安抚/正面引导语句')
    }
  }

  return {
    step: 2,
    name: '情绪适龄性清单',
    passed: issues.length === 0,
    issues,
    details: {
      standards: {
        s1_bloodless: '需人工审核',
        s2_noHorror: issues.filter(i => i.includes('[标准2]')).length === 0 ? 'PASS' : '需人工审核',
        s3_warmTone: '需人工审核（接入 color-check.js）',
        s4_friendlyFace: '需人工审核',
        s5_comfort: COMFORT_PATTERNS.some(p => (layer1Text || '').includes(p)) ? 'PASS' : 'FAIL',
      },
    },
    summary: issues.length === 0
      ? 'PASS — 情绪适龄性自动化检查通过，建议提交人工审核'
      : `FAIL — ${issues.length} 个问题需人工审核`,
  }
}

// ── 步骤 3：人脸特征检测 ──
function step3_faceFeatureDetection(prompt) {
  const issues = []
  const promptLower = (prompt || '').toLowerCase()

  const faceTriggers = PROMPT_FACE_KEYWORDS.filter(kw =>
    promptLower.includes(kw.toLowerCase())
  )

  if (faceTriggers.length > 0) {
    issues.push(`prompt 含人脸相关词汇: ${faceTriggers.join(', ')}，需人工复核插画是否生成具象人脸`)
  }

  return {
    step: 3,
    name: '人脸特征检测',
    passed: faceTriggers.length === 0,
    issues,
    recommendation: faceTriggers.length > 0
      ? '需人工复核 — 如插画中出现具象人脸特征，需重新生成'
      : 'PASS — prompt 无人脸相关词汇（实际图片仍需人工确认）',
    summary: faceTriggers.length === 0
      ? 'PASS'
      : '需人工复核',
  }
}

// ── 步骤 4：科学准确性审核 ──
const BODY_SCIENCE_RULES = {
  'heart': '心脏位于胸腔左侧，拳头大小，颜色为暗红色（非鲜红圆形），有四个腔室',
  'bone': '骨骼为白色/米色，非骷髅形象，需卡通化表达',
  'brain': '大脑为粉灰色，有沟回褶皱，非光滑表面',
  'lung': '肺为粉红色海绵状，左右各一，左肺略小（为心脏留空间）',
  'stomach': '胃位于左上腹，J 形袋状，非圆形',
  'blood': '血液为红色，在血管中流动，血管非单一红色管道',
}

function step4_scienceAccuracyAudit({ topic, category, prompt }) {
  const issues = []
  const topicLower = (topic || '').toLowerCase()

  if (category === 'body') {
    for (const [key, rule] of Object.entries(BODY_SCIENCE_RULES)) {
      if (topicLower.includes(key)) {
        // 标记该主题的科学规则，需人工对照插画审核
        issues.push(`[科学规则] ${rule}`)
      }
    }
  }

  // 通用科学审核检查
  if (prompt) {
    const promptLower = prompt.toLowerCase()
    if (promptLower.includes('cartoon') && promptLower.includes('realistic')) {
      issues.push('prompt 同时包含 cartoon 和 realistic，风格冲突')
    }
    if (promptLower.includes('anatomy') && !promptLower.includes('cartoon')) {
      issues.push('prompt 含 anatomy 但未指定 cartoon 风格，可能导致解剖图风格')
    }
  }

  return {
    step: 4,
    name: '科学准确性审核',
    passed: issues.filter(i => !i.startsWith('[科学规则]')).length === 0,
    issues,
    note: '[科学规则] 标记项为科学事实提醒，需人工对照插画审核，不代表自动 FAIL',
    summary: 'PASS 或需人工审核 — 科学审核独立于安全审核，需人工确认',
  }
}

// ── 综合审核 ──
function fullAudit({ topic, category, prompt, layer1Text, imageMeta = {} }) {
  const results = []

  results.push(step1_promptReverseAudit(prompt))
  results.push(step2_emotionSafetyAudit({ topic, category, layer1Text, imageMeta }))
  results.push(step3_faceFeatureDetection(prompt))
  results.push(step4_scienceAccuracyAudit({ topic, category, prompt }))

  const safetyPassed = results[0].passed && results[1].passed && results[2].passed
  const sciencePassed = results[3].passed
  const allPassed = safetyPassed && sciencePassed

  return {
    topic,
    category,
    timestamp: new Date().toISOString(),
    results,
    verdict: {
      safety: safetyPassed ? 'PASS' : 'FAIL',
      science: sciencePassed ? 'PASS' : '需人工审核',
      overall: allPassed ? 'PASS — 安全审核和科学审核均通过，允许上线' : 'FAIL — 需修复后重新审核',
      canDeploy: safetyPassed, // 安全审核必须 PASS，科学审核可人工确认后放行
    },
    note: '科学审核中的[科学规则]标记项为提醒类，不自动 FAIL。安全审核（步骤1-3）必须全部 PASS。',
  }
}

// ── CLI 入口 ──
if (require.main === module) {
  const args = process.argv.slice(2)
  const topic = args.find(a => a.startsWith('--topic='))?.split('=')[1] || 'body-001'
  const category = args.find(a => a.startsWith('--category='))?.split('=')[1] || 'body'
  const promptArg = args.find(a => a.startsWith('--prompt='))?.split('=')[1] || ''
  const layer1Arg = args.find(a => a.startsWith('--layer1='))?.split('=')[1] || ''

  const result = fullAudit({
    topic,
    category,
    prompt: promptArg,
    layer1Text: layer1Arg,
  })

  console.log(JSON.stringify(result, null, 2))
}

module.exports = {
  fullAudit,
  step1_promptReverseAudit,
  step2_emotionSafetyAudit,
  step3_faceFeatureDetection,
  step4_scienceAccuracyAudit,
  PROMPT_HORROR_KEYWORDS,
  PROMPT_CHILD_UNSAFE_KEYWORDS,
  PROMPT_FACE_KEYWORDS,
  COMFORT_PATTERNS,
  BODY_SCIENCE_RULES,
}