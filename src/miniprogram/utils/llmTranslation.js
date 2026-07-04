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

// V8.27 第95轮 Sprint 36：LLM 翻译流水线成本评估草案（MP 端与 H5 同构）
// Why: TRANSLATION_ACCESS_CHECKLIST 第6项 cost_evaluation_passed 草案推进
// CFO 钱守正：LTV ¥50/用户，可持续阈值 LTV×5% = ¥2.5/用户；projectedV9Users 默认 100
// AI 小智：中文 1.5 字/token，英文 4 字/token；output≈input（翻译 1:1 保守估计）
// CCO 文若水：兼容 .answer 和 .text 两种字段名
// 法务张律：纯数学函数 — 零网络、零身份字段、零 flag 翻动
// 毒舌老王：返回字段精简
// CPO 叶用户：evaluateCostChecklistItem.passed 永远 false 直到 CFO 终审签字
// 前端小凡：MP CommonJS，与 H5 同构；不引新依赖
const TOKEN_RATIO = {
  zh: 1.5,
  en: 4.0,
  mixed: 2.5,
}

const DEFAULT_PRICING_CNY = {
  per1kTokensInput: 0.04,
  per1kTokensOutput: 0.12,
  cacheDiscount: 0.5,
  ltvPerUserCNY: 50,
  sustainabilityThresholdPct: 0.05,
}

const DEFAULT_PRICING_USD = {
  per1kTokensInput: 0.005,
  per1kTokensOutput: 0.015,
  cacheDiscount: 0.5,
  ltvPerUserUSD: 7,
  sustainabilityThresholdPct: 0.05,
}

function estimateTokens(text, sourceLocale = 'zh') {
  const ratio = TOKEN_RATIO[sourceLocale] || TOKEN_RATIO.mixed
  const s = String(text || '')
  return Math.ceil(s.length / ratio)
}

function estimateTranslationCost(catalog, pricing, options) {
  const safeCatalog = Array.isArray(catalog) ? catalog : []
  const safePricing = pricing || DEFAULT_PRICING_CNY
  const safeOptions = options || {}
  const targetLocales = Array.isArray(safeOptions.targetLocales) && safeOptions.targetLocales.length > 0
    ? safeOptions.targetLocales
    : ['en']
  const cacheHitRate = Math.max(0, Math.min(1, Number(safeOptions.cacheHitRate) || 0))
  const projectedV9Users = Math.max(1, Number(safeOptions.projectedV9Users) || 100)

  let totalInputTokens = 0
  let totalOutputTokens = 0
  const breakdown = []

  for (const item of safeCatalog) {
    const l1 = String((item && item.layer1 && (item.layer1.text || item.layer1.answer)) || '')
    const l2 = String((item && item.layer2 && (item.layer2.text || item.layer2.answer)) || '')
    const l3 = String((item && item.layer3 && (item.layer3.text || item.layer3.answer)) || '')

    const t1 = estimateTokens(l1, 'zh')
    const t2 = estimateTokens(l2, 'zh')
    const t3 = estimateTokens(l3, 'zh')
    const inputTokens = t1 + t2 + t3
    const outputTokens = inputTokens

    totalInputTokens += inputTokens * targetLocales.length
    totalOutputTokens += outputTokens * targetLocales.length

    breakdown.push({
      id: String((item && item.id) || ''),
      layer1Tokens: t1,
      layer2Tokens: t2,
      layer3Tokens: t3,
      inputTokens,
      outputTokens,
    })
  }

  const baseCostInput = (totalInputTokens / 1000) * safePricing.per1kTokensInput
  const baseCostOutput = (totalOutputTokens / 1000) * safePricing.per1kTokensOutput
  const baseCost = baseCostInput + baseCostOutput
  const cacheSavings = baseCost * cacheHitRate * (1 - safePricing.cacheDiscount)
  const estimatedCost = baseCost - cacheSavings

  const ltv = Number(safePricing.ltvPerUserCNY || safePricing.ltvPerUserUSD || 0)
  const threshold = ltv * Number(safePricing.sustainabilityThresholdPct || 0)
  const costPerUser = projectedV9Users > 0 ? estimatedCost / projectedV9Users : 0
  const breakEvenUsers = threshold > 0 ? Math.ceil(estimatedCost / threshold) : Infinity
  const sustainable = costPerUser <= threshold

  return {
    perRequestTokens: breakdown.length > 0 ? breakdown[0].inputTokens : 0,
    totalInputTokens,
    totalOutputTokens,
    totalTokens: totalInputTokens + totalOutputTokens,
    estimatedCostCNY: Number(estimatedCost.toFixed(4)),
    baseCostCNY: Number(baseCost.toFixed(4)),
    cacheHitRate,
    cacheSavingsCNY: Number(cacheSavings.toFixed(4)),
    costPerUserCNY: Number(costPerUser.toFixed(4)),
    sustainabilityThresholdCNY: Number(threshold.toFixed(4)),
    breakEvenUsers,
    sustainable,
    sustainabilityVerdict: sustainable ? 'sustainable' : 'needs-review',
    targetLocales,
    projectedV9Users,
    breakdown,
  }
}

