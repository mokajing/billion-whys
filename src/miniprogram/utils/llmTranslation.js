// V8.26 第94轮 Sprint 35：MP 端 LLM 翻译流水线客户端协议层预埋（与 H5 src/h5/utils/llmTranslation.js 同构）
// Why: 北极星漏斗第20阶「LLM 翻译流水线客户端协议层预埋」；V9 出海 LocaleSwitcher 翻 flag 前的内容侧闸
// 与 src/h5/utils/llmTranslation.js 同构 — 单一 schema 双端共享，避免漂移
// 法务张律红线：禁 deviceId/ip/location/userId/email/phone/mac/imei/idfa/oaid；FeatureFlag 默认 false
// 安全李姐：MAX_TRANSLATION_BATCH_SIZE_BYTES=32KB；HTTPS_ONLY 硬编码；客户端不缓存 LLM 输出
// CCO 文若水：layerContentHash（djb2）让 V9 LLM 重训逐层比对，省成本
// AI 小智：sourceLocale/targetLocale 显式分字段 — V9 多对翻译不必改 schema
// CPO 叶用户：TRANSLATION_ACCESS_CHECKLIST 本轮冻结 — V9 翻 flag 准入清单
// 毒舌老王：evaluateAccessChecklist 返回 {allPassed, blockers, ready} 三字段
// 前端小凡：MP CommonJS 模块，与 cloudSync/i18n 同型；不引新依赖

const LLM_TRANSLATION_VERSION = 1
const TRANSLATION_REQUEST_TYPE = 'qa.layer.translation'

// V8.26 Sprint 35：FeatureFlag — V9 翻 LocaleSwitcher flag 前的最后一道客户端内容侧闸
// 法务张律红线：默认 false；任何 V9 上线动作必须有显式代码改动
let LLM_TRANSLATION_PIPELINE_ENABLED = false
function isLLMTranslationEnabled() {
  return LLM_TRANSLATION_PIPELINE_ENABLED === true
}
function _setLLMTranslationEnabled(v) {
  LLM_TRANSLATION_PIPELINE_ENABLED = v === true
}

const MAX_TRANSLATION_BATCH_SIZE_BYTES = 32 * 1024
const HTTPS_ONLY = true

const PAYLOAD_ALLOWED_FIELDS = [
  'schemaVersion',
  'requestType',
  'questionId',
  'sourceLocale',
  'targetLocale',
  'layers',
  'layerContentHash',
  'idempotencyKey',
  'appVersion',
  'requestedAt',
]

const PAYLOAD_FORBIDDEN_FIELDS = [
  'deviceId',
  'device_id',
  'ip',
  'location',
  'userId',
  'user_id',
  'email',
  'phone',
  'avatar',
  'mac',
  'imei',
  'idfa',
  'oaid',
]

// V8.26 Sprint 35：server 端接收接口设计草案（后端老稳 + AI 小智）
// 不发请求 — 仅作为客户端协议契约
//   POST /api/v1/llmTranslation/translate
//   Headers: 与 cloudSync 同型 + Idempotency-Key
//   Body: buildTranslationRequest() 输出
//   Response 200: { translated, cached, layers }
//   4xx 不重试 / 5xx + 429 重试 / Rate limit 5 req/min per device / HTTPS Only
//   Cache: server 端 24h Idempotency-Key 去重 + layerContentHash 增量翻译
var SERVER_ENDPOINT_DESIGN = {
  method: 'POST',
  path: '/api/v1/llmTranslation/translate',
  httpsOnly: HTTPS_ONLY,
  headers: [
    'Content-Type: application/json',
    'X-Bw-SchemaVersion: 1',
    'X-Bw-AppVersion',
    'X-Bw-Locale',
    'X-Bw-Region',
    'Idempotency-Key',
  ],
  rateLimitPerMinute: 5,
  responseShape: { translated: 'number', cached: 'number', layers: 'object' },
}

