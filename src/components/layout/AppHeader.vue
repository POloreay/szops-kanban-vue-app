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

  <el-dialog v-model="showLogin" width="420px" :close-on-click-modal="false" class="login-dialog" :show-close="true" append-to-body>
    <div class="login-banner">
      <div class="banner-ribbon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m3 17 6-6 4 4 8-8" />
          <path d="M14 7h7v7" />
        </svg>
      </div>
      <div class="banner-brand">数智运营看板</div>
      <div class="banner-hello">无敌牛马，欢迎回来！</div>
      <div class="banner-sub">鞍已备好，粮草已足，请开始今日搬砖</div>
    </div>
    <div class="login-body">
      <el-form @submit.prevent="handleLogin" label-position="top" class="login-form">
        <el-form-item label="用户名">
          <el-input v-model="loginForm.username" placeholder="请输入用户名" size="large">
            <template #prefix>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="loginForm.password" type="password" placeholder="请输入密码" show-password size="large" @keyup.enter="handleLogin">
            <template #prefix>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect width="18" height="11" x="3" y="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </template>
          </el-input>
        </el-form-item>
      </el-form>
    </div>
    <template #footer>
      <div class="login-footer">
        <button class="btn btn-secondary login-cancel" type="button" @click="showLogin = false">取消</button>
        <button class="btn btn-primary login-submit" type="submit" @click="handleLogin">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M6 3h4l2 5-2.5 1.5a11 11 0 0 0 5 5L16 12l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2Z" />
          </svg>
          开工
        </button>
      </div>
      <div class="login-tip">今日宜搬砖 · 忌摸鱼</div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed } from 'vue'
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
  '/bid': '投标管理',
  '/revenue': '收入管理',
  '/cost': '成本管理',
  '/budget': '预算管理',
  '/todo': '个人待办',
  '/users': '用户管理'
}

const pageTitle = computed(() => titleMap[route.path] || '数智运营看板')

function handleLogin() {
  if (!loginForm.value.username || !loginForm.value.password) {
    ElMessage.warning('请输入用户名和密码')
    return
  }
  const ok = userStore.login(loginForm.value.username, loginForm.value.password)
  if (ok) {
    showLogin.value = false
    loginForm.value = { username: '', password: '' }
    ElMessage.success('无敌牛马，欢迎回来！开工大吉，' + userStore.currentUser.username)
    logStore.addLog('登录', '用户 ' + userStore.currentUser.username + ' 登录系统', userStore.currentUser.username)
    userStore.resumePending()
  } else {
    ElMessage.error('用户名或密码错误')
  }
}

function handleLogout() {
  logStore.addLog('退出', '用户 ' + userStore.currentUser.username + ' 退出系统', userStore.currentUser.username)
  userStore.logout()
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

// ===== 登录弹窗：牛马晨会卡 =====
:global(.login-dialog) {
  border-radius: var(--radius-lg);
  overflow: hidden;

  .el-dialog__header {
    padding: 0;
  }

  .el-dialog__body {
    padding: 0;
  }

  .el-dialog__footer {
    padding: 0;
  }
}

.login-banner {
  position: relative;
  padding: 30px 24px 24px;
  background: linear-gradient(135deg, #1d59d9 0%, #2f6feb 55%, #5b8ef0 100%);
  color: #fff;
  text-align: center;

  .banner-ribbon {
    width: 44px;
    height: 44px;
    margin: 0 auto 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-md);
    background: color-mix(in oklch, #ffffff 18%, transparent);
    border: 1px solid color-mix(in oklch, #ffffff 32%, transparent);
    backdrop-filter: blur(4px);

    svg {
      width: 24px;
      height: 24px;
      color: #fff;
    }
  }

  .banner-brand {
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 4px;
    opacity: 0.85;
    margin-bottom: 6px;
  }

  .banner-hello {
    font-size: 22px;
    font-weight: 700;
    letter-spacing: 1px;
    text-shadow: 0 2px 8px color-mix(in oklch, #000 24%, transparent);
  }

  .banner-sub {
    margin-top: 6px;
    font-size: 12px;
    opacity: 0.82;
    letter-spacing: 1px;
  }
}

.login-body {
  padding: 22px 24px 4px;

  :deep(.el-form-item__label) {
    font-size: 12px;
    color: var(--muted);
  }
}

.login-footer {
  display: flex;
  gap: 10px;
  padding: 4px 24px 6px;

  .login-submit {
    flex: 1;
    font-size: 15px;
    letter-spacing: 8px;
    padding-left: 20px;

    svg {
      margin-right: -4px;
    }
  }
}

.login-tip {
  padding: 0 24px 14px;
  text-align: center;
  font-size: 11px;
  color: var(--muted);
  letter-spacing: 2px;
}

// 弹窗关闭按钮移入蓝色横幅区域
:global(.login-dialog) {
  .el-dialog__headerbtn {
    top: 10px;
    right: 12px;
    z-index: 3;

    .el-dialog__close {
      color: #fff;
    }
  }
}
</style>