function evaluateCostChecklistItem(catalog, pricing, options) {
  const opts = options || {}
  const estimate = estimateTranslationCost(catalog, pricing || DEFAULT_PRICING_CNY, opts)
  const list = Array.isArray(catalog) ? catalog : []
  // V8.28 Sprint 37：若 vendors 参数传入（第4参数），details 扩展 vendorComparison 字段（CFO 决策依据）
  // CPO 红线：passed 仍永远 false — recommendation 字段是"系统建议"非"系统决策"
  const vendorsArg = arguments[3]
  const vendorComparison = Array.isArray(vendorsArg) && vendorsArg.length > 0
    ? compareVendorPricing(list, vendorsArg, opts)
    : undefined
  const recommendation = vendorComparison
    ? recommendVendor(list, vendorsArg, opts)
    : undefined
  // V8.29 Sprint 38：locale→region 路由建议（纯数学零网络 — 法务张律红线延续）
  // Global 何：options.locale 显式传入时才计算，避免无 locale 场景污染 details
  // V8.30 Sprint 39：localeRouting 扩展 supported 字段（事实陈述，非决策）
  const localeStr = typeof opts.locale === 'string' ? opts.locale : ''
  const localeRouting = localeStr
    ? Object.assign({ supported: isLocaleSupported(localeStr) }, resolveLocaleRegion(localeStr))
    : undefined
  const localeVendorRecommendation = localeStr && vendorComparison
    ? recommendVendorForLocale(list, localeStr, vendorsArg || VENDOR_PRICING_PRESETS, opts)
    : undefined
  return {
    passed: false, // CFO 终审前永远 false — CPO 红线
    draftReady: true,
    summary: `${list.length}×3 layers × ${estimate.targetLocales.length} locale(s), ${estimate.totalTokens} tokens, ¥${estimate.estimatedCostCNY}, ${estimate.sustainabilityVerdict}`,
    details: Object.assign(
      {},
      estimate,
      vendorComparison ? { vendorComparison, recommendation } : {},
      localeRouting ? { localeRouting, localeVendorRecommendation } : {}
    ),
  }
}

