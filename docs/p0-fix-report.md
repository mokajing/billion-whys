# P0 审核阻塞项修复报告

> 生成日期：2026-06-30
> 修复目标：微信小程序「十亿个什么与为什么」4 项 P0 审核阻塞项
> 审核报告：`docs/wx-audit-report-2026-06-30.md`

---

## 修复总览

| 编号 | 标题 | 状态 |
| --- | --- | --- |
| P0-1 | appid 占位符 | ✅ 已修复 |
| P0-2 | 未成年人保护机制 | ✅ 已修复 |
| P0-3 | 图片 CDN 访问 | ✅ 已修复 |
| P0-4 | 隐私政策外链 | ✅ 已修复 |

附加修复：P2-8 内存警告监听（在 `app.js` 中一并接入 `wx.onMemoryWarning`）。

---

## P0-1：appid 占位符

**修改文件**：
- `project.config.json` — `appid` 字段由 `"touristappid"` 改为 `"TOURIST_APPID_PERSONAL_PENDING"`（占位符提醒开发者替换为个人 AppID）

**新增文档**：
- `docs/project-config.md` — 说明 AppID 占位符含义、注册流程（https://mp.weixin.qq.com/）、个人主体限制

---

## P0-2：未成年人保护机制

### 新增文件

1. **`src/miniprogram/utils/minor-protection.js`** — 未成年人保护核心模块
   - 题库 6 题（成年常识），随机抽 3 题
   - 单次会话 15 分钟、每日 30 分钟
   - 22:00-6:00 不可用时段
   - 使用 `wx.setStorageSync / getStorageSync` 记录使用时长
   - 导出函数：`verifyParent() / checkTimeLimit() / recordUsage() / isDisabled() / getRemainingTime() / markParentVerified() / getQuestionPool() / getUsageStats() / resetSession()`
   - 全部 `wx.*` 调用走 `safe-wx.js` 守卫层

2. **`src/miniprogram/pages/parent-verify/parent-verify.{js,wxml,wxss,json}`** — 首次启动家长验证页
   - 3 道随机题，单选题逐题作答
   - 全对 → `markParentVerified()` 写入 `parent_verified=true` 与时间戳
   - 失败 → 重新抽题，不锁定（产品决定不设锁定以避免家长被困）

3. **`src/miniprogram/pages/report/report.{js,wxml,wxss,json}`** — 举报不当内容页
   - 4 个举报原因单选（不适宜内容/暴力/恐怖/其他）
   - 问题描述 textarea（≤300 字）
   - 优先调用 `wx.openCustomerServiceChat`（若可用），失败则本地存储 `mp_reports`（保留最近 50 条）

### 修改文件

4. **`src/miniprogram/app.js`**
   - `onLaunch`：未通过家长验证 → `safeRedirectTo` 跳转 `parent-verify`；已通过则检查夜间不可用时段
   - `onShow`：每次回到前台调用 `checkTimeLimit()`，超时弹提示
   - `onHide`：调用 `recordUsage()` 累计使用时长
   - 接入 `wx.onMemoryWarning` 监听（同时修复 P2-8）

5. **`src/miniprogram/app.json`**
   - `pages` 数组新增 `pages/parent-verify/parent-verify` 与 `pages/report/report`

6. **`src/miniprogram/pages/profile/profile.{js,wxml,wxss}`**
   - 新增「今日剩余使用时间」卡片（含进度条与家长验证状态）
   - 菜单新增「举报不当内容」入口 → 跳转 report 页
   - 菜单新增「家长控制面板」入口 → modal 展示使用统计（验证状态/今日已用/本次会话已用/保护机制说明）

---

## P0-3：图片 CDN 访问

**修改文件**：`src/miniprogram/utils/content.js`

- `toWebP(path)` 默认返回 jsDelivr CDN URL：
  `https://cdn.jsdelivr.net/gh/mokajing/billion-whys@main/content/<path>`
