// V8.41 第105轮 Sprint 50：MP 端 V9 真实化主线转向决议 + Locale 扩展漏斗正式收口（与 H5 src/h5/utils/realizationReadiness.js 同构）
// Why: CEO 周远见 — 连续 25 个 Sprint 做 locale 扩展，漏斗第32阶已闭合到 42 locale；第33阶 Sprint 49 重定义为「质量红线全绿」已达成。
//       本轮正式决议：转向 V9 真实化主线，locale 扩展漏斗收口。与 src/h5/utils/realizationReadiness.js 同构 — 单一 schema 双端共享，避免漂移。
// 法务张律红线：V9_REALIZATION_MAINLINE_ENABLED 默认 false；零身份字段、零网络请求、零 flag 翻动；LOCALE_EXPANSION_FUNNEL_CLOSED 是决议事实常量。
// 前端小凡：MP CommonJS 模块，与 cloudSync/i18n/llmTranslation 同型；不引新依赖。

// ===== Sprint 61 第116轮：baseline 同型复用债全量扫描 + illustration-pending-upgrade 重分类（决议事实，非 flag，与 H5 同构）=====
// Why: Sprint 60 下轮议题「nature-001 之外 baseline 同型复用债全量扫描」兑现。scan 结论 227/274 题同型复用 debt +
//       10 samePath + 37 clean。撤回 Sprint 58 "非主导模式" 断言（2 题样本外推不成立）。
// CEO 裁决：baseline 227 题占位状态重分类为 illustration-pending-upgrade（未插画 backlog），非 red line #1+#7 红灯；
//       #1 守"科学错误"，#7 守"已插画题叙事清晰"。Sprint 58-60 的 4 题工作是"升级轨道首批兑现"非"债修"。
//       "零红灯 Sprint" 诚实化 = 测试零红灯 + 新产/升级零红灯；baseline 占位 backlog 独立会计。
// 法务张律：零 flag 翻动（V9_REALIZATION_MAINLINE_ENABLED 仍 false）；零身份字段零网络；readiness 第 4 项 imageApiBlocker 不翻动。
// 测试虫虫：sprint61-baseline-illustration-backlog.test.js canonical 锁 227/10/37 + debt 单调递减。详细见 H5 同名注释块。

const LOCALE_EXPANSION_FUNNEL_CLOSED = true
const LOCALE_EXPANSION_FINAL_LOCALE_COUNT = 42
const LOCALE_EXPANSION_FUNNEL_CLOSED_AT_SPRINT = 50
const LOCALE_EXPANSION_FUNNEL_CLOSED_AT_VERSION = '0.3.44'

// ===== V9 客户端预冻结漏斗收口决议常量（Sprint 54 第109轮决议事实，与 H5 同构）=====
// CEO 周远见裁决：Sprint 51/52/53 已冻结三块客户端证据（costSignoff / layerWordCountContract / zhDriftRewriteEvaluation）；
// 第 4 块无新信息 = locale cargo cult 同形复发。剩余 4 blocker 纯后端/时间依赖，诚实等待，不再制造纸面证据模块。
// 法务张律：决议事实常量，不是 flag；V9_REALIZATION_MAINLINE_ENABLED 仍 false，不动。
const V9_CLIENT_PREFREEZE_FUNNEL_CLOSED = true
const V9_CLIENT_PREFREEZE_FUNNEL_CLOSED_AT_SPRINT = 54
const V9_CLIENT_PREFREEZE_FUNNEL_CLOSED_AT_VERSION = '0.3.48'

let V9_REALIZATION_MAINLINE_ENABLED = false
function isV9RealizationMainlineEnabled() {
  return V9_REALIZATION_MAINLINE_ENABLED === true
}
function _setV9RealizationMainlineEnabled(v) {
  V9_REALIZATION_MAINLINE_ENABLED = v === true
}

