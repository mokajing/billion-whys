<template>
  <div class="archive-page">
    <div class="archive-header">
      <h2>📊 好奇档案</h2>
      <p>记录每一次好奇心的旅程</p>
    </div>

    <div
      class="tab-bar"
      role="tablist"
      aria-label="好奇档案分类"
    >
      <button
        class="tab-item"
        :class="{ active: activeTab === 'history' }"
        role="tab"
        :aria-selected="activeTab === 'history'"
        aria-label="浏览历史"
        @click="activeTab = 'history'"
      >
        浏览历史
      </button>
      <button
        class="tab-item"
        :class="{ active: activeTab === 'favorites' }"
        role="tab"
        :aria-selected="activeTab === 'favorites'"
        :aria-label="`我的收藏 ${contentStore.favoriteCount} 条`"
        @click="activeTab = 'favorites'"
      >
        收藏 ({{ contentStore.favoriteCount }})
      </button>
    </div>

    <div
      v-if="activeTab === 'history'"
      class="tab-panel"
      role="tabpanel"
      aria-label="浏览历史"
    >
      <div
        v-if="hasHistory"
        class="archive-stats"
        role="region"
        aria-label="探索统计"
      >
        <div class="stat">
          <span class="stat-num">{{ contentStore.viewedCount }}</span>
          <span class="stat-label">已探索</span>
        </div>
        <div class="stat">
          <span class="stat-num">{{ contentStore.todayViewedCount }}</span>
          <span class="stat-label">今日</span>
        </div>
        <div class="stat">
          <span class="stat-num">{{ contentStore.streakDays }}</span>
          <span class="stat-label">连续天</span>
        </div>
      </div>

      <div
        v-if="hasHistory"
        class="history-list"
      >
        <div
          v-for="(entries, date) in historyByDate"
          :key="date"
          class="date-group"
        >
          <div class="date-label">
            <span class="date-text">{{ date }}</span>
            <span class="date-count">探索了 {{ entries.length }} 个问题</span>
          </div>
          <div
            v-for="entry in entries"
            :key="entry.id"
            class="history-item"
            role="button"
            tabindex="0"
            @click="$router.push({ name: 'question', params: { id: entry.id } })"
            @keydown.enter="$router.push({ name: 'question', params: { id: entry.id } })"
            @keydown.space.prevent="$router.push({ name: 'question', params: { id: entry.id } })"
          >
            <span class="hi-icon">{{ getCategoryIcon(entry.category) }}</span>
            <div class="hi-content">
              <div class="hi-text">
                {{ getQuestionText(entry.id) }}
              </div>
              <div class="hi-time">
                {{ formatTime(entry.timestamp) }}
              </div>
            </div>
            <span class="hi-arrow">›</span>
          </div>
        </div>
      </div>

      <div
        v-else
        class="empty-state"
      >
        <div class="empty-icon">
          <RabbitFace :size="48" />
        </div>
        <p>还没有探索记录</p>
        <span>去发现页看看有什么有趣的问题吧！</span>
        <button
          class="go-btn"
          @click="$router.push('/')"
        >
          去探索
        </button>
      </div>
    </div>

    <div
      v-if="activeTab === 'favorites'"
      class="tab-panel"
      role="tabpanel"
      aria-label="我的收藏"
    >
      <div
        v-if="contentStore.favoriteCount === 0"
        class="empty-state"
      >
        <div class="empty-icon">
          ☆
        </div>
        <p>还没有收藏</p>
        <span>在问题详情页点击星标即可收藏</span>
        <button
          class="go-btn"
          @click="$router.push('/')"
        >
          去发现
        </button>
      </div>
      <div
        v-else
        class="history-list"
      >
        <div
          v-for="fq in contentStore.favoriteQuestions"
          :key="fq.id"
          class="history-item"
          :class="{ 'item-pressed': pressedId === fq.id }"
          role="button"
          tabindex="0"
          :aria-label="`${fq.question}，长按可取消收藏`"
          @click="$router.push({ name: 'question', params: { id: fq.id } })"
          @keydown.enter="$router.push({ name: 'question', params: { id: fq.id } })"
          @keydown.space.prevent="$router.push({ name: 'question', params: { id: fq.id } })"
          @pointerdown="startPress(fq.id)"
          @pointerup="cancelPress()"
          @pointerleave="cancelPress()"
          @pointercancel="cancelPress()"
          @contextmenu.prevent="confirmRemove(fq.id)"
        >
          <span class="hi-icon">★</span>
          <div class="hi-content">
            <div class="hi-text">
              {{ fq.question }}
            </div>
            <div class="hi-time">
              {{ (fq.tags || []).join(' · ') }}
            </div>
          </div>
          <span class="hi-arrow">›</span>
        </div>
      </div>
    </div>

    <div
      v-if="pendingRemoveId"
      class="confirm-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="确认取消收藏"
      @click.self="pendingRemoveId = null"
    >
      <div class="confirm-card">
        <p class="confirm-title">
          要取消收藏吗？
        </p>
        <p class="confirm-sub">
          {{ getQuestionText(pendingRemoveId) }}
        </p>
        <div class="confirm-actions">
          <button
            class="confirm-btn cancel"
            type="button"
            @click="pendingRemoveId = null"
          >
            再想想
          </button>
          <button
            class="confirm-btn ok"
            type="button"
            @click="doRemove()"
          >
            取消收藏
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="toastVisible"
      class="toast"
      role="status"
      aria-live="polite"
    >
      已取消收藏
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'
import { useContentStore } from '../stores/content'
import { categoryIcons } from '../utils/constants'
import RabbitFace from '../components/RabbitFace.vue'

