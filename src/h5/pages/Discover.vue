<template>
  <div class="discover-page">
    <header class="discover-header">
      <h1>十亿个什么与为什么</h1>
      <p>{{ contentStore.totalCount }} 个问题等你来探索</p>
    </header>

    <div
      class="category-tabs"
      role="tablist"
      aria-label="内容分类"
      @keydown.left.prevent="focusTab(-1)"
      @keydown.right.prevent="focusTab(1)"
    >
      <button
        v-for="cat in categories"
        :id="`tab-${cat.key}`"
        :key="cat.key"
        ref="tabRefs"
        class="cat-tab"
        :class="{ active: activeCategory === cat.key }"
        role="tab"
        :tabindex="activeCategory === cat.key ? 0 : -1"
        :aria-selected="activeCategory === cat.key"
        :aria-controls="activeCategory === cat.key ? `panel-${cat.key}` : undefined"
        @click="activeCategory = cat.key"
      >
        {{ cat.icon }} {{ cat.label }}
        <span
          v-if="cat.key !== 'all'"
          class="cat-count"
        >{{ getCategoryCount(cat.key) }}</span>
      </button>
    </div>

    <div
      v-if="!contentStore.ready && !contentStore.initError"
      class="loading-state"
      aria-live="polite"
    >
      <div class="loading-icon">
        <RabbitFace :size="48" />
      </div>
      <p>问问兔正在准备问题...</p>
    </div>

    <div
      v-else-if="contentStore.initError"
      class="loading-state"
      aria-live="assertive"
    >
      <div class="loading-icon">
        😿
      </div>
      <p>加载失败了，请重试</p>
      <button
        class="retry-btn"
        @click="contentStore.retryInit()"
      >
        重新加载
      </button>
    </div>

    <template v-else>
      <section
        v-if="dailyPick && activeCategory === 'all'"
        class="daily-pick"
        aria-label="今日好奇推荐"
      >
        <div
          class="dp-card"
          role="button"
          tabindex="0"
          @click="$router.push({ name: 'question', params: { id: dailyPick.id } })"
          @keydown.enter="$router.push({ name: 'question', params: { id: dailyPick.id } })"
          @keydown.space.prevent="$router.push({ name: 'question', params: { id: dailyPick.id } })"
        >
          <div class="dp-bubble">
            <span class="dp-rabbit"><RabbitFace :size="32" /></span>
            <div class="dp-bubble-text">
              <div class="dp-tag">
                ✨ 今天的为什么
              </div>
              <div class="dp-question">
                {{ dailyPick.question }}
              </div>
            </div>
          </div>
          <span class="dp-arrow">›</span>
        </div>
      </section>

      <div
        :id="`panel-${activeCategory}`"
        class="question-list"
        role="tabpanel"
        :aria-labelledby="`tab-${activeCategory}`"
      >
        <div
          v-for="q in displayQuestions"
          :key="q.id"
          class="question-item"
          role="button"
          tabindex="0"
          @click="$router.push({ name: 'question', params: { id: q.id } })"
          @keydown.enter="$router.push({ name: 'question', params: { id: q.id } })"
          @keydown.space.prevent="$router.push({ name: 'question', params: { id: q.id } })"
        >
          <div
            class="q-thumb"
            :class="q.category"
          >
            <img
              v-if="q.layer1?.image && !imgErrors[q.id]"
              :src="toWebP(q.layer1.image)"
              :alt="q.question"
              loading="lazy"
              @error="onThumbError(q.id)"
            >
            <span
              v-else
              class="q-cat-icon"
            >{{ categoryIcons[q.category] || '❓' }}</span>
          </div>
          <div class="q-content">
            <div class="q-text">
              {{ q.question }}
            </div>
            <div class="q-meta">
              <span class="q-age">{{ q.age }}</span>
              <span class="q-tags">{{ (q.tags || []).join(' · ') }}</span>
            </div>
          </div>
          <div class="q-arrow">
            ›
          </div>
        </div>
        <button
          v-if="hasMore || isExpanded"
          class="expand-btn"
          :aria-expanded="isExpanded"
          @click="toggleExpand"
        >
          {{ isExpanded ? '收起' : `展开更多（共 ${filteredQuestions.length} 条）` }}
        </button>
        <div
          v-if="displayQuestions.length === 0"
          class="empty-state"
        >
          <p>这个分类的问题正在准备中</p>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, nextTick } from 'vue'
import { useContentStore } from '../stores/content'
import { categories, categoryIcons, toWebP } from '../utils/constants'
import RabbitFace from '../components/RabbitFace.vue'

const contentStore = useContentStore()
const activeCategory = ref('all')
const imgErrors = reactive({})
const tabRefs = ref([])

function focusTab(direction) {
  const idx = categories.findIndex(c => c.key === activeCategory.value)
  const next = (idx + direction + categories.length) % categories.length
  activeCategory.value = categories[next].key
  nextTick(() => tabRefs.value[next]?.focus())
}

