#!/bin/bash
# Sync images from content/images/ to public/images/
# Ensures no gap between source and production directories

SRC="content/images"
DEST="public/images"

cd "$(dirname "$0")/.." || exit 1

count=0
for category in body animals food home nature society experiments; do
  if [ -d "$SRC/$category" ]; then
    mkdir -p "$DEST/$category"
    for file in "$SRC/$category"/*.{png,webp}; do
      [ -f "$file" ] || continue
      fname=$(basename "$file")
      if [ ! -f "$DEST/$category/$fname" ]; then
        cp "$file" "$DEST/$category/$fname"
        count=$((count + 1))
      fi
    done
  fi
done

echo "Synced $count files from $SRC to $DEST"
