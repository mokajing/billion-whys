// V8.20 第88轮 Sprint 29：反馈数据上云 payload schema 预埋（client-side，零网络）
// V8.22 第90轮 Sprint 31：cloudSync 真实 fetch 接口设计草案 + 客户端 retry/backoff 框架预埋（仍零网络）
// V8.24 第92轮 Sprint 33：cloudSync FeatureFlag 化预埋 + Idempotency-Key/Server Headers 协议契约函数化（仍零网络）
// Why: 北极星漏斗第18阶"cloudSync FeatureFlag 化预埋"；V9 真实化时翻 flag 即上
// 与 src/h5/utils/cloudSync.js 同构 — 单一 schema 双端共享，避免漂移
// 法务张律红线：禁 deviceId/ip/location/userId/email/phone/mac/imei/idfa/oaid
// 安全李姐：MAX_BATCH_SIZE_BYTES=64KB 防大包
// 毒舌老王：flush 仍为 stub 不发请求；B 桶回流走 V8.2 Sprint 11 埋点 analytics，cloudSync 是反馈上云通道（V9 真实化）
// 前端小凡：MP wx.setStorageSync 10MB 限制 → QUEUE_MAX=200 封顶；isOnline 用 wx.getNetworkType
// 测试虫虫：sprint31-cloudsync-fetch-design.test.js 覆盖 retry/backoff 设计

const { safeGetStorageSync, safeSetStorageSync, safeRemoveStorageSync } = require('./safe-wx')

const CLOUD_SYNC_VERSION = 1
const QUEUE_MAX = 200
const QUEUE_STORAGE_KEY = 'bw_cloud_sync_queue'

// V8.24 Sprint 33：FeatureFlag — V9 真实化的最后一道客户端闸
// 法务张律红线：默认 false；任何 V9 上线动作必须有显式代码改动，避免误开
// 毒舌老王：测试钩子 _setCloudSyncEnabled(true) 让单测能切到 flag-on 路径
let CLOUD_SYNC_ENABLED = false
function isCloudSyncEnabled() {
  return CLOUD_SYNC_ENABLED === true
}
function _setCloudSyncEnabled(v) {
  CLOUD_SYNC_ENABLED = v === true
}

// V8.22 Sprint 31：retry/backoff 框架常量（仍零网络，仅预埋）
// CEO 裁决：MAX_RETRIES=3（社会学刘教授流量敏感家庭优先）
// CTO 裁决：BACKOFF_BASE_MS=1000，指数退避 1s/2s/4s
// 安全李姐：MAX_BATCH_SIZE_BYTES=64KB
// 法务张律：HTTPS_ONLY=true 硬编码 — 儿童产品零例外
const MAX_RETRIES = 3
const BACKOFF_BASE_MS = 1000
const MAX_BATCH_SIZE_BYTES = 64 * 1024
const HTTPS_ONLY = true

// V8.22 Sprint 31：server 端接收接口设计草案（后端老稳）
// 不发请求 — 仅作为客户端协议契约，V9 真实化时直接对齐
//   POST /api/v1/cloudSync/ingest
//   Headers: Content-Type / X-Bw-SchemaVersion / X-Bw-AppVersion / X-Bw-Locale / X-Bw-Region / Idempotency-Key
//   Body: buildPayload() 输出
//   Response 200: { accepted, deduped }
//   4xx 不重试 / 5xx + 429 重试 / Rate limit 1 req/min per device / HTTPS Only
var SERVER_ENDPOINT_DESIGN = {
  method: 'POST',
  path: '/api/v1/cloudSync/ingest',
  httpsOnly: HTTPS_ONLY,
  headers: [
    'Content-Type: application/json',
    'X-Bw-SchemaVersion: 1',
    'X-Bw-AppVersion',
    'X-Bw-Locale',
    'X-Bw-Region',
    'Idempotency-Key',
  ],
  rateLimitPerMinute: 1,
}

const PAYLOAD_ALLOWED_FIELDS = [
  'schemaVersion',
  'appVersion',
  'locale',
  'os',
  'feedbackLog',
  'analyticsEvents',
  'eventLog',
  'dedupKey',
  'enqueuedAt',
]

// V8.22 Sprint 31：扩展设备识别符别名 mac/imei/idfa/oaid（法务张律守卫升级）
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

function shallowSafeClone(value) {
  if (value === null || typeof value !== 'object') return value
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return null
  }
}