// V8.26 Sprint 35：V9 LocaleSwitcher 翻 flag 准入清单（CPO 叶用户 + 法务张律冻结）
var TRANSLATION_ACCESS_CHECKLIST = [
  {
    id: 'i18n_content_coverage',
    criterion: 'i18n 内容覆盖 ≥80% (≥217/271 条 en)',
    current: '0/271 (zh-only)',
    target: '≥217/271',
    owner: 'CPO 叶用户 + AI 小智',
  },
  {
    id: 'i18n_dict_coverage',
    criterion: 'i18n DICT 100% en 覆盖',
    current: '182/182 (UI chrome 已全 en，内容未译)',
    target: '182/182 + 内容 ≥80%',
    owner: 'CPO 叶用户',
  },
  {
    id: 'llm_pipeline_ready',
    criterion: 'LLM 翻译流水线 server 端就绪',
    current: 'client 协议层预埋完毕 (Sprint 35)，server 端 V9 待实现',
    target: 'server 端实现 + 5 req/min rate limit + 24h Idempotency-Key 去重',
    owner: '后端老稳 + AI 小智',
  },
  {
    id: 'locale_region_routing',
    criterion: 'locale→region 路由配套 (X-Bw-Region header)',
    current: 'header 占位，无路由逻辑',
    target: 'locale→region 路由表 + 多租户分区',
    owner: 'Global 何 + 后端老稳',
  },
  {
    id: 'legal_review_passed',
    criterion: '法务终审通过 (翻译输出 + 隐私政策 en 版)',
    current: 'privacy 政策正文 i18n 已收口 (V8.23)，翻译输出未审',
    target: 'CCO + 法务张律 + 心理学家周教授 联合评审通过',
    owner: '法务张律 + CCO 文若水',
  },
  {
    id: 'cost_evaluation_passed',
    criterion: 'LLM 翻译流水线成本评估通过 (271×3层 token 估算)',
    current: '未评估',
    target: 'CFO 成本评估草案 + ROI 可持续结论',
    owner: 'CFO 钱守正 + AI 小智',
  },
]

function shallowSafeClone(value) {
  if (value === null || typeof value !== 'object') return value
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return null
  }
}

// 法务张律守卫：递归扫描对象，发现禁用字段则抛错（与 H5 同算法）
function assertNoForbiddenFields(obj, path) {
  path = path || 'root'
  if (obj === null || typeof obj !== 'object') return
  if (Array.isArray(obj)) {
    for (var i = 0; i < obj.length; i++) {
      assertNoForbiddenFields(obj[i], path + '[' + i + ']')
    }
    return
  }
  for (var key in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue
    if (PAYLOAD_FORBIDDEN_FIELDS.indexOf(key) !== -1) {
      throw new Error('[llmTranslation] forbidden field "' + key + '" at ' + path + ' — 法务张律红线')
    }
    assertNoForbiddenFields(obj[key], path + '.' + key)
  }
}

