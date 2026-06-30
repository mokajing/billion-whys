#!/bin/bash
# Layer 1: 静态代码扫描，基于 bug-database/patterns.md
# 用法: bash scripts/audit-bug-patterns.sh

set -u
cd "$(dirname "$0")/.."
REPORT="docs/bug-database/audit-report.md"
FAIL_COUNT=0

echo "# Bug Pattern Audit Report" > "$REPORT"
echo "Date: $(date)" >> "$REPORT"
echo "" >> "$REPORT"

# R001: 禁止 require .json
echo "## R001: require .json files" >> "$REPORT"
VIOLATIONS=$(grep -rn "require(['\"][^'\"]*\.json['\"])" src/miniprogram/ 2>/dev/null | grep -v node_modules | grep -v "questions.json.js\|questions-index.json.js\|version.json.js")
if [ -n "$VIOLATIONS" ]; then
    echo "❌ VIOLATIONS:" >> "$REPORT"
    echo '```' >> "$REPORT"
    echo "$VIOLATIONS" >> "$REPORT"
    echo '```' >> "$REPORT"
    FAIL_COUNT=$((FAIL_COUNT + 1))
else
    echo "✅ OK" >> "$REPORT"
fi

# R002: data/ 目录有 package.json
echo "" >> "$REPORT"
echo "## R002: package.json in data dirs" >> "$REPORT"
[ -f src/miniprogram/data/package.json ] && echo "✅ data/: OK" >> "$REPORT" || { echo "❌ data/: MISSING" >> "$REPORT"; FAIL_COUNT=$((FAIL_COUNT + 1)); }
for d in src/miniprogram/subpackages/*/; do
    [ -f "$d/package.json" ] && echo "✅ $d: OK" >> "$REPORT" || { echo "❌ $d: MISSING" >> "$REPORT"; FAIL_COUNT=$((FAIL_COUNT + 1)); }
done

# R004: 禁用 wx.getSystemInfoSync
echo "" >> "$REPORT"
echo "## R004: wx.getSystemInfoSync usage" >> "$REPORT"
VIOLATIONS=$(grep -rn "wx\.getSystemInfoSync(" src/miniprogram/ 2>/dev/null | grep -v "safe-wx\|node_modules")
if [ -n "$VIOLATIONS" ]; then
    echo "❌ VIOLATIONS:" >> "$REPORT"
    echo '```' >> "$REPORT"
    echo "$VIOLATIONS" >> "$REPORT"
    echo '```' >> "$REPORT"
    FAIL_COUNT=$((FAIL_COUNT + 1))
else
    echo "✅ OK" >> "$REPORT"
fi

# R005: app.json 全局组件
echo "" >> "$REPORT"
echo "## R005: app.json usingComponents count" >> "$REPORT"
COMPONENT_COUNT=$(node -e "try{const a=require('./src/miniprogram/app.json');console.log(Object.keys(a.usingComponents||{}).length)}catch(e){console.log('error')}" 2>/dev/null)
if [ "$COMPONENT_COUNT" -le 2 ] 2>/dev/null; then
    echo "✅ $COMPONENT_COUNT components" >> "$REPORT"
else
    echo "❌ $COMPONENT_COUNT components (should be ≤ 2)" >> "$REPORT"
    FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# R006: 禁用 wx:// 组件路径
echo "" >> "$REPORT"
echo "## R006: wx:// component paths" >> "$REPORT"
VIOLATIONS=$(grep -rn "wx://" src/miniprogram/ --include="*.json" 2>/dev/null)
if [ -n "$VIOLATIONS" ]; then
    echo "❌ VIOLATIONS:" >> "$REPORT"
    echo '```' >> "$REPORT"
    echo "$VIOLATIONS" >> "$REPORT"
    echo '```' >> "$REPORT"
    FAIL_COUNT=$((FAIL_COUNT + 1))
else
    echo "✅ OK" >> "$REPORT"
fi

# Package size check
echo "" >> "$REPORT"
echo "## Package size" >> "$REPORT"
SIZE_KB=$(du -sk src/miniprogram/ 2>/dev/null | cut -f1)
if [ "$SIZE_KB" -lt 51200 ]; then
    echo "✅ ${SIZE_KB}KB (< 50MB)" >> "$REPORT"
else
    echo "⚠️ ${SIZE_KB}KB (large, may exceed 2MB main package limit)" >> "$REPORT"
fi

echo "" >> "$REPORT"
echo "## Summary" >> "$REPORT"
echo "Failures: $FAIL_COUNT" >> "$REPORT"

echo ""
echo "=== Audit complete: $FAIL_COUNT failures ==="
cat "$REPORT"

exit $FAIL_COUNT
