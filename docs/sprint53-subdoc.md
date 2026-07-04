# 第108轮圆桌会议纪要 · V8.44 Sprint 53

**议题**: zh 源文 81% 漂移收紧 271×3 重写评估 —— keep-dual-contract 还是 rewrite-to-target？+ V9 i18n 证据链第三块落地 + readiness 第三次读数
**日期**: 2026-07-03 09:20
**轮次**: 第108轮迭代（Sprint 53 / V8.44 / 版本 0.3.46 → 0.3.47）
**主席**: CEO 周远见

---

## 一、议题宣读（CEO 周远见）

Sprint 52 冻结字数契约后，readiness 5 项里仍有 4 项卡后端排期/时间窗口。两道 P0（cloudSync flushReal、LLM 翻译 endpoint）均纯后端排期依赖，已催排未到。本轮唯一可在客户端纯落地的 V9 主线动作 = 收口 Sprint 53 候选清单里的 P1「zh 内容 81% 漂移收紧 271×3 重写评估」。把 CCO 在 Sprint 52 记账的"契约与现实脱节 81%、不重写 271×3 改双层契约"从一句口头裁决升级为**带真实读数 + 重写成本量化 + 决策冻结**的证据模块，作为 V9 i18n 生产准入证据链第三块（继 Sprint 51 CFO 签字、Sprint 52 字数契约）。

## 二、各专家意见

### 1. CEO 周远见（战略/ROI）
- 观点: 两道 P0 都卡后端，本周再催排也没用；唯一能移动的 domino 是把 zh 源文基线冻结成证据。
- 建议: 本轮落 `zhDriftRewriteEvaluation.js`（H5+MP 双端同构），把"不重写"从口头裁决变成带数字的冻结决策。
- 优先级: P0

### 2. COO 林实干（增长/执行）
- 观点: 北极星漏斗第34阶第三次读数 —— 仍 1/5 done、4 blockers、not ready；本轮是基线冻结不是 domino 移动，但可对外讲"证据链三块齐"。
- 建议: `summarizeDrift()` 出一句话对外话术："271 题 zh 源文审计，全部过 max，基线冻结"。
- 优先级: P1

### 3. CFO 钱守正（财务/单位经济）
- 观点: 重写 271×3 到 target 要花 CCO ~40 人时（零 V9 ROI）；本决策与 Sprint 51 我签字的"不重写、用 max 守闸"一致。
- 建议: `rewriteCostEstimate` 必须量化人时 + L2 内容损失率 28%，让未来任何人想翻案都得先解释这 40 人时和 28% 损失。
- 优先级: P1

### 4. CPO 叶用户（产品/用户价值）
- 观点: readiness 第 4 项加 `sourceBaselineRef` 指向本决策 = spec 侧第三块；status 仍 not-started（基线 ≠ 生产开闸）。
- 建议: 用户可见价值指针不变 —— 本轮无面向孩子 UI 变动，纯源端基线。
- 优先级: P1

### 5. CTO 陈架构（技术/架构）
- 观点: 与 layerWordCountContract/costSignoff/realizationReadiness 同型同构 —— deepFreeze 事实常量 + 纯函数，不引新依赖。
- 建议: `evaluateZhDrift` 复用 contract 的 `validateLayerAnswer` 计数逻辑（不重复 countChars 实现），保证与快照同口径。
- 优先级: P0

### 6. UX 总监 苏体验
- 观点: 本轮无交互/UI 变动，无我方意见；附议。
- 优先级: —

### 7. 视觉设计总监 彩虹姐
- 观点: 本轮无视觉/IP 变动，附议。
- 优先级: —

### 8. 首席插画师 墨小暖
- 观点: 问问兔/答答熊形象无变动，附议。
- 优先级: —

### 9. 前端技术负责人 前端小凡
- 观点: H5 ESM + MP CJS 双端同构，与既有模块同型；MP 端 `require('./layerWordCountContract')` 复用计数。
- 建议: 测试钩子 `__bw_zhDrift`，export 名 4 个跨端一致。
- 优先级: P0

### 10. 后端技术负责人 后端老稳
- 观点: deepFreeze 让 readout 与 rewriteCostEstimate 嵌套也不可篡改 —— 证据链全冻结。
- 建议: 决策常量 ID `zh-drift-rewrite-decision-sprint53`，readiness 第 4 项 `sourceBaselineRef` 双向不漂移守卫。
- 优先级: P0

### 11. AI/ML 工程师 AI 小智
- 观点: 重写源文到 target 不提升 en 翻译质量（max 是硬闸不是目标）；反而 layerContentHash（djb2，Sprint 35）比对前提是源文冻结 —— 本轮冻结 zh 基线给 V9 en 生产期稳定源基准。
- 建议: `rewriteCostEstimate.recommendation = 'do-not-pursue-until-v9-content-revision-cycle'`。
- 优先级: P1

