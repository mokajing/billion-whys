// V8.45 第109轮 Sprint 54：MP 端 zh 内容增长与 i18n 源文基线脱钩治理（与 H5 src/h5/utils/contentBaselineEpoch.js 同构）
// Why: CEO 周远见 — Sprint 53 冻结的 271×3 zh 源文基线被测试以 evaluateZhDrift(ALL_QUESTIONS) 断言，把"i18n 源文基线快照"
//       与"live zh 内容库（DAQ 真实燃料，应可 append-only 增长）"耦合。本轮脱钩：baselineEpoch 字段分区，基线 271 冻结不动，新增走 append-only。
//       与 src/h5/utils/contentBaselineEpoch.js 同构 — 单一 schema 双端共享，避免漂移。
// 法务张律红线：零身份字段、零网络请求、零 flag 翻动；CONTENT_BASELINE 是决议事实常量（Object.freeze 不可篡改）。
// 前端小凡：MP CommonJS 模块，与 cloudSync/i18n/llmTranslation/realizationReadiness 同型；不引新依赖。

function _deepFreeze(obj) {
  if (obj && typeof obj === 'object') {
    Object.getOwnPropertyNames(obj).forEach(function (p) {
      _deepFreeze(obj[p])
    })
    Object.freeze(obj)
  }
  return obj
}

var CONTENT_BASELINE_EPOCH = 'sprint53-271'
var POST_BASELINE_EPOCH = 'post-sprint53'

var CONTENT_BASELINE = _deepFreeze({
  epoch: 'sprint53-271',
  catalogSize: 271,
  totalAnswers: 813, // 271 × 3
  frozenAtSprint: 53,
  frozenAtVersion: '0.3.47',
  frozenAtDate: '2026-07-03',
  discriminatorField: 'baselineEpoch',
  postBaselineEpochValue: 'post-sprint53',
})

function isPostBaseline(q) {
  return !!(q && q.baselineEpoch === POST_BASELINE_EPOCH)
}

function partitionByBaseline(questions) {
  var list = Array.isArray(questions) ? questions : []
  var baseline = []
  var postBaseline = []
  for (var i = 0; i < list.length; i++) {
    var q = list[i]
    if (isPostBaseline(q)) postBaseline.push(q)
    else baseline.push(q)
  }
  return {
    baseline: baseline,
    postBaseline: postBaseline,
    baselineSize: baseline.length,
    postBaselineSize: postBaseline.length,
  }
}

function getBaselineQuestions(questions) {
  return partitionByBaseline(questions).baseline
}

function getPostBaselineQuestions(questions) {
  return partitionByBaseline(questions).postBaseline
}

function summarizeBaselinePartition(partition) {
  var p = partition || partitionByBaseline([])
  return 'zh catalog ' + (p.baselineSize + p.postBaselineSize) + ' 题：基线 ' + p.baselineSize + '（' + CONTENT_BASELINE.epoch + '，冻结供 en hash 比对）+ 基线后扩展 ' + p.postBaselineSize + '（append-only ' + POST_BASELINE_EPOCH + '，走 max 硬闸）'
}

module.exports = {
  CONTENT_BASELINE_EPOCH,
  POST_BASELINE_EPOCH,
  CONTENT_BASELINE,
  isPostBaseline,
  partitionByBaseline,
  getBaselineQuestions,
  getPostBaselineQuestions,
  summarizeBaselinePartition,
}
