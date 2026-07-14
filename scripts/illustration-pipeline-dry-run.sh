#!/bin/bash
# V8.81 Sprint 76 第145轮：插画管线 dry-run 脚本
# 负责：CTO + COO
# 功能：用 demo 内容独立验证插画生成 -> 审核 -> 组件 -> 渲染全流程
# 不依赖 seed-library 内容就绪，用 content/demos/demo-body-001.html 作为测试数据
# 用法：./scripts/illustration-pipeline-dry-run.sh [--full]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DEMO_HTML="$PROJECT_DIR/content/demos/demo-body-001.html"
AUDIT_DIR="$SCRIPT_DIR/illustration-audit"
DRY_RUN_OUTPUT="$PROJECT_DIR/.dry-run-output"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$DRY_RUN_OUTPUT/dry-run-${TIMESTAMP}.log"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
  echo -e "${GREEN}[DRY-RUN]${NC} $(date '+%H:%M:%S') $*" | tee -a "$LOG_FILE"
}

warn() {
  echo -e "${YELLOW}[WARN]${NC} $(date '+%H:%M:%S') $*" | tee -a "$LOG_FILE"
}

error() {
  echo -e "${RED}[ERROR]${NC} $(date '+%H:%M:%S') $*" | tee -a "$LOG_FILE"
}

# 初始化
init() {
  mkdir -p "$DRY_RUN_OUTPUT"
  echo "=== 插画管线 dry-run 开始 ===" | tee "$LOG_FILE"
  echo "时间: $(date)" >> "$LOG_FILE"
  echo "工作目录: $PROJECT_DIR" >> "$LOG_FILE"
  echo "" >> "$LOG_FILE"
  log "初始化 dry-run 环境..."
}

# 阶段 1：检查 demo 内容
check_demo_content() {
  log "阶段 1/5：检查 demo 内容..."
  if [ -f "$DEMO_HTML" ]; then
    log "  demo 内容就绪: $DEMO_HTML"
    return 0
  else
    warn "  demo 内容不存在: $DEMO_HTML"
    warn "  跳过 demo 内容检查（管线代码验证仍可继续）"
    return 0
  fi
}

# 阶段 2：验证审核脚本
check_audit_scripts() {
  log "阶段 2/5：验证审核脚本..."
  local all_ok=true

  # 检查 color-check.js
  if [ -f "$AUDIT_DIR/color-check.js" ]; then
    log "  color-check.js 存在"
    # 尝试运行
    if node -e "require('$AUDIT_DIR/color-check.js')" 2>/dev/null; then
      log "  color-check.js 加载成功"
    else
      warn "  color-check.js 加载失败"
      all_ok=false
    fi
  else
    warn "  color-check.js 不存在"
    all_ok=false
  fi

  # 检查 checkSaturation 函数（通过 vitest 验证，避免 CJS/ESM 兼容问题）
  # V8.82 第146轮：改用变量捕获输出再 grep，避免 pipefail 下 vitest stderr 干扰
  local vitest_out
  vitest_out=$(npx vitest run --reporter=verbose src/h5/stores/__tests__/illustration-audit-color-check.test.js 2>&1) || true
  if echo "$vitest_out" | grep -Eq "Tests\s+11\s+passed"; then
    log "  checkSaturation 功能正常（11/11 测试通过）"
  else
    warn "  checkSaturation 功能异常（审核测试未通过）"
    all_ok=false
  fi

  if [ "$all_ok" = true ]; then
    log "  审核脚本验证通过"
  else
    warn "  审核脚本验证存在警告"
  fi
}

# 阶段 3：验证组件代码
check_components() {
  log "阶段 3/5：验证组件代码..."
  local all_ok=true

  # H5 端 IllustrationImage.vue
  if [ -f "$PROJECT_DIR/src/h5/components/IllustrationImage.vue" ]; then
    log "  H5 IllustrationImage.vue 存在"
    if grep -q "textOnly" "$PROJECT_DIR/src/h5/components/IllustrationImage.vue"; then
      log "  H5 textOnly 属性已定义"
    else
      warn "  H5 textOnly 属性未定义"
      all_ok=false
    fi
  else
    warn "  H5 IllustrationImage.vue 不存在"
    all_ok=false
  fi

  # MP 端 illustration-image 组件
  if [ -f "$PROJECT_DIR/src/miniprogram/components/illustration-image/illustration-image.js" ]; then
    log "  MP illustration-image 组件存在"
    if grep -q "textOnly" "$PROJECT_DIR/src/miniprogram/components/illustration-image/illustration-image.js"; then
      log "  MP textOnly 属性已定义"
    else
      warn "  MP textOnly 属性未定义"
      all_ok=false
    fi
  else
    warn "  MP illustration-image 组件不存在"
    all_ok=false
  fi

  # H5 illustration store
  if [ -f "$PROJECT_DIR/src/h5/stores/illustration.js" ]; then
    log "  H5 illustration store 存在"
  else
    warn "  H5 illustration store 不存在"
    all_ok=false
  fi

  if [ "$all_ok" = true ]; then
    log "  组件代码验证通过"
  else
    warn "  组件代码验证存在警告"
  fi
}

