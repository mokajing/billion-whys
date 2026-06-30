# 小程序合法域名白名单配置

## 一、必配域名（HTTPS only）

### 主 CDN（图片资源）
- 域名：`cdn.jsdelivr.net`
- 用途：jsDelivr CDN 加载 GitHub 仓库图片
- 测试 URL：`https://cdn.jsdelivr.net/gh/mokajing/billion-whys@main/content/images/body/body-001-layer1.png`

### 备用 CDN
- 域名：`raw.githubusercontent.com`
- 用途：GitHub Raw 内容直接访问（jsDelivr 故障时备用）
- 测试 URL：`https://raw.githubusercontent.com/mokajing/billion-whys/main/content/images/body/body-001-layer1.png`

## 二、配置步骤

1. 登录 [微信公众平台](https://mp.weixin.qq.com/)
2. 进入「开发管理」→「开发设置」→「服务器域名」
3. 在 `downloadFile` 类目下添加上述两个域名
4. 每月可修改 50 次，谨慎操作

## 三、未来扩展

当接入以下功能时需追加域名：
- 云同步（cloudSync）：自建云服务域名
- 客服会话（wx.openCustomerServiceChat）：无需配置
- 数据上报：自建数据接收域名
- 广告 SDK：微信自动配置，无需手动添加

## 四、合规要求

- 所有域名必须 HTTPS
- 证书有效期内
- 不得使用 IP 地址
- 不得使用自签名证书
- 域名需 ICP 备案（如使用国内域名）

## 五、验证

配置后在小程序内调用：
```js
wx.downloadFile({
  url: 'https://cdn.jsdelivr.net/gh/mokajing/billion-whys@main/content/images/body/body-001-layer1.png',
  success: (res) => console.log('OK:', res.tempFilePath),
  fail: (err) => console.error('FAIL:', err)
})
```
