import { defineStore } from 'pinia'

const STORAGE_KEY = 'bw_analytics'

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (e) { console.warn('[BillionWhys] analytics save failed:', e.message) } // eslint-disable-line no-console
}

let _saveTimer = null
function debounceSave(data) {
  clearTimeout(_saveTimer)
  _saveTimer = setTimeout(() => saveData(data), 500)
}

let _storeRef = null

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && _saveTimer) {
      clearTimeout(_saveTimer)
      _saveTimer = null
      if (_storeRef) saveData(_storeRef.data)
    }
  })
}

export const useAnalyticsStore = defineStore('analytics', {
  state: () => {
    const data = loadData()
    _storeRef = null
    const today = todayKey()
    const isNewSession = !data[today]
    if (!data[today]) {
      data[today] = { uv: 1, pv: 0, events: [] }
    } else {
      data[today].uv = data[today].uv || 1
    }
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 90)
    const cutoffKey = cutoff.toISOString().slice(0, 10)
    for (const key of Object.keys(data)) {
      if (key < cutoffKey) delete data[key]
    }
    saveData(data)
    return { data, isNewSession }
  },
  getters: {
    todayStats(state) {
      const today = todayKey()
      return state.data[today] || { uv: 0, pv: 0, events: [] }
    },
    totalDays(state) {
      return Object.keys(state.data).length
    },
  },
  actions: {
    trackPageView(_path) {
      if (!_storeRef) _storeRef = this
      const today = todayKey()
      if (!this.data[today]) {
        this.data[today] = { uv: 1, pv: 0, events: [] }
      }
      this.data[today].pv++
      debounceSave(this.data)
    },
    trackEvent(name, detail = '') {
      // V8.2 第71轮 Sprint 11：trackEvent 也必须注册 _storeRef，否则未先调用 trackPageView 时
      // visibilitychange flush 无法回写（测试虫虫：完整漏斗埋点可靠性）
      if (!_storeRef) _storeRef = this
      const today = todayKey()
      if (!this.data[today]) {
        this.data[today] = { uv: 1, pv: 0, events: [] }
      }
      this.data[today].events.push({
        name,
        detail,
        ts: Date.now(),
      })
      if (this.data[today].events.length > 200) {
        this.data[today].events = this.data[today].events.slice(-200)
      }
      debounceSave(this.data)
    },
  },
})
