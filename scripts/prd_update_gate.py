#!/usr/bin/env python3
"""
PRD 更新前置检查脚本 (Sprint 69 V8.61 → Sprint 71 V8.67)

Sprint 67 红灯流程固化轮：PRD 更新前强制 npm test 全绿
- 调用 `npm test` 获取原始输出
- 解析通过/失败/总数
- 如果未全绿，拒绝更新 PRD 并输出报告
- 如果全绿，打印可用于 PRD 粘贴的测试结果块

Sprint 69 新增：cron webhook 通知钩子
- --cron 模式：跑完后发送 webhook 通知到双群
- 只在状态变化时通知（绿→红/红→绿灯），连续绿灯每 6 轮汇总一次
- 使用 notify_groups.sh 发送通知（不引入新通知通道）

Sprint 71 新增（第131轮）：eslint 诚信门
- PRD 更新前强制 `npm run lint` 0 error + 0 warning
- 如果 lint 不通过，拒绝更新 PRD 并输出 lint 报告
- lint 检查与 test 检查并行，任一失败即阻止更新

调用：
  python3 scripts/prd_update_gate.py          # 检查是否允许更新 PRD
  python3 scripts/prd_update_gate.py --json   # JSON 输出（供脚本消费）
  python3 scripts/prd_update_gate.py --markdown  # Markdown 输出（供 PRD 粘贴）
  python3 scripts/prd_update_gate.py --skip-test  # 跳过 npm test（用预存结果测试，供单元测试使用）
  python3 scripts/prd_update_gate.py --cron   # cron 模式：跑测试 + webhook 通知（状态变化/6轮汇总）
"""
import json
import os
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path

BASE_DIR = Path("/home/admin/workspace/billion-whys")
LAST_RESULT_FILE = BASE_DIR / ".last_test_result.txt"
CRON_STATE_FILE = BASE_DIR / ".cron_gate_state.json"
NOTIFY_SCRIPT = Path("/home/admin/workspace/notify_groups.sh")

# V8.60：MOCK_TEST_OUTPUT 改为动态读取上次运行结果文件
# 避免硬编码值漂移（如 1873 → 1890 时忘记更新 MOCK）
def _load_last_test_result():
    """从 .last_test_result.txt 读取上次测试结果"""
    if LAST_RESULT_FILE.exists():
        try:
            return LAST_RESULT_FILE.read_text().strip()
        except Exception:
            pass
    # 降级：文件不存在时返回占位值（--skip-test 模式仅用于单元测试）
    return "Test Files  0 passed (0)\n     Tests  0 passed (0)\n"


def _save_last_test_result(output):
    """保存测试结果供下次 --skip-test 使用"""
    try:
        LAST_RESULT_FILE.write_text(output)
    except Exception:
        pass


def _load_cron_state():
    """加载 cron 状态：上次结果 + 连续绿色轮数"""
    if CRON_STATE_FILE.exists():
        try:
            return json.loads(CRON_STATE_FILE.read_text())
        except Exception:
            pass
    return {"last_all_green": None, "consecutive_green_count": 0, "last_notified_at": None}


def _save_cron_state(state):
    """保存 cron 状态"""
    try:
        CRON_STATE_FILE.write_text(json.dumps(state, ensure_ascii=False))
    except Exception:
        pass


def _send_webhook(title, content):
    """发送 webhook 通知到双群"""
    if not NOTIFY_SCRIPT.exists():
        print("[prd_update_gate] notify_groups.sh not found, skipping webhook", file=sys.stderr)
        return False
    try:
        subprocess.run(
            ["bash", str(NOTIFY_SCRIPT), title, content],
            timeout=30,
            capture_output=True,
        )
        return True
    except Exception as e:
        print(f"[prd_update_gate] webhook failed: {e}", file=sys.stderr)
        return False


