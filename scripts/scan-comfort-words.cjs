#!/usr/bin/env node
/**
 * scan-comfort-words.cjs
 * 第159轮 Sprint 81 Kickoff — P0#2: body-001~050 comfort 词密度深度扫描（含位置检测）
 * 测试虫虫 + CTO陈架构 + 周教授
 *
 * Comfort 词位置检测：首句权重 > 尾句权重 > 中间权重
 * P0 门禁 = has_comfort（至少一个 comfort 词）
 * 密度阈值 0.08 降级为 P1 优化目标
 * 短文本（≤30字）放宽至 0.05
 *
 * 用法：
 *   node scripts/scan-comfort-words.cjs [--range body-001-050] [--all] [--report]
 *   --range: 扫描指定范围（默认 body-001~050）
 *   --all:   扫描全部 304 条
 *   --report: 输出 JSON 报告
 */

'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const CONSTANTS_PATH = path.join(PROJECT_ROOT, 'content', 'constants.json');
const CONTENT_DIR = path.join(PROJECT_ROOT, 'content', 'seed-library');

const CATEGORIES = ['animals', 'body', 'food', 'home', 'nature', 'society'];

// ── 配置 ──
const COMFORT_CONFIG = {
  densityThreshold: 0.08,
  shortTextThreshold: 0.05,
  shortTextMaxChars: 30,
  gateRule: 'has_comfort',
};

// ── 加载 comfort 词 ──
function loadComfortPatterns() {
  const constants = JSON.parse(fs.readFileSync(CONSTANTS_PATH, 'utf8'));
  return constants.COMFORT_PATTERNS || [];
}

// ── 加载内容 ──
function loadAllQuestions() {
  const allQuestions = [];
  for (const cat of CATEGORIES) {
    const filePath = path.join(CONTENT_DIR, cat + '.json');
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      allQuestions.push(...data);
    }
  }
  return allQuestions;
}

// ── 切分句子 ──
function splitSentences(text) {
  return text.split(/[.。!！?？、，,;；\n]/).filter(s => s.trim().length > 0);
}

// ── comfort 词分析 ──
function analyzeComfort(text, comfortPatterns, config) {
  const foundWords = comfortPatterns.filter(cp => text.includes(cp));
  const sentences = splitSentences(text);
  const firstSentence = sentences[0] || '';
  const lastSentence = sentences[sentences.length - 1] || '';

  // 位置分析
  const positions = foundWords.map(cw => {
    if (firstSentence.includes(cw)) return 'first';
    if (lastSentence.includes(cw) && sentences.length > 1) return 'last';
    return 'middle';
  });

  const hasFirstOrLast = positions.includes('first') || positions.includes('last');

  // 密度计算
  const textLength = text.length;
  const density = textLength > 0 ? foundWords.length / textLength : 0;
  const isShortText = textLength <= config.shortTextMaxChars;
  const effectiveThreshold = isShortText ? config.shortTextThreshold : config.densityThreshold;

  // 门禁
  const gatePass = foundWords.length >= 1; // has_comfort
  const densityPass = density >= effectiveThreshold;

  // 评分
  let positionScore = 0;
  positions.forEach(p => {
    if (p === 'first') positionScore += 3;
    else if (p === 'last') positionScore += 2;
    else positionScore += 1;
  });

  return {
    hasComfort: foundWords.length > 0,
    comfortWords: foundWords,
    comfortCount: foundWords.length,
    positions,
    hasFirstOrLast,
    positionScore,
    textLength,
    density: parseFloat(density.toFixed(4)),
    isShortText,
    effectiveThreshold,
    gatePass,
    densityPass,
    optimal: gatePass && hasFirstOrLast,
    needsFix: !gatePass || !hasFirstOrLast,
    fixReason: !gatePass
      ? 'P0: 缺少 comfort 词'
      : !hasFirstOrLast
        ? 'P1: comfort 词位置偏后（不在首句或尾句）'
        : !densityPass
          ? `P1: comfort 词密度 ${density.toFixed(3)} < ${effectiveThreshold}`
          : null,
  };
}

