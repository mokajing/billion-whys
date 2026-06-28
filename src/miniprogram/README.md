# 十亿个什么与为什么 · 微信小程序

面向 2-6 岁儿童家庭的好奇心即时响应小程序。本目录为微信小程序工程根目录。

## 工程结构

```
billion-whys/
├── project.config.json              # 微信开发者工具工程配置
├── project.private.config.json      # 本地工程私有配置（调试入口）
└── src/
    ├── h5/                          # Vue 3 + Vite 的 H5 同源版本
    └── miniprogram/                 # 微信小程序工程根（miniprogramRoot）
        ├── app.js / app.json / app.wxss
        ├── privacy.json             # 隐私合规配置
        ├── sitemap.json             # 索引规则
        ├── assets/                  # tabBar 图标
        ├── data/                    # 内容数据（questions.json）
        ├── pages/                   # 6 个页面（discover/ask/archive/profile/question/privacy）
        └── utils/                   # 分层抽象
            ├── safe-wx.js           # wx.* API 守卫层（必经）
            ├── storage.js           # 本地持久化单一入口
            ├── analytics.js         # 归因/埋点即时上报
            ├── content.js           # 内容查询与业务胶合
            └── constants.js         # 圈层/类目/实验类型常量
```

## 架构分层（过审规格）

按 wx-minigame-audit-team 专家团方法论建立"提交即通过"的代码质量与合规保障体系：

1. **平台守卫层（utils/safe-wx.js）**
   - 所有 `wx.*` API 调用必须先 `typeof wx !== 'undefined' && typeof wx.getSystemInfoSync === 'function'` 守卫
   - 提供降级路径，便于未来 H5 端复用
   - 反 BUG-012 / BUG-058 类问题

2. **持久化单一入口（utils/storage.js）**
   - 缓存 + 持久化字段必须通过单一 setter 写入，禁止外部直接覆写
   - 反 BUG-056 类问题：缓存与持久化不一致

3. **归因/埋点（utils/analytics.js）**
   - 埋点在用户行为发生时即刻上报，不依赖后续动作
   - 反 BUG-054 类问题

4. **隐私合规**
   - `__usePrivacyCheck__: true` + `privacy.json`
   - `app.js` 注册 `wx.onNeedPrivacyAuthorization` 回调
   - `pages/privacy/` 提供完整隐私政策页面
   - sitemap.json 把 privacy 页设为 disallow（不外露隐私页）

5. **代码包结构**
   - 主包体积 908KB（远低于 4MB 主包上限，无需分包）
   - `bigPackageSizeSupport: true` 已开启（游戏类推荐）
   - `lazyCodeLoading: 'requiredComponents'` 按需注入
   - `preloadRule` 预加载主包

6. **审核红线遵守**
   - 无诱导分享：分享是被动 `onShareAppMessage`，非强制
   - 无虚拟支付：纯内容浏览，无支付环节
   - 无广告位
   - 无实名认证要求（教育辅助类，2-6 岁家庭场景，不触发防沉迷）
   - 隐私政策、客服反馈入口齐全

## 启动方式

1. 打开微信开发者工具
2. 导入项目，目录指向 `billion-whys/`（项目根，会自动读取 `project.config.json` 中的 `miniprogramRoot: src/miniprogram/`）
3. AppID 暂用 `touristappid`，正式提审前替换为正式 AppID

## 与 H5 版本的关系

`src/h5/` 是同源 Vue 3 + Vite 版本，用作网页端体验和 SEO。小程序版本独立构建，不依赖 H5 构建产物。
