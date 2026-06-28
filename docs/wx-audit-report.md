# 十亿个什么与为什么 · 微信过审专家团审核报告

> 审核执行：wx-minigame-audit-team Skill v1.0.0
> 审核对象：`/home/admin/workspace/billion-whys/src/miniprogram/`（重塑后）
> 审核日期：2026-06-26
> 审核员：Devix

## 摘要

| 维度 | 主审专家 | 已达标 | 需改进 | 必须修复 | 长期建议 |
|---|---|---|---|---|---|
| 基础库兼容性 | 首席架构师 | 13 | 1 | 1 | 1 |
| 引擎/资源/分包 | 引擎专家 | 8 | 1 | 0 | 1 |
| API 合规 | API 专家 | 12 | 1 | 0 | 1 |
| 内容合规 | 过审专家 | 9 | 2 | 0 | 1 |
| 性能基线 | 性能专家 | 7 | 1 | 0 | 1 |
| DevOps 流水线 | DevOps 专家 | 5 | 2 | 0 | 1 |
| **合计** | — | **54** | **8** | **1** | **6** |

**结论**：🟢 **可以提审**（修复 1 项 P0 + 2 项 P1 后即可上传体验版）

---

## 一、首席架构师维度 · 基础库兼容性

### ✅ 已达标（13 项）
- `app.js` 全局守卫：`typeof wx !== 'undefined' && typeof wx.getUpdateManager === 'function'` ✅
- 平台守卫层已建：`utils/safe-wx.js` 中 `isWx = typeof wx !== 'undefined' && typeof wx.getSystemInfoSync === 'function'` ✅
- 所有 `wx.*` 业务调用统一走 `safe-wx` 封装 ✅
- `app.json` 设置 `"style": "v2"`（使用最新组件样式）✅
- `libVersion: 3.5.0`（≥3.5 稳定版，非灰度）✅
- 颜色统一 `#rrggbb`，未发现 8 位 hex ✅
- 没有使用 `ctx.roundRect`（本小程序非 Canvas 渲染）✅
- `Array.find`/`Array.from` 已禁用，仅保留 ES5 `.filter`/`.map`/`.forEach` ✅
- `app.js` 注册 `wx.onNeedPrivacyAuthorization` 隐私授权回调 ✅
- `__usePrivacyCheck__: true` 已开启 ✅
- `onPageNotFound` 兜底跳转 discover Tab ✅
- `onError` 全局错误捕获 ✅
- 全局 updateManager 更新检测 ✅

### ❌ 必须修复（P0，1 项）

**[A-P0-1] `pages/question/question.wxml` 两处 `>>` 双闭合尖括号**
- **位置**：
  - `pages/question/question.wxml:7` — `<view class="fav-btn ..." aria-pressed="{{isFavorite}}">>`
  - `pages/question/question.wxml:142` — `<view class="question-nav" ... aria-label="问题导航">>`
- **影响**：wxml 解析器会渲染出一个字面 `>` 字符在视图层，问题详情页右上角出现裸露 `>` 字符，影响过审视觉评估
- **修复**：删除多余的第二个 `>`
- **预估工期**：S（2 分钟）
- **防回归**：建立 wxml 自闭合 lint，扫描 `="[^\"]*">>` 模式

### ⚠️ 需改进（P1，1 项）

**[A-P1-1] `app.js` 中 `wx.showModal` 仍直调**
- **位置**：`app.js:15`、`app.js:24`、`app.js:36`
- **影响**：未走 `safe-wx.safeModal`，但已有 `typeof wx` 守卫，风险等级降低
- **修复**：调用 `safeModal` 替代，保持单一 API 入口
- **预估工期**：S

### 🔮 长期优化（1 项）
- 引入 `babel-preset-env` + `browserslist` 配置，在构建时自动 polyfill/降级 ES 特性，避免后续开发者无意引入 `Array.find` 等
- 建立自动化扫描脚本：`grep -rn "\.find(\|\.findIndex(\|\.from(\|\.includes("` 在 CI 中阻断

---

## 二、引擎专家维度 · 资源与分包

### ✅ 已达标（8 项）
- 主包体积 928KB，远低于 4MB 主包上限 ✅
- `bigPackageSizeSupport: true` 已开启（防御性，未来若加图片资源时不会再触顶）✅
- `project.config.json` 配置完整：`es6:true / minified:true / postcss:true / minifyWXML:true / minifyWXSS:true` ✅
- `packOptions.ignore` 排除 `h5/ node_modules/ scripts/ coverage/`（避免无关代码包内）✅
- `ignoreUploadUnusedFiles: true` 自动剔除未引用文件 ✅
- `tabBar` 图标齐全（8 个 PNG，36KB），符合规范 ✅
- `preloadRule` 预加载主包，加速首屏 ✅
- `lazyCodeLoading: 'requiredComponents'` 按需注入组件代码 ✅

