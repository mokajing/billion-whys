<template>
  <div class="ask-page">
    <div class="ask-header">
      <h2>问一问</h2>
      <p>输入你想知道的问题</p>
    </div>

    <div
      class="search-box"
      role="search"
    >
      <span class="search-icon">🔍</span>
      <input
        v-model="keyword"
        type="text"
        placeholder="为什么会下雨？为什么要睡觉？"
        maxlength="50"
        aria-label="搜索问题"
        @input="onSearch"
      >
      <button
        v-if="keyword"
        class="clear-btn"
        aria-label="清除搜索"
        @click="clearSearch"
      >
        ✕
      </button>
    </div>

    <div
      v-if="hasSearched && results.length > 0"
      class="search-results"
      aria-live="polite"
    >
      <div class="results-title">
        找到 {{ results.length }} 个相关问题
      </div>
      <div
        v-for="q in results"
        :key="q.id"
        class="result-item"
        role="button"
        tabindex="0"
        @click="$router.push({ name: 'question', params: { id: q.id } })"
        @keydown.enter="$router.push({ name: 'question', params: { id: q.id } })"
        @keydown.space.prevent="$router.push({ name: 'question', params: { id: q.id } })"
      >
        <span class="ri-icon">💡</span>
        <div class="ri-content">
          <div class="ri-text">
            {{ q.question }}
          </div>
          <div class="ri-tags">
            {{ (q.tags || []).join(' · ') }}
          </div>
        </div>
        <span class="ri-arrow">›</span>
      </div>
    </div>

    <div
      v-if="hasSearched && results.length === 0"
      class="no-result"
      aria-live="polite"
    >
      <div class="nr-icon">
        <RabbitFace :size="48" />
      </div>
      <p>问问兔也在学习这个问题呢！</p>
      <span>试试看看下面这些相关的问题</span>
      <div
        v-if="suggestions.length > 0"
        class="suggest-section"
      >
        <div class="suggest-title">
          你可能想问
        </div>
        <div
          v-for="q in suggestions"
          :key="q.id"
          class="result-item"
          role="button"
          tabindex="0"
          @click="$router.push({ name: 'question', params: { id: q.id } })"
          @keydown.enter="$router.push({ name: 'question', params: { id: q.id } })"
          @keydown.space.prevent="$router.push({ name: 'question', params: { id: q.id } })"
        >
          <span class="ri-icon">✨</span>
          <div class="ri-content">
            <div class="ri-text">
              {{ q.question }}
            </div>
            <div class="ri-tags">
              {{ (q.tags || []).join(' · ') }}
            </div>
          </div>
          <span class="ri-arrow">›</span>
        </div>
      </div>
    </div>

    <div
      v-if="!keyword && recentSearches.length > 0"
      class="recent-section"
    >
      <div class="recent-header">
        <span class="recent-title">最近搜过</span>
        <button
          class="recent-clear"
          aria-label="清空搜索历史"
          @click="clearHistory"
        >
          清空
        </button>
      </div>
      <div class="recent-tags">
        <span
          v-for="term in recentSearches"
          :key="term"
          class="recent-tag"
          role="button"
          tabindex="0"
          :aria-label="`搜索：${term}`"
          @click="searchFromHistory(term)"
          @keydown.enter="searchFromHistory(term)"
          @keydown.space.prevent="searchFromHistory(term)"
        >{{ term }}</span>
      </div>
    </div>

    <div
      v-if="!keyword"
      class="hot-section"
    >
      <div class="hot-title">
        大家都在问
      </div>
      <div class="hot-list">
        <div
          v-for="q in hotQuestions"
          :key="q.id"
          class="hot-item"
          role="button"
          tabindex="0"
          @click="$router.push({ name: 'question', params: { id: q.id } })"
          @keydown.enter="$router.push({ name: 'question', params: { id: q.id } })"
          @keydown.space.prevent="$router.push({ name: 'question', params: { id: q.id } })"
        >
          <span class="hot-icon">❓</span>
          <span class="hot-text">{{ q.question }}</span>
        </div>
      </div>
    </div>

    <div
      v-if="!keyword"
      class="hint-section"
    >
      <p>试试问：</p>
      <div class="hint-tags">
        <span
          v-for="hint in hints"
          :key="hint"
          class="hint-tag"
          role="button"
          tabindex="0"
          @click="keyword = hint; doSearch()"
          @keydown.enter="keyword = hint; doSearch()"
          @keydown.space.prevent="keyword = hint; doSearch()"
        >{{ hint }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useContentStore } from '../stores/content'
import RabbitFace from '../components/RabbitFace.vue'

const contentStore = useContentStore()
const keyword = ref('')
const results = ref([])
const suggestions = ref([])
const hints = ref([])
const hasSearched = ref(false)
const hotQuestions = computed(() => contentStore.hotQuestions)
const recentSearches = computed(() => contentStore.searchHistory)

