#!/usr/bin/env python3
"""
home-comfort-category.py - home 类别 comfortCategory 批量分类脚本
Sprint 87 新增（第180轮专家圆桌评审）
Sprint 87 第181轮更新：A级收紧为"物理伤害风险"

功能：
1. 读取 home.json 中所有条目
2. 基于 comfortCategory 三级分类规则自动分类
3. 输出分类结果供人工审核
4. 确认后写入 home.json

分类规则（第181轮更新——王园长重新定义）：
- A级（安全警告）: 仅涉及物理伤害风险（烫伤/触电/割伤/跌落/中毒/火灾）
- B级（感官探索）: 涉及味觉、触觉、声音、气味、日常体验
- C级（知识事实）: 涉及家庭物品原理、自然现象解释、生理现象

特别说明（第181轮）：
- A级关键词收紧为"物理伤害风险"核心词，移除了"安全""厨房""楼梯"等弱关联词
- 第180轮A级15条中有大量误分类（"灯""冰箱""电视"应为C级，非A级）
- 新增 confidence 字段：当A/B/C三关键词数接近时标记为 low_confidence
- A级条目需 100% 人工复审（王园长+法务张律），预计≤5条

纯关键词分类仅作为 baseline，最终分类建议使用 LLM 语义分类（home-llm-classify.py）
"""

import json
import re
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).resolve().parent.parent
HOME_JSON = ROOT / "content" / "seed-library" / "home.json"

# A级关键词（安全警告——第181轮收紧：仅物理伤害风险）
# 移除了"安全""厨房""楼梯""窗户"等弱关联词
# 核心标准：烫伤/触电/割伤/跌落/中毒/火灾
A_KEYWORDS = [
    "火", "电", "烫", "刀", "触电", "陌生人", "敲门",
    "插座", "煤气", "炉子", "开水", "摔倒", "碰伤", "割伤",
    "药", "清洁剂", "高处", "中毒", "烧伤", "触电",
]

# B级关键词（感官探索）
B_KEYWORDS = [
    "味道", "声音", "气味", "颜色", "感觉", "摸", "闻", "尝",
    "看", "听", "软", "硬", "冷", "热", "亮", "暗",
    "舒服", "温暖", "香", "甜", "咸", "酸", "苦",
    "爸爸", "妈妈", "爷爷", "奶奶", "弟弟", "妹妹", "哥哥", "姐姐",
    "家", "房间", "床", "沙发", "玩具", "抱", "亲",
]

# C级关键词（知识事实）
C_KEYWORDS = [
    "为什么", "怎么", "原理", "因为", "原因", "功能",
    "门", "窗", "墙", "地板", "天花板", "水龙头", "马桶",
    "冰箱", "洗衣机", "电视", "空调", "灯", "开关",
    "镜子", "钟", "锁", "钥匙", "电话",
]


def classify_comfort_category(entry):
    """基于关键词和规则自动分类（第181轮更新：A级需关键词主导地位）"""
    question = entry.get("question", "")
    layer1 = entry.get("layer1", {}).get("answer", "")
    tags = entry.get("tags", [])
    text = question + layer1 + " ".join(tags)

    a_score = sum(1 for kw in A_KEYWORDS if kw in text)
    b_score = sum(1 for kw in B_KEYWORDS if kw in text)
    c_score = sum(1 for kw in C_KEYWORDS if kw in text)

    # 第181轮更新：A级需关键词主导地位（a_score > 0 AND a_score >= c_score）
    # 避免"灯为什么会亮"（A=2, C=5）被误判为A级
    if a_score > 0 and a_score >= c_score:
        confidence = "high" if a_score > b_score + c_score else "medium" if a_score >= max(b_score, c_score) else "low"
        return "A", a_score, b_score, c_score, confidence
    elif b_score > c_score:
        return "B", a_score, b_score, c_score, "high"
    else:
        return "C", a_score, b_score, c_score, "high"


def main():
    import sys
    mode = sys.argv[1] if len(sys.argv) > 1 else "preview"

    home = json.loads(HOME_JSON.read_text(encoding="utf-8"))

    print(f"=== home comfortCategory 批量分类 (Sprint 87) ===")
    print(f"总条目: {len(home)}")
    print()

    a_count = b_count = c_count = 0
    results = []

    for entry in home:
        cat, a_s, b_s, c_s, confidence = classify_comfort_category(entry)
        entry["comfortCategory"] = cat
        results.append({
            "id": entry["id"],
            "question": entry["question"],
            "comfortCategory": cat,
            "a_keywords": a_s,
            "b_keywords": b_s,
            "c_keywords": c_s,
            "confidence": confidence,
        })

        if cat == "A":
            a_count += 1
        elif cat == "B":
            b_count += 1
        else:
            c_count += 1

    # 按分类排序输出
    print(f"分类结果: A={a_count}, B={b_count}, C={c_count}")
    print()

    for cat_label in ["A", "B", "C"]:
        cat_results = [r for r in results if r["comfortCategory"] == cat_label]
        cat_name = {"A": "安全警告（物理伤害风险）", "B": "感官探索", "C": "知识事实"}[cat_label]
        print(f"--- {cat_label}级（{cat_name}）: {len(cat_results)}条 ---")
        for r in cat_results:
            conf_mark = "⚠️" if r.get("confidence") == "low" else ("🔍" if r.get("confidence") == "medium" else "✅")
            print(f"  {conf_mark} {r['id']}: {r['question'][:40]}... [A:{r['a_keywords']} B:{r['b_keywords']} C:{r['c_keywords']}]")
        print()

    if mode == "apply":
        # 备份
        backup = HOME_JSON.with_suffix(f".json.bak.{datetime.now().strftime('%Y%m%d_%H%M%S')}")
        HOME_JSON.rename(backup)
        print(f"已备份原文件到: {backup}")

        # 写入
        HOME_JSON.write_text(json.dumps(home, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"已写入 {len(home)} 条到: {HOME_JSON}")

        # 验证
        new_home = json.loads(HOME_JSON.read_text(encoding="utf-8"))
        categories = [e.get("comfortCategory", "") for e in new_home]
        print(f"验证: A={categories.count('A')}, B={categories.count('B')}, C={categories.count('C')}, 空={categories.count('')}")

    elif mode == "preview":
        print(f"=== 预览模式 ===")
        print(f"A级（安全警告-需100%人工复审）: {a_count}条")
        print(f"B级（感官探索）: {b_count}条")
        print(f"C级（知识事实）: {c_count}条")
        print(f"运行 'python3 scripts/home-comfort-category.py apply' 应用分类")

    # 输出审核用JSON
    review_output = {
        "timestamp": datetime.now().isoformat(),
        "mode": mode,
        "summary": {"A": a_count, "B": b_count, "C": c_count, "total": len(home)},
        "a_level_review_required": [r for r in results if r["comfortCategory"] == "A"],
        "all_results": results,
    }
    output_path = ROOT / "content" / "home-comfort-category-preview.json"
    output_path.write_text(json.dumps(review_output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n审核结果已保存到: {output_path}")


if __name__ == "__main__":
    main()