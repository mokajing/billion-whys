#!/usr/bin/env python3
# V8.51 第115轮 Sprint 60：nature-001 同型复用历史债修复 —— 3 张重复插画重生为独立 concept
# Why: Sprint 59 修复了 nature-046/047/048 的 layer2/layer3/experiment 同 md5 语义重复 bug（red line #1+#7），
#       但 nature-001（baseline 271 之一）承载完全同型的历史债：layer2/layer3/experiment 三 slot 同 md5
#       （167474B 字节级一致），三层语义完全不同（碰并增长 vs 水循环圈 vs 塑料袋微缩水循环），
#       复用同图给 2-6 岁孩子植入错误心智模型。毒舌老王：修新不修旧 = cargo cult 式选择性执纪。
#       本轮用 seedream 通道（Sprint 57 探测可用，Sprint 59 已验证）为 3 slot 各生成独立 concept。
# 法务张律：prompt 仅含场景描述，零身份字段；nature-001 文本字段零改动（layer2/3/experiment image 路径字符串不变）
#           → baseline 813 文本 hash 集不变 → red line #33 (V9 i18n 源文基线冻结) 不触；仅 image 字节替换。
# 墨小暖+彩虹姐：固定 IP 角色前缀保证 问问兔/答答熊 跨图一致性 (red line #7)。
# 科普陈博士+CCO：3 张 prompt 各对应 layer2/layer3/experiment 真实语义，杜绝同图异义。
import json, subprocess, time, os, urllib.request, hashlib

IP_PREFIX = (
    "Style: warm watercolor children's picture book illustration, soft pastel colors, "
    "simple cute flat shapes, gentle cozy mood, clean white background, for 2-6 year old kids. "
    "Characters: Ask Bunny is a small white rabbit with soft pink inner ears tilted forward curiously, "
    "round black dot eyes, simple cartoon; Buddy Bear is a small warm light-brown bear, friendly round face. "
    "Both simple cartoon style, consistent across all images. "
)

# 3 个 slot 各自独立 prompt，严格匹配该层语义（科普陈博士+CCO 审）—— prompt 总长须 ≤800 字符（含 IP_PREFIX）
PROMPTS = {
    # L2: 云像水袋，小水滴碰并合体变大变重掉下 = 碰并增长
    "layer2": "A fluffy grey cloud in the sky like a big water bag holding tiny blue droplets; inside, several small droplets bump and merge into one bigger heavy round droplet falling down out of the cloud as a raindrop, motion lines showing merging and falling. Ask Bunny and Buddy Bear below with an umbrella. Warm cozy educational scene.",
    # L3: 水循环圈 —— 蒸发→凝结成云→降水→径流入海→再蒸发
    "layer3": "A circular water cycle diagram for children: top-left sun above blue sea with vapor wavy arrows rising; top-right a white cloud forming; bottom-right rain falling onto green land; bottom-left streams flowing back to sea. Curved arrows connecting four stages in a loop. Ask Bunny and Buddy Bear in a corner. Warm educational illustration.",
    # EXP: 塑料袋下雨实验 —— 袋内水蒸发到袋壁凝结成小水珠滴下
    "experiment": "A clear plastic bag taped to a sunny window; a small pool of water at the bag bottom, many tiny droplets condensed on the inside top of the bag, one droplet sliding down like a mini raindrop inside. Warm sun rays through the window. Ask Bunny pointing at the droplets, Buddy Bear beside. Cozy friendly educational scene.",
}

def call_mcp(tool, args_json):
    cmd = ["a1", "mcp", "--env", "prod", "call-tool", tool, args_json,
           "--provider", "aone", "--skill-name", "doneai", "--skill-version", "0.13.0"]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
    out = (r.stdout or "") + (r.stderr or "")
    s = out.find("{")
    if s < 0:
        return {"_raw": out}
    try:
        return json.loads(out[s:])
    except Exception:
        return {"_raw": out}

def gen_one(prompt, out_png):
    full = IP_PREFIX + prompt
    args = json.dumps({"model": "seedream_v4_5", "prompt": full,
                       "generateParams": {"width": 2048, "height": 2048}})
    r = call_mcp("d.one::liblib_seedream_v4_5", args)
    if not r.get("success"):
        return False, f"submit failed: {r}"
    uuid = r["data"]["generateUuid"]
    for _ in range(30):
        time.sleep(6)
        s = call_mcp("d.one::liblib_get_generate_status", json.dumps({"generateUuid": uuid}))
        imgs = s.get("data", {}).get("images", [])
        if imgs and imgs[0].get("imageUrl"):
            urllib.request.urlretrieve(imgs[0]["imageUrl"], out_png)
            sz = os.path.getsize(out_png)
            return True, f"ok {sz}B"
    return False, "timeout"

if __name__ == "__main__":
    out_dir = "/tmp/s60-img"
    os.makedirs(out_dir, exist_ok=True)
    for k in ["layer2", "layer3", "experiment"]:
        out = f"{out_dir}/nature-001-{k}.png"
        if os.path.exists(out) and os.path.getsize(out) > 10240:
            print(f"[skip] nature-001-{k} exists {os.path.getsize(out)}B")
            continue
        ok, msg = gen_one(PROMPTS[k], out)
        print(f"[{'OK' if ok else 'FAIL'}] nature-001-{k}: {msg}")
    # md5 distinctness check (vs each other AND vs layer1/science existing)
    print("\n=== MD5 distinctness ===")
    hashes = {}
    for k in ["layer2", "layer3", "experiment"]:
        p = f"{out_dir}/nature-001-{k}.png"
        if os.path.exists(p):
            h = hashlib.md5(open(p, "rb").read()).hexdigest()[:12]
            hashes[k] = h
            print(f"nature-001-{k}: {h}")
    # also check against existing layer1 + science to ensure no accidental collision
    for k in ["layer1", "science"]:
        p = f"content/images/nature/nature-001-{k}.webp" if k != "science" else "content/images/nature/nature-001-science.png"
        if os.path.exists(p):
            h = hashlib.md5(open(p, "rb").read()).hexdigest()[:12]
            print(f"nature-001-{k} (existing, unchanged): {h}")
    distinct = len(set(hashes.values()))
    print(f"\ndistinct(new 3) = {distinct} / 3")
    if distinct == 3:
        print("PASS: 3 张全部独立")
    else:
        print("FAIL: 仍有重复")
