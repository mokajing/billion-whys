# 07 - Top Team Practices

> Benchmarked from 5 leading companies, adapted for 十亿个什么与为什么

---

## 1. Google - Engineering Excellence

### Practice 1.1: Code Readability Reviews

**Google approach:** Every code change requires a readability-approved reviewer.
Code must be understandable by someone unfamiliar with the module.

**Our adaptation:**
- Every PR must have at least one reviewer who did NOT write the code.
- Functions over 40 lines must include a summary comment explaining the "why".
- Seed library content changes require review by someone familiar with
  child development (not just technical correctness).
- Variable names must be self-documenting: `questionsByCategory` not `qbc`.

### Practice 1.2: Comprehensive Testing Culture

**Google approach:** Tests are first-class citizens. No code ships without tests.
Test failures block all submissions.

**Our adaptation:**
- `content.js` public API: 100% test coverage, no exceptions.
- Every bug fix must include a regression test that would have caught the bug.
- `smoke-test.cjs` runs on every push — failures block the push.
- Schema validation tests run before any content merge.
- Test files live next to source files (`content.test.js` beside `content.js`).

### Practice 1.3: Design Docs Before Implementation

**Google approach:** Features above a certain size require a design doc
reviewed by peers before coding begins.

**Our adaptation:**
- Any feature that touches 3+ files requires a brief design doc (1-2 pages).
- Design doc template: Problem → Proposed Solution → Alternatives Considered
  → Data Schema Changes → Testing Plan → Rollback Plan.
- Content category additions require a content brief: topic scope, age
  appropriateness rationale, 5 sample questions.
- Store design docs in `docs/designs/` directory.

### Practice 1.4: Blameless Post-Mortems

**Google approach:** After incidents, conduct blameless post-mortems focused on
systemic improvements, not individual blame.

**Our adaptation:**
- Every P0 bug gets a post-mortem entry in `docs/post-mortems/`.
- Format: Timeline → Impact → Root Cause → What Went Well → What Could Be
  Improved → Action Items (with owners and deadlines).
- Focus on process and tooling improvements, not personal criticism.
- Share learnings in sprint retrospective.

---

## 2. Meta - Component Architecture

### Practice 2.1: Component Reusability (React Patterns)

**Meta approach:** Build composable, reusable components with clear props interfaces.
Components should be testable in isolation.

**Our adaptation (WeChat MP Components):**
- Extract shared UI into `components/` with clear `properties` definitions.
- Each component must define its `properties` types explicitly in the JSON config.
- Components must not access `getApp()` directly — pass data via properties.
- Shared components across pages: `AnswerCard`, `QuestionBubble`,
  `ParentGate`, `SessionTimer`, `CharacterAvatar`.

```javascript
// GOOD: Component receives data via properties
Component({
  properties: {
    question: { type: Object, value: null },
    layer: { type: Number, value: 1 },
    character: { type: String, value: 'wenwen' }
  },
  methods: {
    onTapAnswer() {
      this.triggerEvent('layerchange', { layer: this.data.layer + 1 });
    }
  }
});
```

### Practice 2.2: Unidirectional Data Flow

**Meta approach:** Data flows down, events flow up. State is managed predictably.

**Our adaptation:**
- Page owns the state. Components receive data via `properties`.
- Components communicate up via `triggerEvent`, never by directly
  modifying parent state.
- Global state (via `getApp().globalData`) is read-only from components.
- State mutations happen only in page methods or app-level methods.

### Practice 2.3: Performance-First Component Design

**Meta approach:** Measure first, optimize where data shows impact.
Virtual DOM diffing minimizes unnecessary re-renders.

**Our adaptation:**
- Use `observers` in components to react to property changes efficiently.
- Avoid `this.setData` in `attached` lifecycle — use `ready` instead.
- For lists: use `wx:key` with unique stable IDs (question ID, not array index).
- Implement virtual scrolling for category pages with 50+ questions.

---

## 3. ByteDance - WeChat MP Expertise

### Practice 3.1: WeChat MP Performance Optimization

**ByteDance approach:** Aggressive performance optimization for mini-programs,
including pre-loading, skeleton screens, and data prefetching.

**Our adaptation:**
- **Skeleton screens:** Show content placeholder while seed data loads.
  Use CSS animation (not GIF) for skeleton shimmer effect.