// V8.28 第96轮 Sprint 37：MP 端 LLM 翻译流水线厂商报价对照层（与 H5 src/h5/utils/llmTranslation.js 同构）
// Why: CEO 周远见 — 北极星漏斗第21阶「厂商报价对照层」；V8.27 单一厂商估算无法回答"用哪家最划算"
// CFO 钱守正：三家厂商并排对照后基于 LTV×5% 阈值判定 sustainable 厂商并签字推进第6项
// AI 小智选型：Qwen Plus（Aliyun 国产合规，CJK 友好）/ GPT-4o（OpenAI 出海必备）/ DeepSeek V3（性价比备选）
// 后端老稳：厂商预设 schema 含 region 字段（cn/global/sg），与 cloudSync X-Bw-Region header 同型占位，V9 出海分区路由
// Global 何：Qwen region='cn'，GPT-4o region='global'，DeepSeek region='cn'
// 法务张律：纯数学函数 — 零网络、零身份字段、零 flag 翻动；GPT-4o 仅做价格常量对照，不发请求不传数据，合规零风险
// CPO 叶用户：recommendation 字段是"系统建议"非"系统决策" — 决策权在 CFO；evaluateCostChecklistItem.passed 仍永远 false
// 毒舌老王：compareVendorPricing 返回字段精简 — vendorId/estimatedCostCNY/costPerUserCNY/sustainable/breakEvenUsers/region；recommendVendor 返回 {vendorId, reason, savings} — reason 一句话不超 30 字
// 前端小凡：MP CommonJS 双端同构，与 Sprint 35/36 同模块；不引新依赖
// 测试虫虫：sprint37-vendor-pricing-comparison.test.js 覆盖三家厂商成本估算稳定性 / recommendVendor 选最优 / 单一厂商 fallback / 空厂商数组边界 / 271 题全量对照 / 双端 export 同构

const VENDOR_PRICING_PRESETS = [
  {
    id: 'qwen-plus',
    label: 'Qwen Plus (Aliyun)',
    per1kTokensInput: 0.004,
    per1kTokensOutput: 0.012,
    cacheDiscount: 0.5,
    ltvPerUserCNY: 50,
    sustainabilityThresholdPct: 0.05,
    region: 'cn',
  },
  {
    id: 'gpt-4o',
    label: 'GPT-4o (OpenAI)',
    per1kTokensInput: 0.014, // $0.005 → ¥0.014（按 7.0 汇率折算，CFO 终审时以实时汇率为准）
    per1kTokensOutput: 0.042, // $0.015 → ¥0.042
    cacheDiscount: 0.5,
    ltvPerUserCNY: 50,
    sustainabilityThresholdPct: 0.05,
    region: 'global',
  },
  {
    id: 'deepseek-v3',
    label: 'DeepSeek V3',
    per1kTokensInput: 0.001,
    per1kTokensOutput: 0.002,
    cacheDiscount: 0.5,
    ltvPerUserCNY: 50,
    sustainabilityThresholdPct: 0.05,
    region: 'cn',
  },
]

// V8.28 Sprint 37：compareVendorPricing(catalog, vendors, options) — 多厂商成本对照
// vendors: VENDOR_PRICING_PRESETS 或自定义数组；不传则用 VENDOR_PRICING_PRESETS
// 输出: { vendors: [{vendorId, label, estimatedCostCNY, costPerUserCNY, sustainable, breakEvenUsers, region}], cheapestVendorId, cheapestCostCNY }
function compareVendorPricing(catalog, vendors, options) {
  const safeCatalog = Array.isArray(catalog) ? catalog : []
  const safeVendors = Array.isArray(vendors) && vendors.length > 0
    ? vendors
    : VENDOR_PRICING_PRESETS

  const results = safeVendors.map(function (v) {
    const estimate = estimateTranslationCost(safeCatalog, v, options)
    return {
      vendorId: String(v.id || ''),
      label: String(v.label || v.id || ''),
      estimatedCostCNY: estimate.estimatedCostCNY,
      costPerUserCNY: estimate.costPerUserCNY,
      sustainable: estimate.sustainable,
      breakEvenUsers: estimate.breakEvenUsers,
      region: String(v.region || ''),
    }
  })

  const sorted = results.slice().sort(function (a, b) { return a.estimatedCostCNY - b.estimatedCostCNY })
  const cheapest = sorted[0]

  return {
    vendors: results,
    cheapestVendorId: cheapest ? cheapest.vendorId : '',
    cheapestCostCNY: cheapest ? cheapest.estimatedCostCNY : 0,
  }
}

