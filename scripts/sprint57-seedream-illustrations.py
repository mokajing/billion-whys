#!/usr/bin/env python3
# V8.48 第112轮 Sprint 57：seedream 通道插画补齐生成器
# Why: Ducky 429 + Idealab CE-003 双通道阻塞下，诚实探测发现 aone MCP seedream_v4_5 通道未阻塞；
#       本脚本用 seedream 为 post-baseline 首批 nature-046/047/048 补齐插画。
# 法务张律：prompt 仅含场景描述，零身份字段；seedream 内置审核 (auditStatus) 守内容安全。
# 墨小暖+彩虹姐：固定 IP 角色前缀保证 问问兔/答答熊 跨图一致性 (red line #7)。
import json, subprocess, time, sys, os, urllib.request, tempfile

# 固定 IP 角色前缀 (墨小暖: 跨图一致性)
IP_PREFIX = (
    "Style: warm watercolor children's picture book illustration, soft pastel colors, "
    "simple cute flat shapes, gentle cozy mood, clean white background, for 2-6 year old kids. "
    "Characters: Ask Bunny is a small white rabbit with soft pink inner ears tilted forward curiously, "
    "round black dot eyes, simple cartoon; Buddy Bear is a small warm light-brown bear, friendly round face. "
    "Both simple cartoon style, consistent across all images. "
)

# 每题 3 张独有图：layer1(简单) / concept(详图, 复用给 layer2/layer3/experiment) / science(科学图)
PROMPTS = {
    "nature-046": {
        "layer1": "Ask Bunny holding a clear blue-white ice cube that is dripping water drops, Buddy Bear pointing at it warmly. A small puddle of water forming below. Very simple scene.",
        "concept": "Two bowls side by side on a table, one bowl in cool shade holding a solid ice cube, the other bowl in warm sunlight holding an ice cube melting fast into a puddle of water. Warm sun rays shining on the sunlit bowl. Ask Bunny and Buddy Bear watching curiously. Cozy scene.",
        "science": "Simple educational diagram for children: on the left, water molecules arranged in a neat ordered hexagonal lattice labeled as ice; on the right, the same molecules scattered freely labeled as liquid water. Soft blue circular molecules, warm pastel palette, clear and friendly.",
    },
    "nature-047": {
        "layer1": "Ask Bunny standing happily in warm bright yellow sunlight with eyes closed smiling, big warm sun shining rays from the top of the image, Buddy Bear standing beside also enjoying the warmth. Very simple scene.",
        "concept": "A big warm glowing yellow sun in the upper sky sending visible warm orange rays traveling across dark space down to a small green Earth where Ask Bunny and Buddy Bear stand feeling the warmth. Cozy inviting scene.",
        "science": "Simple educational diagram for children: the sun shown as a big glowing ball of fire and gas on the left, with labeled arrows showing light and heat traveling across space to a small Earth on the right. Warm palette, friendly labels, clear layout.",
    },
    "nature-048": {
        "layer1": "A sky split in two halves: left half bright blue with a yellow sun, right half dark navy with a crescent moon and stars. Ask Bunny looking up at the sky, Buddy Bear holding a small ball. Very simple scene.",
        "concept": "Earth shown as a blue and green ball gently rotating in space, a bright sun on the right side lighting up the facing half of Earth in warm daylight, the other half in dark blue night with a moon and stars. Ask Bunny and Buddy Bear watching from a corner. Cozy scene.",
        "science": "Simple educational diagram for children: a flashlight shining warm light onto a round ball representing Earth; the lit side labeled day in bright colors, the dark side labeled night with a moon and stars. A curved arrow showing rotation. Soft pastel palette, clear friendly labels.",
    },
}

def call_mcp(tool, args_json):
    cmd = ["a1", "mcp", "--env", "prod", "call-tool", tool, args_json,
           "--provider", "aone", "--skill-name", "doneai", "--skill-version", "0.13.0"]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
    out = (r.stdout or "") + (r.stderr or "")
    try:
        return json.loads(out.strip().splitlines()[-1] if out.strip() else "{}")
    except Exception:
        # find first { ... }
        s = out.find("{");
        if s < 0: return {"_raw": out}
        try: return json.loads(out[s:])
        except Exception: return {"_raw": out}

def gen_one(prompt, out_png):
    full = IP_PREFIX + prompt
    args = json.dumps({"model":"seedream_v4_5","prompt":full,"generateParams":{"width":2048,"height":2048}})
    r = call_mcp("d.one::liblib_seedream_v4_5", args)
    if not r.get("success"):
        return False, f"submit failed: {r}"
    uuid = r["data"]["generateUuid"]
    for _ in range(30):
        time.sleep(6)
        s = call_mcp("d.one::liblib_get_generate_status", json.dumps({"generateUuid":uuid}))
        imgs = s.get("data",{}).get("images",[])
        if imgs and imgs[0].get("imageUrl"):
            urllib.request.urlretrieve(imgs[0]["imageUrl"], out_png)
            sz = os.path.getsize(out_png)
            return True, f"ok {sz}B from {imgs[0]['imageUrl']}"
    return False, "timeout"

if __name__ == "__main__":
    which = sys.argv[1] if len(sys.argv) > 1 else "all"
    os.makedirs("/tmp/s57-img", exist_ok=True)
    if which == "pilot":
        jobs = [("nature-046","layer1"),("nature-046","concept"),("nature-046","science")]
    elif which == "rest":
        jobs = [(q,k) for q in ["nature-046","nature-047","nature-048"] for k in ["layer1","concept","science"]
                 if not (q=="nature-046")]
        jobs = [(q,k) for q in ["nature-047","nature-048"] for k in ["layer1","concept","science"]]
    else:
        jobs = [(q,k) for q in ["nature-046","nature-047","nature-048"] for k in ["layer1","concept","science"]]
    for q,k in jobs:
        out = f"/tmp/s57-img/{q}-{k}.png"
        if os.path.exists(out) and os.path.getsize(out) > 10240:
            print(f"[skip] {q}-{k} exists"); continue
        ok, msg = gen_one(PROMPTS[q][k], out)
        print(f"[{'OK' if ok else 'FAIL'}] {q}-{k}: {msg}")
