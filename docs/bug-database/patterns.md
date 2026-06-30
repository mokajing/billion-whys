# Bug 模式检查规则 (Lint Rules)

> 从 bugs.jsonl 提炼的可执行检查规则，供代码审查/CI/IDE 用。

## P0 阻断规则（违反即报错）

### R001 · 禁止 require .json 文件
**来源**: BUG-0001
**规则**: 在 `src/miniprogram/**` 内，禁止 `require('...json')` 调用
**检查**: grep 正则 `require\(['"][^'"]+\.json['"]\)`
**修复**: 改为 require `.js` wrapper（无扩展名）

### R002 · 数据目录必须有 package.json
**来源**: BUG-0002
**规则**: `src/miniprogram/data/` 和 `src/miniprogram/subpackages/*/` 必须有 `package.json` 含 `{"type":"commonjs"}`
**检查**: 文件存在性检查
**修复**: 写入 `{"type":"commonjs"}`

## P1 强烈建议规则

### R003 · 主包大小 < 500KB
**来源**: BUG-0006
**规则**: `src/miniprogram/` 下主包文件总大小 < 500KB
**检查**: `du -sb src/miniprogram/`
**修复**: 大数据走分包

### R004 · 禁用 wx.getSystemInfoSync
**来源**: BUG-0003
**规则**: 源码中不出现 `wx.getSystemInfoSync(` 直接调用（必须走 safe-wx 包装）
**检查**: grep 正则 `wx\.getSystemInfoSync\(`
**修复**: 用 safeGetSDKVersion 或 wx.getDeviceInfo

### R005 · app.json 全局组件检查
**来源**: BUG-0004
**规则**: app.json 的 usingComponents 为空或 ≤ 2 个
**检查**: 解析 app.json
**修复**: 把组件改为页面级 usingComponents

### R006 · 禁用 wx:// 组件路径
**来源**: BUG-0005
**规则**: usingComponents 路径不以 `wx://` 开头
**检查**: grep 正则 `wx://`
**修复**: 用相对路径或 npm: 前缀

### R007 · 网络请求 URL 判空
**来源**: BUG-0007
**规则**: wx.request / image src 调用前必须判空
**检查**: 静态分析
**修复**: 加 `if (!url) return`

## 自动化检查脚本

```bash
# scripts/audit-bug-patterns.sh
#!/bin/bash
cd src/miniprogram

echo "=== R001: require .json ==="
grep -rn "require(['\"][^'\"]*\.json['\"])" . | grep -v node_modules || echo "OK"

echo "=== R002: package.json in data dirs ==="
[ -f data/package.json ] && echo "data/: OK" || echo "data/: MISSING"
for d in subpackages/*/; do
  [ -f "$d/package.json" ] && echo "$d: OK" || echo "$d: MISSING"
done

echo "=== R004: wx.getSystemInfoSync ==="
grep -rn "wx\.getSystemInfoSync(" . | grep -v safe-wx || echo "OK"

echo "=== R005: app.json usingComponents ==="
node -e "const a=require('./app.json'); const c=Object.keys(a.usingComponents||{}); console.log('count:', c.length)"

echo "=== R006: wx:// component paths ==="
grep -rn "wx://" . --include="*.json" || echo "OK"
```