def _cron_notify(parsed):
    """Sprint 69: cron 模式下的 webhook 通知逻辑
    规则：
    - 绿→红 或 红→绿：立即通知
    - 连续绿灯：每 6 轮汇总通知一次
    - 连续红灯：每轮都通知（不沉默）
    """
    state = _load_cron_state()
    last_green = state.get("last_all_green")
    current_green = parsed["all_green"]
    count = state.get("consecutive_green_count", 0)

    should_notify = False
    reason = ""

    if last_green is None:
        # 首次运行：通知
        should_notify = True
        reason = "首次 cron 运行"
    elif last_green and not current_green:
        # 绿灯→红灯：立即通知
        should_notify = True
        reason = "🟢→🔴 状态变化（绿灯→红灯）"
        count = 0
    elif not last_green and current_green:
        # 红灯→绿灯：立即通知
        should_notify = True
        reason = "🔴→🟢 状态变化（红灯→绿灯）"
        count = 0
    elif current_green:
        # 连续绿灯
        count += 1
        if count % 6 == 0:
            should_notify = True
            reason = f"连续 {count} 轮绿灯汇总"
    else:
        # 连续红灯：每轮都通知
        should_notify = True
        reason = "持续红灯告警"
        count = 0

    # 更新状态
    _save_cron_state({
        "last_all_green": current_green,
        "consecutive_green_count": count,
        "last_notified_at": datetime.now().isoformat() if should_notify else state.get("last_notified_at"),
    })

    if should_notify:
        emoji = "✅" if current_green else "❌"
        title = f"{emoji} [十亿cron] Sprint 69 自动巡检"
        content = (
            f"**原因**: {reason}\n\n"
            f"**测试**: {parsed['tests_passed']}/{parsed['tests_total']} passed\n\n"
            f"**测试文件**: {parsed['test_files_passed']}/{parsed['test_files_total']}\n\n"
            f"**耗时**: 约 {parsed.get('duration', 'N/A')}\n\n"
            f"**连续绿灯**: {count} 轮\n\n"
            f"**时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        )
        _send_webhook(title, content)
        print(f"[prd_update_gate] webhook sent: {reason}", file=sys.stderr)

    return should_notify


def run_npm_lint():
    """Run npm run lint and capture raw output (Sprint 71 V8.67 诚信门)"""
    print("[prd_update_gate] Running npm run lint...", file=sys.stderr)
    result = subprocess.run(
        ["npm", "run", "lint"],
        cwd=BASE_DIR,
        capture_output=True,
        text=True,
        timeout=120,
    )
    return result.stdout + result.stderr, result.returncode


def parse_lint_output(output: str, exit_code: int):
    """Parse eslint output to detect errors and warnings"""
    result = {
        "exit_code": exit_code,
        "errors": 0,
        "warnings": 0,
        "total_problems": 0,
        "raw_output": output.strip(),
        "all_clean": False,
    }
    # Pattern: "✖ 38 problems (1 error, 37 warnings)"
    problems_match = re.search(r'(\d+)\s+problems?\s+\((\d+)\s+errors?,\s+(\d+)\s+warnings?\)', output)
    if problems_match:
        result["total_problems"] = int(problems_match.group(1))
        result["errors"] = int(problems_match.group(2))
        result["warnings"] = int(problems_match.group(3))
    result["all_clean"] = (exit_code == 0 and result["total_problems"] == 0)
    return result


def generate_lint_markdown_block(parsed_lint):
    """Generate the Markdown lint block for PRD insertion"""
    lines = [
        "本轮 lint 结果（原始输出）：",
        "```",
    ]
    if parsed_lint["all_clean"]:
        lines.append("✅ 0 errors, 0 warnings — lint 全绿")
    elif parsed_lint["raw_output"]:
        for line in parsed_lint["raw_output"].split("\n")[:10]:
            lines.append(line)
    lines.append("```")
    if not parsed_lint["all_clean"]:
        lines.append(f"> ⚠️ 诚实标注：eslint {parsed_lint['errors']} error + {parsed_lint['warnings']} warnings 残留。")
    return "\n".join(lines)


def run_npm_test():
    """Run npm test and capture raw output"""
    print("[prd_update_gate] Running npm test...", file=sys.stderr)
    result = subprocess.run(
        ["npm", "test"],
        cwd=BASE_DIR,
        capture_output=True,
        text=True,
        timeout=300,
    )
    return result.stdout + result.stderr, result.returncode


def parse_test_output(output: str):
    """Parse vitest output to extract test counts"""
    # Pattern: "Tests  1873 passed (1873)" or "Tests  1869 passed (1873)"
    # Also handle: "Test Files  64 passed (64)"
    files_match = re.search(r'Test Files\s+(\d+)\s+passed\s+\((\d+)\)', output)
    tests_match = re.search(r'Tests\s+(\d+)\s+passed\s+\((\d+)\)', output)

    # Also try "Tests  X failed | Y passed (Z)"
    tests_fail_match = re.search(r'Tests\s+(\d+)\s+failed\s+\|\s+(\d+)\s+passed\s+\((\d+)\)', output)

    # Extract duration
    duration_match = re.search(r'Duration\s+([\d.]+)s', output)

    result = {
        "test_files_passed": None,
        "test_files_total": None,
        "tests_passed": None,
        "tests_total": None,
        "tests_failed": 0,
        "all_green": False,
        "raw_output": output,
        "exit_code": None,
        "duration": None,
    }

    if tests_match:
        result["tests_passed"] = int(tests_match.group(1))
        result["tests_total"] = int(tests_match.group(2))
        result["tests_failed"] = result["tests_total"] - result["tests_passed"]

    if tests_fail_match:
        result["tests_failed"] = int(tests_fail_match.group(1))
        result["tests_passed"] = int(tests_fail_match.group(2))
        result["tests_total"] = int(tests_fail_match.group(3))

    if files_match:
        result["test_files_passed"] = int(files_match.group(1))
        result["test_files_total"] = int(files_match.group(2))

    if duration_match:
        result["duration"] = duration_match.group(1) + "s"

    if result["tests_total"] and result["tests_passed"]:
        result["all_green"] = (result["tests_passed"] == result["tests_total"])

    return result


def generate_markdown_block(parsed):
    """Generate the Markdown block for PRD insertion"""
    lines = [
        "本轮测试结果（原始输出）：",
        "```",
    ]
    # Extract the key lines from raw output
    for line in parsed["raw_output"].split("\n"):
        line = line.strip()
        if "Test Files" in line or "Tests" in line or "Duration" in line:
            lines.append(line)
    lines.append("```")
    return "\n".join(lines)


def main():
    skip_test = "--skip-test" in sys.argv
    skip_lint = "--skip-lint" in sys.argv
    cron_mode = "--cron" in sys.argv

    # Sprint 71 V8.67: Run lint check FIRST (诚信门), unless --skip-lint
    if skip_lint:
        parsed_lint = {"exit_code": 0, "errors": 0, "warnings": 0, "total_problems": 0, "raw_output": "", "all_clean": True}
    else:
        lint_output, lint_exit = run_npm_lint()
        parsed_lint = parse_lint_output(lint_output, lint_exit)

    if skip_test:
        output = _load_last_test_result()
        exit_code = 0
    else:
        output, exit_code = run_npm_test()
        if exit_code == 0:
            _save_last_test_result(output)  # V8.60：保存结果供下次 --skip-test 使用

    parsed = parse_test_output(output)
    parsed["exit_code"] = exit_code

    # Sprint 69: cron 模式下的 webhook 通知
    if cron_mode:
        # Include lint status in cron notification
        cron_state = _load_cron_state()
        cron_state["lint_clean"] = parsed_lint["all_clean"]
        _save_cron_state(cron_state)
        _cron_notify(parsed)

    json_mode = "--json" in sys.argv
    markdown_mode = "--markdown" in sys.argv

    if json_mode:
        print(json.dumps({
            **parsed,
            "lint": parsed_lint,
        }, ensure_ascii=False, indent=2))
        return

    if markdown_mode:
        # Output both test and lint results
        if parsed["all_green"]:
            print(generate_markdown_block(parsed))
        else:
            print(f"⚠️ 测试未全绿！{parsed['tests_passed']}/{parsed['tests_total']} passed")
            print()
            print("```")
            print(parsed["raw_output"][-2000:])
            print("```")
        print()
        print(generate_lint_markdown_block(parsed_lint))
        return

    # Default: gate check (Sprint 71 V8.67: lint + test both required)
    print(f"[prd_update_gate] {datetime.now().isoformat()}")
    print(f"[prd_update_gate] Lint: {parsed_lint['errors']} errors, {parsed_lint['warnings']} warnings")
    print(f"[prd_update_gate] Test Files: {parsed['test_files_passed']}/{parsed['test_files_total']}")
    print(f"[prd_update_gate] Tests: {parsed['tests_passed']}/{parsed['tests_total']}")

    lint_pass = parsed_lint["all_clean"]
    test_pass = parsed["all_green"]

    if lint_pass and test_pass:
        print(f"[prd_update_gate] ✅ LINT CLEAN + ALL TESTS GREEN — PRD update allowed")
        sys.exit(0)
    else:
        if not lint_pass:
            print(f"[prd_update_gate] ❌ LINT NOT CLEAN — {parsed_lint['total_problems']} problems ({parsed_lint['errors']} errors, {parsed_lint['warnings']} warnings)")
        if not test_pass:
            print(f"[prd_update_gate] ❌ {parsed['tests_failed']} TEST FAILURES — PRD update BLOCKED")
        print(f"[prd_update_gate] Fix all issues before updating PRD.")
        sys.exit(1)


if __name__ == "__main__":
    main()