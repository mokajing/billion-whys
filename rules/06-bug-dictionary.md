# 06 - Bug Dictionary System

> Applies to: 十亿个什么与为什么 continuous bug tracking and pattern prevention

---

## 1. Bug Entry Structure

All bugs are recorded in `data/bugs.jsonl` (JSON Lines format, one entry per line).

```jsonl
{"id":"BUG-001","title":"require('.json') causes silent failure on base lib 2.19","severity":"P0","category":"runtime","rootCause":"WeChat MP base library inconsistently supports require for .json files. Some versions return undefined, others throw.","fix":"Replace all require('*.json') with require('*.js') using module.exports wrapper. See commit abc1234.","prevention":"R001 lint rule added to audit-bug-patterns.sh. Pre-commit hook blocks .json requires.","dateFound":"2025-03-15","dateFixed":"2025-03-15","affectedVersions":["9.20.0","9.21.0"],"fixedVersion":"9.22.0","reporter":"auto-scan"}
```

### Field Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique identifier: `BUG-NNN` |
| `title` | string | Yes | One-line description |
| `severity` | enum | Yes | `P0` / `P1` / `P2` |
| `category` | enum | Yes | See categories below |
| `rootCause` | string | Yes | Technical root cause analysis |
| `fix` | string | Yes | How it was fixed (include commit hash) |
| `prevention` | string | Yes | What prevents recurrence |
| `dateFound` | string | Yes | ISO date |
| `dateFixed` | string | Yes | ISO date (or "open") |
| `affectedVersions` | string[] | Yes | App versions affected |
| `fixedVersion` | string | Yes | App version containing fix (or "pending") |
| `reporter` | string | Yes | Person or "auto-scan" |

### Categories

| Category | Description |
|----------|------------|
| `runtime` | JS runtime errors, crashes |
| `render` | UI rendering issues, layout bugs |
| `data` | Seed library data issues, schema problems |
| `image` | Image loading, format, display issues |
| `performance` | Slow load, excessive setData, memory leaks |
| `compatibility` | Base library version issues, device-specific bugs |
| `content` | Content accuracy, age-appropriateness issues |
| `security` | Data leaks, injection, unsafe operations |
| `ux` | Usability issues, confusing navigation |

---

## 2. Severity Levels

### P0 - Blocker

**Definition:** App crashes, data loss, security vulnerability, or content safety violation.

**Response time:** Must be fixed within 2 hours. Hotfix branch created immediately.

**Examples:**
- App crashes on launch for specific device/OS
- Inappropriate content displayed to children
- Personal data accidentally transmitted
- Parent verification gate bypassed

### P1 - Strong

**Definition:** Feature malfunction, significant UX degradation, or data integrity issue.

**Response time:** Must be fixed within 24 hours. Included in next release.

**Examples:**
- Answer layer 3 not displaying
- Image not loading for specific category
- Session timer not enforcing limit
- Duplicate questions showing in same session

### P2 - Suggest

**Definition:** Minor visual issues, performance suggestions, code quality improvements.

**Response time:** Addressed in next sprint. May be deprioritized.

**Examples:**
- Slight layout shift on specific screen size
- Unnecessary re-render detected
- Code comment missing or outdated
- Unused variable in utility function

---

## 3. Auto-Entry Mechanism

### Post-Commit Hook

The post-commit hook scans commit messages for the `Bug-Database:` tag:

```bash
#!/bin/bash
# .git/hooks/post-commit

MSG=$(git log -1 --pretty=%B)
BUG_REF=$(echo "$MSG" | grep -oP 'Bug-Database:\s*BUG-\d+')

if [ -n "$BUG_REF" ]; then
  BUG_ID=$(echo "$BUG_REF" | grep -oP 'BUG-\d+')
  COMMIT=$(git log -1 --pretty=%H)
  DATE=$(date +%Y-%m-%d)

  echo "Bug dictionary: Commit $COMMIT references $BUG_ID"
  echo "Ensure $BUG_ID entry in data/bugs.jsonl has fixedVersion and dateFixed updated."
fi
```

### Commit Message Format for Bug Fixes

```
fix: prevent crash when seed library file missing

Root cause: getQuestion() did not check for null before accessing
properties, causing TypeError on devices with corrupted local cache.

Fix: Added null check with ContentError fallback. Returns placeholder
question with "content unavailable" message.

Bug-Database: BUG-042
```

---

## 4. Pattern Extraction (Lint Rules R001-R007)

Each recurring bug pattern generates a lint rule in `audit-bug-patterns.sh`:

