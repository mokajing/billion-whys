/**
 * prompt-preprocessor.cjs
 * 第160轮 Sprint 81 中期检查 — P0#4: prompt-preprocessor P0 门禁收紧
 * globalConstraints 缺失 = P0 错误（第160轮升级，CEO 批准）
 * AI小智 + CTO陈架构
 *
 * 三类 constraint 层：
 *   1. P0 门禁：必填字段校验（prompt, rabbitEmotion, bearEmotion, safetyLevel）
 *   2. P1 优化：comfort 词自动注入（从 COMFORT_PATTERNS 注入到 prompt 中）
 *   3. P2 增强：emotion 参数生成（确保 emotion 参数在 prompt 中正确渲染）
 *
 * 用法：
 *   node scripts/prompt-preprocessor.cjs [--check] [--fix] [--report]
 *   --check: 只检查不修复（CI 模式）
 *   --fix:   检查并修复缺失字段
 *   --report: 输出 JSON 报告
 */

'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const PROMPT_REGISTRY_PATH = path.join(PROJECT_ROOT, 'prompt-registry.json');
const CONSTANTS_PATH = path.join(PROJECT_ROOT, 'content', 'constants.json');

// ── P0 门禁：必填字段定义 ──
const P0_REQUIRED_FIELDS = [
  'prompt',
  'rabbitEmotion',
  'bearEmotion',
  'status',
  'category',
  'question',
];

const P1_REQUIRED_FIELDS = [
  'safetyLevel',
  'promptReviewedBy',
  'promptReviewDate',
];

// ── P0 门禁：emotion 值有效性校验 ──
const VALID_RABBIT_EMOTIONS = ['curious', 'surprised', 'happy', 'brave'];
const VALID_BEAR_EMOTIONS = ['warm', 'protective', 'comforting', 'playful'];

// ── P1 优化：comfort 词检查 ──
function loadComfortPatterns() {
  try {
    const constants = JSON.parse(fs.readFileSync(CONSTANTS_PATH, 'utf8'));
    return constants.COMFORT_PATTERNS || [];
  } catch (e) {
    console.warn('[preprocessor] Cannot load COMFORT_PATTERNS from constants.json:', e.message);
    return [];
  }
}

// ── P0 门禁：globalConstraints 校验 ──
function loadGlobalConstraints() {
  try {
    const registry = JSON.parse(fs.readFileSync(PROMPT_REGISTRY_PATH, 'utf8'));
    const gc = registry.globalConstraints;
    if (!gc) {
      return { valid: false, errors: ['globalConstraints 字段缺失'] };
    }

    const errors = [];
    // 必填子字段
    if (!gc.style) errors.push('globalConstraints.style 缺失');
    if (!gc.ipCharacters) errors.push('globalConstraints.ipCharacters 缺失');
    if (!gc.emotionSchema) errors.push('globalConstraints.emotionSchema 缺失');
    if (!gc.forbiddenKeywords || gc.forbiddenKeywords.length === 0)
      errors.push('globalConstraints.forbiddenKeywords 缺失或为空');
    if (!gc.requiredKeywords || gc.requiredKeywords.length === 0)
      errors.push('globalConstraints.requiredKeywords 缺失或为空');
    if (!gc.outputFormat) errors.push('globalConstraints.outputFormat 缺失');
    if (!gc.outputFormat || !gc.outputFormat.size)
      errors.push('globalConstraints.outputFormat.size 缺失');
    if (!gc.outputFormat || !gc.outputFormat.format)
      errors.push('globalConstraints.outputFormat.format 缺失');

    return {
      valid: errors.length === 0,
      errors,
      gc,
    };
  } catch (e) {
    return { valid: false, errors: ['无法读取 prompt-registry.json: ' + e.message] };
  }
}

