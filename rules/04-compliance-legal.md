# 04 - Compliance and Legal Rules

> Applies to: 十亿个什么与为什么 — legal obligations for a children's digital product in China

---

## 1. Key Legislation

### 1.1 未成年人保护法 (Minor Protection Law)

Effective: 2021-06-01. Key articles for this project:

**Article 72 — Network Product/Service Provider Obligations:**
- Products targeting minors must not contain content endangering physical/mental health.
- Must establish content review mechanisms.
- Must provide minor-appropriate modes (time management, content filtering).

**Article 73 — Addictive Prevention:**
- Must not provide services that induce minors to become addicted.
- No: infinite scroll without breaks, streak-based incentives, push notifications
  designed to re-engage children.
- Must implement: session time limits, rest reminders, age-appropriate content gates.

**Article 74 — Personal Information Protection:**
- Processing personal information of minors under 14 requires guardian consent.
- Must formulate specific rules for handling children's personal information.
- Must designate a person responsible for children's information protection.

**Article 75 — Reporting Mechanism:**
- Must provide accessible reporting channels for illegal/harmful content.
- Must promptly handle reports and take necessary measures.

### 1.2 未成年人网络保护条例 (Minor Online Protection Regulation)

Effective: 2024-01-01. Key articles:

**Article 20 — Age-Appropriate Design:**
- Products for minors must consider the age, psychological state, and
  cognitive ability of the target group.
- Must not present content unsuitable for the minor's age group.

**Article 26 — Usage Time Management:**
- Must provide time management features.
- Must set reasonable usage limits for different age groups.
- For ages 2-6: Recommended maximum 20 minutes per session,
  40 minutes total per day.

**Article 32 — Anti-Addiction Technical Measures:**
- Must implement technical measures to prevent addiction.
- Required: Session timer, rest reminder, daily limit.
- Must not provide services between 22:00-06:00 to minors
  (implementation: gentle reminder, not hard block for offline content).

**Article 50 — Legal Liability:**
- Violation may result in: warning, fine (up to 1M RMB for serious violations),
  suspension of service, revocation of permits.

### 1.3 个人信息保护法 (PIPL)

**Article 31 — Processing Children's Data:**
- Children under 14 are classified as sensitive personal information subjects.
- Separate consent must be obtained from parent/guardian.
- Data minimization principle applies strictly.
- Must conduct personal information protection impact assessment.

Our compliance approach:
- **Collect ZERO personal information.** All data stays on-device.
- No account registration required.
- No network transmission of user behavior data.
- This eliminates most PIPL obligations.

### 1.4 儿童个人信息网络保护规定 (Children's Personal Information Online Protection)

Key requirements (even though we collect no PII):
- Must publish a children's privacy policy (separate from general privacy policy).
- Must designate a children's information protection officer.
- If collecting any data in future: must use encryption, access control,
  de-identification.
- Must provide data deletion mechanism upon guardian request.

---

## 2. Content Safety Thresholds for Age 2-6

### Absolutely Prohibited Content

| Category | Examples | Rule |
|----------|---------|------|
| Violence | Fighting, weapons, blood, injury descriptions | Zero tolerance |
| Horror | Monsters, ghosts, dark/scary imagery | Zero tolerance |
| Sexual | Any sexual content or innuendo | Zero tolerance |
| Discrimination | Racial, gender, disability stereotypes | Zero tolerance |
| Dangerous imitation | "Try mixing chemicals", "Jump from high places" | Zero tolerance |
| Political | Political figures, ideology, territorial disputes | Zero tolerance |
| Commercial | Brand names, product placement, purchase prompts | Zero tolerance |
| Superstition | Fortune telling, curses, supernatural threats | Zero tolerance |

### Requires Careful Handling

| Topic | Guideline |
|-------|-----------|
| Death | May explain natural death (plants/animals) in gentle terms. No graphic descriptions. |
| Illness | May explain "why do we get sick" with hope-oriented framing. No fear-inducing content. |
| Natural disasters | May explain earthquakes/storms scientifically. Include safety tips. No apocalyptic framing. |
| Body functions | Age-appropriate anatomical terms OK. No embarrassment-inducing framing. |
| Predator-prey | "Animals eat other animals" OK. No graphic hunting descriptions. |

