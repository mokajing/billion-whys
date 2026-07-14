// skeleton.js — 小程序骨架屏组件逻辑（V8.62 第126轮）
// V8.63 第127轮：3 秒超时文案切换 + 6 秒离线提示（苏体验+小美 P1 升级）
// V8.66 第130轮：6s→3s 离线提示合并到 3s 计时器（王园长+小美 "3 岁孩子 3 秒就开始乱点"）
// V8.67 第131轮：骨架屏渲染完成后+1.5s 触发 CTA（苏体验：弱网适应），6s 后切换收藏文案
Component({
  properties: {
    state: {
      type: String,
      value: 'loading',
      observer: '_onStateChange',
    },
    message: {
      type: String,
      value: '',
    },
  },

  data: {
    ariaLabel: '正在加载内容，问问兔正在准备',
    timeoutMessage: '',
    showOfflineHint: false,
    showArchiveCTA: false, // V8.67: 6s 后显示收藏 CTA
  },

  lifetimes: {
    attached() {
      this._updateAria()
      this._startTimers()
    },
    detached() {
      this._clearTimers()
    },
  },

  methods: {
    _updateAria() {
      const state = this.data.state || this.properties.state
      let ariaLabel = '加载中'
      switch (state) {
        case 'loading':
          ariaLabel = '正在加载内容，问问兔正在准备'
          break
        case 'ready':
          ariaLabel = '内容已加载完成'
          break
        case 'error':
          ariaLabel = '加载失败，点击重试'
          break
      }
      this.setData({ ariaLabel })
    },

    _startTimers() {
      if (this.properties.state !== 'loading') return
      // V8.67: 骨架屏渲染完成后+1.5s 触发 CTA（小程序用 setTimeout 模拟）
      this._timerCta = setTimeout(() => {
        this.setData({ timeoutMessage: '还没好哦～再等一下下', showOfflineHint: true })
      }, 1500)
      // V8.67: 6s 后切换为收藏 CTA 文案
      this._timer6s = setTimeout(() => {
        this.setData({ showArchiveCTA: true })
      }, 6000)
    },

    _clearTimers() {
      if (this._timer3s) { clearTimeout(this._timer3s); this._timer3s = null }
      if (this._timerCta) { clearTimeout(this._timerCta); this._timerCta = null }
      if (this._timer6s) { clearTimeout(this._timer6s); this._timer6s = null }
    },

    _onStateChange(newVal) {
      if (newVal !== 'loading') {
        this._clearTimers()
        this.setData({ timeoutMessage: '', showOfflineHint: false, showArchiveCTA: false })
      }
    },

    onRetry() {
      this.triggerEvent('retry')
    },
  },
})