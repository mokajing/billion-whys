# 十亿个什么与为什么 · 开发宪法

> 本文件每次对话自动加载，是项目的最高约束规则。所有开发、审核、发版行为必须遵守。
> 详细规范见 `rules/` 目录各文件。

## 核心约束（违反即阻断）

### 代码规范
- 所有 wx.* API 调用必须经过 `utils/safe-wx.js` 守卫层
- 禁止 require .json 文件（WeChat MP 不支持，必须用 .js wrapper）
- 每个目录有 package.json: {"type":"commonjs"}（根 package.json 是 type:module）
- 主包 ≤ 2MB，总包 ≤ 20MB
- 图片 WebP 384px q60，≤200KB/张
- ESLint 必须通过，无 error

### 微信审核
- 提审前必须过 `rules/03-wechat-audit.md` 的 12 项自检清单
- 类目：工具-效率（个人主体）
- 隐私协议外链必须可访问
- 未成年人保护机制必须实现（家长验证+时长限制+举报）

### 版本管理
- Git 分支：main（生产）/ develop（开发）/ hotfix-*（热修复）
- 禁止 force push main
- 版本号：semantic versioning（v1.0.0）
- 回滚：`git revert` 优先，`git reset --hard` 需双人确认

### Bug 词典
- 修复 bug 时 commit message 必须含 `Bug-Database: <描述>`
- post-commit 钩子自动入库到 `docs/bug-database/bugs.jsonl`
- 迭代前必须扫描 `docs/bug-database/patterns.md` 已知坑

### 未成年人保护
- 2-6 岁内容必须无暴力/恐怖/性暗示
- 科学层仅家长可见
- 不收集未成年人个人信息
- 单次 ≤15min，每日 ≤30min

## 自动化门禁
- 提交前：`bash scripts/audit-bug-patterns.sh`（0 failures 才放行）
- 发版前：`node scripts/smoke-test.cjs`（全部通过才发版）
- CI：ESLint + schema 校验 + 包大小检查

## 详细规范索引
- `rules/01-code-standards.md` — 代码规范（好/坏对比+ESLint+注释模板+错误处理）
- `rules/02-version-iteration.md` — 版本迭代（多版本共存+API版本+分支策略+回滚）
- `rules/03-wechat-audit.md` — 微信审核（12项自检+类目+隐私+付费）
- `rules/04-compliance-legal.md` — 合规法务（未成年人保护+隐私法+内容安全）
- `rules/05-quality-gates.md` — 质量门控（发版标准+测试+CI/CD）
- `rules/06-bug-dictionary.md` — Bug 词典（入库+patterns+迭代前必读）
- `rules/07-top-team-practices.md` — 顶级团队实践（Google/Meta/字节/微信/蚂蚁）
