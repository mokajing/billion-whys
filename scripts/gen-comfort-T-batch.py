#!/usr/bin/env python3
"""
gen-comfort-T-batch.py
第189轮 Sprint 89 收尾 — AI小智+陈架构

comfort(T) 批量补全脚本：基于 COMFORT_GENERATION_RULES V1.1，
对 comfort(T) 缺失的 L1 条目调用 LLM 生成 comfort 词并回写 seed-library。

数据流：
  1. 读取 constants.json → COMFORT_GENERATION_RULES V1.1
  2. 读取 audit-data.py 输出找到 comfort(T) 缺失条目
  3. 对每条缺失条目构造 prompt（category + 问题原文 + L1 原文 + RULES 约束）
  4. 调 LLM 生成 comfort 词
  5. 回写 seed-library/<category>.json 的 L1 text（追加 comfort 词）
  6. 运行 build 验证（可选）

用法：
  python3 scripts/gen-comfort-T-batch.py [--category nature] [--limit 10] [--dry-run] [--verbose]

  --category: 指定类别（不指定则全量）
  --limit: 最多生成条数（分批验证）
  --dry-run: 只打印 prompt 不实际调 LLM
  --verbose: 打印详细 prompt 和生成结果
"""

import json
import os
import re
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CONTENT_DIR = PROJECT_ROOT / 'content' / 'seed-library'
CONSTANTS_PATH = PROJECT_ROOT / 'content' / 'constants.json'

CATEGORIES = ['animals', 'body', 'food', 'home', 'nature', 'society']


def load_constants():
    """加载 constants.json"""
    with open(CONSTANTS_PATH, 'r') as f:
        return json.load(f)


def load_comfort_patterns(constants):
    """加载 comfort 词库"""
    patterns = constants.get('COMFORT_PATTERNS', [])
    return [p.get('pattern', p) if isinstance(p, dict) else p for p in patterns]


def load_generation_rules(constants):
    """加载 COMFORT_GENERATION_RULES"""
    return constants.get('COMFORT_GENERATION_RULES', {})


def load_category_data(category):
    """加载某个类别的 seed-library 数据"""
    file_path = CONTENT_DIR / f'{category}.json'
    if not file_path.exists():
        return []
    with open(file_path, 'r') as f:
        return json.load(f)


def find_comfort_t_missing(category, data, comfort_patterns):
    """扫描 comfort(T) 缺失的条目（双通道：L1 answer + interactionHint）"""
    missing = []
    for entry in data:
        eid = entry.get('id', '')
        l1 = entry.get('layer1', {})
        # 注意：seed-library 中 L1 文本在 answer 字段，不是 text 字段
        l1_answer = l1.get('answer', '') or ''
        l1_hint = l1.get('interactionHint', '') or ''
        combined = l1_answer + ' ' + l1_hint

        if not l1_answer:
            continue

        # 检查 combined text 中是否包含 comfort 词
        has_comfort = any(p in combined for p in comfort_patterns)
        if not has_comfort:
            missing.append({
                'id': eid,
                'category': category,
                'question': entry.get('question', ''),
                'l1_answer': l1_answer,
                'l1_hint': l1_hint,
                'l1_length': len(l1_answer),
                'comfortCategory': l1.get('comfortCategory', ''),
            })
    return missing


