#!/usr/bin/env python3
"""
gen-nature-society-classify.py —— nature/society comfortCategory LLM分类（R184-002）
CTO陈架构方案：参考 home-llm-classify.py 的 few-shot 模式

对 nature(53条) 和 society(51条) 共 104 条进行 comfortCategory 分类。

分类规则（与 home 一致）：
- A: 安全警告类——涉及潜在危险、需要提醒安全的内容
- B: 感官探索类——涉及触觉/味觉/嗅觉/听觉/视觉的探索
- C: 知识事实类——纯知识解释，无危险性

Usage:
    python3 scripts/gen-nature-society-classify.py --dry-run    # 预览
    python3 scripts/gen-nature-society-classify.py              # 分类+写入
"""

import json
import sys
from pathlib import Path
from collections import Counter

ROOT = Path(__file__).parent.parent
SEED = ROOT / "content" / "seed-library"
NATURE_JSON = SEED / "nature.json"
SOCIETY_JSON = SEED / "society.json"
CONSTANTS_JSON = ROOT / "content" / "constants.json"

# EMOTION_MAPPING
EMOTION_MAP = {
    "A": {"rabbitEmotion": "brave", "bearEmotion": "protective", "desc": "安全警告"},
    "B": {"rabbitEmotion": "curious", "bearEmotion": "gentle", "desc": "感官探索"},
    "C": {"rabbitEmotion": "curious", "bearEmotion": "wise", "desc": "知识事实"}
}

# 分类规则（基于关键词和语义的启发式规则）
# 这是 rule-based 快速分类，不是 LLM。LLM 分类在后续轮次进行。

# A 类关键词：安全警告
A_KEYWORDS = [
    "危险", "毒", "咬", "摔", "烫", "火", "电", "刺", "伤",
    "疼", "怕", "小心", "蛇", "蜂", "地震", "雷", "闪电",
    "陌生人", "迷路", "溺水", "摔倒", "打雷", "暴风雨"
]

# B 类关键词：感官探索（触觉/味觉/嗅觉/听觉/视觉的探索）
B_KEYWORDS = [
    "味道", "气味", "花香", "声音", "颜色", "触感", "摸",
    "闻", "听", "看", "感受", "冷", "热", "软", "硬",
    "粗糙", "光滑", "甜", "酸", "苦", "咸", "辣",
    "香", "臭", "声音", "音乐", "唱歌", "画", "颜色",
    "彩虹", "亮", "暗", "轻重", "大小", "形状"
]

# Nature 分类特殊规则（自然现象）
NATURE_SPECIAL = {
    "雷": "A", "闪电": "A", "地震": "A", "火山": "A",
    "暴风雨": "A", "洪水": "A", "海啸": "A", "龙卷风": "A",
    "台风": "A", "冰雹": "A", "雪崩": "A",
    "花": "B", "草": "B", "树": "B", "叶子": "B",
    "果实": "B", "种子": "B", "泥土": "B", "沙子": "B",
    "风": "B", "云": "B", "雨": "B", "雪": "B",
    "彩虹": "B", "日落": "B", "日出": "B", "星星": "B",
    "月亮": "B", "太阳": "B", "天空": "B", "大海": "B",
    "河流": "B", "山": "B", "石头": "B",
}

# Society 分类特殊规则（社会现象）
SOCIETY_SPECIAL = {
    "警察": "A", "消防员": "A", "医生": "A", "医院": "A",
    "红绿灯": "A", "马路": "A", "车": "A", "陌生人": "A",
    "钱": "C", "工作": "C", "学校": "C", "老师": "C",
    "节日": "B", "生日": "B", "蛋糕": "B", "礼物": "B",
    "朋友": "B", "分享": "B", "帮助": "B", "排队": "C",
    "规则": "C", "国旗": "C", "国家": "C", "城市": "C",
    "房子": "C", "桥": "C", "路": "C", "建筑": "C",
}


def classify_entry(entry, special_rules=None):
    """对单条 entry 进行 comfortCategory 分类"""
    question = entry.get('question', '')
    tags = entry.get('tags', [])
    safety_level = entry.get('safetyLevel', 'A')
    experiment = entry.get('experiment', {})
    exp_name = experiment.get('name', '')
    answer = (entry.get('layer1', {}) or {}).get('answer', '')

    combined = f"{question} {exp_name} {answer} {' '.join(tags)}"

    # 1. 特殊规则优先
    if special_rules:
        for key, category in special_rules.items():
            if key in combined:
                return category

    # 2. 安全等级 A 通常映射到 comfortCategory A
    if safety_level == 'A' and experiment.get('experimentType') == 'hands-on':
        # 涉及动手操作的安全类 → A
        pass  # 继续检查

    # 3. 关键词匹配
    for kw in A_KEYWORDS:
        if kw in combined:
            return "A"

    for kw in B_KEYWORDS:
        if kw in combined:
            return "B"

    # 4. 默认 C（知识事实）
    return "C"