| Rule | Pattern | Origin Bug | Description |
|------|---------|-----------|-------------|
| R001 | `require('*.json')` | BUG-001 | JSON require fails on some base library versions |
| R002 | Direct `wx.*Sync` | BUG-008 | Unhandled exceptions in sync API calls |
| R003 | `console.log` | BUG-015 | Debug logs left in production code |
| R004 | `eval()` | BUG-019 | Security: code injection risk |
| R005 | Hardcoded CDN URL | BUG-023 | URL changes break multiple files |
| R006 | Oversized files | BUG-027 | Package size audit failure |
| R007 | Bare TODO/FIXME | BUG-031 | Untracked technical debt |

### Adding a New Lint Rule

When a bug is fixed and a pattern is identified:

1. Add the grep pattern to `audit-bug-patterns.sh` as `R00N`.
2. Document in the bug entry's `prevention` field.
3. Add the rule to the table above.
4. Test that the rule catches the original bug's code pattern.
5. Commit: `chore: add lint rule R00N for BUG-XXX prevention`

---

## 5. Pre-Iteration Scan

**Rule:** Before starting any new development sprint, the developer MUST:

1. Read `data/bugs.jsonl` entirely.
2. Check for open bugs (dateFixed = "open").
3. Review P0 and P1 bugs fixed in the last sprint for regression risk.
4. Run `node scripts/scan-known-patterns.js` to detect if any known
   bug patterns have been reintroduced.

```javascript
// scripts/scan-known-patterns.js
const fs = require('fs');
const bugs = fs.readFileSync('data/bugs.jsonl', 'utf-8')
  .split('\n')
  .filter(Boolean)
  .map(JSON.parse);

const openBugs = bugs.filter(b => b.dateFixed === 'open');
if (openBugs.length > 0) {
  console.warn(`WARNING: ${openBugs.length} open bugs:`);
  openBugs.forEach(b => console.warn(`  ${b.id}: ${b.title} [${b.severity}]`));
}

const recentFixes = bugs.filter(b => {
  const fixDate = new Date(b.dateFixed);
  const twoWeeksAgo = new Date(Date.now() - 14 * 86400000);
  return fixDate > twoWeeksAgo;
});

if (recentFixes.length > 0) {
  console.log(`Recent fixes (check for regression):`);
  recentFixes.forEach(b => console.log(`  ${b.id}: ${b.title}`));
}
```

---

## 6. Daily Sync (Automated)

A cron job scans recent commits for bug-related keywords:

```bash
# Runs daily at 09:00
# Scans commits from last 24 hours for fix/bug/crash/error keywords

RECENT=$(git log --since="24 hours ago" --pretty="%H %s" --all)

echo "$RECENT" | grep -iE "fix|bug|crash|error|hotfix" | while read HASH MSG; do
  # Check if commit references Bug-Database
  FULL_MSG=$(git log -1 --pretty=%B "$HASH")
  if ! echo "$FULL_MSG" | grep -q "Bug-Database:"; then
    echo "WARNING: Commit $HASH appears to be a bug fix but has no Bug-Database tag"
    echo "  Message: $MSG"
    echo "  Action: Developer should add bug entry to data/bugs.jsonl"
  fi
done
```

---

## 7. Known Issues Tracking

Active known issues that are accepted (not yet fixed):

```
Format: KI-NNN | Description | Workaround | Target Fix Version
```

Known issues are tracked separately from bugs because they represent
accepted limitations rather than defects:

- **KI-001:** LazyCodeLoading may cause 200ms delay on first component render.
  Workaround: Preload critical components in app.js onLaunch.
  Target: Next base library update.

- **KI-002:** webp images show slight color shift on older Android WebView.
  Workaround: None needed (imperceptible to users).
  Target: Not planned.

- **KI-003:** Session timer pauses when app is backgrounded on some Android devices.
  Workaround: Check elapsed time on onShow and adjust remaining time.
  Target: v10.0.0

### Known Issues vs Bugs

| Aspect | Bug (BUG-NNN) | Known Issue (KI-NNN) |
|--------|--------------|---------------------|
| Severity | P0/P1/P2 | Accepted |
| Fix required | Yes | Not immediately |
| Tracked in | bugs.jsonl | This document |
| Blocks release | P0/P1 yes | No |
| Has workaround | Sometimes | Always |

---

## 8. Bug Report Template

When filing a new bug:

```markdown
## Bug Report

**ID:** BUG-NNN (next available number)
**Title:** [one-line description]
**Severity:** P0 / P1 / P2
**Category:** runtime / render / data / image / performance / compatibility / content / security / ux

### Environment
- Device: [model]
- OS: [iOS/Android version]
- Base library: [version]
- App version: [version]

### Steps to Reproduce
1. ...
2. ...
3. ...

### Expected Behavior
[What should happen]

### Actual Behavior
[What actually happens]

### Root Cause Analysis
[Technical analysis after investigation]

### Fix
[Description of fix, commit hash]

### Prevention
[Lint rule, test, or process change to prevent recurrence]
```
