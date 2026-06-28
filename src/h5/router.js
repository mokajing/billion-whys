import { createRouter, createWebHistory } from 'vue-router'
import { useAnalyticsStore } from './stores/analytics'

const routes = [
  {
    path: '/',
    name: 'discover',
    component: () => import('./pages/Discover.vue'),
  },
  {
    path: '/question/:id',
    name: 'question',
    component: () => import('./pages/QuestionDetail.vue'),
    meta: { hideNav: true },
  },
  {
    path: '/ask',
    name: 'ask',
    component: () => import('./pages/Ask.vue'),
  },
  {
    path: '/archive',
    name: 'archive',
    component: () => import('./pages/Archive.vue'),
  },
  {
    path: '/profile',
    name: 'profile',
    component: () => import('./pages/Profile.vue'),
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    redirect: '/',
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    return { top: 0 }
  },
})

export default router

router.afterEach((to) => {
  try {
    const analytics = useAnalyticsStore()
    analytics.trackPageView(to.path)
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[BillionWhys] analytics error:', err) // eslint-disable-line no-console
  }
})
