import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'))

export default defineConfig({
  plugins: [vue()],
  root: 'src/h5',
  publicDir: resolve(__dirname, 'public'),
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/h5'),
      '@content': resolve(__dirname, 'content'),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
  build: {
    outDir: resolve(__dirname, 'dist/h5'),
    emptyOutDir: true,
  },
})