// V8.28 Sprint 37：recommendVendor(catalog, vendors, options) — 系统建议厂商（CFO 决策参考）
// 输出: { vendorId, reason, savings }
// CPO 红线：recommendation 是"系统建议"非"系统决策" — 决策权在 CFO
// 优先级：sustainable 厂商中选 costPerUser 最低；若全 unsustainable 选 cheapest 但 reason 标"needs CFO review"
function recommendVendor(catalog, vendors, options) {
  const comparison = compareVendorPricing(catalog, vendors, options)
  if (!comparison.cheapestVendorId) {
    return {
      vendorId: '',
      reason: 'no vendor data available',
      savings: 0,
    }
  }

  const sorted = comparison.vendors.slice().sort(function (a, b) { return a.estimatedCostCNY - b.estimatedCostCNY })
  const cheapest = sorted[0]
  const mostExpensive = sorted[sorted.length - 1]
  const savings = Number((mostExpensive.estimatedCostCNY - cheapest.estimatedCostCNY).toFixed(4))

  const sustainableVendors = sorted.filter(function (v) { return v.sustainable })
  const recommended = sustainableVendors.length > 0 ? sustainableVendors[0] : cheapest
  // 毒舌老王：reason 一句话不超 60 字（英文 reason 比 30 中文字符更需空间，60 字符是 CFO 一眼可读上限）
  var costStr = Number(recommended.costPerUserCNY).toFixed(2)
  var reason = sustainableVendors.length > 0
    ? `sustainable @ ¥${costStr}/user (cheapest viable)`
    : `needs CFO review @ ¥${costStr}/user (above threshold)`

  return {
    vendorId: recommended.vendorId,
    reason: reason.length > 60 ? reason.slice(0, 60) : reason,
    savings,
  }
}

// V8.29 第97轮 Sprint 38：MP 端 LLM 翻译流水线 locale→region 路由配套层（与 H5 src/h5/utils/llmTranslation.js 同构）
// Why: CEO 周远见 — 北极星漏斗第22阶「locale→region 路由配套」；V8.28 厂商预设已预埋 region 字段，本轮做 locale→region 映射纯函数
// 后端老稳 + Global 何：与 cloudSync X-Bw-Region header 同型占位；V9 后端真实化时直接复用 resolveLocaleRegion 函数按 region 路由到对应厂商 endpoint
// 法务张律：纯数学函数 — 零网络、零身份字段、零 flag 翻动；一票否决权不触发；locale 是 BCP-47 字符串非身份字段，可入路由计算
// CPO 叶用户：localeVendorRecommendation 是"系统建议"非"系统决策" — 决策权在 CFO + 后端老稳；evaluateCostChecklistItem.passed 仍永远 false
// Global 何路由表：zh-CN→cn（国产合规）/ zh-TW/zh-HK/zh-SG→sg（亚太南部出海节点）/ en-*/ja-JP/ko-KR→global（出海必备）/ 默认→global
// 毒舌老王：resolveLocaleRegion 返回 4 字段精简（locale/region/source/fallback）；routeVendorByRegion 返回 3 字段；reason 一句话不超 60 字
// 前端小凡：MP CommonJS + H5 ES module 双端同构，与 Sprint 35/36/37 同模块；不引新依赖
// 测试虫虫：sprint38-locale-region-routing.test.js 覆盖 LOCALE_REGION_MAP / resolveLocaleRegion / routeVendorByRegion / recommendVendorForLocale / evaluateCostChecklistItem 扩展 / 271 题全量 / 双端 export 同构

