// V8.75 Sprint 74 第139轮：插画展示组件（微信小程序端）
// 负责：前端小凡+苏体验+彩虹姐
// 功能：
// - 懒加载（wx.createIntersectionObserver）
// - 3种尺寸预生成（thumb 200px / preview 600px / full 1024px）
// - 弱网降级（占位图 + 点击重试）
// - 圈层色系边框
// - 禁止交互（catchtap 阻止冒泡，防止2-3岁孩子误触）
// - 纯文字模式支持
// V8.77 第141轮：新增重试上限 3 次 + 骨架屏 2 秒超时自动隐藏
// V8.78 第142轮：新增 fallbackCircleColor 属性——超过重试上限时用圈层色系纯色占位
// V8.84 第148轮：新增 CDN_BASE_URL 支持 + thumb/preview/full 三级尺寸渐进加载
// V8.88 第151轮：textOnly 模式新增心跳动画（苏体验+前端小凡）

const MAX_RETRIES = 3
const { CDN_BASE_URL } = require('../../utils/constants')

/** 拼接 CDN URL 前缀 */
function cdnUrl(path) {
  if (!path) return ''
  if (CDN_BASE_URL && !path.startsWith('http')) {
    return CDN_BASE_URL.replace(/\/$/, '') + '/' + path.replace(/^\//, '')
  }
  return path
}

Component({
  options: {
    styleIsolation: 'shared',
  },

  properties: {
    /** 图片 URL（高清版 1024px） */
    src: { type: String, value: '' },
    /** 缩略图 URL（200px） */
    thumbSrc: { type: String, value: '' },
    /** 预览图 URL（600px） */
    previewSrc: { type: String, value: '' },
    /** alt 文本 */
    alt: { type: String, value: '' },
    /** 圈层标识（用于色系边框） */
    category: { type: String, value: 'body' },
    /** 是否启用懒加载 */
    lazy: { type: Boolean, value: true },
    /** 是否显示圈层色系边框 */
    showBorder: { type: Boolean, value: true },
    /** 是否使用纯文字模式 */
    textOnly: { type: Boolean, value: false },
    /** 骨架屏超时时间（ms），0 表示不自动隐藏 */
    skeletonTimeout: { type: Number, value: 2000 },
    /** V8.78 第142轮：是否使用圈层色系纯色占位（超过重试上限时） */
    fallbackCircleColor: { type: Boolean, value: false },
  },

  data: {
    loading: true,
    error: false,
    currentSrc: '',
    retryCount: 0,
    skeletonTimedOut: false,
    // V8.84 第148轮：三级尺寸渐进加载状态
    imageStage: 'thumb',  // 'thumb' | 'preview' | 'full'
    // V8.78 第142轮：fallbackCircleColor 圈层色系占位动态样式
    fallbackBgGradient: '',
    fallbackBorderColor: '',
    // 圈层色系映射
    circleBorderColors: {
      body: '#FFCCBC',
      home: '#FFE0B2',
      food: '#C8E6C9',
      nature: '#BBDEFB',
      animals: '#C8E6C9',
      society: '#E1BEE7',
    },
    circleBgColors: {
      body: '#FFF3E0',
      home: '#FFF8E1',
      food: '#F1F8E9',
      nature: '#E3F2FD',
      animals: '#E8F5E9',
      society: '#F3E5F5',
    },
    // V8.78 第142轮：圈层渐变（用于 fallbackCircleColor 占位）
    circleGradients: {
      body: 'linear-gradient(135deg, #FFF3E0, #FFE0B2)',
      home: 'linear-gradient(135deg, #FFF8E1, #FFECB3)',
      food: 'linear-gradient(135deg, #F1F8E9, #DCEDC8)',
      nature: 'linear-gradient(135deg, #E3F2FD, #BBDEFB)',
      animals: 'linear-gradient(135deg, #E8F5E9, #C8E6C9)',
      society: 'linear-gradient(135deg, #F3E5F5, #E1BEE7)',
    },
  },

  lifetimes: {
    attached() {
      if (this.properties.textOnly) return
      if (!this.properties.lazy) {
        this._loadImage()
      } else {
        this._observe()
      }
      this._startSkeletonTimer()
      this._updateFallbackStyles(this.properties.category)
    },
    detached() {
      if (this._observer) {
        this._observer.disconnect()
        this._observer = null
      }
      if (this._skeletonTimer) {
        clearTimeout(this._skeletonTimer)
        this._skeletonTimer = null
      }
    },
  },

  observers: {
    'src'(newSrc) {
      if (newSrc && !this.properties.textOnly) {
        this._loadImage()
      }
    },
    // V8.78 第142轮：category 变化时更新 fallback 色系样式
    'category'(newCategory) {
      this._updateFallbackStyles(newCategory)
    },
  },

  methods: {
    /** 懒加载观察 */
    _observe() {
      this._observer = this.createIntersectionObserver({
        margins: { bottom: 200 },
      })
      this._observer.relativeToViewport().observe('.illustration-wrapper', (res) => {
        if (res.intersectionRatio > 0) {
          this._loadImage()
          if (this._observer) {
            this._observer.disconnect()
            this._observer = null
          }
        }
      })
    },

    /** 加载图片（V8.84 第148轮：三级尺寸渐进加载 + CDN URL） */
    _loadImage() {
      const retryCount = this.data.retryCount
      if (retryCount >= MAX_RETRIES) {
        this.setData({ loading: false, error: true })
        return
      }

      this.setData({ loading: true, error: false, skeletonTimedOut: false, imageStage: 'thumb' })

      // 渐进式加载：thumb -> preview -> full
      const thumbSrc = this.properties.thumbSrc
      const previewSrc = this.properties.previewSrc
      const fullSrc = this.properties.src

      if (!thumbSrc && !previewSrc && !fullSrc) {
        this.setData({ loading: false, error: true })
        return
      }

      // 阶段 1：加载 thumb（200px，最快）
      const stage1 = thumbSrc || previewSrc || fullSrc
      this.setData({ currentSrc: cdnUrl(stage1), retryCount: retryCount + 1 })

      // 阶段 2：加载 preview（600px）
      if (previewSrc && previewSrc !== stage1) {
        setTimeout(() => {
          this.setData({ currentSrc: cdnUrl(previewSrc), imageStage: 'preview' })
        }, 150)
      }

      // 阶段 3：加载 full（1024px）
      if (fullSrc && fullSrc !== previewSrc && fullSrc !== stage1) {
        setTimeout(() => {
          this.setData({ currentSrc: cdnUrl(fullSrc), imageStage: 'full' })
        }, 500)
      }
    },

    /** 图片加载成功 */
    onImageLoad() {
      this.setData({ loading: false, error: false, retryCount: 0 })
      this._clearSkeletonTimer()
      this.triggerEvent('load')
    },

    /** 图片加载失败 */
    onImageError() {
      this._clearSkeletonTimer()
      this.setData({ loading: false, error: true })
      this.triggerEvent('error')
    },

    /** 重试加载 */
    onRetry() {
      this._loadImage()
    },

    /** 重试按钮点击（阻止冒泡到父级滚动） */
    onRetryTap() {
      // 不做任何事，仅阻止事件冒泡。onRetry 已通过 bindtap 处理。
    },

    /** 重置重试计数并重新加载 */
    resetAndRetry() {
      this.setData({ retryCount: 0 })
      this._loadImage()
    },

    /** 阻止冒泡（防止误触） */
    onCatchTap() {
      // 空函数，阻止事件冒泡到父级
    },

    /** 骨架屏超时自动隐藏 */
    _startSkeletonTimer() {
      if (this.properties.skeletonTimeout > 0) {
        this._skeletonTimer = setTimeout(() => {
          this.setData({ skeletonTimedOut: true })
        }, this.properties.skeletonTimeout)
      }
    },

    _clearSkeletonTimer() {
      if (this._skeletonTimer) {
        clearTimeout(this._skeletonTimer)
        this._skeletonTimer = null
      }
    },

    /** 获取边框色 */
    getBorderColor() {
      return this.data.circleBorderColors[this.properties.category] || '#FFCCBC'
    },

    /** 获取背景色 */
    getBgColor() {
      return this.data.circleBgColors[this.properties.category] || '#FFF3E0'
    },

    /** V8.78 第142轮：更新 fallback 占位色系样式 */
    _updateFallbackStyles(category) {
      const cat = category || this.properties.category || 'body'
      this.setData({
        fallbackBgGradient: this.data.circleGradients[cat] || this.data.circleGradients.body,
        fallbackBorderColor: this.data.circleBorderColors[cat] || '#FFCCBC',
      })
    },
  },
})