watch(activeCategory, () => {
  nextTick(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
})
const expanded = reactive({})
const DEFAULT_SHOW = 8

const filteredQuestions = computed(() => contentStore.getByCategory(activeCategory.value))

const dailyPick = computed(() => contentStore.dailyPick)

const displayQuestions = computed(() => {
  const all = filteredQuestions.value
  if (expanded[activeCategory.value]) return all
  return all.slice(0, DEFAULT_SHOW)
})

const isExpanded = computed(() => !!expanded[activeCategory.value])

const hasMore = computed(() => {
  return filteredQuestions.value.length > DEFAULT_SHOW && !isExpanded.value
})

function toggleExpand() {
  const wasExpanded = expanded[activeCategory.value]
  expanded[activeCategory.value] = !wasExpanded
  if (wasExpanded) {
    nextTick(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
  }
}

const categoryCounts = computed(() => {
  const counts = {}
  for (const q of contentStore.questions) {
    counts[q.category] = (counts[q.category] || 0) + 1
  }
  return counts
})

function getCategoryCount(key) {
  return categoryCounts.value[key] || 0
}

function onThumbError(qId) {
  imgErrors[qId] = true
}
</script>

<style scoped>
.discover-page { padding-bottom: calc(var(--nav-height) + 16px); }

.discover-header {
  background: linear-gradient(135deg, var(--color-primary), #2E7D52);
  padding: 40px 24px 32px;
  color: #fff;
  border-radius: 0 0 24px 24px;
}
.discover-header h1 { font-size: 22px; font-weight: 700; }
.discover-header p { font-size: 13px; opacity: 0.8; margin-top: 4px; }

.category-tabs {
  display: flex;
  gap: 8px;
  padding: 16px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.category-tabs::-webkit-scrollbar { display: none; }
.cat-tab {
  flex-shrink: 0;
  padding: 6px 14px;
  border-radius: 16px;
  border: 1px solid #e0e0e0;
  background: #fff;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 4px;
}
.cat-tab.active {
  background: var(--color-primary);
  color: #fff;
  border-color: var(--color-primary);
}
.cat-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 9px;
  background: rgba(0,0,0,0.1);
  font-size: 10px;
  font-weight: 600;
}
.cat-tab.active .cat-count { background: rgba(255,255,255,0.3); }

.question-list { padding: 0 16px; }

.daily-pick {
  padding: 0 16px;
  margin-bottom: 12px;
}
.dp-card {
  display: flex;
  align-items: center;
  background: linear-gradient(135deg, #FFF9E6 0%, #FFE8C2 100%);
  border: 2px solid #FFD66B;
  border-radius: 16px;
  padding: 14px 16px;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.dp-card:hover, .dp-card:focus-visible {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(255, 180, 0, 0.25);
  outline: none;
}
.dp-bubble {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}
.dp-rabbit {
  font-size: 32px;
  line-height: 1;
  flex-shrink: 0;
}
.dp-bubble-text {
  min-width: 0;
  flex: 1;
}
.dp-tag {
  font-size: 12px;
  color: #B25E00;
  font-weight: 600;
  margin-bottom: 2px;
}
.dp-question {
  font-size: 16px;
  color: #3A2A00;
  font-weight: 500;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.dp-arrow {
  font-size: 24px;
  color: #B25E00;
  margin-left: 8px;
  flex-shrink: 0;
}
.question-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  transition: background 0.2s;
}
.question-item:active { background: #f9f9f9; }
.q-thumb {
  width: 52px;
  height: 52px;
  border-radius: 12px;
  flex-shrink: 0;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
.q-thumb img { width: 100%; height: 100%; object-fit: cover; }
.q-thumb.body { background: linear-gradient(135deg, #FCE4EC, #F8BBD0); }
.q-thumb.home { background: linear-gradient(135deg, #FFF3E0, #FFE0B2); }
.q-thumb.food { background: linear-gradient(135deg, #F1F8E9, #DCEDC8); }
.q-thumb.nature { background: linear-gradient(135deg, #E0F7FA, #B2EBF2); }
.q-thumb.animals { background: linear-gradient(135deg, #FFF8E1, #FFECB3); }
.q-thumb.society { background: linear-gradient(135deg, #EDE7F6, #D1C4E9); }
.q-cat-icon { font-size: 24px; }
.q-content { flex: 1; }
.q-text { font-size: 15px; font-weight: 500; color: #333; }
.q-meta { display: flex; gap: 8px; margin-top: 4px; }
.q-age {
  font-size: 11px;
  background: #FFF8E1;
  color: #E65100;
  padding: 1px 6px;
  border-radius: 4px;
}
.q-tags { font-size: 11px; color: #666; }
.q-arrow { font-size: 20px; color: #ccc; }

.empty-state { text-align: center; padding: 40px 0; }
.empty-state p { font-size: 14px; color: #767676; }
.expand-btn {
  display: block;
  width: 100%;
  padding: 12px;
  margin-top: 8px;
  border: 1px dashed #ccc;
  border-radius: 12px;
  background: #fafafa;
  color: #666;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}
.expand-btn:active { background: #f0f0f0; }

.loading-state {
  text-align: center;
  padding: 60px 0;
}
.loading-icon {
  font-size: 48px;
  animation: bounce 1s ease-in-out infinite;
}
.loading-state p { font-size: 14px; color: #767676; margin-top: 12px; }
.retry-btn {
  margin-top: 16px;
  padding: 10px 28px;
  border-radius: 20px;
  border: none;
  background: var(--color-primary);
  color: #fff;
  font-size: 14px;
  cursor: pointer;
}
@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}
</style>
