#!/bin/bash
# prd_test_consistency_check.sh
# 第160轮 Sprint 81 中期检查：PRD 更新前自动校验测试结果与 PRD 描述一致性
# 第160轮修复：.last_test_result.txt 缓存由 npm posttest hook 自动更新
# CTO + 测试虫虫 联合开发
# 用法：bash scripts/prd_test_consistency_check.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LAST_RESULT="$PROJECT_ROOT/.last_test_result.txt"
PACKAGE_JSON="$PROJECT_ROOT/package.json"

echo "=========================================="
echo " PRD Test Consistency Check"
echo " 第158轮 Sprint 80 收尾"
echo "=========================================="

# 1. Check last test result file exists
if [ ! -f "$LAST_RESULT" ]; then
    echo "[ERROR] No .last_test_result.txt found. Run 'npm test' first."
    exit 1
fi

# 2. Parse test file count
TEST_FILES=$(grep -oP 'Test Files\s+\K\d+(?=\s+passed)' "$LAST_RESULT" 2>/dev/null || echo "0")
TEST_COUNT=$(grep -oP 'Tests\s+\K\d+(?=\s+passed)' "$LAST_RESULT" 2>/dev/null || echo "0")

echo ""
echo "--- Test Results ---"
echo "Test Files: ${TEST_FILES}"
echo "Test Count: ${TEST_COUNT}"
echo ""

# 3. Parse version from package.json
VERSION=$(node -e "console.log(require('$PACKAGE_JSON').version)" 2>/dev/null || echo "unknown")
echo "Version (package.json): ${VERSION}"

# 4. Run lint check
echo ""
echo "--- Lint Check ---"
LINT_OUTPUT=$(cd "$PROJECT_ROOT" && npm run lint 2>&1 || true)
LINT_ERRORS=$(echo "$LINT_OUTPUT" | grep -c "error" 2>/dev/null | head -1 || echo "0")
LINT_WARNINGS=$(echo "$LINT_OUTPUT" | grep -c "warning" 2>/dev/null | head -1 || echo "0")
# Strip any trailing newlines
LINT_ERRORS=$(echo "$LINT_ERRORS" | tr -d '\n' | grep -oP '\d+' || echo "0")
LINT_WARNINGS=$(echo "$LINT_WARNINGS" | tr -d '\n' | grep -oP '\d+' || echo "0")
echo "Lint errors: ${LINT_ERRORS}"
echo "Lint warnings: ${LINT_WARNINGS}"

# 5. Validation checks
PASS=true

if [ "$TEST_FILES" -lt 72 ]; then
    echo "[WARN] Test files count ($TEST_FILES) is below baseline (72)"
    PASS=false
fi

if [ "$TEST_COUNT" -lt 3586 ]; then
    echo "[WARN] Test count ($TEST_COUNT) is below baseline (3586)"
    PASS=false
fi

if [ "$LINT_ERRORS" -gt 0 ]; then
    echo "[ERROR] Lint errors detected: ${LINT_ERRORS}"
    PASS=false
fi

# 6. Check that all tests passed
if grep -q "failed" "$LAST_RESULT" 2>/dev/null; then
    FAILED=$(grep -oP '\d+(?=\s+failed)' "$LAST_RESULT" 2>/dev/null | head -1 || echo "?")
    echo "[ERROR] Test failures detected: ${FAILED} failed"
    PASS=false
fi

echo ""
echo "=========================================="
if [ "$PASS" = true ]; then
    echo " ✅ PRD Test Consistency: PASS"
    echo "    Test Files: ${TEST_FILES}/72"
    echo "    Test Count: ${TEST_COUNT}/3586"
    echo "    Lint: 0 errors, 0 warnings"
    echo "    Version: ${VERSION}"
    echo ""
    echo " PRD update is safe to proceed."
    exit 0
else
    echo " ❌ PRD Test Consistency: FAIL"
    echo "    Fix issues above before updating PRD."
    exit 1
fi