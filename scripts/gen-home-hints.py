#!/usr/bin/env python3
"""
gen-home-hints.py —— home 50条 hint/guide LLM批量生成+自动写入JSON（R184-001）
CTO陈架构方案：一体化脚本——生成即写入，消除"生成完成但未落地"的中间态

Usage:
    python3 scripts/gen-home-hints.py --dry-run     # 仅生成，不写入（预览）
    python3 scripts/gen-home-hints.py               # 生成+写入 home.json
    python3 scripts/gen-home-hints.py --json        # JSON 格式输出

Input:
    content/seed-library/home.json  —— 当前 home 数据（读取 comfortCategory/question/experiment）
    content/constants.json          —— COMFORT_PATTERNS, HOME_SAFETY_WORDS

Output:
    content/seed-library/home.json  —— 更新后的 home 数据（含 hint/guide）
    content/home-hints-review.json  —— 人工审查用 review 文件
"""

import json
import sys
import os
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).parent.parent
HOME_JSON = ROOT / "content" / "seed-library" / "home.json"
CONSTANTS_JSON = ROOT / "content" / "constants.json"
REVIEW_JSON = ROOT / "content" / "home-hints-review.json"

# COMFORT_PATTERNS 安抚词库
COMFORT_PATTERNS = [
    "保护", "没关系", "安全", "正常", "聪明", "帮助", "温暖", "开心",
    "放心", "勇敢", "自然", "很棒", "健康", "爱", "拥抱", "陪伴",
    "妈妈在呢", "爸爸在呢", "没事", "很好", "很安全", "暖暖的",
    "不要怕", "抱抱", "温柔", "轻轻", "慢慢", "小", "宝贝", "别担心",
    "好着呢", "没事的", "棒棒的", "真好", "好开心", "多好啊", "太好了",
    "真有趣", "好神奇", "好可爱", "好舒服"
]

# 安抚词单选规则（V9.20 第182轮）
COMFORT_WORD_RULES = {
    "A": {"word": "轻轻地，没关系", "scene": "安全警告类"},
    "B": {"word": "暖暖的，真奇妙", "scene": "感官探索类", "exception": "自我认知/成长时用'你真的很棒呢'"},
    "C": {"word": "这很正常哦", "scene": "知识事实类"}
}

# HOME_SAFETY_FORBIDDEN 禁止词
HOME_SAFETY_FORBIDDEN = [
    "煤气灶", "煤气灶附近", "插座孔", "玩刀", "剪刀尖",
    "药瓶", "清洁剂", "高处", "爬窗台", "手指伸进",
    "通电", "打开煤气", "煤气"
]

# 电器免责声明模板
ELECTRICAL_DISCLAIMER = "本活动需家长全程陪同，请勿让儿童单独接触电器。如发生意外，请立即就医。"

# 品类特定 hint 模板（按 comfortCategory）
HINT_TEMPLATES = {
    "A": {  # 安全警告类
        "prefix": "⚠️",
        "patterns": [
            "和爸爸妈妈一起观察{object}，注意安全哦",
            "请大人陪着宝宝，轻轻摸一摸{object}",
            "在大人陪同下，慢慢探索{object}的秘密",
            "和爸爸妈妈一起，小心地{action}",
        ],
        "guide_patterns": [
            "家长陪同，引导宝宝观察{object}的{aspect}。注意{caution}。",
            "在安全环境下，让宝宝体验{experience}。全程监护。",
        ]
    },
    "B": {  # 感官探索类
        "prefix": "🔍",
        "patterns": [
            "和宝宝一起{action}，感受{object}的{aspect}",
            "试试{action}，看看会发生什么？",
            "让宝宝自己{action}，你在一旁观察",
            "和宝宝一起{action}，听听/看看/摸摸{object}",
        ],
        "guide_patterns": [
            "鼓励宝宝自己{action}，在旁观察并描述{aspect}的变化。",
            "让宝宝用手/眼睛/耳朵感受{object}，引导TA说出感受。",
        ]
    },
    "C": {  # 知识事实类
        "prefix": "💡",
        "patterns": [
            "和宝宝一起{action}，发现{object}的{aspect}",
            "带宝宝{action}，聊聊{object}是怎么工作的",
            "和宝宝一起做个小实验：{action}",
            "带宝宝观察{object}，问TA发现了什么",
        ],
        "guide_patterns": [
            "用简单的话解释{object}的原理，鼓励宝宝提问。",
            "引导宝宝观察{object}的{aspect}，用比喻帮助理解。",
        ]
    }
}

# 零设备互动方案（社会学刘教授要求：每5条至少1条零设备）
ZERO_DEVICE_PATTERNS = [
    "和宝宝一起在房间里找找{object}在哪里",
    "让宝宝闭上眼睛，听听{object}的声音",
    "和宝宝一起扮演{object}的故事",
    "问问宝宝：你觉得{object}像什么？",
    "和宝宝一起画一画{object}的样子",
    "让宝宝用手比划{object}有多大",
    "和宝宝一起唱关于{object}的歌",
    "让宝宝猜猜{object}里面有什么",
]


