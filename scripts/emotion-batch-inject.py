#!/usr/bin/env python3
"""
emotion-batch-inject.py — food 类 IP emotion 批量注入脚本
基于 content/constants.json 中的 EMOTION_MAPPING 表，按 comfortCategory 批量注入 rabbitEmotion/bearEmotion。

用法：
  python3 scripts/emotion-batch-inject.py [--dry-run] [--category food]

第176轮：EMOTION_MAPPING 已写入 constants.json
第177轮：脚本上线，food 50条全量注入
"""

import json
import sys
import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CONTENT_DIR = PROJECT_ROOT / "content"
CONSTANTS_PATH = CONTENT_DIR / "constants.json"
SEED_LIBRARY = CONTENT_DIR / "seed-library"

# EMOTION_MAPPING: A=brave+protective, B=curious+gentle, C=curious+wise
def load_mapping():
    with open(CONSTANTS_PATH) as f:
        constants = json.load(f)
    mapping = constants.get("EMOTION_MAPPING", {}).get("mapping", {})
    default = constants.get("EMOTION_MAPPING", {}).get("default", {
        "rabbitEmotion": "curious",
        "bearEmotion": "gentle"
    })
    return mapping, default

def inject_category(category_file, mapping, default, dry_run=False):
    """Inject emotions into a single category JSON file."""
    filepath = SEED_LIBRARY / category_file
    if not filepath.exists():
        print(f"❌ File not found: {filepath}")
        return {"total": 0, "injected": 0, "skipped": 0, "errors": []}

    with open(filepath) as f:
        items = json.load(f)

    total = len(items)
    injected = 0
    skipped = 0
    errors = []

    for item in items:
        item_id = item.get("id", "unknown")
        cc = item.get("comfortCategory", "")

        if cc in mapping:
            expected_rabbit = mapping[cc]["rabbitEmotion"]
            expected_bear = mapping[cc]["bearEmotion"]
        else:
            # No comfortCategory — use default
            expected_rabbit = default["rabbitEmotion"]
            expected_bear = default["bearEmotion"]

        current_rabbit = item.get("rabbitEmotion", "")
        current_bear = item.get("bearEmotion", "")

        needs_update = (current_rabbit != expected_rabbit or current_bear != expected_bear)

        if needs_update:
            if not dry_run:
                item["rabbitEmotion"] = expected_rabbit
                item["bearEmotion"] = expected_bear
            injected += 1
            print(f"  {'[DRY RUN] ' if dry_run else ''}{item_id}: {current_rabbit or 'MISSING'}/{current_bear or 'MISSING'} → {expected_rabbit}/{expected_bear} (cc={cc or 'default'})")
        else:
            skipped += 1

    if not dry_run and injected > 0:
        with open(filepath, 'w') as f:
            json.dump(items, f, ensure_ascii=False, indent=2)
        print(f"\n✅ Written {filepath} ({injected} updated)")

    return {
        "total": total,
        "injected": injected,
        "skipped": skipped,
        "errors": errors
    }

def main():
    dry_run = "--dry-run" in sys.argv
    target_categories = [a for a in sys.argv[1:] if a.startswith("--category")]
    if target_categories:
        target_names = [a.split("=")[1] if "=" in a else a.split("=")[0] for a in target_categories]
    else:
        target_names = None  # all categories

    mapping, default = load_mapping()
    print(f"📋 EMOTION_MAPPING loaded: {len(mapping)} categories")
    for k, v in mapping.items():
        print(f"  {k}: {v['rabbitEmotion']}/{v['bearEmotion']} ({v['description']})")
    print(f"  default: {default['rabbitEmotion']}/{default['bearEmotion']}")

    if dry_run:
        print("\n🔍 DRY RUN MODE — no files will be modified\n")

    # Find all category JSON files
    all_categories = ["food.json", "body.json", "animals.json", "home.json", "nature.json", "society.json"]
    if target_names:
        all_categories = [f"{c}.json" for c in target_names]

    results = {}
    for cat_file in all_categories:
        filepath = SEED_LIBRARY / cat_file
        if not filepath.exists():
            print(f"⏭️  Skipping {cat_file} (not found)")
            continue
        print(f"\n{'='*60}")
        print(f"📦 Processing {cat_file}")
        print(f"{'='*60}")
        results[cat_file] = inject_category(cat_file, mapping, default, dry_run=dry_run)

    # Summary
    print(f"\n{'='*60}")
    print(f"📊 Summary")
    print(f"{'='*60}")
    total_all = sum(r["total"] for r in results.values())
    injected_all = sum(r["injected"] for r in results.values())
    skipped_all = sum(r["skipped"] for r in results.values())
    print(f"  Total items: {total_all}")
    print(f"  {'Would inject' if dry_run else 'Injected'}: {injected_all}")
    print(f"  Skipped (already correct): {skipped_all}")
    if not dry_run:
        print(f"  Completion: {skipped_all}/{total_all} already correct, {injected_all} updated")

if __name__ == "__main__":
    main()