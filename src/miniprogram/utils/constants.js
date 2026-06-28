const categoryLabels = {
  body: '🫧 第1圈 · 我的身体',
  home: '🏠 第2圈 · 家',
  food: '🍎 第3圈 · 食物',
  nature: '🌍 第4圈 · 自然',
  animals: '🐾 第5圈 · 动植物',
  society: '👥 第6圈 · 社会',
}

const categoryIcons = {
  body: '🫧', home: '🏠', food: '🍎',
  nature: '🌍', animals: '🐾', society: '👥',
}

const expTypeLabels = {
  'hands-on': '🤲 动手实验',
  observation: '👀 观察体验',
  discussion: '💬 讨论互动',
}

const categories = [
  { key: 'all', icon: '🌈', label: '全部' },
  { key: 'body', icon: '🫧', label: '身体' },
  { key: 'home', icon: '🏠', label: '家' },
  { key: 'food', icon: '🍎', label: '食物' },
  { key: 'nature', icon: '🌍', label: '自然' },
  { key: 'animals', icon: '🐾', label: '动植物' },
  { key: 'society', icon: '👥', label: '社会' },
]

module.exports = { categoryLabels, categoryIcons, expTypeLabels, categories }

// V7.7 第66轮：TTS 适龄化配置（H5 共享常量值的 MP 镜像，仅作文档同步锚点）
// 注意：MP 当前未接入 TTS（小程序不支持 Web Speech API），这些常量预留供
// 后续接入云 TTS 时使用。pitch=1.08 / rate=0.88 是心理学家周教授认可的适龄值。
const TTS_PITCH = 1.08
const TTS_RATE = 0.88
const TTS_LANG = 'zh-CN'

// 问问兔/答答熊 IP 一致性已落地（V7.8）：
// MP 自定义组件 /components/ip-face/ip-face 提供 SVG 渲染，与 H5 RabbitFace/BearFace 视觉对齐。
// 旧注释：V7.7 H5 已用 RabbitFace SVG，MP 待对齐 — V7.8 已完成对齐。
const RABBIT_FACE_NOTE = 'V7.8: MP ip-face 自定义组件已落地，与 H5 RabbitFace/BearFace 视觉一致'

// V8.7 第75轮 Sprint 16：本地日期键（YYYY-MM-DD），用于反馈趋势/明细的日期标签
// Why: toISOString().slice(0,10) 会把本地午夜转成 UTC，在 UTC+8 显示成昨天
// 反 V8.5 回归 bug：北极星漏斗"可追溯"依赖日期标签与本地日期一致
function localDateKey(d) {
  const n = d instanceof Date ? d : new Date(d)
  const y = n.getFullYear()
  const m = String(n.getMonth() + 1).padStart(2, '0')
  const day = String(n.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

module.exports = {
  categoryLabels,
  categoryIcons,
  expTypeLabels,
  categories,
  TTS_PITCH,
  TTS_RATE,
  TTS_LANG,
  RABBIT_FACE_NOTE,
  localDateKey,
}