const V9_REALIZATION_READINESS_CHECKLIST = [
  {
    id: 'cloudSync-flushReal',
    item: 'cloudSync flushReal 真实 fetch 落地（替换 mock 上传）',
    owner: '后端老稳 + 前端小凡',
    status: 'blocked',
    dependsOn: '后端 cloudSync endpoint 排期',
  },
  {
    id: 'llm-translation-endpoint',
    item: 'LLM 翻译流水线 server 端 endpoint 实现（POST /api/v1/llmTranslation/translate）',
    owner: '后端老稳 + AI 小智',
    status: 'blocked',
    dependsOn: '后端排期 + CFO 成本签字',
  },
  {
    id: 'cfo-cost-signoff',
    item: 'CFO 钱守正 LLM 翻译流水线成本终审签字',
    owner: 'CFO 钱守正',
    // V8.42 Sprint 51：CFO 真实读数 271 题全量 ¥5.86/人均 ¥0.059（阈值 ¥2.5 的 1/42）→ approved，附 2 条件
    status: 'done',
    dependsOn: 'CFO 人工决策（基于 Sprint 36 成本评估草案）— Sprint 51 已签字',
    signoffRef: 'cfo-cost-signoff-sprint51',
  },
  {
    id: 'i18n-content-coverage',
    item: 'i18n 内容 ≥80% en（≥217/271 条）— AI 侧最小可发布门槛',
    owner: 'CCO 文若水 + AI 小智',
    // V8.43 Sprint 52：字数生产准入契约已前置冻结（layerWordCountContract.js），spec 侧预备；status 仍 not-started（生产未开，等 endpoint）
    // V8.44 Sprint 53：zh 源文漂移重写决策已冻结（zhDriftRewriteEvaluation.js = keep-dual-contract），zh 源文基线冻结；status 仍 not-started（基线 ≠ 生产开闸）
    // V8.45 Sprint 54：V9 客户端预冻结漏斗收口（V9_CLIENT_PREFREEZE_FUNNEL_CLOSED=true）；zh 源文基线与 live catalog 脱钩（contentBaselineEpoch.js）；status 仍 not-started
    // V8.47 Sprint 56：图像生成 API 双通道阻塞诚实记录 —— Ducky 持续 429 + Idealab key 失效，post-baseline 首批 15 张插画补齐 carry-over 仍卡死；不造客户端 fallback 假代码，1 张孤儿移入 _staging/illustrations/，生产 image 目录零 staging 残留；status 仍 not-started（外部 API 阻塞 ≠ 生产开闸）
    // V8.48 Sprint 57：图像 API 阻塞解除 via seedream 通道 —— 穷举探测发现 aone MCP d.one::liblib_seedream_v4_5 通道未阻塞（内置 audit）。seedream + 固定 IP 角色前缀补齐 nature-046/047/048 共 15 张插画（9 distinct → webp/png，落 _staging/illustrations/），staging draft wire image 字段，stagingStatus: illustrated-pending-character-audit。墨小暖+彩虹姐 red line #7：palette proxy + seedream audit + 固定 IP 前缀 ≠ 像素级人工 IP 审计，暂不 sync public、不 merge live（仍 271），待 Sprint 58 人工 IP 审计后 live merge。imageApiBlocker 注解由 sprint 编号脆弱串重构为状态串，抗 stale-faith；status 仍 not-started（seedream 解除 zh DAQ 插画燃料阻塞 ≠ i18n en 生产开闸，en 仍依赖 LLM endpoint）
    // V8.49 Sprint 58：人工 IP 审计轮 —— 像素级视觉 IP 审计落地，审计结论 FAIL：3 题各 layer2/layer3/experiment 三 slot 字节级同 md5（9 张重复 / 15，仅 9 distinct），但三层语义完全不同（分子排队 vs 三态循环 vs 冰块赛跑 等），复用同图植入错误心智模型，触 red line #1+#7。Sprint 57"复用 与 nature-001 同型 非浪费"是用历史债为新 bug 辩护（nature-002/003 全部独立 md5）。CEO 裁决：merge 门守住，不 sync public、不 merge live（仍 271），stagingStatus 演进为 audit-failed-semantic-duplication-pending-regeneration，9 张重复 layer2/3/experiment 需独立 concept 重新生成（Sprint 59 P0，seedream 可用）；imageApiBlocker 演进为 audit-failed-semantic-duplication-pending-regeneration（状态串非 sprint 编号）；nature-001 同型复用立为历史债 P2；status 仍 not-started。墨小暖+彩虹姐+科普陈博士+CCO 一票否决守 red line #1+#7：不 merge 语义错误插画
    // V8.50 Sprint 59：9 张重复插画重新生成为独立 concept —— seedream 通道为 nature-046/047/048 各 layer2/layer3/experiment 共 9 slot 各生成独立 concept（prompt 严格匹配该层语义），md5 distinct = 9/9，webp 1024px 57-98KB（>1KB 硬闸）。墨小暖+彩虹姐+科普陈博士+CCO 像素级 IP 审计 PASS：水彩暖色风格一致、问问兔(白兔粉耳)+答答熊(浅棕) IP 跨图一致、9 张语义各异、无恐怖/暴力/性别刻板。CEO 裁决：审计 PASS → sync public/images/nature/ 15 张 + merge 进 live nature.json → live 271→274（baseline 271 守恒、post-baseline 3 append-only），stagingStatus 演进为 audit-passed-merged-live。imageApiBlocker 演进为 resolved-zh-postbaseline-regenerated-audit-passed-merged-live（状态串非 sprint 编号，抗 stale-faith；zh DAQ 插画燃料阻塞解除 ≠ i18n en 生产开闸）；nature-001 历史债仍 P2；status 仍 not-started（i18n en 仍依赖 LLM endpoint）。法务张律：零身份字段零 flag 翻动。毒舌老王：翻转 Sprint 58 bug-witness 断言为 audit-passed 不变量（9 distinct 守恒），不学 cargo cult。
    status: 'not-started',
    dependsOn: 'LLM 翻译 endpoint 真实化',
    contractRef: 'layer-word-count-contract-sprint52',
    sourceBaselineRef: 'zh-drift-rewrite-decision-sprint53',
    imageApiBlocker: 'resolved-zh-postbaseline-regenerated-audit-passed-merged-live',
  },
  {
    id: 'b-bucket-data-return',
    item: 'B 桶文案 2 周数据回流分析（2026-07-13 后启动）',
    owner: 'COO 林实干 + CPO 叶用户',
    status: 'not-started',
    dependsOn: '时间窗口 2026-07-13',
  },
]