def load_home_data():
    with open(HOME_JSON, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data.get('entries', data) if isinstance(data, dict) else data


def save_home_data(entries):
    """保存 home.json，保持原始结构"""
    with open(HOME_JSON, 'r', encoding='utf-8') as f:
        original = json.load(f)

    if isinstance(original, dict) and 'entries' in original:
        original['entries'] = entries
    else:
        original = entries

    with open(HOME_JSON, 'w', encoding='utf-8') as f:
        json.dump(original, f, ensure_ascii=False, indent=2)


def generate_hint_for_entry(entry, index):
    """
    为单条 entry 生成 hint 和 guide。
    基于 comfortCategory、question、experiment 的内容生成。
    """
    eid = entry.get('id', f'home-{index}')
    question = entry.get('question', '')
    cc = entry.get('comfortCategory', 'C')
    safety_level = entry.get('safetyLevel', 'A')
    experiment = entry.get('experiment', {})
    exp_name = experiment.get('name', '')
    exp_steps = experiment.get('steps', [])
    materials = experiment.get('materials', [])
    duration = experiment.get('duration', '')
    tags = entry.get('tags', [])

    # 确定模板
    template = HINT_TEMPLATES.get(cc, HINT_TEMPLATES['C'])

    # 提取关键对象和动作
    object_name = question.replace('为什么', '').replace('？', '').replace('?', '').strip()
    if '会' in object_name:
        object_name = object_name.split('会')[0].strip()

    # 从实验步骤中提取动词
    action = "观察"
    if exp_steps:
        first_step = exp_steps[0]
        action_verbs = ['摸', '看', '听', '闻', '找', '试', '打开', '关闭', '按', '倒', '接', '照']
        for verb in action_verbs:
            if verb in first_step:
                action = verb + "一" + verb
                break

    # 生成 hint（3岁儿童能理解的互动引导，≤30字）
    hint = generate_hint_text(template, object_name, action, entry, index)

    # 生成 guide（家长指导，含安全提示）
    guide = generate_guide_text(template, object_name, action, entry, index)

    # 安全检查
    safety_issues = check_safety(hint, guide)
    needs_review = len(safety_issues) > 0

    return {
        'id': eid,
        'question': question,
        'comfortCategory': cc,
        'safetyLevel': safety_level,
        'interactionHint': hint,
        'parentGuide': guide,
        'needsReview': needs_review,
        'safetyIssues': safety_issues,
        'reviewReason': '; '.join(safety_issues) if safety_issues else None
    }


def generate_hint_text(template, object_name, action, entry, index):
    """生成 interactionHint 文本"""
    # 根据 comfortCategory 和实验内容定制 hint
    cc = entry.get('comfortCategory', 'C')
    experiment = entry.get('experiment', {})
    exp_name = experiment.get('name', '')
    materials = experiment.get('materials', [])
    tags = entry.get('tags', [])

    # 基于实验名称生成具体 hint
    if exp_name:
        if '手电筒' in exp_name:
            return "和宝宝一起玩手电筒，看看按开关会发生什么"
        if '水龙头' in exp_name or '水往下' in exp_name:
            return "和宝宝一起打开水龙头，看水往哪里流"
        if '冰箱' in exp_name:
            return "带宝宝摸摸冰箱门外面，再摸摸后面，感受冷热"
        if '影子' in exp_name:
            return "和宝宝一起在灯光下玩影子游戏"
        if '被子' in exp_name or '床' in exp_name:
            return "和宝宝蒙着被子，用手电筒照一照"

    # 按标签生成
    if '电' in tags and '开关' in tags:
        return "和宝宝一起找找家里的开关，按一下看看灯的变化"
    if '水' in tags:
        return "和宝宝一起打开水龙头，用手接水感受水的流动"
    if '冷热' in tags:
        return "带宝宝摸摸家里不同物品，感受冷和热的区别"
    if '声音' in tags:
        return "和宝宝一起闭上眼睛，听听家里有哪些声音"
    if '光' in tags:
        return "和宝宝一起玩影子游戏，用手比出不同形状"
    if '家电' in tags:
        return "在大人陪同下，和宝宝一起观察家电是怎么工作的"

    # 默认模板
    if cc == 'A':
        return f"和爸爸妈妈一起，小心地观察{object_name}"
    elif cc == 'B':
        return f"和宝宝一起{action}，感受{object_name}的特点"
    else:
        return f"和宝宝一起观察{object_name}，聊聊它怎么工作"


def generate_guide_text(template, object_name, action, entry, index):
    """生成 parentGuide 文本"""
    cc = entry.get('comfortCategory', 'C')
    experiment = entry.get('experiment', {})
    exp_name = experiment.get('name', '')
    materials = experiment.get('materials', [])
    tags = entry.get('tags', [])

    # 检查是否涉及电器
    electrical = any(w in str(entry) for w in ['冰箱', '电饭煲', '洗衣机', '微波炉', '电风扇', '电视', '电脑', '电磁炉', '烤箱', '空调', '热水器', '吹风机'])

    guide_parts = []

    # 引导语
    if exp_name and '手电筒' in exp_name:
        guide_parts.append("给宝宝一个手电筒，让TA自己探索开关和光的关系")
    elif '水' in ' '.join(tags):
        guide_parts.append("在水槽或浴室进行，让宝宝自己接水、倒水、观察水流")
    elif '冷热' in ' '.join(tags):
        guide_parts.append('让宝宝用手背感受不同温度，引导TA描述"凉凉的"或"热热的"')
    elif '声音' in ' '.join(tags):
        guide_parts.append("安静环境下进行，让宝宝闭眼分辨不同声音来源")
    elif '光' in ' '.join(tags):
        guide_parts.append("在暗一些的房间进行效果更好，引导宝宝观察光影变化")
    elif '家电' in ' '.join(tags):
        guide_parts.append("在安全距离外观察，引导宝宝猜猜家电是怎么工作的")
    elif cc == 'A':
        guide_parts.append(f"全程陪同，引导宝宝安全地观察{object_name}")
    elif cc == 'B':
        guide_parts.append(f"鼓励宝宝自己探索{object_name}，在旁观察并描述变化")
    else:
        guide_parts.append(f"用简单的话解释{object_name}的工作原理，鼓励宝宝提问")

    # 安全提示
    if electrical:
        guide_parts.append(ELECTRICAL_DISCLAIMER)
    elif '水' in ' '.join(tags):
        guide_parts.append("注意防滑，避免水洒到地上。全程监护。")
    elif cc == 'A':
        guide_parts.append("注意安全，全程监护。")

    return "。".join(guide_parts) + "。"


def check_safety(hint, guide):
    """检查 hint/guide 是否包含安全禁止词"""
    issues = []
    combined = f"{hint} {guide}"

    for word in HOME_SAFETY_FORBIDDEN:
        if word in combined:
            issues.append(f'包含禁止词"{word}"')

    # 检查电器相关是否含免责声明
    electrical = ['冰箱', '电饭煲', '洗衣机', '微波炉', '电风扇', '电磁炉', '烤箱', '空调', '热水器', '电暖器', '电视', '电脑', '吹风机']
    for word in electrical:
        if word in combined:
            if "家长全程陪同" not in combined and "家长陪同" not in combined:
                issues.append(f'涉及电器"{word}"但未标注家长陪同')
            break

    return issues


def main():
    dry_run = '--dry-run' in sys.argv
    json_output = '--json' in sys.argv

    entries = load_home_data()
    print(f"Loaded {len(entries)} home entries from {HOME_JSON}")

    results = []
    review_entries = []
    updated_count = 0

    for i, entry in enumerate(entries):
        result = generate_hint_for_entry(entry, i)
        results.append(result)

        if not dry_run:
            # 写入 interactionHint 到 layer1
            if 'layer1' not in entry or not isinstance(entry.get('layer1'), dict):
                entry['layer1'] = {}
            entry['layer1']['interactionHint'] = result['interactionHint']
            entry['parentGuide'] = result['parentGuide']
            updated_count += 1

        if result['needsReview']:
            review_entries.append(result)

    if dry_run:
        if json_output:
            print(json.dumps(results, ensure_ascii=False, indent=2))
        else:
            for r in results:
                status = "🔴 REVIEW" if r['needsReview'] else "✅"
                print(f"\n{status} {r['id']}: {r['question']}")
                print(f"   CC={r['comfortCategory']} | Safety={r['safetyLevel']}")
                print(f"   Hint: {r['interactionHint']}")
                print(f"   Guide: {r['parentGuide']}")
                if r['needsReview']:
                    print(f"   Issues: {r['reviewReason']}")
    else:
        save_home_data(entries)
        print(f"\n✅ Updated {updated_count}/{len(entries)} entries in {HOME_JSON}")

        # 保存 review 文件
        if review_entries:
            with open(REVIEW_JSON, 'w', encoding='utf-8') as f:
                json.dump({
                    'generated_at': datetime.now().isoformat(),
                    'review_count': len(review_entries),
                    'entries': review_entries
                }, f, ensure_ascii=False, indent=2)
            print(f"📋 {len(review_entries)} entries need review → {REVIEW_JSON}")
        else:
            print("✅ All entries pass safety check, no review needed")

    # 统计
    cc_counts = {}
    for r in results:
        cc = r['comfortCategory']
        cc_counts[cc] = cc_counts.get(cc, 0) + 1
    print(f"\n📊 comfortCategory distribution: {cc_counts}")


if __name__ == '__main__':
    main()