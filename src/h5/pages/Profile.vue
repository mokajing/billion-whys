<template>
  <div class="profile-page">
    <div class="profile-header">
      <div class="avatar">
        <RabbitFace :size="48" />
      </div>
      <h3>小探险家的好奇世界</h3>
    </div>
    <div
      class="stats"
      role="region"
      aria-label="探索统计"
    >
      <div class="stat-item">
        <div class="stat-num">
          {{ contentStore.viewedCount }}
        </div>
        <div class="stat-label">
          已探索问题
        </div>
      </div>
      <div class="stat-item">
        <div class="stat-num">
          {{ contentStore.todayViewedCount }}
        </div>
        <div class="stat-label">
          今日提问
        </div>
      </div>
      <div class="stat-item">
        <div class="stat-num">
          {{ contentStore.streakDays }}
        </div>
        <div class="stat-label">
          连续天数
        </div>
      </div>
    </div>
    <div
      v-if="streakMessage"
      class="streak-message"
    >
      {{ streakMessage }}
    </div>

    <div
      class="feedback-trend"
      role="region"
      aria-label="过去7天反馈趋势"
    >
      <div class="ft-header">
        <span class="ft-title">过去7天反馈了 {{ feedbackTrendTotal }} 次</span>
        <span class="ft-legend">
          <span class="ft-leg ft-leg-up">👍</span>
          <span class="ft-leg ft-leg-down">👎</span>
          <span class="ft-leg ft-leg-reset">↻</span>
        </span>
      </div>
      <div
        v-if="feedbackTrendTotal > 0"
        class="ft-bars-wrap"
      >
        <div
          class="ft-bars"
          role="img"
          :aria-label="`过去7天反馈了 ${feedbackTrendTotal} 次`"
        >
          <div
            v-for="day in feedbackTrend7d"
            :key="day.date"
            class="ft-bar-col"
            :class="{ 'ft-bar-col-expanded': expandedDay === day.date }"
            role="button"
            tabindex="0"
            :aria-expanded="expandedDay === day.date"
            :aria-label="`${dayLabel(day.date)} · 反馈 ${day.total} 次${day.total === 0 ? '' : '，点击查看明细'}`"
            @click="toggleDay(day.date, day.total)"
            @keydown.enter.prevent="toggleDay(day.date, day.total)"
            @keydown.space.prevent="toggleDay(day.date, day.total)"
          >
            <div class="ft-bar-stack">
              <div
                class="ft-bar ft-bar-up"
                :style="{ height: barHeight(day.up) }"
              />
              <div
                class="ft-bar ft-bar-down"
                :style="{ height: barHeight(day.down) }"
              />
              <div
                class="ft-bar ft-bar-reset"
                :style="{ height: barHeight(day.reset) }"
              />
            </div>
            <div class="ft-bar-label">
              {{ dayLabel(day.date) }}
            </div>
          </div>
        </div>
        <!-- V8.5 Sprint 14：当日明细（accordion 模式，同时只展开 1 列；测试虫虫要求避免移动端滚动地狱） -->
        <div
          v-if="expandedDay"
          class="ft-detail"
          role="region"
          :aria-label="`${expandedDay} 反馈明细`"
        >
          <div class="ft-detail-header">
            {{ detailHeader }}
          </div>
          <div
            v-if="detailList.length > 0"
            class="ft-detail-list"
          >
            <div
              v-for="(item, idx) in detailList"
              :key="expandedDay + '-' + idx"
              class="ft-detail-item"
              :class="{
                'ft-detail-item-clickable': item.id,
                'ft-detail-item-disabled': !item.id,
              }"
              :role="item.id ? 'button' : null"
              :tabindex="item.id ? 0 : null"
              :aria-label="item.id ? `再读一遍：${item.title}` : null"
              @click="onReplayDetail(item)"
              @keydown.enter.prevent="onReplayDetail(item)"
              @keydown.space.prevent="onReplayDetail(item)"
            >
              <span
                class="ft-detail-icon"
                :class="`ft-detail-icon-${item.action}`"
              >{{ actionIcon(item.action) }}</span>
              <span class="ft-detail-time">{{ formatTime(item.ts) }}</span>
              <span
                v-if="item.depth && item.depth > 1"
                class="ft-detail-depth"
                :aria-label="`读到第${item.depth}层`"
              >读到第{{ item.depth }}层</span>
              <span class="ft-detail-title">
                {{ item.title || '已反馈（记录已迁移）' }}
              </span>
            </div>
          </div>
          <div
            v-else
            class="ft-detail-empty"
          >
            🌱 这天没有反馈明细
          </div>
        </div>
      </div>
      <div
        v-else
        class="ft-empty"
      >
        🌱 这周还没有反馈，看完一个答案试试 👍 或 👎 吧
      </div>
    </div>

    <div class="archive-link-section">
      <button
        class="archive-link"
        @click="$router.push('/archive')"
      >
        <span class="al-left">
          <span class="al-icon">📊</span>
          <span>查看好奇档案</span>
        </span>
        <span class="al-right">
          <span class="al-stats">已探索 {{ contentStore.viewedCount }} · 收藏 {{ contentStore.favoriteCount }} · 反馈 {{ contentStore.feedbackCount }}</span>
          <span class="al-arrow">›</span>
        </span>
      </button>
    </div>
    <div class="menu-list">
      <div
        class="menu-item"
        role="button"
        tabindex="0"
        :aria-expanded="showPrivacy"
        aria-controls="privacy-panel"
        @click="showPrivacy = !showPrivacy"
        @keydown.enter.prevent="showPrivacy = !showPrivacy"
        @keydown.space.prevent="showPrivacy = !showPrivacy"
      >
        🔒 隐私政策与用户协议 <span
          class="arrow"
          :class="{ open: showPrivacy }"
        >▼</span>
      </div>
      <div
        v-if="showPrivacy"
        id="privacy-panel"
        class="privacy-text"
      >
        <h4>隐私政策</h4>
        <p>本应用严格遵守《儿童个人信息网络保护规定》，承诺如下：</p>
        <p>1. <b>零数据收集</b>：不收集任何儿童或家长的个人信息（包括姓名、照片、位置等）。</p>
        <p>2. <b>本地存储</b>：浏览记录仅以匿名形式存储在您设备本地（localStorage），不会上传至任何服务器。</p>
        <p>3. <b>无第三方共享</b>：不向任何第三方传输、共享或出售用户数据。</p>
        <p>4. <b>无广告追踪</b>：不使用任何广告追踪或用户画像技术。</p>
        <p>5. <b>本地统计</b>：仅在设备本地记录匿名页面访问次数与反馈行动次数（👍/👎/↻ 重置），不会上传至任何服务器。</p>
        <h4>用户协议</h4>
        <p>本应用提供的科普内容经过专业审核，但仅供参考和亲子互动使用，不构成医学或专业建议。所有互动实验请在大人陪伴下进行。</p>
        <p>如有任何问题，请通过下方"意见反馈"联系我们。</p>
      </div>
      <div
        class="menu-item"
        role="button"
        tabindex="0"
        :aria-expanded="showFeedback"
        aria-controls="feedback-panel"
        @click="showFeedback = !showFeedback"
        @keydown.enter.prevent="showFeedback = !showFeedback"
        @keydown.space.prevent="showFeedback = !showFeedback"
      >
        💬 意见反馈 <span
          class="arrow"
          :class="{ open: showFeedback }"
        >▼</span>
      </div>
      <div
        v-if="showFeedback"
        id="feedback-panel"
        class="privacy-text"
      >
        <p>感谢您使用「十亿个什么与为什么」！如有任何建议或问题，欢迎联系我们：</p>
        <p>📮 反馈邮箱：feedback@billionwhys.com</p>
        <p>您的每一条建议都会帮助我们做得更好 🌱</p>
      </div>
    </div>
    <div class="version-footer">
      v{{ version }} · 十亿个什么与为什么
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useContentStore } from '../stores/content'
import { useAnalyticsStore } from '../stores/analytics'
import RabbitFace from '../components/RabbitFace.vue'
const version = __APP_VERSION__
const contentStore = useContentStore()
const analyticsStore = useAnalyticsStore()
const router = useRouter()
const showPrivacy = ref(false)
const showFeedback = ref(false)

