# 05 - Quality Gates

> Applies to: 十亿个什么与为什么 development lifecycle gates

---

## 1. Pre-Commit Gate

**Trigger:** `git commit` (via `.git/hooks/pre-commit`)

**Script:** `scripts/audit-bug-patterns.sh`

**Pass criteria:** Exit code 0, zero failures.

Checks performed:
1. No `require('*.json')` in any JS file
2. No direct `wx.*Sync` calls outside `utils/safe-wx.js`
3. No `console.log` (only `console.warn` / `console.error` permitted)
4. No `eval()`, `new Function()`, or `setTimeout(string)`
5. No hardcoded CDN URLs (must use constants)
6. No `TODO` or `FIXME` without associated issue reference
7. No files larger than 200KB (images must be optimized)

```bash
#!/bin/bash
# scripts/audit-bug-patterns.sh
set -e
ERRORS=0

# R001: No require .json
if grep -rn "require.*\.json" miniprogram/ --include="*.js"; then
  echo "FAIL R001: require('.json') found"
  ERRORS=$((ERRORS + 1))
fi

# R002: No direct wx sync calls outside safe-wx
if grep -rn "wx\.\(getStorageSync\|setStorageSync\|removeStorageSync\)" \
   miniprogram/ --include="*.js" | grep -v "safe-wx.js"; then
  echo "FAIL R002: Direct wx sync call outside safe-wx.js"
  ERRORS=$((ERRORS + 1))
fi

# R003: No console.log
if grep -rn "console\.log" miniprogram/ --include="*.js"; then
  echo "FAIL R003: console.log found (use console.warn or console.error)"
  ERRORS=$((ERRORS + 1))
fi

# R004: No eval
if grep -rn "eval\s*(" miniprogram/ --include="*.js"; then
  echo "FAIL R004: eval() found"
  ERRORS=$((ERRORS + 1))
fi

# R005: No hardcoded CDN URLs
if grep -rn "https://cdn\." miniprogram/ --include="*.js" | grep -v "constants"; then
  echo "FAIL R005: Hardcoded CDN URL found"
  ERRORS=$((ERRORS + 1))
fi

# R006: No oversized files staged
LARGE=$(git diff --cached --name-only | xargs -I {} sh -c \
  'test -f "{}" && SIZE=$(wc -c < "{}") && [ $SIZE -gt 204800 ] && echo "{}: ${SIZE}B"' 2>/dev/null)
if [ -n "$LARGE" ]; then
  echo "FAIL R006: Oversized files: $LARGE"
  ERRORS=$((ERRORS + 1))
fi

# R007: No raw TODO/FIXME without issue reference
if grep -rn "TODO\|FIXME" miniprogram/ --include="*.js" | grep -v "#[0-9]"; then
  echo "FAIL R007: TODO/FIXME without issue reference (#NNN)"
  ERRORS=$((ERRORS + 1))
fi

exit $ERRORS
```

**On failure:** Commit is blocked. Developer must fix all issues.

---

## 2. Pre-Push Gate

**Trigger:** `git push` (via `.git/hooks/pre-push`)

**Script:** `scripts/smoke-test.cjs`

**Pass criteria:** All smoke tests pass.

Smoke tests:
1. **Schema validation:** All seed library files match expected schema.
2. **Content completeness:** Every question has all 3 answer layers.
3. **Image references:** Every referenced image file exists.
4. **Category integrity:** All questions belong to valid categories.
5. **Duplicate detection:** No duplicate question IDs across files.
6. **Character limit:** Layer 1 answers <= 60 chars, Layer 2 <= 150 chars.
7. **Required fields:** `questionText`, `layer1`, `layer2`, `layer3`, `category`,
   `comfortCategory`, `hint`, `guide` must be present.

```javascript
// scripts/smoke-test.cjs (excerpt)
const { validateSchema } = require('./validate-schema');
const { checkCompleteness } = require('./check-completeness');
const { findDuplicates } = require('./find-duplicates');

async function runSmokeTests() {
  const results = [];

  results.push(await validateSchema());
  results.push(await checkCompleteness());
  results.push(await findDuplicates());
  // ... additional checks

  const failures = results.filter(r => !r.passed);
  if (failures.length > 0) {
    console.error(`${failures.length} smoke test(s) failed:`);
    failures.forEach(f => console.error(`  - ${f.name}: ${f.message}`));
    process.exit(1);
  }
  console.log(`All ${results.length} smoke tests passed.`);
}

runSmokeTests();
```

---

## 3. Pre-Release Gate

**Trigger:** Manual, before `develop` -> `main` merge.

