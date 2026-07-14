# 第165轮专家圆桌会议纪要

**议题**: Sprint 82 中期检查——comfort注入进度、parentGuide渲染差异发现、代码迭代对齐  
**日期**: 2026-07-11 11:00  
**轮次**: 第165轮  
**出席**: 22位专家全体出席

---

## 📋 各专家意见

### CEO 周远见
- 观点: 164轮P0#1-5已闭环（3个bug修复+审计脚本+数据修正），但P0#6-8（comfort注入265条）零进展。这是Sprint 82的核心任务，不能只修bug不做内容。
- 建议: 本轮必须产出至少一个类别的comfort注入成果（body类34条），作为"最小可行交付"向团队证明这条管线是通的。
- 优先级: P0

### CTO 陈架构
- 观点: 164轮3个P0技术bug已修复，posttest递归、MP字段路径、审计脚本字段名均已闭环。技术基建就绪，comfort注入的管线已打通。
- 建议: 新发现——parentGuide字段在H5和MP两端均未渲染。PRD第164轮声称"H5已正确渲染parentGuide"不实。需要在H5/MP双端各加parentGuide显示区域。
- 优先级: P0

### CPO 叶用户
- 观点: parentGuide是王园长亲自设计的"家长互动指引"字段，body类50条已全部写入。但现在两端都不显示，等于这个字段形同虚设。
- 建议: parentGuide渲染是P0级——家长看不到"陪宝宝一起做动作"这类提示，互动引导就断了。不能只靠interactionHint。
- 优先级: P0

### CCO 文若水
- 观点: body类34条缺失comfort词，大部分是"好奇类"问题（如打喷嚏、长头发、打哈欠），这类问题不需要"别担心"式的安抚，但需要"暖暖的""真奇妙"式的情感陪伴。
- 建议: 按第164轮comfort词分级体系（A级情感安抚+B级辅助安抚），body类34条应全部归入B级——用"轻轻""暖暖""真奇妙"而非"别害怕"。本周可完成。
- 优先级: P0

### 心理学家 周教授
- 观点: 164轮一票否决（animals/society需parentGuide提示）仍然有效。但parentGuide字段现在两端都不渲染，一票否决的执行条件不满足。
- 建议: parentGuide渲染必须在comfort注入之前完成——否则即使加了"建议家长陪同"也看不到。这是P0前提条件。
- 优先级: P0（一票否决前提条件）

### 幼教 王园长
- 观点: body类50条的parentGuide都是我根据实验内容写的——"陪宝宝一起做动作""和宝宝一起找找看""让宝宝摸摸自己的肚子"。这些都是真实的亲子互动场景，家长看不到太可惜了。
- 建议: parentGuide显示位置：放在知识卡片底部、互动引导之上，用柔和的提示条（"👨‍👩‍👧 给家长的小提示：xxx"）。
- 优先级: P0

### 前端小凡
- 观点: MP端question.js在164轮已修复interactionHint字段路径。parentGuide渲染工作量不大——H5端KnowledgeCard加一个prop，MP端question.wxml加一个view块。双端各约30行代码。
- 建议: 本轮即可完成parentGuide双端渲染。H5 KnowledgeCard.vue新增parentGuide prop + 渲染区；MP question.wxml/question.js新增parentGuide数据绑定。
- 优先级: P0

### 吐槽师老王
- 观点: 164轮PRD又发现一处数据不实——"H5已正确渲染parentGuide"是假的。H5的QuestionDetail.vue和MP的question.wxml里都搜不到"parentGuide"字符串。诚信红线又被踩了一次。
- 建议: 立规矩：PRD中任何"已实现"声明必须附带代码路径+行号引用。否则默认视为"未实现"。
- 优先级: P0（诚信红线）

### 测试虫虫
- 观点: 164轮3个P0 bug修复后，测试套件72文件3586测试全部通过（0.3.98版本）。posttest递归已修复，审计脚本已标准化。
- 建议: 本轮新增parentGuide渲染后，需要对应的单元测试。建议在sprint80-interaction-hint-mp.test.js中扩展parentGuide覆盖率。
- 优先级: P1

### 后端老稳
- 观点: 审计脚本已标准化，但build-mp-data.cjs中未包含parentGuide字段的mp-data构建逻辑。如果新增parentGuide渲染，MP端数据构建流水线需要同步更新。
- 建议: 检查build-mp-data.cjs确认parentGuide字段是否已在输出的questions.json中。如果不在，需要补上。
- 优先级: P0

