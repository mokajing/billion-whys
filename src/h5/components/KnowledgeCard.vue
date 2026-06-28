<template>
  <div
    class="knowledge-card"
    :class="`layer${layer}`"
    role="article"
    :aria-label="badge"
    @animationend="onAnimEnd"
  >
    <div class="card-badge">
      {{ badge }}
    </div>
    <div
      v-if="followUp"
      class="child-bubble"
    >
      <span class="bubble-avatar"><RabbitFace :size="20" /></span>
      <span class="bubble-text">{{ followUp }}</span>
    </div>
    <div class="card-illustration">
      <img
        v-if="image"
        :src="imageSrc"
        :alt="question || followUp || 'illustration'"
        :style="{ display: imgError ? 'none' : 'block' }"
        loading="lazy"
        @error="onImgError"
      >
      <div
        v-if="!image || imgError"
        class="illustration-placeholder"
        :style="{ background: placeholderBg }"
      >
        <span class="illus-icon">{{ placeholderIcon }}</span>
        <span class="illus-text">{{ placeholderText }}</span>
        <span
          v-if="!image"
          class="illus-wip"
        >精彩插画即将到来</span>
      </div>
    </div>
    <AudioBar
      :layer="layer"
      :text="answer"
    />
    <div class="answer-text">
      {{ answer }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import AudioBar from './AudioBar.vue'
import RabbitFace from './RabbitFace.vue'
import { toWebP } from '../utils/constants'

const props = defineProps({
  layer: { type: Number, required: true },
  badge: { type: String, required: true },
  question: { type: String, default: '' },
  followUp: { type: String, default: '' },
  answer: { type: String, required: true },
  image: { type: String, default: '' },
  category: { type: String, default: '' },
})

const imgError = ref(false)

watch(() => props.image, () => {
  imgError.value = false
})

const imageSrc = computed(() => {
  if (!props.image) return ''
  return toWebP(props.image)
})

function onImgError() {
  imgError.value = true
}

function onAnimEnd(e) {
  e.currentTarget.classList.add('animated')
}

const placeholderIcon = computed(() => {
  const icons = { 1: '🌱', 2: '🔍', 3: '🌟' }
  return icons[props.layer] || '🎨'
})

const categoryDefaults = {
  body: { text: '🫧 我的身体真奇妙', bg: 'linear-gradient(135deg, #FCE4EC, #F8BBD0)', icon: '🫧' },
  home: { text: '🏠 家里藏着小秘密', bg: 'linear-gradient(135deg, #FFF3E0, #FFE0B2)', icon: '🏠' },
  food: { text: '🍎 好吃的东西有学问', bg: 'linear-gradient(135deg, #F1F8E9, #DCEDC8)', icon: '🍎' },
  nature: { text: '🌍 大自然真神奇', bg: 'linear-gradient(135deg, #E0F7FA, #B2EBF2)', icon: '🌍' },
  animals: { text: '🐾 动物植物的故事', bg: 'linear-gradient(135deg, #FFF8E1, #FFECB3)', icon: '🐾' },
  society: { text: '👥 世界是怎样运转的', bg: 'linear-gradient(135deg, #EDE7F6, #D1C4E9)', icon: '👥' },
}

const placeholderText = computed(() => {
  const cat = categoryDefaults[props.category]
  return cat ? cat.text : '精彩插画即将到来'
})

const placeholderBg = computed(() => {
  const cat = categoryDefaults[props.category]
  return cat ? cat.bg : 'linear-gradient(135deg, #f8f9fa, #e9ecef)'
})
</script>

<style scoped>
.knowledge-card {
  border-radius: var(--radius-card);
  margin-bottom: 16px;
  overflow: hidden;
  box-shadow: var(--shadow-card);
  transition: all 0.3s ease;
  animation: cardSlideIn 0.5s ease-out backwards;
}
.knowledge-card.layer1 { background: var(--color-layer1-bg); border: 2px solid var(--color-layer1-border); animation-delay: 0.1s; }
.knowledge-card.layer2 { background: var(--color-layer2-bg); border: 2px solid var(--color-layer2-border); animation-delay: 0.25s; }
.knowledge-card.layer3 { background: var(--color-layer3-bg); border: 2px solid var(--color-layer3-border); animation-delay: 0.4s; }
.knowledge-card.animated {
  will-change: auto;
}

@keyframes cardSlideIn {
  from { opacity: 0; transform: translateY(24px); }
  to { opacity: 1; transform: translateY(0); }
}

.card-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 0 0 12px 0;
  font-size: 11px;
  font-weight: 600;
}
.layer1 .card-badge { background: #E8F5E9; color: #2E7D32; }
.layer2 .card-badge { background: #E3F2FD; color: #1565C0; }
.layer3 .card-badge { background: #FFF3E0; color: #E65100; }

.child-bubble {
  margin: 12px 16px 0;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.bubble-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #ffecd2, #fcb69f);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
}
.bubble-text {
  padding: 8px 14px;
  border-radius: 0 16px 16px 16px;
  font-size: 13px;
  font-weight: 600;
  color: #2c3e50;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}
.layer2 .bubble-text { background: #E3F2FD; color: #1565C0; }
.layer3 .bubble-text { background: #FFF3E0; color: #E65100; }

.card-illustration {
  margin: 12px 14px 0;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  background: linear-gradient(135deg, #f8f9fa, #e9ecef);
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.card-illustration img {
  width: 100%;
  height: auto;
  display: block;
  aspect-ratio: 4/3;
  object-fit: cover;
}
.illustration-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px 16px;
  color: #78909C;
  border-radius: 14px;
  position: relative;
  overflow: hidden;
}
.illustration-placeholder::before {
  content: '';
  position: absolute;
  inset: 0;
  opacity: 0.15;
  background: repeating-linear-gradient(45deg, transparent, transparent 8px, currentColor 8px, currentColor 9px);
}
.illus-icon { font-size: 42px; z-index: 1; }
.illus-text { font-size: 12px; font-weight: 500; text-align: center; max-width: 200px; z-index: 1; }
.illus-wip { font-size: 10px; color: #B0BEC5; font-weight: 400; z-index: 1; margin-top: 2px; }

.answer-text {
  margin: 12px 16px 16px;
  font-size: 15px;
  line-height: 1.9;
  color: #333;
}
</style>
