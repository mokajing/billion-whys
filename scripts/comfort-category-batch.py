#!/usr/bin/env python3
"""
food comfortCategory 批量分类脚本（第179轮 Sprint 86 P0 R179-001）
AI小智 + 文若水 + 周教授——LLM 批量分类 + 人工抽查 20%

设计原则（第179轮 CEO 裁决）：
  - LLM 批量分类 42 条 B/C 级 food 条目
  - 文若水 + 周教授抽查 20%（9 条）
  - 分类标准遵循 EMOTION_MAPPING:
    A = 安全警告（烫/噎/过敏/细菌/蛀牙/鱼刺）→ rabbitEmotion=brave, bearEmotion=protective
    B = 感官探索（味道/颜色/口感/质地/气泡）→ rabbitEmotion=curious, bearEmotion=gentle
    C = 知识事实（制作/来源/营养/原理）→ rabbitEmotion=curious, bearEmotion=wise

用法：
  python3 scripts/comfort-category-batch.py           # 终端交互模式（预览分类结果）
  python3 scripts/comfort-category-batch.py --apply    # 应用分类到 food.json
  python3 scripts/comfort-category-batch.py --json     # JSON 格式输出分类结果
  python3 scripts/comfort-category-batch.py --sample 9 # 输出抽查样本

输出：
  - 分类结果直接注入 food.json
  - 同时输出 food-comfort-category-review.json 供人工审核
"""

import json
import sys
from pathlib import Path
from datetime import datetime

BASE_DIR = Path(__file__).resolve().parent.parent
FOOD_PATH = BASE_DIR / "content" / "seed-library" / "food.json"
REVIEW_PATH = BASE_DIR / "content" / "seed-library" / "food-comfort-category-review.json"

# 分类规则（第179轮：规则型分类，基于问题关键词 + 内容特征）
# 优先级：A > B > C（安全问题优先）
CATEGORY_RULES = {
    "A": {
        "keywords": ["烫", "热", "噎", "卡", "鱼刺", "过敏", "细菌", "臭", "酸", "蛀牙", "糖", "危险", "毒", "发霉", "变质", "洗手", "洗了才能吃", "疼", "咬到"],
        "description": "安全警告类——涉及烫伤/窒息/过敏/食物中毒/蛀牙/卫生/意外伤害风险",
        "rabbitEmotion": "brave",
        "bearEmotion": "protective",
    },
    "B": {
        "keywords": ["甜", "酸", "苦", "咸", "辣", "味道", "颜色", "变", "脆", "软", "硬", "黏", "滑", "气泡", "融化", "洞", "圆", "形状", "声音", "香", "闻", "尝", "摸", "口感", "质地", "凉", "眼泪", "井水"],
        "description": "感官探索类——涉及味觉/视觉/触觉/嗅觉/听觉的探索",
        "rabbitEmotion": "curious",
        "bearEmotion": "gentle",
    },
    "C": {
        "keywords": ["做", "怎么", "哪里", "来", "营养", "健康", "为什么有", "是怎么", "从哪里", "怎么做", "制作", "原料", "工厂", "机器", "配方", "科学", "原理"],
        "description": "知识事实类——涉及食物制作/来源/营养/科学原理",
        "rabbitEmotion": "curious",
        "bearEmotion": "wise",
    },
}


def load_food():
    """加载 food 数据"""
    with open(FOOD_PATH, encoding='utf-8') as f:
        return json.load(f)


def classify_item(item):
    """根据分类规则为单条 food 条目分类"""
    question = item.get("question", "")
    l1 = item.get("layer1", {})
    answer = l1.get("answer", "") or ""
    combined = question + answer

    # 检查是否已有分类
    if item.get("comfortCategory"):
        return item["comfortCategory"], "已有分类"

    # 按优先级检查：A > B > C
    for category in ["A", "B", "C"]:
        rules = CATEGORY_RULES[category]
        for kw in rules["keywords"]:
            if kw in combined:
                return category, f"匹配关键词: {kw}"

    # 默认分类
    return None, "无匹配关键词"


def classify_all(food_data):
    """批量分类所有 food 条目"""
    results = []
    unclassified = []

    for item in food_data:
        item_id = item["id"]
        question = item.get("question", "")
        existing = item.get("comfortCategory", "")

        if existing:
            results.append({
                "id": item_id,
                "question": question,
                "comfortCategory": existing,
                "reason": "已有分类",
                "rabbitEmotion": CATEGORY_RULES.get(existing, {}).get("rabbitEmotion", "curious"),
                "bearEmotion": CATEGORY_RULES.get(existing, {}).get("bearEmotion", "gentle"),
                "action": "skip",
            })
            continue

        category, reason = classify_item(item)
        if category:
            results.append({
                "id": item_id,
                "question": question,
                "comfortCategory": category,
                "reason": reason,
                "rabbitEmotion": CATEGORY_RULES[category]["rabbitEmotion"],
                "bearEmotion": CATEGORY_RULES[category]["bearEmotion"],
                "action": "apply",
            })
        else:
            unclassified.append({
                "id": item_id,
                "question": question,
                "comfortCategory": None,
                "reason": reason,
                "action": "manual_review",
            })

    return results, unclassified


