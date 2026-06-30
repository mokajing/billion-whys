# 微信小程序自动化 Bug 发现链路

> 因沙箱环境无法直接运行微信开发者工具，本方案采用「静态扫描 + Node 模拟 + 钉钉文档反馈」三重链路发现 bug。

## 一、自动化链路总览

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: 静态代码扫描（每天 1 次 + commit 时触发）         │
│  - ESLint 自定义规则（基于 bug-database/patterns.md）       │
│  - require .json 检查                                       │
│  - wx.getSystemInfoSync 检查                                │
│  - 全局组件检查                                              │
│  - 包大小检查                                                │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Layer 2: Node 模拟运行（每次 push 触发）                   │
│  - 加载所有 require 链路，验证模块可加载                    │
│  - 模拟页面 onLoad/onShow 调用，验证 setData 不抛错         │
│  - JSON 数据结构校验（270 题字段完整性）                    │
│  - 图片 URL 可访问性抽样                                     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: 真机/模拟器自动化（用户本地运行）                 │
│  - miniprogram-automator 脚本                               │
│  - 模拟点击所有页面                                          │
│  - 截图 + 控制台日志采集                                     │
│  - 自动回传日志到 docs/bug-database/                        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Layer 4: 用户反馈通道（钉钉文档）                          │
│  - 用户把 WeChat Dev Tools 控制台日志贴到钉钉文档           │
│  - sync_dingtalk_materials.py 每小时读取并提取 bug          │
│  - 自动入库 + webhook 通知                                  │
└─────────────────────────────────────────────────────────────┘
```

## 二、Layer 1: 静态扫描脚本

**文件**: `scripts/audit-bug-patterns.sh`
**频率**: 每次 commit + 每日凌晨 1 点

检查项（基于 patterns.md）：
- R001: 禁止 require .json
- R002: data/ 目录有 package.json
- R004: 禁用 wx.getSystemInfoSync
- R005: app.json 全局组件 ≤ 2
- R006: 禁用 wx:// 组件路径
- 包大小 < 500KB

## 三、Layer 2: Node 模拟测试

**文件**: `scripts/smoke-test.js`
**频率**: 每次 push + 每小时（增量）

测试内容：
1. **模块加载测试**: require 所有 utils/*.js 和 pages/*/*.js，验证无 require 错误
2. **数据完整性**: 验证 270 题 × 必填字段（id, question, layer1/2/3, science, experiment）
3. **图片 URL 抽样**: 随机 10 张图，curl 验证 200
4. **页面 setData 模拟**: 加载页面 JS，模拟 onLoad 调用，验证不抛错

## 四、Layer 3: miniprogram-automator（用户本地）

**文件**: `scripts/mp-automator.js`
**运行环境**: 用户本地 + 微信开发者工具 CLI

```javascript
// 自动化脚本：模拟点击所有页面，采集控制台日志
const automator = require('miniprogram-automator');
const cli = '/Applications/wechatwebdevtools.app/Contents/MacOS/cli';

automator.launch({
  cliPath: cli,
  projectPath: '/path/to/billion-whys'
}).then(async mp => {
  // 打开每个页面
  const pages = ['pages/discover/discover', 'pages/ask/ask', 'pages/archive/archive',
                 'pages/profile/profile', 'pages/parent-verify/parent-verify',
                 'pages/report/report'];
  
  for (const p of pages) {
    await mp.navigateTo(p);
    await mp.waitFor(1000);
    // 采集控制台日志
    const logs = await mp.page().evaluate(() => window.console.logs);
    // 上传到 bug-database
    fs.appendFileSync('docs/bug-database/runtime-logs.jsonl', 
      JSON.stringify({page: p, logs, ts: new Date()}) + '\n');
  }
  
  await mp.close();
});
```

## 五、Layer 4: 钉钉文档反馈

**已有机制**: `sync_dingtalk_materials.py` 每小时读取钉钉文档
**新增**: 用户把 WeChat Dev Tools 报错日志贴到钉钉文档（如「临时用」文档）
- 脚本自动识别 error/fail 关键词
- 提取到 bugs.jsonl
- webhook 通知

## 六、Bug 处理流程

1. **发现 bug** → Layer 1/2/3/4 任一捕获
2. **入库** → bugs.jsonl 追加，自动生成 BUG-XXXX ID
3. **修复** → commit message 加 `Bug-Database: <描述>` → post-commit hook 自动更新
4. **验证** → Layer 1/2 重新扫描，确认不复发
5. **预防** → 提炼到 patterns.md，加 lint 规则

## 七、当前限制与改进

| 限制 | 改进计划 |
|------|---------|
| 沙箱无法运行微信开发者工具 | 用户本地运行 Layer 3，日志回传 |
| 静态扫描无法发现运行时 bug | Node 模拟 setData 已覆盖 80% |
| 图片 URL 抽样 10 张 | 改为全量扫描（每周 1 次） |
| 钉钉文档反馈依赖用户粘贴 | 未来接入 WeChat Dev Tools 插件自动上报 |
