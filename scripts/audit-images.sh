#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# audit-images.sh — 种子库图片审计脚本
# 功能:
#   1. 扫描 content/seed-library/*.json 中所有图片引用
#   2. 检查引用的图片是否存在于 public/ 目录
#   3. 检查 public/images/ 下未被引用的幽灵文件
#   4. 按 category 输出覆盖率统计报告
# ──────────────────────────────────────────────────────────────
set -euo pipefail

# 定位项目根目录（脚本所在目录的上一级）
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

SEED_DIR="$PROJECT_ROOT/content/seed-library"
PUBLIC_DIR="$PROJECT_ROOT/public"
IMAGES_DIR="$PUBLIC_DIR/images"

# 检查必要目录
if [[ ! -d "$SEED_DIR" ]]; then
  echo "错误: 种子库目录不存在 — $SEED_DIR" >&2
  exit 1
fi
if [[ ! -d "$IMAGES_DIR" ]]; then
  echo "错误: 图片目录不存在 — $IMAGES_DIR" >&2
  exit 1
fi

# ── 主逻辑用 Python3 实现 ───────────────────────────────────
python3 - "$SEED_DIR" "$PUBLIC_DIR" "$IMAGES_DIR" <<'PYEOF'
import json, glob, os, sys
from collections import defaultdict
from pathlib import Path

seed_dir   = sys.argv[1]
public_dir = sys.argv[2]
images_dir = sys.argv[3]

# ─── 1. 读取所有 JSON 条目，提取图片引用 ───────────────────
referenced_images = set()          # 所有引用的图片路径（相对于 public/）
missing_images    = []             # (category, id, field, path)
category_stats    = defaultdict(lambda: {"total": 0, "with_image": 0, "slots": 0, "filled": 0})

json_files = sorted(glob.glob(os.path.join(seed_dir, "*.json")))
if not json_files:
    print("警告: 未找到任何 JSON 文件", file=sys.stderr)
    sys.exit(0)

for jf in json_files:
    with open(jf, "r", encoding="utf-8") as f:
        try:
            entries = json.load(f)
        except json.JSONDecodeError as e:
            print(f"警告: JSON 解析失败 — {jf}: {e}", file=sys.stderr)
            continue

    for entry in entries:
        cat = entry.get("category", os.path.splitext(os.path.basename(jf))[0])
        eid = entry.get("id", "unknown")
        stats = category_stats[cat]
        stats["total"] += 1

        # 收集该条目中所有图片字段
        image_fields = []
        for layer_key in ("layer1", "layer2", "layer3"):
            layer = entry.get(layer_key)
            if isinstance(layer, dict) and "image" in layer:
                image_fields.append((f"{layer_key}.image", layer["image"]))

        # scienceImage（顶层字段）
        if "scienceImage" in entry:
            image_fields.append(("scienceImage", entry["scienceImage"]))

        # experiment.image
        exp = entry.get("experiment")
        if isinstance(exp, dict) and "image" in exp:
            image_fields.append(("experiment.image", exp["image"]))

        has_any_image = False
        for field_name, img_path in image_fields:
            stats["slots"] += 1
            if not img_path:  # 空字符串，视为未填写
                continue
            stats["filled"] += 1
            has_any_image = True
            referenced_images.add(img_path)

            # 检查文件是否存在
            full_path = os.path.join(public_dir, img_path)
            if not os.path.isfile(full_path):
                missing_images.append((cat, eid, field_name, img_path))

        if has_any_image:
            stats["with_image"] += 1

# ─── 2. 扫描 public/images/ 下的实际文件 ──────────────────
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif", ".avif"}
actual_images = set()

for root, _dirs, files in os.walk(images_dir):
    # 跳过 _tmp 目录
    if "/_tmp" in root or root.endswith("/_tmp"):
        continue
    for fname in files:
        if os.path.splitext(fname)[1].lower() in IMAGE_EXTS:
            rel = os.path.relpath(os.path.join(root, fname), public_dir)
            actual_images.add(rel)

# 幽灵文件 = 存在于磁盘但未被任何条目引用
ghost_files = sorted(actual_images - referenced_images)

# ─── 3. 输出报告 ──────────────────────────────────────────
SEP = "=" * 64
THIN = "-" * 64

print()
print(SEP)
print("  种子库图片审计报告")
print(SEP)

# 3a. 按 category 统计
print()
print("  [按分类统计]")
print(THIN)
print(f"  {'分类':<12} {'条目数':>6} {'有图条目':>8} {'条目覆盖率':>10} {'图片槽位':>8} {'已填写':>6} {'槽位填充率':>10}")
print(THIN)

total_entries    = 0
total_with_image = 0
total_slots      = 0
total_filled     = 0

for cat in sorted(category_stats.keys()):
    s = category_stats[cat]
    total_entries    += s["total"]
    total_with_image += s["with_image"]
    total_slots      += s["slots"]
    total_filled     += s["filled"]
    entry_rate = f'{s["with_image"] / s["total"] * 100:.1f}%' if s["total"] else "N/A"
    slot_rate  = f'{s["filled"] / s["slots"] * 100:.1f}%' if s["slots"] else "N/A"
    print(f"  {cat:<12} {s['total']:>6} {s['with_image']:>8} {entry_rate:>10} {s['slots']:>8} {s['filled']:>6} {slot_rate:>10}")

print(THIN)
overall_entry_rate = f'{total_with_image / total_entries * 100:.1f}%' if total_entries else "N/A"
overall_slot_rate  = f'{total_filled / total_slots * 100:.1f}%' if total_slots else "N/A"
print(f"  {'合计':<12} {total_entries:>6} {total_with_image:>8} {overall_entry_rate:>10} {total_slots:>8} {total_filled:>6} {overall_slot_rate:>10}")
print()

# 3b. 缺失图片
print(f"  [缺失图片] （引用了但文件不存在: {len(missing_images)} 条）")
print(THIN)
if missing_images:
    for cat, eid, field, path in sorted(missing_images):
        print(f"  {eid:<20} {field:<20} {path}")
else:
    print("  (无)")
print()

# 3c. 幽灵文件
print(f"  [幽灵文件] （存在但未被引用: {len(ghost_files)} 个）")
print(THIN)
if ghost_files:
    for gf in ghost_files:
        print(f"  {gf}")
else:
    print("  (无)")
print()

# 3d. 总体覆盖率
print(SEP)
ref_on_disk = referenced_images & actual_images
print(f"  引用图片总数:     {len(referenced_images)}")
print(f"  磁盘图片总数:     {len(actual_images)}")
print(f"  引用且存在:       {len(ref_on_disk)}")
print(f"  引用但缺失:       {len(missing_images)}")
print(f"  存在但未引用:     {len(ghost_files)}")
ref_coverage = f'{len(ref_on_disk) / len(referenced_images) * 100:.1f}%' if referenced_images else "N/A"
print(f"  引用文件存在率:   {ref_coverage}")
print(SEP)
print()

# 退出码: 有缺失则返回 1
sys.exit(1 if missing_images else 0)
PYEOF
