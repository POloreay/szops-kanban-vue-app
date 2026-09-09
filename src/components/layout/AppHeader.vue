<template>
  <header class="topbar">
    <div class="topbar-title">
      <h1>{{ pageTitle }}</h1>
      <span class="breadcrumb">数智运营 / {{ pageTitle }}</span>
    </div>
    <div class="topbar-actions">
      <div class="search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input type="search" v-model="searchQuery" placeholder="搜索项目、任务…" aria-label="全局搜索" />
      </div>
      <button v-if="userStore.currentUser" class="btn btn-secondary" @click="handleSync" :disabled="syncing">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" :class="{ 'spin-anim': syncing }">
          <path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-6.4-2.6L3 21M3 12a9 9 0 0 1 9-9 9 9 0 0 1 6.4 2.6L21 3M3 21v-5h5M21 3v5h-5" />
        </svg>
        {{ syncing ? '同步中…' : '云同步' }}
      </button>
      <button v-else class="btn btn-primary" @click="showLogin = true">登录</button>
      <template v-if="userStore.currentUser">
        <el-button size="small" text @click="handleLogout">退出</el-button>
      </template>
    </div>
  </header>

  <!-- 登录：旗舰分屏（方案 B） -->
  <Teleport to="body">
    <transition name="login-fade">
      <div v-if="showLogin" class="login-mask" @click.self="showLogin = false">
        <div class="b-wrap">
          <button class="b-close" type="button" aria-label="关闭登录" @click="showLogin = false">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>

          <!-- 左：品牌叙事区 -->
          <div class="b-left">
            <div class="b-brandline">
              <span class="logo">数</span>
              <span>数智运营看板 · DIGITAL OPERATIONS</span>
            </div>
            <div class="b-hero">
              <div class="b-hello">无敌牛马，<br />欢迎回来！</div>
              <div class="b-sub">
                鞍已备好，粮草已足 —— 每一铲都算数。<br />
                今日份数字粮草已装车，请查收。
              </div>
            </div>
            <div class="b-stats">
              <div class="b-stat"><div class="v">80</div><div class="l">在管项目</div></div>
              <div class="b-stat"><div class="v">31,211<span class="unit">万</span></div><div class="l">合同总额</div></div>
              <div class="b-stat"><div class="v">98%</div><div class="l">按期交付</div></div>
            </div>
          </div>

          <!-- 右：登录表单区 -->
          <div class="b-right">
            <h3>登录</h3>
            <div class="b-tip">请登录账号，开工前请系好安全带</div>
            <input
              v-model="loginForm.username"
              class="b-in"
              type="text"
              placeholder="用户名"
              autocomplete="username"
              @keyup.enter="handleLogin"
            />
            <input
              v-model="loginForm.password"
              class="b-in"
              type="password"
              placeholder="密码"
              autocomplete="current-password"
              @keyup.enter="handleLogin"
            />
            <button class="b-btn" type="button" :disabled="loading" @click="handleLogin">{{ loading ? '登录中…' : '开工' }}</button>
            <div v-if="loginError" class="b-err">{{ loginError }}</div>
            <div class="b-foot">我能抗住什么责任，我是个溜肩啊......</div>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '../../stores/userStore'
import { useLogStore } from '../../stores/logStore'
import { useTaskStore } from '../../stores/taskStore'

defineEmits(['toggle'])

const route = useRoute()
const userStore = useUserStore()
const logStore = useLogStore()
const taskStore = useTaskStore()

const showLogin = ref(false)
const loginForm = ref({ username: '', password: '' })
const searchQuery = ref('')
const syncing = ref(false)

const titleMap = {
  '/dashboard': '仪表盘总览',
  '/kanban': '项目管理',
  '/kanban/pre': '前期阶段',
  '/kanban/procurement': '采购阶段',
  '/kanban/implementation': '实施阶段',
  '/kanban/closed': '已关闭项目',
  '/bid': '投标总览',
  '/revenue': '收入管理',
  '/cost': '成本管理',
  '/budget': '预算管理',
  '/todo': '个人待办',
  '/users': '用户管理'
}