// V8.30 第98轮 Sprint 39：MP 端 LLM 翻译流水线欧洲 locale 扩展层（与 H5 src/h5/utils/llmTranslation.js 同构）
// Why: CEO 周远见 — 北极星漏斗第23阶「欧洲 locale 扩展层」；V8.29 LOCALE_REGION_MAP 覆盖 10 个核心 locale，欧洲 locale 走 fallback 默认 global
//       存在路由语义模糊（source='default' + fallback=true）— V9 出海欧洲市场前置需显式路由覆盖
// Global 何：欧洲三件套 fr-FR/de-DE/es-ES 显式路由到 global region，与 en-* 同 region；GPT-4o 出海必备
// 法务张律：纯数学函数零网络零身份字段零 flag 翻动；欧洲 locale 走 global 与 V8.29 默认一致，合规零风险
// CPO 叶用户：isLocaleSupported/listSupportedLocales 是"系统工具函数"非"用户决策点"；evaluateCostChecklistItem details.localeRouting.supported 是事实陈述非决策
// 毒舌老王：isLocaleSupported 返回 boolean 就够别加 reason；listSupportedLocales 返回排序数组就够别加 metadata
// 后端老稳：isLocaleSupported 用于 V9 后端 health check 接口返回支持的 locale 列表；listSupportedLocales 用于 V9 LocaleSwitcher 选项渲染
// 前端小凡：MP CommonJS + H5 ES module 双端同构，与 Sprint 35-38 同模块；不引新依赖
// 测试虫虫：sprint39-european-locale-expansion.test.js 覆盖 LOCALE_REGION_MAP 13 locale / fr-FR/de-DE/es-ES 精确匹配 source=map fallback=false / isLocaleSupported / listSupportedLocales / evaluateCostChecklistItem details.localeRouting.supported 扩展 / 271 题全量 / 双端 export 同构

var LOCALE_REGION_MAP = {
  'zh-CN': 'cn',
  'zh-TW': 'sg',
  'zh-HK': 'sg',
  'zh-SG': 'sg',
  'en-US': 'global',
  'en-GB': 'global',
  'en-AU': 'global',
  'en-CA': 'global',
  'ja-JP': 'global',
  'ko-KR': 'global',
  // V8.30 Sprint 39：欧洲三件套显式路由覆盖（避免 fallback 语义模糊 — source='map' 而非 source='default'）
  'fr-FR': 'global',
  'de-DE': 'global',
  'es-ES': 'global',
  // V8.31 Sprint 40：欧洲二批显式路由覆盖（意大利/葡萄牙/荷兰 — 与 Sprint 39 同型扩展，北欧留 Sprint 41）
  'it-IT': 'global',
  'pt-PT': 'global',
  'nl-NL': 'global',
  // V8.32 Sprint 41：北欧三批显式路由覆盖（瑞典/丹麦/芬兰/挪威 — 与 Sprint 40 同型扩展，波罗的海留 Sprint 42 候选）
  'sv-SE': 'global',
  'da-DK': 'global',
  'fi-FI': 'global',
  'no-NO': 'global',
  // V8.33 Sprint 42：波罗的海四批显式路由覆盖（波兰/立陶宛/拉脱维亚/爱沙尼亚 — 与 Sprint 41 同型扩展，南欧/东欧留 Sprint 43 候选）
  'pl-PL': 'global',
  'lt-LT': 'global',
  'lv-LV': 'global',
  'et-EE': 'global',
  // V8.34 Sprint 43：南欧三批显式路由覆盖（罗马尼亚/希腊/保加利亚 — 与 Sprint 42 同型扩展，东欧留 Sprint 44 候选）
  'ro-RO': 'global',
  'el-GR': 'global',
  'bg-BG': 'global',
  // V8.35 Sprint 44：东欧三批显式路由覆盖（捷克/斯洛伐克/匈牙利 — 与 Sprint 43 同型扩展，西斯拉夫语支+乌拉尔语支；巴尔干斯拉夫留 V9 候选）
  'cs-CZ': 'global',
  'sk-SK': 'global',
  'hu-HU': 'global',
  // V8.36 Sprint 45：巴尔干斯拉夫三批显式路由覆盖（塞尔维亚/克罗地亚/斯洛文尼亚 — 与 Sprint 44 同型扩展，南斯拉夫语支；巴尔干其他 bs-BA/mk-MK/me-ME 留 Sprint 46 候选）
  'sr-RS': 'global',
  'hr-HR': 'global',
  'sl-SI': 'global',
  // V8.37 Sprint 46：巴尔干其他三批显式路由覆盖（波斯尼亚/马其顿/黑山 — 与 Sprint 45 同型扩展，南斯拉夫语支继承；sr-Cyrl/sr-Latn 脚本子标签留 V9 真实化时考虑）
  'bs-BA': 'global',
  'mk-MK': 'global',
  'me-ME': 'global',
  // V8.38 Sprint 47：东南亚 ASEAN 三批显式路由覆盖（泰国/越南/印尼 — 与 Sprint 46 同型扩展，东盟核心市场前置；ms-MY/tl-PH/km-KH 留 Sprint 48 候选）
  // Global 何：th 泰文属 Brahmic 脚本，vi 越南文 Latin+声调符号，id 印尼文 Latin — 三者 script 差异大但本轮仅路由层不动 script
  // 法务张律：泰国 PDPA/越南 Decree 13/印尼 PDP Law 均要求数据最小化；本轮零数据收集符合三国本地化法规
  'th-TH': 'global',
  'vi-VN': 'global',
  'id-ID': 'global',
  // V8.39 Sprint 48：ASEAN 其他三批显式路由覆盖（马来-马来西亚/他加禄-菲律宾/高棉-柬埔寨 — 与 Sprint 47 同型扩展，东盟长尾市场前置；ms-SG/fil-PH 留 V9 子标签真实化时考虑）
  // Global 何：ms 马来文 Latin 脚本（马来西亚/文莱/新加坡通用），tl 他加禄文 Latin 脚本（菲律宾），km 高棉文 Brahmic 派生脚本（柬埔寨）— 三者 script 差异大但本轮仅路由层
  // 法务张律：马来西亚 PDPA/菲律宾 DPA/柬埔寨 PDPL 三国数据本地化法规下，locale 字符串本身非身份字段，可入路由计算；零网络零 flag 翻动
  'ms-MY': 'global',
  'tl-PH': 'global',
  'km-KH': 'global',
}