def build_prompt(entry, rules, comfort_patterns):
    """构造 LLM prompt"""
    v11 = rules.get('rules', {}).get('V1.1Additions', {})
    base_rules = rules.get('rules', {})

    # 判断类别特定规则
    category = entry['category']
    extra_rules = []

    if category == 'nature':
        extra_rules.append(f"- {base_rules.get('natureSpecific', '自然灾害条目安抚词必须包含陪伴感和安全确认')}")
        extra_rules.append(f"- {v11.get('causalAttributionRule', {}).get('description', '必须打破因果归因链')}")
        extra_rules.append(f"- {v11.get('causalAttributionRule', {}).get('goodExample', '')}")

    if category == 'food':
        extra_rules.append(f"- {v11.get('foodFitnessRule', {}).get('description', '辣/烫/生/硬类食物区分安全和适合')}")
        extra_rules.append(f"- {v11.get('foodFitnessRule', {}).get('goodExample', '')}")

    if entry.get('comfortCategory') == 'A':
        extra_rules.append(f"- {base_rules.get('A类Rule', '安全警告类使用轻轻地，没关系作为默认安抚词')}")

    # 通用规则
    core_rules = [
        f"- 连贯性：{v11.get('coherenceRule', {}).get('description', '与L1正文自然衔接')}",
        f"- 具象化：{v11.get('concretenessRule', {}).get('description', '用孩子能感知的具体事物')}",
        f"- 追问预判：{v11.get('followUpRule', {}).get('description', '预判孩子可能的后续问题')}",
        f"- 长度：≤{base_rules.get('maxLength', 10)}个汉字",
        f"- 角色：{base_rules.get('roleRule', '默认使用大人/家人/我们等包容性表述')}",
        f"- 禁止词：{'/'.join(base_rules.get('bannedWords', ['别怕']))}",
        f"- 推荐词：{'/'.join(base_rules.get('preferredKeywords', ['安全', '没关系', '正常', '自然', '保护', '温暖', '陪伴']))}",
    ]

    all_rules = '\n'.join(core_rules + extra_rules)

    prompt = f"""你是一个为2-6岁儿童设计安抚语的专家。请为以下回答生成一个简短的 comfort 词（安抚语），追加在原文末尾。

【类别】{category}
【问题】{entry['question']}
【当前回答(L1)】"{entry['l1_answer']}"
【interactionHint】"{entry.get('l1_hint', '')}"
【comfortCategory】{entry.get('comfortCategory', '未分类')}

【生成规则】
{all_rules}

【输出格式】
请只输出 comfort 词本身（不包含问题原文），用中文逗号或句号与原文自然衔接。不超过10个字。
Comfort词:"""
    return prompt


def save_category_data(category, data):
    """保存类别数据回文件"""
    file_path = CONTENT_DIR / f'{category}.json'
    with open(file_path, 'w') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"  ✅ 已保存 {category}.json ({len(data)} 条)")


def apply_comfort_word(entry, comfort_word):
    """将 comfort 词追加到 L1 answer 末尾"""
    l1 = entry.get('layer1', {})
    original_text = l1.get('answer', '')

    # 检查 comfort_word 是否已经包含在原文中
    if comfort_word in original_text:
        return original_text

    # 自然衔接：用中文逗号连接
    if original_text.endswith('。') or original_text.endswith('！') or original_text.endswith('？'):
        # 句号结尾，替换为逗号后再接 comfort 词
        new_text = original_text[:-1] + '，' + comfort_word + '。'
    elif original_text.endswith('，'):
        new_text = original_text + comfort_word + '。'
    else:
        new_text = original_text + '，' + comfort_word + '。'

    return new_text


