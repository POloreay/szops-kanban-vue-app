import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  base: '/szops-kanban-vue-app/',
  plugins: [vue()],
  server: {
    port: 5174,
    open: true
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          'element-plus': ['element-plus'],
          'element-icons': ['@element-plus/icons-vue'],
          'vue-vendor': ['vue', 'vue-router', 'pinia', 'pinia-plugin-persistedstate']
        }
      }
    }
  }
})
