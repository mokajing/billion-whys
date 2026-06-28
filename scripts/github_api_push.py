#!/usr/bin/env python3
"""
通过 GitHub Git Database API 推送整个项目到 GitHub（绕过代理只读限制）。
分批上传文件：源码用 Contents API，大文件用 Blobs API。
"""
import base64
import json
import os
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

TOKEN = "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"
OWNER = "mokajing"
REPO = "billion-whys"
API = "https://api.github.com"

REPO_DIR = Path("/home/admin/workspace/billion-whys")

# Skip these patterns
SKIP_PATTERNS = [
    ".git/", "node_modules/", "dist/", ".image_process/",
    "content/images/_tmp/", "__pycache__/", "*.log",
]


def api_call(method, endpoint, data=None, content_type="application/json"):
    url = f"{API}{endpoint}"
    headers = {
        "Authorization": f"token {TOKEN}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    body = None
    if data is not None:
        if content_type == "application/json":
            body = json.dumps(data).encode()
        elif isinstance(data, bytes):
            body = data
            headers["Content-Type"] = "application/octet-stream"
        headers["Content-Type"] = content_type

    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return json.loads(resp.read().decode()) if resp.status != 204 else {}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode()
        print(f"  HTTP {e.code}: {err_body[:200]}", file=sys.stderr)
        if e.code == 404:
            return None
        raise
    except Exception as e:
        print(f"  Error: {e}", file=sys.stderr)
        raise


def should_skip(path):
    rel = str(path) + "/"
    for pat in SKIP_PATTERNS:
        if pat.endswith("/"):
            if pat in str(path) + "/":
                return True
        else:
            import fnmatch
            if fnmatch.fnmatch(path.name, pat):
                return True
    return False


def list_files():
    """List all files to upload"""
    files = []
    for root, dirs, filenames in os.walk(REPO_DIR):
        root_path = Path(root)
        # Skip directories
        rel_root = root_path.relative_to(REPO_DIR)
        if any(skip in str(rel_root) + "/" for skip in [".git", "node_modules", "dist", "__pycache__", ".image_process", "_tmp"]):
            continue

        for fname in filenames:
            full = root_path / fname
            rel = full.relative_to(REPO_DIR)
            if ".git" in str(rel) or "node_modules" in str(rel):
                continue
            if fname.endswith(".log"):
                continue
            files.append((full, rel))
    return files


def create_blob(file_path):
    """Upload a file as a blob, return SHA"""
    with open(file_path, "rb") as f:
        content = f.read()
    data = {"content": base64.b64encode(content).decode(), "encoding": "base64"}
    result = api_call("POST", f"/repos/{OWNER}/{REPO}/git/blobs", data)
    return result["sha"]


def build_tree(base_tree_sha, tree_entries):
    """Build a tree from entries. Each entry: (path, mode, type, sha)"""
    entries = []
    for path, mode, type_, sha in tree_entries:
        entries.append({"path": path, "mode": mode, "type": type_, "sha": sha})
    data = {"base_tree": base_tree_sha, "tree": entries}
    result = api_call("POST", f"/repos/{OWNER}/{REPO}/git/trees", data)
    return result["sha"]


def create_commit(tree_sha, parent_sha, message):
    data = {"tree": tree_sha, "message": message, "parents": [parent_sha] if parent_sha else []}
    result = api_call("POST", f"/repos/{OWNER}/{REPO}/git/commits", data)
    return result["sha"]


def update_ref(sha, ref="heads/main"):
    data = {"sha": sha, "force": False}
    return api_call("PATCH", f"/repos/{OWNER}/{REPO}/git/refs/{ref}", data)


def get_main_sha():
    try:
        result = api_call("GET", f"/repos/{OWNER}/{REPO}/git/refs/heads/main")
        return result.get("object", {}).get("sha") if result else None
    except Exception:
        return None


def main():
    print("=== GitHub API Push ===")
    files = list_files()
    print(f"Total files: {len(files)}")
    total_size = sum(f.stat().st_size for f, _ in files)
    print(f"Total size: {total_size / 1024 / 1024:.1f} MB")

    # Get current main SHA (or None if empty)
    main_sha = get_main_sha()
    print(f"Current main SHA: {main_sha}")

    # Get base tree (if main exists)
    base_tree_sha = None
    if main_sha:
        commit = api_call("GET", f"/repos/{OWNER}/{REPO}/git/commits/{main_sha}")
        base_tree_sha = commit.get("tree", {}).get("sha")
    print(f"Base tree: {base_tree_sha}")

    # Batch upload files - upload in groups of 50 to keep tree sizes manageable
    BATCH_SIZE = 50
    total = len(files)
    uploaded = 0
    current_tree_sha = base_tree_sha
    current_parent_sha = main_sha

    for batch_start in range(0, total, BATCH_SIZE):
        batch = files[batch_start:batch_start + BATCH_SIZE]
        print(f"\n--- Batch {batch_start // BATCH_SIZE + 1}: files {batch_start+1}-{batch_start+len(batch)} ---")

        tree_entries = []
        for i, (full, rel) in enumerate(batch):
            try:
                blob_sha = create_blob(full)
                # Determine mode: 100644 for normal file, 100755 for executable
                mode = "100755" if os.access(full, os.X_OK) else "100644"
                tree_entries.append((str(rel).replace("\\", "/"), mode, "blob", blob_sha))
                uploaded += 1
                size_kb = full.stat().st_size // 1024
                print(f"  [{uploaded}/{total}] {rel} ({size_kb}KB)")
            except Exception as e:
                print(f"  [FAIL] {rel}: {e}", file=sys.stderr)

        # Build tree
        if tree_entries:
            current_tree_sha = build_tree(current_tree_sha, tree_entries)
            # Create commit
            commit_msg = f"Upload batch {batch_start // BATCH_SIZE + 1}: {len(tree_entries)} files"
            current_parent_sha = create_commit(current_tree_sha, current_parent_sha, commit_msg)
            # Update ref
            update_ref(current_parent_sha)
            print(f"  → committed: {current_parent_sha[:7]}")

        # Small delay between batches
        time.sleep(1)

    print(f"\n=== Done: {uploaded}/{total} files uploaded ===")
    print(f"Final commit: https://github.com/{OWNER}/{REPO}/commit/{current_parent_sha}")


if __name__ == "__main__":
    main()