function assertNoForbiddenFields(obj, path) {
  path = path || 'root'
  if (obj === null || typeof obj !== 'object') return
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      assertNoForbiddenFields(obj[i], path + '[' + i + ']')
    }
    return
  }
  for (const key of Object.keys(obj)) {
    if (PAYLOAD_FORBIDDEN_FIELDS.includes(key)) {
      throw new Error('[cloudSync] forbidden field "' + key + '" at ' + path + ' — 法务张律红线')
    }
    assertNoForbiddenFields(obj[key], path + '.' + key)
  }
}

function computeDedupKey(entry) {
  if (!entry || typeof entry !== 'object') return ''
  const name = String(entry.name || '')
  const detail = String(entry.detail || '')
  const ts = Number(entry.ts) || 0
  return name + '|' + detail + '|' + ts
}

function buildPayload(reflushOutput, meta) {
  const input = reflushOutput || {}
  const m = meta || {}
  const payload = {
    schemaVersion: CLOUD_SYNC_VERSION,
    appVersion: String(m.appVersion || ''),
    locale: String(m.locale || 'zh'),
    os: String(m.os || 'mp'),
    feedbackLog: Array.isArray(input.feedbackLog) ? shallowSafeClone(input.feedbackLog) : [],
    analyticsEvents: shallowSafeClone(input.analyticsEvents) || {},
    eventLog: Array.isArray(input.eventLog) ? shallowSafeClone(input.eventLog) : [],
  }
  assertNoForbiddenFields(payload)
  return payload
}

function loadQueue() {
  try {
    const raw = safeGetStorageSync(QUEUE_STORAGE_KEY)
    const arr = raw ? JSON.parse(raw) : null
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function saveQueue(queue) {
  try {
    safeSetStorageSync(QUEUE_STORAGE_KEY, JSON.stringify(queue))
  } catch {
    try {
      const half = queue.slice(Math.floor(queue.length / 2))
      safeSetStorageSync(QUEUE_STORAGE_KEY, JSON.stringify(half))
    } catch {
      // 放弃持久化，不阻塞主流程
    }
  }
}

// V8.22 Sprint 31：payload 大小守卫 — 超 MAX_BATCH_SIZE_BYTES 拒绝入队（安全李姐）
function getEncodedSize(payload) {
  try {
    return JSON.stringify(payload).length
  } catch {
    return 0
  }
}

function enqueue(payload) {
  if (!payload || typeof payload !== 'object') return null
  assertNoForbiddenFields(payload)
  // V8.22 Sprint 31：大小守卫
  if (getEncodedSize(payload) > MAX_BATCH_SIZE_BYTES) {
    return { enqueued: false, dedup: false, queueSize: loadQueue().length, rejected: 'oversize' }
  }
  const dedupKey =
    payload.dedupKey ||
    computeDedupKey({
      name: 'payload',
      detail: payload.schemaVersion + '|' + payload.appVersion,
      ts: payload.enqueuedAt || Date.now(),
    })
  const enriched = Object.assign({}, payload, { dedupKey: dedupKey, enqueuedAt: payload.enqueuedAt || Date.now() })
  const queue = loadQueue()
  for (let i = 0; i < queue.length; i++) {
    if (queue[i] && queue[i].dedupKey === dedupKey) {
      return { enqueued: false, dedup: true, queueSize: queue.length }
    }
  }
  queue.push(enriched)
  while (queue.length > QUEUE_MAX) {
    queue.shift()
  }
  saveQueue(queue)
  return { enqueued: true, dedup: false, queueSize: queue.length }
}

// V8.22 Sprint 31：computeBackoffMs(attempt) 纯函数 — 指数退避 1s/2s/4s
// 与 H5 src/h5/utils/cloudSync.js computeBackoffMs 同构
function computeBackoffMs(attempt) {
  const a = Number(attempt) || 0
  if (a < 0) return BACKOFF_BASE_MS
  const capped = Math.min(a, MAX_RETRIES - 1)
  return BACKOFF_BASE_MS * Math.pow(2, capped)
}

// V8.22 Sprint 31：shouldRetry(status, isNetworkError) 谓词
// 5xx + 429 + 网络错误 → 重试；4xx（非 429）→ 不重试
function shouldRetry(status, isNetworkError) {
  if (isNetworkError) return true
  const s = Number(status) || 0
  if (s === 0) return true
  if (s === 429) return true
  if (s >= 500 && s < 600) return true
  return false
}

// V8.22 Sprint 31：isOnline() MP 桥接（前端小凡）
// MP 用 wx.getNetworkType 异步；同步桥接返回 true（保守默认，不阻塞主流程）
// V9 真实化时改为 wx.getNetworkType 异步链路
function isOnline() {
  if (typeof wx !== 'undefined' && typeof wx.getNetworkType === 'function') {
    // 同步上下文无法调异步 API — 保守返回 true（V9 改造为 async）
    return true
  }
  return true
}

// flush: stub — 本轮仍不发任何网络请求（法务张律一票否决 + CEO 裁决 V8.22 延续）
function flush(options) {
  options = options || {}
  return Promise.resolve({
    flushed: false,
    reason: 'sprint29-stub',
    serverEndpoint: null,
    count: 0,
  })
}

// V8.24 Sprint 33：generateIdempotencyKey() — 纯去重 token，不含身份信息
// MP 无 crypto.randomUUID — 用 Math.random + Date.now 拼 UUIDv4-shaped 字符串（非密码学强度，仅作去重）
// 法务张律：Idempotency-Key 是去重 token 而非身份字段；不入 payload body，仅在 header（server 端 24h TTL 去重）
// 安全李姐：兜底版本非密码学强度，文档标注；server 端校验 36 字符 UUIDv4 格式
function generateIdempotencyKey() {
  const hex = '0123456789abcdef'
  let s = ''
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      s += '-'
    } else if (i === 14) {
      s += '4' // version 4
    } else if (i === 19) {
      s += hex[(Math.random() * 4) | 8] // variant 8-b
    } else {
      s += hex[(Math.random() * 16) | 0]
    }
  }
  return s
}

