import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './styles/global.css'

import { useContentStore } from './stores/content'

const app = createApp(App)
app.use(createPinia())
app.use(router)

app.config.errorHandler = (err, instance, info) => {
  console.error(`[BillionWhys] ${info}:`, err) // eslint-disable-line no-console
}

useContentStore().init().catch(err => {
  console.error('[BillionWhys] init error:', err) // eslint-disable-line no-console
})
app.mount('#app')
