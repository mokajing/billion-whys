<template>
  <nav
    class="bottom-nav"
    aria-label="主导航"
  >
    <router-link
      v-for="item in navItems"
      :key="item.path"
      :to="item.path"
      class="nav-item"
      exact-active-class="active"
      :aria-label="item.label"
    >
      <span
        class="nav-icon"
        aria-hidden="true"
      >{{ item.icon }}</span>
      <span class="nav-label">{{ item.label }}</span>
    </router-link>
  </nav>
</template>

<script setup>
const navItems = [
  { path: '/', icon: '🏠', label: '发现' },
  { path: '/ask', icon: '🔍', label: '问一问' },
  { path: '/archive', icon: '📊', label: '好奇档案' },
  { path: '/profile', icon: '👤', label: '我的' },
]
</script>

<style scoped>
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 390px;
  display: flex;
  justify-content: space-around;
  padding: 8px 0 calc(8px + env(safe-area-inset-bottom));
  background: #fff;
  border-top: 1px solid #f0f0f0;
  z-index: 100;
}
.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 12px;
  color: #767676;
  gap: 2px;
  text-decoration: none;
  transition: color 0.2s;
}
.nav-item.active { color: var(--color-primary); }
.nav-icon { font-size: 20px; }
.nav-label { font-size: 12px; }
</style>
