#!/bin/bash
# emotion-safety-patrol.sh — V8.68 Sprint 71 第132轮
# 安全李姐+王园长+文若水：baseline 情绪安全人工巡检
# 扫描 seed-library 下所有 274 题，标记含情绪安全风险关键词的题目
# V8.68 升级：关键词扩展至 20 个 + 语境分析（边界案例深度审查）
#
# 情绪安全关键词（20 个）：
#   黑名单（blocklist）：死、血、鬼、怪物、消失、黑暗、孤独
#                        打雷、闪电、地震、着火、打针、医生、
#                        黑夜、噩梦、分离、独自、摔倒、受伤、医院、打人、生气
#   人工审核（review）：疼
#
# 语境分析（V8.68 新增）：
#   - 命中"闪电"+"伤害"→ 深度审查标记
#   - 命中"受伤"+"可怕"→ 深度审查标记
#   - 命中"打雷"+"劈"→ 深度审查标记
#   - Refer to: nature_041 (打雷), body_023 (流血) 边界案例
#
# 输出：docs/emotion-safety-patrol-{date}.md 巡检报告

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SEED_DIR="$ROOT/content/seed-library"
STAGING_DIR="$ROOT/content/seed-library-staging"
REPORT_DIR="$ROOT/docs"
DATE=$(date +%Y-%m-%d)
REPORT="$REPORT_DIR/emotion-safety-patrol-${DATE}.md"

BLOCKLIST=("死" "血" "鬼" "怪物" "消失" "黑暗" "孤独" "打雷" "闪电" "地震" "着火" "打针" "医生" "黑夜" "噩梦" "分离" "独自" "摔倒" "受伤" "医院" "打人" "生气")
REVIEW_LIST=("疼")

# V8.68 语境分析：边界案例深度审查
# 这些词在特定语境下可能引起恐惧，但不直接命中黑名单关键词
CONTEXT_FLAGS=("闪电.*劈" "打雷.*害怕" "受伤.*可怕" "流血" "伤口.*可怕" "劈中")

# V8.68 语境分析：边界案例深度审查
# 这些词在特定语境下可能引起恐惧，但不直接命中黑名单关键词
CONTEXT_FLAGS=("闪电.*劈" "打雷.*害怕" "受伤.*可怕" "流血" "伤口.*可怕" "劈中")

echo "=== 十亿个为什么 — 情绪安全巡检报告 ==="
echo "日期: $DATE"
echo "扫描范围: $SEED_DIR + $STAGING_DIR"
echo ""

# 生成报告
cat > "$REPORT" << 'HEADER'
# 情绪安全巡检报告

**日期**: DATE_PLACEHOLDER
**巡检人**: 安全李姐 + 王园长 + 文若水
**轮次**: 第132轮（关键词扩展至 20 个 + 语境分析）
**状态**: 待人工审核

---

## 一、扫描摘要

HEADER

sed -i "s/DATE_PLACEHOLDER/$DATE/" "$REPORT"

# 统计
total=0
blocked=0
review=0
deep_review=0
blocked_items=""
review_items=""
deep_review_items=""

