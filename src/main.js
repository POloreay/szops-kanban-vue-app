import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPersistedstate from 'pinia-plugin-persistedstate'

import App from './App.vue'
import router from './router'

import './styles/variables.scss'
import './styles/global.scss'

// Element Plus 改为按需引入（unplugin 自动解析）：
// - 模板组件（el-button/el-input 等）由 Components 插件自动注册
// - API（ElMessage/ElMessageBox）已由各组件显式 import，样式随用随载
const app = createApp(App)
const pinia = createPinia()
pinia.use(piniaPersistedstate)

app.use(pinia)
app.use(router)

app.mount('#app')
