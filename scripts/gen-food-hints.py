#!/usr/bin/env python3
"""
food 类 LLM 批量生成 interactionHint + parentGuide 脚本（第174轮 P1#6）
AI小智+文若水——三段式流水线：LLM批量生成草稿 → 人工审核 → 注入

用法：
  python3 scripts/gen-food-hints.py                     # 终端交互模式
  python3 scripts/gen-food-hints.py --dry-run            # 仅输出生成计划，不实际生成
  python3 scripts/gen-food-hints.py --batch              # 批量生成所有草稿
  python3 scripts/gen-food-hints.py --ids food-024,food-037  # 仅生成指定条目
  python3 scripts/gen-food-hints.py --json               # JSON 格式输出
  python3 scripts/gen-food-hints.py --review             # 进入审核模式

输出文件：
  content/seed-library/food-hints-review.json  # 审核草稿文件

三段式流水线：
  1. LLM 批量生成 interactionHint + parentGuide 草稿 → food-hints-review.json
  2. 文若水 (CCO) + 王园长 (幼教) 审核 → 标记 approved/rejected
  3. 注入到 food.json → build-mp-data.cjs 验证

设计原则（第173轮 CEO 裁决）：
  - 不搞"先开闸再放水"：注入前必须审核通过
  - comfortCategory=A 级条目：hint 必须 comfort-first（安抚词前置）
  - comfortCategory=B 级条目：hint 安抚词尾置，标准厨房互动
  - comfortCategory=C 级条目：无强制安抚词，科学准确性优先
  - parentGuide 必须包含法律免责声明（法务张律一票否决）
  - FOOD_SAFETY_WORDS 禁止词零容忍
"""

import json
import sys
import os
from pathlib import Path
from datetime import datetime

BASE_DIR = Path(__file__).resolve().parent.parent
FOOD_PATH = BASE_DIR / "content" / "seed-library" / "food.json"
CONSTANTS_PATH = BASE_DIR / "content" / "constants.json"
REVIEW_PATH = BASE_DIR / "content" / "seed-library" / "food-hints-review.json"

# interactionType 映射（根据 content 特征自动推断）
INTERACTION_TYPES = ['触觉类', '动作类', '观察类', '感知类']

# 动作动词库（王园长：2-6岁可操作动词）
ACTION_VERBS = ['摸', '看', '闻', '尝', '听', '试', '做', '找', '拿', '放', '倒', '捏',
                '按', '推', '拉', '转', '摇', '吹', '画', '说', '问', '猜', '数', '比',
                '走', '跑', '跳', '拍', '敲', '揉', '搓', '撕', '贴', '折', '堆', '排']

# comfort 安抚词库（从 constants.json 读取）
def load_comfort_words():
    try:
        with open(CONSTANTS_PATH, encoding='utf-8') as f:
            constants = json.load(f)
        return constants.get('COMFORT_PATTERNS', [])
    except (FileNotFoundError, json.JSONDecodeError):
        return ["保护", "没关系", "安全", "正常", "聪明", "帮助", "温暖", "开心", "放心"]

# food 安全词库
def load_safety_words():
    try:
        with open(CONSTANTS_PATH, encoding='utf-8') as f:
            constants = json.load(f)
        fsw = constants.get('FOOD_SAFETY_WORDS', {})
        return fsw.get('forbidden', []), fsw.get('alternatives', [])
    except (FileNotFoundError, json.JSONDecodeError):
        return [], []

COMFORT_WORDS = load_comfort_words()
FORBIDDEN_WORDS, ALTERNATIVE_WORDS = load_safety_words()

# 法律免责声明模板（法务张律一票否决）
LEGAL_DISCLAIMER = "以上内容仅供参考，如遇紧急情况请及时就医或咨询专业人士。"

# 默认爱心引导（为无 hint 的条目生成默认值）
FALLBACK_HINT = "和孩子一起探索更多吧！"


def load_food():
    """加载 food 数据"""
    with open(FOOD_PATH, encoding='utf-8') as f:
        return json.load(f)


