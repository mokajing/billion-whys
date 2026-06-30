const { safeToast, safeNavigateBack } = require('../../utils/safe-wx')
const { safeSetStorageSync } = require('../../utils/safe-wx')

const REASONS = [
  { value: 'inappropriate', label: '不适宜内容' },
  { value: 'violent', label: '暴力' },
  { value: 'scary', label: '恐怖' },
  { value: 'other', label: '其他' },
]

Page({
  data: {
    reasons: REASONS,
    selectedReason: '',
    description: '',
    questionId: '',
    questionText: '',
  },

  onLoad(opts) {
    this.setData({
      questionId: opts.id || '',
      questionText: opts.q || '',
    })
  },

  onReasonChange(e) {
    this.setData({ selectedReason: e.currentTarget.dataset.value })
  },

  onDescInput(e) {
    this.setData({ description: e.detail.value })
  },

  onSubmit() {
    const { selectedReason, description, questionId, questionText } = this.data
    if (!selectedReason) {
      safeToast({ title: '请选择举报原因', icon: 'none' })
      return
    }
    if (!description.trim()) {
      safeToast({ title: '请填写问题描述', icon: 'none' })
      return
    }

    const report = {
      reason: selectedReason,
      description: description.trim(),
      questionId,
      questionText,
      timestamp: Date.now(),
    }

    // 优先尝试客服会话（如果可用）
    if (typeof wx !== 'undefined' && typeof wx.openCustomerServiceChat === 'function') {
      try {
        wx.openCustomerServiceChat({
          extInfo: { url: '' },
          corpId: '',
          fail: () => {
            // 客服会话失败则本地存储
            this._storeReport(report)
          },
          success: () => {
            this._storeReport(report)
          },
        })
        return
      } catch (_e) {
        // 降级
      }
    }
    // 兜底：本地存储
    this._storeReport(report)
  },

  _storeReport(report) {
    try {
      const key = 'mp_reports'
      let list = []
      if (typeof wx !== 'undefined' && typeof wx.getStorageSync === 'function') {
        const v = wx.getStorageSync(key)
        if (Array.isArray(v)) list = v
      }
      list.push(report)
      // 保留最近 50 条
      if (list.length > 50) list = list.slice(list.length - 50)
      safeSetStorageSync(key, list)
    } catch (_e) { /* ignore */ }
    safeToast({ title: '举报已提交，感谢您的反馈', icon: 'success' })
    setTimeout(() => {
      safeNavigateBack(1)
    }, 1200)
  },

  onCancel() {
    safeNavigateBack(1)
  },
})
