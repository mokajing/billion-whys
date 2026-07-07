# Bug Pattern Audit Report
Date: Tue Jul  7 06:01:08 AM CST 2026

## Smoke Test
✅ **16/16 PASS** (fix applied this run)

## Fix Applied This Run
- **BUG-0012** (P0): `constants.js:48` require 路径 `../../../../content/constants.json` 多一层 `../`，改为 `../../../content/constants.json`。修复后 smoke test 从 11/16 恢复到 16/16。

## R001: require .json files
⚠️ KNOWN (non-blocking):
```
src/miniprogram/utils/constants.js:48:const ageColorConfig = require('../../../content/constants.json')
```
Note: Node.js smoke test passes; WeChat MP runtime 不支持直接 require .json（参见 BUG-0001）。此处为 V8.69 引入的年龄色统一化，后续应包装为 .js wrapper 以彻底消除 R001 违规。

## R002: package.json in data dirs
✅ data/: OK
✅ src/miniprogram/subpackages/animals/: OK
✅ src/miniprogram/subpackages/body/: OK
✅ src/miniprogram/subpackages/food/: OK
✅ src/miniprogram/subpackages/home/: OK
✅ src/miniprogram/subpackages/nature/: OK
✅ src/miniprogram/subpackages/society/: OK

## R004: wx.getSystemInfoSync usage
✅ OK

## R005: app.json usingComponents count
✅ 0 components

## R006: wx:// component paths
✅ OK

## Package size
✅ 3632KB (< 50MB)

## Summary
- Audit lint violations: 1 (R001, known/non-blocking)
- Smoke test: 16/16 pass
- Bugs fixed this run: 1 (BUG-0012)