### Content Review Process

1. All questions authored by content team are reviewed by 2 independent reviewers.
2. AI-assisted scan for sensitive keywords (see `scripts/content-safety-scan.js`).
3. Quarterly full review of all content by child psychology consultant.
4. Parent feedback channel for content concerns.

---

## 3. Data Collection Whitelist

**Principle: We collect NO personal information. All data is local.**

Permitted local storage (wx.setStorageSync):

| Key | Content | Sensitivity |
|-----|---------|------------|
| `browsing_history` | Question IDs viewed | Non-PII |
| `favorites` | Question IDs saved | Non-PII |
| `session_settings` | Time limit preferences | Non-PII |
| `parent_verified` | Boolean flag | Non-PII |
| `usage_stats` | Daily question count | Non-PII |
| `last_category` | Last viewed category | Non-PII |

Explicitly NEVER collected:
- Device ID (IMEI, MAC, UDID)
- Location (GPS, IP-based)
- Contact information
- Photos, videos, audio
- Clipboard content
- Other app information
- Biometric data

---

## 4. Legal Document Checklist

### Required Documents

| Document | Status | Location |
|----------|--------|----------|
| 隐私政策 (Privacy Policy) | Required | Hosted at HTTPS URL, linked in app |
| 儿童隐私保护声明 (Children's Privacy Statement) | Required | Section within privacy policy |
| 用户协议 (User Agreement) | Required | Linked in app settings |
| 未成年人保护计划 (Minor Protection Plan) | Required | Internal document + summary in app |
| 信息安全应急预案 (Security Incident Response Plan) | Recommended | Internal document |

### Privacy Policy Must Include

1. Identity and contact info of the data controller
2. Types of data collected (answer: none for PII)
3. Purpose of data processing
4. Data retention period
5. Data subject rights (access, correction, deletion)
6. Children's data protection measures
7. Guardian consent mechanism
8. Contact for complaints/inquiries
9. Policy update notification mechanism
10. Effective date

### Guardian Consent Mechanism

Since we collect no PII, full guardian consent flow is not required.
However, we implement a parent verification gate for:
- Modifying session time limits
- Viewing usage reports
- Accessing settings
- Any future features that might collect data

Implementation: Simple arithmetic problem (e.g., "32 - 15 = ?") that
is trivial for adults but beyond 2-6 year old capability.

---

## 5. Compliance Engineering Implementation

### Technical Controls

```javascript
// Session time management (required by Article 26/32)
const SESSION_LIMIT_MINUTES = 20;
const DAILY_LIMIT_MINUTES = 40;
const NIGHTTIME_START = 22; // 10 PM
const NIGHTTIME_END = 6;   // 6 AM

// Content age gate (required by Article 20)
const TARGET_AGE_MIN = 2;
const TARGET_AGE_MAX = 6;
const CONTENT_RATING = 'age-appropriate-2-6';

// Data minimization (required by Article 31 PIPL)
const STORAGE_WHITELIST = [
  'browsing_history', 'favorites', 'session_settings',
  'parent_verified', 'usage_stats', 'last_category'
];
```

### Audit Trail

Maintain an internal compliance log:
- Date of last content review
- Reviewer names and findings
- Changes made in response to compliance issues
- Legal consultation dates and outcomes
- Regulatory changes tracked and implementation dates

---

## 6. Regulatory Update Monitoring

Track these regulatory bodies for updates:
- 国家互联网信息办公室 (CAC) — cyberspace regulations
- 国家新闻出版署 — publishing and content regulations
- 市场监管总局 — advertising and consumer protection
- 教育部 — educational content standards

When a new regulation is published:
1. Review within 7 days
2. Assess impact on this project within 14 days
3. Implement required changes before enforcement date
4. Document compliance in audit trail
