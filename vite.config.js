import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  base: '/szops-kanban/',
  plugins: [vue()],
  server: {
    port: 5174,
    open: true
  },
  build: {
    outDir: 'dist'
  }
})
