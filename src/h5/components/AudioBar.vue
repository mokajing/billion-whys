<template>
  <div
    class="audio-bar"
    :class="{ playing: isPlaying }"
    role="button"
    tabindex="0"
    :aria-label="isPlaying ? '暂停播放' : '播放语音解释'"
    :aria-pressed="isPlaying"
    @click="togglePlay"
    @keydown.enter.prevent="togglePlay"
    @keydown.space.prevent="togglePlay"
  >
    <div class="audio-btn">
      {{ isPlaying ? '⏸' : '▶' }}
    </div>
    <div class="audio-info">
      <div class="audio-label">
        {{ isPlaying ? '播放中...' : '听听为什么' }}
      </div>
      <div
        class="audio-duration"
        aria-live="polite"
      >
        {{ statusText }}
      </div>
    </div>
    <div class="audio-wave">
      <span
        v-for="i in 5"
        :key="i"
        :style="{ animationDelay: `${i * 0.1}s`, height: `${6 + (i % 3) * 4}px` }"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { TTS_PITCH, TTS_RATE, TTS_LANG, TTS_MAX_LENGTH } from '../utils/constants'

const props = defineProps({
  layer: { type: Number, required: true },
  text: { type: String, required: true },
})

const isPlaying = ref(false)
const statusText = ref('点击播放')
let utterance = null
let zhVoiceCache = null
let playTimeout = null
let unmounted = false

const MAX_TTS_LENGTH = TTS_MAX_LENGTH

watch(() => props.text, () => {
  if (isPlaying.value) {
    clearTimeout(playTimeout)
    if ('speechSynthesis' in window) speechSynthesis.cancel()
    isPlaying.value = false
    statusText.value = '点击播放'
  }
})

function findZhVoice() {
  const voices = speechSynthesis.getVoices()
  zhVoiceCache = voices.find(v => v.lang.startsWith('zh')) || null
}

async function togglePlay() {
  if (!('speechSynthesis' in window)) {
    statusText.value = '浏览器不支持语音'
    return
  }

  if (isPlaying.value) {
    clearTimeout(playTimeout)
    speechSynthesis.cancel()
    isPlaying.value = false
    statusText.value = '再听一次'
    return
  }

  const text = props.text.slice(0, MAX_TTS_LENGTH)

  if (utterance) {
    utterance.onend = null
    utterance.onerror = null
  }
  speechSynthesis.cancel()
  utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = TTS_LANG
  utterance.rate = TTS_RATE
  utterance.pitch = TTS_PITCH

  if (!zhVoiceCache) findZhVoice()
  if (zhVoiceCache) {
    utterance.voice = zhVoiceCache
  } else if (speechSynthesis.getVoices().length === 0) {
    statusText.value = '语音加载中...'
    const waitForVoices = new Promise(resolve => {
      let settled = false
      const onVoices = () => {
        if (settled) return
        settled = true
        speechSynthesis.removeEventListener('voiceschanged', onVoices)
        findZhVoice()
        resolve()
      }
      speechSynthesis.addEventListener('voiceschanged', onVoices)
      setTimeout(() => {
        if (settled) return
        settled = true
        speechSynthesis.removeEventListener('voiceschanged', onVoices)
        resolve()
      }, 1500)
    })
    await waitForVoices
    if (unmounted) return
    if (zhVoiceCache) utterance.voice = zhVoiceCache
    statusText.value = '播放中...'
  }

  utterance.onend = () => {
    clearTimeout(playTimeout)
    isPlaying.value = false
    statusText.value = '再听一次'
  }

  utterance.onerror = (e) => {
    clearTimeout(playTimeout)
    isPlaying.value = false
    if (e && e.error === 'canceled') {
      statusText.value = '再听一次'
    } else {
      statusText.value = '播放失败，点击重试'
    }
  }

  isPlaying.value = true
  statusText.value = '播放中...'
  speechSynthesis.speak(utterance)

  const dynamicTimeout = Math.min(Math.max(text.length * 350 + 3000, 8000), 45000)
  playTimeout = setTimeout(() => {
    if (isPlaying.value) {
      speechSynthesis.cancel()
      isPlaying.value = false
      statusText.value = '播放失败，点击重试'
    }
  }, dynamicTimeout)
}

function handleVisibilityChange() {
  if (document.hidden && isPlaying.value) {
    speechSynthesis.cancel()
    isPlaying.value = false
    statusText.value = '再听一次'
  }
}

onMounted(() => {
  document.addEventListener('visibilitychange', handleVisibilityChange)
  if ('speechSynthesis' in window) {
    speechSynthesis.addEventListener('voiceschanged', findZhVoice)
    findZhVoice()
  }
})

onBeforeUnmount(() => {
  unmounted = true
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  if ('speechSynthesis' in window) {
    speechSynthesis.removeEventListener('voiceschanged', findZhVoice)
  }
  if (utterance) {
    utterance.onend = null
    utterance.onerror = null
  }
  clearTimeout(playTimeout)
  if (isPlaying.value) {
    if ('speechSynthesis' in window) speechSynthesis.cancel()
    isPlaying.value = false
  }
  utterance = null
})
</script>

<style scoped>
.audio-bar {
  margin: 12px 14px 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: var(--radius-button);
  cursor: pointer;
  transition: all 0.2s;
  background: rgba(0,0,0,0.04);
}
.audio-bar:active { transform: scale(0.97); }
.audio-btn {
  width: 36px; height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
  background: var(--color-primary);
  color: #fff;
}
.audio-info { flex: 1; }
.audio-label { font-size: 13px; font-weight: 600; color: #333; }
.audio-duration { font-size: 11px; color: #767676; margin-top: 2px; }
.audio-wave {
  display: flex;
  align-items: center;
  gap: 2px;
  height: 20px;
}
.audio-wave span {
  width: 3px;
  background: #999;
  border-radius: 2px;
  animation: wave 1s ease-in-out infinite;
  animation-play-state: paused;
}
.playing .audio-wave span { animation-play-state: running; }
@keyframes wave {
  0%, 100% { transform: scaleY(1); }
  50% { transform: scaleY(1.8); }
}
</style>
