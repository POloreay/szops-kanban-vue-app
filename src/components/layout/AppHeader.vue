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
      <button class="btn btn-secondary" @click="handleSync" :disabled="syncing">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" :class="{ 'spin-anim': syncing }">
          <path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-6.4-2.6L3 21M3 12a9 9 0 0 1 9-9 9 9 0 0 1 6.4 2.6L21 3M3 21v-5h5M21 3v5h-5" />
        </svg>
        {{ syncing ? '同步中…' : '云同步' }}
      </button>
      <button v-if="userStore.currentUser" class="btn btn-primary" @click="$emit('new-task')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        新建项目
      </button>
      <button v-else class="btn btn-primary" @click="showLogin = true">登录</button>
      <template v-if="userStore.currentUser">
        <el-button size="small" text @click="handleLogout">退出</el-button>
      </template>
    </div>
  </header>

  <el-dialog v-model="showLogin" title="登录" width="360px" :close-on-click-modal="false">
    <el-form @submit.prevent="handleLogin">
      <el-form-item label="用户名">
        <el-input v-model="loginForm.username" placeholder="请输入用户名" />
      </el-form-item>
      <el-form-item label="密码">
        <el-input v-model="loginForm.password" type="password" placeholder="请输入密码" show-password />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="showLogin = false">取消</el-button>
      <el-button type="primary" @click="handleLogin">登录</el-button>
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

defineEmits(['toggle', 'new-task'])

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
  '/kanban/bid': '投标阶段',
  '/kanban/procurement': '采购阶段',
  '/kanban/implementation': '实施阶段',
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
    ElMessage.success('欢迎回来，' + userStore.currentUser.username)
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
</style>
