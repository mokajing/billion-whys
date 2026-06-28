<template>
  <div
    v-if="question"
    class="question-detail"
  >
    <div class="question-header">
      <button
        class="back-btn"
        aria-label="返回上一页"
        @click="goBack"
      >
        ← 返回
      </button>
      <div class="category-tag">
        {{ categoryLabel }}
      </div>
      <h2 class="question-text">
        {{ question.question }}
      </h2>
      <div class="age-badge">
        适合 {{ question.age }}
      </div>
      <button
        class="fav-btn"
        :class="{ active: contentStore.isFavorite(question.id) }"
        :aria-label="contentStore.isFavorite(question.id) ? '取消收藏' : '收藏这个问题'"
        :aria-pressed="contentStore.isFavorite(question.id)"
        @click="contentStore.toggleFavorite(question.id)"
      >
        {{ contentStore.isFavorite(question.id) ? '★' : '☆' }}
      </button>
    </div>

    <div
      class="scroll-content"
      role="article"
      :aria-label="question.question"
    >
      <div
        v-if="question.ipScene"
        class="ip-scene"
      >
        <div
          v-for="(line, idx) in ipDialogues"
          :key="idx"
          class="ip-bubble"
          :class="line.role"
        >
          <div class="ip-line">
            <span class="ip-avatar">
              <BearFace
                v-if="line.role === 'bear'"
                :size="24"
              />
              <RabbitFace
                v-else
                :size="24"
              />
            </span>
            <span class="ip-name">{{ line.role === 'bear' ? '答答熊' : '问问兔' }}</span>
          </div>
          <div class="ip-dialogue">
            {{ line.text }}
          </div>
        </div>
      </div>

      <KnowledgeCard
        :layer="1"
        badge="💬 第1层 · 直接回答"
        :question="question.question"
        :answer="question.layer1?.answer || ''"
        :image="question.layer1?.image || ''"
        :category="question.category"
      />

      <div
        v-if="currentFeedback"
        class="feedback-thanks"
        role="status"
        aria-live="polite"
      >
        <!-- V8.0 第69轮：🌟静态emoji 升级为 问问兔鞠躬 SVG 动效（IP一致性+情感回馈） -->
        <RabbitFace
          :size="40"
          mood="bowing"
          aria-label="问问兔在鞠躬感谢你的反馈"
          class="ft-rabbit"
        />
        <span class="ft-text">谢谢你的反馈，我们会让问问兔更努力！</span>
        <!-- V8.1 第70轮 Sprint 10：试试互动实验 CTA，引导妈妈进入ParentSection（CPO+COO裁决：激活实验区是Phase 2增长杠杆） -->
        <button
          v-if="hasExperiment"
          class="ft-cta"
          aria-label="试试和问问兔一起做互动实验"
          @click="scrollToExperiment"
        >
          🤲 试试互动实验
        </button>
        <!-- V8.3 第71轮 Sprint 12：再评一次 次级CTA，闭合反馈循环（COO北极星反馈率≥5%）
             UX苏体验：右下次级灰，不抢主CTA视觉焦点；心理学家周教授：正向文案避免否定负担 -->
        <button
          class="ft-reset"
          aria-label="清除当前反馈，重新选择有用或没用"
          @click="resetFeedback"
        >
          ↻ 再评一次
        </button>
      </div>
      <div
        v-else
        class="feedback-section"
        role="group"
        aria-label="答案反馈"
      >
        <span class="fb-prompt">这个回答对孩子有用吗？</span>
        <div class="fb-buttons">
          <button
            class="fb-btn"
            :class="{ active: currentFeedback === 'up' }"
            aria-label="有用"
            :aria-pressed="currentFeedback === 'up'"
            @click="onFeedback('up')"
          >
            👍 有用
          </button>
          <button
            class="fb-btn fb-down"
            :class="{ active: currentFeedback === 'down' }"
            aria-label="没用"
            :aria-pressed="currentFeedback === 'down'"
            @click="onFeedback('down')"
          >
            👎 没用
          </button>
        </div>
      </div>

      <div
        v-if="question.layer2 && !showDeeper"
        class="expand-hint"
      >
        <button
          class="expand-btn"
          aria-label="展开更多回答"
          @click="showDeeper = true"
        >
          问问兔还有更多发现哦 👇
        </button>
      </div>

      <template v-if="question.layer2 && showDeeper">
        <div class="next-hint">
          继续追问 👇
        </div>

        <KnowledgeCard
          :layer="2"
          badge="🔄 第2层 · 继续追问"
          :follow-up="question.layer2.followUp || ''"
          :answer="question.layer2.answer || ''"
          :image="question.layer2.image || ''"
          :category="question.category"
        />

        <div
          v-if="question.layer3"
          class="next-hint"
        >
          还想知道更多 👇
        </div>

        <KnowledgeCard
          v-if="question.layer3"
          :layer="3"
          badge="🌟 第3层 · 趣味延伸"
          :follow-up="question.layer3.followUp || ''"
          :answer="question.layer3.answer || ''"
          :image="question.layer3.image || ''"
          :category="question.category"
        />
      </template>

      <div class="warm-closing">
        <div class="wc-icon">
          🌟
        </div>
        <div class="wc-text">
          {{ warmClosingText }}
        </div>
        <div class="wc-sub">
          好奇心是最厉害的超能力哦！
        </div>
      </div>

      <ParentSection
        ref="parentSectionRef"
        :science="question.science"
        :science-image="question.scienceImage || ''"
        :experiment="question.experiment"
        :materials="question.materials || ''"
      />

      <div
        v-if="relatedQuestions.length > 0"
        class="related-section"
      >
        <h3 class="related-title">
          相关好奇
        </h3>
        <div class="related-scroll">
          <div
            v-for="rq in relatedQuestions"
            :key="rq.id"
            class="related-card"
            role="button"
            tabindex="0"
            @click="goTo(rq.id)"
            @keydown.enter="goTo(rq.id)"
            @keydown.space.prevent="goTo(rq.id)"
          >
            <span class="rc-icon">💡</span>
            <span class="rc-text">{{ rq.question }}</span>
          </div>
        </div>
      </div>

      <div
        class="question-nav"
        role="navigation"
        aria-label="问题导航"
      >
        <button
          v-if="prevQuestion"
          class="nav-btn prev"
          :aria-label="'上一个问题：' + prevQuestion.question"
          @click="goTo(prevQuestion.id)"
        >
          ← {{ prevQuestion.question }}
        </button>
        <button
          v-if="nextQuestion"
          class="nav-btn next"
          :aria-label="'下一个问题：' + nextQuestion.question"
          @click="goTo(nextQuestion.id)"
        >
          {{ nextQuestion.question }} →
        </button>
      </div>
    </div>
  </div>

  <div
    v-else-if="contentStore.initError"
    class="not-found"
  >
    <div class="nf-icon">
      😿
    </div>
    <h3>加载遇到问题了</h3>
    <p>点击下方按钮重试</p>
    <button
      class="nf-btn"
      @click="contentStore.retryInit()"
    >
      重新加载
    </button>
  </div>

  <div
    v-else-if="!contentStore.ready"
    class="not-found"
  >
    <div class="nf-icon">
      <RabbitFace :size="48" />
    </div>
    <h3>问问兔正在准备中…</h3>
    <p>马上就好</p>
  </div>

  <div
    v-else
    class="not-found"
  >
    <div class="nf-icon">
      <RabbitFace :size="48" />
    </div>
    <h3>问问兔找不到这个问题</h3>
    <p>试试去发现页看看其他问题吧</p>
    <button
      class="nf-btn"
      @click="$router.push('/')"
    >
      去发现页
    </button>
  </div>
