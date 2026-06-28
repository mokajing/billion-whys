<template>
  <div class="app-container">
    <router-view />
    <BottomNav v-if="showNav" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import BottomNav from './components/BottomNav.vue'

const route = useRoute()
const showNav = computed(() => !route.meta.hideNav)
</script>

<style scoped>
.app-container {
  max-width: 390px;
  margin: 0 auto;
  min-height: 100vh;
  background: #fff;
  position: relative;
  overflow-x: hidden;
}
</style>