function evaluateRealizationReadiness(checklist) {
  const list = checklist || V9_REALIZATION_READINESS_CHECKLIST
  const blockers = list
    .filter((item) => item.status !== 'done')
    .map((item) => ({ id: item.id, owner: item.owner, status: item.status }))
  const allPassed = blockers.length === 0
  return {
    allPassed,
    blockers,
    ready: allPassed,
  }
}

module.exports = {
  LOCALE_EXPANSION_FUNNEL_CLOSED,
  LOCALE_EXPANSION_FINAL_LOCALE_COUNT,
  LOCALE_EXPANSION_FUNNEL_CLOSED_AT_SPRINT,
  LOCALE_EXPANSION_FUNNEL_CLOSED_AT_VERSION,
  V9_CLIENT_PREFREEZE_FUNNEL_CLOSED,
  V9_CLIENT_PREFREEZE_FUNNEL_CLOSED_AT_SPRINT,
  V9_CLIENT_PREFREEZE_FUNNEL_CLOSED_AT_VERSION,
  V9_REALIZATION_MAINLINE_ENABLED,
  isV9RealizationMainlineEnabled,
  _setV9RealizationMainlineEnabled,
  V9_REALIZATION_READINESS_CHECKLIST,
  evaluateRealizationReadiness,
}
