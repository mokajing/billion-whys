# 「十亿个什么与为什么」广告变现方案

> 版本：v1.0
> 生效日期：2026 年 6 月 30 日
> 适用产品：微信小程序「十亿个什么与为什么」（个人主体版）
> 适用阶段：MVP 上线后至商业化成熟期
> 关联文档：`category-qualification-personal.md`、`prd-personal-v1.md`、`minor-protection.md`

---

## 1. 总体原则

### 1.1 变现定位

本项目采用**"免费内容 + 广告变现"**模式，不接受付费墙、会员、虚拟商品等任何向用户收费的形态。理由：

1. 目标用户为 2-6 岁儿童，**对儿童收费在合规与伦理层面均不可接受**；
2. 个人主体不能开通微信支付，无法做付费功能；
3. 广告变现可在不影响儿童内容体验的前提下，由家长侧页面承载，实现可持续运营。

### 1.2 三条不可逾越的红线

1. **儿童内容页零广告**：layer1/2/3（L1 儿童好奇层 / L2 家长陪同实验层 / L3 成人科普层）页面**严禁展示任何广告**。
2. **未成年人模式零广告**：当 `wx.getChildSceneInfo` 检测到未成年人模式时，全小程序**强制关闭所有广告位**。
3. **广告内容合规**：所有接入的广告素材必须符合《广告法》《未成年人保护法》《未成年人网络保护条例》及微信广告平台规范，**不得含暴力、低俗、性暗示、政治敏感、不良价值观内容**。

### 1.3 微信广告能力参考

- 微信小程序广告 API：https://developers.weixin.qq.com/miniprogram/dev/api/ad/
- 流量主接入指南：https://developers.weixin.qq.com/miniprogram/dev/api/ad/traffic.html
- banner 广告：`wx.createBannerAd`
- 激励视频广告：`wx.createRewardedVideoAd`
- 插屏广告：`wx.createInterstitialAd`（本项目不接入，避免惊吓儿童）

---

## 2. 阶段化变现策略

### 2.1 阶段总览

| 阶段 | DAU 区间 | 广告策略 | 预估月收入 |
| --- | --- | --- | --- |
| Phase 1 | 0 - 1000 | **无广告**，专注内容质量与用户增长 | ¥0 |
| Phase 2 | 1000 - 10000 | 申请开通流量主，家长侧页面接入 banner 广告 | ¥450 - ¥4500 |
| Phase 3 | 10000+ | 新增激励视频广告（家长侧解锁扩展实验） | ¥4500+ |

### 2.2 Phase 1：0-1000 DAU（冷启动期）

**核心目标**：内容质量验证、用户口碑积累、提审稳定通过。

**广告策略**：
- 全小程序**不接入任何广告**；
- 不申请流量主；
- 主界面、家长控制面板、举报页、个人中心均无广告；
- 不调用 `wx.createBannerAd` / `wx.createRewardedVideoAd` 等 API。

**为什么必须无广告**：
1. 微信流量主开通门槛为**累计独立访客（UV）≥ 1000**，冷启动期不满足；
2. 早期接入广告会拖慢加载速度、降低用户体验、影响留存；
3. 提审阶段广告会增加审核驳回点（广告位合规、广告内容合规、未成年人保护审查）；
4. 早期 DAU 低，广告收入可忽略不计，不值得牺牲体验。

**关键动作**：
- 完成 270 题内容与配图自审；
- 完成未成年人保护方案落地；
- 通过 `wx-miniprogram-audit-team` 技能的 270 题自审；
- 跑通家长验证、时间管理、内容分级、举报机制；
- 监控举报与投诉，迭代内容质量。

### 2.3 Phase 2：1000-10000 DAU（成长期）

**核心目标**：稳定变现基础，验证广告对家长体验的影响。

**开通条件**：
- 累计独立访客（UV）≥ 1000；
- 无重大违规记录；
- 已通过小程序代码审核并上线 ≥ 30 天；
- 已发布未成年人保护方案与隐私政策。

**广告策略**：
- 申请开通"流量主"（小程序后台 → 流量主 → 开通）；
- 在**家长侧页面**接入 banner 广告：
  - 家长控制面板（家长验证后的页面）
  - 内容归档页（家长查看历史记录的页面）
  - 关于页面、设置页面
- 主界面（L1/L2/L3 内容页）**仍零广告**；
- 不接入激励视频与插屏广告。

**banner 广告技术实现**：