function resolveLocaleRegion(locale) {
  var loc = typeof locale === 'string' ? locale.trim() : ''
  if (!loc) {
    return {
      locale: '',
      region: 'global',
      source: 'default',
      fallback: true,
    }
  }
  if (LOCALE_REGION_MAP[loc]) {
    return {
      locale: loc,
      region: LOCALE_REGION_MAP[loc],
      source: 'map',
      fallback: false,
    }
  }
  var mainTag = loc.split('-')[0]
  if (mainTag === 'zh') {
    return {
      locale: loc,
      region: 'sg',
      source: 'default',
      fallback: true,
    }
  }
  if (mainTag === 'en' || mainTag === 'ja' || mainTag === 'ko') {
    return {
      locale: loc,
      region: 'global',
      source: 'default',
      fallback: true,
    }
  }
  // V8.30 Sprint 39：欧洲三件套主标签回退（fr-XX/de-XX/es-XX 未知子标签 → global，与 V8.29 默认一致，法务零风险）
  if (mainTag === 'fr' || mainTag === 'de' || mainTag === 'es') {
    return {
      locale: loc,
      region: 'global',
      source: 'default',
      fallback: true,
    }
  }
  // V8.31 Sprint 40：欧洲二批主标签回退（it-XX/pt-XX/nl-XX 未知子标签 → global，与 V8.30 默认一致，法务零风险）
  if (mainTag === 'it' || mainTag === 'pt' || mainTag === 'nl') {
    return {
      locale: loc,
      region: 'global',
      source: 'default',
      fallback: true,
    }
  }
  // V8.32 Sprint 41：北欧三批主标签回退（sv-XX/da-XX/fi-XX/no-XX 未知子标签 → global，与 V8.31 默认一致，法务零风险）
  if (mainTag === 'sv' || mainTag === 'da' || mainTag === 'fi' || mainTag === 'no') {
    return {
      locale: loc,
      region: 'global',
      source: 'default',
      fallback: true,
    }
  }
  // V8.33 Sprint 42：波罗的海四批主标签回退（pl-XX/lt-XX/lv-XX/et-XX 未知子标签 → global，与 V8.32 默认一致，法务零风险）
  if (mainTag === 'pl' || mainTag === 'lt' || mainTag === 'lv' || mainTag === 'et') {
    return {
      locale: loc,
      region: 'global',
      source: 'default',
      fallback: true,
    }
  }
  // V8.34 Sprint 43：南欧三批主标签回退（ro-XX/el-XX/bg-XX 未知子标签 → global，与 V8.33 默认一致，法务零风险）
  if (mainTag === 'ro' || mainTag === 'el' || mainTag === 'bg') {
    return {
      locale: loc,
      region: 'global',
      source: 'default',
      fallback: true,
    }
  }
  // V8.35 Sprint 44：东欧三批主标签回退（cs-XX/sk-XX/hu-XX 未知子标签 → global，与 V8.34 默认一致，法务零风险）
  if (mainTag === 'cs' || mainTag === 'sk' || mainTag === 'hu') {
    return {
      locale: loc,
      region: 'global',
      source: 'default',
      fallback: true,
    }
  }
  // V8.36 Sprint 45：巴尔干斯拉夫三批主标签回退（sr-XX/hr-XX/sl-XX 未知子标签 → global，与 V8.35 默认一致，法务零风险）
  // Global 何：sr-Cyrl/sr-Latn 脚本子标签留 V9 真实化时联合内容侧评审；本轮仅做主标签回退
  if (mainTag === 'sr' || mainTag === 'hr' || mainTag === 'sl') {
    return {
      locale: loc,
      region: 'global',
      source: 'default',
      fallback: true,
    }
  }
  // V8.37 Sprint 46：巴尔干其他三批主标签回退（bs-XX/mk-XX/me-XX 未知子标签 → global，与 V8.36 默认一致，法务零风险）
  // Global 何：bs/mk/me 主标签均属南斯拉夫语支；bs-Cyrl/bs-Latn 脚本子标签留 V9 真实化时考虑；me-ME 政治敏感性已在 Sprint 45 法务评审中放行
  if (mainTag === 'bs' || mainTag === 'mk' || mainTag === 'me') {
    return {
      locale: loc,
      region: 'global',
      source: 'default',
      fallback: true,
    }
  }
  // V8.38 Sprint 47：东南亚 ASEAN 三批主标签回退（th-XX/vi-XX/id-XX 未知子标签 → global，与 V8.37 默认一致，法务零风险）
  // Global 何：th-XX 泰文子标签（如 th-TH-NOA 区域变体）→ global；vi-XX 越南文子标签（如 vi-VN-central）→ global；id-XX 印尼文子标签 → global
  // 法务张律：泰国/越南/印尼三国数据本地化法规下，locale 字符串本身非身份字段，可入路由计算；零网络零 flag 翻动
  if (mainTag === 'th' || mainTag === 'vi' || mainTag === 'id') {
    return {
      locale: loc,
      region: 'global',
      source: 'default',
      fallback: true,
    }
  }
  // V8.39 Sprint 48：ASEAN 其他三批主标签回退（ms-XX/tl-XX/km-XX 未知子标签 → global，与 V8.38 默认一致，法务零风险）
  // Global 何：ms-XX 马来文子标签（ms-SG 新加坡马来人社区/ms-BN 文莱）→ global；tl-XX 他加禄文子标签（fil-PH 菲律宾语同义）→ global；km-XX 高棉文子标签 → global
  // 法务张律：马来西亚/菲律宾/柬埔寨三国数据本地化法规下，locale 字符串本身非身份字段，可入路由计算；零网络零 flag 翻动
  if (mainTag === 'ms' || mainTag === 'tl' || mainTag === 'km') {
    return {
      locale: loc,
      region: 'global',
      source: 'default',
      fallback: true,
    }
  }
  return {
    locale: loc,
    region: 'global',
    source: 'default',
    fallback: true,
  }
}

