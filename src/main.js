import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPersistedstate from 'pinia-plugin-persistedstate'

import App from './App.vue'
import router from './router'

import './styles/variables.scss'
import './styles/global.scss'

// Element Plus JS API（ElMessage / ElMessageBox）样式需手动引入：
// unplugin 按需引入只对「模板组件」自动注入样式，JS API 显式 import 不会带样式，
// 缺失时弹窗会渲染成无样式的全宽块掉在页面底部（修复确认弹窗显示异常）
import 'element-plus/es/components/message/style/css'
import 'element-plus/es/components/message-box/style/css'

const app = createApp(App)
const pinia = createPinia()
pinia.use(piniaPersistedstate)

app.use(pinia)
app.use(router)

app.mount('#app')
