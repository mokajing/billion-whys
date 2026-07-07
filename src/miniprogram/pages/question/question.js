const content = require('../../utils/content')
const { categoryLabels, categoryIcons, expTypeLabels } = require('../../utils/constants')
const { safeToast, safeSwitchTab, safeRedirectTo, safeNavigateBack, safeCreateSelectorQuery, safePageScrollTo } = require('../../utils/safe-wx')
const analytics = require('../../utils/analytics')
const storage = require('../../utils/storage')
const i18n = require('../../utils/i18n')

// V8.16 第84轮 Sprint 25：照护者自我效能 A/B 实验键（与 H5 stores/ab.js 同键）
const AB_EXPERIMENT_KEY = 'caregiver_affirmation_v1'

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
    // V8.16 第84轮 Sprint 25：A/B affirmation 文案
    affirmationText: '',
    // V8.17 第85轮 Sprint 26：i18n 注入
    locale: i18n.getLocale(),
    t: i18n.dict(),
    ageText: '',
    prevAria: '',
    nextAria: '',
    // V8.75 Sprint 74 第139轮：纯文字模式（家长设置中可关闭插画，全职妈妈小美+苏体验）
    textOnly: false,
    // V8.75 Sprint 74 第139轮：插画图片数据（三层 + 实验）
    layer1ThumbImage: '',
    layer1PreviewImage: '',
    layer2ThumbImage: '',
    layer2PreviewImage: '',
    layer3ThumbImage: '',
    layer3PreviewImage: '',
  },

  onLoad(options) {
    try {
      const id = options.id
      if (!id) { safeSwitchTab('/pages/discover/discover'); return }
      // P1-3 分包懒加载：按 id 推断 category 异步预加载对应分包（不阻塞当前渲染）
      const cat = content.getCategoryFromId(id)
      if (cat) content.preloadCategoryAsync(cat)
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
      const prevQuestion = idx > 0 ? { id: catQuestions[idx - 1].id, question: catQuestions[idx - 1].question } : null
      const nextQuestion = idx < catQuestions.length - 1 ? { id: catQuestions[idx + 1].id, question: catQuestions[idx + 1].question } : null
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
        prevQuestion,
        nextQuestion,
        isFavorite: content.isFavorite(id),
        relatedQuestions: related,
        currentFeedback: content.getAnswerFeedback(id),
        hasExperiment: !!(q.experiment && (q.experiment.name || q.experiment.steps || q.experiment.experimentType)),
        ageText: i18n.t('qd.age', { age: q.age }),
        prevAria: prevQuestion ? i18n.t('qd.prevAria', { q: prevQuestion.question }) : '',
        nextAria: nextQuestion ? i18n.t('qd.nextAria', { q: nextQuestion.question }) : '',
      })
      content.markViewed(id, q.category)
      // V8.16 第84轮 Sprint 25：A/B 分桶 + 曝光埋点（幂等，同 experiment 只发一次）
      // CTO+法务张律：纯 Math.random coin-flip，不读身份字段；走 storage.emitABExpose eventLog 单一通道
      const abVariant = storage.getABVariant(AB_EXPERIMENT_KEY)
      const affirmationText = storage.getABCopy(AB_EXPERIMENT_KEY)
      storage.emitABExpose(AB_EXPERIMENT_KEY, abVariant)
      this.setData({ affirmationText })
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
    if (!field) return
    // P0-3 CDN fallback：主 CDN 加载失败时尝试备用 raw.githubusercontent.com，仍失败则清空
    const current = this.data[field]
    if (current && current.indexOf('cdn.jsdelivr.net') !== -1) {
      // 切换到备用 CDN（raw.githubusercontent.com）
      const fallback = content.toWebPFallback
        ? content.toWebPFallback(current.replace(content.CDN_BASE + '/', ''))
        : ''
      if (fallback) {
        this.setData({ [field]: fallback })
        return
      }
    }
    this.setData({ [field]: '' })
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
    // V8.16 第84轮 Sprint 25：A/B 目标转化埋点 — feedback_up 即 ab_convert goal=feedback_up
    // 后端老稳：走 storage.emitABConvert eventLog 单一通道，detail=experiment:variant:goal
    const abVariant = storage.getABVariant(AB_EXPERIMENT_KEY)
    analytics.abConvert(AB_EXPERIMENT_KEY, abVariant, 'feedback_up')
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
    // P1-2 整改：wx.createSelectorQuery / wx.pageScrollTo 走 safe-wx 守卫
    const query = safeCreateSelectorQuery(this)
    if (!query) {
      // 兜底：直接滚到底部，少数机型 boundingClientRect 不可用时仍能跳到实验区
      safePageScrollTo(9999)
      return
    }
    query.select('.parent-section').boundingClientRect((rect) => {
      if (rect && typeof rect.top === 'number') {
        const pages = (typeof getCurrentPages === 'function') ? getCurrentPages() : []
        const lastPage = pages[pages.length - 1]
        const baseTop = (lastPage && typeof lastPage.scrollTop === 'number') ? lastPage.scrollTop : 0
        safePageScrollTo(rect.top + baseTop)
      } else {
        // Fallback: 不带偏移的滚动（少数机型 boundingClientRect 失败）
        safePageScrollTo(9999)
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

  // V8.75 Sprint 74 第139轮：纯文字模式切换
  onToggleTextOnly() {
    this.setData({ textOnly: !this.data.textOnly })
    // 持久化到 storage
    try {
      wx.setStorageSync('bw_text_only', this.data.textOnly)
    } catch (e) {
      // 静默忽略
    }
  },

  // V8.75 Sprint 74 第139轮：初始化纯文字模式设置
  initTextOnly() {
    try {
      const val = wx.getStorageSync('bw_text_only')
      if (typeof val === 'boolean') {
        this.setData({ textOnly: val })
      }
    } catch (e) {
      // 静默忽略
    }
  },

  // V8.75 Sprint 74 第139轮：获取插画来源（thumb/preview/full）
  getIllustrationSources(baseUrl) {
    if (!baseUrl) return { thumb: '', preview: '', full: '' }
    // 假设 CDN 支持 ?size= 参数
    return {
      thumb: baseUrl + '?size=200',
      preview: baseUrl + '?size=600',
      full: baseUrl + '?size=1024',
    }
  },
})
