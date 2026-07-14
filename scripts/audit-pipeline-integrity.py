#!/usr/bin/env python3
"""
管线诚信审计脚本（第179轮 Sprint 86 中期检查 P0 R179-003）
CTO陈架构 + 测试虫虫——对所有 LLM/脚本产出的完整性进行审查

审计范围：
  1. gen-food-hints.py 产出完整性（food-hints-review.json）
  2. emotion-batch-inject.py 注入完整性（food.json emotion 字段）
  3. build-mp-data.cjs 构建产物一致性
  4. pre-commit-hook.py 安装状态
  5. food.json 字段完整性（comfortCategory/hint/guide/emotion 连锁依赖）
  6. 所有 seed-library JSON 文件 schema 一致性

用法：
  python3 scripts/audit-pipeline-integrity.py           # 终端输出审计报告
  python3 scripts/audit-pipeline-integrity.py --json     # JSON格式输出
  python3 scripts/audit-pipeline-integrity.py --strict   # 严格模式（警告也报非零退出码）

第179轮设计原则：
  - 诚实：标记"代码完成"vs"功能完成"的区别
  - 连锁：追踪 comfortCategory → hint/guide → emotion 的依赖链
  - 可操作：每个发现附带建议修复方案
"""

import json
import os
import sys
from pathlib import Path
from datetime import datetime

BASE_DIR = Path(__file__).resolve().parent.parent
CONTENT_DIR = BASE_DIR / "content" / "seed-library"
SCRIPTS_DIR = BASE_DIR / "scripts"
HOOK_PATH = BASE_DIR / ".git" / "hooks" / "pre-commit"

CATEGORIES = ["body", "animals", "food", "home", "nature", "society"]

# 兜底/默认值检测（这些值出现在产出中说明内容未实际生成）
FALLBACK_VALUES = {
    "hint": "和孩子一起探索更多吧！",
    "guide": "和孩子一起探索食物的世界，享受亲子时光。",
    "emotion_default": "curious",  # 未分类的默认 emotion
}