- **Data prefetching:** In category list page, prefetch first 5 questions
  of the selected category before user taps.
- **Image lazy loading:** Use `lazy-load` attribute on `<image>` tags.
  Load images only when scrolled into viewport.
- **setData batching:** Collect multiple state changes and call setData
  once per user interaction, not per data change.

### Practice 3.2: A/B Testing Framework

**ByteDance approach:** Data-driven decisions through systematic A/B testing.

**Our adaptation (simplified for offline-first app):**
- Use local storage to assign users to test groups (random on first launch).
- Test variations: answer display format, character personality,
  question ordering algorithm.
- Measure: questions explored per session, session duration,
  category diversity (entropy of categories viewed).
- No server needed: log events locally, parent can opt-in to share
  anonymous usage stats in future versions.

### Practice 3.3: Multi-Platform Consistency

**ByteDance approach:** Ensure consistent behavior across iOS and Android
mini-program runtimes.

**Our adaptation:**
- Test every release on both iOS and Android real devices.
- Maintain a compatibility matrix for base library versions.
- Use `wx.getSystemInfoSync()` to detect platform and apply
  platform-specific fixes only when necessary.
- CSS: Avoid `-webkit-` prefixes that behave differently across platforms.
  Use WeChat MP's built-in rpx units consistently.

### Practice 3.4: Error Monitoring and Recovery

**ByteDance approach:** Comprehensive error monitoring with automatic recovery
and graceful degradation.

**Our adaptation:**
- Global error handler in `app.js`:
  ```javascript
  App({
    onError(err) {
      console.error('Global error:', err);
      // Log to local error buffer for parent report
      safeSetStorage('error_log', [...getErrorLog(), {
        error: err.substring(0, 200),
        time: Date.now(),
        page: getCurrentPages().pop()?.route
      }]);
    }
  });
  ```
- Graceful degradation: If image fails to load, show text-only answer.
- Content fallback: If seed library file is corrupted, show "content
  unavailable" message with retry button, not a blank screen.

---

## 4. WeChat Official - Platform Best Practices

### Practice 4.1: Base Library Compatibility

**Official guidance:** Set minimum base library version to balance feature
availability and user coverage.

**Our adaptation:**
- Target base library: `2.25.0+` (covers ~95% of active users).
- Use `wx.canIUse()` before calling newer APIs.
- Maintain fallback for critical features:
  ```javascript
  if (wx.canIUse('getPrivacySetting')) {
    wx.getPrivacySetting({ ... });
  } else {
    // Fallback: show custom privacy dialog
    showCustomPrivacyDialog();
  }
  ```
- Monitor WeChat MP admin console for base library distribution stats monthly.

### Practice 4.2: API Deprecation Handling

**Official guidance:** Deprecated APIs are announced in release notes.
They continue working but may be removed in future base library versions.

**Our adaptation:**
- Subscribe to WeChat MP developer newsletter for deprecation notices.
- Maintain a deprecation tracking list in `docs/api-deprecations.md`.
- When a deprecation is announced: plan migration within 2 sprints.
- Never use APIs marked as "deprecated" in new code.
- Wrapper pattern: All wx API calls go through `safe-wx.js`, making
  migration a single-file change.

### Practice 4.3: LazyCodeLoading

**Official guidance:** Enable `"lazyCodeLoading": "requiredComponents"` to
reduce launch time by loading component code on demand.

**Our adaptation:**
- Enabled in `app.json` for all builds.
- Critical path components (home page, first question) are NOT lazy-loaded
  (listed in app.json `usingComponents`).
- Non-critical components (settings, parent report) are lazy-loaded.
- Measure launch time with and without lazy loading; document delta.
- Subpackage strategy: Content categories are separate subpackages,
  loaded when user enters that category.

### Practice 4.4: Privacy API Integration

**Official guidance:** Apps must implement the privacy authorization flow
using `wx.getPrivacySetting` and `wx.requirePrivacyAuthorize`.

**Our adaptation:**
- Implement `__usePrivacyCheck__: true` in app.json.
- Show privacy popup on first launch before any data access.
- Privacy popup uses clear, child-parent-friendly language.
- Provide "查看隐私政策" link that opens the full privacy policy.
- Re-request only when privacy policy is updated.

---

