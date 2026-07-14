#!/usr/bin/env python3
"""
body-l1-truncate.py - body 类别 L1 >50字 识别与统计脚本
Sprint 87 新增（第180轮专家圆桌评审）
Sprint 87 第181轮更新：降级为"识别+统计"模式，不再生成替换文本

功能：
1. 扫描 body.json 中所有 L1 >50字的条目
2. 统计字数、安抚词、comfortCategory分布
3. 输出分析报告供文若水人工精炼参考
4. 不再自动生成截断文本（第181轮裁决：机械截断质量差，改人工精炼）

安抚词单选规则（第181轮更新）：
- A级（安全警告）: "轻轻地，没关系"
- B级（感官探索）: "暖暖的，真奇妙"
- 例外：涉及自我认知/成长/能力感时，B级安抚词改用"你真的很棒呢"
- C级（知识事实）: "这很正常哦"
"""

import json
import re
import sys
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).resolve().parent.parent
BODY_JSON = ROOT / "content" / "seed-library" / "body.json"
MAX_L1_CHARS = 45  # 目标45字（留5字buffer）

COMFORT_PATTERNS = [
    "轻轻地，没关系", "暖暖的，真奇妙", "这很正常哦",
    "没关系", "暖暖的", "轻轻地", "真奇妙", "很安全",
    "你真的很棒呢", "很舒服呢", "轻轻试一下", "轻轻看看",
    "轻轻跳一跳", "轻轻碰一下", "好安全呀",
]

SINGLE_COMFORT_RULES = {
    "A": "轻轻地，没关系",
    "B": "暖暖的，真奇妙",
    "C": "这很正常哦",
}

# 第181轮新增：自我认知/成长/能力感关键词（触发B级例外）
SELF_EFFICACY_KEYWORDS = [
    "睡觉", "长高", "长大", "变强壮", "有力气", "力气",
    "变聪明", "学会", "自己", "能干", "完成", "做到",
    "长大", "变胖", "变高", "变快", "变厉害",
]


def count_chars(text):
    """计算中文字符数（忽略标点和空格的影响）"""
    return len(text.replace(" ", ""))


def find_comfort_words(text):
    """找到文本中匹配的安抚词"""
    found = []
    for pattern in COMFORT_PATTERNS:
        if pattern in text:
            found.append(pattern)
    return found


def get_recommended_comfort(entry):
    """根据 comfortCategory 和内容返回推荐安抚词（第181轮更新）"""
    comfort_cat = entry.get("comfortCategory", "B")
    l1_text = entry.get("layer1", {}).get("answer", "")
    question = entry.get("question", "")
    tags = entry.get("tags", [])

    # 默认推荐
    recommended = SINGLE_COMFORT_RULES.get(comfort_cat, "这很正常哦")

    # 第181轮例外：B级 + 自我认知/成长/能力感 → 用"你真的很棒呢"
    if comfort_cat == "B":
        text = l1_text + question + " ".join(tags)
        if any(kw in text for kw in SELF_EFFICACY_KEYWORDS):
            recommended = "你真的很棒呢"

    return recommended


