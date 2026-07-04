// V8.42 第106轮 Sprint 51：MP 端 CFO 成本签字决议事实常量（与 H5 src/h5/utils/costSignoff.js 同构）
// Why: CEO 周远见 — Sprint 50 裁决转向 V9 真实化主线，readiness 第 3 项 CFO 签字是本周到期 P0。
//       与 src/h5/utils/costSignoff.js 同构 — 单一 schema 双端共享，避免漂移。
// CFO 钱守正：真实读数 271 题全量一次性翻译 ¥5.86、人均 ¥0.059（阈值 ¥2.5 的 1/42）、盈亏平衡 3 用户 → approved。
// 法务张律红线：零身份字段、零网络请求、零 flag 翻动；签字 ≠ 上线（V9_REALIZATION_MAINLINE_ENABLED 仍 false）。
// 前端小凡：MP CommonJS 模块，与 cloudSync/i18n/llmTranslation/realizationReadiness 同型；不引新依赖。

const CFO_COST_SIGNOFF = Object.freeze({
  signoffId: 'cfo-cost-signoff-sprint51',
  signedBy: 'CFO 钱守正',
  signedAtSprint: 51,
  signedAtVersion: '0.3.45',
  signedAtDate: '2026-07-03',
  decision: 'approved',
  basis: {
    sourceSprint: 36,
    sourceModule: 'llmTranslation.js#estimateTranslationCost',
    pricing: 'DEFAULT_PRICING_CNY',
    catalogSize: 271,
    targetLocales: ['en'],
  },
  evidence: {
    totalTokens: 73272,
    estimatedCostCNY: 5.8618,
    costPerUserCNY: 0.0586,
    sustainabilityThresholdCNY: 2.5,
    breakEvenUsers: 3,
    sustainable: true,
    vendorComparison: {
      cheapestVendorId: 'deepseek-v3',
      cheapestCostCNY: 0.1099,
      allSustainable: true,
      vendors: [
        { vendorId: 'deepseek-v3', estimatedCostCNY: 0.1099, sustainable: true },
        { vendorId: 'qwen-plus', estimatedCostCNY: 0.5862, sustainable: true },
        { vendorId: 'gpt-4o', estimatedCostCNY: 2.0516, sustainable: true },
      ],
    },
  },
  conditions: [
    {
      id: 'vendor-tier',
      text: 'V9 上线优先选 deepseek-v3 或同等性价比厂商（gpt-4o 成本 18 倍，仅在质量不达标时升级）',
    },
    {
      id: 'cache-strategy',
      text: 'runtime 侧须复用 layerContentHash 比对 + cloudSync 重试退避，不得对单个孩子提问触发实时全量翻译；cache 命中率随时间推移须 ≥0.3',
    },
  ],
  scope: 'zh→en 一次性全量库翻译（271 题），新增 locale/题目须重审',
  refVersion: '0.3.45',
})

function isCfoCostSignedOff(signoff) {
  const record = signoff === undefined ? CFO_COST_SIGNOFF : signoff
  return !!(record && record.decision === 'approved')
}

function getCostSignoffSummary(signoff) {
  const record = signoff === undefined ? CFO_COST_SIGNOFF : signoff
  return {
    signoffId: record.signoffId,
    decision: record.decision,
    signedAtSprint: record.signedAtSprint,
    sustainable: record.evidence && record.evidence.sustainable,
    estimatedCostCNY: record.evidence && record.evidence.estimatedCostCNY,
    costPerUserCNY: record.evidence && record.evidence.costPerUserCNY,
    conditionCount: Array.isArray(record.conditions) ? record.conditions.length : 0,
  }
}

module.exports = {
  CFO_COST_SIGNOFF,
  isCfoCostSignedOff,
  getCostSignoffSummary,
}