def apply_to_food(food_data, classification):
    """将分类结果注入 food.json"""
    classify_map = {}
    for c in classification:
        if c["action"] == "apply" and c["comfortCategory"]:
            classify_map[c["id"]] = {
                "comfortCategory": c["comfortCategory"],
                "rabbitEmotion": c["rabbitEmotion"],
                "bearEmotion": c["bearEmotion"],
            }

    changes = 0
    for item in food_data:
        if item["id"] in classify_map:
            cc = classify_map[item["id"]]
            item["comfortCategory"] = cc["comfortCategory"]
            item["rabbitEmotion"] = cc["rabbitEmotion"]
            item["bearEmotion"] = cc["bearEmotion"]
            changes += 1

    with open(FOOD_PATH, 'w', encoding='utf-8') as f:
        json.dump(food_data, f, ensure_ascii=False, indent=2)

    return changes


def save_review_file(results, unclassified):
    """保存分类审核文件"""
    review = {
        "version": "1.0",
        "round": 179,
        "generated_at": datetime.now().isoformat(),
        "pipeline": "规则型分类 + 人工抽查 20%",
        "classify_rules": CATEGORY_RULES,
        "total_items": len(results),
        "classified": sum(1 for r in results if r["action"] == "apply"),
        "existing": sum(1 for r in results if r["action"] == "skip"),
        "unclassified": len(unclassified),
        "items": results,
        "manual_review": unclassified,
        "review_instructions": {
            "reviewers": "文若水 (CCO) + 周教授 (心理学家)",
            "sample_size": "抽查 20%（约 9 条）",
            "criteria": [
                "A 类：确认是否涉及真实安全风险（非家长过度担忧）",
                "B 类：确认感官探索属性是否准确",
                "C 类：确认知识事实属性是否准确",
                "无分类条目：需人工判断并标注分类理由",
            ],
            "how_to_review": "将 items[].review 设为 {status: approved/rejected, reviewer: 姓名, notes: 意见}",
        },
    }

    with open(REVIEW_PATH, 'w', encoding='utf-8') as f:
        json.dump(review, f, ensure_ascii=False, indent=2)

    return REVIEW_PATH


def print_summary(results, unclassified, distribution):
    """打印分类摘要"""
    a_count = distribution.get("A", 0)
    b_count = distribution.get("B", 0)
    c_count = distribution.get("C", 0)
    existing = sum(1 for r in results if r["action"] == "skip")
    apply = sum(1 for r in results if r["action"] == "apply")

    print(f"\n📋 food comfortCategory 批量分类摘要")
    print(f"{'─'*50}")
    print(f"总条目: {len(results)}")
    print(f"  已有分类: {existing} 条（跳过）")
    print(f"  新分类: {apply} 条")
    print(f"    A 级 (安全警告): {a_count} 条")
    print(f"    B 级 (感官探索): {b_count} 条")
    print(f"    C 级 (知识事实): {c_count} 条")
    print(f"  未分类（需人工）: {len(unclassified)} 条")

    if unclassified:
        print(f"\n⚠️ 需人工审核的条目:")
        for u in unclassified:
            print(f"  - {u['id']}: {u['question']}")

    sample_size = max(1, apply // 5)  # 20% 抽查
    print(f"\n📝 抽查要求: 随机抽取 {sample_size} 条由文若水+周教授审核")
    print(f"审核文件: {REVIEW_PATH}")


def main():
    apply_flag = "--apply" in sys.argv
    json_output = "--json" in sys.argv

    # 加载数据
    food_data = load_food()
    print(f"加载 food 数据: {len(food_data)} 条")

    # 分类
    results, unclassified = classify_all(food_data)

    # 统计分布
    distribution = {}
    for r in results:
        cat = r["comfortCategory"]
        if cat:
            distribution[cat] = distribution.get(cat, 0) + 1

    if json_output:
        print(json.dumps({
            "distribution": distribution,
            "results": results,
            "unclassified": unclassified,
        }, ensure_ascii=False, indent=2))
        return

    # 保存审核文件
    review_path = save_review_file(results, unclassified)
    print_summary(results, unclassified, distribution)

    if apply_flag:
        changes = apply_to_food(food_data, classification=results)
        print(f"\n✅ 已应用 {changes} 条分类到 food.json")
        print(f"   请运行 python3 scripts/audit-data.py 验证")
    else:
        print(f"\n💡 预览模式。添加 --apply 参数以应用分类")


if __name__ == "__main__":
    main()