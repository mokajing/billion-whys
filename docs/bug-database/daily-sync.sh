#!/bin/bash
# 每日定时任务：扫描当日 commit + WeChat Dev Tools 日志，提取遗漏的 bug 入库
# 用法：crontab 0 1 * * * bash /home/admin/workspace/billion-whys/docs/bug-database/daily-sync.sh

set -u
BUG_DB="/home/admin/workspace/billion-whys/docs/bug-database/bugs.jsonl"
LOG_FILE="/home/admin/workspace/billion-whys/docs/bug-database/daily-sync.log"
REPO="/home/admin/workspace/billion-whys"

echo "[$(date)] Starting daily bug sync..." >> "$LOG_FILE"

# 1. 扫描当日 commits，找 fix: / fix-xxx / 修复 / bug 关键词
cd "$REPO"
TODAY=$(date -u +%Y-%m-%d)
COMMITS=$(git log --since="$TODAY 00:00:00" --until="$TODAY 23:59:59" --pretty=format:"%h %s" 2>/dev/null)

NEW_BUGS=0
for line in $COMMITS; do
    # 提取 fix/bug/修复 关键词的 commit
    if echo "$line" | grep -qE "fix|bug|修复|FIX"; then
        SHA=$(echo "$line" | awk '{print $1}')
        MSG=$(echo "$line" | cut -d' ' -f2-)
        
        # 检查是否已在 bugs.jsonl
        if grep -q "$SHA" "$BUG_DB" 2>/dev/null; then
            continue
        fi
        
        # 生成新 bug 条目
        LAST_ID=$(tail -1 "$BUG_DB" 2>/dev/null | python3 -c "import json,sys; print(json.load(sys.stdin).get('id','BUG-0000'))" 2>/dev/null || echo "BUG-0000")
        NUM=$(echo "$LAST_ID" | sed 's/BUG-//')
        NEW_NUM=$(printf "%04d" $((10#$NUM + 1)))
        NEW_ID="BUG-$NEW_NUM"
        
        python3 -c "
import json, sys
from datetime import datetime, timezone, timedelta
tz = timezone(timedelta(hours=8))
entry = {
    'id': '$NEW_ID',
    'title': '$MSG',
    'severity': 'P2',
    'category': 'uncategorized',
    'discovered_at': datetime.now(tz).isoformat(),
    'fixed_at': datetime.now(tz).isoformat(),
    'fixed_in_commit': '$SHA',
    'root_cause': '需人工补充',
    'fix': '见 commit $SHA',
    'files_changed': [],
    'symptom': '',
    'detection': 'daily-sync 扫描',
    'prevention': ''
}
print(json.dumps(entry, ensure_ascii=False))
" >> "$BUG_DB"
        NEW_BUGS=$((NEW_BUGS + 1))
    fi
done

echo "[$(date)] Synced $NEW_BUGS new bugs" >> "$LOG_FILE"

# 2. 扫描 WeChat Dev Tools 日志（如果存在）
WX_LOG="$HOME/.wechat-devtools/logs/console.log"
if [ -f "$WX_LOG" ]; then
    TODAY_LINES=$(grep "$(date +%Y-%m-%d)" "$WX_LOG" 2>/dev/null | grep -iE "error|fail" | head -20)
    if [ -n "$TODAY_LINES" ]; then
        echo "WeChat Dev Tools errors today:" >> "$LOG_FILE"
        echo "$TODAY_LINES" >> "$LOG_FILE"
    fi
fi

# 3. webhook 通知
if [ -x /home/admin/workspace/notify_groups.sh ] && [ $NEW_BUGS -gt 0 ]; then
    bash /home/admin/workspace/notify_groups.sh "Bug 词典库日同步" "今日新增 $NEW_BUGS 条 bug 到词典库，总数 $(wc -l < $BUG_DB) 条" 2>/dev/null || true
fi