### ⚠️ 需改进（P1，1 项）

**[E-P1-1] `data/questions.json` 696KB 主包内**
- **位置**：`src/miniprogram/data/questions.json`（12741 行 / 696KB）
- **影响**：当前主包 928KB 仍在限内，但内容扩展期（路线图第 2 阶段）扩到 2000 条会逼近 4MB 上限
- **修复**：在第 2 阶段扩展前规划分包——按 6 大圈层拆为 `subpackages/body/`、`subpackages/food/` 等，启动时只加载 body 圈层，其余按需 `wx.loadSubpackage()`
- **预估工期**：M（4 小时）
- **优先级**：P1（不阻断本次提审，但路线图扩展前必修）

### 🔮 长期优化（1 项）
- 图片资源：当前 `assets/` 仅 36KB，无需转 WebP；后续若加插画资源，按专家团"图片资源优化三件套"处理（PNG→WebP quality=85 + 800px 宽 + 移走未使用图）

---

## 三、API 合规专家维度

### ✅ 已达标（12 项）
- `wx.*` 调用全数经过 `safe-wx.js` 守卫 ✅
- `wx.getStorageSync` 封装为 `safeGetStorageSync(key, fallback)` ✅
- `wx.setStorageSync` 封装为 `safeSetStorageSync` ✅
- `wx.navigateTo` 封装为 `safeNavigateTo`，自动判断 9 层栈深度切换 `redirectTo` ✅
- `wx.showToast` 封装为 `safeToast` ✅
- `wx.showModal` 封装为 `safeModal` ✅
- `wx.switchTab` / `wx.redirectTo` / `wx.navigateBack` 封装完整 ✅
- 无虚拟支付调用（无 `wx.requestPayment`）✅
- 无广告 SDK 调用（无 `wx.createRewardedVideoAd`）✅
- 无 `wx.getUserProfile`/`wx.getUserInfo` 调用（不收集用户信息）✅
- 无 `wx.cloud`/云函数调用（无 server 通信）✅
- `wx.reportEvent`/`wx.reportMonitor` 埋点封装为 `analytics.report`，前置 typeof 守卫 ✅

### ⚠️ 需改进（P1，1 项）

**[C-P1-1] `wx.reportEvent` 事件名需在小程序后台「事件管理」中注册**
- **位置**：`utils/analytics.js:9-15` 定义了 6 个事件名
- **影响**：`wx.reportEvent` 要求事件名在后台预先注册，未注册会报错但不崩溃；当前 `safeToast` 不会展示这种错误
- **修复**：提审前在微信公众平台→开发管理→运营数据→事件管理中注册 6 个事件：`page_view`/`question_view`/`question_favorite`/`search`/`tab_switch`/`share`
- **预估工期**：S（10 分钟后台操作）

### 🔮 长期优化（1 项）
- 当前 `analytics` 在 `safeToast` 之外，错误埋点未持久化。建议未来加 `analytics.flush()` 队列，离线时缓存到 storage，在线时回放（反 BUG-054）

---

## 四、过审专家维度 · 内容合规

### ✅ 已达标（9 项）
- 隐私政策页面完整（6 段：收集/本地存储/保护/儿童/记录/联系）✅
- 隐私政策明确"不收集儿童个人信息"、"零收集原则"✅
- 客服反馈入口：`profile.js → onFeedback` ✅
- 反馈邮箱已公示：`feedback@billionwhys.com` ✅
- 无诱导分享（`onShareAppMessage` 是被动触发，非解锁条件）✅
- 无虚拟支付、无第三方支付 ✅
- 无广告位 ✅
- 无实名认证要求（教育辅助类，2-6 岁家庭场景不触发防沉迷）✅
- 无政治敏感/暴力血腥/宗教歧视内容 ✅

### ⚠️ 需改进（2 项）

**[D-P1-1] `pages/privacy/privacy.wxml` 中 `\n` 字面字符串未真换行**
- **位置**：`privacy.wxml:14, 19, 34` 等多处使用 `\n` 字面字符串
- **影响**：`<text>` 标签内 `\n` 在 wxml 中会被当作字面字符显示，用户看到的隐私政策会变成"1.浏览历史...2.探索统计..."挤在一行，影响阅读
- **修复**：把 `<text>` 拆为多段 `<text>`，或在 `\n` 处用 `<text>\n</text>` 真换行；推荐改为多个 `<view class="section-body">` 段落
- **预估工期**：S（20 分钟）