```javascript
// pages/parent-control/parent-control.js（家长控制面板页）
Page({
  onLoad() {
    // 仅在家长验证通过后展示
    if (!wx.getStorageSync('parent_verified_until') || Date.now() > wx.getStorageSync('parent_verified_until')) {
      return; // 未验证不展示广告
    }
    // 检测未成年人模式
    if (wx.getStorageSync('force_child_mode')) {
      return; // 未成年人模式不展示广告
    }
    this.bannerAd = wx.createBannerAd({
      adUnitId: '<banner-ad-unit-id>', // 在流量主后台创建后获取
      adIntervals: 30, // 30 秒刷新一次
      style: {
        left: 10,
        top: 100,
        width: 320
      }
    });
    this.bannerAd.onError(err => {
      console.warn('banner ad error:', err);
      // 广告加载失败时静默处理，不影响页面功能
    });
  },
  onUnload() {
    this.bannerAd && this.bannerAd.destroy();
  }
});
```

**广告位布局**：

```
家长控制面板页面布局：
┌────────────────────────────────────┐
│  👨‍👩‍👧 家长控制面板                │
├────────────────────────────────────┤
│  📊 使用统计                       │
│  ⏰ 时间管理                       │
│  🔒 内容过滤等级                  │
│  🔄 重置与清除                     │
├────────────────────────────────────┤
│  [ banner 广告位 320x50 ]          │  ← 仅家长验证后可见
├────────────────────────────────────┤
│  © 十亿个什么与为什么              │
└────────────────────────────────────┘
```

### 2.4 Phase 3：10000+ DAU（成熟期）

**核心目标**：在保持儿童内容零广告的前提下，通过激励视频扩展内容深度。

**广告策略**：
- 保留 Phase 2 的家长侧 banner 广告；
- 新增**激励视频广告**，仅在家长侧"解锁扩展实验"场景使用；
- 未成年人模式仍强制关闭所有广告。

**激励视频使用场景**（仅在家长侧）：
- 家长控制面板中"解锁本周扩展实验包"按钮 → 观看完整激励视频后，额外解锁 3-5 个 L2 实验内容；
- 该解锁对儿童侧无感知，儿童主界面不出现"看广告解锁"入口；
- 解锁内容仍须通过未成年人内容审核。

**激励视频技术实现**：

```javascript
// pages/parent-control/parent-control.js
Page({
  unlockExtraExperiments() {
    // 双重校验：家长验证 + 非未成年人模式
    if (!this.isParentVerified() || wx.getStorageSync('force_child_mode')) {
      return;
    }
    const rewardedVideoAd = wx.createRewardedVideoAd({
      adUnitId: '<rewarded-video-ad-unit-id>'
    });
    rewardedVideoAd.onClose(res => {
      if (res && res.isEnded) {
        // 观看完成，解锁扩展实验
        wx.setStorageSync('extra_experiments_unlocked', true);
        wx.showToast({ title: '已解锁扩展实验包', icon: 'success' });
      }
    });
    rewardedVideoAd.onError(err => {
      console.warn('rewarded video ad error:', err);
      wx.showToast({ title: '广告加载失败，稍后再试', icon: 'none' });
    });
    rewardedVideoAd.show().catch(err => {
      console.warn('rewarded video ad show failed:', err);
    });
  },
  isParentVerified() {
    const until = wx.getStorageSync('parent_verified_until');
    return until && Date.now() < until;
  }
});
```

---

## 3. 广告位与儿童内容的物理隔离

### 3.1 广告位白名单（仅以下页面允许接入广告）

| 页面 | 路径 | 阶段 | 广告类型 |
| --- | --- | --- | --- |
| 家长控制面板 | `/pages/parent-control/*` | Phase 2 | banner |
| 内容归档页 | `/pages/archive/*` | Phase 2 | banner |
| 关于页面 | `/pages/about/*` | Phase 2 | banner |
| 设置页面 | `/pages/settings/*` | Phase 2 | banner |
| 家长控制面板-扩展实验 | `/pages/parent-control/*` | Phase 3 | 激励视频 |

### 3.2 广告位黑名单（严禁接入广告）

| 页面 | 路径 | 原因 |
| --- | --- | --- |
| 主界面（L1 儿童好奇层） | `/pages/home/*` | 儿童直接可见 |
| 实验步骤页（L2 家长陪同实验层） | `/pages/experiment/*` | 儿童直接可见 |
| 成人科普页（L3） | `/pages/science-adult/*` | 内容敏感，不混入商业引导 |
| 首次启动家长验证页 | `/pages/parent-verify/*` | 验证流程不应被打断 |
| 举报页 | `/pages/report/*` | 用户行使权利时不打断 |
| 隐私政策、用户协议 | `/pages/policy/*` | 法律文本不应混入商业引导 |

