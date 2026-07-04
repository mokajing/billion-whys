#!/usr/bin/env python3
# V8.50 第114轮 Sprint 59：9 张重复插画重新生成为独立 concept
# Why: Sprint 58 人工 IP 审计 FAIL —— 3 题各 layer2/layer3/experiment 三 slot 字节级同 md5
#       （9 张重复 / 15），但三层语义完全不同，复用同图给 2-6 岁孩子植入错误心智模型
#       （触 red line #1 科学准确性 + #7 插画叙事清晰）。
#       本轮用 seedream 通道为 9 个 slot 各生成独立 concept，prompt 严格匹配该层语义。
# 法务张律：prompt 仅含场景描述，零身份字段；seedream 内置 audit 守内容安全。
# 墨小暖+彩虹姐：固定 IP 角色前缀保证 问问兔/答答熊 跨图一致性 (red line #7)。
# 科普陈博士+CCO：9 张 prompt 各对应 layer2/layer3/experiment 真实语义，杜绝同图异义。
import json, subprocess, time, sys, os, urllib.request, hashlib

IP_PREFIX = (
    "Style: warm watercolor children's picture book illustration, soft pastel colors, "
    "simple cute flat shapes, gentle cozy mood, clean white background, for 2-6 year old kids. "
    "Characters: Ask Bunny is a small white rabbit with soft pink inner ears tilted forward curiously, "
    "round black dot eyes, simple cartoon; Buddy Bear is a small warm light-brown bear, friendly round face. "
    "Both simple cartoon style, consistent across all images. "
)

# 9 个 slot 各自独立 prompt，严格匹配该层语义（科普陈博士+CCO 审）
PROMPTS = {
    "nature-046": {
        # L2: 水分子排队整齐 → 暖和松手到处跑（解散类比）
        "layer2": "Two side-by-side small scenes for children: on the left, many small blue water dots holding hands in a neat straight line standing orderly like a queue; on the right, the same blue dots letting go and running freely in all directions with motion lines. Ask Bunny and Buddy Bear watching. Cozy friendly educational scene.",
        # L3: 水冰气三态循环（分子近/散/飞）
        "layer3": "A simple circular cycle diagram for children showing three forms: at top, blue water dots flying up labeled as steam; at bottom-left, blue dots close together as ice; at bottom-right, blue dots scattered as water. Curved arrows connecting them in a loop. Ask Bunny and Buddy Bear watching from a corner. Warm pastel educational illustration.",
        # EXP: 冰块赛跑——两碗各一块冰，一阴一阳
        "experiment": "Two bowls side by side on a table: left bowl in cool shade holding a solid ice cube barely melting; right bowl in warm bright sunlight holding an ice cube melting fast into a puddle of water with drips. Warm sun rays shining only on the right bowl. Ask Bunny pointing at the sunny bowl, Buddy Bear beside. Cozy scene.",
    },
    "nature-047": {
        # L2: 热量像看不见的小子弹从太阳飞越太空到地球（8分钟）
        "layer2": "A big warm glowing yellow sun on the upper left sending a stream of tiny glowing orange dots traveling across dark space like little bullets, arriving at a small green Earth on the lower right where Ask Bunny stands feeling the warmth, Buddy Bear beside. Dotted travel path showing the journey. Cozy educational scene.",
        # L3: 太阳肚子里核聚变 + 46亿年/50亿年时间尺度
        "layer3": "A cutaway view of the sun showing its inside: a glowing hot core where small gas particles collide and merge sending out bright rays of light and heat, labeled 4.6 billion years past and 5 billion years future with simple icons. Ask Bunny and Buddy Bear watching from outside. Warm educational illustration, friendly labels.",
        # EXP: 阳光冰块实验——太阳晒冰化得快
        "experiment": "Two ice cubes outdoors: one in bright warm sunlight melting fast into a puddle with drips and steam wavy lines, one in cool shade still solid. A big warm sun shining rays only onto the sunny ice. Ask Bunny pointing at the melting sunny ice, Buddy Bear holding a stopwatch. Cozy friendly scene.",
    },
    "nature-048": {
        # L2: 孩子围篝火转动——对火那面亮背火那面暗（一天一圈类比）
        "layer2": "A warm cozy campfire in the center; Ask Bunny walking in a circle around the campfire — the side of Ask Bunny facing the fire is lit warm bright, the side facing away is in soft shadow. A dotted circular arrow showing one full loop labeled one day. Buddy Bear watching. Simple friendly educational scene.",
        # L3: 地球圆太阳照一半，晨昏线分界，半球轮流白天黑夜
        "layer3": "A big round blue-and-green Earth floating in space, half of it lit warm bright yellow by the sun on the right (day side), the other half in soft dark blue with a moon and stars (night side), a clear curved dividing line between the two halves. Ask Bunny and Buddy Bear watching from a corner. Warm pastel educational illustration.",
        # EXP: 手电筒照皮球，转动看亮暗
        "experiment": "In a cozy dim room, a flashlight on the left shining warm light onto a round ball representing Earth; the lit side bright, the far side dark. A small hand gently turning the ball with a curved arrow showing rotation. Ask Bunny holding the flashlight, Buddy Bear turning the ball. Friendly educational scene.",
    },
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
    out_dir = "/tmp/s59-img"
    os.makedirs(out_dir, exist_ok=True)
    jobs = [(q, k) for q in ["nature-046", "nature-047", "nature-048"]
            for k in ["layer2", "layer3", "experiment"]]
    for q, k in jobs:
        out = f"{out_dir}/{q}-{k}.png"
        if os.path.exists(out) and os.path.getsize(out) > 10240:
            print(f"[skip] {q}-{k} exists {os.path.getsize(out)}B")
            continue
        ok, msg = gen_one(PROMPTS[q][k], out)
        print(f"[{'OK' if ok else 'FAIL'}] {q}-{k}: {msg}")
    # md5 distinctness check
    print("\n=== MD5 distinctness ===")
    hashes = {}
    for q in ["nature-046", "nature-047", "nature-048"]:
        for k in ["layer2", "layer3", "experiment"]:
            p = f"{out_dir}/{q}-{k}.png"
            if os.path.exists(p):
                h = hashlib.md5(open(p, "rb").read()).hexdigest()[:12]
                hashes[f"{q}-{k}"] = h
                print(f"{q}-{k}: {h}")
    distinct = len(set(hashes.values()))
    print(f"\ndistinct = {distinct} / 9")
    if distinct == 9:
        print("PASS: 9 张全部独立")
    else:
        print("FAIL: 仍有重复")
