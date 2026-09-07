import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

export default defineConfig({
  base: '/szops-kanban-vue-app/',
  plugins: [
    vue(),
    // Element Plus 按需引入：API 自动导入（ElMessage 等）+ 组件模板自动按需解析
    AutoImport({
      resolvers: [ElementPlusResolver()],
      dts: 'src/auto-imports.d.ts'
    }),
    Components({
      resolvers: [ElementPlusResolver()],
      dts: 'src/components.d.ts'
    })
  ],
  server: {
    port: 5174,
    open: true
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1200
    // 按需引入后不再手动分包：EP 组件被打进各自使用它的视图 chunk，入口更小
  }
})