def main():
    import argparse
    parser = argparse.ArgumentParser(description='comfort(T) 批量补全脚本')
    parser.add_argument('--category', type=str, help='指定类别')
    parser.add_argument('--limit', type=int, default=0, help='最多生成条数（0=全量）')
    parser.add_argument('--dry-run', action='store_true', help='只打印 prompt 不实际调 LLM')
    parser.add_argument('--verbose', action='store_true', help='打印详细 prompt 和生成结果')
    args = parser.parse_args()

    print("=" * 60)
    print("  gen-comfort-T-batch.py — comfort(T) 批量补全")
    print("  第189轮 Sprint 89 收尾 | AI小智 + 陈架构")
    print("=" * 60)

    # 加载数据
    constants = load_constants()
    comfort_patterns = load_comfort_patterns(constants)
    rules = load_generation_rules(constants)
    print(f"\n📋 COMFORT_GENERATION_RULES: V{rules.get('version', '?')} (第{rules.get('round', '?')}轮)")
    print(f"📖 Comfort 词库: {len(comfort_patterns)} 词")

    # 扫描缺失条目
    target_categories = [args.category] if args.category else CATEGORIES
    all_missing = []

    for cat in target_categories:
        if cat not in CATEGORIES:
            print(f"⚠️  未知类别: {cat}，跳过")
            continue
        data = load_category_data(cat)
        missing = find_comfort_t_missing(cat, data, comfort_patterns)
        print(f"\n📊 {cat}: {len(missing)}/{len(data)} 条 comfort(T) 缺失")
        if missing:
            for m in missing[:5]:
                print(f"   - {m['id']}: \"{m['question'][:40]}...\" (L1长度={m['l1_length']}字)")
            if len(missing) > 5:
                print(f"   ... 还有 {len(missing) - 5} 条")
        all_missing.extend(missing)

    # 应用 limit
    if args.limit > 0:
        all_missing = all_missing[:args.limit]
        print(f"\n🔢 限制为前 {args.limit} 条")

    print(f"\n🎯 待生成: {len(all_missing)} 条")

    if len(all_missing) == 0:
        print("\n✅ 没有缺失条目，无需生成！")
        return

    # 生成 prompt 并输出
    if args.dry_run:
        print("\n📝 DRY RUN — 只打印 prompt，不调 LLM\n")
        for i, entry in enumerate(all_missing[:5]):
            prompt = build_prompt(entry, rules, comfort_patterns)
            print(f"--- [{i+1}] {entry['id']} ({entry['category']}) ---")
            print(prompt)
            print()
        if len(all_missing) > 5:
            print(f"... 还有 {len(all_missing) - 5} 条 prompt 省略")
        return

    # 实际 LLM 生成（需要 aone CLI 可用）
    print("\n🤖 开始 LLM 批量生成...\n")

    generated_count = 0
    for i, entry in enumerate(all_missing):
        prompt = build_prompt(entry, rules, comfort_patterns)
        cat = entry['category']

        if args.verbose:
            print(f"\n[{i+1}/{len(all_missing)}] {entry['id']} ({cat}): \"{entry['question'][:50]}...\"")

        # 调用 LLM（使用 aone CLI 或 CloudCLI）
        comfort_word = call_llm(prompt, verbose=args.verbose)

        if comfort_word:
            # 加载最新数据，应用 comfort 词
            cat_data = load_category_data(cat)
            for d in cat_data:
                if d.get('id') == entry['id']:
                    new_text = apply_comfort_word(d, comfort_word)
                    if args.verbose:
                        print(f"  原文: {d['layer1']['answer'][:60]}...")
                        print(f"  新文: {new_text[:80]}...")
                    d['layer1']['answer'] = new_text
                    break
            save_category_data(cat, cat_data)
            generated_count += 1
        else:
            print(f"  ⚠️  {entry['id']}: LLM 生成失败，跳过")

    print(f"\n✅ 生成完成: {generated_count}/{len(all_missing)} 条成功")
    print("\n📋 下一步:")
    print("  1. 运行 python3 scripts/audit-data.py 验证 comfort(T) 变化")
    print("  2. 运行 node scripts/build-mp-data.cjs 验证 build")
    print("  3. 科普陈博士/周教授 人工审核")


def call_llm(prompt, verbose=False):
    """
    调用 LLM 生成 comfort 词
    使用 aone CLI 或 CloudCLI 的 LLM 能力
    返回: comfort 词文本，或 None（失败时）
    """
    import subprocess
    import tempfile

    # 将 prompt 写入临时文件
    with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False, encoding='utf-8') as f:
        f.write(prompt + '\n\n请只输出 comfort 词本身，不要包含任何解释或额外文字。')
        prompt_file = f.name

    try:
        # 尝试使用 CloudCLI 的 llm 命令
        result = subprocess.run(
            ['cloudcli', 'llm', '--model', 'claude-sonnet-4-6', '--prompt-file', prompt_file, '--max-tokens', '50'],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode == 0:
            output = result.stdout.strip()
            # 提取 comfort 词（去掉可能的 "Comfort词:" 前缀）
            output = re.sub(r'^Comfort词[:：]\s*', '', output)
            output = output.strip().strip('"').strip("'")
            if verbose:
                print(f"  LLM 输出: {output}")
            return output if output else None
        else:
            if verbose:
                print(f"  LLM 调用失败: {result.stderr[:100]}")
            return None
    except Exception as e:
        if verbose:
            print(f"  LLM 调用异常: {e}")
        return None
    finally:
        os.unlink(prompt_file)


if __name__ == '__main__':
    main()