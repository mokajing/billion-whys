#!/usr/bin/env python3
"""
DingTalk 真实素材 → billion-whys seed-library 同步 + 补图脚本

工作流：
1. 从钉钉"真实素材"文件夹读取所有题目文档
2. 解析结构化字段（id, question, age, tags, layer1/2/3, science, experiment, ipScene）
3. 与本地 seed-library JSON 对比，新题追加、已有题更新
4. 对每个新题/缺图的题，生成 5 层图片（layer1/2/3, science, experiment）
5. 自动 cron 调用，发现新内容自动补齐

调用：
  python3 sync_dingtalk_materials.py            # 全量同步 + 补图
  python3 sync_dingtalk_materials.py --dry-run  # 只检查，不写文件、不生图
"""
import json
import os
import re
import sys
import time
import subprocess
from pathlib import Path
from datetime import datetime

# DingTalk skill access
SKILL_DIR = Path.home() / ".claude" / "skills" / "devix-dingtalk-skill"
sys.path.insert(0, str(SKILL_DIR))
from scripts.dingtalk_doc import read_doc
from scripts._mcp_client import try_servers as _mcp_try_servers, DingMCPError

BASE_DIR = Path("/home/admin/workspace/billion-whys")
SEED_DIR = BASE_DIR / "content" / "seed-library"
IMAGE_DIR = BASE_DIR / "content" / "images"
GEN_SCRIPT = Path.home() / ".claude" / "skills" / "generate-image" / "generate_image.py"

# DingTalk folder IDs
REAL_MATERIAL_FOLDER_ID = "qnYMoO1rWxnkbPonCjG62BXbJ47Z3je9"
BRAINSTORM_FOLDER_ID = "jb9Y4gmKWrp9bLopC4GZmNxQJGXn6lpz"  # 素材话题 (brainstorm detail files)

ART_STYLE = (
    "儿童绘本插画风格，温暖可爱，色彩明亮，简洁卡通，适合2-6岁幼儿，"
    "扁平化设计，无文字，白色背景，1024x1024"
)

MAX_RETRIES_MCP = 5
MCP_RETRY_DELAY = 10


def mcp_call_with_retry(tool_name, arguments, max_retries=MAX_RETRIES_MCP):
    """Call DingTalk MCP tool with retry on transient errors"""
    for attempt in range(max_retries):
        try:
            return _mcp_try_servers("doc", tool_name, arguments, timeout=90)
        except (DingMCPError, Exception) as e:
            if attempt == max_retries - 1:
                raise
            wait = MCP_RETRY_DELAY * (attempt + 1)
            log(f"  MCP call {tool_name} failed (attempt {attempt+1}): {e}. Retrying in {wait}s...")
            time.sleep(wait)


def list_all_nodes(folder_id):
    """List all nodes in a folder with pagination"""
    all_nodes = []
    page_token = None
    page = 0
    while True:
        page += 1
        args = {"folderId": folder_id, "pageSize": 50}
        if page_token:
            args["pageToken"] = page_token
        log(f"  Fetching page {page} (got {len(all_nodes)} so far)...")
        result = mcp_call_with_retry("list_nodes", args)
        nodes = result.get("nodes", [])
        all_nodes.extend(nodes)
        page_token = result.get("nextPageToken")
        has_more = result.get("hasMore", False)
        if not has_more or not page_token:
            break
        time.sleep(2)
    return all_nodes