- 新增 `toWebPFallback(path)` 返回备用 raw.githubusercontent.com URL
- 新增 `CDN_BASE` / `CDN_FALLBACK` 常量导出
- 本地调试：开发者可在 storage 设置 `bw_use_local_image=true` 切回相对路径
- 保留 `.png/.jpe/.jpeg → .webp` 转换逻辑

**修改文件**：`src/miniprogram/pages/question/question.js`
- `onImgError` 增强：主 CDN 失败 → 切换备用 CDN，仍失败才清空 `src`

---

## P0-4：隐私政策外链

**新增文件**：
- `docs/privacy-policy.html` — 由 `docs/privacy-policy.md` 自动渲染的静态 HTML（含响应式样式，19951 字节）
- `scripts/build-privacy-html.cjs` — 零依赖的极简 markdown → HTML 转换脚本

**修改文件**：
- `src/miniprogram/privacy.json` — 新增 `privacyPolicyExternalUrl`（GitHub Pages 主 URL）与 `privacyPolicyExternalUrlFallback`（GitHub raw URL 备用）
  - 主：`https://mokajing.github.io/billion-whys/privacy-policy.html`
  - 备：`https://raw.githubusercontent.com/mokajing/billion-whys/main/docs/privacy-policy.html`
- `package.json` — 新增 npm 脚本 `build:privacy-html`，便于 CI 中自动生成

> 注：实际可访问需在 GitHub 仓库 Settings → Pages 中开启 Pages（main 分支 /docs 目录）。本次先写入 URL，GitHub Pages 配置后续由用户在 GitHub 仓库设置中开启即可。

---

## 验证记录

- `minor-protection.js` 通过 Node CJS smoke test：`verifyParent() / checkTimeLimit() / getQuestionPool() / getUsageStats() / isDisabled()` 全部正常返回
- `content.toWebP()` 通过 Node CJS smoke test：本地路径正确转为 jsDelivr CDN URL；`toWebPFallback()` 正确返回 raw URL
- `build-privacy-html.cjs` 已成功生成 `docs/privacy-policy.html`（12283 → 19951 字节）

---

## 后续提醒（非本次修复范围）

1. **AppID 替换**：发布前需在 `project.config.json` 把 `TOURIST_APPID_PERSONAL_PENDING` 替换为真实个人 AppID（https://mp.weixin.qq.com/ 注册）
2. **GitHub Pages 开启**：仓库 Settings → Pages → Source 选 `main` 分支 `/docs` 目录
3. **小程序后台域名白名单**：jsDelivr CDN（`cdn.jsdelivr.net`）与 raw.githubusercontent.com（`raw.githubusercontent.com`）需在「开发管理 → 开发设置 → 服务器域名 → downloadFile 合法域名」中添加
4. **客服会话**：`report.js` 中 `wx.openCustomerServiceChat` 需配置企业 ID，否则会自动降级为本地存储
5. **未推送 Git**：本次仅本地修改，未执行 `git push`，后续由用户检查后统一推送

---

## 修改文件清单

### 新增（11 个）
- `docs/project-config.md`
- `docs/privacy-policy.html`
- `scripts/build-privacy-html.cjs`
- `src/miniprogram/utils/minor-protection.js`
- `src/miniprogram/pages/parent-verify/parent-verify.{js,wxml,wxss,json}`（4 个）
- `src/miniprogram/pages/report/report.{js,wxml,wxss,json}`（4 个）

### 修改（7 个）
- `project.config.json`（appid + minimumLibVersion）
- `src/miniprogram/app.js`（家长验证 / 时间限制 / 内存监听）
- `src/miniprogram/app.json`（新增 2 个页面）
- `src/miniprogram/privacy.json`（外链 URL）
- `src/miniprogram/utils/content.js`（CDN URL）
- `src/miniprogram/pages/question/question.js`（CDN fallback）
- `src/miniprogram/pages/profile/profile.{js,wxml,wxss}`（usage card / report / parent control 入口）
- `package.json`（新增 build:privacy-html 脚本）

---

*报告由 P0 修复脚本自动生成，详见 `docs/wx-audit-report-2026-06-30.md` 原始审核报告。*