### 安全李姐
- 观点: 164轮周教授一票否决的animals/society类，本轮继续关注。本轮新增parentGuide渲染后，animals/society的"建议家长陪同阅读"提示有了落地的技术基础。
- 建议: 本轮先完成parentGuide渲染基建，下一轮（166轮）正式启动animals/society comfort注入+安全审查。
- 优先级: P1

### 法务张律
- 观点: parentGuide渲染不涉及新数据收集，纯本地展示，合规方面无顾虑。
- 建议: 无新增合规风险。
- 优先级: 无

### 彩虹姐
- 观点: parentGuide的视觉设计建议：使用暖色系（#FFF3E0背景），左侧小图标（👨‍👩‍👧），柔和圆角，不抢主内容视觉焦点。
- 建议: 与KnowledgeCard的interaction-guide样式保持一致调性，但用更柔和的色调区分（家长提示 vs 互动引导）。
- 优先级: P1

### UX 苏体验
- 观点: parentGuide放在回答文字下方、互动引导上方，是最自然的阅读流。家长先读回答→看到"怎么和孩子互动"→被引导做互动。
- 建议: 信息架构：answer → parentGuide → interactionHint → feedback。三步走：理解→引导→互动→反馈。
- 优先级: P1

### 墨小暖
- 观点: 无新增IP相关变更。rabbitEmotion/bearEmotion字段非body类仍然全缺，这是Sprint 83的扩展任务。
- 建议: 本轮聚焦parentGuide渲染+body comfort注入，emotion补齐留到Sprint 83。
- 优先级: P2

### 社会学刘教授
- 观点: parentGuide的"给家长的小提示"这个说法很好——"家长"比"爸爸/妈妈"更包容，覆盖隔代抚养、单亲等家庭结构。
- 建议: 确认parentGuide文案中不使用"爸爸""妈妈"等特定角色词，统一用"家长"或"大人"。
- 优先级: P1

### 全职妈妈小美
- 观点: 我看了body-001的parentGuide"陪宝宝一起做动作"，真的很实用！但我在小程序里完全看不到这个提示，只能靠猜。
- 建议: 快点让parentGuide显示出来吧，每次看到实验材料列表但不知道怎么引导孩子，真的很需要这个。
- 优先级: P0

### AI小智
- 观点: comfort词分级体系（A级情感安抚+B级辅助安抚）已设计好，策略矩阵（6类别×3问题类型）框架已就绪。body类34条缺失项中，28条属于"好奇类"（B级），6条属于"身体不适类"（A级，如打针、摔倒）。
- 建议: 本轮只做body类B级28条的comfort注入（成本低、风险低），A级6条需要周教授+安全李姐联合审查后再注入。
- 优先级: P0

### COO 林实干
- 观点: Sprint 82已经过半，P0 comfort注入265条零进展。如果按AI小智的方案，本轮交付body类28条B级，至少能证明管线是通的。
- 建议: 本周五前交付body类28条B级comfort注入 + parentGuide双端渲染。这是Sprint 82的"最小可行交付"。
- 优先级: P0

### 科普陈博士
- 观点: body类comfort注入中，需要确保科学准确性不被牺牲。比如"肚子咕噜咕噜叫"是正常的肠鸣音，不是"病了"，安抚词要传递正确的科学认知。
- 建议: body类comfort注入后，每类随机抽查3条做科学准确性spot check。
- 优先级: P1

### Global 何
- 观点: parentGuide和comfort词的i18n是后续任务。当前中文版先闭环，英文版翻译留到Sprint 83。
- 建议: 在数据schema中预留parentGuide的locale字段，为多语言做准备。
- 优先级: P2

### 钱守正 CFO
- 观点: 164轮技术债已清理3项P0，本轮新增parentGuide渲染+body comfort注入，不涉及新增成本。
- 建议: 当前烧钱速度正常，无预算预警。
- 优先级: 无

---

## ⚔️ 关键分歧与裁决

| 分歧点 | 正方 | 反方 | 裁决 |
|--------|------|------|------|
| parentGuide vs comfort注入优先级 | 周教授（parentGuide渲染是comfort注入的前提条件） | 文若水（comfort注入可以先做，parentGuide只影响展示） | CEO裁决：**parentGuide渲染优先**。没有渲染，注入的comfort也看不到。先打通展示管线，再注内容。 |
| 本轮comfort注入范围 | AI小智（只做body类28条B级） | 林实干（应该做全部body类34条，含A级） | CEO裁决：**采纳AI小智方案**。body类28条B级本轮交付，A级6条需周教授+安全李姐联合审查后下轮注入。先跑通管线。 |
| PRD诚信红线处理 | 老王（PRD中"已实现"声明必须附带代码路径引用） | CTO（当前流程已够，加代码路径引用增加维护成本） | CEO裁决：**采纳老王方案**。从本轮起，PRD"已实现"声明必须附带代码路径+行号。这是诚信红线，不能妥协。 |

