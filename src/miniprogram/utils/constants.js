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

// V8.69 第133轮：年龄色系统一化（彩虹姐+前端小凡）
// Why: 年龄颜色散落在多个文件中，统一到 content/constants.json 作为唯一真源
// MP 通过 require 同步引用 JSON
const ageColorConfig = require('../../../content/constants-data')
const AGE_COLORS = ageColorConfig.ageColors
const AGE_LABEL_MAP = ageColorConfig.ageLabelMap
const DEFAULT_AGE = ageColorConfig.defaultAge
const AGE_STORAGE_KEY = ageColorConfig.ageStorageKey

/**
 * 获取年龄段的 CSS class 名（用于今日 3 问卡片颜色区分）
 * @param {string} ageLabel - 如 "3~4"、"4~5"、"5~6"
 * @returns {string} CSS class 名
 */
function ageColorClass(ageLabel) {
  if (!ageLabel) return ''
  for (const [key, val] of Object.entries(AGE_COLORS)) {
    if (ageLabel.includes(key.split('-')[0]) || ageLabel.includes(key)) return val.cssClass
  }
  return ''
}

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

// V8.84 第148轮：CDN 图片基础 URL（CTO+后端老稳+前端小凡）
// Why: 插画管线产出的 FAQ 插画通过 CDN 分发，MP 组件需拼接完整 URL
// 默认空字符串 = 本地开发直接使用分包内嵌图片路径
// 生产环境通过 app.js 全局变量 CDN_BASE_URL 注入
const CDN_BASE_URL = ''

// V9.11 第173轮：互动引导 emoji 映射
const INTERACTION_TYPE_EMOJI_MAP = {
  '触觉类': '🖐️',
  '动作类': '🏃',
  '观察类': '👀',
  '感知类': '💭',
  '听觉类': '👂',
  '讨论类': '💬',
}

/**
 * 根据 interactionType 获取 emoji 前缀
 * @param {string} type - interactionType 值
 * @returns {string} emoji
 */
function getInteractionEmoji(type) {
  if (!type) return '🤲'
  return INTERACTION_TYPE_EMOJI_MAP[type] || '🤲'
}

// V9.11 第173轮：前端空字段友好 fallback（苏体验+前端小凡 P0#7，与 H5 utils/constants.js 同步）
// Why: food 类 47 条缺少 interactionHint 时，前端显示空白区域，用户体验断层
// How to apply: 在 question.wxml 中 wx:else 分支使用此常量
const FALLBACK_INTERACTION_HINT = '和孩子一起探索更多吧！'

// V9.16 第178轮：emotion 前端渲染常量（墨小暖+彩虹姐+前端小凡 P0 LEG-005）
// Why: 数据层 food 50条 emotion 已注入，但前端无渲染逻辑，墨小暖一票否决
// 配色方案：彩虹姐第178轮设计——暖橙brave/亮黄curious/柔蓝protective/嫩绿gentle/淡紫wise
// 与 H5 utils/constants.js 完全对齐
const EMOTION_CONFIG = {
  brave: { label: '勇敢', color: '#FF9800', bg: 'rgba(255, 152, 0, 0.08)', icon: '🛡️' },
  curious: { label: '好奇', color: '#FFC107', bg: 'rgba(255, 193, 7, 0.08)', icon: '🔍' },
  protective: { label: '守护', color: '#64B5F6', bg: 'rgba(100, 181, 246, 0.08)', icon: '🤗' },
  gentle: { label: '温柔', color: '#81C784', bg: 'rgba(129, 199, 132, 0.08)', icon: '🌸' },
  wise: { label: '智慧', color: '#CE93D8', bg: 'rgba(206, 147, 216, 0.08)', icon: '💡' },
  // 历史合法值（body 类第165轮注入，待归一化到 EMOTION_MAPPING 标准）
  warm: { label: '温暖', color: '#FF8A65', bg: 'rgba(255, 138, 101, 0.08)', icon: '☀️' },
  excited: { label: '兴奋', color: '#FF7043', bg: 'rgba(255, 112, 67, 0.08)', icon: '🎉' },
  proud: { label: '自豪', color: '#AB47BC', bg: 'rgba(171, 71, 188, 0.08)', icon: '🏆' },
  surprised: { label: '惊喜', color: '#26C6DA', bg: 'rgba(38, 198, 218, 0.08)', icon: '😮' },
  happy: { label: '开心', color: '#FFCA28', bg: 'rgba(255, 202, 40, 0.08)', icon: '😊' },
  thoughtful: { label: '思考', color: '#78909C', bg: 'rgba(120, 144, 156, 0.08)', icon: '🤔' },
  playful: { label: '顽皮', color: '#EC407A', bg: 'rgba(236, 64, 122, 0.08)', icon: '😜' },
  comforting: { label: '安慰', color: '#A1887F', bg: 'rgba(161, 136, 127, 0.08)', icon: '🤱' },
}

function getEmotionConfig(emotionKey) {
  return EMOTION_CONFIG[emotionKey] || EMOTION_CONFIG.curious
}

// V9.21 第183轮：comfortCategory 图标前缀（苏体验+彩虹姐 P2#15）
// V9.26 第188轮：图标同步 constants.json COMFORT_CATEGORY_ICONS（苏体验+CEO裁决 P0 R188-006）
// A级🛡️（安全守护）、B级🔍（探索发现）、C级💛（温暖日常）
const COMFORT_CATEGORY_EMOJI_MAP = {
  'A': '🛡️',
  'B': '🔍',
  'C': '💛',
}

function getComfortCategoryEmoji(category) {
  if (!category) return ''
  return COMFORT_CATEGORY_EMOJI_MAP[category] || ''
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
  AGE_COLORS,
  AGE_LABEL_MAP,
  DEFAULT_AGE,
  AGE_STORAGE_KEY,
  ageColorClass,
  CDN_BASE_URL,
  INTERACTION_TYPE_EMOJI_MAP,
  getInteractionEmoji,
  FALLBACK_INTERACTION_HINT,
  EMOTION_CONFIG,
  getEmotionConfig,
  COMFORT_CATEGORY_EMOJI_MAP,
  getComfortCategoryEmoji,
}