const PRESS_DURATION = 500
const TOAST_DURATION = 1800

const contentStore = useContentStore()
const activeTab = ref('history')
const pressedId = ref(null)
const pressTimer = ref(null)
const pendingRemoveId = ref(null)
const toastVisible = ref(false)
const toastTimer = ref(null)

const historyByDate = computed(() => contentStore.historyByDate)
const hasHistory = computed(() => contentStore.viewHistory.length > 0)

function getCategoryIcon(category) {
  return categoryIcons[category] || '❓'
}

function getQuestionText(id) {
  const q = contentStore.getQuestionById(id)
  return q ? q.question : '未知问题'
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function startPress(id) {
  cancelPress()
  pressTimer.value = setTimeout(() => {
    pressedId.value = null
    confirmRemove(id)
  }, PRESS_DURATION)
  pressedId.value = id
}

function cancelPress() {
  if (pressTimer.value) {
    clearTimeout(pressTimer.value)
    pressTimer.value = null
  }
  pressedId.value = null
}

function confirmRemove(id) {
  cancelPress()
  pendingRemoveId.value = id
}

function doRemove() {
  const id = pendingRemoveId.value
  pendingRemoveId.value = null
  if (id && contentStore.isFavorite(id)) {
    contentStore.toggleFavorite(id)
    showToast()
  }
}

function showToast() {
  toastVisible.value = true
  if (toastTimer.value) clearTimeout(toastTimer.value)
  toastTimer.value = setTimeout(() => {
    toastVisible.value = false
  }, TOAST_DURATION)
}

onBeforeUnmount(() => {
  cancelPress()
  if (toastTimer.value) clearTimeout(toastTimer.value)
})
</script>

<style scoped>
.archive-page { padding-bottom: calc(var(--nav-height) + 16px); }

.archive-header {
  background: linear-gradient(135deg, #1A5C3A, #2E7D52);
  padding: 40px 24px 24px;
  color: #fff;
  border-radius: 0 0 24px 24px;
}
.archive-header h2 { font-size: 20px; font-weight: 700; }
.archive-header p { font-size: 13px; opacity: 0.8; margin-top: 4px; }

.tab-bar {
  display: flex;
  gap: 8px;
  padding: 16px 16px 0;
  border-bottom: 1px solid #f0f0f0;
}
.tab-item {
  flex: 1;
  padding: 10px 0;
  border: none;
  background: none;
  font-size: 14px;
  color: #767676;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
  font-family: inherit;
}
.tab-item.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
  font-weight: 600;
}
.tab-item:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
  border-radius: 4px;
}

.tab-panel { padding: 0 16px; }

.archive-stats {
  display: flex;
  gap: 12px;
  margin: 16px 0;
  padding: 16px;
  background: #f8fbf9;
  border-radius: 12px;
}
.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}
.stat-num { font-size: 22px; font-weight: 700; color: var(--color-primary); }
.stat-label { font-size: 11px; color: #767676; margin-top: 2px; }

.history-list { padding: 8px 0 16px; }
.date-group { margin-bottom: 20px; }
.date-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  padding: 0 4px;
}
.date-text { font-size: 14px; font-weight: 600; color: #333; }
.date-count { font-size: 11px; color: #767676; }

.history-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 0;
  border-bottom: 1px solid #f5f5f5;
  cursor: pointer;
  transition: background 0.2s, transform 0.2s;
}
.history-item:active { background: #f9f9f9; }
.history-item.item-pressed {
  background: #f0f8f4;
  transform: scale(0.98);
}
.hi-icon { font-size: 20px; flex-shrink: 0; }
.hi-content { flex: 1; min-width: 0; }
.hi-text {
  font-size: 14px; color: #333; font-weight: 500;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.hi-time { font-size: 11px; color: #767676; margin-top: 2px; }
.hi-arrow { font-size: 18px; color: #ccc; }

.empty-state { text-align: center; padding: 60px 24px; }
.empty-icon { font-size: 64px; margin-bottom: 16px; }
.empty-state p { font-size: 16px; color: #666; margin-bottom: 4px; }
.empty-state span { font-size: 13px; color: #767676; display: block; margin-bottom: 16px; }
.go-btn {
  padding: 10px 32px;
  border-radius: 20px;
  border: none;
  background: var(--color-primary);
  color: #fff;
  font-size: 14px;
  cursor: pointer;
}

.confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 0 32px;
}
.confirm-card {
  background: #fff;
  border-radius: 16px;
  padding: 24px 20px 16px;
  max-width: 320px;
  width: 100%;
  text-align: center;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
}
.confirm-title { font-size: 16px; font-weight: 600; color: #333; margin-bottom: 8px; }
.confirm-sub {
  font-size: 13px; color: #767676; margin-bottom: 20px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.confirm-actions { display: flex; gap: 12px; }
.confirm-btn {
  flex: 1;
  padding: 10px 0;
  border-radius: 12px;
  border: none;
  font-size: 14px;
  font-family: inherit;
  cursor: pointer;
}
.confirm-btn.cancel { background: #f5f5f5; color: #666; }
.confirm-btn.ok { background: var(--color-primary); color: #fff; }
.confirm-btn:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }

.toast {
  position: fixed;
  bottom: 96px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--color-primary);
  color: #fff;
  padding: 10px 24px;
  border-radius: 24px;
  font-size: 13px;
  z-index: 1001;
  box-shadow: 0 4px 16px rgba(26, 92, 58, 0.24);
  animation: toast-in 0.2s ease-out;
}
@keyframes toast-in {
  from { opacity: 0; transform: translate(-50%, 8px); }
  to { opacity: 1; transform: translate(-50%, 0); }
}
</style>
