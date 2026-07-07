#!/usr/bin/env python3
"""
已知问题跟踪器 (Sprint 67 V8.59)

Sprint 67 红灯流程固化轮：建立"已知问题"区块
- 扫描 bugs.jsonl 中未修复的问题（fixed_at is null）
- 按优先级 P0/P1/P2 分组
- 生成 Markdown 报告（供 PRD 粘贴）
- 支持 --json 输出（供脚本消费）

调用：
  python3 scripts/known_issues.py              # 生成 Markdown 报告
  python3 scripts/known_issues.py --json       # JSON 输出
  python3 scripts/known_issues.py --count      # 仅输出计数
"""
import json
import sys
from datetime import datetime
from pathlib import Path

BASE_DIR = Path("/home/admin/workspace/billion-whys")
BUGS_FILE = BASE_DIR / "docs" / "bug-database" / "bugs.jsonl"


def load_bugs():
    """Load all bugs from JSONL"""
    bugs = []
    if not BUGS_FILE.exists():
        return bugs
    with open(BUGS_FILE) as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    bugs.append(json.loads(line))
                except json.JSONDecodeError:
                    pass
    return bugs


def get_open_bugs(bugs):
    """Return only open (unfixed) bugs"""
    return [b for b in bugs if b.get("fixed_at") is None]


def get_closed_bugs(bugs):
    """Return only fixed bugs"""
    return [b for b in bugs if b.get("fixed_at") is not None]


def group_by_severity(bugs):
    """Group bugs by severity"""
    groups = {"P0": [], "P1": [], "P2": [], "other": []}
    for b in bugs:
        sev = b.get("severity", "P2")
        groups.setdefault(sev, []).append(b)
    return groups


def generate_markdown(open_bugs, closed_bugs):
    """Generate Markdown known issues report"""
    lines = [
        "## 已知问题（Known Issues）",
        "",
        f"_最后更新：{datetime.now().strftime('%Y-%m-%d %H:%M')}_",
        f"_开放问题：{len(open_bugs)} 个 | 已修复累计：{len(closed_bugs)} 个_",
        "",
    ]

    if not open_bugs:
        lines.append("✅ 当前无已知未修复问题。")
        lines.append("")
        return "\n".join(lines)

    grouped = group_by_severity(open_bugs)

    for sev in ["P0", "P1", "P2"]:
        bugs = grouped.get(sev, [])
        if not bugs:
            continue
        lines.append(f"### {sev} ({len(bugs)} 个)")
        lines.append("")
        for b in bugs:
            lines.append(f"#### {b['id']}: {b['title']}")
            lines.append(f"- **严重程度**: {sev}")
            lines.append(f"- **分类**: {b.get('category', 'N/A')}")
            lines.append(f"- **发现时间**: {b.get('discovered_at', 'N/A')}")
            lines.append(f"- **根因**: {b.get('root_cause', 'N/A')}")
            lines.append(f"- **修复方案**: {b.get('fix', 'N/A')}")
            lines.append(f"- **检测方式**: {b.get('detection', 'N/A')}")
            lines.append(f"- **预防措施**: {b.get('prevention', 'N/A')}")
            lines.append("")

    return "\n".join(lines)


def main():
    bugs = load_bugs()
    open_bugs = get_open_bugs(bugs)
    closed_bugs = get_closed_bugs(bugs)

    if "--count" in sys.argv:
        print(json.dumps({
            "open": len(open_bugs),
            "closed": len(closed_bugs),
            "total": len(bugs),
            "by_severity": {
                sev: len(bugs) for sev, bugs in group_by_severity(open_bugs).items() if bugs
            }
        }, ensure_ascii=False, indent=2))
        return

    if "--json" in sys.argv:
        print(json.dumps({
            "open": open_bugs,
            "closed_count": len(closed_bugs),
        }, ensure_ascii=False, indent=2))
        return

    print(generate_markdown(open_bugs, closed_bugs))


if __name__ == "__main__":
    main()