#!/usr/bin/env python3
"""
批量为十亿个为什么各分类生成图片并写入 JSON。
用法：python scripts/gen_category_images.py [--category body animals food home nature society]
"""
import json
import os
import shutil
import sys
import subprocess
import time

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEED_DIR = os.path.join(BASE_DIR, "content", "seed-library")
IMAGE_BASE = os.path.join(BASE_DIR, "content", "images")
GEN_SCRIPT = os.path.expanduser("~/.claude/skills/generate-image/generate_image.py")

ART_STYLE = (
    "儿童绘本插画风格，温暖可爱，色彩明亮，简洁卡通，适合2-6岁幼儿，"
    "扁平化设计，无文字，白色背景"
)

LAYER_PROMPTS = {
    "layer1": "简单直观地展示：{answer_summary}。{art_style}",
    "layer2": "生动展示：{answer_summary}。{art_style}",
    "layer3": "有趣地展现：{answer_summary}。{art_style}",
}


def get_answer_summary(text: str, max_len: int = 60) -> str:
    return text.replace("\n", " ")[:max_len]


def generate_one(prompt: str, out_path: str, max_retries: int = 5) -> bool:
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    tmp_dir = os.path.join(BASE_DIR, "content", "images", "_tmp")
    os.makedirs(tmp_dir, exist_ok=True)

    env = os.environ.copy()
    env["IMAGE_OUTPUT_DIR"] = tmp_dir

    for attempt in range(max_retries):
        if attempt > 0:
            wait = 30 * (2 ** (attempt - 1))  # 30, 60, 120, 240s
            print(f"  [RETRY {attempt}/{max_retries-1}] waiting {wait}s...")
            time.sleep(wait)

        try:
            result = subprocess.run(
                [sys.executable, GEN_SCRIPT, "--prompt", prompt],
                capture_output=True, text=True, timeout=300, env=env
            )
            if result.returncode != 0:
                stderr = result.stderr
                if "429" in stderr or "Too Many" in stderr:
                    print(f"  [429] rate limited, will retry")
                    continue
                print(f"  [FAIL] {stderr[-300:]}")
                return False
            saved = result.stdout.strip().splitlines()[-1] if result.stdout.strip() else ""
            if saved and os.path.exists(saved):
                shutil.move(saved, out_path)
                print(f"  [OK] {os.path.basename(out_path)} ({os.path.getsize(out_path)//1024}KB)")
                return True
            print(f"  [FAIL] no output file. stderr: {result.stderr[-200:]}")
            return False
        except subprocess.TimeoutExpired:
            print(f"  [FAIL] timeout")
            return False
        except Exception as e:
            print(f"  [FAIL] {e}")
            return False

    print(f"  [FAIL] exhausted {max_retries} retries")
    return False