</template>

<script setup>
import { ref, computed, watch, watchEffect, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useContentStore } from '../stores/content'
import { useAnalyticsStore } from '../stores/analytics'
import KnowledgeCard from '../components/KnowledgeCard.vue'
import ParentSection from '../components/ParentSection.vue'
import RabbitFace from '../components/RabbitFace.vue'
import BearFace from '../components/BearFace.vue'
import { categoryLabels as categoryLabelsMap, parseIpScene } from '../utils/constants'

const route = useRoute()
const router = useRouter()
const contentStore = useContentStore()
const analyticsStore = useAnalyticsStore()

const question = computed(() => contentStore.getQuestionById(route.params.id))

const showDeeper = ref(false)
const parentSectionRef = ref(null)

const hasExperiment = computed(() => {
  const exp = question.value?.experiment
  if (!exp) return false
  if (typeof exp === 'string') return exp.trim().length > 0
  return !!(exp.name || exp.steps || exp.experimentType)
})

function scrollToExperiment() {
  // V8.2 第71轮 Sprint 11：埋点 cta_experiment — 闭合 反馈→CTA→实验 增长漏斗（COO+AI小智）
  if (question.value?.id) {
    analyticsStore.trackEvent('cta_experiment', question.value.id)
  }
  const el = parentSectionRef.value?.$el
  if (el && typeof el.scrollIntoView === 'function') {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  } else if (el) {
    // Fallback for older browsers / non-smooth environments
    el.scrollIntoView()
  }
}