---

## 🚨 一票否决权

- **周教授（维持164轮一票否决）**: animals和society类在comfort注入完成前，需在parentGuide渲染落地后，增加"建议家长陪同阅读"提示。本轮parentGuide渲染是执行前提。
- **安全李姐（无触发）**: 本轮无新增违规内容。
- **法务张律（无触发）**: 合规无新增风险。

---

## ✅ 本轮行动清单（15项，硬上限）

| # | 行动项 | 负责角色 | 优先级 | 预计完成 |
|---|--------|---------|--------|---------|
| 1 | H5 KnowledgeCard.vue新增parentGuide渲染区 | 前端小凡 + 彩虹姐 | P0 | 本轮 |
| 2 | MP question.wxml/question.js新增parentGuide渲染 | 前端小凡 + 苏体验 | P0 | 本轮 |
| 3 | build-mp-data.cjs确认parentGuide字段已包含 | 后端老稳 + CTO | P0 | 本轮 |
| 4 | body类28条B级comfort词注入 | 文若水 + AI小智 | P0 | 本轮 |
| 5 | 修正PRD"parentGuide已渲染"虚假声明 | CEO + 毒舌老王 | P0 | 本轮 |
| 6 | 立PRD诚信制度：已实现声明需附代码路径+行号 | 毒舌老王 + CTO | P0 | 本轮 |
| 7 | MP question.js parentGuide数据绑定（setData） | 前端小凡 | P0 | 本轮 |
| 8 | parentGuide渲染单元测试（H5 + MP） | 测试虫虫 | P1 | 本轮 |
| 9 | body类A级6条comfort词联合审查（周教授+安全李姐） | 周教授 + 安全李姐 + 文若水 | P1 | 166轮前 |
| 10 | parentGuide文案社会学审查（家庭结构包容性） | 社会学刘教授 | P1 | 166轮前 |
| 11 | 审计脚本加入parentGuide字段覆盖率统计 | 后端老稳 | P1 | 166轮 |
| 12 | parentGuide locale字段预留 | Global何 + 后端老稳 | P2 | Sprint 83 |
| 13 | body类comfort注入后科学准确度spot check | 科普陈博士 | P2 | 166轮 |
| 14 | 非body类parentGuide字段补齐（254条） | 文若水 + 王园长 | P2 | Sprint 83 |
| 15 | 双端对齐度diff脚本增加"实际渲染"检查（非仅文件存在性） | 毒舌老王 + 前端小凡 | P2 | Sprint 83 |

---

## 📊 PRD变更记录（V9.02 → V9.03）

- [修改] 版本号：V9.02 → V9.03
- [修改] 标题：Sprint 82 全域数据真实性审计 → Sprint 82 中期检查——parentGuide渲染落地+body comfort注入（第165轮专家圆桌评审）
- [**修正**] **parentGuide渲染声明不实**：V9.02声称"H5已正确渲染parentGuide"，实际H5和MP两端均未渲染parentGuide字段。诚信红线再次触发。
- [新增] parentGuide双端渲染方案：H5 KnowledgeCard.vue + MP question.wxml/question.js
- [新增] 诚信制度：PRD"已实现"声明必须附带代码路径+行号引用
- [新增] body类28条B级comfort词注入（好奇类问题，用"暖暖""轻轻""真奇妙"等B级安抚词）
- [修改] 双端对齐度：H5 100%→~95%（parentGuide未渲染），MP ~85%→~80%（parentGuide+interactionHint路径修复后仍缺parentGuide渲染）
- [修改] 行动清单：15项→15项（7 P0, 5 P1, 3 P2）
- [删除] V9.02中"parentGuide H5已正确渲染"虚假声明

---

## 🎯 下轮议题预告（第166轮）
- body类A级6条comfort词联合审查结果
- animals/society comfort注入+安全审查启动
- parentGuide双端渲染验收
- 数据审计脚本parentGuide统计更新

---

*本轮会议纪要由CEO周远见主持，22位专家全体出席，3项关键分歧CEO裁决，周教授维持一票否决（parentGuide渲染为执行前提）。*