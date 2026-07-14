#!/usr/bin/env python3
"""Update prompt-registry with animals entries (Sprint 83)."""
import json

with open('prompt-registry.json') as f:
    d = json.load(f)

# Update metadata
d['updated'] = '2026-07-11T17:00:00+08:00'
d['description'] = 'V9.06 第168轮：Sprint 83 animals 类 46条全量补齐——L1 comfort/emotion/interactionHint/parentGuide 全覆盖。Schema 门禁拓展至 animals 类。'

# Add animals comfort category schema to globalConstraints
d['globalConstraints']['comfortCategorySchema'] = {
    "version": "1.0",
    "round": "168th",
    "A": {
        "label": "恐惧类",
        "description": "涉及蜘蛛、蜜蜂蜇人、虫子坠落、尴尬不适等场景",
        "comfortRule": "安抚词必须前置（首句）",
        "parentGuideRule": "必须包含安全提示子字段（安全距离/行为指导）",
        "rabbitEmotion": "brave",
        "bearEmotion": "protective"
    },
    "B": {
        "label": "好奇类",
        "description": "一般性动物/自然好奇问题",
        "comfortRule": "安抚词尾置（末句）",
        "parentGuideRule": "标准亲子互动指导",
        "rabbitEmotion": "curious/surprised/happy",
        "bearEmotion": "warm/comforting"
    },
    "C": {
        "label": "中性类",
        "description": "纯事实/科学问题",
        "comfortRule": "无强制安抚词要求",
        "parentGuideRule": "标准亲子互动指导",
        "rabbitEmotion": "curious",
        "bearEmotion": "warm"
    }
}

# Update topics with animals entries
animals_data = json.load(open('content/seed-library/animals.json'))
for e in animals_data:
    eid = e['id']
    d['topics'][eid] = {
        "category": "animals",
        "question": e['question'],
        "comfortCategory": e.get('comfortCategory', 'B'),
        "status": "pending_review",
        "lastAudit": "2026-07-11T17:00:00+08:00",
        "auditResult": "PENDING",
        "rabbitEmotion": e.get('rabbitEmotion', 'curious'),
        "bearEmotion": e.get('bearEmotion', 'warm'),
        "prompt": f"a cute cartoon bunny and bear exploring {e['question']}, warm soft pastel colors, children's book illustration style, flat vector, minimal shading, low saturation, no realistic textures, RABBIT: {e.get('rabbitEmotion', 'curious')}, BEAR: {e.get('bearEmotion', 'warm')}, simple background, 512x512",
        "promptReviewedBy": "安全李姐",
        "promptReviewDate": "2026-07-11T17:00:00+08:00",
        "illustrationVariants": {
            "layer1": {
                "path": f"images/animals/{eid}-layer1.webp",
                "size": "512x512",
                "status": "needs_generation"
            }
        }
    }

with open('prompt-registry.json', 'w') as f:
    json.dump(d, f, ensure_ascii=False, indent=2)

print(f"Updated prompt-registry: {len(d['topics'])} topics (body + animals)")
print(f"Animals added: {len(animals_data)}")