const ipDialogues = computed(() => parseIpScene(question.value?.ipScene))

watch(() => route.params.id, (newId) => {
  showDeeper.value = false
  if (newId) {
    const q = contentStore.getQuestionById(newId)
    if (q) {
      nextTick(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
    }
  }
})

const categoryQuestions = computed(() => {
  if (!question.value) return []
  return contentStore.getByCategory(question.value.category)
})

const currentIndex = computed(() => {
  return categoryQuestions.value.findIndex(q => q.id === question.value?.id)
})

const prevQuestion = computed(() => {
  if (currentIndex.value > 0) return categoryQuestions.value[currentIndex.value - 1]
  return null
})

const nextQuestion = computed(() => {
  if (currentIndex.value < categoryQuestions.value.length - 1) return categoryQuestions.value[currentIndex.value + 1]
  return null
})

function goBack() {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/')
  }
}

function goTo(id) {
  router.push({ name: 'question', params: { id } })
}

watchEffect(() => {
  if (contentStore.ready && question.value) {
    contentStore.markViewed(question.value.id, question.value.category)
  }
})

const categoryLabel = computed(() => categoryLabelsMap[question.value?.category] || '')

const defaultWarmClosing = '哇，你问了一个连科学家都还在研究的问题呢！等长大一点，我们一起去找更多答案好不好？'
const warmClosingText = computed(() => question.value?.warmClosing || defaultWarmClosing)

const relatedQuestions = computed(() => {
  if (!question.value) return []
  return contentStore.suggestRelated(question.value.question)
    .filter(q => q.id !== question.value.id)
    .slice(0, 3)
})

const currentFeedback = computed(() => {
  if (!question.value) return null
  return contentStore.getAnswerFeedback(question.value.id)
})

function onFeedback(value) {
  if (!question.value) return
  // V8.9 第77轮 Sprint 18：快照反馈时可见的最深 Layer（depth=1/2/3）
  // Why: 反馈深度归因 — depth=3+👍 是深度学习信号，depth=3+👎 是内容质量强信号
  // How to apply: showDeeper=false→1；showDeeper=true 且有 layer3→3；仅 layer2→2
  const depth = !showDeeper.value ? 1
    : (question.value.layer3 ? 3 : (question.value.layer2 ? 2 : 1))
  contentStore.setAnswerFeedback(question.value.id, value, depth)
  // V8.2 第71轮 Sprint 11：埋点 feedback_up/down — 闭合内容质量数据回路（COO+AI小智+CCO）
  // Why: detail 只含 questionId（内部元数据），无儿童身份，法务张律放行
  analyticsStore.trackEvent(value === 'up' ? 'feedback_up' : 'feedback_down', question.value.id)
}

// V8.3 第71轮 Sprint 12：重置反馈，让妈妈"再评一次"（COO反馈率北极星+UX苏体验后悔药）
// Why: 误点后悔药 + 反复重置的questionId是内容质量强信号（比单纯👎率更敏感，AI小智）
function resetFeedback() {
  if (!question.value) return
  const id = question.value.id
  // V8.9 Sprint 18：reset 也带 depth（测试虫虫裁决保持 schema 一致）
  const depth = !showDeeper.value ? 1
    : (question.value.layer3 ? 3 : (question.value.layer2 ? 2 : 1))
  contentStore.clearAnswerFeedback(id, depth)
  // 埋点 feedback_reset — detail 仅 questionId，无儿童身份（法务张律放行）
  analyticsStore.trackEvent('feedback_reset', id)
}

