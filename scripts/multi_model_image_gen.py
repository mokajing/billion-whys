#!/usr/bin/env python3
"""
多模型自动切换生图模块。
按优先级尝试多个模型，失败自动切换到下一个。
跟踪各模型健康状态，避免重复尝试已知不可用的模型。
"""
import json
import os
import re
import subprocess
import time
import urllib.request
from pathlib import Path
from datetime import datetime, timedelta
from PIL import Image

# 模型配置（按优先级排序）
MODELS = [
    {
        "name": "seedream",
        "tool": "d.one::liblib_seedream_v4_5",
        "call_args": lambda prompt: {
            "model": "seedream_v4_5",
            "prompt": prompt[:1500],
            "generateParams": {"width": 1024, "height": 1024}
        },
        "async": True,
        "avg_time": 35,
    },
    {
        "name": "qwen_image",
        "tool": "d.one::qwen_image_generate",
        "call_args": lambda prompt: {
            "prompt": prompt[:1500],
            "size": "1024*1024",
            "n": 1,
            "promptExtend": True,
            "watermark": False
        },
        "async": True,
        "avg_time": 21,
    },
    {
        "name": "gemini_nano_2",
        "tool": "d.one::gemini_nano_2_image_create",
        "call_args": lambda prompt: {
            "prompt": prompt[:1500],
            "imageUrls": [],
            "aspectRatio": "1:1",
            "imageSize": "1K",
            "shouldUseGoogleSearch": False
        },
        "async": True,
        "avg_time": 21,
    },
    {
        "name": "gpt_image_2",
        "tool": "d.one::gpt_image_2_generate",
        "call_args": lambda prompt: {
            "prompt": prompt[:1500],
            "aspectRatio": "1:1",
            "n": 1
        },
        "async": True,
        "avg_time": 84,
    },
]

# 模型健康状态（运行时维护）
model_health = {m["name"]: {
    "available": True,
    "last_success": None,
    "last_failure": None,
    "consecutive_failures": 0,
    "cooldown_until": None,
} for m in MODELS}

# Ducky 作为最后备用（本地 generate_image.py）
DUCKY_SCRIPT = Path.home() / ".claude" / "skills" / "generate-image" / "generate_image.py"


