# 项目配置说明（project.config.json）

> 本文件用于解释 `project.config.json` 中需要开发者手动替换的关键字段。

## appid 字段

当前 `project.config.json` 中：

```json
"appid": "TOURIST_APPID_PERSONAL_PENDING"
```

**说明**：这是一个占位符，提醒开发者需要替换为自己注册的微信小程序个人主体 AppID。

### 如何获取个人 AppID

1. 访问微信公众平台：https://mp.weixin.qq.com/
2. 注册"小程序"账号（主体类型选择"个人"）。
   - 个人主体小程序不支持微信认证，但可以发布到线上。
   - 个人主体可使用的服务类目有限，本小程序建议选择"教育-在线教育"或"工具"类目。
3. 完成注册后，在左侧菜单「开发管理 → 开发设置」中可以看到「AppID」。
4. 复制 AppID，替换 `project.config.json` 中的 `TOURIST_APPID_PERSONAL_PENDING` 即可。

### 重要提醒

- 在 AppID 替换为真实值之前，无法使用微信开发者工具的"上传"功能发布到体验/正式版本。
- 本项目已经使用"测试号"（touristappid）完成了本地调试，但提交审核前必须替换为真实个人 AppID。
- 个人主体小程序的接口权限受限：无法使用 `wx.login` 获取 openid 用于云开发，因此本项目的内容存储使用 GitHub 仓库 + jsDelivr CDN 的方案，不依赖云开发。

## 关联文档

- 未成年人保护方案：`docs/minor-protection.md`
- 隐私保护政策：`docs/privacy-policy.md`
- 微信小程序审核报告：`docs/wx-audit-report-2026-06-30.md`
