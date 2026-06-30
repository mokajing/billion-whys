#!/bin/bash
# Git post-commit hook: 自动从 commit message 提取 bug 并写入 bugs.jsonl
# 用法：cp 到 .git/hooks/post-commit && chmod +x
# Commit message 格式：Bug-Database: <一句话描述>

BUG_DB="$(git rev-parse --show-toplevel)/docs/bug-database/bugs.jsonl"
MSG_FILE="$1"
[ -z "$MSG_FILE" ] && MSG_FILE=".git/COMMIT_EDITMSG"

# 提取 Bug-Database: 行
BUG_DESC=$(grep -E "^Bug-Database:" "$MSG_FILE" 2>/dev/null | head -1 | sed 's/^Bug-Database:[[:space:]]*//')
[ -z "$BUG_DESC" ] && exit 0

# 生成 bug ID（递增）
LAST_ID=$(tail -1 "$BUG_DB" 2>/dev/null | python3 -c "import json,sys; print(json.load(sys.stdin).get('id','BUG-0000'))" 2>/dev/null || echo "BUG-0000")
NUM=$(echo "$LAST_ID" | sed 's/BUG-//')
NEW_NUM=$(printf "%04d" $((10#$NUM + 1)))
NEW_ID="BUG-$NEW_NUM"

# 提取 commit SHA
COMMIT_SHA=$(git rev-parse HEAD | cut -c1-7)

# 构造 bug 条目
python3 -c "
import json, sys
from datetime import datetime, timezone, timedelta
tz = timezone(timedelta(hours=8))
entry = {
    'id': '$NEW_ID',
    'title': sys.argv[1],
    'severity': 'P2',
    'category': 'uncategorized',
    'discovered_at': datetime.now(tz).isoformat(),
    'fixed_at': datetime.now(tz).isoformat(),
    'fixed_in_commit': '$COMMIT_SHA',
    'root_cause': '',
    'fix': '',
    'files_changed': [],
    'symptom': '',
    'detection': 'git commit message',
    'prevention': ''
}
print(json.dumps(entry, ensure_ascii=False))
" "$BUG_DESC" >> "$BUG_DB"

echo "[Bug Database] Added $NEW_ID: $BUG_DESC"