// AI 小智选型：djb2 哈希 — 够快、够稳定、无依赖
// CCO 文若水：layerContentHash 让 V9 决定是否需重译，避免无意义重算和成本浪费
function computeLayerContentHash(text) {
  var s = String(text || '')
  var hash = 5381
  for (var i = 0; i < s.length; i++) {
    hash = (hash * 33) ^ s.charCodeAt(i)
    hash = hash & 0xffffffff
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

// V8.26 Sprint 35：generateIdempotencyKey() — 与 cloudSync 同算法（UUIDv4），独立声明避免耦合
// MP 无 crypto.randomUUID，直接走兜底
function generateIdempotencyKey() {
  var hex = '0123456789abcdef'
  var s = ''
  for (var i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      s += '-'
    } else if (i === 14) {
      s += '4'
    } else if (i === 19) {
      s += hex[(Math.random() * 4) | 8]
    } else {
      s += hex[(Math.random() * 16) | 0]
    }
  }
  return s
}

// V8.26 Sprint 35：buildTranslationRequest() — 协议契约函数（CTO 陈架构 + 后端老稳）
// 输入: { questionId, sourceLocale, targetLocale, layers: { layer1:{text}, layer2:{text}, layer3:{text} } }
// 输出: 冻结 schema 的 payload（含 layerContentHash + idempotencyKey）
function buildTranslationRequest(input, meta) {
  input = input || {}
  meta = meta || {}
  var questionId = input.questionId
  var sourceLocale = input.sourceLocale
  var targetLocale = input.targetLocale
  var layers = input.layers
  if (!questionId) throw new Error('[llmTranslation] questionId required')
  if (!sourceLocale) throw new Error('[llmTranslation] sourceLocale required')
  if (!targetLocale) throw new Error('[llmTranslation] targetLocale required')
  if (!layers || typeof layers !== 'object') {
    throw new Error('[llmTranslation] layers object required')
  }

  var layerText = {
    layer1: String((layers.layer1 && layers.layer1.text) || ''),
    layer2: String((layers.layer2 && layers.layer2.text) || ''),
    layer3: String((layers.layer3 && layers.layer3.text) || ''),
  }

  var layerContentHash = {
    layer1: computeLayerContentHash(layerText.layer1),
    layer2: computeLayerContentHash(layerText.layer2),
    layer3: computeLayerContentHash(layerText.layer3),
  }

  var payload = {
    schemaVersion: LLM_TRANSLATION_VERSION,
    requestType: TRANSLATION_REQUEST_TYPE,
    questionId: String(questionId),
    sourceLocale: String(sourceLocale),
    targetLocale: String(targetLocale),
    layers: shallowSafeClone(layerText),
    layerContentHash: layerContentHash,
    idempotencyKey: generateIdempotencyKey(),
    appVersion: String(meta.appVersion || ''),
    requestedAt: Number(meta.requestedAt) || Date.now(),
  }

  assertNoForbiddenFields(payload)
  return payload
}

// V8.26 Sprint 35：buildServerHeaders(meta) — 与 cloudSync 同型，独立声明避免耦合
function buildServerHeaders(meta) {
  meta = meta || {}
  var appVersion = String(meta.appVersion || 'unknown')
  var locale = String(meta.sourceLocale || meta.locale || 'zh')
  var region = String(meta.region || '')
  var headers = {
    'Content-Type': 'application/json',
    'X-Bw-SchemaVersion': String(LLM_TRANSLATION_VERSION),
    'X-Bw-AppVersion': appVersion,
    'X-Bw-Locale': locale,
    'Idempotency-Key': generateIdempotencyKey(),
  }
  if (region) {
    headers['X-Bw-Region'] = region
  }
  return headers
}

// V8.26 Sprint 35：evaluateAccessChecklist(status) — V9 翻 LocaleSwitcher flag 准入评估
// 毒舌老王：返回 {allPassed, blockers, ready} 三字段就够
function evaluateAccessChecklist(status) {
  status = status || {}
  var blockers = []
  for (var i = 0; i < TRANSLATION_ACCESS_CHECKLIST.length; i++) {
    var item = TRANSLATION_ACCESS_CHECKLIST[i]
    if (!status[item.id]) {
      blockers.push(item.id)
    }
  }
  var allPassed = blockers.length === 0
  return {
    allPassed: allPassed,
    blockers: blockers,
    ready: allPassed,
  }
}

// V8.26 Sprint 35：translateReal() — 设计文档式 stub（仍零网络）
function translateReal(_request, _options) {
  if (!isLLMTranslationEnabled()) {
    return Promise.resolve({
      translated: false,
      reason: 'feature-flag-off',
      serverEndpoint: SERVER_ENDPOINT_DESIGN.path,
      httpsOnly: HTTPS_ONLY,
      cached: 0,
      layers: null,
    })
  }
  return Promise.resolve({
    translated: false,
    reason: 'v9-pending',
    serverEndpoint: SERVER_ENDPOINT_DESIGN.path,
    httpsOnly: HTTPS_ONLY,
    cached: 0,
    layers: null,
  })
}

module.exports = {
  LLM_TRANSLATION_VERSION,
  TRANSLATION_REQUEST_TYPE,
  MAX_TRANSLATION_BATCH_SIZE_BYTES,
  HTTPS_ONLY,
  PAYLOAD_ALLOWED_FIELDS,
  PAYLOAD_FORBIDDEN_FIELDS,
  SERVER_ENDPOINT_DESIGN,
  TRANSLATION_ACCESS_CHECKLIST,
  isLLMTranslationEnabled,
  _setLLMTranslationEnabled,
  assertNoForbiddenFields,
  computeLayerContentHash,
  generateIdempotencyKey,
  buildTranslationRequest,
  buildServerHeaders,
  evaluateAccessChecklist,
  translateReal,
}
