// V8.43 第107轮 Sprint 52：MP 端三层回答字数契约决议事实常量（与 H5 src/h5/utils/layerWordCountContract.js 同构）
// Why: CEO 周远见 — Sprint 51 CFO 签字落地后，readiness 第 4 项 i18n 英文内容生产的前置契约须客户端纯落地。
//       与 src/h5/utils/layerWordCountContract.js 同构 — 单一 schema 双端共享，避免漂移。
// CCO 文若水：zh 真实读数 271 题 L1 51%/L2 81%/L3 57% 超 30/50/80 愿景字数 → 双层契约（target 愿景 + max 硬上限）。
// 心理学家周教授：3 岁注意力窗口 < 30 秒，en L1 ≤ 22 词；max 按真实读数 95 分位 + headroom 冻结锁回归。
// 法务张律红线：零身份字段、零网络请求、零 flag 翻动；契约 ≠ 上线（V9_REALIZATION_MAINLINE_ENABLED 仍 false）。
// 不触发一票否决，反而要求必须落地作为 V9 i18n 生产准入合规证据链第二块。

function _deepFreeze(obj) {
  if (obj && typeof obj === 'object') {
    Object.getOwnPropertyNames(obj).forEach(function (p) {
      _deepFreeze(obj[p])
    })
    Object.freeze(obj)
  }
  return obj
}

var LAYER_WORD_COUNT_CONTRACT = _deepFreeze({
  contractId: 'layer-word-count-contract-sprint52',
  frozenAtSprint: 52,
  frozenAtVersion: '0.3.46',
  frozenAtDate: '2026-07-03',
  scope: 'zh-CN + en 三层回答（Layer1/2/3）字数生产准入契约；新增 locale 须重审派生',
  zhReadoutSnapshot: {
    catalogSize: 271,
    L1: { avgChars: 30.4, maxChars: 56, overTargetCount: 137 },
    L2: { avgChars: 70.5, maxChars: 116, overTargetCount: 219 },
    L3: { avgChars: 82.1, maxChars: 132, overTargetCount: 154 },
  },
  layers: {
    1: {
      ageBand: '3岁',
      zh: { unit: 'chars', target: 30, max: 60 },
      en: { unit: 'words', target: 22, max: 40 },
    },
    2: {
      ageBand: '4-5岁',
      zh: { unit: 'chars', target: 50, max: 120 },
      en: { unit: 'words', target: 38, max: 70 },
    },
    3: {
      ageBand: '5-6岁',
      zh: { unit: 'chars', target: 80, max: 140 },
      en: { unit: 'words', target: 60, max: 95 },
    },
  },
})

function getLayerBounds(layer, locale) {
  var layerKey = Number(layer)
  var entry = LAYER_WORD_COUNT_CONTRACT.layers[layerKey]
  if (!entry) return null
  var bound = entry[locale]
  if (!bound) return null
  return { layer: layerKey, locale: locale, unit: bound.unit, target: bound.target, max: bound.max }
}

function countChars(text) {
  if (!text || typeof text !== 'string') return 0
  return text.replace(/[\s\p{P}]/gu, '').length
}

function countWords(text) {
  if (!text || typeof text !== 'string') return 0
  return text
    .split(/\s+/)
    .map(function (t) {
      return t.replace(/[\p{P}]/gu, '')
    })
    .filter(function (t) {
      return t.length > 0
    }).length
}

function validateLayerAnswer(layer, text, locale) {
  var bounds = getLayerBounds(layer, locale)
  if (!bounds) {
    return { ok: false, reason: 'unknown-layer-or-locale', layer: layer, locale: locale, count: 0 }
  }
  var count = bounds.unit === 'chars' ? countChars(text) : countWords(text)
  var ok = count <= bounds.max
  return {
    ok: ok,
    layer: bounds.layer,
    locale: bounds.locale,
    unit: bounds.unit,
    count: count,
    target: bounds.target,
    max: bounds.max,
    targetMet: count <= bounds.target,
    overMaxBy: count > bounds.max ? count - bounds.max : 0,
  }
}

module.exports = {
  LAYER_WORD_COUNT_CONTRACT,
  getLayerBounds,
  validateLayerAnswer,
}