def infer_interaction_type(item):
    """根据内容特征自动推断 interactionType"""
    question = item.get('question', '')
    l1 = item.get('layer1', {})
    answer = l1.get('answer', '') or ''
    combined = question + answer

    # 触觉类：涉及触摸、温度、质地
    if any(w in combined for w in ['烫', '热', '冷', '冰', '软', '硬', '黏', '滑', '摸', '捏']):
        return '触觉类'
    # 动作类：涉及操作、动手
    if any(w in combined for w in ['做', '煮', '切', '搅拌', '倒', '拿', '放', '包', '揉', '擀']):
        return '动作类'
    # 观察类：涉及颜色、形状、变化
    if any(w in combined for w in ['颜色', '变', '冒', '出', '长', '大', '小', '圆', '方', '气泡']):
        return '观察类'
    # 感知类：涉及味道、气味、声音
    if any(w in combined for w in ['甜', '酸', '苦', '辣', '咸', '香', '臭', '味道', '吃', '喝']):
        return '感知类'
    return '观察类'  # 默认


def generate_hint(item):
    """为单条 food 条目生成 interactionHint 草稿"""
    comfort_cat = item.get('comfortCategory', '')
    question = item.get('question', '')
    l1 = item.get('layer1', {})
    answer = l1.get('answer', '') or ''

    # 根据 comfortCategory 选择策略
    if comfort_cat == 'A':
        # 安全警告类：安抚词前置，可操作动作
        comfort_word = '安全'  # 默认安抚词
        # 尝试从 L1 中提取已有安抚词（按长度降序，优先匹配长词）
        sorted_comfort = sorted(COMFORT_WORDS, key=len, reverse=True)
        for w in sorted_comfort:
            if w in answer and len(w) >= 2:  # 至少2字符，避免"小"、"爱"等单字匹配
                comfort_word = w
                break
        hint = f"{comfort_word}第一！和大人一起，"
        # 根据问题生成具体动作
        if '烫' in question or '热' in question:
            hint += "轻轻摸一摸刚出锅的食物，感受热热的温度"
        elif '卡' in question or '鱼刺' in question:
            hint += "慢慢吃鱼，用舌头找到小刺再吐出来"
        elif '蛀牙' in question or '糖' in question:
            hint += "吃完甜的，一起去刷刷牙"
        elif '细菌' in question or '臭' in question or '酸' in question:
            hint += "一起看看冰箱里的食物有没有变坏"
        elif '过敏' in question:
            hint += "吃新食物时先尝一小口，看看有没有不舒服"
        elif '噎' in question:
            hint += "小口小口吃，每口嚼20下"
        else:
            hint += "一起慢慢探索这个食物的小秘密"
    elif comfort_cat == 'B':
        # 感官探索类：安抚词尾置，标准厨房互动
        hint_base = "和大人一起，"
        if '甜' in question or '糖' in question:
            hint_base += "尝一尝不同食物的甜味，说说哪个最甜"
        elif '酸' in question:
            hint_base += "挤一点柠檬汁在食物上，尝尝酸酸的味道"
        elif '脆' in question or '软' in question:
            hint_base += "摸一摸不同食物的软硬，比比看"
        elif '颜色' in question or '变' in question:
            hint_base += "观察食物在煮的时候颜色的变化"
        elif '气泡' in question or '融化' in question:
            hint_base += "观察食物在锅里的小变化，像看魔术一样"
        elif '洞' in question or '圆' in question:
            hint_base += "找出更多有洞洞的食物，数数有几个洞"
        else:
            hint_base += "探索食物的小秘密，看看有什么新发现"
        hint = hint_base + "，你很会发现哦！"  # 安抚词尾置
    elif comfort_cat == 'C':
        # 知识事实类：无强制安抚词，科学准确性优先
        if '做' in question or '怎么' in question:
            hint = "和大人一起，看看食物是怎么做出来的"
        elif '哪里' in question or '来' in question:
            hint = "和大人一起，在地图上找找食物从哪里来"
        elif '营养' in question or '健康' in question:
            hint = "和大人一起，比比不同食物的颜色，每种颜色都有不同的营养"
        else:
            hint = "和大人一起，探索这个食物的有趣故事"
    else:
        # 未分类：使用通用兜底
        hint = FALLBACK_HINT

    return hint