def log(msg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def parse_topic_doc(markdown: str, doc_id: str, doc_name: str) -> dict:
    """解析钉钉文档 Markdown 为结构化题目"""
    # Extract metadata from table
    topic = {"id": doc_id, "category": doc_id.split("-")[0].lower()}

    # Extract question
    m = re.search(r'\| \*\*question\*\* \| (.+?) \|', markdown)
    if m:
        topic["question"] = m.group(1).strip()
    else:
        # Fallback: use doc name
        m = re.match(r'^[A-Z]+-\d+\s+(.+?)$', doc_name)
        topic["question"] = m.group(1).rstrip("？?") + "？" if m else doc_name

    m = re.search(r'\| \*\*age\*\* \| (.+?) \|', markdown)
    if m:
        topic["age"] = m.group(1).strip()

    m = re.search(r'\| \*\*tags\*\* \| (.+?) \|', markdown)
    if m:
        topic["tags"] = [t.strip() for t in m.group(1).split("，") if t.strip()]

    # Parse 3 layers
    layer_patterns = [
        ("layer1", r'## 第一层.*?\n\n(.+?)\n\n\*\*追问', re.DOTALL),
        ("layer2", r'## 第二层.*?\n\n(.+?)\n\n\*\*追问', re.DOTALL),
        ("layer3", r'## 第三层.*?\n\n(.+?)\n\n---', re.DOTALL),
    ]

    for key, pat, flags in layer_patterns:
        m = re.search(pat, markdown, flags)
        if m:
            answer = m.group(1).strip()
            # Find follow-up
            fu_m = re.search(r'\*\*追问：\*\*\s*(.+?)$', markdown[m.end():], re.MULTILINE)
            follow_up = fu_m.group(1).strip() if fu_m else ""
            topic[key] = {
                "answer": answer,
                "followUp": follow_up,
                "image": ""
            }

    # Science
    m = re.search(r'## 给大人的科学原理\s*\n\n(.+?)\n\n---', markdown, re.DOTALL)
    if m:
        topic["science"] = m.group(1).strip()
        topic["scienceImage"] = ""

    # Experiment
    m = re.search(r'## 亲子小实验\s*\n\n(.+?)(?=### 实验材料清单|---|$)', markdown, re.DOTALL)
    if m:
        exp_text = m.group(1).strip()
        # Parse steps
        steps = []
        for line in exp_text.split("\n"):
            line = line.strip()
            if re.match(r'^\d+\.', line):
                steps.append(re.sub(r'^\d+\.\s*', '', line))

        # Materials
        mat_m = re.search(r'### 实验材料清单\s*\n\n(.+?)(?=---|$)', markdown, re.DOTALL)
        materials = []
        if mat_m:
            for line in mat_m.group(1).split("\n"):
                line = line.strip().rstrip("。.")
                if line and not line.startswith("---"):
                    materials.extend([m.strip() for m in re.split(r"[、,，]", line) if m.strip()])

        topic["experiment"] = {
            "name": topic["question"] + "·小实验",
            "steps": steps,
            "materials": materials,
            "image": ""
        }

    # IP scene
    m = re.search(r'## IP角色互动场景.*?\n>.*?\n\n(.+?)(?=\*\*插画风格|$)', markdown, re.DOTALL)
    if m:
        topic["ipScene"] = m.group(1).strip()

    return topic




def parse_brainstorm_doc(markdown: str, doc_name: str) -> list:
    """解析 brainstorm 详细内容文档（多题/文件）为结构化题目列表"""
    topics = []
    # Split by ### topic headers (lowercase id like animals-2071)
    blocks = re.split(r'\n###\s+([a-z]+-\d+)\s*\n', markdown)
    for i in range(1, len(blocks), 2):
        tid = blocks[i]
        content = blocks[i+1] if i+1 < len(blocks) else ""
        cat = tid.rsplit("-", 1)[0]
        topic = {"id": tid, "category": cat, "tags": [], "safetyLevel": "A", "locale": "zh-CN"}

        m = re.search(r'\*\*问题\*\*[:：]\s*(.+?)\s*\*\*', content)
        if m: topic["question"] = m.group(1).strip()
        m = re.search(r'\*\*年龄段\*\*[:：]\s*(.+?)\s*\*\*', content)
        if m: topic["age"] = m.group(1).strip()

        m = re.search(r'\*\*Layer 1[^*]*\*\*[:：]\s*(.+?)(?:\*\*追问|$)', content, re.DOTALL)
        if m: topic["layer1"] = {"answer": m.group(1).strip(), "image": ""}
        m = re.search(r'\*\*Layer 2[^*]*\*\*[:：]\s*(.+?)(?:\*\*追问|$)', content, re.DOTALL)
        if m: topic["layer2"] = {"answer": m.group(1).strip(), "image": ""}
        m = re.search(r'\*\*Layer 3[^*]*\*\*[:：]\s*(.+?)(?:\*\*科学原理|$)', content, re.DOTALL)
        if m: topic["layer3"] = {"answer": m.group(1).strip(), "image": ""}

        m = re.search(r'\*\*科学原理\*\*[:：]\s*(.+?)(?:\*\*实验|$)', content, re.DOTALL)
        if m:
            topic["science"] = m.group(1).strip()
            topic["scienceImage"] = ""

        m = re.search(r'\*\*实验\*\*[:：]\s*(.+?)(?:\*\*材料|$)', content, re.DOTALL)
        exp_steps = []
        if m:
            exp_steps = [m.group(1).strip()]
        m = re.search(r'\*\*材料\*\*[:：]\s*(.+?)(?:\*\*IP场景|$)', content, re.DOTALL)
        materials = []
        if m:
            materials = [x.strip() for x in re.split(r'[、,，]', m.group(1)) if x.strip()]
        topic["experiment"] = {
            "name": topic.get("question", "") + "·小实验",
            "steps": exp_steps,
            "materials": materials,
            "image": "",
            "sayToChild": "",
            "duration": "约5分钟",
            "safetyNote": "需家长全程陪同",
            "experimentType": "观察"
        }
        m = re.search(r'\*\*IP场景\*\*[:：]\s*(.+?)(?:---|$)', content, re.DOTALL)
        if m: topic["ipScene"] = m.group(1).strip()
        topic["warmClosing"] = ""

        if topic.get("question"):
            topics.append(topic)
    return topics

def load_seed_library():
    """Load all seed-library JSON files into dict by id (lowercase keys for case-insensitive match)"""
    all_topics = {}
    for cat_file in SEED_DIR.glob("*.json"):
        cat = cat_file.stem
        data = json.load(open(cat_file))
        for q in data:
            q["_category_file"] = cat
            # Index by lowercase ID for case-insensitive match
            all_topics[q["id"].lower()] = q
    return all_topics


def _passes_merge_bar(q: dict) -> bool:
    """Sprint 63 第118轮：#35 merge bar 写边界守卫（CTO + 后端老稳 + 安全李姐）。

    未插画题（5 slot 任一空）不得入 live。live 只接收完整三层 + 科学 + 实验 + 全插画题。
    未过门题路由 content/seed-library-staging/{cat}-pending.json，待 governed 流程补齐后 promote。
    背景：Sprint 62 修了 gen_category_images.py 的 read-modify-write 竞态，但 sync 通道仍是 live 直写，
    image_gen_supervisor / cron 拉 sync 时未插画新题直接 merge 进 live → 绕过 #35 → 红灯复发。
    毒舌老王："治理门写在测试里，等于事后验尸；要写在写边界上才是门。"
    """
    # 5 slot：layer1/layer2/layer3/experiment 的 image 子字段 + scienceImage 顶层
    for slot in ("layer1", "layer2", "layer3", "experiment"):
        v = q.get(slot)
        if not isinstance(v, dict) or not v.get("image"):
            return False
    if not q.get("scienceImage"):
        return False
    return True


def save_seed_library(topics_by_cat):
    """Save topics back to category JSON files.

    Sprint 63 第118轮：写边界 merge bar 守卫 —— 过门题写 live，未过门题路由 staging。
    """
    staging_dir = BASE_DIR / "content" / "seed-library-staging"
    staging_dir.mkdir(parents=True, exist_ok=True)
    for cat, topics in topics_by_cat.items():
        # Remove _category_file marker
        clean = [{k: v for k, v in t.items() if not k.startswith("_")} for t in topics]
        live_ready = [q for q in clean if _passes_merge_bar(q)]
        pending = [q for q in clean if not _passes_merge_bar(q)]
        # live：仅过 merge bar 的题（保留原有 live 题若已被 sync 加载，则原样写回；
        # 未过门的 live 原有题若被误判，见下方 staging 兜底）
        path = SEED_DIR / f"{cat}.json"
        with open(path, "w", encoding="utf-8") as f:
            json.dump(live_ready, f, ensure_ascii=False, indent=2)
        msg = f"  Saved LIVE {path}: {len(live_ready)} topics"
        if pending:
            staging_path = staging_dir / f"{cat}-pending.json"
            with open(staging_path, "w", encoding="utf-8") as f:
                json.dump(pending, f, ensure_ascii=False, indent=2)
            msg += f" | STAGING {staging_path}: {len(pending)} (未过 #35 merge bar，待 governed 补齐)"
        log(msg)
    # Sprint 64 第119轮：PNG 写边界闭合 —— save_seed_library 后扫孤儿 PNG。
    _sweep_orphan_pngs(topics_by_cat.keys())


def _live_topic_ids(cat: str) -> set:
    """Sprint 64 第119轮：返回 live seed-library 某 cat 全部 topic id 集合。"""
    ids = set()
    live_path = SEED_DIR / f"{cat}.json"
    if not live_path.exists():
        return ids
    try:
        topics = json.loads(live_path.read_text(encoding="utf-8"))
    except Exception:
        return ids
    for q in topics:
        if isinstance(q, dict) and q.get("id"):
            ids.add(q["id"])
    return ids


def _image_file_topic_id(filename: str):
    """Sprint 64 第119轮：从图片文件名反推 topic id。

    文件名形如 animals-2071-layer1.png / body-001-layer3.webp /
    animals-046-science.png / body-001-experiment.webp / body-001.png。
    去掉扩展名 + 末尾 -layer1/-layer2/-layer3/-science/-experiment 即得 topic id。
    """
    name = filename
    for ext in (".png", ".webp", ".jpg", ".jpeg"):
        if name.lower().endswith(ext):
            name = name[: -len(ext)]
            break
    for suffix in ("-layer1", "-layer2", "-layer3", "-science", "-experiment"):
        if name.endswith(suffix):
            name = name[: -len(suffix)]
            break
    return name


def _staging_pending_topic_ids_with_empty_images(cat: str) -> set:
    """Sprint 66 第121轮：返回 staging-pending 中 image 字段全空的 topic id 集合。

    这些 topic 在 staging-pending 但 image 字段为空 → 未过 merge bar → 任何对应 PNG 是真孤儿。
    仅检查 staging-pending JSON（seed-library-staging/{cat}-pending.json），不检查 _staging 目录。
    """
    ids = set()
    pending_path = BASE_DIR / "content" / "seed-library-staging" / f"{cat}-pending.json"
    if not pending_path.exists():
        return ids
    try:
        topics = json.loads(pending_path.read_text(encoding="utf-8"))
    except Exception:
        return ids
    for q in topics:
        if not isinstance(q, dict):
            continue
        tid = q.get("id")
        if not tid:
            continue
        # 检查 image 字段是否全空
        layer_images = [
            (q.get("layer1") or {}).get("image", ""),
            (q.get("layer2") or {}).get("image", ""),
            (q.get("layer3") or {}).get("image", ""),
        ]
        # Sprint 67 修复：science 是字符串文本，图片 URL 在独立 scienceImage 字段
        science_img = q.get("scienceImage", "")
        experiment_img = (q.get("experiment") or {}).get("image", "")
        all_empty = all(not img for img in layer_images + [science_img, experiment_img])
        if all_empty:
            ids.add(tid)
    return ids


def _sweep_orphan_pngs(cats) -> int:
    """Sprint 64 第119轮：删除 content/images/{cat}/ 下 topic id 不在 live JSON 的孤儿图片。
    Sprint 66 第121轮扩展：同时检查 staging-pending 中 image 字段全空的 topic。
    Sprint 67 第122轮修复：孤儿定义 = file exists && topic_id NOT IN live_catalog。
    无论 staging-pending 中 image 字段是否为空，不在 live 的图片一律视为孤儿删除。
    对应题要么未过 merge bar，要么已从 live 回退——留在磁盘只会在
    sync-images 时让 src > dest 触发 build-integrity 红灯。

    注意：live JSON 的 image 字段引用 .webp，但磁盘上同时存在同 topic 的 .png（如 body-001.png）
    属于同 topic 的合法格式变体，topic id 在 live 即保留——所以用 topic id 判孤儿而非按文件名引用。
    CTO + 后端老稳 + 测试虫虫 + 毒舌老王。
    法务张律：image 不计 #33 baseline 文本 hash，零身份字段零网络。
    """
    removed = 0
    for cat in cats:
        cat_dir = IMAGE_DIR / cat
        if not cat_dir.exists():
            continue
        live_ids = _live_topic_ids(cat)
        # Sprint 66：staging-pending 中 image 全空的 topic 也是孤儿候选（辅助检查）
        staging_empty_ids = _staging_pending_topic_ids_with_empty_images(cat)
        for f in cat_dir.iterdir():
            if not f.is_file():
                continue
            if f.suffix.lower() not in (".png", ".webp", ".jpg", ".jpeg"):
                continue
            tid = _image_file_topic_id(f.name)
            # Sprint 67 第122轮：不在 live 即孤儿（主规则），staging_empty_ids 为辅助日志
            if tid not in live_ids:
                reason = "不在 live"
                if tid in staging_empty_ids:
                    reason += " + staging-pending image 全空"
                try:
                    f.unlink()
                    removed += 1
                    log(f"  [SWEEP] 删孤儿图片 {f} (topic {tid} {reason})")
                except Exception as e:
                    log(f"  [SWEEP-SKIP] {f}: {e}")
    if removed:
        log(f"  孤儿图片清理完成：删 {removed} 个")
    return removed


def sweep_orphan_pngs_standalone():
    """Sprint 67 第122轮：独立孤儿 PNG 扫描入口。
    供 build 脚本、pre-commit hook、cron 定时任务调用。
    扫描全部 6 个 category，删除不在 live 的孤儿图片。
    """
    cats = ["body", "animals", "food", "home", "nature", "society"]
    removed = _sweep_orphan_pngs(cats)
    return removed


def generate_image(prompt: str, out_path: Path, max_retries: int = 4) -> bool:
    """Generate an image, returns success"""
    if out_path.exists() and out_path.stat().st_size > 1000:
        return True

    out_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_dir = BASE_DIR / "content" / "images" / "_tmp"
    tmp_dir.mkdir(parents=True, exist_ok=True)

    env = os.environ.copy()
    env["IMAGE_OUTPUT_DIR"] = str(tmp_dir)

    for attempt in range(max_retries):
        if attempt > 0:
            wait = 30 * (2 ** (attempt - 1))
            log(f"    retry {attempt}/{max_retries-1} in {wait}s...")
            time.sleep(wait)

        try:
            result = subprocess.run(
                [sys.executable, str(GEN_SCRIPT), "--prompt", prompt[:2000]],
                capture_output=True, text=True, timeout=300, env=env
            )
            if result.returncode != 0:
                if "429" in result.stderr or "Too Many" in result.stderr:
                    continue
                log(f"    FAIL: {result.stderr[-200:]}")
                return False

            # Find generated file
            lines = result.stdout.strip().splitlines()
            saved = lines[-1] if lines else ""
            if saved and Path(saved).exists():
                import shutil
                shutil.move(saved, str(out_path))
                return True
            return False
        except Exception as e:
            log(f"    error: {e}")
            return False
    return False


def ensure_image(topic_id: str, layer: str, prompt: str, dry_run: bool = False) -> str:
    """Generate image if missing, return relative path.

    Sprint 67 第122轮修复：仅对 live JSON 中的 topic 生成图片。
    非 live topic（在 staging-pending / 未过 merge bar）跳过生图——避免孤儿 PNG 沉积。
    """
    cat = topic_id.split("-")[0].lower()
    rel_path = f"images/{cat}/{topic_id}-{layer}.png"
    abs_path = BASE_DIR / "content" / rel_path

    # Sprint 67 第122轮：不在 live 的 topic 不生成图片（防止孤儿 PNG）
    live_ids = _live_topic_ids(cat)
    if topic_id not in live_ids:
        log(f"  [SKIP] {topic_id}-{layer}: topic 不在 live（在 staging-pending），跳过生图防孤儿 PNG")
        return ""

    if abs_path.exists() and abs_path.stat().st_size > 1000:
        return rel_path

    if dry_run:
        log(f"  [DRY] need: {rel_path}")
        return ""

    log(f"  Generating {topic_id}-{layer}...")
    if generate_image(prompt, abs_path):
        log(f"    OK: {rel_path} ({abs_path.stat().st_size//1024}KB)")
        time.sleep(15)  # rate limit
        return rel_path
    else:
        log(f"    FAILED: {rel_path}")
        return ""


def sync(dry_run: bool = False):
    log("=== DingTalk 真实素材 → seed-library 同步 ===")

    # Step 1: List all 真实素材 files with pagination
    nodes = list_all_nodes(REAL_MATERIAL_FOLDER_ID)
    log(f"DingTalk 真实素材: {len(nodes)} files")
    # Also scan brainstorm 素材话题 folder for multi-topic detail files
    bs_nodes = list_all_nodes(BRAINSTORM_FOLDER_ID)
    bs_detail = [n for n in bs_nodes if "详细内容" in n.get("name", "")]
    log(f"DingTalk 素材话题 brainstorm: {len(bs_detail)} detail files")

    # Step 2: Load local seed-library
    local_topics = load_seed_library()
    log(f"Local seed-library: {len(local_topics)} topics")

    # Group by category
    by_cat = {cat: [] for cat in ["body", "animals", "food", "home", "nature", "society"]}
    for tid, t in local_topics.items():
        cat = t.get("_category_file", t.get("category", "body"))
        if cat in by_cat:
            by_cat[cat].append(t)

    # Step 3: Parse each DingTalk doc, sync to local
    new_count = 0
    updated_count = 0
    missing_images = []

    for n in nodes:
        name = n.get("name", "")
        node_id = n.get("nodeId")

        # Parse ID from name (normalize to lowercase for matching)
        m = re.match(r'^([A-Z]+)-(\d+)', name)
        if not m:
            continue
        cat = m.group(1).lower()
        num = int(m.group(2))
        topic_id = f"{cat}-{num:03d}"  # lowercase e.g. "animals-046"
        topic_id_display = f"{m.group(1)}-{num:03d}"  # original case for display

        log(f"\nProcessing {topic_id_display}: {name}")

        # Read doc with retry
        try:
            doc_result = mcp_call_with_retry("get_document_content", {"nodeId": f"https://alidocs.dingtalk.com/i/nodes/{node_id}"})
            md = doc_result.get("markdown", "")
            if not md:
                log(f"  empty doc, skip")
                continue
        except Exception as e:
            log(f"  read failed: {e}")
            continue

        # Parse
        try:
            topic = parse_topic_doc(md, topic_id, name)
        except Exception as e:
            log(f"  parse failed: {e}")
            continue

        # Sync to local (case-insensitive match)
        lookup_key = topic_id.lower()  # lowercase
        if lookup_key in local_topics:
            local = local_topics[lookup_key]
            # Update fields if missing
            updated = False
            for key in ["question", "age", "tags", "layer1", "layer2", "layer3", "science", "scienceImage", "experiment", "ipScene"]:
                if key in topic and (key not in local or not local.get(key)):
                    local[key] = topic[key]
                    updated = True
            if updated:
                updated_count += 1
                log(f"  updated existing")
            # Use existing local to check images
            topic = local
        else:
            # New topic
            new_count += 1
            log(f"  NEW topic!")
            by_cat[cat].append(topic)
            local_topics[lookup_key] = topic
            topic["_category_file"] = cat

        # Check missing images
        for layer_key in ["layer1", "layer2", "layer3"]:
            layer_data = topic.get(layer_key, {})
            if layer_data and not layer_data.get("image"):
                img_rel = f"images/{cat}/{topic_id}-{layer_key}.png"
                img_abs = BASE_DIR / "content" / img_rel
                if not (img_abs.exists() and img_abs.stat().st_size > 1000):
                    missing_images.append((topic_id, layer_key, layer_data.get("answer", "")[:80]))

        if topic.get("science") and not topic.get("scienceImage"):
            img_rel = f"images/{cat}/{topic_id}-science.png"
            img_abs = BASE_DIR / "content" / img_rel
            if not (img_abs.exists() and img_abs.stat().st_size > 1000):
                missing_images.append((topic_id, "science", topic.get("science", "")[:80]))

        exp = topic.get("experiment", {})
        if exp and not exp.get("image"):
            img_rel = f"images/{cat}/{topic_id}-experiment.png"
            img_abs = BASE_DIR / "content" / img_rel
            if not (img_abs.exists() and img_abs.stat().st_size > 1000):
                missing_images.append((topic_id, "experiment", exp.get("name", "")[:80]))

    # Step 3.5: Parse brainstorm detail files (multi-topic per doc)
    for n in bs_detail:
        name = n.get("name", "")
        node_id = n.get("nodeId")
        try:
            doc_result = read_doc(url=f"https://alidocs.dingtalk.com/i/nodes/{node_id}")
            md = doc_result.get("markdown", "")
            if not md: continue
            bs_topics = parse_brainstorm_doc(md, name)
            for topic in bs_topics:
                tid = topic["id"].lower()
                cat = topic["category"]
                if cat not in by_cat: continue
                if tid in local_topics:
                    # Update missing fields
                    local = local_topics[tid]
                    updated = False
                    for key in ["question","age","tags","layer1","layer2","layer3","science","scienceImage","experiment","ipScene"]:
                        if key in topic and (key not in local or not local.get(key)):
                            local[key] = topic[key]
                            updated = True
                    if updated:
                        updated_count += 1
                        log(f"  updated {tid} from brainstorm")
                    topic = local
                else:
                    # New topic
                    new_count += 1
                    log(f"  NEW brainstorm topic: {tid}")
                    by_cat[cat].append(topic)
                    local_topics[tid] = topic
                    topic["_category_file"] = cat
                # Check missing images
                for layer_key in ["layer1","layer2","layer3"]:
                    ld = topic.get(layer_key, {})
                    if ld and not ld.get("image"):
                        img_rel = f"images/{cat}/{tid}-{layer_key}.png"
                        img_abs = BASE_DIR / "content" / img_rel
                        if not (img_abs.exists() and img_abs.stat().st_size > 1000):
                            missing_images.append((tid, layer_key, ld.get("answer","")[:80]))
                if topic.get("science") and not topic.get("scienceImage"):
                    img_rel = f"images/{cat}/{tid}-science.png"
                    img_abs = BASE_DIR / "content" / img_rel
                    if not (img_abs.exists() and img_abs.stat().st_size > 1000):
                        missing_images.append((tid, "science", topic.get("science","")[:80]))
                exp = topic.get("experiment", {})
                if exp and not exp.get("image"):
                    img_rel = f"images/{cat}/{tid}-experiment.png"
                    img_abs = BASE_DIR / "content" / img_rel
                    if not (img_abs.exists() and img_abs.stat().st_size > 1000):
                        missing_images.append((tid, "experiment", exp.get("name","")[:80]))
        except Exception as e:
            log(f"  brainstorm read failed {name}: {e}")

    log(f"\n=== Sync Summary ===")
    log(f"New topics: {new_count}")
    log(f"Updated topics: {updated_count}")
    log(f"Missing images: {len(missing_images)}")

    # Step 4: Save updated seed-library
    if not dry_run and (new_count > 0 or updated_count > 0):
        save_seed_library(by_cat)

    # Step 5: Generate missing images
    if not dry_run and missing_images:
        log(f"\n=== Generating {len(missing_images)} missing images ===")
        for i, (topic_id, layer, summary) in enumerate(missing_images):
            log(f"[{i+1}/{len(missing_images)}] {topic_id}-{layer}")
            cat = topic_id.split("-")[0].lower()

            if layer in ["layer1", "layer2", "layer3"]:
                prompt = f"为儿童绘本插画：{summary}。{ART_STYLE}"
            elif layer == "science":
                prompt = f"科学原理信息图，给家长看的：{summary}。简洁清晰的科普插画风格，色彩明亮，无文字，白色背景"
            elif layer == "experiment":
                prompt = f"亲子实验示意图：{summary}。儿童绘本插画风格，温暖可爱，展示实验步骤场景，无文字，白色背景"
            else:
                continue

            rel = ensure_image(topic_id, layer, prompt, dry_run=False)
            if rel:
                # Update JSON
                if layer in ["layer1", "layer2", "layer3"]:
                    local_topics[topic_id].setdefault(layer, {})["image"] = rel
                elif layer == "science":
                    local_topics[topic_id]["scienceImage"] = rel
                elif layer == "experiment":
                    local_topics[topic_id].setdefault("experiment", {})["image"] = rel

        # Save updated JSONs with image paths
        save_seed_library(by_cat)

    log(f"\n=== Done ===")


if __name__ == "__main__":
    dry = "--dry-run" in sys.argv
    if "--sweep-only" in sys.argv:
        log("=== 孤儿 PNG 独立扫描 ===")
        removed = sweep_orphan_pngs_standalone()
        log(f"=== 扫描完成：删 {removed} 个孤儿图片 ===")
    else:
        sync(dry_run=dry)
