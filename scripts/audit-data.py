#!/usr/bin/env python3
"""
数据审计脚本（第170轮 Sprint 84 词库统一版）
P0#1: 双通道 comfort 检测（comfortCategory 字段 + L1 文本扫描）+ L1 字数检测
P0#7: COMFORT_PATTERNS 词库统一——从 constants.json 读取（单一源）

用法：
  python3 scripts/audit-data.py           # 终端输出审计报告
  python3 scripts/audit-data.py --json    # JSON格式输出
  python3 scripts/audit-data.py --markdown  # Markdown表格输出
  python3 scripts/audit-data.py --detail  # 详细模式（含缺失项ID列表）
  python3 scripts/audit-data.py --missing # 仅输出缺失项
  python3 scripts/audit-data.py --l1chars # 输出 L1 字数统计

审计维度：
  - comfort 词覆盖率（双通道：comfortCategory 字段 + L1 文本 COMFORT_PATTERNS 扫描）
  - comfortCategory 字段存在性（跨类 schema 一致性）
  - interactionHint 字段存在性
  - parentGuide 字段存在性
  - rabbitEmotion/bearEmotion 字段存在性
  - L1 字数统计（≤50字检查）
  - 每类别条目数统计

第164轮修复：字段名从"text"更正为"answer"（layer1 中的实际字段名）
第169轮升级：双通道 comfort 检测 + comfortCategory 字段审计 + L1 字数检测
第170轮升级：COMFORT_PATTERNS 词库从 constants.json 读取（单一源，消除双源不一致）
"""

import json
import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
CONTENT_DIR = BASE_DIR / "content" / "seed-library"
CONSTANTS_PATH = BASE_DIR / "content" / "constants.json"

# 第170轮：从 constants.json 单一源读取 COMFORT_PATTERNS（P0 词库统一）
def load_comfort_words():
    """从 constants.json 读取 COMFORT_PATTERNS 词库"""
    try:
        with open(CONSTANTS_PATH, encoding='utf-8') as f:
            constants = json.load(f)
        patterns = constants.get('COMFORT_PATTERNS', [])
        if patterns:
            return patterns
    except (FileNotFoundError, json.JSONDecodeError):
        pass
    # 回退硬编码词库（仅当 constants.json 不可用时）
    print("⚠️  警告: constants.json 不可用，使用硬编码回退词库", file=sys.stderr)
    return [
        "保护", "没关系", "安全", "正常", "聪明", "帮助", "温暖", "开心", "放心",
        "勇敢", "自然", "很棒", "健康", "爱", "拥抱", "陪伴", "妈妈在呢", "爸爸在呢",
        "没事", "很好"
    ]

COMFORT_WORDS = load_comfort_words()

CATEGORIES = ['body', 'animals', 'food', 'home', 'nature', 'society']


def audit_category(cat_name):
    """审计单个类别，返回统计字典（第169轮双通道升级版）"""
    fpath = CONTENT_DIR / f"{cat_name}.json"
    if not fpath.exists():
        return {"error": f"文件不存在: {fpath}"}

    with open(fpath, encoding='utf-8') as f:
        data = json.load(f)

    stats = {
        "total": len(data),
        "comfort_text": 0,        # 通道1: L1 文本扫描
        "comfort_field": 0,       # 通道2: comfortCategory 字段存在
        "comfort_combined": 0,    # 双通道合并
        "interactionHint": 0,
        "parentGuide": 0,
        "emotion": 0,
        "l1_over_50": [],         # L1 超 50 字
        "missing_comfort": [],
        "missing_hint": [],
        "missing_guide": [],
        "missing_emotion": [],
        "missing_comfort_category": [],  # comfortCategory 字段缺失
        "hint_action_count": 0,   # 第174轮 P1#12：hint 含动作动词的数量
    }

    for item in data:
        item_id = item.get('id', '?')
        l1 = item.get('layer1', {})
        answer = l1.get('answer', '') or ''
        hint = l1.get('interactionHint', '') or ''

        # 通道1: Comfort 文本扫描（answer + interactionHint）
        combined = answer + ' ' + hint
        has_text_comfort = any(w in combined for w in COMFORT_WORDS)
        if has_text_comfort:
            stats["comfort_text"] += 1

        # 通道2: comfortCategory 字段存在性
        has_field_comfort = 'comfortCategory' in item and item['comfortCategory'] in ('A', 'B', 'C')
        if has_field_comfort:
            stats["comfort_field"] += 1
        else:
            stats["missing_comfort_category"].append(item_id)

        # 双通道合并：任一通道有 comfort 即算覆盖
        if has_text_comfort or has_field_comfort:
            stats["comfort_combined"] += 1
        else:
            stats["missing_comfort"].append(item_id)

        # L1 字数检查（≤50字）
        if len(answer) > 50:
            stats["l1_over_50"].append(f"{item_id}({len(answer)}字)")

        # interactionHint 检查（含动作动词可操作性检测，第174轮 P1#12 测试虫虫+CTO）
        if hint:
            stats["interactionHint"] += 1
            # 可操作性检查：hint 是否包含动作动词
            action_verbs = ['摸', '看', '闻', '尝', '听', '试', '做', '找', '拿', '放', '倒', '捏',
                          '按', '推', '拉', '转', '摇', '吹', '画', '说', '问', '猜', '数', '比',
                          '走', '跑', '跳', '拍', '敲', '揉', '搓', '撕', '贴', '折', '堆', '排']
            has_action = any(v in hint for v in action_verbs)
            if has_action:
                stats["hint_action_count"] += 1
        else:
            stats["missing_hint"].append(item_id)

        # parentGuide 检查
        if item.get('parentGuide'):
            stats["parentGuide"] += 1
        else:
            stats["missing_guide"].append(item_id)

        # emotion 检查
        if item.get('rabbitEmotion') and item.get('bearEmotion'):
            stats["emotion"] += 1
        else:
            stats["missing_emotion"].append(item_id)

    return stats