### 12. CCO 文若水（内容终审）— 本轮主审
- 观点: Sprint 52 我说"不重写 271×3"是裁决不是证据。本轮 live re-audit：L2 超 target 218/271（80%），强行收紧要砍 5380 字（占 L2 总量 28%）—— 80% 的 L2 答案要被削，为一个非阻断愿景 target 牺牲真实内容密度 = cargo cult。
- 建议: 决策 `keep-dual-contract`，rationale 必须写明 28% 损失。
- 优先级: P0

### 13. 心理学家周教授（一票否决）— 本轮主审
- 观点: target 是发展目标（非阻断），max 是注意力硬闸。271×3 全部 overMax=0 → 现实内容已在注意力窗口内，无心理伤害风险。强行 rewrite-to-target 反而可能把 4-5 岁 L2 该有的"传粉过程"细节砍成干瘪一句，损害认知建构。
- 建议: 附议 keep-dual-contract；max 才是闸。
- 优先级: P0

### 14. 幼教王园长
- 观点: 本轮无场景/实验变动，附议。
- 优先级: —

### 15. 科学顾问 科普陈博士
- 观点: 本轮无科学准确性变动，附议。
- 优先级: —

### 16. 法务张律（一票否决）
- 观点: 零身份字段、零网络、零 flag 翻动（V9_REALIZATION_MAINLINE_ENABLED 仍 false）；ZH_DRIFT_REWRITE_DECISION 是决议事实常量，作为证据链第三块必须落地；决策 ≠ 上线。
- 建议: 不触发一票否决，反而要求必须落地作为合规证据链第三块；落地质量红线第33条。
- 优先级: P0

### 17. 内容安全审核官 安全李姐（一票否决）
- 观点: 本轮纯源文基线评估，无面向孩子内容/插画/AI 输出变动，未触任何内容安全红线；附议。
- 优先级: —

### 18. 首席吐槽师 毒舌老王
- 观点: 终于不是给 map 加 key 也不是再冻一个愿望契约 —— 本轮拿真读数回答"要不要重写"，答案是"不重写，因为 L2 要砍 28%"。
- 建议: `evaluateZhDrift` 返回 `{byLayer, totals, allPassMax, overMaxCount}` 就够；decision 字段精简到 decisionId/decision/rationale/readout/rewriteCostEstimate，别整 15 个字段。
- 优先级: P1

### 19. 社会学家 刘教授
- 观点: 本轮无用户画像/家庭结构变动，附议。
- 优先级: —

### 20. QA 测试负责人 测试虫虫
- 观点: `sprint53-zh-drift-rewrite-evaluation.test.js` 25 项单测覆盖决策字段完整性 / Object.freeze / 271×3 全过 max / rewriteCostEstimate / sourceBaselineRef 双向不漂移 / 复用 contract 计数同口径 / 双端同构 / 零身份字段。
- 建议: 三权放行（Vitest + ESLint + MP schema validate）。
- 优先级: P0

### 21. 家长代表 全职妈妈小美
- 观点: 我看不懂字数契约，但"不为了凑数字砍掉孩子爱听的细节"这件事我赞同。
- 优先级: —

### 22. 国际化顾问 Global 何
- 观点: zh 源文基线冻结是出海内容规格的源端闸 —— 翻译前源文稳定，en/ja/ko max 派生才有意义；本轮只冻结 zh。
- 优先级: P2

## 三、关键分歧与裁决

| 分歧点 | 正方 | 反方 | 裁决 |
|--------|------|------|------|
| zh 271×3 是否重写到 target | CCO/心理学家：keep-dual-contract，max 才是闸，重写损 28% 内容密度 | （无明确反方，但保留未来翻案可能） | CEO 裁决：keep-dual-contract，落地为冻结决策事实常量 + 成本量化， FORECLOSE 未来无证据翻案 |
| 证据链第三块挂在哪里 | CPO：挂 readiness 第 4 项 sourceBaselineRef | 毒舌老王：别动 readiness 结构（怕膨胀） | CEO 裁决：加 sourceBaselineRef 字段（不增清单项、不改 status），双向不漂移断言守卫；毒舌老王附议（字段不膨胀清单） |
| evaluateZhDrift 是否独立实现 countChars | CTO/前端小凡：复用 contract validateLayerAnswer | （无反方） | CEO 裁决：复用，保证与快照同口径；毒舌老王附议（不重复造轮子） |

## 四、本轮行动清单