function refreshHints() {
  const all = contentStore.questions.map(q => q.question)
  const shuffled = [...all]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  hints.value = shuffled.slice(0, 5)
}

onMounted(() => {
  contentStore.refreshHotQuestions()
  refreshHints()
})

watch(() => contentStore.ready, (ready) => {
  if (ready) {
    contentStore.refreshHotQuestions()
    if (hints.value.length === 0) refreshHints()
  }
})

let searchTimer = null

function clearSearch() {
  keyword.value = ''
  results.value = []
  suggestions.value = []
  hasSearched.value = false
  clearTimeout(searchTimer)
}

function doSearch() {
  if (!keyword.value.trim()) {
    results.value = []
    suggestions.value = []
    hasSearched.value = false
    return
  }
  results.value = contentStore.searchQuestions(keyword.value)
  if (results.value.length === 0) {
    suggestions.value = contentStore.suggestRelated(keyword.value)
  } else {
    suggestions.value = []
  }
  hasSearched.value = true
  contentStore.pushSearchHistory(keyword.value.trim())
}

function searchFromHistory(term) {
  keyword.value = term
  doSearch()
}

function clearHistory() {
  contentStore.clearSearchHistory()
}

function onSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(doSearch, 300)
}

onBeforeUnmount(() => clearTimeout(searchTimer))
</script>

<style scoped>
.ask-page { padding: 40px 16px calc(var(--nav-height) + 24px); }
.ask-header { text-align: center; margin-bottom: 24px; }
.ask-header h2 { font-size: 20px; color: #333; }
.ask-header p { font-size: 13px; color: #767676; margin-top: 4px; }

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #f5f5f5;
  border-radius: 24px;
  padding: 10px 16px;
  margin-bottom: 20px;
  border: 2px solid transparent;
  transition: border-color 0.2s;
}
.search-box:focus-within { border-color: var(--color-primary); background: #fff; }
.search-icon { font-size: 16px; flex-shrink: 0; }
.search-box input {
  flex: 1;
  border: none;
  background: none;
  font-size: 15px;
  outline: none;
  color: #333;
}
.search-box input::placeholder { color: #bbb; }
.clear-btn {
  background: #ddd;
  border: none;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  font-size: 10px;
  cursor: pointer;
  color: #666;
  display: flex;
  align-items: center;
  justify-content: center;
}

.results-title { font-size: 12px; color: #767676; margin-bottom: 8px; }
.result-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
}
.result-item:active { background: #f9f9f9; }
.ri-icon { font-size: 20px; flex-shrink: 0; }
.ri-content { flex: 1; }
.ri-text { font-size: 15px; font-weight: 500; color: #333; }
.ri-tags { font-size: 11px; color: #767676; margin-top: 2px; }
.ri-arrow { font-size: 18px; color: #ccc; }

.no-result { text-align: center; padding: 40px 0; }
.nr-icon { font-size: 48px; margin-bottom: 12px; }
.no-result p { font-size: 15px; color: #666; }
.no-result span { font-size: 12px; color: #767676; }

.suggest-section { margin-top: 20px; text-align: left; width: 100%; }
.suggest-title { font-size: 13px; font-weight: 600; color: #666; margin-bottom: 8px; }

.hot-section { margin-bottom: 24px; }
.hot-title { font-size: 14px; font-weight: 600; color: #333; margin-bottom: 12px; }

.recent-section { margin-bottom: 20px; }
.recent-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.recent-title { font-size: 13px; font-weight: 600; color: #666; }
.recent-clear {
  background: none;
  border: none;
  font-size: 11px;
  color: #999;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 10px;
}
.recent-clear:active { background: #f0f0f0; color: #666; }
.recent-tags { display: flex; gap: 8px; flex-wrap: wrap; }
.recent-tag {
  padding: 6px 12px;
  border-radius: 16px;
  background: #f5f0ff;
  font-size: 12px;
  color: #6b4ea8;
  cursor: pointer;
  border: 1px solid #e8def5;
  transition: all 0.2s;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.recent-tag:active { background: #6b4ea8; color: #fff; }
.hot-list { display: flex; flex-direction: column; gap: 2px; }
.hot-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 0;
  border-bottom: 1px solid #f5f5f5;
  cursor: pointer;
  font-size: 14px;
  color: #333;
}
.hot-item:active { background: #f9f9f9; }
.hot-icon { font-size: 16px; }

.hint-section { margin-top: 16px; }
.hint-section p { font-size: 12px; color: #767676; margin-bottom: 8px; }
.hint-tags { display: flex; gap: 8px; flex-wrap: wrap; }
.hint-tags span {
  padding: 6px 12px;
  border-radius: 16px;
  background: #f0f8f4;
  font-size: 12px;
  color: var(--color-primary);
  cursor: pointer;
  border: 1px solid #e0f0e8;
  transition: all 0.2s;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hint-tags span:active { background: var(--color-primary); color: #fff; }
</style>