def analyze_entry(entry):
    """分析条目并输出精炼建议（第181轮：不再自动截断，仅提供分析）"""
    l1_text = entry.get("layer1", {}).get("answer", "")
    original_len = count_chars(l1_text)
    comfort_cat = entry.get("comfortCategory", "B")

    if original_len <= MAX_L1_CHARS:
        return None  # 不需要处理

    # 找到所有安抚词
    comfort_words = find_comfort_words(l1_text)
    recommended_comfort = get_recommended_comfort(entry)

    # 分析：哪些内容需要保留
    # 识别核心解释（去掉安抚词后的主体）
    cleaned = l1_text
    for cw in comfort_words:
        cleaned = cleaned.replace(f"，{cw}", "")
        cleaned = cleaned.replace(f"。{cw}", "")
        cleaned = cleaned.replace(f"！{cw}", "")
        cleaned = cleaned.replace(cw, "")
    cleaned = cleaned.rstrip("，。！； ")

    # 检查是否涉及自我认知
    is_self_efficacy = any(kw in l1_text for kw in SELF_EFFICACY_KEYWORDS)

    return {
        "id": entry["id"],
        "question": entry.get("question", ""),
        "original": l1_text,
        "original_len": original_len,
        "comfortCategory": comfort_cat,
        "current_comforts": comfort_words,
        "recommended_comfort": recommended_comfort,
        "comfort_override_reason": "自我认知类例外" if (comfort_cat == "B" and is_self_efficacy and recommended_comfort == "你真的很棒呢") else None,
        "core_content": cleaned,
        "core_content_len": count_chars(cleaned),
        "is_self_efficacy": is_self_efficacy,
        "notes": None,  # 文若水手工填写
    }


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "preview"

    body = json.loads(BODY_JSON.read_text(encoding="utf-8"))
    over_limit = [e for e in body if count_chars(e.get("layer1", {}).get("answer", "")) > MAX_L1_CHARS]

    print(f"=== body L1 分析脚本 (Sprint 87 / 第181轮更新) ===")
    print(f"目标字数: <= {MAX_L1_CHARS}字")
    print(f"总条目: {len(body)}, 超限: {len(over_limit)}")
    print(f"模式: 仅识别+统计（第181轮裁决：人工精炼，不自动截断）")
    print()

    # 统计分布
    comfort_dist = {"A": 0, "B": 0, "C": 0}
    self_efficacy_count = 0

    results = []
    for entry in over_limit:
        result = analyze_entry(entry)
        if result:
            results.append(result)
            comfort_dist[result["comfortCategory"]] = comfort_dist.get(result["comfortCategory"], 0) + 1
            if result.get("is_self_efficacy"):
                self_efficacy_count += 1

            print(f"[{result['id']}] {result['original_len']}字 → 核心内容{result['core_content_len']}字")
            print(f"  问题: {result['question']}")
            print(f"  原文: {result['original'][:80]}...")
            print(f"  核心: {result['core_content'][:80]}...")
            print(f"  comfortCategory: {result['comfortCategory']}")
            print(f"  当前安抚词: {result['current_comforts']}")
            print(f"  推荐安抚词: {result['recommended_comfort']}")
            if result.get("comfort_override_reason"):
                print(f"  ⚡ 例外: {result['comfort_override_reason']}")
            print(f"  自我认知类: {'是' if result.get('is_self_efficacy') else '否'}")
            print(f"  精炼建议: 保留核心内容({result['core_content_len']}字) + {result['recommended_comfort']}({count_chars(result['recommended_comfort'])}字) = 目标{result['core_content_len'] + count_chars(result['recommended_comfort']) + 1}字")
            print()

    print(f"=== 统计汇总 ===")
    print(f"超限条目: {len(results)}")
    print(f"comfortCategory分布: A={comfort_dist.get('A',0)}, B={comfort_dist.get('B',0)}, C={comfort_dist.get('C',0)}")
    print(f"自我认知类例外: {self_efficacy_count}条")

    if mode == "preview":
        print(f"\n=== 下一步 ===")
        print(f"文若水逐条人工精炼，在原始L1上直接修改，保留核心比喻+安抚词")
        print(f"涉及自我认知的条目（{self_efficacy_count}条），安抚词优先保留'你真的很棒呢'")

    # 输出JSON结果
    output = {
        "timestamp": datetime.now().isoformat(),
        "mode": "analysis",  # 第181轮：降级为分析模式
        "round": "181",
        "total_entries": len(body),
        "over_limit_count": len(over_limit),
        "analyzed_count": len(results),
        "comfort_distribution": comfort_dist,
        "self_efficacy_count": self_efficacy_count,
        "results": results,
        "note": "第181轮裁决：机械截断质量差，已降级为分析模式。请文若水在原始L1上人工精炼。",
    }
    output_path = ROOT / "content" / "body-l1-truncate-preview.json"
    output_path.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n分析结果已保存到: {output_path}")


if __name__ == "__main__":
    main()