### 3.3 物理隔离的技术保障

1. 广告组件仅在白名单页面的 `.wxml` / `.js` 中实例化；
2. 通过 ESLint 自定义规则禁止在 `/pages/home/`、`/pages/experiment/`、`/pages/science-adult/` 目录下引用 `wx.createBannerAd` / `wx.createRewardedVideoAd`；
3. CI 阶段执行扫描脚本，发现违规引用直接 fail；
4. 每月自审清单（详见 minor-protection.md 第 10 章）覆盖广告位扫描。

---

## 4. 未成年人模式下的广告强制关闭

### 4.1 检测逻辑

```javascript
// app.js
App({
  onLaunch() {
    // 基础库 ≥ 2.41.0 才支持
    if (wx.canIUse('getChildSceneInfo')) {
      wx.getChildSceneInfo({
        success(res) {
          const isChildMode = res.scene === 1011 || res.is_child_scene;
          if (isChildMode) {
            wx.setStorageSync('force_child_mode', true);
          }
        }
      });
    }
  }
});
```

### 4.2 广告展示前的双重校验

每个广告位在 `onLoad` / 展示前必须执行：

```javascript
function shouldShowAd() {
  // 1. 未成年人模式强制关闭
  if (wx.getStorageSync('force_child_mode')) return false;
  // 2. 家长验证未通过则不展示
  const until = wx.getStorageSync('parent_verified_until');
  if (!until || Date.now() > until) return false;
  return true;
}
```

### 4.3 未成年人模式下的强制行为

| 行为 | 普通模式 | 未成年人模式 |
| --- | --- | --- |
| 主界面广告 | 无（始终无） | 无 |
| 家长侧 banner 广告 | 家长验证后可见 | **强制隐藏** |
| 激励视频广告 | 家长侧可选 | **强制隐藏** |
| 流量主 SDK | 已加载 | 已加载但不展示 |

---

## 5. 收入预估

### 5.1 关键假设

| 参数 | 取值 | 说明 |
| --- | --- | --- |
| DAU | 按阶段 | 1000 / 10000 |
| 广告展示/用户 | 0.5 | 家长侧单次使用平均观看 0.5 次广告 |
| eCPM | ¥30 | 微信小程序 banner 广告行业平均 eCPM |
| 激励视频 eCPM | ¥80 | Phase 3 激励视频行业平均 |

### 5.2 Phase 2 收入预估（1000 DAU）

```
日收入 = DAU × 广告展示/用户 × eCPM / 1000
       = 1000 × 0.5 × 30 / 1000
       = ¥15/天
月收入 ≈ ¥450
```

### 5.3 Phase 2 收入预估（10000 DAU）

```
日收入 = 10000 × 0.5 × 30 / 1000 = ¥150/天
月收入 ≈ ¥4500
```

### 5.4 Phase 3 收入预估（10000 DAU，含激励视频）

假设 10% 家长每日观看 1 次激励视频：

```
激励视频日收入 = 10000 × 10% × 1 × 80 / 1000 = ¥80/天
banner 日收入 = ¥150/天
合计日收入 ≈ ¥230/天
月收入 ≈ ¥6900
```

### 5.5 收入用途规划

- 50% 用于内容生产（270 题扩展、配图升级、新增实验）；
- 30% 用于运营（客服、举报响应、内容审核）；
- 20% 用于合规与基础设施（软著续展、ICP 备案、第三方安全评估、服务器）；
- 0% 用于分红（个人主体阶段不分红，留存用于项目发展）。

---

## 6. 合规要求

### 6.1 《广告法》合规

- 不得接入虚假广告、夸大宣传广告；
- 不得接入医疗、药品、保健食品、金融理财类广告（与儿童产品调性冲突，且审核风险高）；
- 不得在广告中出现"国家级""最高级""最佳"等绝对化用语；
- 广告内容不得误导儿童家长作出消费决策。

### 6.2 《未成年人保护法》《未成年人网络保护条例》合规

- **不得在未成年人模式中投放广告**（《未成年人网络保护条例》第 32 条）；
- 不得在儿童内容页（L1/L2/L3）投放广告；
- 广告不得含有诱导未成年人沉迷的内容；
- 广告不得诱导家长为儿童购买商品或服务；
- 广告素材不得含暴力、恐怖、低俗、性暗示、不良价值观内容。

### 6.3 微信广告平台合规

