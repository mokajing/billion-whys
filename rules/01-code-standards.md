# 01 - Code Standards

> Applies to: 十亿个什么与为什么 WeChat Mini-Program codebase

---

## 1. Good / Bad Code Comparisons

### 1.1 safe-wx API Usage

```javascript
// BAD - Direct wx API call without error handling
Page({
  onLoad() {
    const res = wx.getStorageSync('history');
    this.setData({ history: res });
  }
});

// GOOD - Use safe-wx wrapper with fallback
const { safeGetStorage, safeSetStorage } = require('../../utils/safe-wx');

Page({
  onLoad() {
    const res = safeGetStorage('history', []);
    this.setData({ history: res });
  }
});
```

**Rule:** Never call `wx.*Sync` or `wx.*` APIs directly in page/component code.
Always use `utils/safe-wx.js` wrappers that provide try/catch, default values,
and unified error logging.

### 1.2 Require .json Ban

```javascript
// BAD - require JSON file (causes runtime error in some base library versions)
const seedData = require('../../data/seeds.json');

// GOOD - Read JSON via wx.getFileSystemManager or embed as JS module
const seedData = require('../../data/seeds.js'); // module.exports = { ... }
// OR for dynamic loading:
const fs = wx.getFileSystemManager();
const content = fs.readFileSync(`${wx.env.USER_DATA_PATH}/seeds.json`, 'utf-8');
const seedData = JSON.parse(content);
```

**Rule:** WeChat MP does not reliably support `require('*.json')`.
Always export data as CommonJS modules (`.js` files with `module.exports`).

### 1.3 setData Optimization

```javascript
// BAD - Setting entire array when only one item changes
this.setData({
  questions: this.data.questions  // 270+ items re-rendered
});

// GOOD - Path-based partial update
this.setData({
  [`questions[${index}].viewed`]: true,
  [`questions[${index}].timestamp`]: Date.now()
});
```

**Rule:** Never pass full arrays or deep objects to `setData`.
Use path expressions for surgical updates. Keep `setData` calls under 5 per second.

---

## 2. ESLint Configuration

Project root `.eslintrc.js`:

```javascript
module.exports = {
  env: { es6: true, node: true },
  globals: {
    wx: 'readonly',
    App: 'readonly',
    Page: 'readonly',
    Component: 'readonly',
    getApp: 'readonly',
    getCurrentPages: 'readonly',
    requirePlugin: 'readonly'
  },
  rules: {
    'no-var': 'error',
    'prefer-const': 'error',
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'eqeqeq': ['error', 'always'],
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'max-depth': ['warn', 4],
    'max-lines-per-function': ['warn', { max: 80 }],
    'complexity': ['warn', 10]
  }
};
```

Custom rules (see `rules/06-bug-dictionary.md` for R001-R007):
- `no-require-json`: Ban `require('*.json')`
- `no-direct-wx-api`: Enforce safe-wx wrappers
- `no-setdata-full-array`: Flag setData with array/object literals over 10 keys

---

## 3. Comment Template (JSDoc)

```javascript
/**
 * Fetches the 3-layer answer for a given question.
 *
 * Layer 1: Child-friendly (~50 chars, age 2-6)
 * Layer 2: Deeper explanation (~120 chars)
 * Layer 3: Parent science section (~200 chars)
 *
 * @param {string} questionId - Seed library question ID (e.g., "animals_001")
 * @param {number} [layer=1] - Answer layer depth (1-3)
 * @returns {{ text: string, audioUrl?: string, experiment?: object }}
 * @throws {ContentError} If questionId not found in seed library
 *
 * @example
 * const answer = getAnswer('animals_001', 2);
 * // => { text: '因为长颈鹿需要吃到高高的树叶...', audioUrl: null }
 */
function getAnswer(questionId, layer = 1) { ... }
```

Required JSDoc tags for all exported functions:
- `@param` with type and description
- `@returns` with type
- `@throws` if function can throw
- `@example` for public API functions

---

## 4. Error Handling Class Hierarchy

```
AppError (base)
 +-- NetworkError        // CDN fetch failures, timeout
 +-- ContentError        // Missing question, invalid seed data
 |    +-- SchemaError    // JSON schema validation failure
 |    +-- ImageError     // Image load/decode failure
 +-- AuthError           // Parent verification failure
 +-- StorageError        // wx storage read/write failure
 +-- RenderError         // setData or template rendering failure
 +-- AuditError          // Content safety check failure
```

Implementation in `utils/errors.js`:

```javascript
class AppError extends Error {
  constructor(message, code, context = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.context = context;
    this.timestamp = Date.now();
  }
}

class NetworkError extends AppError {
  constructor(message, context) {
    super(message, 'NETWORK_ERR', context);
  }
}

class ContentError extends AppError {
  constructor(message, context) {
    super(message, 'CONTENT_ERR', context);
  }
}

// ... additional subclasses follow same pattern
module.exports = { AppError, NetworkError, ContentError, AuthError, StorageError, RenderError, AuditError };
```

**Rule:** All `catch` blocks must wrap errors in the appropriate class.
Raw `Error` objects must not propagate to page-level code.

---

## 5. Naming Conventions

| Scope | Convention | Example |
|-------|-----------|---------|
| JS variables / functions | camelCase | `getAnswer`, `questionList` |
| JS constants | UPPER_SNAKE | `MAX_DAILY_QUESTIONS`, `CDN_BASE_URL` |
| File names | kebab-case | `seed-library.js`, `safe-wx.js` |
| Component names | PascalCase (dir) | `AnswerCard/`, `QuestionBubble/` |
| CSS classes | BEM kebab | `answer-card__title--active` |
| JSON keys (seed library) | camelCase | `questionText`, `parentGuide` |
| Image assets | kebab-case | `icon-rabbit-happy.webp` |
| IP character references | Chinese name | 问问兔, 答答熊 (code: `wenwen`, `dada`) |

---

## 6. Module Structure Rules

Every directory containing JS modules **must** have a `package.json`:

```json
{
  "type": "commonjs"
}
```

This prevents ambiguity in module resolution within the WeChat MP build system.

Directory layout:

```
miniprogram/
  app.js
  app.json
  app.wxss
  package.json          # { "type": "commonjs" }
  components/
    package.json        # { "type": "commonjs" }
    AnswerCard/
      AnswerCard.js
      AnswerCard.json
      AnswerCard.wxml
      AnswerCard.wxss
  pages/
    package.json
    home/
      home.js
      home.json
      home.wxml
      home.wxss
  utils/
    package.json
    safe-wx.js
    errors.js
    content.js
  data/
    package.json
    seeds.js            # NOT seeds.json
    categories.js
```

**Rule:** `require()` paths must be relative. Absolute paths and npm packages
are not supported in WeChat MP without npm build step.
