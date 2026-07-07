# H5 国际版 locale 按需加载方案设计

**Sprint**: 69 (V8.61)
**负责**: Global 何 + 前端小凡
**设计日期**: 2026-07-05
**落地 Sprint**: 70

---

## 问题

当前 `src/h5/utils/i18n.js` 的 `DICT` 对象全量打包进首屏，包含 42 个 locale 的翻译文件（约 2MB）。H5 国际版首屏加载所有 locale 文件严重影响性能。

## 方案

### 架构

```
src/h5/utils/
  i18n.js              ← 核心：t()/getLocale()/setLocale()/normalizeLocale()（不变）
  i18n/
    index.js           ← 动态加载入口（Vite 自动拆 chunk）
    zh.js              ← 中文 DICT（~50KB，首屏加载）
    en.js              ← 英文 DICT（~50KB）
    ja.js              ← 日文 DICT
    ko.js              ← 韩文 DICT
    es.js              ← 西班牙文 DICT
    ... (42 locales)
```

### 核心变更

```js
// i18n/index.js —— 动态加载入口
const DICT_CACHE = { zh: DICT_ZH }  // 中文默认内联

export async function loadLocaleDict(locale) {
  const base = normalizeLocale(locale)
  if (DICT_CACHE[base]) return DICT_CACHE[base]
  
  // Vite 动态 import 自动拆 chunk
  const module = await import(`./${base}.js`)
  DICT_CACHE[base] = module.DICT
  return module.DICT
}

// t() 函数改为异步感知
export function t(key, params, locale) {
  const base = normalizeLocale(locale)
  const dict = DICT_CACHE[base] || DICT_ZH
  // ... 查表逻辑不变
}
```

### 预加载策略

```js
// 检测到用户切换 locale 时，预加载最常用的 5 个 locale
const PRELOAD_LOCALES = ['en', 'ja', 'ko', 'es', 'fr']

export function preloadCommonLocales() {
  PRELOAD_LOCALES.forEach(locale => {
    loadLocaleDict(locale).catch(() => {})
  })
}
```

### 构建产物

每个 locale 独立 chunk，命名规则：`i18n-[locale]-[hash].js`
Vite 配置：

```js
// vite.config.js
build: {
  rollupOptions: {
    output: {
      manualChunks(id) {
        if (id.includes('/i18n/') && !id.includes('/i18n/index')) {
          return `i18n-${id.split('/').pop().replace('.js', '')}`
        }
      }
    }
  }
}
```

### 向后兼容

- `t()` 函数签名不变（同步调用，查 DICT_CACHE）
- 首屏中文用户零性能影响（zh.js 内联）
- 英文用户：首屏加载 en.js（~50KB），其余 locale 按需/预加载
- 未加载 locale 时 `t()` 回退到 `zh` 文案

### 性能目标

- 首屏 locale 加载：< 50KB（当前 42 个 locale 全量 ≈ 2MB）
- 非首屏 locale 切换：< 200ms（动态 import 本地文件）
- 预加载：用户切换 locale 后 2s 内后台加载 5 个常用 locale

### 技术风险

- 动态 import 在低版本浏览器不支持（iOS Safari < 14）—— 降级方案：全量打包
- 42 个 locale 文件维护成本 —— 构建脚本自动生成
- 翻译文件更新时 chunk hash 变化 —— 利用 Vite 自带 hash 机制

### 验证计划

- Sprint 69：技术验证（单 locale 加载性能 + 构建产物大小）
- Sprint 70：全量落地（42 个 locale 拆分 + 预加载策略）