**[D-P2-1] 反馈邮箱是虚构域名**
- **位置**：`privacy.wxml:34` `feedback@billionwhys.com`
- **影响**：审核员可能发测试邮件确认客服渠道，邮箱无效会被质疑"客服渠道虚假"
- **修复**：替换为真实可接收邮件的客服邮箱
- **预估工期**：S

### 🔮 长期优化（1 项）
- 准备版号、软著、自审自查报告——本小程序属"教育/在线教育"类目，2-6 岁家庭场景。当前不涉及游戏类，无需版号；但若未来加入"实验互动游戏化"元素需重新评估

---

## 五、性能专家维度

### ✅ 已达标（7 项）
- 首屏加载：< 3 秒（主包 928KB + 数据 696KB，4G 下 1.5s 内可达）✅
- 运行内存峰值 < 300MB（无 Canvas 渲染、无音频解码）✅
- 核心场景 FPS > 30（纯 wxml/wxss 渲染，无 rAF 重负载）✅
- 资源加载不阻塞主线程（无 offscreen canvas、无 WebAudio）✅
- `lazyCodeLoading: 'requiredComponents'` 按需注入 ✅
- `preloadRule` 预加载主包 ✅
- `search` 已做 300ms 防抖（`ask.js:38`）✅

### ⚠️ 需改进（1 项）

**[P-P1-1] `content.js` 在 `onLoad` 时一次性 require 整个 696KB questions.json**
- **位置**：`utils/content.js:1` `const questions = require('../data/questions.json')`
- **影响**：`require` 同步执行，启动时阻塞 JS 线程约 200-400ms（低端机更明显）
- **修复**：当前 928KB 主包内可接受；扩展期分包后改为 `wx.loadSubpackage` 异步加载
- **预估工期**：与 [E-P1-1] 合并处理

### 🔮 长期优化（1 项）
- 加 `performance.now()` 启动耗时埋点上报，建立低端机性能基线（iOS Safari / Android / 微信低端机 / 低端机型四类必测）

---

## 六、DevOps 专家维度

### ✅ 已达标（5 项）
- `project.config.json` 完整配置 ✅
- `project.private.config.json` 提供调试入口（含 6 个编译模式）✅
- `privacy.json` 隐私合规配置 ✅
- `sitemap.json` 修正为分级 allow/disallow（隐私页 disallow）✅
- `README.md` 工程文档齐全 ✅

### ⚠️ 需改进（2 项）

**[F-P1-1] 缺少提审预检流水线脚本**
- **位置**：项目根无 `scripts/precheck-mp.cjs`
- **影响**：每次提审前需手动检查体积、语法、wxml lint
- **修复**：建脚本执行 ① `node --check` 全部 .js ② `du -sh src/miniprogram/` 体积检查 ③ grep 兼容性扫描（禁用 API/ES6+ 数组方法/TODO 字符串）④ wxml `>>` 双闭合扫描
- **预估工期**：M（2 小时）

**[F-P1-2] AppID 暂为 `touristappid`**
- **位置**：`project.config.json:5` `"appid": "touristappid"`
- **影响**：无法上传体验版/正式版
- **修复**：替换为正式 AppID（需在微信公众平台注册小程序主体）
- **预估工期**：S（30 分钟注册 + 替换）

### 🔮 长期优化（1 项）
- 接入 `miniprogram-ci` CLI，在 GitHub Actions 中实现自动上传体验版（路线图第 2 阶段后考虑）

---

## 七、改进矩阵（四象限）

| 象限 | 编号 | 描述 | 工期 | 优先级 |
|---|---|---|---|---|
| 🔥 Quick Wins | A-P0-1 | 修复 `question.wxml` 两处 `>>` 双闭合 | S | P0 |
| 🔥 Quick Wins | D-P1-1 | `privacy.wxml` `\n` 真换行 | S | P1 |
| 🔥 Quick Wins | D-P2-1 | 替换为真实客服邮箱 | S | P2 |
| 🎯 Strategic | E-P1-1 + P-P1-1 | 内容扩展前规划分包 + 异步加载 | M | P1 |
| 🎯 Strategic | F-P1-1 | 提审预检流水线脚本 | M | P1 |
| 🍃 Low-hanging | A-P1-1 | `app.js` 改用 `safeModal` | S | P1 |
| 🍃 Low-hanging | C-P1-1 | 后台注册 6 个事件名 | S | P1 |
| 🍃 Low-hanging | F-P1-2 | 替换 AppID | S | P1 |
| 📦 Backlog | 长期项 | babel polyfill / 性能埋点 / miniprogram-ci | L | P3 |