// V8.2 第71轮 Sprint 11：埋点 layer_expand — 追踪 Layer2/3 展开动作（CPO+COO）
// Why: 衡量深度阅读率，识别 Layer1 之后的好奇心延续
watch(showDeeper, (newVal) => {
  if (newVal && question.value?.id) {
    analyticsStore.trackEvent('layer_expand', question.value.id)
  }
})
</script>

<style scoped>
.question-header {
  background: linear-gradient(135deg, #1A5C3A, #2E7D52);
  padding: 16px 24px 32px;
  position: relative;
  border-radius: 0 0 24px 24px;
  padding-right: 56px;
}
.back-btn {
  background: none;
  border: none;
  color: rgba(255,255,255,0.8);
  font-size: 14px;
  cursor: pointer;
  padding: 4px 0;
  margin-bottom: 8px;
}
.category-tag {
  display: inline-block;
  background: rgba(255,255,255,0.2);
  color: #fff;
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 12px;
  margin-bottom: 10px;
}
.question-text { color: #fff; font-size: 24px; font-weight: 700; line-height: 1.4; }
.age-badge {
  display: inline-block;
  background: #FFD54F;
  color: #5D4037;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 8px;
  margin-top: 8px;
}
.fav-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  background: none;
  border: none;
  font-size: 28px;
  color: rgba(255,255,255,0.6);
  cursor: pointer;
  padding: 4px;
  transition: all 0.2s;
  line-height: 1;
}
.fav-btn.active { color: #FFD54F; }
.fav-btn:active { transform: scale(1.3); }
.scroll-content { padding: 16px; }
.next-hint {
  text-align: center;
  padding: 8px 0;
  font-size: 12px;
  color: #767676;
}

.expand-hint {
  text-align: center;
  padding: 16px 0;
}
.expand-btn {
  display: inline-block;
  padding: 12px 24px;
  border-radius: 24px;
  border: 2px dashed #FFD54F;
  background: linear-gradient(135deg, #FFF8E1, #FFFDE7);
  font-size: 15px;
  font-weight: 600;
  color: #C45000;
  cursor: pointer;
  transition: all 0.2s;
}
.expand-btn:active { transform: scale(0.96); background: #FFF3E0; }

.feedback-section {
  margin: 16px 24px;
  padding: 16px 20px;
  background: #F5F9F6;
  border-radius: 16px;
  text-align: center;
  animation: fadeInUp 0.5s ease 0.4s both;
}
.fb-prompt {
  display: block;
  font-size: 14px;
  color: #555;
  margin-bottom: 12px;
}
.fb-buttons {
  display: flex;
  gap: 12px;
  justify-content: center;
}
.fb-btn {
  min-width: 96px;
  min-height: 48px;
  padding: 8px 16px;
  border-radius: 24px;
  border: 2px solid #9E9E9E;
  background: #fff;
  font-size: 14px;
  font-weight: 500;
  color: #555;
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.fb-btn:hover { background: #FAFAFA; }
.fb-btn:active { transform: scale(0.96); }
.fb-btn.active {
  border-color: #4CAF50;
  background: #E8F5E9;
  color: #1B5E20;
}
.fb-btn.fb-down.active {
  border-color: #FF7043;
  background: #FBE9E7;
  color: #BF360C;
}
.fb-btn:focus-visible {
  outline: 3px solid #4CAF50;
  outline-offset: 2px;
}
.feedback-thanks {
  margin: 16px 24px;
  padding: 14px 20px;
  background: linear-gradient(135deg, #FFF8E1, #FFFDE7);
  border-radius: 16px;
  text-align: center;
  font-size: 14px;
  color: #5D4037;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.ft-icon { font-size: 18px; }
.ft-rabbit {
  /* V8.0 第69轮：鞠躬 SVG 与文案对齐；RabbitFace 内部已处理动画+reduced-motion */
  vertical-align: middle;
}
/* V8.1 第70轮 Sprint 10：试试互动实验 CTA 样式（彩虹姐暖色系+苏体验48px触摸目标） */
.ft-cta {
  margin-left: 12px;
  padding: 8px 16px;
  min-height: 40px;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, #66BB6A, #2E7D52);
  border: none;
  border-radius: 20px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(46, 125, 82, 0.25);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  white-space: nowrap;
  flex-shrink: 0;
}
.ft-cta:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(46, 125, 82, 0.35); }
.ft-cta:active { transform: scale(0.96); }
.ft-cta:focus-visible {
  outline: 3px solid #4CAF50;
  outline-offset: 2px;
}
/* V8.3 第71轮 Sprint 12：再评一次 次级CTA — UX苏体验右下次级灰，不抢主CTA视觉焦点
   彩虹姐：#9E9E9E → hover #757575，与主CTA暖绿形成主次；48px WCAG 2.2 触摸目标 */
.ft-reset {
  background: transparent;
  color: #9E9E9E;
  border: 1px solid #E0E0E0;
  border-radius: 999px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  min-height: 48px;
  min-width: 48px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: all 0.2s ease;
  margin-left: 8px;
}
.ft-reset:hover {
  color: #757575;
  border-color: #BDBDBD;
  background: #FAFAFA;
}
.ft-reset:active { transform: scale(0.96); }
.ft-reset:focus-visible {
  outline: 3px solid #9E9E9E;
  outline-offset: 2px;
}
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.warm-closing {
  text-align: center;
  padding: 24px 20px;
  margin: 8px 0;
  background: linear-gradient(135deg, #FFF8E1, #FFFDE7);
  border-radius: var(--radius-card);
  border: 1px dashed #FFD54F;
}
.wc-icon { font-size: 36px; margin-bottom: 10px; }
.wc-text { font-size: 14px; color: #C45000; line-height: 1.8; font-weight: 500; }
.wc-sub { font-size: 12px; color: #8D6508; margin-top: 8px; font-weight: 600; }

.not-found {
  text-align: center;
  padding: 80px 24px;
}

.ip-scene {
  margin-bottom: 16px;
  padding: 14px 16px;
  background: linear-gradient(135deg, #FFF8E1, #FFF3E0);
  border-radius: var(--radius-card);
  border: 1px solid #FFE0B2;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.ip-bubble.bear {
  padding-left: 12px;
  border-left: 3px solid #A5D6A7;
}
.ip-line {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}
.ip-avatar { font-size: 20px; }
.ip-bubble.rabbit .ip-name { font-size: 12px; font-weight: 600; color: #E65100; }
.ip-bubble.bear .ip-name { font-size: 12px; font-weight: 600; color: #2E7D32; }
.ip-dialogue { font-size: 14px; line-height: 1.7; color: #5D4037; font-style: italic; }

.question-nav {
  display: flex;
  gap: 10px;
  margin: 16px 0 24px;
}
.nav-btn {
  flex: 1;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid #e0e0e0;
  background: #fafafa;
  font-size: 13px;
  color: #555;
  cursor: pointer;
  line-height: 1.4;
  transition: all 0.2s;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.nav-btn:active { background: #f0f0f0; }
.nav-btn.prev { text-align: left; }
.nav-btn.next { text-align: right; }
.nf-icon { font-size: 64px; margin-bottom: 16px; }
.not-found h3 { font-size: 18px; color: #333; margin-bottom: 8px; }
.not-found p { font-size: 14px; color: #767676; }
.nf-btn {
  margin-top: 24px;
  padding: 10px 24px;
  border-radius: 20px;
  border: none;
  background: var(--color-primary);
  color: #fff;
  font-size: 14px;
  cursor: pointer;
}

.related-section { margin: 8px 0 16px; }
.related-title { font-size: 15px; font-weight: 600; color: #333; margin-bottom: 10px; }
.related-scroll { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 4px; scroll-snap-type: x mandatory; }
.related-card {
  flex-shrink: 0;
  width: 200px;
  padding: 14px;
  border-radius: 14px;
  background: #F5F5F5;
  cursor: pointer;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  scroll-snap-align: start;
  transition: all 0.2s;
}
.related-card:active { background: #EEEEEE; transform: scale(0.97); }
.rc-icon { font-size: 18px; flex-shrink: 0; }
.rc-text { font-size: 13px; line-height: 1.5; color: #555; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
</style>