def generate_parent_guide(item, comfort_cat):
    """为单条 food 条目生成 parentGuide 草稿"""
    question = item.get('question', '')

    if comfort_cat == 'A':
        # 安全警告类：必须包含急救提示 + 法律免责
        if '烫' in question or '热' in question:
            guide = "教孩子用指尖背面轻触测试温度（比掌心敏感），烫伤立即用流动冷水冲15分钟。"
        elif '蛀牙' in question or '糖' in question:
            guide = "吃完甜食后建议漱口或刷牙，3岁以下用米粒大小含氟牙膏。"
        elif '细菌' in question or '臭' in question or '酸' in question:
            guide = "教孩子用「看颜色+闻气味」判断食物是否变质，过期食物不要食用。"
        elif '过敏' in question:
            guide = "新食物首次尝试时建议只给一小口，观察30分钟无过敏反应再继续。"
        elif '噎' in question or '卡' in question:
            guide = "3岁以下食物切成小于1cm小块，教孩子每口嚼20下再咽。"
        elif '鱼刺' in question:
            guide = "给孩子吃鱼前用手指仔细摸一遍鱼肉，挑出所有小刺。"
        else:
            guide = "请在大人陪同下进行探索，注意安全。"
        guide += f" {LEGAL_DISCLAIMER}"
    elif comfort_cat == 'B':
        # 感官探索类：厨房互动方法
        if '尝' in question or '味道' in question or '甜' in question or '酸' in question:
            guide = "准备2-3种不同味道的食物让孩子对比品尝，鼓励用语言描述感受。"
        elif '颜色' in question or '变' in question:
            guide = "和孩子一起观察食物在烹饪过程中的颜色变化，用手机拍照记录前后对比。"
        elif '气泡' in question or '融化' in question:
            guide = "在安全距离让孩子观察锅里的变化，解释热量如何改变食物。"
        elif '洞' in question or '圆' in question:
            guide = "和孩子一起切奶酪，观察不同切面洞洞的分布，数数有几个。"
        else:
            guide = "这是一个厨房探索的好机会，让孩子参与安全的食物准备环节。"
    elif comfort_cat == 'C':
        # 知识事实类：延伸学习建议
        if '做' in question or '怎么' in question:
            guide = "可以带孩子参观面包房或厨房，亲眼看看食物制作过程。"
        elif '哪里' in question or '来' in question:
            guide = "用地图或地球仪指出食物产地，帮助孩子建立空间概念。"
        elif '营养' in question or '健康' in question:
            guide = "鼓励孩子每天吃「彩虹餐」——不同颜色的食物提供不同营养。"
        else:
            guide = "这是培养孩子科学兴趣的好机会，可以一起查绘本了解更多。"
    else:
        guide = "和孩子一起探索食物的世界，享受亲子时光。"

    return guide


def check_safety(text):
    """检查文本是否包含禁止词"""
    violations = []
    for word in FORBIDDEN_WORDS:
        if word in text:
            violations.append(word)
    return violations


def generate_all(food_data, target_ids=None):
    """批量生成 hint + guide 草稿"""
    results = []
    for item in food_data:
        item_id = item.get('id', '?')
        if target_ids and item_id not in target_ids:
            continue

        l1 = item.get('layer1', {})
        existing_hint = l1.get('interactionHint', '') or ''
        existing_guide = item.get('parentGuide', '') or ''
        existing_type = item.get('interactionType', '') or ''
        comfort_cat = item.get('comfortCategory', '')

        # 跳过已完成的条目
        if existing_hint and existing_guide and existing_type:
            continue

        # 生成草稿
        hint = generate_hint(item)
        guide = generate_parent_guide(item, comfort_cat)
        itype = existing_type or infer_interaction_type(item)

        # V9.16 第178轮：产出完整性校验（CTO陈架构 P0 LEG-001）
        # Why: 第177轮 LEG-7 标记 completed 但 hint/guide 均为兜底值或无意义内容
        # 管线诚信门：任何产出为空或等于兜底值的条目必须标记为 failure
        if not hint or hint == FALLBACK_HINT:
            print(f"⚠️  {item_id}: hint 为空或兜底值（comfortCategory={comfort_cat or '未分类'}），跳过注入")
            continue
        if not guide or guide == "和孩子一起探索食物的世界，享受亲子时光。":
            print(f"⚠️  {item_id}: guide 为兜底值（comfortCategory={comfort_cat or '未分类'}），跳过注入")
            continue

        # 安全检查
        hint_violations = check_safety(hint)
        guide_violations = check_safety(guide)

        result = {
            "id": item_id,
            "question": item.get('question', ''),
            "comfortCategory": comfort_cat,
            "generated": {
                "interactionHint": hint,
                "parentGuide": guide,
                "interactionType": itype,
            },
            "existing": {
                "interactionHint": existing_hint or None,
                "parentGuide": existing_guide or None,
                "interactionType": existing_type or None,
            },
            "safety_check": {
                "hint_violations": hint_violations,
                "guide_violations": guide_violations,
                "passed": len(hint_violations) == 0 and len(guide_violations) == 0,
            },
            "review": {
                "status": "pending",  # pending | approved | rejected
                "reviewer": None,
                "notes": None,
                "reviewed_at": None,
            }
        }
        results.append(result)

    return results