## 5. Ant Financial (Alipay) - Security Engineering

### Practice 5.1: Security-First Development

**Ant approach:** Security is not an afterthought; it is built into every
stage of development. Threat modeling before implementation.

**Our adaptation:**
- Before any new feature: document what data it accesses and why.
- No feature should introduce new data collection without explicit review.
- Input sanitization on all text display (prevent XSS in WebView contexts).
- No dynamic code execution (`eval`, `Function`, `setTimeout(string)`).
- Content from external sources (CDN) must be validated against schema
  before rendering.

### Practice 5.2: Data Protection by Design

**Ant approach:** Minimize data collection. Encrypt at rest and in transit.
Implement access controls at every layer.

**Our adaptation:**
- **Data minimization:** Collect only what is necessary for core functionality.
  Current state: ZERO personal information collected.
- **Local storage only:** All user preferences stored via `wx.setStorageSync`,
  never transmitted to any server.
- **No analytics SDK:** Do not integrate third-party analytics that might
  collect device fingerprints or behavioral data.
- **Storage whitelist:** Only keys in the approved whitelist (see
  `04-compliance-legal.md`) may be stored.
- **Regular audit:** Quarterly grep for any `wx.request` calls that might
  transmit user data.

### Practice 5.3: Compliance as Code

**Ant approach:** Encode compliance requirements as automated checks,
not manual review processes.

**Our adaptation:**
- Content safety scan runs in CI (not just manual review).
- Package size limits enforced by build script (not just guidelines).
- Privacy declaration accuracy verified by automated check against
  actual API usage in code.
- Age-appropriateness checks encoded in schema validation
  (character limits, prohibited word list).
- Compliance checks cannot be bypassed: they are pre-commit hooks,
  not optional scripts.

### Practice 5.4: Incident Response Preparedness

**Ant approach:** Have documented, rehearsed incident response procedures
for security events.

**Our adaptation:**
- **Content incident:** If inappropriate content is discovered in production:
  1. Immediately pull the affected version (WeChat MP admin console).
  2. Identify all affected questions/answers.
  3. Fix content and validate.
  4. Submit expedited review.
  5. Post-mortem within 24 hours.
- **Data incident:** If any data transmission is discovered:
  1. Disable the transmitting code path immediately.
  2. Assess what data was sent and to where.
  3. Notify relevant authorities if personal data was involved.
  4. Document in incident log.
- **Availability incident:** If app crashes widely:
  1. Check WeChat MP admin console for error reports.
  2. Rollback to last stable version.
  3. Investigate and fix.

### Practice 5.5: Supply Chain Security

**Ant approach:** Vet all dependencies. Minimize third-party code.
Pin versions. Audit regularly.

**Our adaptation:**
- **Zero npm dependencies in production.** All code is first-party.
- Dev dependencies (ESLint, test tools) are pinned to exact versions.
- No third-party WeChat MP plugins unless absolutely necessary.
- If a plugin is needed: review source code, check update frequency,
  assess maintainer reputation.
- CDN-hosted content: validate integrity after download using checksum.

---

## Summary: Practices Adoption Matrix

| Practice | Priority | Sprint to Implement | Status |
|----------|----------|-------------------|--------|
| Google: Readability reviews | High | Current | Active |
| Google: Testing culture | High | Current | Active |
| Google: Design docs | Medium | Next sprint | Planned |
| Google: Post-mortems | Medium | On next P0 | Ready |
| Meta: Component reusability | High | Current | Active |
| Meta: Unidirectional data flow | High | Current | Active |
| Meta: Performance components | Medium | Current | Active |
| ByteDance: Performance optimization | High | Current | Active |
| ByteDance: A/B testing | Low | Future | Planned |
| ByteDance: Multi-platform testing | High | Current | Active |
| ByteDance: Error monitoring | High | Current | Active |
| WeChat: Base library compat | High | Current | Active |
| WeChat: API deprecation tracking | Medium | Current | Active |
| WeChat: LazyCodeLoading | High | Current | Active |
| WeChat: Privacy API | High | Current | Active |
| Ant: Security-first | High | Current | Active |
| Ant: Data protection | High | Current | Active |
| Ant: Compliance as code | High | Current | Active |
| Ant: Incident response | Medium | Current | Documented |
| Ant: Supply chain security | High | Current | Active |