def audit_all():
    """审计所有类别，返回汇总结果"""
    results = {}
    totals = {
        "total": 0, "comfort_text": 0, "comfort_field": 0,
        "comfort_combined": 0, "interactionHint": 0,
        "parentGuide": 0, "emotion": 0,
    }

    for cat in CATEGORIES:
        stats = audit_category(cat)
        results[cat] = stats
        for key in totals:
            if key in stats:
                totals[key] += stats[key]

    return results, totals


def format_markdown(results, totals):
    """生成 Markdown 格式审计报告（第169轮双通道版）"""
    lines = [
        "## 数据审计报告（第169轮双通道）",
        "",
        "| 类别 | 条目数 | comfort (text) | comfortCategory 字段 | comfort (合并) | interactionHint | parentGuide | emotion | L1>50字 |",
        "|------|--------|----------------|----------------------|----------------|-----------------|-------------|---------|---------|",
    ]

    for cat in CATEGORIES:
        s = results[cat]
        if "error" in s:
            lines.append(f"| {cat} | - | {s['error']} | - | - | - | - | - | - |")
            continue
        t = s["total"]
        over_50 = len(s["l1_over_50"])
        lines.append(
            f"| {cat} | {t} | "
            f"{s['comfort_text']}/{t} ({s['comfort_text']/t*100:.0f}%) | "
            f"{s['comfort_field']}/{t} ({s['comfort_field']/t*100:.0f}%) | "
            f"{s['comfort_combined']}/{t} ({s['comfort_combined']/t*100:.0f}%) | "
            f"{s['interactionHint']}/{t} ({s['interactionHint']/t*100:.0f}%) | "
            f"{s['parentGuide']}/{t} ({s['parentGuide']/t*100:.0f}%) | "
            f"{s['emotion']}/{t} ({s['emotion']/t*100:.0f}%) | "
            f"{over_50} |"
        )

    t = totals["total"]
    lines.append(
        f"| **总计** | **{t}** | "
        f"**{totals['comfort_text']}/{t} ({totals['comfort_text']/t*100:.0f}%)** | "
        f"**{totals['comfort_field']}/{t} ({totals['comfort_field']/t*100:.0f}%)** | "
        f"**{totals['comfort_combined']}/{t} ({totals['comfort_combined']/t*100:.0f}%)** | "
        f"**{totals['interactionHint']}/{t} ({totals['interactionHint']/t*100:.0f}%)** | "
        f"**{totals['parentGuide']}/{t} ({totals['parentGuide']/t*100:.0f}%)** | "
        f"**{totals['emotion']}/{t} ({totals['emotion']/t*100:.0f}%)** | "
        f"- |"
    )

    lines.append("")
    lines.append(f"> Comfort 词库: {len(COMFORT_WORDS)} 词 | 审计时间: {__import__('datetime').datetime.now().isoformat()}")
    lines.append("> 双通道说明：comfort (text) = L1 文本扫描；comfortCategory 字段 = 顶层字段存在性；comfort (合并) = 任一通道满足即算覆盖")

    return "\n".join(lines)