# 阶段 4：验证开关 UI
check_toggle_ui() {
  log "阶段 4/5：验证开关 UI..."
  local all_ok=true

  # H5 Profile.vue 开关
  if grep -q "illustration-toggle" "$PROJECT_DIR/src/h5/pages/Profile.vue" 2>/dev/null; then
    log "  H5 Profile.vue 开关 UI 已实现"
  else
    warn "  H5 Profile.vue 开关 UI 未实现"
    all_ok=false
  fi

  # MP profile.wxml 开关
  if grep -q "onToggleIllustration" "$PROJECT_DIR/src/miniprogram/pages/profile/profile.wxml" 2>/dev/null; then
    log "  MP profile.wxml 开关 UI 已实现"
  else
    warn "  MP profile.wxml 开关 UI 未实现"
    all_ok=false
  fi

  # 存储键名统一检查
  local h5_key=$(grep "bw_illustration_disabled" "$PROJECT_DIR/src/h5/stores/illustration.js" 2>/dev/null | wc -l)
  local mp_key=$(grep "bw_illustration_disabled" "$PROJECT_DIR/src/miniprogram/pages/profile/profile.js" 2>/dev/null | wc -l)
  if [ "$h5_key" -gt 0 ] && [ "$mp_key" -gt 0 ]; then
    log "  存储键名统一为 bw_illustration_disabled（H5:${h5_key}处, MP:${mp_key}处）"
  else
    warn "  存储键名不统一（H5:${h5_key}处, MP:${mp_key}处）"
    all_ok=false
  fi

  if [ "$all_ok" = true ]; then
    log "  开关 UI 验证通过"
  else
    warn "  开关 UI 验证存在警告"
  fi

  # V8.83 第147轮：检查 H5+MP i18n illustration.* key 对齐
  local h5_ill_keys=$(grep -c "'illustration\." "$PROJECT_DIR/src/h5/utils/i18n.js" 2>/dev/null || echo 0)
  local mp_ill_keys=$(grep -c "'illustration\." "$PROJECT_DIR/src/miniprogram/utils/i18n.js" 2>/dev/null || echo 0)
  if [ "$h5_ill_keys" -ge 12 ] && [ "$mp_ill_keys" -ge 12 ]; then
    log "  i18n illustration.* key 已对齐（H5:${h5_ill_keys} key, MP:${mp_ill_keys} key）"
  else
    warn "  i18n illustration.* key 未对齐（H5:${h5_ill_keys} key, MP:${mp_ill_keys} key，期望 >= 12）"
    all_ok=false
  fi
}

# 阶段 5：运行测试
run_tests() {
  log "阶段 5/5：运行相关测试..."
  cd "$PROJECT_DIR"

  # 运行插画相关测试（如果有的话）
  if npx vitest run --reporter=verbose 2>&1 | grep -E "(PASS|FAIL|Tests)" | tail -5 | tee -a "$LOG_FILE"; then
    log "  测试运行完成"
  else
    warn "  测试运行完成（可能有失败）"
  fi
}

# 生成报告
generate_report() {
  log ""
  log "========== dry-run 报告 =========="
  log "时间: $(date)"
  log "日志文件: $LOG_FILE"
  log ""

  # 统计各阶段状态
  local warnings=$(grep -c "\[WARN\]" "$LOG_FILE" 2>/dev/null || echo 0)
  local errors=$(grep -c "\[ERROR\]" "$LOG_FILE" 2>/dev/null || echo 0)
  # 确保是数字
  warnings=${warnings//[^0-9]/}
  errors=${errors//[^0-9]/}
  warnings=${warnings:-0}
  errors=${errors:-0}

  if [ "$errors" -gt 0 ]; then
    error "dry-run 发现 ${errors} 个错误"
    error "请查看日志: $LOG_FILE"
  elif [ "$warnings" -gt 0 ]; then
    warn "dry-run 发现 ${warnings} 个警告"
    warn "插画管线可进入下一步，但需关注警告项"
  else
    log "dry-run 全部通过！插画管线就绪"
  fi

  echo ""
  echo "输出目录: $DRY_RUN_OUTPUT"
  echo "日志文件: $LOG_FILE"
}

# 主流程
main() {
  local mode="${1:-quick}"
  log "插画管线 dry-run 启动（模式: $mode）"

  init
  check_demo_content
  check_audit_scripts
  check_components
  check_toggle_ui

  if [ "$mode" = "--full" ]; then
    run_tests
  else
    log "跳过测试阶段（使用 --full 模式运行完整测试）"
  fi

  generate_report
}

main "$@"