// ── 主入口 ──
function main() {
  const args = process.argv.slice(2);
  const useAll = args.includes('--all');
  const useReport = args.includes('--report');

  const comfortPatterns = loadComfortPatterns();
  const allQuestions = loadAllQuestions();

  // 默认扫描 body-001~050，--all 扫描全部
  const targetQuestions = useAll
    ? allQuestions
    : allQuestions.filter(q => {
        const num = parseInt(q.id?.split('-')[1]);
        return q.id && q.category === 'body' && num >= 1 && num <= 50;
      });

  const results = [];
  const summary = {
    total: targetQuestions.length,
    gatePass: 0,
    gateFail: 0,
    densityPass: 0,
    densityFail: 0,
    optimal: 0,
    firstPosition: 0,
    lastPosition: 0,
    middleOnly: 0,
    noComfort: 0,
    avgDensity: 0,
    categories: {},
  };

  for (const q of targetQuestions) {
    const cat = q.category || 'unknown';
    if (!summary.categories[cat]) {
      summary.categories[cat] = { total: 0, gatePass: 0, optimal: 0 };
    }
    summary.categories[cat].total++;

    // 分析 L1 回答
    const l1Text = q.layer1?.answer || q.answer || '';
    const analysis = analyzeComfort(l1Text, comfortPatterns, COMFORT_CONFIG);

    if (analysis.gatePass) {
      summary.gatePass++;
      summary.categories[cat].gatePass++;
    } else {
      summary.gateFail++;
      summary.noComfort++;
    }

    if (analysis.densityPass) summary.densityPass++;
    else summary.densityFail++;

    if (analysis.optimal) {
      summary.optimal++;
      summary.categories[cat].optimal++;
    }

    if (analysis.positions.includes('first')) summary.firstPosition++;
    if (analysis.positions.includes('last')) summary.lastPosition++;
    if (analysis.hasComfort && !analysis.hasFirstOrLast) summary.middleOnly++;

    results.push({
      id: q.id,
      category: q.category,
      question: q.question,
      answer: l1Text.substring(0, 80) + (l1Text.length > 80 ? '...' : ''),
      analysis,
    });
  }

  // 平均密度
  const densities = results
    .filter(r => r.analysis.hasComfort)
    .map(r => r.analysis.density);
  summary.avgDensity = densities.length > 0
    ? parseFloat((densities.reduce((a, b) => a + b, 0) / densities.length).toFixed(4))
    : 0;

  if (useReport) {
    console.log(JSON.stringify({
      generatedAt: new Date().toISOString(),
      scanRange: useAll ? 'all (304)' : 'body-001~050',
      config: COMFORT_CONFIG,
      summary,
      gateFailItems: results.filter(r => !r.analysis.gatePass),
      nonOptimalItems: results.filter(r => r.analysis.hasComfort && !r.analysis.optimal),
      allResults: results,
    }, null, 2));
    return;
  }

  // ── 输出 ──
  console.log('==========================================');
  console.log(' Comfort 词密度深度扫描');
  console.log(' 第159轮 Sprint 81 Kickoff P0#2');
  console.log(` 扫描范围: ${summary.total} 条`);
  console.log('==========================================');
  console.log('');
  console.log('--- 摘要 ---');
  console.log(`总数: ${summary.total}`);
  console.log(`✅ P0 门禁通过 (has_comfort): ${summary.gatePass}/${summary.total}`);
  console.log(`❌ P0 门禁失败: ${summary.gateFail}/${summary.total}`);
  console.log(`✅ 密度达标: ${summary.densityPass}/${summary.total}`);
  console.log(`⚠️ 密度不达标: ${summary.densityFail}/${summary.total}`);
  console.log(`⭐ 最优 (有 comfort 词且首/尾句): ${summary.optimal}/${summary.total}`);
  console.log(`📊 首句 comfort: ${summary.firstPosition}`);
  console.log(`📊 尾句 comfort: ${summary.lastPosition}`);
  console.log(`🔧 仅中间 comfort: ${summary.middleOnly}`);
  console.log(`📈 平均 comfort 词密度: ${summary.avgDensity.toFixed(4)}`);
  console.log('');

  // P0 门禁失败项
  const gateFailItems = results.filter(r => !r.analysis.gatePass);
  if (gateFailItems.length > 0) {
    console.log('--- ❌ P0 门禁失败（无 comfort 词）---');
    gateFailItems.forEach(r => {
      console.log(`  ${r.id}: "${r.answer}"`);
    });
    console.log('');
  }

  // comfort 词位置偏后
  const nonOptimal = results.filter(r => r.analysis.hasComfort && !r.analysis.optimal);
  if (nonOptimal.length > 0) {
    console.log('--- 🔧 Comfort 词位置优化建议 ---');
    nonOptimal.forEach(r => {
      console.log(`  ${r.id}: comfort 词 "${r.analysis.comfortWords.join(', ')}" 位置: ${r.analysis.positions.join(', ')}`);
    });
    console.log('');
  }

  // 密度不达标
  const lowDensity = results.filter(r => r.analysis.hasComfort && !r.analysis.densityPass);
  if (lowDensity.length > 0) {
    console.log('--- ⚠️ Comfort 词密度不达标 ---');
    lowDensity.forEach(r => {
      console.log(`  ${r.id}: 密度 ${r.analysis.density.toFixed(4)} < ${r.analysis.effectiveThreshold} (${r.analysis.isShortText ? '短文本' : '标准'})`);
    });
    console.log('');
  }

  // 分类汇总
  console.log('--- 分类汇总 ---');
  for (const [cat, stats] of Object.entries(summary.categories)) {
    const pct = stats.total > 0 ? ((stats.gatePass / stats.total) * 100).toFixed(0) : 0;
    const optPct = stats.total > 0 ? ((stats.optimal / stats.total) * 100).toFixed(0) : 0;
    console.log(`  ${cat}: ${stats.gatePass}/${stats.total} (${pct}%) 门禁通过, ${stats.optimal}/${stats.total} (${optPct}%) 最优`);
  }

  console.log('');
  if (summary.gateFail > 0) {
    console.log('❌ P0 门禁未通过');
    process.exit(1);
  } else {
    console.log('✅ P0 门禁全部通过');
    if (summary.middleOnly > 0) {
      console.log(`⚠️ ${summary.middleOnly} 条 comfort 词位置偏后（P1 优化目标）`);
    }
    process.exit(0);
  }
}

main();