- 严格遵守《微信小程序流量主运营规范》；
- 不得人工干预广告展示（如自动点击、刷新作弊）；
- 不得引导用户点击广告（如"点击广告支持我们"）；
- 不得遮挡、隐藏广告关闭按钮；
- 广告位与功能按钮保持足够间距，避免误触；
- 广告加载失败时静默处理，不影响页面功能。

### 6.4 流量主开通与持续合规

- 流量主开通后，每月 1 次自查广告位是否正常展示、是否有违规广告素材；
- 发现违规广告素材立即在流量主后台屏蔽该广告主，并向微信平台举报；
- 关注微信广告平台规范变更，14 天内适配。

---

## 7. 监控与运营

### 7.1 关键指标

| 指标 | 监控频率 | 告警阈值 |
| --- | --- | --- |
| 广告填充率 | 每日 | < 80% 告警 |
| 广告展示成功率 | 每日 | < 95% 告警 |
| 广告点击率（CTR） | 每日 | 异常偏高（> 10%）告警，疑似误触 |
| eCPM | 每周 | < ¥15 告警 |
| 月收入 | 每月 | 低于预估 50% 启动复盘 |
| 举报中"含广告"类占比 | 每月 | > 5% 启动广告位复盘 |

### 7.2 异常处理

- 广告点击率异常偏高：检查广告位是否与功能按钮重叠，调整为更大间距；
- 收入异常下降：检查广告位是否被微信平台限制、是否广告主屏蔽过多；
- 举报中"含广告"占比偏高：核查广告主列表，屏蔽违规广告主。

---

## 8. 阶段切换的进入与退出条件

### 8.1 Phase 1 → Phase 2

**进入条件（全部满足）**：
- 累计 UV ≥ 1000；
- 小程序上线 ≥ 30 天；
- 无重大违规记录；
- 未成年人保护方案落地完成；
- 270 题内容自审通过。

**退出条件**（任一触发即回退）：
- 出现未成年人模式广告展示事故 → 立即下线所有广告位，回退至 Phase 1；
- 微信平台政策变更限制个人主体流量主 → 回退至 Phase 1，启动企业主体迁移。

### 8.2 Phase 2 → Phase 3

**进入条件（全部满足）**：
- DAU ≥ 10000；
- Phase 2 广告收入稳定 ≥ ¥1000/月；
- 用户举报率 < 1%；
- 激励视频场景（扩展实验包）内容审核通过。

**退出条件**（任一触发即回退）：
- 激励视频被举报为诱导沉迷 → 立即下线激励视频，回退至 Phase 2；
- 监管政策变更限制激励视频 → 回退至 Phase 2。

---

## 9. 风险与应对

| 风险 | 概率 | 影响 | 应对 |
| --- | --- | --- | --- |
| 个人主体无法开通流量主 | 低 | 高 | 已确认个人主体可开通，仅 UV 门槛；若政策变更启动企业主体迁移 |
| 未成年人模式广告误展示 | 中 | 极高 | 双重校验 + 每月自审 + CI 扫描 + 立即回退机制 |
| 广告素材违规 | 中 | 高 | 流量主后台屏蔽 + 24 小时举报响应 + 月度复盘 |
| 广告收入低于预期 | 高 | 中 | 不依赖广告收入作为唯一动力，内容生产不卡在收入上 |
| 微信政策变更 | 中 | 高 | 14 天内适配，必要时启动企业主体迁移 |

---

## 附录 A：版本历史

| 版本 | 生效日期 | 主要变更 | 修订人 |
| --- | --- | --- | --- |
| v1.0 | 2026-06-30 | 首次发布（个人主体版） | 项目组 |

## 附录 B：相关文档

- 个人主体类目资质：`category-qualification-personal.md`
- 个人主体 PRD：`prd-personal-v1.md`
- 未成年人保护方案：`minor-protection.md`（第 5 章广告限制、第 8 章未成年人模式、第 10 章持续合规）

## 附录 C：外部参考

- 微信小程序广告 API：https://developers.weixin.qq.com/miniprogram/dev/api/ad/
- 微信流量主：https://developers.weixin.qq.com/miniprogram/dev/api/ad/traffic.html
- banner 广告组件：https://developers.weixin.qq.com/miniprogram/dev/api/ad/wx.createBannerAd.html
- 激励视频广告组件：https://developers.weixin.qq.com/miniprogram/dev/api/ad/wx.createRewardedVideoAd.html
- 微信小程序平台运营规范：https://developers.weixin.qq.com/miniprogram/product/operate.html

---

**文档结束**
