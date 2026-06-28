<template>
  <div class="parent-section">
    <div
      class="parent-header"
      role="button"
      tabindex="0"
      :aria-expanded="expanded"
      aria-controls="parent-body-panel"
      @click="expanded = !expanded"
      @keydown.enter.prevent="expanded = !expanded"
      @keydown.space.prevent="expanded = !expanded"
    >
      <span>📖 给大人看的（点击展开）</span>
      <span
        class="arrow"
        :class="{ open: expanded }"
      >▼</span>
    </div>
    <div
      v-if="expanded"
      id="parent-body-panel"
      class="parent-body"
    >
      <div
        v-if="safetyNotice"
        class="safety-notice"
      >
        {{ safetyNotice }}
      </div>

      <div class="info-card science">
        <div class="label">
          📖 科学原理
        </div>
        <div
          v-if="scienceImage && !scienceImgError"
          class="science-img-wrapper"
        >
          <img
            :src="scienceImageSrc"
            class="section-img"
            alt="实验场景参考图"
            loading="lazy"
            @error="scienceImgError = true"
          >
          <div class="img-caption">
            实验场景参考图
          </div>
        </div>
        <div class="text">
          {{ science }}
        </div>
      </div>

      <div class="info-card experiment">
        <div class="label">
          🧪 亲子小实验
        </div>

        <template v-if="experimentObj">
          <div
            v-if="experimentObj.experimentType"
            class="exp-type-badge"
            :class="experimentObj.experimentType"
          >
            {{ expTypeLabel }}
          </div>
          <img
            v-if="experimentObj.image && !expImgError"
            :src="expImageSrc"
            class="section-img"
            alt="实验示意图"
            loading="lazy"
            @error="expImgError = true"
          >
          <div class="exp-name">
            {{ experimentObj.name }}
          </div>
          <div class="exp-steps">
            <div
              v-for="(step, i) in experimentObj.steps"
              :key="i"
              class="exp-step"
            >
              <div class="step-num">
                {{ i + 1 }}
              </div>
              <div class="step-text">
                {{ step }}
              </div>
            </div>
          </div>
          <div
            v-if="experimentObj.sayToChild"
            class="say-to-child"
          >
            <div class="stc-label">
              💬 可以这样对孩子说
            </div>
            <div class="stc-text">
              {{ experimentObj.sayToChild }}
            </div>
          </div>
          <div class="exp-meta">
            <span
              v-if="experimentObj.materials"
              class="meta-tag"
            >🧰 {{ Array.isArray(experimentObj.materials) ? experimentObj.materials.join(' · ') : experimentObj.materials }}</span>
            <span
              v-if="experimentObj.duration"
              class="meta-tag"
            >⏱ {{ experimentObj.duration }}</span>
          </div>
        </template>

        <template v-else>
          <div class="text">
            {{ experiment }}
          </div>
          <div
            v-if="materials"
            class="materials-tag"
          >
            📦 准备材料：{{ materials }}
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { toWebP, expTypeLabels } from '../utils/constants'

const props = defineProps({
  science: { type: String, default: '' },
  scienceImage: { type: String, default: '' },
  experiment: { type: [String, Object], default: '' },
  materials: { type: String, default: '' },
})

const expanded = ref(false)
const scienceImgError = ref(false)
const expImgError = ref(false)

const experimentObj = computed(() =>
  typeof props.experiment === 'object' && props.experiment !== null ? props.experiment : null
)

const safetyNotice = computed(() => {
  if (experimentObj.value?.safetyNote) return `⚠️ ${experimentObj.value.safetyNote}`
  const type = experimentObj.value?.experimentType || (typeof props.experiment === 'string' ? 'discussion' : 'hands-on')
  if (type === 'discussion') return ''
  if (type === 'observation') return '👀 观察时请注意安全哦'
  return '🤝 这个实验需要大人一起参与哦'
})
const expTypeLabel = computed(() => expTypeLabels[experimentObj.value?.experimentType] || '')
const scienceImageSrc = computed(() => {
  if (!props.scienceImage) return ''
  if (props.scienceImage.startsWith('http')) return props.scienceImage
  return toWebP(props.scienceImage)
})
const expImageSrc = computed(() => {
  const img = experimentObj.value?.image
  if (!img) return ''
  if (img.startsWith('http')) return img
  return toWebP(img)
})
</script>

<style scoped>
.parent-section {
  margin-top: 8px;
  background: var(--color-parent-bg);
  border-radius: var(--radius-card);
  overflow: hidden;
  border: 1px solid #eee;
}
.parent-header {
  padding: 14px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  font-size: 14px;
  color: #666;
  font-weight: 500;
}
.arrow { transition: transform 0.3s; font-size: 12px; color: #999; }
.arrow.open { transform: rotate(180deg); }
.parent-body { padding: 0 16px 16px; }

.safety-notice {
  text-align: center;
  padding: 8px 12px;
  margin-bottom: 12px;
  background: #FFF3E0;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
  color: #E65100;
}

.info-card { border-radius: 14px; padding: 14px 16px; margin-bottom: 12px; }
.info-card.science { background: var(--color-science); }
.info-card.experiment { background: #FFF8E1; }
.info-card .label { font-size: 12px; font-weight: 700; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
.info-card.science .label { color: #6A1B9A; }
.info-card.experiment .label { color: #E65100; }
.info-card .text { font-size: 13px; line-height: 1.8; }

.exp-type-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  margin-bottom: 10px;
}
.exp-type-badge.hands-on { background: #FFF3E0; color: #E65100; }
.exp-type-badge.observation { background: #E8F5E9; color: #2E7D32; }
.exp-type-badge.discussion { background: #E3F2FD; color: #1565C0; }
.info-card.science .text { color: #4A148C; }

.section-img {
  width: 100%;
  border-radius: 10px;
  margin-bottom: 12px;
  object-fit: cover;
  max-height: 200px;
}

.science-img-wrapper {
  margin-bottom: 12px;
}
.science-img-wrapper .section-img {
  margin-bottom: 4px;
}
.img-caption {
  text-align: center;
  font-size: 11px;
  color: #767676;
  font-weight: 500;
}

.exp-name {
  font-size: 16px;
  font-weight: 700;
  color: #BF360C;
  margin-bottom: 12px;
}
.exp-steps { display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; }
.exp-step { display: flex; align-items: flex-start; gap: 10px; }
.step-num {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: linear-gradient(135deg, #F9A825, #FF8F00);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 800;
  flex-shrink: 0;
  margin-top: 2px;
}
.step-text { font-size: 13px; line-height: 1.6; color: #5D4037; }

.say-to-child {
  background: rgba(255,255,255,0.6);
  border-radius: 10px;
  padding: 10px 14px;
  margin-bottom: 12px;
  border-left: 3px solid #F9A825;
}
.stc-label { font-size: 11px; font-weight: 700; color: #C45000; margin-bottom: 4px; }
.stc-text { font-size: 13px; line-height: 1.6; color: #5D4037; font-style: italic; }

.exp-meta { display: flex; gap: 8px; flex-wrap: wrap; }
.meta-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: rgba(255,255,255,0.65);
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 600;
  color: #795548;
}

.materials-tag {
  margin-top: 10px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #C8E6C9;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 12px;
  color: #1B5E20;
  font-weight: 500;
}
</style>