// V8.30 Sprint 39：isLocaleSupported(locale) — 显式 LOCALE_REGION_MAP 成员检查（与 H5 同构）
// 毒舌老王：返回 boolean 就够，别加 reason 字段
// 后端老稳：用于 V9 后端 health check 接口返回支持的 locale 列表
function isLocaleSupported(locale) {
  if (typeof locale !== 'string') return false
  var loc = locale.trim()
  if (!loc) return false
  return Object.prototype.hasOwnProperty.call(LOCALE_REGION_MAP, loc)
}

// V8.30 Sprint 39：listSupportedLocales() — 返回排序后的支持 locale 数组（与 H5 同构）
// 毒舌老王：返回排序数组就够，别加 metadata
// 后端老稳：用于 V9 LocaleSwitcher 选项渲染和 health check 接口
function listSupportedLocales() {
  return Object.keys(LOCALE_REGION_MAP).slice().sort()
}

function routeVendorByRegion(vendors, region) {
  // 路由层语义：显式空数组 = 无厂商池；仅 undefined/非数组时回退到 presets
  // 测试虫虫：与 V8.28 估算函数回退到 presets 不同 — 路由函数尊重 caller 的空意图
  var safeVendors = Array.isArray(vendors) ? vendors : VENDOR_PRICING_PRESETS
  var safeRegion = typeof region === 'string' && region.trim() ? region.trim() : 'global'

  var matched = []
  var unmatched = []
  for (var i = 0; i < safeVendors.length; i++) {
    var v = safeVendors[i]
    var vRegion = String(v.region || 'global')
    if (vRegion === safeRegion) {
      matched.push({
        vendorId: String(v.id || ''),
        label: String(v.label || v.id || ''),
        region: vRegion,
      })
    } else {
      unmatched.push({
        vendorId: String(v.id || ''),
        label: String(v.label || v.id || ''),
        region: vRegion,
      })
    }
  }

  var recommendedVendorId = null
  if (matched.length > 0) {
    var sorted = matched.slice().sort(function (a, b) {
      var aCost = Number(a.costPerUserCNY || 0)
      var bCost = Number(b.costPerUserCNY || 0)
      return aCost - bCost
    })
    recommendedVendorId = sorted[0] ? sorted[0].vendorId : null
  }

  return {
    matched: matched,
    unmatched: unmatched,
    recommendedVendorId: recommendedVendorId,
  }
}