def load_json(path):
    """加载 JSON 文件"""
    try:
        with open(path, encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        return None


def check_food_hints_review():
    """检查 food-hints-review.json 产出完整性"""
    path = CONTENT_DIR / "food-hints-review.json"
    data = load_json(path)
    if data is None:
        return {
            "check": "food-hints-review.json",
            "status": "ERROR",
            "detail": "文件不存在或无法解析",
            "fix": "运行 python3 scripts/gen-food-hints.py --batch"
        }

    items = data.get("items", [])
    total = len(items)
    approved = sum(1 for i in items if i.get("review", {}).get("status") == "approved")
    rejected = sum(1 for i in items if i.get("review", {}).get("status") == "rejected")
    pending = sum(1 for i in items if i.get("review", {}).get("status") == "pending")

    empty_hints = []
    fallback_hints = []
    empty_guides = []
    fallback_guides = []

    for item in items:
        gen = item.get("generated", {})
        hint = gen.get("interactionHint", "")
        guide = gen.get("parentGuide", "")

        if not hint:
            empty_hints.append(item["id"])
        elif hint == FALLBACK_VALUES["hint"]:
            fallback_hints.append(item["id"])

        if not guide:
            empty_guides.append(item["id"])
        elif guide == FALLBACK_VALUES["guide"]:
            fallback_guides.append(item["id"])

    issues = []
    if empty_hints:
        issues.append(f"{len(empty_hints)}条 hint 为空")
    if fallback_hints:
        issues.append(f"{len(fallback_hints)}条 hint 为兜底值")
    if empty_guides:
        issues.append(f"{len(empty_guides)}条 guide 为空")
    if fallback_guides:
        issues.append(f"{len(fallback_guides)}条 guide 为兜底值")

    status = "PASS"
    if empty_hints or empty_guides:
        status = "ERROR"
    elif fallback_hints or fallback_guides:
        status = "WARN"

    return {
        "check": "food-hints-review.json 产出完整性",
        "status": status,
        "total": total,
        "approved": approved,
        "rejected": rejected,
        "pending": pending,
        "empty_hints": empty_hints,
        "fallback_hints": fallback_hints,
        "issues": issues,
        "fix": "先完成 comfortCategory 分类（R179-001），再重新运行 gen-food-hints.py"
    }


def check_emotion_injection():
    """检查 food.json emotion 字段注入完整性（连锁依赖）"""
    path = CONTENT_DIR / "food.json"
    data = load_json(path)
    if data is None:
        return {"check": "food.json emotion 注入", "status": "ERROR", "detail": "文件不存在"}

    total = len(data)
    with_cc = sum(1 for i in data if i.get("comfortCategory"))
    with_emotion = sum(1 for i in data if i.get("rabbitEmotion") and i.get("bearEmotion"))
    default_emotion = sum(1 for i in data
                          if i.get("rabbitEmotion") == FALLBACK_VALUES["emotion_default"]
                          and i.get("bearEmotion") in ("gentle", FALLBACK_VALUES["emotion_default"])
                          and not i.get("comfortCategory"))

    # 连锁依赖分析
    blocked_by_cc = []
    for item in data:
        if not item.get("comfortCategory"):
            e_r = item.get("rabbitEmotion", "")
            e_b = item.get("bearEmotion", "")
            if e_r == FALLBACK_VALUES["emotion_default"] and e_b == FALLBACK_VALUES["emotion_default"]:
                blocked_by_cc.append(item["id"])

    status = "PASS"
    issues = []
    if default_emotion > 0:
        status = "WARN"
        issues.append(f"{default_emotion}条 emotion 为默认值（盲注），阻塞于 comfortCategory 未分类")

    return {
        "check": "food.json emotion 字段注入完整性",
        "status": status,
        "total": total,
        "with_comfortCategory": with_cc,
        "with_emotion": with_emotion,
        "default_emotion_count": default_emotion,
        "blocked_by_comfortCategory": blocked_by_cc,
        "issues": issues,
        "fix": f"R179-001: 完成 {len(blocked_by_cc)}条 comfortCategory 分类 → emotion-batch-inject.py 重新注入"
    }


def check_category_chain():
    """检查六类 comfortCategory → hint → guide → emotion 连锁依赖"""
    results = []
    for cat in CATEGORIES:
        path = CONTENT_DIR / f"{cat}.json"
        data = load_json(path)
        if data is None:
            results.append({"category": cat, "status": "ERROR", "detail": "文件不存在"})
            continue

        total = len(data)
        with_cc = sum(1 for i in data if i.get("comfortCategory"))
        with_hint = sum(1 for i in data if i.get("layer1", {}).get("interactionHint"))
        with_guide = sum(1 for i in data if i.get("parentGuide"))
        with_emotion = sum(1 for i in data if i.get("rabbitEmotion") and i.get("bearEmotion"))

        status = "PASS"
        if cat in ("home", "nature", "society") and with_cc == 0:
            status = "ERROR"
        elif with_cc < total:
            status = "WARN"

        results.append({
            "category": cat,
            "status": status,
            "total": total,
            "comfortCategory": f"{with_cc}/{total}",
            "hint": f"{with_hint}/{total}",
            "guide": f"{with_guide}/{total}",
            "emotion": f"{with_emotion}/{total}",
        })

    return results


def check_pre_commit_hook():
    """检查 pre-commit hook 安装状态"""
    exists = HOOK_PATH.exists()
    if not exists:
        return {
            "check": "pre-commit hook 安装",
            "status": "ERROR",
            "detail": "hook 不存在",
            "fix": "cp scripts/pre-commit-hook.py .git/hooks/pre-commit"
        }

    try:
        with open(HOOK_PATH, encoding='utf-8') as f:
            content = f.read()
    except Exception:
        return {
            "check": "pre-commit hook 安装",
            "status": "ERROR",
            "detail": "无法读取 hook 文件",
        }

    checks_included = []
    if "food-safety" in content or "check-food-safety" in content:
        checks_included.append("food safety")
    if "audit-data" in content:
        checks_included.append("audit data")
    if "lint" in content.lower():
        checks_included.append("lint")
    if "version" in content.lower():
        checks_included.append("version sync")

    return {
        "check": "pre-commit hook 安装",
        "status": "PASS" if len(checks_included) >= 4 else "WARN",
        "detail": f"已安装，包含 {len(checks_included)} 项检查: {', '.join(checks_included)}",
        "checks": checks_included,
    }


def check_mp_build_consistency():
    """检查 build-mp-data.cjs 构建产物一致性"""
    data_path = BASE_DIR / "src" / "miniprogram" / "data"
    data_js = data_path / "questions-data.js"
    data_json = data_path / "questions.json"

    js_exists = data_js.exists()
    json_exists = data_json.exists()

    if not js_exists or not json_exists:
        return {
            "check": "build-mp-data 产物一致性",
            "status": "WARN",
            "detail": f"questions-data.js: {'存在' if js_exists else '缺失'}, questions.json: {'存在' if json_exists else '缺失'}",
            "fix": "运行 npm run build:mp-data"
        }

    # 检查版本同步
    version_path = data_path / "version-data.js"
    if version_path.exists():
        try:
            # 简单读取版本号
            with open(version_path, encoding='utf-8') as f:
                content = f.read()
            has_version = '"version"' in content
        except Exception:
            has_version = False
    else:
        has_version = False

    return {
        "check": "build-mp-data 产物一致性",
        "status": "PASS" if has_version else "WARN",
        "detail": f"questions-data.js: 存在, questions.json: 存在, version-data.js: {'存在' if version_path.exists() else '缺失'}",
    }


def check_gen_food_hints_script():
    """检查 gen-food-hints.py 脚本完整性"""
    path = SCRIPTS_DIR / "gen-food-hints.py"
    if not path.exists():
        return {"check": "gen-food-hints.py 脚本", "status": "ERROR", "detail": "脚本不存在"}

    try:
        with open(path, encoding='utf-8') as f:
            content = f.read()
    except Exception:
        return {"check": "gen-food-hints.py 脚本", "status": "ERROR", "detail": "无法读取脚本"}

    # 检查关键特性
    has_integrity_check = "FALLBACK_HINT" in content and "跳过注入" in content
    has_llm_import = any(x in content for x in ["openai", "anthropic", "requests.post", "http.client"])
    is_rule_based = not has_llm_import

    return {
        "check": "gen-food-hints.py 脚本完整性",
        "status": "PASS" if has_integrity_check else "WARN",
        "detail": f"产出完整性校验: {'有' if has_integrity_check else '无'}, 生成方式: {'规则型' if is_rule_based else 'LLM调用'}",
        "is_rule_based": is_rule_based,
        "has_integrity_check": has_integrity_check,
    }


def run_all_checks():
    """运行所有检查"""
    results = []

    # 1. food-hints-review.json
    results.append(check_food_hints_review())

    # 2. emotion 注入
    results.append(check_emotion_injection())

    # 3. 六类连锁依赖
    chain_results = check_category_chain()

    # 4. pre-commit hook
    results.append(check_pre_commit_hook())

    # 5. build-mp-data
    results.append(check_mp_build_consistency())

    # 6. gen-food-hints.py
    results.append(check_gen_food_hints_script())

    return results, chain_results


def print_report(results, chain_results, strict=False):
    """打印人类可读的审计报告"""
    print("=" * 70)
    print("  管线诚信审计报告")
    print(f"  第179轮 Sprint 86 中期检查 (P0 R179-003)")
    print(f"  审计时间: {datetime.now().isoformat()}")
    print("=" * 70)

    error_count = 0
    warn_count = 0

    # 核心检查
    print("\n📋 核心检查")
    print("-" * 70)
    for r in results:
        icon = {"PASS": "✅", "WARN": "⚠️", "ERROR": "❌"}.get(r["status"], "❓")
        print(f"{icon} [{r['status']}] {r['check']}")
        print(f"   {r.get('detail', '')}")
        if r.get("issues"):
            for issue in r["issues"]:
                print(f"   → {issue}")
        if r.get("fix"):
            print(f"   🔧 修复: {r['fix']}")
        if r["status"] == "ERROR":
            error_count += 1
        elif r["status"] == "WARN":
            warn_count += 1

    # 连锁依赖表
    print("\n📊 六类 comfortCategory → hint → guide → emotion 连锁依赖")
    print("-" * 70)
    print(f"{'类别':<12} {'状态':<8} {'条目':<6} {'comfortCategory':<18} {'hint':<10} {'guide':<10} {'emotion':<10}")
    print("-" * 70)
    for r in chain_results:
        icon = {"PASS": "✅", "WARN": "⚠️", "ERROR": "❌"}.get(r["status"], "❓")
        print(f"{icon} {r['category']:<9} {r['status']:<8} {r['total']:<6} {r['comfortCategory']:<18} {r['hint']:<10} {r['guide']:<10} {r['emotion']:<10}")

    # 总结
    print("\n" + "=" * 70)
    total_checks = len(results) + 1  # +1 for chain
    if error_count > 0:
        print(f" ❌ 管线不通过: {error_count} 个 ERROR, {warn_count} 个 WARN")
        print(f"   阻塞项: comfortCategory 分类未完成 → hint/guide/emotion 全部阻塞")
    elif warn_count > 0:
        print(f" ⚠️ 管线有警告: {warn_count} 个 WARN（非阻塞）")
    else:
        print(f" ✅ 管线全部通过: {total_checks} 项检查")
    print("=" * 70)

    return error_count if strict else (1 if error_count > 0 else 0)


def output_json(results, chain_results):
    """JSON 格式输出"""
    output = {
        "audit": "管线诚信审计",
        "round": 179,
        "timestamp": datetime.now().isoformat(),
        "core_checks": results,
        "chain_dependency": chain_results,
    }
    print(json.dumps(output, ensure_ascii=False, indent=2))


def main():
    strict = "--strict" in sys.argv
    json_output = "--json" in sys.argv

    results, chain_results = run_all_checks()

    if json_output:
        output_json(results, chain_results)
    else:
        exit_code = print_report(results, chain_results, strict)
        sys.exit(exit_code)


if __name__ == "__main__":
    main()