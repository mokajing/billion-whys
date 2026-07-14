#!/usr/bin/env python3
"""
scan-home-safety.py —— 独立 home 类安全词扫描脚本（R184-005）
安全李姐一票否决，第184轮新建

扫描 home.json 中所有 hint/guide 字段，检测是否包含 HOME_SAFETY_WORDS 禁止词。
输出人工审查报告，供王园长/安全李姐/法务张律人工复审。

Usage:
    python3 scripts/scan-home-safety.py
    python3 scripts/scan-home-safety.py --json  # JSON 输出格式
"""

import json
import sys
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).parent.parent
HOME_JSON = ROOT / "content" / "seed-library" / "home.json"
CONSTANTS_JSON = ROOT / "content" / "constants.json"

# HOME_SAFETY_WORDS 禁止词（与 constants.json 同步）
HOME_SAFETY_FORBIDDEN = [
    "煤气灶", "煤气灶附近", "插座孔", "玩刀", "剪刀尖",
    "药瓶", "清洁剂", "高处", "爬窗台", "手指伸进",
    "通电", "打开煤气", "煤气"
]

# 电器相关词——出现时需标注"家长全程陪同"
ELECTRICAL_WORDS = [
    "电饭煲", "冰箱", "洗衣机", "微波炉", "电风扇", "电磁炉",
    "烤箱", "空调", "热水器", "电暖器", "电视", "电脑",
    "吹风机", "电熨斗", "榨汁机", "搅拌机", "取暖器"
]

# 水相关词——出现时需检查安全提示
WATER_WORDS = [
    "水龙头", "堵住", "水压", "水花", "飞溅", "喷水", "泼水"
]

# 火相关词——出现时需检查安全提示
FIRE_WORDS = [
    "火", "火焰", "火柴", "打火机", "蜡烛", "点燃", "燃烧"
]


def load_home_data():
    """加载 home.json 数据"""
    with open(HOME_JSON, 'r', encoding='utf-8') as f:
        data = json.load(f)
    entries = data.get('entries', data) if isinstance(data, dict) else data
    return entries


def scan_entry(entry):
    """扫描单条 entry 的安全问题"""
    eid = entry.get('id', 'unknown')
    question = entry.get('question', '')
    safety_level = entry.get('safetyLevel', 'A')

    # 收集所有文本字段
    hint = (entry.get('layer1', {}) or {}).get('interactionHint', '') or ''
    guide = entry.get('parentGuide', '') or ''
    combined = f"{hint} {guide}"

    violations = []

    # 1. 禁止词扫描
    for word in HOME_SAFETY_FORBIDDEN:
        if word in combined:
            violations.append({
                'type': 'FORBIDDEN',
                'severity': 'ERROR',
                'word': word,
                'message': f'包含禁止词"{word}"'
            })

    # 2. 电器词扫描（需标注"家长全程陪同"）
    for word in ELECTRICAL_WORDS:
        if word in combined:
            if "家长全程陪同" not in combined and "家长陪同" not in combined:
                violations.append({
                    'type': 'ELECTRICAL_NO_WARNING',
                    'severity': 'WARNING',
                    'word': word,
                    'message': f'涉及电器"{word}"但未标注"家长全程陪同"'
                })

    # 3. 水相关安全扫描
    for word in WATER_WORDS:
        if word in combined:
            if "安全" not in combined and "小心" not in combined:
                violations.append({
                    'type': 'WATER_NO_SAFETY',
                    'severity': 'WARNING',
                    'word': word,
                    'message': f'涉及水操作"{word}"但未包含安全提示'
                })

    # 4. 火相关安全扫描
    for word in FIRE_WORDS:
        if word in combined:
            if "家长全程陪同" not in combined and "安全" not in combined:
                violations.append({
                    'type': 'FIRE_NO_SAFETY',
                    'severity': 'ERROR',
                    'word': word,
                    'message': f'涉及火/热源"{word}"但未包含安全提示或家长陪同说明'
                })

    return {
        'id': eid,
        'question': question,
        'safetyLevel': safety_level,
        'hint': hint[:80] if hint else '(empty)',
        'guide': guide[:80] if guide else '(empty)',
        'violations': violations
    }


def main():
    json_output = '--json' in sys.argv

    entries = load_home_data()

    results = []
    error_count = 0
    warning_count = 0
    entries_with_issues = 0

    for entry in entries:
        result = scan_entry(entry)
        results.append(result)
        if result['violations']:
            entries_with_issues += 1
            for v in result['violations']:
                if v['severity'] == 'ERROR':
                    error_count += 1
                else:
                    warning_count += 1

    if json_output:
        output = {
            'summary': {
                'total_entries': len(entries),
                'entries_with_issues': entries_with_issues,
                'error_count': error_count,
                'warning_count': warning_count,
                'home_safety_forbidden': HOME_SAFETY_FORBIDDEN,
                'electrical_words': ELECTRICAL_WORDS
            },
            'results': [r for r in results if r['violations']]
        }
        print(json.dumps(output, ensure_ascii=False, indent=2))
    else:
        print(f"\n{'='*60}")
        print(f"🏠 Home Safety Scan Report")
        print(f"{'='*60}")
        print(f"Total entries: {len(entries)}")
        print(f"Entries with issues: {entries_with_issues}")
        print(f"ERRORs: {error_count} | WARNINGs: {warning_count}")
        print(f"{'='*60}\n")

        if entries_with_issues == 0:
            print("✅ No safety issues found. All home entries pass safety check.")
            return 0

        for r in results:
            if not r['violations']:
                continue
            print(f"\n📋 {r['id']}: {r['question']}")
            print(f"   Safety Level: {r['safetyLevel']}")
            print(f"   Hint: {r['hint']}")
            print(f"   Guide: {r['guide']}")
            for v in r['violations']:
                icon = '🔴' if v['severity'] == 'ERROR' else '🟡'
                print(f"   {icon} [{v['severity']}] {v['message']}")

        print(f"\n{'='*60}")
        print(f"📊 Summary: {error_count} ERRORs, {warning_count} WARNINGs")
        print(f"   ERRORs must be fixed before build.")
        print(f"   WARNINGs require human review (王园长/安全李姐/法务张律).")
        print(f"{'='*60}\n")

        # Exit code 1 if any ERRORs
        return 1 if error_count > 0 else 0


if __name__ == '__main__':
    sys.exit(main())