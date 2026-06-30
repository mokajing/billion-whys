const { markParentVerified, getQuestionPool } = require('../../utils/minor-protection')
const { safeToast, safeSwitchTab } = require('../../utils/safe-wx')

Page({
  data: {
    questions: [],
    answers: [-1, -1, -1],
    currentIndex: 0,
    answered: false,
  },

  onLoad() {
    const qs = getQuestionPool()
    this.setData({
      questions: qs,
      answers: [-1, -1, -1],
      currentIndex: 0,
      answered: false,
    })
  },

  onSelectOption(e) {
    const { qidx, oidx } = e.currentTarget.dataset
    const answers = this.data.answers.slice()
    answers[qidx] = oidx
    this.setData({ answers })
  },

  onNext() {
    if (this.data.answers[this.data.currentIndex] === -1) {
      safeToast({ title: '请选择一个答案', icon: 'none' })
      return
    }
    if (this.data.currentIndex < this.data.questions.length - 1) {
      this.setData({ currentIndex: this.data.currentIndex + 1 })
    } else {
      this.onSubmit()
    }
  },

  onPrev() {
    if (this.data.currentIndex > 0) {
      this.setData({ currentIndex: this.data.currentIndex - 1 })
    }
  },

  onSubmit() {
    const { questions, answers } = this.data
    let correct = 0
    for (let i = 0; i < questions.length; i++) {
      if (answers[i] === questions[i].answer) correct++
    }
    if (correct === questions.length) {
      markParentVerified()
      this.setData({ answered: true })
      safeToast({ title: '验证通过', icon: 'success' })
      setTimeout(() => {
        safeSwitchTab('/pages/discover/discover')
      }, 1000)
    } else {
      safeToast({
        title: `答对 ${correct}/${questions.length} 题，请重试`,
        icon: 'none',
        duration: 2000,
      })
      // 失败重新抽题
      const qs = getQuestionPool()
      this.setData({
        questions: qs,
        answers: [-1, -1, -1],
        currentIndex: 0,
      })
    }
  },
})