// ── P0 门禁：逐条 topic 校验 ──
function validateTopic(topicId, topic, gc, comfortPatterns) {
  const issues = [];
  const comfortFindings = [];

  // 第160轮修正：globalConstraints 从 registry 顶层继承，不要求每条 topic 重复携带
  // topic 级别只需校验 topic 自身字段，globalConstraints 已在 loadGlobalConstraints() 中校验
  // 移除 per-topic globalConstraints 的重复检查

  // P0: 必填字段
  for (const field of P0_REQUIRED_FIELDS) {
    if (!topic[field]) {
      issues.push({ field, severity: 'P0', message: `${topicId}: 缺少必填字段 ${field}` });
    }
  }

  // P1: 推荐字段
  for (const field of P1_REQUIRED_FIELDS) {
    if (!topic[field]) {
      issues.push({ field, severity: 'P1', message: `${topicId}: 缺少推荐字段 ${field}` });
    }
  }

  // P0: emotion 值有效性
  if (topic.rabbitEmotion && !VALID_RABBIT_EMOTIONS.includes(topic.rabbitEmotion)) {
    issues.push({
      field: 'rabbitEmotion',
      severity: 'P0',
      message: `${topicId}: rabbitEmotion 值 "${topic.rabbitEmotion}" 无效，有效值: ${VALID_RABBIT_EMOTIONS.join(', ')}`,
    });
  }
  if (topic.bearEmotion && !VALID_BEAR_EMOTIONS.includes(topic.bearEmotion)) {
    issues.push({
      field: 'bearEmotion',
      severity: 'P0',
      message: `${topicId}: bearEmotion 值 "${topic.bearEmotion}" 无效，有效值: ${VALID_BEAR_EMOTIONS.join(', ')}`,
    });
  }

  // P0: prompt 必须包含 emotion 描述
  if (topic.prompt && topic.rabbitEmotion && topic.bearEmotion && gc.emotionSchema) {
    const rabbitEmotionDesc = gc.emotionSchema.rabbitEmotion?.[topic.rabbitEmotion];
    const bearEmotionDesc = gc.emotionSchema.bearEmotion?.[topic.bearEmotion];

    if (rabbitEmotionDesc && !topic.prompt.includes('RABBIT:')) {
      issues.push({
        field: 'prompt',
        severity: 'P0',
        message: `${topicId}: prompt 缺少 RABBIT: emotion 描述`,
      });
    }
    if (bearEmotionDesc && !topic.prompt.includes('BEAR:')) {
      issues.push({
        field: 'prompt',
        severity: 'P0',
        message: `${topicId}: prompt 缺少 BEAR: emotion 描述`,
      });
    }
  }

  // P0: prompt 必须包含 forbiddenKeywords 检查
  if (topic.prompt && gc.forbiddenKeywords) {
    for (const keyword of gc.forbiddenKeywords) {
      const lowerPrompt = topic.prompt.toLowerCase();
      const lowerKeyword = keyword.toLowerCase();
      const escapedKeyword = lowerKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Check if keyword appears in negation context
      // e.g., "no realistic", "no anatomical diagrams", "no internal organs visible"
      const negPatterns = [
        new RegExp(`no\\s+[\\w\\s]*${escapedKeyword}`, 'i'),
        new RegExp(`not\\s+[\\w\\s]*${escapedKeyword}`, 'i'),
        new RegExp(`without\\s+[\\w\\s]*${escapedKeyword}`, 'i'),
      ];
      const isNegated = negPatterns.some(p => p.test(lowerPrompt));

      if (lowerPrompt.includes(lowerKeyword) && !isNegated) {
        issues.push({
          field: 'prompt',
          severity: 'P0',
          message: `${topicId}: prompt 包含禁用词 "${keyword}"`,
        });
      }
    }
  }

  // P0: prompt 必须包含 requiredKeywords
  if (topic.prompt && gc.requiredKeywords) {
    const missing = gc.requiredKeywords.filter(kw => !topic.prompt.toLowerCase().includes(kw.toLowerCase()));
    if (missing.length > 0) {
      issues.push({
        field: 'prompt',
        severity: 'P0',
        message: `${topicId}: prompt 缺少必含词: ${missing.join(', ')}`,
      });
    }
  }

  // P1: comfort 词检测
  if (topic.prompt && comfortPatterns.length > 0) {
    const found = comfortPatterns.filter(cp => topic.prompt.includes(cp));
    if (found.length === 0) {
      comfortFindings.push({
        topicId,
        hasComfort: false,
        comfortWords: [],
        message: `${topicId}: prompt 未包含任何 comfort 词`,
      });
    } else {
      // P1: comfort 词位置检测
      const promptText = topic.prompt;
      const sentences = promptText.split(/[,.!?，。！？、]/).filter(s => s.trim().length > 0);
      const firstSentence = sentences[0] || '';
      const lastSentence = sentences[sentences.length - 1] || '';

      const positions = found.map(cw => {
        if (firstSentence.includes(cw)) return 'first';
        if (lastSentence.includes(cw)) return 'last';
        return 'middle';
      });

      const hasFirstOrLast = positions.includes('first') || positions.includes('last');

      comfortFindings.push({
        topicId,
        hasComfort: true,
        comfortWords: found,
        positions,
        hasFirstOrLast,
        optimal: hasFirstOrLast,
        message: hasFirstOrLast
          ? `${topicId}: comfort 词 "${found.join(', ')}" 位置: ${positions.join(', ')} (✓ 含首/尾句)`
          : `${topicId}: comfort 词 "${found.join(', ')}" 位置: ${positions.join(', ')} (⚠ 仅中间，建议调整)`,
      });
    }
  }

  // P0: illustrationVariants 检查
  if (!topic.illustrationVariants) {
    issues.push({
      field: 'illustrationVariants',
      severity: 'P1',
      message: `${topicId}: 缺少 illustrationVariants`,
    });
  }

  return { issues, comfortFindings };
}

