const content = require('../../utils/content')
const { categoryLabels, categoryIcons, expTypeLabels } = require('../../utils/constants')
const { safeToast, safeSwitchTab, safeRedirectTo, safeNavigateBack } = require('../../utils/safe-wx')
const analytics = require('../../utils/analytics')

Page({
  data: {
    question: null,
    hasExperiment: false,
    categoryLabel: '',
    showParent: false,
    isExpObj: false,
    expTypeLabel: '',
    expName: '',
    expSteps: [],
    expSayToChild: '',
    expLegacyText: '',
    expMaterials: '',
    expDuration: '',
    expImage: '',
    warmClosingText: '',
    safetyNotice: '',
    layer1Image: '',
    layer2Image: '',
    layer3Image: '',
    scienceImage: '',
    prevQuestion: null,
    nextQuestion: null,
    ipDialogues: [],
    showDeeper: false,
    isFavorite: false,
    relatedQuestions: [],
    categoryIcon: '❓',
    currentFeedback: null,
    hasExperiment: false,
  },

  onLoad(options) {
    try {
      const id = options.id
      if (!id) { safeSwitchTab('/pages/discover/discover'); return }
      const q = content.getById(id)
      if (!q) { safeSwitchTab('/pages/discover/discover'); return }
      const isExpObj = typeof q.experiment === 'object' && q.experiment !== null
      const expType = (q.experiment && q.experiment.experimentType) || (typeof q.experiment === 'string' ? 'discussion' : 'hands-on')
      const safetyNotice = (q.experiment && q.experiment.safetyNote)
        ? '⚠️ ' + q.experiment.safetyNote
        : expType === 'discussion' ? '' : expType === 'observation' ? '👀 观察时请注意安全哦' : '🤝 这个实验需要大人一起参与哦'
      const materials = q.experiment && q.experiment.materials
      const expMaterials = Array.isArray(materials) ? materials.join('、') : (materials || '')
      const expDuration = (q.experiment && q.experiment.duration) || ''
      const expImage = content.toWebP((q.experiment && q.experiment.image) || '')
      const catQuestions = content.getByCategory(q.category)
      let idx = -1
      for (let i = 0; i < catQuestions.length; i++) {
        if (catQuestions[i].id === id) { idx = i; break }
      }
      const related = content.suggestRelated(q.question)
        .filter(r => r.id !== id).slice(0, 3)
        .map(r => ({ id: r.id, question: r.question }))
      this.setData({
        question: {
          id: q.id,
          question: q.question,
          age: q.age,
          category: q.category,
          tags: q.tags,
          layer1: q.layer1 ? { answer: q.layer1.answer, image: q.layer1.image } : null,
          layer2: q.layer2 ? { answer: q.layer2.answer, followUp: q.layer2.followUp, image: q.layer2.image } : null,
          layer3: q.layer3 ? { answer: q.layer3.answer, followUp: q.layer3.followUp, image: q.layer3.image } : null,
          science: q.science || '',
        },
        hasExperiment: !!q.experiment,
        categoryLabel: categoryLabels[q.category] || '',
        categoryIcon: categoryIcons[q.category] || '❓',
        expTypeLabel: (q.experiment && expTypeLabels[q.experiment.experimentType]) || '',
        isExpObj,
        expName: isExpObj ? ((q.experiment && q.experiment.name) || '') : '',
        expSteps: isExpObj ? ((q.experiment && q.experiment.steps) || []) : [],
        expSayToChild: isExpObj ? ((q.experiment && q.experiment.sayToChild) || '') : '',
        expLegacyText: !isExpObj && typeof q.experiment === 'string' ? q.experiment : '',
        expMaterials,
        expDuration,
        expImage,
        warmClosingText: q.warmClosing || '哇，你问了一个连科学家都还在研究的问题呢！等长大一点，我们一起去找更多答案好不好？',
        safetyNotice,
        layer1Image: content.toWebP((q.layer1 && q.layer1.image) || ''),
        layer2Image: content.toWebP((q.layer2 && q.layer2.image) || ''),
        layer3Image: content.toWebP((q.layer3 && q.layer3.image) || ''),
        scienceImage: content.toWebP(q.scienceImage || ''),
        ipDialogues: content.parseIpScene(q.ipScene || ''),
        prevQuestion: idx > 0 ? { id: catQuestions[idx - 1].id, question: catQuestions[idx - 1].question } : null,
        nextQuestion: idx < catQuestions.length - 1 ? { id: catQuestions[idx + 1].id, question: catQuestions[idx + 1].question } : null,
        isFavorite: content.isFavorite(id),
        relatedQuestions: related,
        currentFeedback: content.getAnswerFeedback(id),
        hasExperiment: !!(q.experiment && (q.experiment.name || q.experiment.steps || q.experiment.experimentType)),
      })
      content.markViewed(id, q.category)
    } catch (err) {
      console.error('[BillionWhys] question onLoad error:', err)
      safeToast({ title: '加载失败，正在返回', icon: 'none' })
      this._redirectTimer = setTimeout(() => safeSwitchTab('/pages/discover/discover'), 1500)
    }
  },

  onUnload() {
    clearTimeout(this._redirectTimer)
  },

  onImgError(e) {
    const field = e.currentTarget.dataset.field
    if (field) this.setData({ [field]: '' })
  },

  onToggleFavorite() {
    const id = this.data.question && this.data.question.id
    if (!id) return
    content.toggleFavorite(id)
    this.setData({ isFavorite: content.isFavorite(id) })
  },

  onFeedbackUp() {
    const id = this.data.question && this.data.question.id
    if (!id) return
    // V8.9 第77轮 Sprint 18：快照反馈时可见的最深 Layer（H5 QuestionDetail.vue onFeedback 同构）
    const depth = this.computeFeedbackDepth()
    content.setAnswerFeedback(id, 'up', depth)
    this.setData({ currentFeedback: 'up' })
    // V8.2 第71轮 Sprint 11：闭合 反馈→CTA→实验 增长漏斗（COO+AI小智+CCO）
    analytics.feedbackUp(id)
  },

  onFeedbackDown() {
    const id = this.data.question && this.data.question.id
    if (!id) return
    const depth = this.computeFeedbackDepth()
    content.setAnswerFeedback(id, 'down', depth)
    this.setData({ currentFeedback: 'down' })
    analytics.feedbackDown(id)
  },

  // V8.3 第71轮 Sprint 12：重置反馈，让妈妈"再评一次"（COO反馈率北极星+UX苏体验后悔药）
  onResetFeedback() {
    const id = this.data.question && this.data.question.id
    if (!id) return
    const depth = this.computeFeedbackDepth()
    content.clearAnswerFeedback(id, depth)
    this.setData({ currentFeedback: '' })
    // 埋点 feedback_reset — detail 仅 questionId，无儿童身份（法务张律放行）
    analytics.feedbackReset(id)
  },

  // V8.9 第77轮 Sprint 18：根据 showDeeper + question.layer3 推导反馈深度（1/2/3）
  // Why: 反馈深度归因；depth=3+👍 是深度学习信号，depth=3+👎 是内容质量强信号
  computeFeedbackDepth() {
    const q = this.data.question
    if (!q || !this.data.showDeeper) return 1
    if (q.layer3) return 3
    if (q.layer2) return 2
    return 1
  },

  // V8.1 第70轮 Sprint 10：试试互动实验 CTA — 引导妈妈滚动至ParentSection（CPO+COO增长杠杆）
  onScrollToExperiment() {
    // V8.2 第71轮 Sprint 11：埋点 cta_experiment
    const id = this.data.question && this.data.question.id
    if (id) analytics.ctaExperiment(id)
    const query = wx.createSelectorQuery().in(this)
    query.select('.parent-section').boundingClientRect((rect) => {
      if (rect && typeof rect.top === 'number') {
        wx.pageScrollTo({
          scrollTop: rect.top + (getCurrentPages().slice(-1)[0].scrollTop || 0),
          duration: 300,
        })
      } else {
        // Fallback: 不带偏移的滚动（少数机型 boundingClientRect 失败）
        wx.pageScrollTo({ scrollTop: 9999, duration: 300 })
      }
    }).exec()
  },

  onExpandDeeper() {
    this.setData({ showDeeper: true })
    // V8.2 第71轮 Sprint 11：埋点 layer_expand — 追踪 Layer2/3 展开动作
    const id = this.data.question && this.data.question.id
    if (id) analytics.layerExpand(id)
  },

  onRelatedTap(e) {
    safeRedirectTo('/pages/question/question?id=' + e.currentTarget.dataset.id)
  },

  onToggleParent() {
    this.setData({ showParent: !this.data.showParent })
  },

  onGoBack() {
    const pages = (typeof getCurrentPages === 'function') ? getCurrentPages() : []
    if (pages.length > 1) safeNavigateBack()
    else safeSwitchTab('/pages/discover/discover')
  },

  onNavPrev() {
    const prev = this.data.prevQuestion
    if (prev) safeRedirectTo('/pages/question/question?id=' + prev.id)
  },

  onNavNext() {
    const next = this.data.nextQuestion
    if (next) safeRedirectTo('/pages/question/question?id=' + next.id)
  },

  onShareAppMessage() {
    const q = this.data.question
    return {
      title: q ? q.question : '十亿个什么与为什么',
      path: q ? ('/pages/question/question?id=' + q.id) : '/pages/discover/discover',
    }
  },

  onShareTimeline() {
    const q = this.data.question
    return {
      title: q ? q.question : '十亿个什么与为什么',
      query: q ? ('id=' + q.id) : '',
    }
  },
})