def log(msg):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def call_mcp(tool, args):
    """Call aone MCP tool"""
    cmd = ["a1", "mcp", "--env", "prod", "call-tool", tool, json.dumps(args), "--provider", "aone"]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        out = result.stdout.strip()
        json_match = re.search(r'\{.*\}', out, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
    except Exception as e:
        return {"error": str(e)}
    return {"error": out[-200:] if out else "no output"}


def poll_uuid(uuid, max_wait=180):
    """Poll for async generation result"""
    cmd = ["a1", "mcp", "--env", "prod", "call-tool",
           "d.one::liblib_get_generate_status",
           json.dumps({"generateUuid": uuid}), "--provider", "aone"]
    start = time.time()
    while time.time() - start < max_wait:
        time.sleep(10)
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
            out = result.stdout.strip()
            json_match = re.search(r'\{.*\}', out, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
                if data.get("success"):
                    d = data["data"]
                    if d.get("generateStatus") == 5 and d.get("images"):
                        return d["images"][0]["imageUrl"]
        except Exception:
            pass
    return ""


def download(url, out_path):
    """Download image from URL"""
    try:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=120) as resp:
            with open(out_path, "wb") as f:
                f.write(resp.read())
        return out_path.exists() and out_path.stat().st_size > 1000
    except Exception as e:
        log(f"  download error: {e}")
        return False


def compress_to_webp(src_png, dst_webp, size=512, quality=70):
    """Compress PNG to WebP at target size. 在线能看清够用就行，适当压缩。
    512x512 q70 → ~20-40KB (mobile viewable, minimal bandwidth)."""
    try:
        img = Image.open(src_png)
        if img.mode != 'RGB':
            img = img.convert('RGB')
        img = img.resize((size, size), Image.LANCZOS)
        img.save(dst_webp, 'WEBP', quality=quality, method=6)
        return Path(dst_webp).exists() and Path(dst_webp).stat().st_size > 1000
    except Exception as e:
        log(f"  compress error: {e}")
        return False


def mark_success(model_name):
    h = model_health[model_name]
    h["available"] = True
    h["last_success"] = datetime.now().isoformat()
    h["consecutive_failures"] = 0
    h["cooldown_until"] = None


def mark_failure(model_name, cooldown_minutes=30, error_info=""):
    h = model_health[model_name]
    h["last_failure"] = datetime.now().isoformat()
    h["consecutive_failures"] += 1
    h["last_error"] = error_info
    if h["consecutive_failures"] >= 3:
        h["available"] = False
        h["cooldown_until"] = (datetime.now() + timedelta(minutes=cooldown_minutes)).isoformat()
        log(f"  [HEALTH] {model_name} marked unavailable, cooldown {cooldown_minutes}min")
        # Proactive webhook notification - 用户要求额度不足立即通知
        _notify_model_down(model_name, error_info, cooldown_minutes)


def _notify_model_down(model_name, error_info, cooldown_minutes):
    """额度不足/限流时立即通过 webhook 通知用户更换 model"""
    import subprocess
    notify_script = "/home/admin/workspace/notify_groups.sh"
    if not os.path.exists(notify_script):
        return
    # Get available models
    avail = [k for k, v in model_health.items() if v["available"] and k != model_name]
    title = f"生图模型 {model_name} 额度不足"
    content = (
        f"模型 {model_name} 连续失败 3 次，已标记不可用\n\n"
        f"错误信息: {error_info[:200]}\n"
        f"Cooldown: {cooldown_minutes} 分钟\n\n"
        f"当前剩余可用模型: {', '.join(avail) if avail else '无（全部挂了！）'}\n"
    )
    if not avail:
        content += "\n⚠️ 所有模型都挂了，请立即更换 model 或联系平台！"
    else:
        content += f"\n已自动切换到 {avail[0]}，但建议您检查额度并更换 model。"
    try:
        subprocess.run(["bash", notify_script, title, content], timeout=30, capture_output=True)
    except Exception:
        pass


def is_model_available(model_name):
    h = model_health[model_name]
    if not h["available"]:
        # Check if cooldown expired
        if h["cooldown_until"]:
            cooldown_time = datetime.fromisoformat(h["cooldown_until"])
            if datetime.now() > cooldown_time:
                h["available"] = True
                h["consecutive_failures"] = 0
                h["cooldown_until"] = None
                log(f"  [HEALTH] {model_name} cooldown expired, retrying")
        return h["available"]
    return True


def generate_image_multi_model(prompt, out_png_path, out_webp_path=None):
    """
    用多模型自动切换生成图片。
    按优先级尝试，第一个成功即返回。
    返回 (success, model_used, webp_path)
    """
    for model in MODELS:
        name = model["name"]
        if not is_model_available(name):
            log(f"  [SKIP] {name} (cooldown)")
            continue

        log(f"  [TRY] {name}...")
        res = call_mcp(model["tool"], model["call_args"](prompt))

        if not res.get("success"):
            err = res.get("error", "")[:200]
            log(f"  [FAIL] {name}: {err}")
            mark_failure(name, error_info=res.get("error", "")[:200])
            continue

        data = res["data"]
        uuid = data.get("generateUuid")
        if not uuid:
            # Sync response with imageUrl
            images = data.get("images", [])
            url = ""
            if images and isinstance(images, list):
                if isinstance(images[0], dict):
                    url = images[0].get("imageUrl") or images[0].get("url")
                else:
                    url = images[0]
            elif data.get("imageUrl"):
                url = data["imageUrl"]
            if not url:
                mark_failure(name, error_info=res.get("error", "")[:200])
                continue
        else:
            url = poll_uuid(uuid)
            if not url:
                log(f"  [FAIL] {name}: no url after poll")
                mark_failure(name, error_info=res.get("error", "")[:200])
                continue

        # Download
        if download(url, out_png_path):
            mark_success(name)
            # Compress to webp
            if out_webp_path:
                compress_to_webp(out_png_path, out_webp_path)
            return True, name, out_webp_path
        else:
            mark_failure(name, error_info=res.get("error", "")[:200])
            continue

    # All aone models failed, try Ducky as last resort
    if DUCKY_SCRIPT.exists() and is_model_available("ducky"):
        log(f"  [TRY] ducky (last resort)...")
        try:
            tmp_dir = out_png_path.parent / "_tmp"
            tmp_dir.mkdir(parents=True, exist_ok=True)
            env = os.environ.copy()
            env["IMAGE_OUTPUT_DIR"] = str(tmp_dir)
            result = subprocess.run(
                ["/usr/bin/python3", str(DUCKY_SCRIPT), "--prompt", prompt[:2000]],
                capture_output=True, text=True, timeout=300, env=env
            )
            if result.returncode == 0:
                lines = result.stdout.strip().splitlines()
                saved = lines[-1] if lines else ""
                if saved and Path(saved).exists():
                    import shutil
                    shutil.move(saved, str(out_png_path))
                    if out_webp_path:
                        compress_to_webp(out_png_path, out_webp_path)
                    mark_success("ducky")
                    return True, "ducky", out_webp_path
        except Exception as e:
            log(f"  [FAIL] ducky: {e}")
        mark_failure("ducky", cooldown_minutes=60)

    return False, None, None


def get_health_report():
    """Get current model health status"""
    report = {}
    for name in model_health:
        h = model_health[name]
        report[name] = {
            "available": h["available"],
            "last_success": h["last_success"],
            "consecutive_failures": h["consecutive_failures"],
        }
    return report


if __name__ == "__main__":
    # Test: generate one image
    out_png = Path("/tmp/multi-model-test.png")
    out_webp = Path("/tmp/multi-model-test.webp")
    prompt = "暖色水彩儿童绘本风格, 白底, 卡通, 问问兔白兔粉色内耳, 答答熊浅棕熊, 主题: 为什么会下雨"

    success, model, webp = generate_image_multi_model(prompt, out_png, out_webp)
    if success:
        log(f"\n✅ Generated via {model}")
        log(f"  PNG: {out_png} ({out_png.stat().st_size//1024}KB)")
        if webp and webp.exists():
            log(f"  WebP: {webp} ({webp.stat().st_size//1024}KB)")
    else:
        log(f"\n❌ All models failed")

    log(f"\nHealth: {json.dumps(get_health_report(), indent=2)}")
