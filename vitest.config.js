import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/h5'),
      '@content': resolve(__dirname, 'content'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    root: '.',
    coverage: {
      provider: 'v8',
      include: ['src/h5/stores/**'],
      reporter: ['text', 'json-summary'],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
})