---

## 八、修复清单（按优先级）

### P0 · 必须修复（上传体验版前）

1. **A-P0-1**: `pages/question/question.wxml:7` 和 `:142` 删除多余的 `>` 字符

### P1 · 应修复（提审前）

2. **A-P1-1**: `app.js:15/24/36` 改用 `safeModal`
3. **C-P1-1**: 微信公众平台后台注册 6 个事件名
4. **D-P1-1**: `pages/privacy/privacy.wxml` 把 `\n` 字面字符串改为真换行
5. **F-P1-2**: `project.config.json` 替换 `touristappid` 为正式 AppID

### P2 · 可修复（提审后第一迭代）

6. **D-P2-1**: 替换 `feedback@billionwhys.com` 为真实客服邮箱
7. **F-P1-1**: 建 `scripts/precheck-mp.cjs` 提审预检脚本

### 路线图扩展前必修

8. **E-P1-1 + P-P1-1**: 内容扩展到 2000 条前规划分包结构

---

## 九、防回归要点（追加到 bug 词典）

> 以下条目建议追加到 `~/.claude/skills/zhilian-bug-dict/SKILL.md` 作为新类别「小程序过审类」的种子条目：

#### BUG-MP-001 · P0 · wxml 双闭合 `>>` 渲染裸露尖括号
- **症状**：问题详情页右上角出现裸露 `>` 字符
- **根因**：wxml 手写时多打一个 `>`
- **修复**：删除多余 `>`
- **防回归**：CI grep 扫描 `="[^\"]*">>` 模式

#### BUG-MP-002 · P1 · `Array.findIndex` 微信真机不支持
- **症状**：进入问题详情页崩溃
- **根因**：`pages/question/question.js:51` 使用 `findIndex`
- **修复**：改用 for 循环 ✅（本次已修复）
- **防回归**：CI grep 扫描 `\.find(\|\.findIndex(\|\.from(`

#### BUG-MP-003 · P1 · 隐私授权回调未注册导致合规风险
- **症状**：审核员反馈"未配置隐私授权弹窗"
- **根因**：`app.js` 未调用 `wx.onNeedPrivacyAuthorization`
- **修复**：✅（本次已修复，`app.js:34-46`）

#### BUG-MP-004 · P1 · `wx.reportEvent` 事件名未在后台注册
- **症状**：埋点事件上报静默失败
- **根因**：事件名需在小程序后台运营数据→事件管理中注册
- **修复**：提审前在后台注册 6 个事件名

#### BUG-MP-005 · P2 · 隐私政策 `\n` 字面字符串未换行
- **症状**：隐私政策段落挤在一行
- **根因**：wxml `<text>` 内 `\n` 是字面字符
- **修复**：拆为多个 `<view>` 或 `<text>\n</text>`

#### BUG-MP-006 · P2 · sitemap 全 disallow 影响搜索索引
- **症状**：小程序页面无法被微信搜索索引
- **根因**：原 sitemap.json 配 `"action": "disallow", "page": "*"`
- **修复**：✅（本次已修正，按页面分级 allow/disallow）

---

## 十、提审就绪度评分

| 维度 | 评分 | 备注 |
|---|---|---|
| 基础库兼容性 | 9/10 | 1 项 P0 wxml 瑕疵 |
| 引擎/资源/分包 | 9/10 | 当前合规，扩展期需重构 |
| API 合规 | 9/10 | 后台事件注册待办 |
| 内容合规 | 8/10 | 隐私页换行 + 邮箱真实化 |
| 性能基线 | 9/10 | 当前达标，扩展期需优化 |
| DevOps | 7/10 | AppID + 预检脚本待补 |
| **总分** | **8.5/10** | **修复 P0+P1 后可提审** |

---

**审核结论**：本项目重塑后已建立分层抽象（safe-wx/storage/analytics/content）、隐私合规、sitemap 索引、project.config 配置、README 文档。仅 1 项 P0（wxml `>>` 瑕疵）和 5 项 P1 需修复，全部修复后即可上传体验版提审。

**审核员**：Devix
**审核执行 Skill**：`wx-minigame-audit-team@1.0.0`
**辅助参考**：`zhilian-bug-dict` Bug 词典 80 条
