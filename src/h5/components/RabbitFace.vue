<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 48 48"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    :aria-label="ariaLabel || '问问兔'"
    :aria-hidden="ariaLabel ? 'false' : 'true'"
    class="rabbit-face"
    :class="[`rabbit-face--${mood}`]"
  >
    <!-- 前倾的兔耳（好奇姿态，非直立惊吓） -->
    <path
      d="M16 4 C 14 4 13 6 13.5 9 L 16 22 C 16.5 24 19.5 24 20 22 L 22.5 9 C 23 6 22 4 20 4 Z"
      :fill="earColor"
    />
    <path
      d="M28 4 C 26 4 25 6 25.5 9 L 28 22 C 28.5 24 31.5 24 32 22 L 34.5 9 C 35 6 34 4 32 4 Z"
      :fill="earColor"
    />
    <!-- 内耳粉色阴影 -->
    <path
      d="M17 7 C 16.5 7 16 8 16.3 10 L 17.5 19 C 17.8 20 19.2 20 19.5 19 L 20.7 10 C 21 8 20.5 7 20 7 Z"
      fill="#F5B7C8"
    />
    <path
      d="M29 7 C 28.5 7 28 8 28.3 10 L 29.5 19 C 29.8 20 31.2 20 31.5 19 L 32.7 10 C 33 8 32.5 7 32 7 Z"
      fill="#F5B7C8"
    />
    <!-- 圆脸（中性好奇表情，无嘴角细节） -->
    <circle
      cx="24"
      cy="28"
      r="14"
      :fill="faceColor"
    />
    <!-- 腮红：仅 bowing 态显示（V8.0 第69轮，彩虹姐+墨小暖联合建议） -->
    <circle
      v-if="mood === 'bowing'"
      cx="17"
      cy="31"
      r="2.2"
      fill="#FFC4B8"
      opacity="1"
    />
    <circle
      v-if="mood === 'bowing'"
      cx="31"
      cy="31"
      r="2.2"
      fill="#FFC4B8"
      opacity="1"
    />
    <!-- 圆眼（黑色，无情绪偏向） -->
    <circle
      cx="19"
      cy="27"
      r="1.8"
      fill="#2B2B2B"
    />
    <circle
      cx="29"
      cy="27"
      r="1.8"
      fill="#2B2B2B"
    />
    <!-- 鼻子（小三角粉色，仅装饰） -->
    <path
      d="M23 32 L 24 33.5 L 25 32 Z"
      fill="#E89AAB"
    />
  </svg>
</template>

<script setup>
// V8.0 第69轮：新增 mood="bowing" 状态，用于答案反馈后的感谢动效
// Why: V7.9 反馈感谢仅一行静态文字+🌟，妈妈情感回馈不足；鞠躬是东亚通用感谢肢体语言
// 心理学家周教授要求总时长≤0.8s（0.5s鞠躬+0.3s回弹）；墨小暖要求鞠躬时耳朵前垂、眼睛保持弯月
defineProps({
  size: {
    type: Number,
    default: 32,
    validator: v => [16, 20, 24, 32, 40, 48, 64].includes(v),
  },
  ariaLabel: {
    type: String,
    default: '',
  },
  faceColor: {
    type: String,
    default: '#FFFFFF',
  },
  earColor: {
    type: String,
    default: '#FFFFFF',
  },
  mood: {
    type: String,
    default: 'default',
    validator: v => ['default', 'bowing'].includes(v),
  },
})
</script>

<style scoped>
.rabbit-face {
  display: inline-block;
  vertical-align: middle;
  flex-shrink: 0;
  transform-origin: 24px 38px;
}

/* 鞠躬动效：0.5s 前倾 + 0.3s 回弹，总 0.8s（心理学家周教授要求） */
.rabbit-face--bowing {
  animation: rabbit-bow 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

@keyframes rabbit-bow {
  0% {
    transform: rotate(0deg);
  }
  62.5% {
    /* 0.5s 到达鞠躬峰值 ~15deg */
    transform: rotate(15deg);
  }
  100% {
    /* 0.3s 回弹到默认 */
    transform: rotate(0deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  /* UX总监苏体验要求：动效降级为静态鞠躬 pose，避免引发前庭不适 */
  .rabbit-face--bowing {
    animation: none;
    transform: rotate(15deg);
  }
}
</style>