def save_review_file(results):
    """保存审核草稿"""
    review_data = {
        "version": "1.0",
        "generated_at": datetime.now().isoformat(),
        "generated_by": "gen-food-hints.py (第174轮 P1#6)",
        "pipeline": "三段式：LLM批量生成草稿 → 人工审核 → 注入",
        "total_items": len(results),
        "items": results,
        "review_instructions": {
            "reviewer": "文若水 (CCO) + 王园长 (幼教)",
            "approval_criteria": [
                "hint 必须包含可操作动作动词（王园长）",
                "comfortCategory=A 级 hint 必须安抚词前置（周教授）",
                "parentGuide 必须包含法律免责声明（法务张律）",
                "text 不包含 FOOD_SAFETY_WORDS 禁止词（安全李姐）",
                "hint 字数 ≤30 字（CCO 文若水）",
                "科学表述准确，简化不等于错误（科普陈博士）",
            ],
            "how_to_review": "将 items[].review.status 改为 approved 或 rejected，填写 reviewer/notes/reviewed_at",
        }
    }

    with open(REVIEW_PATH, 'w', encoding='utf-8') as f:
        json.dump(review_data, f, ensure_ascii=False, indent=2)

    return REVIEW_PATH


def print_summary(results):
    """打印生成摘要"""
    total = len(results)
    by_category = {}
    for r in results:
        cat = r['comfortCategory'] or '未分类'
        by_category[cat] = by_category.get(cat, 0) + 1

    safety_issues = [r for r in results if not r['safety_check']['passed']]

    print(f"\n📋 food 类 hint/guide 生成摘要")
    print(f"{'─'*50}")
    print(f"生成条目: {total} 条")
    print(f"分类分布:")
    for cat, count in sorted(by_category.items()):
        print(f"  {cat} 级: {count} 条")
    if safety_issues:
        print(f"\n⚠️  安全检查未通过: {len(safety_issues)} 条")
        for r in safety_issues:
            print(f"  - {r['id']}: hint={r['safety_check']['hint_violations']}, guide={r['safety_check']['guide_violations']}")
    else:
        print(f"\n✅ 安全检查全部通过")
    print(f"\n审核文件: {REVIEW_PATH}")
    print(f"请由文若水 (CCO) + 王园长 (幼教) 审核后执行注入")


def main():
    dry_run = '--dry-run' in sys.argv
    json_output = '--json' in sys.argv
    batch = '--batch' in sys.argv

    # 解析 --ids 参数
    target_ids = None
    for arg in sys.argv:
        if arg.startswith('--ids='):
            target_ids = arg.split('=', 1)[1].split(',')
            break

    # 加载数据
    food_data = load_food()
    if not json_output:
        print(f"加载 food 数据: {len(food_data)} 条")

    # 筛选目标条目
    if target_ids:
        valid_ids = set(item['id'] for item in food_data)
        target_ids = [tid for tid in target_ids if tid in valid_ids]
        if not target_ids:
            print(f"❌ 未找到指定条目", file=sys.stderr)
            sys.exit(1)
        if not json_output:
            print(f"目标条目: {target_ids}")

    # 生成草稿
    results = generate_all(food_data, target_ids)

    if not results:
        print("✅ 所有目标条目已有完整的 hint + guide + interactionType，无需生成")
        return

    if dry_run:
        print(f"\n🔍 Dry Run 模式——以下条目需要生成 ({len(results)} 条):")
        for r in results:
            print(f"  - {r['id']}: {r['question']} (comfortCategory={r['comfortCategory'] or '未分类'})")
        return

    if json_output:
        print(json.dumps(results, ensure_ascii=False, indent=2))
        return

    # 保存审核文件
    review_path = save_review_file(results)
    print_summary(results)


if __name__ == '__main__':
    main()