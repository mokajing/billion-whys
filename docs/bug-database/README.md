# Bug 词典库 (Bug Database)

> 自动维护的 bug 知识库，每次修复 bug 后自动写入，迭代前必读避免重犯。

## 文件结构
- `bugs.jsonl` — 主数据库，每行一个 bug（JSON Lines 格式，便于追加）
- `patterns.md` — 提炼的检查规则（供代码审查/CI 用）
- `auto-fix-hook.sh` — git commit 钩子，自动从 commit message 提取 bug 并入库
- `daily-sync.sh` — 每日定时任务，扫描日志/commit 提取遗漏的 bug

## Bug 条目结构（JSONL）
```json
{
  "id": "BUG-0001",
  "title": "WeChat MP 无法 require .json 文件",
  "severity": "P0",
  "category": "module-loading",
  "discovered_at": "2026-07-01T00:30:00+08:00",
  "fixed_at": "2026-07-01T00:45:00+08:00",
  "fixed_in_commit": "abc1234",
  "root_cause": "WeChat mini-program 的 require() 只能加载 .js 文件，不能直接 require .json",
  "fix": "把 .json 文件包成 .js wrapper（module.exports = {...}），并加 data/package.json 设 type:commonjs",
  "files_changed": ["src/miniprogram/data/questions-data.js", "scripts/build-mp-data.cjs"],
  "symptom": "Error: module 'data/questions.json.js' is not defined, require args is '../data/questions.json'",
  "detection": "WeChat Dev Tools 控制台报错",
  "prevention": "禁止在 src/miniprogram/ 内 require 任何 .json 文件，build-mp-data 必须同时生成 .js wrapper"
}
```

## 使用规则
1. **修复 bug 时**：在 commit message 中加 `Bug-Database: <一句话描述>`，钩子自动入库
2. **每日定时**：扫描当日 commit + WeChat Dev Tools 日志，提取遗漏 bug
3. **迭代前必读**：所有新功能开发前，先 `cat docs/bug-database/bugs.jsonl | jq .title` 浏览已知坑
4. **CI 检查**：lint 规则会读取 patterns.md，对已知 bug 模式报错

## 已收录 bug 数
（自动更新，见 bugs.jsonl 文件）
