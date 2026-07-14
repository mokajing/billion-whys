#!/bin/bash
# Sync images from content/images/ to public/images/
# Ensures no gap between source and production directories
# Sprint 67 第122轮：prebuild 前先扫孤儿 PNG，防止 src > dest
# Sprint 75 第143轮：升级为强制门禁（sync 失败 = build 失败）；增加反向清理幽灵文件
# V8.84 第148轮：CDN 上传步骤（CTO+后端老稳）。ossutil 就绪后反注释 CDN_UPLOAD_ENABLED

SRC="content/images"
DEST="public/images"
ORPHANS_DIR=".orphans/public-images"

# V8.84 第148轮：CDN 上传配置
# 当 OSS bucket 和 CDN 域名就绪后，设置 CDN_UPLOAD_ENABLED=1 启用 CDN 上传
CDN_UPLOAD_ENABLED=0
CDN_BUCKET="oss://billion-whys-illustrations"
CDN_DOMAIN="https://img.billionwhys.com"

cd "$(dirname "$0")/.." || exit 1

# Sprint 67 第122轮：独立孤儿 PNG 扫描（prebuild 前置）
python3 scripts/sync_dingtalk_materials.py --sweep-only 2>/dev/null

# Sprint 75 第143轮：反向清理——public 中存在但 content 中不存在的文件
# 先归档到 .orphans/，再删除。保留 og-cover.png 等顶层文件
orphan_count=0
for category in body animals food home nature society experiments; do
  if [ -d "$DEST/$category" ]; then
    for file in "$DEST/$category"/*.png; do
      [ -f "$file" ] || continue
      fname=$(basename "$file")
      # 检查 content 中是否有同名文件（webp 或 png）
      webp_name="${fname%.png}.webp"
      if [ -f "$SRC/$category/$webp_name" ] || [ -f "$SRC/$category/$fname" ]; then
        # content 有对应的 webp 版本，直接删除 public 中的 png
        rm -f "$file"
        orphan_count=$((orphan_count + 1))
      else
        # content 也没有，归档到 .orphans/
        mkdir -p "$ORPHANS_DIR/$category"
        mv "$file" "$ORPHANS_DIR/$category/$fname"
        orphan_count=$((orphan_count + 1))
      fi
    done
  fi
done
# 清理幽灵 webp（public 有但 content 没有）
for category in body animals food home nature society experiments; do
  if [ -d "$DEST/$category" ]; then
    for file in "$DEST/$category"/*.webp; do
      [ -f "$file" ] || continue
      fname=$(basename "$file")
      if [ ! -f "$SRC/$category/$fname" ]; then
        mkdir -p "$ORPHANS_DIR/$category"
        mv "$file" "$ORPHANS_DIR/$category/$fname"
        orphan_count=$((orphan_count + 1))
      fi
    done
  fi
done
[ "$orphan_count" -gt 0 ] && echo "Cleaned $orphan_count orphan files (archived to $ORPHANS_DIR)"

count=0
for category in body animals food home nature society experiments; do
  if [ -d "$SRC/$category" ]; then
    mkdir -p "$DEST/$category"
    for file in "$SRC/$category"/*.webp; do
      [ -f "$file" ] || continue
      fname=$(basename "$file")
      cp "$file" "$DEST/$category/$fname"
      count=$((count + 1))
    done
  fi
done

echo "Synced $count files from $SRC to $DEST"

# Sprint 75 第143轮：强制门禁——验证 sync 后的一致性
mismatch=0
for category in body animals food home nature society experiments; do
  if [ -d "$SRC/$category" ]; then
    for file in "$SRC/$category"/*.webp; do
      [ -f "$file" ] || continue
      fname=$(basename "$file")
      if [ ! -f "$DEST/$category/$fname" ]; then
        echo "ERROR: sync failed - $fname missing from $DEST/$category" >&2
        mismatch=1
      fi
    done
  fi
done
if [ "$mismatch" -eq 1 ]; then
  echo "FATAL: sync-images consistency check failed. Build aborted." >&2
  exit 1
fi

echo "Sync consistency check passed."

# V8.84 第148轮：CDN 上传步骤（CTO+后端老稳+前端小凡）
# 当 OSS bucket 和 CDN 域名就绪后启用
if [ "$CDN_UPLOAD_ENABLED" -eq 1 ]; then
  echo "Uploading to CDN: $CDN_BUCKET ..."
  if command -v ossutil &>/dev/null; then
    ossutil cp -r "$DEST/" "$CDN_BUCKET/" --recursive --update 2>&1 || {
      echo "WARNING: CDN upload failed (ossutil error). Build continues with local images." >&2
    }
    echo "CDN upload complete: $CDN_DOMAIN"
  else
    echo "WARNING: ossutil not found. Install ossutil to enable CDN upload." >&2
    echo "  Download: https://help.aliyun.com/document_detail/120075.html"
  fi
fi
