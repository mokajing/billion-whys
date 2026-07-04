// V8.44 第108轮 Sprint 53：MP 端 zh 源文 81% 漂移收紧 271×3 重写评估 + V9 i18n 证据链第三块落地
// 与 src/h5/utils/zhDriftRewriteEvaluation.js 同构 — 单一 schema 双端共享，避免漂移
// Why: CEO 周远见 — Sprint 52 冻结字数契约后 readiness 4 项仍卡后端；唯一可纯客户端落地的 V9 主线动作 =
//       收口 P1「zh 内容 81% 漂移收紧 271×3 重写评估」，把 CCO 口头裁决升级为带真实读数 + 成本量化的证据模块。
// 法务张律红线：零身份字段、零网络请求、零 flag 翻动（V9_REALIZATION_MAINLINE_ENABLED 仍 false）；ZH_DRIFT_REWRITE_DECISION 是决议事实常量。
// 前端小凡：MP CommonJS 模块，与 layerWordCountContract/realizationReadiness/costSignoff 同型；复用 contract validateLayerAnswer 计数；不引新依赖。
// 测试虫虫：双端同构 export 名一致（ZH_DRIFT_REWRITE_DECISION / evaluateZhDrift / getRewriteDecision / summarizeDrift）。

var contract = require('./layerWordCountContract')
var LAYER_WORD_COUNT_CONTRACT = contract.LAYER_WORD_COUNT_CONTRACT
var validateLayerAnswer = contract.validateLayerAnswer

function _deepFreeze(obj) {
  if (obj && typeof obj === 'object') {
    Object.getOwnPropertyNames(obj).forEach((p) => _deepFreeze(obj[p]))
    Object.freeze(obj)
  }
  return obj
}

var ZH_DRIFT_REWRITE_DECISION = _deepFreeze({
  decisionId: 'zh-drift-rewrite-decision-sprint53',
  frozenAtSprint: 53,
  frozenAtVersion: '0.3.47',
  frozenAtDate: '2026-07-03',
  contractRef: 'layer-word-count-contract-sprint52',
  scope: 'zh-CN 源文 271 题 × 三层回答漂移评估与重写决策；en 派生不在本轮 scope',
  decision: 'keep-dual-contract',
  rationale:
    '271×3 全部 overMax=0（全过 max 硬闸），无注意力窗口/心理伤害风险；rewrite-to-target 需砍 L2 5380 字（占 L2 总量 28%），' +
    '牺牲真实内容密度换一个非阻断愿景 target，无 V9 ROI；layerContentHash 比对前提是源文冻结，本轮冻结 zh 源文基线',
  readout: {
    catalogSize: 271,
    L1: { avgChars: 30.4, maxChars: 56, overTargetCount: 137, overMaxCount: 0 },
    L2: { avgChars: 70.5, maxChars: 116, overTargetCount: 219, overMaxCount: 0 },
    L3: { avgChars: 82.1, maxChars: 132, overTargetCount: 154, overMaxCount: 0 },
    allPassMax: true,
  },
  rewriteCostEstimate: {
    layersNeedingRewrite: [1, 2, 3],
    L2CharsToTrim: 5380,
    L2ContentLossRatio: 0.28,
    totalAnswersToTouch: 813,
    estimatedPersonHours: 40,
    recommendation: 'do-not-pursue-until-v9-content-revision-cycle',
  },
})

function evaluateZhDrift(questions) {
  var list = Array.isArray(questions) ? questions : []
  var byLayer = {}
  var totals = { audited: 0, overTarget: 0, overMax: 0 }
  for (var li = 0; li < 3; li++) {
    var layer = li + 1
    var key = 'layer' + layer
    var stats = { layer: layer, audited: 0, overTargetCount: 0, overMaxCount: 0, totalChars: 0, maxChars: 0 }
    for (var qi = 0; qi < list.length; qi++) {
      var q = list[qi]
      var block = q && q[key]
      var answer = block && typeof block.answer === 'string' ? block.answer : ''
      var v = validateLayerAnswer(layer, answer, 'zh')
      if (!v || (v.ok === false && v.reason === 'unknown-layer-or-locale')) continue
      stats.audited += 1
      stats.totalChars += v.count
      if (v.count > v.max) stats.overMaxCount += 1
      if (!v.targetMet) stats.overTargetCount += 1
      if (v.count > stats.maxChars) stats.maxChars = v.count
    }
    stats.avgChars = stats.audited > 0 ? Math.round((stats.totalChars / stats.audited) * 10) / 10 : 0
    byLayer[layer] = stats
    totals.audited += stats.audited
    totals.overTarget += stats.overTargetCount
    totals.overMax += stats.overMaxCount
  }
  return {
    byLayer: byLayer,
    totals: totals,
    allPassMax: totals.overMax === 0,
    overMaxCount: totals.overMax,
  }
}

function getRewriteDecision() {
  return ZH_DRIFT_REWRITE_DECISION
}

function summarizeDrift(evaluation) {
  var e = evaluation || evaluateZhDrift([])
  var t = e.totals || {}
  var questions = (e.byLayer && e.byLayer[1] && e.byLayer[1].audited) || 0
  return 'zh 源文 ' + questions + ' 题（' + (t.audited || 0) + ' 条三层审计）：' + (t.overTarget || 0) + ' 条超 target 愿景、' + (t.overMax || 0) + ' 条超 max 硬闸' + (e.allPassMax ? '（全部过 max，基线冻结）' : '（存在超 max，需修）')
}

module.exports = {
  ZH_DRIFT_REWRITE_DECISION,
  evaluateZhDrift,
  getRewriteDecision,
  summarizeDrift,
}