def format_json(results, totals):
    """生成 JSON 格式审计报告"""
    return json.dumps({
        "categories": {k: v for k, v in results.items()},
        "totals": totals,
        "comfort_words_count": len(COMFORT_WORDS),
        "audit_mode": "dual-channel",
        "audit_round": "169th",
    }, ensure_ascii=False, indent=2)


def format_detail(results, totals):
    """生成详细审计报告，包含每类缺失项 ID 列表"""
    lines = []
    lines.append("=" * 65)
    lines.append("  十亿个什么与为什么 — 数据完整性审计（双通道详细模式）")
    lines.append("=" * 65)
    lines.append("")

    for cat in CATEGORIES:
        s = results[cat]
        if "error" in s:
            lines.append(f"### {cat}: {s['error']}")
            continue
        t = s["total"]
        lines.append(f"### {cat} ({t} 条)")
        lines.append(f"  comfort (text scan): {s['comfort_text']}/{t} ({s['comfort_text']/t*100:.0f}%)")
        lines.append(f"  comfortCategory 字段: {s['comfort_field']}/{t} ({s['comfort_field']/t*100:.0f}%)")
        lines.append(f"  comfort (合并): {s['comfort_combined']}/{t} ({s['comfort_combined']/t*100:.0f}%)")
        if s["missing_comfort"]:
            lines.append(f"    缺失 ({len(s['missing_comfort'])}): {', '.join(s['missing_comfort'])}")
        if s["missing_comfort_category"]:
            lines.append(f"    comfortCategory 字段缺失 ({len(s['missing_comfort_category'])}): {', '.join(s['missing_comfort_category'])}")
        if s["l1_over_50"]:
            lines.append(f"    L1>50字 ({len(s['l1_over_50'])}): {', '.join(s['l1_over_50'])}")
        lines.append(f"  interactionHint: {s['interactionHint']}/{t} ({s['interactionHint']/t*100:.0f}%)")
        if s["missing_hint"]:
            lines.append(f"    缺失 ({len(s['missing_hint'])}): {', '.join(s['missing_hint'])}")
        # 第174轮 P1#12：hint 可操作性检查（动作动词检测）
        if s['interactionHint'] > 0:
            lines.append(f"    hint 可操作性 (含动作动词): {s['hint_action_count']}/{s['interactionHint']} ({s['hint_action_count']/s['interactionHint']*100:.0f}%)")
        lines.append(f"  parentGuide: {s['parentGuide']}/{t} ({s['parentGuide']/t*100:.0f}%)")
        if s["missing_guide"]:
            lines.append(f"    缺失 ({len(s['missing_guide'])}): {', '.join(s['missing_guide'])}")
        lines.append(f"  emotion: {s['emotion']}/{t} ({s['emotion']/t*100:.0f}%)")
        if s["missing_emotion"]:
            lines.append(f"    缺失 ({len(s['missing_emotion'])}): {', '.join(s['missing_emotion'])}")
        lines.append("")

    t = totals["total"]
    lines.append("-" * 55)
    lines.append(f"总计: {t} 条 | comfort (文本): {totals['comfort_text']}/{t} ({totals['comfort_text']/t*100:.0f}%) | "
                 f"comfortCategory 字段: {totals['comfort_field']}/{t} ({totals['comfort_field']/t*100:.0f}%) | "
                 f"comfort (合并): {totals['comfort_combined']}/{t} ({totals['comfort_combined']/t*100:.0f}%)")
    lines.append(f"interactionHint: {totals['interactionHint']}/{t} ({totals['interactionHint']/t*100:.0f}%) | "
                 f"parentGuide: {totals['parentGuide']}/{t} ({totals['parentGuide']/t*100:.0f}%) | "
                 f"emotion: {totals['emotion']}/{t} ({totals['emotion']/t*100:.0f}%)")
    lines.append(f"Comfort 词库: {len(COMFORT_WORDS)} 词")
    lines.append(f"审计时间: {__import__('datetime').datetime.now().isoformat()}")

    return "\n".join(lines)