def process_category(cat: str):
    json_path = os.path.join(SEED_DIR, f"{cat}.json")
    if not os.path.exists(json_path):
        print(f"Skip {cat}: JSON not found")
        return

    with open(json_path, "r", encoding="utf-8") as f:
        questions = json.load(f)

    img_dir = os.path.join(IMAGE_BASE, cat)
    os.makedirs(img_dir, exist_ok=True)

    changed = False
    for q in questions:
        qid = q["id"]
        question_text = q.get("question", "")
        print(f"\n[{cat}] {qid}: {question_text}")

        # Generate layer1/2/3 images
        for layer_key in ("layer1", "layer2", "layer3"):
            layer = q.get(layer_key, {})
            if not layer:
                continue

            # If JSON already has image path and file exists, skip
            existing_img = layer.get("image", "")
            if existing_img:
                existing_abs = os.path.join(BASE_DIR, "content", existing_img)
                if os.path.exists(existing_abs) and os.path.getsize(existing_abs) > 1000:
                    print(f"  [SKIP] {layer_key} already wired ({existing_img})")
                    continue

            # Try to find existing file on disk (png or webp)
            found_rel = None
            for ext in ("png", "webp"):
                candidate_rel = f"images/{cat}/{qid}-{layer_key}.{ext}"
                candidate_abs = os.path.join(BASE_DIR, "content", candidate_rel)
                if os.path.exists(candidate_abs) and os.path.getsize(candidate_abs) > 1000:
                    found_rel = candidate_rel
                    break

            if found_rel:
                layer["image"] = found_rel
                changed = True
                print(f"  [WIRE] {layer_key} -> {found_rel}")
                continue

            # Generate new image
            img_rel = f"images/{cat}/{qid}-{layer_key}.png"
            img_abs = os.path.join(BASE_DIR, "content", img_rel)

            answer = layer.get("answer", "")
            summary = get_answer_summary(f"{question_text}：{answer}")
            prompt = (
                f"为儿童绘本插画：{summary}。"
                f"{ART_STYLE}"
            )

            print(f"  Generating {layer_key}...")
            ok = generate_one(prompt, img_abs)
            if ok:
                layer["image"] = img_rel
                changed = True
            time.sleep(15)  # respect rate limits between requests

    # Generate science images
    for q in questions:
        qid = q["id"]
        question_text = q.get("question", "")

        # Skip if already has scienceImage and file exists
        existing_sci = q.get("scienceImage", "")
        if existing_sci:
            existing_abs = os.path.join(BASE_DIR, "content", existing_sci)
            if os.path.exists(existing_abs) and os.path.getsize(existing_abs) > 1000:
                print(f"  [SKIP] science already wired for {qid}")
                # Still need to check experiment below
            else:
                existing_sci = ""  # file missing, regenerate

        if not existing_sci:
            # Try to find existing science file on disk
            found_rel = None
            for ext in ("png", "webp"):
                candidate_rel = f"images/{cat}/{qid}-science.{ext}"
                candidate_abs = os.path.join(BASE_DIR, "content", candidate_rel)
                if os.path.exists(candidate_abs) and os.path.getsize(candidate_abs) > 1000:
                    found_rel = candidate_rel
                    break

            if found_rel:
                q["scienceImage"] = found_rel
                changed = True
                print(f"  [WIRE] science -> {found_rel}")
            else:
                img_rel = f"images/{cat}/{qid}-science.png"
                img_abs = os.path.join(BASE_DIR, "content", img_rel)
                science_text = q.get("science", "")[:80]
                prompt = (
                    f"科学原理信息图，给家长看的：{question_text}的科学解释——{science_text}。"
                    f"简洁清晰的科普插画风格，色彩明亮，无文字，白色背景，适合手机屏幕显示"
                )
                print(f"  Generating science image for {qid}...")
                ok = generate_one(prompt, img_abs)
                if ok:
                    q["scienceImage"] = img_rel
                    changed = True
                time.sleep(15)

        # Experiment image
        if isinstance(q.get("experiment"), dict):
            existing_exp = q["experiment"].get("image", "")
            need_gen = True
            if existing_exp:
                existing_abs = os.path.join(BASE_DIR, "content", existing_exp)
                if os.path.exists(existing_abs) and os.path.getsize(existing_abs) > 1000:
                    print(f"  [SKIP] experiment already wired for {qid}")
                    need_gen = False

            if need_gen:
                # Try to find existing experiment file on disk
                found_rel = None
                for ext in ("png", "webp"):
                    candidate_rel = f"images/{cat}/{qid}-experiment.{ext}"
                    candidate_abs = os.path.join(BASE_DIR, "content", candidate_rel)
                    if os.path.exists(candidate_abs) and os.path.getsize(candidate_abs) > 1000:
                        found_rel = candidate_rel
                        break

                if found_rel:
                    q["experiment"]["image"] = found_rel
                    changed = True
                    print(f"  [WIRE] experiment -> {found_rel}")
                else:
                    img_rel = f"images/{cat}/{qid}-experiment.png"
                    img_abs = os.path.join(BASE_DIR, "content", img_rel)
                    exp_name = q["experiment"].get("name", "")
                    materials = "、".join(q["experiment"].get("materials", []))
                    prompt = (
                        f"亲子实验示意图：{exp_name}，材料：{materials}。"
                        f"儿童绘本插画风格，温暖可爱，展示实验步骤场景，无文字，白色背景"
                    )
                    print(f"  Generating experiment image for {qid}...")
                    ok = generate_one(prompt, img_abs)
                    if ok:
                        q["experiment"]["image"] = img_rel
                        changed = True
                    time.sleep(15)

    if changed:
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(questions, f, ensure_ascii=False, indent=2)
        print(f"\n[SAVED] {json_path}")


def main():
    categories = sys.argv[1:] if len(sys.argv) > 1 else ["animals", "food", "home", "nature", "society"]
    # Also handle body if explicitly requested
    for cat in categories:
        print(f"\n{'='*50}\nProcessing category: {cat}\n{'='*50}")
        process_category(cat)
    print("\n[DONE] All categories processed.")


if __name__ == "__main__":
    main()
