# 02 - Version Iteration Standards

> Applies to: 十亿个什么与为什么 WeChat Mini-Program releases

---

## 1. Semantic Versioning

Format: `MAJOR.MINOR.PATCH` (e.g., `9.27.0`)

| Segment | Increment When | Example |
|---------|---------------|---------|
| MAJOR | Breaking change to content API, seed-library schema change, or major UI overhaul | 9.x.x -> 10.0.0 |
| MINOR | New category added, new feature (e.g., experiment module), new IP character dialogue | 9.27.x -> 9.28.0 |
| PATCH | Bug fix, content correction, image replacement, typo fix | 9.27.0 -> 9.27.1 |

Version is stored in:
- `app.json` → `"version": "9.27.0"`
- `project.config.json` → `"setting.appid"` alongside
- Seed library metadata → `"schemaVersion": "3.2"`

---

## 2. Multi-Version Coexistence Strategy

### Content Versioning

The seed library has its own version independent of the app version:

```
seed-library-v3.2/
  animals.js
  nature.js
  body.js
  ...
  _schema.js        // { version: "3.2", minAppVersion: "9.20.0" }
```

Rules:
- Seed library schema version uses `MAJOR.MINOR` only (no patch).
- Each schema version must declare `minAppVersion` for compatibility.
- Old schema versions remain accessible for rollback (keep last 3 versions).
- Content additions (new questions) do NOT bump schema version.
- Schema structure changes (new fields, renamed fields) bump MINOR.
- Breaking removals bump MAJOR.

### Coexistence Matrix

| App Version | Schema 3.1 | Schema 3.2 | Schema 4.0 |
|-------------|-----------|-----------|-----------|
| 9.20-9.24 | Full support | Compatible | Not supported |
| 9.25-9.27 | Deprecated | Full support | Compatible |
| 10.0+ | Removed | Deprecated | Full support |

---

## 3. API Version Control

### content.js API Stability

The `content.js` module is the primary API surface. Stability rules:

```javascript
// Public API (STABLE - breaking changes require MAJOR bump)
module.exports = {
  getQuestion,        // (id) => QuestionObject
  getAnswer,          // (id, layer) => AnswerObject
  getCategory,        // (categoryId) => CategoryObject
  listQuestions,      // (filters) => QuestionObject[]
  getExperiment,      // (questionId) => ExperimentObject | null
  getParentGuide,     // (questionId) => ParentGuideObject
};

// Internal API (UNSTABLE - may change in MINOR versions)
// Prefixed with underscore
module.exports._internal = {
  _validateSchema,
  _migrateData,
  _buildIndex,
};
```

Backward compatibility contract:
- Public functions must not change parameter order.
- New optional parameters are appended.
- Return type shape must be additive-only (new fields OK, removals need deprecation).
- Deprecated functions remain for 2 MINOR versions with `console.warn`.

---

## 4. Data Migration

### Seed Library JSON Schema Migration

When schema version changes, provide a migration script:

```
scripts/
  migrate-schema-3.1-to-3.2.js
  migrate-schema-3.2-to-4.0.js
```

Migration script template:

```javascript
/**
 * Migrates seed library from schema 3.1 to 3.2
 * Changes:
 *   - Added comfortCategory field (required)
 *   - Renamed parentTip -> parentGuide
 *   - Added emotion field (optional, default: null)
 */
function migrate(data) {
  return data.map(item => ({
    ...item,
    comfortCategory: item.comfortCategory || classifyComfort(item),
    parentGuide: item.parentGuide || item.parentTip,
    emotion: item.emotion || null,
  }));
}
```

### Staging to Live Promotion

```
1. Generate/modify content in data/staging/
2. Run validation:  node scripts/validate-schema.js staging/
3. Run diff:        node scripts/diff-content.js staging/ live/
4. Review diff output (new questions, modified fields, deletions)
5. Promote:         node scripts/promote.js staging/ live/
6. Bump version in _schema.js
7. Commit with message: "content: promote staging vX.Y to live"
```

---

## 5. Git Branching Model

```
main ─────────────────────────────────────────────► (production releases)
  \                                    /
   develop ──────────────────────────►  (integration branch)
     \          \           \
      feature-*  feature-*   feature-*  (new features)

main ◄── hotfix-* (emergency fixes cherry-picked back)
```

Branch naming:
- `main` — Production-ready code, tagged releases only
- `develop` — Integration branch, all features merge here first
- `feature/add-experiment-module` — New feature development
- `hotfix/fix-image-loading-crash` — Emergency production fix
- `content/add-nature-questions` — Content-only additions

Merge rules:
- `feature/*` merges to `develop` via PR (requires 1 review).
- `develop` merges to `main` via release PR (requires full checklist).
- `hotfix/*` merges to `main` directly, then cherry-pick to `develop`.
- `content/*` merges to `develop` (content changes are lower risk).

---

## 6. Hotfix Process

```
1. Create branch:    git checkout -b hotfix/fix-xxx main
2. Fix the issue (minimal change, no refactoring)
3. Test on real device
4. Commit:           git commit -m "fix: description (Bug-Database: BUG-XXX)"
5. Merge to main:    git checkout main && git merge hotfix/fix-xxx
6. Tag:              git tag v9.27.1
7. Cherry-pick:      git checkout develop && git cherry-pick <hash>
8. Delete branch:    git branch -d hotfix/fix-xxx
9. Upload to WeChat MP backend
10. Submit for review (expedited if P0)
```

Time targets:
- P0 hotfix: Fix within 2 hours, submit within 4 hours
- P1 hotfix: Fix within 24 hours, submit in next release window

---

## 7. Rollback Procedure

### Preferred: git revert

```bash
# Revert the problematic commit(s)
git revert <commit-hash> --no-edit
git push origin main

# Upload previous version to WeChat MP backend
# Submit for review with rollback justification
```

### Emergency: git reset (requires 2-person confirmation)

```bash
# DANGER: Only when revert is impossible (e.g., corrupted merge)
# Requires explicit approval from both project owner + reviewer
git reset --hard <safe-commit-hash>
git push --force-with-lease origin main
```

Documentation required for any rollback:
- Reason for rollback
- Commits affected
- User impact assessment
- Prevention plan

---

## 8. Release Checklist

Before every `develop` -> `main` merge:

- [ ] All P0 items from current sprint are complete
- [ ] ESLint passes with 0 errors
- [ ] Schema validation passes for all seed library files
- [ ] `audit-bug-patterns.sh` returns 0 failures
- [ ] `smoke-test.cjs` all pass
- [ ] Package size: main package < 2MB, total < 20MB
- [ ] Real device test on iOS + Android (at least 1 each)
- [ ] Minor protection features functional (parent verify, time limits)
- [ ] All images are webp format, < 200KB each
- [ ] No `console.log` statements (only `console.warn` / `console.error`)
- [ ] Version bumped in `app.json`
- [ ] CHANGELOG.md updated
- [ ] Content diff reviewed (no accidental deletions)
- [ ] Privacy policy URL accessible
- [ ] Bug dictionary updated with any new fixes

Tag format: `v{MAJOR}.{MINOR}.{PATCH}` (e.g., `v9.28.0`)