def format_missing_only(results, totals):
    """仅输出缺失项，按维度分组"""
    lines = []
    lines.append("=" * 65)
    lines.append("  十亿个什么与为什么 — 缺失项审计（--missing 模式）")
    lines.append("=" * 65)
    lines.append("")

    dimensions = [
        ("comfort", "missing_comfort", "Comfort 词缺失"),
        ("comfortCategory", "missing_comfort_category", "comfortCategory 字段缺失"),
        ("interactionHint", "missing_hint", "互动引导缺失"),
        ("parentGuide", "missing_guide", "家长指导缺失"),
        ("emotion", "missing_emotion", "Emotion 字段缺失"),
    ]

    for dim_key, missing_key, label in dimensions:
        all_missing = []
        for cat in CATEGORIES:
            s = results[cat]
            if "error" in s:
                continue
            for item_id in s[missing_key]:
                all_missing.append(f"{cat}/{item_id}")
        if all_missing:
            lines.append(f"### {label} ({len(all_missing)} 条)")
            lines.append(f"  {', '.join(all_missing)}")
            lines.append("")
        else:
            lines.append(f"### {label}: ✅ 全部覆盖")
            lines.append("")

    # L1 字数超限
    all_over = []
    for cat in CATEGORIES:
        s = results[cat]
        if "error" in s:
            continue
        for item in s["l1_over_50"]:
            all_over.append(f"{cat}/{item}")
    if all_over:
        lines.append(f"### L1 字数超限 ({len(all_over)} 条)")
        lines.append(f"  {', '.join(all_over)}")
        lines.append("")
    else:
        lines.append("### L1 字数超限: ✅ 全部 ≤50字")
        lines.append("")

    lines.append(f"审计时间: {__import__('datetime').datetime.now().isoformat()}")
    return "\n".join(lines)


def format_l1chars(results, totals):
    """输出 L1 字数统计"""
    lines = []
    lines.append("=" * 65)
    lines.append("  L1 字数统计（--l1chars 模式）")
    lines.append("=" * 65)
    lines.append("")

    for cat in CATEGORIES:
        s = results[cat]
        if "error" in s:
            continue
        over_50 = s["l1_over_50"]
        if over_50:
            lines.append(f"### {cat}: {len(over_50)} 条超 50 字")
            for item in over_50:
                lines.append(f"  - {item}")
        else:
            lines.append(f"### {cat}: ✅ 全部 ≤50字")
        lines.append("")

    return "\n".join(lines)


def main():
    results, totals = audit_all()

    if "--json" in sys.argv:
        print(format_json(results, totals))
    elif "--markdown" in sys.argv:
        print(format_markdown(results, totals))
    elif "--detail" in sys.argv:
        print(format_detail(results, totals))
    elif "--missing" in sys.argv:
        print(format_missing_only(results, totals))
    elif "--l1chars" in sys.argv:
        print(format_l1chars(results, totals))
    else:
        # 默认终端输出（双通道版）
        print("=" * 65)
        print("  十亿个什么与为什么 — 数据完整性审计（第169轮双通道）")
        print("=" * 65)
        print()

        print(f"{'类别':<10} {'条目':>5} {'comfort(T)':>11} {'comfort(F)':>11} {'comfort(合并)':>13} {'hint':>8} {'guide':>8} {'emotion':>8} {'>50字':>6}")
        print("-" * 85)

        for cat in CATEGORIES:
            s = results[cat]
            if "error" in s:
                print(f"{cat:<10} {'ERR':>5} {s['error']}")
                continue
            t = s["total"]
            over_50 = len(s["l1_over_50"])
            print(
                f"{cat:<10} {t:>5} "
                f"{s['comfort_text']:>3}/{t:<3} {s['comfort_text']/t*100:>4.0f}% "
                f"{s['comfort_field']:>3}/{t:<3} {s['comfort_field']/t*100:>4.0f}% "
                f"{s['comfort_combined']:>3}/{t:<3} {s['comfort_combined']/t*100:>4.0f}% "
                f"{s['interactionHint']:>3}/{t:<3} "
                f"{s['parentGuide']:>3}/{t:<3} "
                f"{s['emotion']:>3}/{t:<3} "
                f"{over_50:>4}"
            )

        t = totals["total"]
        print("-" * 85)
        print(
            f"{'总计':<10} {t:>5} "
            f"{totals['comfort_text']:>3}/{t:<3} {totals['comfort_text']/t*100:>4.0f}% "
            f"{totals['comfort_field']:>3}/{t:<3} {totals['comfort_field']/t*100:>4.0f}% "
            f"{totals['comfort_combined']:>3}/{t:<3} {totals['comfort_combined']/t*100:>4.0f}% "
            f"{totals['interactionHint']:>3}/{t:<3} "
            f"{totals['parentGuide']:>3}/{t:<3} "
            f"{totals['emotion']:>3}/{t:<3} "
            f"{'-':>4}"
        )
        print()
        print(f"Comfort 词库: {len(COMFORT_WORDS)} 词 | 审计模式: 双通道")
        print(f"T=文本扫描 F=字段存在 合并=任一通道满足")
        print(f"审计时间: {__import__('datetime').datetime.now().isoformat()}")


if __name__ == "__main__":
    main()