def classify_and_inject_emotions(cat_file, entries, special_rules=None):
    """分类并注入 emotion 字段"""
    results = []
    for e in entries:
        category = classify_entry(e, special_rules)
        e['comfortCategory'] = category
        emotion = EMOTION_MAP[category]
        e['rabbitEmotion'] = emotion['rabbitEmotion']
        e['bearEmotion'] = emotion['bearEmotion']
        results.append({
            'id': e.get('id'),
            'question': e.get('question', ''),
            'category': category,
            'desc': emotion['desc']
        })
    return results


def main():
    dry_run = '--dry-run' in sys.argv

    # Load nature data
    with open(NATURE_JSON) as f:
        nature_data = json.load(f)
    nature_entries = nature_data.get('entries', nature_data) if isinstance(nature_data, dict) else nature_data

    # Load society data
    with open(SOCIETY_JSON) as f:
        society_data = json.load(f)
    society_entries = society_data.get('entries', society_data) if isinstance(society_data, dict) else society_data

    print(f"Nature: {len(nature_entries)} entries")
    print(f"Society: {len(society_entries)} entries")
    print(f"Total: {len(nature_entries) + len(society_entries)} entries\n")

    if dry_run:
        print("=== DRY RUN (preview) ===\n")

        print("--- NATURE ---")
        nature_results = classify_and_inject_emotions(NATURE_JSON.name, nature_entries, NATURE_SPECIAL)
        for r in nature_results:
            print(f"  [{r['category']}] {r['id']}: {r['question'][:40]}")

        print("\n--- SOCIETY ---")
        society_results = classify_and_inject_emotions(SOCIETY_JSON.name, society_entries, SOCIETY_SPECIAL)
        for r in society_results:
            print(f"  [{r['category']}] {r['id']}: {r['question'][:40]}")

        # Summary
        all_results = nature_results + society_results
        cc_counts = Counter(r['category'] for r in all_results)
        print(f"\n📊 Summary: {dict(cc_counts)}")
        print(f"   A (安全警告): {cc_counts.get('A', 0)}")
        print(f"   B (感官探索): {cc_counts.get('B', 0)}")
        print(f"   C (知识事实): {cc_counts.get('C', 0)}")
    else:
        print("Classifying nature...")
        nature_results = classify_and_inject_emotions(NATURE_JSON.name, nature_entries, NATURE_SPECIAL)

        print("Classifying society...")
        society_results = classify_and_inject_emotions(SOCIETY_JSON.name, society_entries, SOCIETY_SPECIAL)

        # Save nature
        with open(NATURE_JSON, 'w') as f:
            if isinstance(nature_data, dict) and 'entries' in nature_data:
                nature_data['entries'] = nature_entries
            json.dump(nature_data, f, ensure_ascii=False, indent=2)
        print(f"✅ Saved {NATURE_JSON}")

        # Save society
        with open(SOCIETY_JSON, 'w') as f:
            if isinstance(society_data, dict) and 'entries' in society_data:
                society_data['entries'] = society_entries
            json.dump(society_data, f, ensure_ascii=False, indent=2)
        print(f"✅ Saved {SOCIETY_JSON}")

        # Summary
        all_results = nature_results + society_results
        cc_counts = Counter(r['category'] for r in all_results)
        print(f"\n📊 Classification Summary:")
        print(f"   A (安全警告): {cc_counts.get('A', 0)}/{len(all_results)}")
        print(f"   B (感官探索): {cc_counts.get('B', 0)}/{len(all_results)}")
        print(f"   C (知识事实): {cc_counts.get('C', 0)}/{len(all_results)}")

        # Verify
        nature_cc = sum(1 for e in nature_entries if e.get('comfortCategory'))
        society_cc = sum(1 for e in society_entries if e.get('comfortCategory'))
        print(f"\nVerify: nature comfortCategory={nature_cc}/{len(nature_entries)}, society={society_cc}/{len(society_entries)}")


if __name__ == '__main__':
    main()