**Full checklist:**

| # | Check | Tool | Pass Criteria |
|---|-------|------|--------------|
| 1 | ESLint | `npx eslint miniprogram/` | 0 errors, 0 warnings |
| 2 | Schema validation | `node scripts/validate-schema.js` | All files valid |
| 3 | Content safety scan | `node scripts/content-safety-scan.js` | 0 violations |
| 4 | Bug patterns | `bash scripts/audit-bug-patterns.sh` | Exit 0 |
| 5 | Smoke tests | `node scripts/smoke-test.cjs` | All pass |
| 6 | Package size | WeChat DevTools build | Main < 2MB, Total < 20MB |
| 7 | iOS real device | Manual test | All checklist items pass |
| 8 | Android real device | Manual test | All checklist items pass |
| 9 | Minor protection | Manual test | Parent gate + timer work |
| 10 | Image format | `find . -name "*.png" ...` | No non-webp images |
| 11 | Version bumped | Check `app.json` | Version incremented |
| 12 | CHANGELOG updated | Manual review | Current version documented |
| 13 | Privacy URL live | `curl` check | HTTP 200 |
| 14 | Bug dictionary | Review `bugs.jsonl` | All recent fixes recorded |

---

## 4. Test Coverage Standards

| Code Area | Minimum Coverage | Rationale |
|-----------|-----------------|-----------|
| `utils/content.js` (public API) | 100% | Core functionality |
| `utils/safe-wx.js` | 100% | Error boundary |
| `utils/errors.js` | 100% | Error class behavior |
| `scripts/validate-schema.js` | 100% | Data integrity |
| `utils/*.js` (other) | 80% | General utilities |
| `pages/*/` (page logic) | 60% | UI-coupled, harder to test |
| `components/*/` | 60% | UI-coupled |

Testing framework: `miniprogram-simulate` + custom test harness.

Test file naming: `*.test.js` alongside source file.

```
utils/
  content.js
  content.test.js
  safe-wx.js
  safe-wx.test.js
```

---

## 5. CI/CD Pipeline Stages

```
Stage 1: Lint + Static Analysis
  - ESLint
  - audit-bug-patterns.sh
  - Dependency check (no unauthorized npm packages)

Stage 2: Unit Tests
  - Run all *.test.js files
  - Coverage report generation
  - Coverage threshold enforcement

Stage 3: Schema + Content Validation
  - validate-schema.js
  - content-safety-scan.js
  - smoke-test.cjs

Stage 4: Build
  - WeChat MP project build
  - Package size measurement
  - Build artifact archiving

Stage 5: Deploy (manual trigger)
  - Upload to WeChat MP backend (via CLI or manual)
  - Submit for review
  - Monitor review status
```

---

## 6. Performance Baselines

| Metric | Threshold | Measurement Method |
|--------|----------|-------------------|
| Cold launch | <= 2 seconds | WeChat DevTools Audits panel |
| Page navigation | <= 500ms | Performance API timestamps |
| setData frequency | <= 5 calls/second | Custom instrumentation |
| setData payload | <= 256KB per call | JSON.stringify().length |
| Image file size | <= 200KB each | File system check |
| Total image load | <= 3 seconds per page | Network panel |
| Memory usage | <= 128MB | WeChat DevTools Memory panel |
| JS execution (single) | <= 100ms per handler | Performance trace |

Performance regression protocol:
1. Measure baselines on `main` branch before merge.
2. Measure on `develop` after merge.
3. If any metric exceeds threshold by > 20%, block release.
4. Document optimization in commit message.

---

## 7. Code Review Checklist

Reviewer must verify:

**Correctness:**
- [ ] Logic matches the requirement/issue description
- [ ] Edge cases handled (empty data, null values, missing fields)
- [ ] Error handling uses proper error classes (not raw `catch(e)`)

**Standards:**
- [ ] Follows naming conventions (camelCase JS, kebab-case files)
- [ ] Uses safe-wx wrappers (no direct wx.* calls)
- [ ] No require('.json')
- [ ] setData uses path expressions for partial updates

**Content (if seed library changes):**
- [ ] New questions have all 3 layers
- [ ] Content passes age-appropriateness review
- [ ] No duplicate question IDs
- [ ] comfortCategory, hint, guide fields populated

**Security:**
- [ ] No PII collection introduced
- [ ] No eval/Function constructor
- [ ] No hardcoded secrets or tokens

**Performance:**
- [ ] No full-array setData
- [ ] Images are webp, <= 200KB
- [ ] No synchronous operations in page lifecycle (onLoad, onShow)