| # | 行动项 | 负责角色 | 优先级 | 状态 |
|---|--------|---------|--------|------|
| 1 | 新建 `zhDriftRewriteEvaluation.js`（H5 ESM）—— 冻结决策 + 真实读数 + 成本量化 + evaluateZhDrift/summarizeDrift 纯函数 | 后端老稳 + 前端小凡 + CCO | P0 | ✅ 完成 |
| 2 | MP 端同构 `zhDriftRewriteEvaluation.js`（CJS，export 名一致） | 前端小凡 | P0 | ✅ 完成 |
| 3 | readiness 第 4 项（H5+MP）加 `sourceBaselineRef`，status 仍 not-started | CPO + 后端老稳 | P0 | ✅ 完成 |
| 4 | `sprint53-zh-drift-rewrite-evaluation.test.js` 25 项单测（含 sourceBaselineRef 双向不漂移 + readiness 第三次读数） | 测试虫虫 | P0 | ✅ 完成 |
| 5 | 版本 0.3.46 → 0.3.47，releaseDate 2026-07-03，build:mp-data 重生 | 前端小凡 | P0 | ✅ 完成 |
| 6 | 质量红线第33条：V9 i18n 源文基线冻结原则 | 法务张律 + CCO | P0 | ✅ 完成 |
| 7 | Vitest 51 files / 1651 tests passed（+25）、ESLint 0/0、MP schema PASSED（271 题/6 圈层）—— 三权放行 | 测试虫虫 | P0 | ✅ 完成 |
| 8 | 主 PRD V8.44 更新 + 本子文档 | CEO + CCO | P1 | ✅ 完成 |

## 五、PRD 变更记录

- [新增] `src/h5/utils/zhDriftRewriteEvaluation.js` + `src/miniprogram/utils/zhDriftRewriteEvaluation.js`（双端同构，V9 i18n 证据链第三块）
- [新增] `src/h5/stores/__tests__/sprint53-zh-drift-rewrite-evaluation.test.js`（25 项单测）
- [修改] `src/h5/utils/realizationReadiness.js` + `src/miniprogram/utils/realizationReadiness.js`：第 4 项加 `sourceBaselineRef: 'zh-drift-rewrite-decision-sprint53'`，status 仍 not-started
- [修改] `package.json` / `version.json` / `version-data.js`：0.3.46 → 0.3.47（2026-07-03）
- [新增] 质量红线第33条（V9 i18n 源文基线冻结原则）
- [修改] 主 PRD：V8.43 → V8.44，迭代日志加 Sprint 53 行，第108轮摘要，下轮议题更新

## 六、北极星漏斗第34阶第三次真实读数

`evaluateRealizationReadiness()` 第三次读数（V8.41→V8.42→V8.43→**V8.44**）：
- done: 1/5（CFO 成本签字，Sprint 51）
- blockers: 4（cloudSync flushReal / LLM endpoint / i18n 生产 / B 桶回流）
- ready: **false**（not ready —— 本轮基线冻结，spec-frozen 加注，非 domino 移动）
- 第 4 项 i18n-content-coverage：contractRef（Sprint 52）+ sourceBaselineRef（Sprint 53）双证据齐，status 仍 not-started

## 七、质量红线第33条（本轮新增）

**V9 i18n 源文基线冻结原则**（V8.44 Sprint 53）— V9 i18n 英文内容生产（readiness 第 4 项）开闸前，zh 源文 271×3 漂移重写决策必须先冻结为独立双端同构模块的事实常量（`zhDriftRewriteEvaluation.js`，含 decision/readout/rewriteCostEstimate，Object.freeze 不可篡改）；决策须为 `keep-dual-contract`（max 守生产准入、target 守发展愿景），并量化 rewrite-to-target 成本（L2 砍 5380 字/28%）以 FORECLOSE 无证据翻案；readiness 第 4 项加 `sourceBaselineRef` 指向决策 decisionId，并由单测一致性断言守卫"清单 sourceBaselineRef === 决策 decisionId"双向不漂移；`evaluateZhDrift()` live re-audit 须复用 `layerWordCountContract.validateLayerAnswer` 计数逻辑（同口径）；基线 ≠ 上线 —— 不翻 V9_REALIZATION_MAINLINE_ENABLED flag；CCO + 心理学家周教授 + 法务张律 + CTO 联合守护。

## 八、下轮议题预告（Sprint 54 候选）

- cloudSync flushReal V9 真实 fetch 落地 — P0（依赖后端排期，已催排）
- LLM 翻译流水线 server 端 endpoint 实现 — P0（CFO 已签字 + 字数契约已冻结 + zh 源文基线已冻结，条件俱备只等后端）
- evaluateRealizationReadiness() 第四次状态读数 — P1
- B 桶文案 2 周数据回流分析（2026-07-13 后启动）— P1
- zh 内容 81% 漂移收紧 271×3 重写评估 — ✅ Sprint 53 已闭合（keep-dual-contract 冻结）
- 英文版三层回答字数约束重审 — ✅ Sprint 52 已闭合
- ms-SG/fil-PH 子标签显式路由覆盖（DEFER 自 Sprint 49）— P2
- 高棉文 Token ratio 调优（V9 真实化时联合 AI 小智）— P2
- **战略议题：V9 真实化主线后端排期与融资节奏对齐** — P1（CEO + CFO + CTO 联合评议）

## 九、三权放行结论

- Vitest: 51 files / 1651 tests passed（0 failed，+25 新增）—— 连续第五个零红灯 Sprint（自 Sprint 49 起）
- ESLint: 0 errors / 0 warnings
- MP schema validate: PASSED（271 题 / 6 圈层 / 213 hands-on + 47 observation + 11 discussion）
- 版本号: 0.3.46 → 0.3.47，releaseDate 2026-07-03
