<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 48 48"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    :aria-label="ariaLabel || '答答熊'"
    :aria-hidden="ariaLabel ? 'false' : 'true'"
    class="bear-face"
  >
    <!-- 圆润小耳（稳重姿态,非尖耸） -->
    <circle
      cx="13"
      cy="13"
      r="6"
      :fill="earColor"
    />
    <circle
      cy="13"
      cx="35"
      r="6"
      :fill="earColor"
    />
    <!-- 内耳浅色阴影 -->
    <circle
      cx="13"
      cy="14"
      r="3"
      fill="#E8C8A0"
    />
    <circle
      cx="35"
      cy="14"
      r="3"
      fill="#E8C8A0"
    />
    <!-- 圆脸（温暖棕色,知识引导者气质） -->
    <circle
      cx="24"
      cy="28"
      r="14"
      :fill="faceColor"
    />
    <!-- 浅色口鼻区（区分于问问兔的纯圆脸） -->
    <ellipse
      cx="24"
      cy="33"
      rx="7"
      ry="5"
      fill="#EFD9B8"
    />
    <!-- 圆眼（黑色,温和稳定无情绪偏向） -->
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
    <!-- 鼻子（深棕椭圆,比兔鼻略大表达稳重） -->
    <ellipse
      cx="24"
      cy="31"
      rx="1.6"
      ry="1.2"
      fill="#5A3D2A"
    />
  </svg>
</template>

<script setup>
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
    default: '#C8A47C',
  },
  earColor: {
    type: String,
    default: '#8B6244',
  },
})
</script>

<style scoped>
.bear-face {
  display: inline-block;
  vertical-align: middle;
  flex-shrink: 0;
}
</style>
