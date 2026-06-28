Page({
  data: {
    version: '',
    releaseDate: '',
  },

  onLoad() {
    const app = getApp()
    const gd = app && app.globalData
    if (gd) {
      this.setData({
        version: gd.version || '',
        releaseDate: gd.releaseDate || '',
      })
    }
  },

  onBack() {
    wx.navigateBack({ delta: 1 })
  },

  onShareAppMessage() {
    return {
      title: '和宝宝一起探索十亿个为什么',
      path: '/pages/discover/discover',
    }
  },
  onShareTimeline() {
    return {
      title: '和宝宝一起探索十亿个为什么',
    }
  },
})