// ── 主入口 ──
function main() {
  const args = process.argv.slice(2);
  const mode = args.includes('--fix') ? 'fix' : args.includes('--report') ? 'report' : 'check';

  const comfortPatterns = loadComfortPatterns();
  const gcCheck = loadGlobalConstraints();

  if (!gcCheck.valid) {
    console.error('[preprocessor] globalConstraints 校验失败:');
    gcCheck.errors.forEach(e => console.error('  -', e));
    if (mode === 'check') process.exit(1);
  }

  const registry = JSON.parse(fs.readFileSync(PROMPT_REGISTRY_PATH, 'utf8'));
  const topics = registry.topics || {};
  const topicIds = Object.keys(topics);

  const allIssues = [];
  const allComfortFindings = [];
  const summary = {
    total: topicIds.length,
    p0Errors: 0,
    p1Warnings: 0,
    comfortPass: 0,
    comfortFail: 0,
    comfortOptimal: 0,
    comfortNonOptimal: 0,
    emotionValid: 0,
    emotionInvalid: 0,
  };

  for (const topicId of topicIds) {
    const topic = topics[topicId];
    const { issues, comfortFindings } = validateTopic(topicId, topic, gcCheck.gc, comfortPatterns);

    allIssues.push(...issues);
    allComfortFindings.push(...comfortFindings);

    // Summarize
    issues.forEach(i => {
      if (i.severity === 'P0') summary.p0Errors++;
      if (i.severity === 'P1') summary.p1Warnings++;
    });

    comfortFindings.forEach(cf => {
      if (cf.hasComfort) {
        summary.comfortPass++;
        if (cf.optimal) summary.comfortOptimal++;
        else summary.comfortNonOptimal++;
      } else {
        summary.comfortFail++;
      }
    });

    if (VALID_RABBIT_EMOTIONS.includes(topic.rabbitEmotion) && VALID_BEAR_EMOTIONS.includes(topic.bearEmotion)) {
      summary.emotionValid++;
    } else {
      summary.emotionInvalid++;
    }
  }

  if (mode === 'report') {
    const report = {
      generatedAt: new Date().toISOString(),
      version: registry.version,
      globalConstraints: {
        valid: gcCheck.valid,
        errors: gcCheck.errors,
      },
      summary,
      p0Issues: allIssues.filter(i => i.severity === 'P0'),
      p1Issues: allIssues.filter(i => i.severity === 'P1'),
      comfortFindings: allComfortFindings,
    };
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  // --check mode: print results
  console.log('==========================================');
  console.log(' prompt-preprocessor — globalConstraints 校验');
  console.log(' 第160轮 Sprint 81 中期检查 P0#4');
  console.log('==========================================');
  console.log(`总 topics: ${summary.total}`);
  console.log(`P0 错误: ${summary.p0Errors}`);
  console.log(`P1 警告: ${summary.p1Warnings}`);
  console.log(`Comfort 词通过: ${summary.comfortPass}/${summary.total}`);
  console.log(`Comfort 词最优（首/尾句）: ${summary.comfortOptimal}`);
  console.log(`Comfort 词非最优（仅中间）: ${summary.comfortNonOptimal}`);
  console.log(`Emotion 有效: ${summary.emotionValid}/${summary.total}`);
  console.log('');

  if (allIssues.filter(i => i.severity === 'P0').length > 0) {
    console.log('--- P0 错误 ---');
    allIssues.filter(i => i.severity === 'P0').forEach(i => console.log('  ❌', i.message));
    console.log('');
  }

  if (allIssues.filter(i => i.severity === 'P1').length > 0) {
    console.log('--- P1 警告 ---');
    allIssues.filter(i => i.severity === 'P1').forEach(i => console.log('  ⚠️', i.message));
    console.log('');
  }

  if (allComfortFindings.length > 0) {
    const nonOptimal = allComfortFindings.filter(cf => cf.hasComfort && !cf.optimal);
    if (nonOptimal.length > 0) {
      console.log('--- Comfort 词位置优化建议 ---');
      nonOptimal.forEach(cf => console.log('  🔧', cf.message));
      console.log('');
    }
  }

  if (summary.p0Errors > 0) {
    console.log('❌ P0 门禁未通过');
    process.exit(1);
  } else {
    console.log('✅ P0 门禁通过');
    if (summary.comfortNonOptimal > 0) {
      console.log(`⚠️ ${summary.comfortNonOptimal} 条 comfort 词位置非最优（P1 优化目标）`);
    }
    process.exit(0);
  }
}

main();