for f in "$SEED_DIR"/*.json; do
  [ -f "$f" ] || continue
  cat_name=$(basename "$f" .json)

  # 提取所有问题
  questions=$(python3 -c "
import json, sys
with open('$f') as fh:
    data = json.load(fh)
for q in data:
    print(f'{q.get(\"id\",\"?\")}|{q.get(\"question\",\"\")}|{q.get(\"category\",\"\")}|{q.get(\"age\",\"\")}')
" 2>/dev/null)

  while IFS='|' read -r qid question category age; do
    [ -z "$qid" ] && continue
    total=$((total + 1))

    # 检查黑名单
    for kw in "${BLOCKLIST[@]}"; do
      if [[ "$question" == *"$kw"* ]]; then
        blocked=$((blocked + 1))
        blocked_items+="| $qid | $question | $category | $age | $kw | 🚫 黑名单 |\n"
        break
      fi
    done

    # 检查人工审核
    for kw in "${REVIEW_LIST[@]}"; do
      if [[ "$question" == *"$kw"* ]]; then
        review=$((review + 1))
        review_items+="| $qid | $question | $category | $age | $kw | ⚠️ 需人工审核 |\n"
        break
      fi
    done

    # V8.68 语境分析：检查边界案例（扫描所有 Layer 回答文本）
    all_text=$(python3 -c "
import json
with open('$f') as fh:
    data = json.load(fh)
for q in data:
    if q.get('id') == '$qid':
        layers = q.get('layers', {})
        text = q.get('question', '')
        for key in ['layer1', 'layer2', 'layer3']:
            if key in layers:
                text += ' ' + layers[key].get('answer', '')
        print(text)
        break
" 2>/dev/null)
    for ctx_pattern in "${CONTEXT_FLAGS[@]}"; do
      if [[ "$all_text" =~ $ctx_pattern ]]; then
        deep_review=$((deep_review + 1))
        deep_review_items+="| $qid | $question | $category | $age | $ctx_pattern | 🔍 深度审查（语境分析） |\n"
        break
      fi
    done
  done <<< "$questions"
done

# 检查 staging
for f in "$STAGING_DIR"/*.json; do
  [ -f "$f" ] || continue
  cat_name=$(basename "$f" .json)

  questions=$(python3 -c "
import json, sys
with open('$f') as fh:
    data = json.load(fh)
items = data if isinstance(data, list) else data.get('questions', {}).values() if isinstance(data.get('questions'), dict) else data.get('questions', [])
for q in items:
    if isinstance(q, dict):
        print(f'{q.get(\"id\",\"?\")}|{q.get(\"question\",\"\")}|{q.get(\"category\",\"\")}|{q.get(\"age\",\"\")}')
" 2>/dev/null)

  while IFS='|' read -r qid question category age; do
    [ -z "$qid" ] && continue
    for kw in "${BLOCKLIST[@]}"; do
      if [[ "$question" == *"$kw"* ]]; then
        blocked=$((blocked + 1))
        blocked_items+="| $qid | $question | $category | $age | $kw | 🚫 黑名单 [STAGING] |\n"
        break
      fi
    done
    for kw in "${REVIEW_LIST[@]}"; do
      if [[ "$question" == *"$kw"* ]]; then
        review=$((review + 1))
        review_items+="| $qid | $question | $category | $age | $kw | ⚠️ 需人工审核 [STAGING] |\n"
        break
      fi
    done
  done <<< "$questions"
done

# 写入报告
cat >> "$REPORT" << EOF

- **扫描题目总数**: $total
- **黑名单命中**: $blocked 题
- **人工审核标记**: $review 题
- **深度审查（语境分析）**: $deep_review 题
- **关键词覆盖**: 20 个黑名单关键词 + 6 个语境分析模式

## 二、黑名单命中（🚫 需立即排除）

| ID | 问题 | 圈层 | 年龄 | 命中关键词 | 状态 |
|----|------|------|------|-----------|------|
EOF

echo -e "$blocked_items" >> "$REPORT"

cat >> "$REPORT" << 'EOF'

## 三、人工审核标记（⚠️ 需逐条审核）

| ID | 问题 | 圈层 | 年龄 | 命中关键词 | 状态 |
|----|------|------|------|-----------|------|
EOF

echo -e "$review_items" >> "$REPORT"

cat >> "$REPORT" << 'EOF'

## 四、深度审查（🔍 语境分析，V8.68 新增）

以下题目未直接命中黑名单关键词，但回答文本中包含可能引起恐惧的语境组合，需安全李姐+王园长+周教授联合评审。

| ID | 问题 | 圈层 | 年龄 | 命中语境模式 | 状态 |
|----|------|------|------|------------|------|
EOF

echo -e "$deep_review_items" >> "$REPORT"

cat >> "$REPORT" << 'EOF'

## 五、审核结论

- [ ] 黑名单题目已确认排除
- [ ] 人工审核题目已逐条评审
- [ ] 深度审查题目已逐题语境分析（安全李姐+王园长+周教授联合评审）
- [ ] 安全李姐签收
- [ ] 王园长签收
- [ ] 文若水签收

---

*巡检脚本: scripts/emotion-safety-patrol.sh*
*下次巡检: 每周一次（周一 01:00）*
EOF

echo ""
echo "=== 巡检完成 ==="
echo "报告: $REPORT"
echo "黑名单: $blocked 题 | 人工审核: $review 题 | 深度审查: $deep_review 题"
echo ""

# 输出摘要
cat "$REPORT"