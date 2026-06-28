#!/usr/bin/env python3
"""Compress PNG images to WebP format, targeting ≤200KB per image."""
import os
import sys
import subprocess

CONTENT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'content', 'images')
MAX_SIZE_KB = 200

def compress_image(src_path):
    dst_path = src_path.rsplit('.', 1)[0] + '.webp'

    from PIL import Image
    img = Image.open(src_path)
    img.thumbnail((800, 800), Image.LANCZOS)
    quality = 80
    img.save(dst_path, 'WebP', quality=quality, method=6)
    while os.path.getsize(dst_path) > MAX_SIZE_KB * 1024 and quality > 20:
        quality -= 10
        img.save(dst_path, 'WebP', quality=quality, method=6)

    size_kb = os.path.getsize(dst_path) / 1024
    src_size_kb = os.path.getsize(src_path) / 1024
    print(f"  {os.path.basename(src_path)}: {src_size_kb:.0f}KB -> {size_kb:.0f}KB WebP ({size_kb/src_size_kb*100:.0f}%)")
    return True

def main():
    total = 0
    compressed = 0
    for root, dirs, files in os.walk(CONTENT_DIR):
        for f in sorted(files):
            if f.lower().endswith('.png'):
                total += 1
                src = os.path.join(root, f)
                if compress_image(src):
                    compressed += 1
    print(f"\nDone: {compressed}/{total} images compressed")

if __name__ == '__main__':
    main()
