#!/usr/bin/env python3
"""
seedream-hash-obfuscate.py — V8.66 Sprint 70 第130轮
CEO+后端老稳+法务张律：seedream OSS 防盗链降级方案
文件名 hash 混淆（sha256 取前 8 位），不依赖 OSS 审批。

用法:
  python3 scripts/seedream-hash-obfuscate.py [--dry-run] [--prefix <dir>]

  将 content/images/ 下所有 seedream 生成的图片文件名替换为 hash 混淆版本。
  --dry-run: 仅打印变更，不实际修改文件
  --prefix: 指定图片目录前缀（默认 content/images）

输出:
  - 重命名所有 seedream 图片文件
  - 生成 seedream-hash-map.json 映射表（旧名→新名），供代码引用
"""

import hashlib
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IMAGE_DIR = ROOT / "content" / "images"
MAP_FILE = ROOT / "scripts" / "seedream-hash-map.json"
SEEDREAM_INDICATORS = ["seedream", "sprint57", "sprint59", "sprint60", "illustrations"]


def hash_filename(name: str) -> str:
    """对文件名取 sha256 前 8 位作为 hash 前缀"""
    h = hashlib.sha256(name.encode("utf-8")).hexdigest()[:8]
    return f"{h}_{name}"


def is_seedream_image(filepath: Path) -> bool:
    """判断文件是否为 seedream 生成的图片"""
    # 检查文件名是否包含 seedream 相关标识
    name = filepath.name.lower()
    # 也检查父目录名
    parent = filepath.parent.name.lower()
    return any(ind in name for ind in SEEDREAM_INDICATORS) or any(
        ind in parent for ind in SEEDREAM_INDICATORS
    )


def scan_images(base_dir: Path) -> list[Path]:
    """扫描所有图片文件"""
    images = []
    for ext in ("*.png", "*.webp", "*.jpg", "*.jpeg"):
        images.extend(base_dir.rglob(ext))
    return sorted(images)


def build_referer_nginx_config(domain: str = "billion-whys.example.com") -> str:
    """生成 nginx referer 白名单配置（供后续 OSS 审批通过后使用）"""
    return f"""# seedream OSS 防盗链 — nginx referer 白名单
# V8.66 Sprint 70 第130轮：后端老稳+法务张律
# 仅允许以下域名引用 seedream 图片
location ~* \\.(png|webp|jpg|jpeg)$ {{
    valid_referers none blocked
        {domain}
        *.{domain}
        localhost
        127.0.0.1;
    if ($invalid_referer) {{
        return 403;
    }}
}}
"""


def main():
    dry_run = "--dry-run" in sys.argv
    prefix = IMAGE_DIR
    for i, arg in enumerate(sys.argv):
        if arg == "--prefix" and i + 1 < len(sys.argv):
            prefix = Path(sys.argv[i + 1])

    if not prefix.exists():
        print(f"目录不存在: {prefix}")
        sys.exit(1)

    images = scan_images(prefix)
    seedream_images = [img for img in images if is_seedream_image(img)]

    if not seedream_images:
        print("未发现 seedream 图片，跳过")
        return

    print(f"发现 {len(seedream_images)} 个 seedream 图片")
    hash_map = {}

    for img in seedream_images:
        old_name = img.name
        new_name = hash_filename(old_name)
        new_path = img.parent / new_name

        hash_map[str(img.relative_to(ROOT))] = str(new_path.relative_to(ROOT))

        if dry_run:
            print(f"  [DRY-RUN] {old_name} → {new_name}")
        else:
            img.rename(new_path)
            print(f"  ✓ {old_name} → {new_name}")

    # 保存映射表
    if not dry_run and hash_map:
        with open(MAP_FILE, "w", encoding="utf-8") as f:
            json.dump(hash_map, f, ensure_ascii=False, indent=2)
        print(f"\n映射表已保存: {MAP_FILE}")

    # 生成 nginx 配置（仅第一次）
    nginx_conf = ROOT / "scripts" / "nginx-seedream-referer.conf"
    if not nginx_conf.exists():
        config = build_referer_nginx_config()
        if not dry_run:
            with open(nginx_conf, "w", encoding="utf-8") as f:
                f.write(config)
            print(f"nginx 配置已生成: {nginx_conf}")

    if dry_run:
        print(f"\n共 {len(hash_map)} 个文件待混淆（--dry-run 模式，未实际修改）")
    else:
        print(f"\n完成：{len(hash_map)} 个文件已混淆")


if __name__ == "__main__":
    main()