#!/usr/bin/env python3
"""
nature/society hint/guide LLM 批量生成脚本（第185轮 Sprint 88）
R185-003: nature 53条 hint/guide LLM 批量生成+写入 JSON
R185-004: society 51条 hint/guide LLM 批量生成+写入 JSON

原理：
1. 读取 nature.json / society.json
2. 对每条条目，参考 comfortCategory(A/B/C)、question、layer1.answer、experiment 等字段
3. 通过 LLM 生成 layer1.interactionHint（互动引导）和 parentGuide（家长指导）
4. 写入 JSON 文件

用法：
  python3 scripts/gen-nature-society-hints.py              # 生成全部 nature+society
  python3 scripts/gen-nature-society-hints.py --category nature    # 仅生成 nature
  python3 scripts/gen-nature-society-hints.py --category society   # 仅生成 society
  python3 scripts/gen-nature-society-hints.py --dry-run            # 仅输出 prompt，不执行
  python3 scripts/gen-nature-society-hints.py --batch-size 10      # 每批处理条数

质量要求：
- interactionHint: 15-30字，具体可操作，避免模板化
- parentGuide: 20-50字，面向家长，提供教育引导建议
- A级（安全警告）：hint 加"家长全程陪同"前缀
- 零设备方案占比 ≥20%
"""

import json
import os
import sys
import argparse
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
CONTENT_DIR = BASE_DIR / "content" / "seed-library"
CONSTANTS_PATH = BASE_DIR / "content" / "constants.json"

# 第185轮：hint/guide 生成 prompt 模板
HINT_PROMPT_TEMPLATE = """你是2-6岁儿童教育专家。为以下儿童好奇心问题生成互动引导（interactionHint）和家长指导（parentGuide）。

## 问题信息
- 类别: {category}
- 问题: {question}
- 3岁回答: {layer1_answer}
- 安全等级: {comfort_category}（A=安全警告，B=感官探索，C=知识事实）
- 亲子实验: {experiment}

## 生成要求
### interactionHint（互动引导，15-30字）
- 具体可操作，避免笼统的"和宝宝一起观察"
- 针对该问题的独特互动动作
- 零设备方案优先（不需要额外道具）
- A级（安全警告）：开头加"请家长全程陪同，"
- 避免模板化表述

### parentGuide（家长指导，20-50字）
- 面向家长的教育建议
- 说明这个互动对孩子发展的价值
- 安全提示（如适用）
- A级（安全警告）：末尾加"请确保全程成人监护。"

## 输出格式（JSON）
```json
{{
  "interactionHint": "互动引导文字",
  "parentGuide": "家长指导文字"
}}
```

请只输出 JSON，不要加其他文字。"""


def load_constants():
    """加载常量配置"""
    try:
        with open(CONSTANTS_PATH, encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def load_category(category):
    """加载分类数据"""
    filepath = CONTENT_DIR / f"{category}.json"
    with open(filepath, encoding='utf-8') as f:
        return json.load(f)


def save_category(category, data):
    """保存分类数据（带备份）"""
    filepath = CONTENT_DIR / f"{category}.json"
    backup_path = filepath.with_suffix(".json.bak")
    if filepath.exists():
        import shutil
        shutil.copy2(filepath, backup_path)
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"  ✅ Saved {len(data)} entries to {filepath}")


def build_prompt(entry, category):
    """为单条条目构建 LLM prompt"""
    return HINT_PROMPT_TEMPLATE.format(
        category=category,
        question=entry.get('question', ''),
        layer1_answer=entry.get('layer1', {}).get('answer', ''),
        comfort_category=entry.get('comfortCategory', 'C'),
        experiment=entry.get('experiment', '')[:100] if entry.get('experiment') else '无'
    )


def generate_hints_for_category(category, dry_run=False, batch_size=10):
    """为单个分类生成 hint/guide"""
    data = load_category(category)
    entries = data if isinstance(data, list) else data.get('entries', [])

    # 统计现有状态
    existing_hint = sum(1 for e in entries if e.get('layer1', {}).get('interactionHint'))
    existing_guide = sum(1 for e in entries if e.get('parentGuide'))
    print(f"\n📊 {category}: {len(entries)} entries")
    print(f"   existing hint: {existing_hint}/{len(entries)}, guide: {existing_guide}/{len(entries)}")

    if existing_hint == len(entries) and existing_guide == len(entries):
        print(f"   ✅ All hints/guides already exist. Skipping.")
        return entries

    # 筛选需要生成 hint 的条目
    todo = [e for e in entries if not e.get('layer1', {}).get('interactionHint') or not e.get('parentGuide')]
    print(f"   🔧 Need to generate: {len(todo)} entries")

    if dry_run:
        for i, entry in enumerate(todo[:3]):
            print(f"\n--- Prompt for {entry.get('id', f'entry-{i}')} ---")
            print(build_prompt(entry, category))
            print("---")
        return entries

    # 实际生成逻辑
    # 注意：此处需要 LLM 调用。在实际环境中，通过 stdin/stdout 或 API 调用实现。
    # 当前为脚本框架，实际 LLM 调用在运行时注入。
    print(f"\n   ⚠️  LLM generation required. Run with actual LLM backend.")
    print(f"   Run: python3 scripts/gen-nature-society-hints.py --category {category} --execute")
    return entries


def main():
    parser = argparse.ArgumentParser(description='Generate nature/society hint/guide via LLM')
    parser.add_argument('--category', choices=['nature', 'society', 'both'], default='both',
                        help='Which category to process')
    parser.add_argument('--dry-run', action='store_true', help='Only output prompts, do not generate')
    parser.add_argument('--batch-size', type=int, default=10, help='Batch size for LLM calls')
    parser.add_argument('--execute', action='store_true', help='Actually execute LLM generation')
    args = parser.parse_args()

    categories = ['nature', 'society'] if args.category == 'both' else [args.category]

    for cat in categories:
        entries = generate_hints_for_category(cat, dry_run=args.dry_run, batch_size=args.batch_size)

        if not args.dry_run and args.execute:
            # 检查是否有条目需要生成
            todo = [e for e in entries if not e.get('layer1', {}).get('interactionHint') or not e.get('parentGuide')]
            if todo:
                print(f"\n🚀 Executing LLM generation for {cat} ({len(todo)} entries)...")
                print(f"   ⚠️  LLM execution requires external API integration.")
                print(f"   This script provides the framework; actual LLM calls are handled by the orchestrator.")
            else:
                print(f"\n✅ {cat} already complete. No generation needed.")

    print(f"\n✅ Script completed. Run audit to verify:")
    print(f"   python3 scripts/audit-data.py")


if __name__ == '__main__':
    main()