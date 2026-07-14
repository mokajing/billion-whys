#!/usr/bin/env python3
"""
home comfort 词注入脚本（第185轮 Sprint 88）
R185-005: home 30条 L1 comfort 词注入（LLM 精炼，确保每条至少1安抚词）

原理：
1. 读取 home.json
2. 扫描 L1 answer，检测是否包含 COMFORT_PATTERNS 中的安抚词
3. 对缺失安抚词的条目，通过 LLM 精炼 L1 answer 注入安抚词
4. 保持 L1 字数 ≤50 字
5. 写入 home.json

用法：
  python3 scripts/gen-home-comfort-inject.py              # 生成全部缺失条目
  python3 scripts/gen-home-comfort-inject.py --dry-run    # 仅输出缺失条目列表
  python3 scripts/gen-home-comfort-inject.py --execute    # 执行 LLM 注入
  python3 scripts/gen-home-comfort-inject.py --check      # 仅检查，不生成

质量要求：
- 注入后 L1 字数 ≤50 字
- 安抚词自然融入，不生硬
- 保持原回答的科学准确性和适龄性
- C类（知识事实）使用"这很正常哦"系列
- B类（感官探索）使用"暖暖的，真奇妙"系列
- A类（安全警告）使用"轻轻地，没关系"系列
"""

import json
import os
import sys
import argparse
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
CONTENT_DIR = BASE_DIR / "content" / "seed-library"
CONSTANTS_PATH = BASE_DIR / "content" / "constants.json"

# 第185轮：comfort 词注入 prompt 模板
COMFORT_INJECT_PROMPT = """你是2-6岁儿童教育专家。在孩子的回答中自然融入安抚词，让孩子感到温暖和安全。

## 当前回答
{current_answer}

## 约束条件
- 目标年龄: 3岁
- 安抚类别: {comfort_category}（{category_desc}）
- 推荐安抚词: {recommended_comfort}
- 回答字数上限: 50字（当前{current_length}字）
- 请保持原回答的科学准确性和核心意思不变

## 要求
- 在回答中自然融入安抚词（不要生硬地加在开头或结尾）
- 保持回答的口语化和温暖感
- 字数不超过50字

## 输出格式（JSON）
```json
{{
  "answer": "修改后的回答",
  "comfort_word_used": "使用的安抚词",
  "word_count": 字数
}}
```

请只输出 JSON，不要加其他文字。"""

# 第185轮：安抚词推荐规则（与 PRD 对齐）
COMFORT_RECOMMENDATIONS = {
    "A": {"word": "轻轻地，没关系", "desc": "安全警告类——需要安抚和保护"},
    "B": {"word": "暖暖的，真奇妙", "desc": "感官探索类——好奇和温柔引导"},
    "C": {"word": "这很正常哦", "desc": "知识事实类——好奇和智慧解答"},
}


def load_constants():
    """加载常量配置"""
    try:
        with open(CONSTANTS_PATH, encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def load_home():
    """加载 home 数据"""
    filepath = CONTENT_DIR / "home.json"
    with open(filepath, encoding='utf-8') as f:
        return json.load(f)


def save_home(data):
    """保存 home 数据（带备份）"""
    filepath = CONTENT_DIR / "home.json"
    backup_path = filepath.with_suffix(".json.bak")
    if filepath.exists():
        import shutil
        shutil.copy2(filepath, backup_path)
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"  ✅ Saved {len(data)} entries to {filepath}")


def check_comfort_words(answer, comfort_patterns):
    """检查 answer 是否包含安抚词"""
    for word in comfort_patterns:
        if word in answer:
            return True, word
    return False, None


def find_missing_entries(entries, comfort_patterns):
    """找出 L1 缺少安抚词的条目"""
    missing = []
    has_comfort = []
    for e in entries:
        l1 = e.get('layer1', {})
        answer = l1.get('answer', '')
        has, word = check_comfort_words(answer, comfort_patterns)
        if has:
            has_comfort.append((e['id'], word))
        else:
            missing.append(e)
    return missing, has_comfort


def build_inject_prompt(entry):
    """为单条条目构建 comfort 注入 prompt"""
    l1 = entry.get('layer1', {})
    answer = l1.get('answer', '')
    cc = entry.get('comfortCategory', 'C')
    rec = COMFORT_RECOMMENDATIONS.get(cc, COMFORT_RECOMMENDATIONS['C'])

    return COMFORT_INJECT_PROMPT.format(
        current_answer=answer,
        comfort_category=cc,
        category_desc=rec['desc'],
        recommended_comfort=rec['word'],
        current_length=len(answer)
    )


def main():
    parser = argparse.ArgumentParser(description='Inject comfort words into home L1 answers')
    parser.add_argument('--dry-run', action='store_true', help='Only output missing entries, no generation')
    parser.add_argument('--check', action='store_true', help='Only check and report')
    parser.add_argument('--execute', action='store_true', help='Actually execute LLM injection')
    args = parser.parse_args()

    constants = load_constants()
    comfort_patterns = constants.get('COMFORT_PATTERNS', [])
    if not comfort_patterns:
        print("❌ COMFORT_PATTERNS not found in constants.json")
        sys.exit(1)

    print(f"📚 Comfort patterns loaded: {len(comfort_patterns)} words")
    print(f"   First 10: {comfort_patterns[:10]}")

    entries = load_home()
    missing, has_comfort = find_missing_entries(entries, comfort_patterns)

    print(f"\n📊 Home: {len(entries)} entries")
    print(f"   ✅ Has comfort word: {len(has_comfort)}/{len(entries)}")
    print(f"   🔴 Missing comfort word: {len(missing)}/{len(entries)}")

    if missing:
        print(f"\n🔴 Missing entries:")
        for e in missing[:10]:
            l1 = e.get('layer1', {})
            answer = l1.get('answer', '')
            cc = e.get('comfortCategory', '?')
            print(f"   {e['id']} [{cc}]: {answer[:50]}...")
        if len(missing) > 10:
            print(f"   ... and {len(missing) - 10} more")

        # Show category breakdown
        cc_breakdown = {}
        for e in missing:
            cc = e.get('comfortCategory', '?')
            cc_breakdown[cc] = cc_breakdown.get(cc, 0) + 1
        print(f"\n   By comfortCategory: {cc_breakdown}")

    if args.check:
        return 0 if not missing else 1

    if args.dry_run:
        if missing:
            print(f"\n📝 Sample prompts for first 3 missing entries:")
            for entry in missing[:3]:
                print(f"\n--- {entry['id']} ---")
                print(build_inject_prompt(entry))
                print("---")
        return 0

    if args.execute:
        if not missing:
            print("\n✅ All entries already have comfort words. Nothing to do.")
            return 0

        print(f"\n🚀 Executing LLM comfort injection for {len(missing)} entries...")
        print(f"   ⚠️  LLM execution requires external API integration.")
        print(f"   This script provides the framework; actual LLM calls are handled by the orchestrator.")
        print(f"\n   After execution, run:")
        print(f"   python3 scripts/audit-data.py")
        print(f"   node scripts/build-mp-data.cjs")
    else:
        print(f"\n💡 To execute, add --execute flag:")
        print(f"   python3 scripts/gen-home-comfort-inject.py --execute")

    return 0


if __name__ == '__main__':
    sys.exit(main())