const pageTitle = computed(() => titleMap[route.path] || '数智运营看板')

// 打开登录时清空表单并锁定背景滚动
watch(showLogin, (v) => {
  if (v) {
    loginForm.value = { username: '', password: '' }
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }
})

const loading = ref(false)
const loginError = ref('')

async function handleLogin() {
  loginError.value = ''
  if (!loginForm.value.username || !loginForm.value.password) {
    loginError.value = '请输入用户名和密码'
    return
  }
  loading.value = true
  try {
    const ok = await userStore.login(loginForm.value.username, loginForm.value.password)
    if (ok) {
      showLogin.value = false
      logStore.addLog('登录', '用户 ' + userStore.currentUser.username + ' 登录系统', userStore.currentUser.username)
      userStore.resumePending()
    } else {
      loginError.value = '用户名或密码错误'
    }
  } catch (e) {
    loginError.value = e.message || '登录失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

async function handleLogout() {
  logStore.addLog('退出', '用户 ' + userStore.currentUser.username + ' 退出系统', userStore.currentUser.username)
  await userStore.logout()
  ElMessage.success('已退出登录')
}

async function handleSync() {
  syncing.value = true
  try {
    await taskStore.cloudLoadTasks()
    ElMessage.success('云端同步完成，数据已是最新')
  } catch (e) {
    ElMessage.error('同步失败，请检查网络')
  } finally {
    syncing.value = false
  }
}
</script>

<style scoped lang="scss">
.topbar {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-6);
  border-bottom: 1px solid var(--border);
  background: var(--surface);
  flex-shrink: 0;
}

.topbar-title {
  display: flex;
  flex-direction: column;
  gap: 2px;

  h1 {
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--fg);
    margin: 0;
  }

  .breadcrumb {
    font-size: 12px;
    color: var(--muted);
  }
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.search {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 var(--space-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
  height: 34px;

  svg {
    width: 14px;
    height: 14px;
    color: var(--muted);
    flex-shrink: 0;
  }

  input {
    border: none;
    outline: none;
    background: transparent;
    font: inherit;
    font-size: 13px;
    color: var(--fg);
    width: 180px;

    &::placeholder {
      color: var(--muted);
    }
  }
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--motion-fast) var(--ease-standard);
  border: none;
  white-space: nowrap;
  height: 34px;

  svg {
    flex-shrink: 0;
  }
}

.btn-primary {
  background: var(--accent);
  color: var(--accent-on);

  &:hover {
    background: var(--primary-hover);
  }
}

.btn-secondary {
  background: var(--surface);
  color: var(--fg);
  border: 1px solid var(--border);

  &:hover {
    border-color: color-mix(in oklch, var(--fg) 20%, transparent);
  }
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spin-anim {
  animation: spin 1s linear infinite;
}

// ===== 登录：旗舰分屏（方案 B）=====
.login-mask {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(17, 24, 39, 0.45);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.b-wrap {
  position: relative;
  width: 860px;
  max-width: 94%;
  height: 420px;
  border-radius: 20px;
  overflow: hidden;
  display: flex;
  box-shadow: 0 30px 70px -16px rgba(10, 25, 60, 0.5);
}

.b-close {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 3;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: rgba(15, 42, 102, 0.18);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background var(--motion-fast) var(--ease-standard);

  svg {
    width: 16px;
    height: 16px;
  }

  &:hover {
    background: rgba(15, 42, 102, 0.32);
  }
}

// 左：品牌叙事区
.b-left {
  flex: 1.25;
  position: relative;
  color: #fff;
  padding: 40px 38px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow: hidden;
  background:
    radial-gradient(90% 120% at 85% -10%, rgba(79, 138, 242, 0.5) 0%, transparent 50%),
    radial-gradient(70% 90% at -10% 110%, rgba(24, 52, 120, 0.7) 0%, transparent 55%),
    linear-gradient(160deg, #0b1c45 0%, #123a8f 55%, #1d59d9 100%);

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
    background-size: 34px 34px;
  }

  &::after {
    content: '';
    position: absolute;
    right: -60px;
    top: -60px;
    width: 260px;
    height: 260px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(91, 142, 240, 0.4) 0%, transparent 65%);
  }
}

.b-brandline {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  letter-spacing: 4px;
  opacity: 0.9;

  .logo {
    width: 34px;
    height: 34px;
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.14);
    border: 1px solid rgba(255, 255, 255, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 15px;
  }
}

.b-hero {
  position: relative;
  z-index: 1;

  .b-hello {
    font-size: 30px;
    font-weight: 800;
    line-height: 1.35;
    text-shadow: 0 2px 16px rgba(0, 0, 0, 0.3);
  }

  .b-sub {
    margin-top: 10px;
    font-size: 13px;
    opacity: 0.78;
    letter-spacing: 1px;
    line-height: 1.8;
  }
}

.b-stats {
  position: relative;
  z-index: 1;
  display: flex;
  gap: 26px;

  .v {
    font-size: 19px;
    font-weight: 800;
    font-family: 'SF Mono', Consolas, monospace;
  }

  .l {
    font-size: 11px;
    opacity: 0.65;
    margin-top: 2px;
    letter-spacing: 1px;
  }

  .unit {
    font-size: 11px;
  }
}

// 右：登录表单区
.b-right {
  flex: 1;
  background: #fff;
  padding: 38px 34px;
  display: flex;
  flex-direction: column;
  justify-content: center;

  h3 {
    font-size: 17px;
    font-weight: 700;
    margin: 0;
  }

  .b-tip {
    font-size: 12px;
    color: #9aa3af;
    margin: 4px 0 22px;
  }
}

.b-in {
  width: 100%;
  height: 44px;
  border: 1.5px solid #e5e7eb;
  border-radius: 11px;
  padding: 0 13px;
  font-size: 14px;
  font-family: inherit;
  background: #fafbfd;
  outline: none;
  margin-bottom: 12px;
  transition: all 0.2s;

  &::placeholder {
    color: #9aa3af;
  }

  &:focus {
    border-color: #2f6feb;
    background: #fff;
    box-shadow: 0 0 0 4px rgba(47, 111, 235, 0.12);
  }
}

.b-btn {
  width: 100%;
  height: 44px;
  margin-top: 6px;
  border: none;
  border-radius: 11px;
  background: #0f2a66;
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 8px;
  text-indent: 8px;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: #1d59d9;
  }
}

.b-foot {
  text-align: center;
  font-size: 11px;
  color: #9aa3af;
  margin-top: 16px;
  letter-spacing: 2px;
}

.b-err {
  margin-top: 10px;
  font-size: 12px;
  color: #e5484d;
  line-height: 1.5;
  background: #fdf0f0;
  border: 1px solid #f5c6c8;
  border-radius: 8px;
  padding: 7px 10px;
  word-break: break-all;
}

// 过渡动画
.login-fade-enter-active {
  transition: opacity 0.25s ease-out;

  .b-wrap {
    animation: loginRise 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  }
}

.login-fade-leave-active {
  transition: opacity 0.18s ease-in;
}

.login-fade-enter-from,
.login-fade-leave-to {
  opacity: 0;
}

@keyframes loginRise {
  from {
    opacity: 0;
    transform: translateY(18px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

// 小屏适配：分屏改上下堆叠
@media (max-width: 720px) {
  .b-wrap {
    flex-direction: column;
    height: auto;
    max-height: 92vh;
    overflow: auto;
  }

  .b-left {
    padding: 28px 26px;
    gap: 18px;
  }

  .b-hero .b-hello {
    font-size: 24px;
  }

  .b-right {
    padding: 26px 26px 30px;
  }
}
</style>