const feedbackTrend7d = computed(() => contentStore.feedbackTrend7d)
const feedbackTrendTotal = computed(() =>
  feedbackTrend7d.value.reduce((s, d) => s + d.total, 0)
)

// V8.5 Sprint 14：当日明细 accordion — 同时只展开 1 列（CEO 裁决避免移动端滚动地狱）
const expandedDay = ref('')

function toggleDay(dateStr, total) {
  if (total === 0) return // 空列不展开（UX 苏体验：避免空状态明细抢镜）
  expandedDay.value = expandedDay.value === dateStr ? '' : dateStr
}

const detailList = computed(() =>
  expandedDay.value ? contentStore.feedbackDetailByDate(expandedDay.value) : []
)

// V8.8 第76轮 Sprint 17：detailHeader 也用本地午夜解析（与 dayLabel/MP 同源）
// Why: new Date('YYYY-MM-DD') 按 ECMAScript 规范解析为 UTC，UTC-5 时区会让 header 显示成前一天
// 与 V8.5→V8.7 修复的 feedbackTrend7d 同类回归 bug，必须同步收口
const detailHeader = computed(() => {
  if (!expandedDay.value) return ''
  const d = new Date(expandedDay.value + 'T00:00:00')
  if (isNaN(d.getTime())) return ''
  const weekday = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
  const up = detailList.value.filter(x => x.action === 'up').length
  const down = detailList.value.filter(x => x.action === 'down').length
  const reset = detailList.value.filter(x => x.action === 'reset').length
  // CCO 文若水：≤1 行中性文案；心理学家周教授：reset 用"再评一次"避免评判
  const parts = []
  if (up) parts.push(`👍${up}`)
  if (down) parts.push(`👎${down}`)
  if (reset) parts.push(`再评${reset}`)
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日 周${weekday} · ${parts.join(' · ') || '无反馈'}`
})

function actionIcon(action) {
  if (action === 'up') return '👍'
  if (action === 'down') return '👎'
  if (action === 'reset') return '↻'
  return ''
}

function formatTime(ts) {
  const d = new Date(ts)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

// V8.6 Sprint 15：当日明细列表项整行可点击→跳转 QuestionDetail "再读一遍"
// Why: 北极星漏斗最后 1 步闭环（CEO周远见）：查看趋势→点开当日→看到具体问题→回想亲子对话→再读一遍→下次再来
// 无 id 的老 entry 不跳转（UX 苏体验：避免 cursor pointer 误导；CCO：文案保留"已反馈（记录已迁移）"）
function onReplayDetail(item) {
  if (!item || !item.id) return
  // COO 林实干：埋点 feedback_detail_replay 量化"回流率"
  analyticsStore.trackEvent('feedback_detail_replay', item.id)
  // UX 苏体验：跳转不收起 accordion，回来还在原位
  router.push({ name: 'question', params: { id: item.id } })
}

// 彩虹姐：bar 最大高度 24px，单日最大值映射到 24px，按比例缩放
const MAX_BAR_PX = 24
function barHeight(count) {
  if (!count) return '0px'
  const maxDay = Math.max(1, ...feedbackTrend7d.value.map(d => Math.max(d.up, d.down, d.reset)))
  const h = Math.max(2, Math.round((count / maxDay) * MAX_BAR_PX))
  return h + 'px'
}

function dayLabel(dateStr) {
  // 显示 周几（今天/昨天特殊处理）
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr + 'T00:00:00')
  const diff = Math.round((today - d) / 86400000)
  if (diff === 0) return '今天'
  if (diff === 1) return '昨天'
  return ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
}

const streakMessage = computed(() => {
  const s = contentStore.streakDays
  if (s === 0 && contentStore.viewedCount > 0) return '欢迎回来！问问兔一直在等你哦'
  if (s === 0 && contentStore.viewedCount === 0) return '你好呀！一起开始好奇心探索吧！'
  if (s === 0) return ''
  if (s >= 30) return '🏆 连续探索30天！你是超级小探险家！'
  if (s >= 7) return '🌟 连续探索一周了，好奇心满满！'
  if (s >= 3) return '✨ 连续探索3天，继续加油！'
  if (s >= 1) return '🌱 今天也来探索了，真棒！'
  return ''
})
</script>

<style scoped>
.profile-page { padding: 40px 24px calc(var(--nav-height) + 24px); }
.profile-header { text-align: center; }
.avatar {
  width: 64px; height: 64px;
  margin: 0 auto 8px;
  border-radius: 50%;
  background: #E8F5E9;
  display: flex; align-items: center; justify-content: center;
  font-size: 32px;
}
.profile-header h3 { font-size: 18px; color: #333; }
.stats {
  display: flex;
  justify-content: space-around;
  margin: 24px 0;
  padding: 16px;
  background: #f9f9f9;
  border-radius: 16px;
}
.stat-item { text-align: center; }
.stat-num { font-size: 24px; font-weight: 700; color: var(--color-primary); }
.stat-label { font-size: 11px; color: #767676; margin-top: 2px; }
.streak-message {
  text-align: center;
  font-size: 13px;
  color: #C45000;
  font-weight: 500;
  padding: 8px 16px;
  background: #FFF8E1;
  border-radius: 12px;
  margin-bottom: 16px;
}
.feedback-trend {
  margin: 0 0 16px;
  padding: 16px;
  background: #FAFAFA;
  border-radius: 14px;
}
.ft-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.ft-title { font-size: 13px; font-weight: 600; color: #333; }
.ft-legend { display: flex; gap: 10px; font-size: 11px; color: #767676; }
.ft-leg { display: inline-flex; align-items: center; }
.ft-bars {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 4px;
  height: 48px;
}
.ft-bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; }
.ft-bar-stack {
  height: 24px;
  display: flex;
  flex-direction: column-reverse;
  align-items: stretch;
  justify-content: flex-start;
  width: 60%;
  max-width: 24px;
}
.ft-bar { width: 100%; border-radius: 2px; }
.ft-bar-up { background: #4CAF50; }
.ft-bar-down { background: #FF7043; }
.ft-bar-reset { background: #BDBDBD; }
.ft-bar-label { font-size: 9px; color: #999; }
.ft-bar-col {
  cursor: pointer;
  border-radius: 4px;
  padding: 2px 0;
  min-height: 44px; /* V8.5 Sprint 14：WCAG 2.2 触摸目标 */
}
.ft-bar-col:focus-visible {
  outline: 2px solid #4CAF50;
  outline-offset: 2px;
}
.ft-bar-col-expanded {
  background: #FFF3E0;
}
/* V8.5 Sprint 14：当日明细 */
.ft-bars-wrap { display: flex; flex-direction: column; gap: 12px; }
.ft-detail {
  background: #FAFAFA;
  border-radius: 10px;
  padding: 10px 12px;
}
.ft-detail-header {
  font-size: 11px;
  color: #555;
  margin-bottom: 8px;
  font-weight: 500;
}
.ft-detail-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ft-detail-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: #333;
  padding: 4px 0;
  border-bottom: 1px solid #F0F0F0;
}
.ft-detail-item:last-child { border-bottom: none; }
/* V8.6 Sprint 15：整行可点击（UX 苏体验：48px 触摸目标 + 焦点可见） */
.ft-detail-item-clickable {
  cursor: pointer;
  min-height: 48px;
  padding: 8px 4px;
  border-radius: 6px;
  transition: background-color 0.15s;
}
.ft-detail-item-clickable:hover {
  background-color: #F5F5F5;
}
.ft-detail-item-clickable:focus-visible {
  outline: 3px solid #4CAF50;
  outline-offset: 2px;
}
.ft-detail-item-disabled {
  cursor: default;
}
.ft-detail-icon { font-size: 12px; flex-shrink: 0; }
.ft-detail-icon-up { color: #4CAF50; }
.ft-detail-icon-down { color: #FF7043; }
.ft-detail-icon-reset { color: #BDBDBD; }
.ft-detail-time {
  color: #999;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
  min-width: 36px;
}
/* V8.9 Sprint 18：深度徽章 — 仅 depth>1 显示（depth=1 是默认不显示，避免噪声） */
.ft-detail-depth {
  background: #E8F5E9;
  color: #2E7D32;
  border-radius: 8px;
  padding: 1px 6px;
  font-size: 10px;
  flex-shrink: 0;
  white-space: nowrap;
}
.ft-detail-title {
  color: #333;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ft-detail-empty {
  font-size: 11px;
  color: #999;
  text-align: center;
  padding: 8px 0;
}
.ft-empty {
  font-size: 12px;
  color: #999;
  text-align: center;
  padding: 12px 0 4px;
}
.archive-link-section { margin-bottom: 16px; padding: 0 4px; }
.archive-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 14px 16px;
  border: 1px solid #e0f0e8;
  border-radius: 12px;
  background: #f8fbf9;
  cursor: pointer;
  font-family: inherit;
  font-size: 14px;
}
.archive-link:active { background: #f0f8f4; }
.archive-link:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
.al-left { display: flex; align-items: center; gap: 8px; color: #333; font-weight: 500; }
.al-icon { font-size: 18px; }
.al-right { display: flex; align-items: center; gap: 8px; }
.al-stats { font-size: 11px; color: #767676; }
.al-arrow { color: #ccc; font-size: 18px; }
.menu-list { margin-top: 16px; }
.menu-item {
  padding: 14px 0;
  border-bottom: 1px solid #f0f0f0;
  font-size: 14px;
  color: #333;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.arrow { font-size: 12px; color: #999; transition: transform 0.3s; }
.arrow.open { transform: rotate(180deg); }
.privacy-text {
  padding: 12px 16px;
  margin-bottom: 8px;
  font-size: 12px;
  line-height: 1.8;
  color: #666;
  background: #f9f9f9;
  border-radius: 10px;
}
.privacy-text h4 {
  font-size: 13px;
  color: #333;
  margin: 8px 0 4px;
}
.privacy-text h4:first-child { margin-top: 0; }
.privacy-text p { margin: 4px 0; }
.version-footer {
  text-align: center;
  margin-top: 32px;
  padding: 16px 0;
  font-size: 11px;
  color: #767676;
}
</style>