function recommendVendorForLocale(catalog, locale, vendors, options) {
  var opts = options || {}
  var routing = resolveLocaleRegion(locale)
  var safeVendors = Array.isArray(vendors) && vendors.length > 0
    ? vendors
    : VENDOR_PRICING_PRESETS

  // 显式空数组 → 无厂商可推荐
  if (safeVendors.length === 0) {
    return {
      vendorId: '',
      reason: 'no vendor data available',
      savings: 0,
      region: routing.region,
      locale: routing.locale,
      source: routing.source,
      fallback: routing.fallback,
    }
  }

  var matchedVendors = safeVendors.filter(function (v) {
    return String(v.region || 'global') === routing.region
  })
  var effectiveVendors = matchedVendors.length > 0 ? matchedVendors : safeVendors
  var base = recommendVendor(catalog, effectiveVendors, opts)

  // 毒舌老王：region tag 放前面 — 永远不被截断；reason 总长 ≤ 80 字
  var regionTag = routing.fallback
    ? '[fallback region=' + routing.region + ']'
    : '[region=' + routing.region + ']'
  var reason = (regionTag + ' ' + base.reason).slice(0, 80)

  return {
    vendorId: base.vendorId,
    reason: reason,
    savings: base.savings,
    region: routing.region,
    locale: routing.locale,
    source: routing.source,
    fallback: routing.fallback,
  }
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
  TOKEN_RATIO,
  DEFAULT_PRICING_CNY,
  DEFAULT_PRICING_USD,
  VENDOR_PRICING_PRESETS,
  estimateTokens,
  estimateTranslationCost,
  compareVendorPricing,
  recommendVendor,
  evaluateCostChecklistItem,
  LOCALE_REGION_MAP,
  resolveLocaleRegion,
  routeVendorByRegion,
  recommendVendorForLocale,
  isLocaleSupported,
  listSupportedLocales,
}
