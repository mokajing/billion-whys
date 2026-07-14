#!/usr/bin/env python3
"""
十亿项目每日站会脚本（第173轮 P1#11）
林实干+陈架构——自动检查项目行动清单完成率

用法：
  python3 scripts/daily-standup.py          # 终端输出
  python3 scripts/daily-standup.py --json   # JSON 格式输出（CI 集成）
  python3 scripts/daily-standup.py --strict # 有 P0 未完成项时 exit 1
"""

import json
import sys
import subprocess
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# 当前轮次行动清单（从 issue-tracker.json 读取）
def load_issues():
    tracker_path = BASE_DIR / "issue-tracker.json"
    if not tracker_path.exists():
        return {"error": "issue-tracker.json 不存在"}
    with open(tracker_path) as f:
        return json.load(f)


def run_audit():
    """运行数据审计"""
    result = subprocess.run(
        ["python3", str(BASE_DIR / "scripts" / "audit-data.py")],
        capture_output=True, text=True
    )
    return result.stdout


def run_food_safety():
    """运行 food 安全词扫描"""
    result = subprocess.run(
        ["python3", str(BASE_DIR / "scripts" / "check-food-safety.py")],
        capture_output=True, text=True
    )
    return result.stdout


def run_tests():
    """运行测试套件"""
    result = subprocess.run(
        ["npx", "vitest", "run", "--reporter=verbose"],
        capture_output=True, text=True, cwd=str(BASE_DIR)
    )
    return result.stdout, result.returncode


def run_build():
    """运行 mp-data build"""
    result = subprocess.run(
        ["node", str(BASE_DIR / "scripts" / "build-mp-data.cjs")],
        capture_output=True, text=True, cwd=str(BASE_DIR)
    )
    return result.stdout, result.returncode


def render_standup(data, audit_output, food_safety_output, test_ok, build_ok):
    issues = data.get("issues", [])
    downgraded = data.get("downgraded", [])
    round_num = data.get("round", "?")

    now = datetime.now().strftime("%Y-%m-%d %H:%M")

    lines = []
    lines.append("=" * 65)
    lines.append(f"  十亿项目每日站会 — {now}")
    lines.append(f"  当前轮次: {round_num} | 版本: {data.get('version', '?')}")
    lines.append("=" * 65)

    # P0 状态
    p0_issues = [i for i in issues if i["priority"] == "P0"]
    p0_done = [i for i in p0_issues if i["status"] == "completed"]
    p0_in_progress = [i for i in p0_issues if i["status"] == "in_progress"]
    p0_pending = [i for i in p0_issues if i["status"] == "pending"]

    lines.append(f"\n📊 P0 行动项: {len(p0_done)}/{len(p0_issues)} 完成")
    if p0_pending:
        lines.append(f"   ⚠️  待启动: {len(p0_pending)} 项")
        for i in p0_pending:
            lines.append(f"      - [{i['id']}] {i['title']} → {i.get('owner', '?')}")
    if p0_in_progress:
        lines.append(f"   🔄 进行中: {len(p0_in_progress)} 项")
        for i in p0_in_progress:
            lines.append(f"      - [{i['id']}] {i['title']} → {i.get('owner', '?')}")

    # P1 状态
    p1_issues = [i for i in issues if i["priority"] == "P1"]
    p1_done = [i for i in p1_issues if i["status"] == "completed"]
    lines.append(f"\n📋 P1 行动项: {len(p1_done)}/{len(p1_issues)} 完成")

    # 降级项
    if downgraded:
        lines.append(f"\n📦 降级项（P2 池）: {len(downgraded)} 项")
        for d in downgraded:
            lines.append(f"   - [{d['id']}] {d['title']} ({d.get('note', '')})")

    # 构建状态
    lines.append(f"\n🔨 构建状态:")
    lines.append(f"   mp-data build: {'✅ 通过' if build_ok else '❌ 失败'}")
    lines.append(f"   测试套件: {'✅ 通过' if test_ok else '❌ 失败'}")

    # 数据审计摘要
    lines.append(f"\n📈 数据审计: 已运行")
    lines.append(f"   food 安全扫描: 已运行")

    # 完成率
    total = len(issues)
    done = len([i for i in issues if i["status"] == "completed"])
    rate = f"{done}/{total} ({done/total*100:.0f}%)" if total > 0 else "N/A"
    lines.append(f"\n🎯 本轮完成率: {rate}")

    p0_rate = f"{len(p0_done)}/{len(p0_issues)} ({len(p0_done)/len(p0_issues)*100:.0f}%)" if p0_issues else "N/A"
    lines.append(f"   P0 完成率: {p0_rate}")

    if p0_pending:
        lines.append(f"\n🚨 警告: {len(p0_pending)} 项 P0 未启动！")

    lines.append("=" * 65)

    return "\n".join(lines)


def main():
    strict = "--strict" in sys.argv
    json_mode = "--json" in sys.argv

    data = load_issues()
    if "error" in data:
        print(f"❌ {data['error']}")
        sys.exit(1)

    # 运行审计（不阻塞站会）
    audit_output = ""
    try:
        audit_output = run_audit()
    except Exception:
        audit_output = "审计脚本运行失败"

    # 运行 food 安全扫描
    food_safety_output = ""
    try:
        food_safety_output = run_food_safety()
    except Exception:
        food_safety_output = "安全扫描失败"

    # 运行测试
    test_output, test_rc = "", 0
    try:
        test_output, test_rc = run_tests()
    except Exception:
        test_rc = 1

    # 运行 build
    build_output, build_rc = "", 0
    try:
        build_output, build_rc = run_build()
    except Exception:
        build_rc = 1

    test_ok = test_rc == 0
    build_ok = build_rc == 0

    if json_mode:
        result = {
            "timestamp": datetime.now().isoformat(),
            "issues": data.get("issues", []),
            "test_ok": test_ok,
            "build_ok": build_ok,
            "p0_pending": len([i for i in data.get("issues", []) if i["priority"] == "P0" and i["status"] == "pending"]),
        }
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(render_standup(data, audit_output, food_safety_output, test_ok, build_ok))

    if strict:
        p0_pending = [i for i in data.get("issues", []) if i["priority"] == "P0" and i["status"] == "pending"]
        if p0_pending or not test_ok or not build_ok:
            sys.exit(1)


if __name__ == "__main__":
    main()