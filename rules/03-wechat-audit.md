# 03 - WeChat Mini-Program Audit Standards

> Applies to: 十亿个什么与为什么 submission to WeChat审核

---

## 1. Pre-Submission Self-Check List (12 Items)

Every submission must pass ALL 12 checks. A single failure blocks submission.

### Check 1: AppID Configured

- `project.config.json` must contain the real production AppID.
- Placeholder values (`touristappid`, `wx0000000000000000`) are forbidden.
- Verify: `grep "appid" project.config.json` returns the assigned ID.

### Check 2: Privacy Policy URL Accessible

- URL must be HTTPS and return HTTP 200.
- Content must be in Chinese, covering data collection, storage, and deletion.
- URL must be reachable from mainland China (no blocked CDNs).
- Test: `curl -o /dev/null -s -w "%{http_code}" <privacy_url>` returns `200`.

### Check 3: Domain Whitelist Configured

Required domains in WeChat MP backend (开发管理 -> 开发设置 -> 服务器域名):

| Type | Domain | Purpose |
|------|--------|---------|
| request | `cdn.jsdelivr.net` | Content CDN |
| request | `raw.githubusercontent.com` | Fallback content source |
| downloadFile | `cdn.jsdelivr.net` | Image/audio downloads |

- All API calls must use HTTPS.
- No `wx.request` to non-whitelisted domains.
- Dev-only domains must not appear in production code.

### Check 4: Minor Protection Implemented

Required features (未成年人保护):

- **Parent Verification Gate:** Before accessing settings or extended sessions,
  require a simple arithmetic problem (e.g., "12 + 7 = ?") that toddlers cannot solve.
- **Session Time Limit:** Default 20 minutes per session, configurable by parent.
  Visual countdown in last 3 minutes. Gentle lock screen when expired.
- **Usage Report:** Parent can view daily/weekly usage summary (questions explored,
  time spent per session).
- **No Addictive Patterns:** No streaks, no daily login rewards, no "come back tomorrow"
  prompts targeting children.

### Check 5: Content Safety (Seed Library Scan)

- All 300+ questions must pass `scripts/content-safety-scan.js`.
- Prohibited content for age 2-6:
  - Violence, gore, horror themes
  - Sexual content or innuendo
  - Political content or propaganda
  - Discrimination based on race, gender, disability
  - Dangerous activities children might imitate
  - Brand names or commercial promotion
- Scan output must show: `X questions scanned, 0 violations found`.

### Check 6: Image Safety

- ALL images must be `.webp` format (not png/jpg/gif).
- No images depicting: violence, horror, weapons, brand logos, real human faces.
- IP characters (问问兔, 答答熊) must be original artwork.
- Maximum image size: 200KB per image.
- Verify: `find . -name "*.png" -o -name "*.jpg" -o -name "*.gif"` returns empty.

### Check 7: No Virtual Payment

- App must not contain any in-app purchase flow.
- No references to payment APIs (`wx.requestPayment`).
- No "premium content" gates or subscription prompts.
- Future payment features require separate audit (see Section 4).
- Verify: `grep -r "requestPayment\|wx.pay\|IAP" miniprogram/` returns empty.

### Check 8: No Unaudited UGC

- Current version: NO user-generated content features.
- If UGC is added in future:
  - Must integrate WeChat content safety API (`msgSecCheck`, `imgSecCheck`).
  - Must have human review queue for flagged content.
  - Must have report mechanism.
- Verify: No text input fields that post to public display.

### Check 9: Category Classification

Recommended category: **工具 -> 效率** (Tools -> Efficiency)

Alternative acceptable categories:
- **教育 -> 学前教育** (Education -> Preschool) — if this subcategory exists
- **教育 -> 其他** (Education -> Other)

Do NOT select:
- 游戏 (Games) — triggers stricter minor protection audit
- 社交 (Social) — implies UGC which we don't have

### Check 10: Test Account

- If the app has any login-gated features, provide test credentials.
- Current version: No login required (all content is local/CDN).
- Document in submission notes: "本小程序无需登录即可使用全部功能".

### Check 11: Package Size

| Metric | Limit | Current Target |
|--------|-------|---------------|
| Main package | 2 MB | < 1.5 MB |
| Total (all subpackages) | 20 MB | < 10 MB |
| Single subpackage | 2 MB | < 1.5 MB |

Size reduction strategies:
- Images: webp at quality 70, max 512x512px
- Code: Enable `minified: true` in `project.config.json`
- Data: Lazy-load seed library by category (subpackages)
- Enable: `"lazyCodeLoading": "requiredComponents"` in `app.json`

### Check 12: Real Device Test

Must test on at least:
- 1 iOS device (iPhone, recent model)
- 1 Android device (mid-range, e.g., Xiaomi/OPPO/Huawei)

Test checklist per device:
- [ ] App launches without crash
- [ ] Home page loads all categories
- [ ] Question detail page renders 3 layers
- [ ] Images load (no broken images)
- [ ] Parent verification gate works
- [ ] Time limit countdown functions
- [ ] Back navigation works correctly
- [ ] No JS errors in vConsole

---

## 2. Category Qualification Documents

For **教育** category, WeChat may require:
- Business license (if company entity)
- ICP备案 for any server domains used
- No additional qualification needed for non-profit educational tools

For future categories requiring qualification:
- **医疗** — Not applicable, avoid health claims
- **金融** — Not applicable, no payment

---

## 3. Privacy Declaration Checklist

In WeChat MP backend (设置 -> 基本设置 -> 服务内容声明):

| Data Type | Collected? | Purpose | Storage |
|-----------|-----------|---------|---------|
| 用户昵称 | No | — | — |
| 头像 | No | — | — |
| 手机号 | No | — | — |
| 位置信息 | No | — | — |
| 设备信息 | Yes (basic) | Compatibility | Local only |
| 使用记录 | Yes | Usage stats for parents | Local only |
| 剪贴板 | No | — | — |
| 相册/相机 | No | — | — |

Declare in `app.json`:
```json
{
  "__usePrivacyCheck__": true
}
```

---

## 4. Payment Audit Rules (Future Reference)

When payment features are added:
- Must use WeChat Pay (微信支付) only.
- Must have 企业主体 (company entity), not individual.
- Pricing must be transparent (no hidden fees).
- Refund policy must be published.
- For minor users: Payment must require parent verification gate.
- Virtual goods: Must clearly describe what user receives.
- No loot boxes or randomized purchases for children's apps.

---

## 5. Common Rejection Reasons and Prevention

| Rejection Reason | Prevention |
|-----------------|------------|
| "功能不完整" (incomplete) | Ensure all menu items are functional, no placeholder pages |
| "涉及UGC未接入内容安全" | Do not add text input without msgSecCheck |
| "类目不符" | Choose 工具-效率 or 教育, not 游戏 |
| "隐私政策缺失" | Privacy URL must be live and accessible |
| "诱导分享" | No "分享得奖励" or forced sharing gates |
| "广告不合规" | No ads in children's educational content |
| "包体过大" | Use subpackages and lazy loading |

---

## 6. Submission Timing

- Avoid submitting Friday afternoon (reviewers may not process until Monday).
- Optimal submission: Tuesday-Thursday, 10:00-16:00 Beijing time.
- Expedited review (加急审核): Available once per year, save for critical fixes.
- Average review time: 1-3 business days.
- Resubmission after rejection: Address ALL listed issues before resubmitting.