// V8.24 Sprint 33：buildServerHeaders(payload, meta) — 协议契约函数
// 后端老稳：输出 X-Bw-* + Idempotency-Key Headers 对象字面量，V9 wx.request 落地时直接 spread 到 header
// 安全李姐：禁止包含 Authorization/Cookie 等身份头字段
// 法务张律：X-Bw-AppVersion/Locale 不含身份信息；Idempotency-Key 走 header 不走 body
// Global 何：X-Bw-Region 占位，V9 出海分区填 en-GB/en-US/en-AU
function buildServerHeaders(payload, meta) {
  payload = payload || {}
  meta = meta || {}
  const appVersion = String(meta.appVersion || payload.appVersion || 'unknown')
  const locale = String(meta.locale || payload.locale || 'zh')
  const region = String(meta.region || '')
  const headers = {
    'Content-Type': 'application/json',
    'X-Bw-SchemaVersion': String(payload.schemaVersion || CLOUD_SYNC_VERSION),
    'X-Bw-AppVersion': appVersion,
    'X-Bw-Locale': locale,
    'Idempotency-Key': generateIdempotencyKey(),
  }
  if (region) {
    headers['X-Bw-Region'] = region
  }
  return headers
}

// V8.22 Sprint 31：flushReal(payload) — 设计文档式 stub（仍零网络）
// V8.24 Sprint 33：flag-gated — flag-off → reason:'feature-flag-off'；flag-on → reason:'v9-pending'（仍零网络）
// V9 落地时函数体替换为基于 wx.request + computeBackoffMs + shouldRetry + isOnline 的真实实现
function flushReal(payload, options) {
  options = options || {}
  if (!isCloudSyncEnabled()) {
    return Promise.resolve({
      flushed: false,
      reason: 'feature-flag-off',
      serverEndpoint: SERVER_ENDPOINT_DESIGN.path,
      httpsOnly: HTTPS_ONLY,
      count: 0,
    })
  }
  // flag-on 但 V9 server 端尚未 ready — 仍零网络
  return Promise.resolve({
    flushed: false,
    reason: 'v9-pending',
    serverEndpoint: SERVER_ENDPOINT_DESIGN.path,
    httpsOnly: HTTPS_ONLY,
    count: 0,
  })
}

function _clearQueue() {
  try {
    safeRemoveStorageSync(QUEUE_STORAGE_KEY)
  } catch {
    // ignore
  }
}

module.exports = {
  CLOUD_SYNC_VERSION,
  QUEUE_MAX,
  QUEUE_STORAGE_KEY,
  MAX_RETRIES,
  BACKOFF_BASE_MS,
  MAX_BATCH_SIZE_BYTES,
  HTTPS_ONLY,
  SERVER_ENDPOINT_DESIGN,
  PAYLOAD_ALLOWED_FIELDS,
  PAYLOAD_FORBIDDEN_FIELDS,
  isCloudSyncEnabled,
  _setCloudSyncEnabled,
  generateIdempotencyKey,
  buildServerHeaders,
  assertNoForbiddenFields,
  computeDedupKey,
  buildPayload,
  loadQueue,
  enqueue,
  computeBackoffMs,
  shouldRetry,
  isOnline,
  flush,
  flushReal,
  _clearQueue,
}
