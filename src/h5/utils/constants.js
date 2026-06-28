export const categoryLabels = {
  body: '🫧 第1圈 · 我的身体',
  home: '🏠 第2圈 · 家',
  food: '🍎 第3圈 · 食物',
  nature: '🌍 第4圈 · 自然',
  animals: '🐾 第5圈 · 动植物',
  society: '👥 第6圈 · 社会',
}

export const categoryIcons = {
  body: '🫧', home: '🏠', food: '🍎',
  nature: '🌍', animals: '🐾', society: '👥',
}

export const categories = [
  { key: 'all', icon: '🌈', label: '全部' },
  { key: 'body', icon: '🫧', label: '身体' },
  { key: 'home', icon: '🏠', label: '家' },
  { key: 'food', icon: '🍎', label: '食物' },
  { key: 'nature', icon: '🌍', label: '自然' },
  { key: 'animals', icon: '🐾', label: '动植物' },
  { key: 'society', icon: '👥', label: '社会' },
]

export const expTypeLabels = {
  'hands-on': '🤲 动手实验',
  observation: '👀 观察体验',
  discussion: '💬 讨论互动',
}

export function parseIpScene(text) {
  if (!text) return []
  const parts = text.split(/((?:答答熊|问问兔)[：:])/).filter(Boolean)
  if (parts.length <= 1) return [{ role: 'rabbit', text }]
  const dialogues = []
  let current = ''
  const startsWithBear = /^答答熊[：:]$/.test(parts[0])
  let role = startsWithBear ? 'bear' : 'rabbit'
  for (const part of parts) {
    if (/^答答熊[：:]$/.test(part)) {
      if (current.trim()) dialogues.push({ role, text: current.trim() })
      role = 'bear'
      current = ''
    } else if (/^问问兔[：:]$/.test(part)) {
      if (current.trim()) dialogues.push({ role, text: current.trim() })
      role = 'rabbit'
      current = ''
    } else {
      current += part
    }
  }
  if (current.trim()) dialogues.push({ role, text: current.trim() })
  return dialogues
}

export function toWebP(path) {
  if (!path) return ''
  const p = path.startsWith('/') ? path : `/${path}`
  if (/\.webp$/i.test(p)) return p
  return p.replace(/\.(png|jpe?g)$/i, '.webp')
}

// TTS 适龄化配置（V7.7 第66轮）
// Why: pitch=1.3 在 Safari 会变蜂鸣、过高低频失真影响孩子辅音习得；rate=0.82 偏慢不自然
// 心理学家周教授：1.05~1.10 是温暖+自然+跨浏览器安全的折中值
// CTO+CCO裁决：常量冻结V1.0，不做用户偏好面板（MVP 阶段过度设计）
export const TTS_PITCH = 1.08
export const TTS_RATE = 0.88
export const TTS_LANG = 'zh-CN'
export const TTS_MAX_LENGTH = 200

// 搜索同义词归一：把高频口语变体统一为标准问句粒子
// Why: 5岁以上孩子常问"为啥/为什麽/为什吗"，搜索必须命中标准库的"为什么"
// How to apply: 在 search/suggestRelated 调用前对 keyword 调用此函数
const SYNONYM_MAP = [
  { pattern: /为啥|为什麽|为什吗|为什麼/g, repl: '为什么' },
  { pattern: /怎麽办|怎么办|怎么着/g, repl: '怎么样' },
  { pattern: /甚麼|什麽/g, repl: '什么' },
  { pattern: /[吗呢嘛么]$/g, repl: '' },
]

export function normalizeKeyword(keyword) {
  if (!keyword) return ''
  let kw = keyword.trim().toLowerCase()
  for (const { pattern, repl } of SYNONYM_MAP) {
    kw = kw.replace(pattern, repl)
  }
  return kw.trim()
}

// V8.7 第75轮 Sprint 16：本地日期键（YYYY-MM-DD），用于反馈趋势/明细的日期标签
// Why: toISOString().slice(0,10) 会把本地午夜转成 UTC，在 UTC+8 显示成昨天
// 反 V8.5 回归 bug：北极星漏斗"可追溯"依赖日期标签与本地日期一致
export function localDateKey(d) {
  const n = d instanceof Date ? d : new Date(d)
  const y = n.getFullYear()
  const m = String(n.getMonth() + 1).padStart(2, '0')
  const day = String(n.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// 今日好奇推荐：基于日期的确定性选择（零画像、零随机）
// Why: 法务张律一票否决个性化推荐；CTO要求纯前端零依赖
export function dailyPickQuestion(questions, date = new Date()) {
  if (!Array.isArray(questions) || questions.length === 0) return null
  const dayKey =
    date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate()
  const idx = dayKey % questions.length
  return questions[idx]
}
