<template>
  <div class="app-layout">
    <!-- 登录强验证：未登录时全屏登录门，不渲染任何系统内容 -->
    <LoginGate v-if="!userStore.currentUser" />
    <template v-else>
      <AppSidebar :collapsed="collapsed" @toggle="collapsed = !collapsed" />
      <div class="app-main">
        <AppHeader @toggle="collapsed = !collapsed" />
        <main class="app-content">
          <router-view />
        </main>
      </div>
      <TaskFormModal v-model="showNewTask" :editing="editingTask" />
      <TaskDrawer :task="drawerTask" @close="drawerTask = null" />
      <TodoNotice />
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, provide, watch } from 'vue'
import { ElMessage } from 'element-plus'
import AppSidebar from './components/layout/AppSidebar.vue'
import AppHeader from './components/layout/AppHeader.vue'
import LoginGate from './components/layout/LoginGate.vue'
import TaskFormModal from './components/kanban/TaskFormModal.vue'
import TaskDrawer from './components/kanban/TaskDrawer.vue'
import TodoNotice from './components/layout/TodoNotice.vue'
import { useTaskStore } from './stores/taskStore'
import { useBidStore } from './stores/bidStore'
import { useUserStore } from './stores/userStore'
import { useSettingsStore } from './stores/settingsStore'
import { useLogStore } from './stores/logStore'
import { useTodoStore } from './stores/todoStore'
import { useTargetStore } from './stores/targetStore'

const collapsed = ref(false)
const showNewTask = ref(false)
const drawerTask = ref(null)
const editingTask = ref(null)

// 全局项目详情抽屉（各视图点击项目行/卡片时打开）
function openTaskDrawer(task) { drawerTask.value = task }
provide('openTaskDrawer', openTaskDrawer)

// 全局编辑模态框（详情抽屉「编辑」按钮触发）
function openEditModal(task) {
  // 权限：仅创建人本人或管理员可编辑
  const me = userStore.currentUser?.username
  const allowed = userStore.isAdmin || (me && task.owner === me)
  if (!userStore.currentUser) {
    userStore.requireLogin(() => openEditModal(task))
    return
  }
  if (!allowed) {
    ElMessage.warning('仅创建人或管理员可编辑该项目')
    return
  }
  editingTask.value = task
  showNewTask.value = true
}
provide('openEditModal', openEditModal)

// 编辑模态框关闭后，若详情抽屉正展示同一项目则关闭，避免展示旧数据
watch(showNewTask, (v) => {
  if (!v && drawerTask.value && editingTask.value) {
    drawerTask.value = null
    editingTask.value = null
  }
})

const taskStore = useTaskStore()
const bidStore = useBidStore()
const userStore = useUserStore()
const settingsStore = useSettingsStore()
const logStore = useLogStore()
const todoStore = useTodoStore()
const targetStore = useTargetStore()

// 云端数据拉取（统一入口：需已登录，请求携带 JWT）
function loadCloudData() {
  if (!userStore.currentUser) return
  Promise.all([
    taskStore.cloudLoadTasks(),
    bidStore.cloudLoadBids(),
    settingsStore.cloudLoadSettings(),
    userStore.cloudLoadUsers(),
    logStore.cloudLoadLogs(),
    todoStore.cloudLoadTodos(),
    targetStore.cloudLoadTargets()
  ]).then(() => {
    // 云端拉取后重跑迁移（防止云端还有未迁移的 bid 任务）
    migrateBidTasks()
  }).catch(e => console.warn('cloud load error:', e))
}

onMounted(async () => {
  userStore.restoreSession()
  userStore.getUsers()

  taskStore.loadTasks()
  bidStore.loadBids()
  settingsStore.loadSettings()
  logStore.getLogs()
  todoStore.loadTodos()
  targetStore.loadTargets()

  // 一次性迁移：老看板 status='bid' 任务 → 投标管理归档列（标记存 localStorage，只执行一次）
  migrateBidTasks()

  // 云端数据后台静默拉取：不阻塞界面渲染（本地数据已先秒开显示）
  loadCloudData()

  // 登录态变化时重新拉云端（登录成功后 JWT 才可用）
  watch(() => userStore.currentUser, (v, old) => {
    if (v && !old) loadCloudData()
  })

  setInterval(async () => {
    await taskStore.cloudLoadTasks()
  }, 60000)
})

// 老 bid 任务迁移：落标归档/归档结束 → 归档列；其余活跃投标任务也一并迁入商机跟踪
const BID_MIGRATED_KEY = 'szops_bid_migrated_v1'
function migrateBidTasks() {
  try {
    const oldBids = taskStore.tasks.filter(t => t.status === 'bid')
    if (!oldBids.length) return
    // 已在投标库里的老任务 id（避免重复迁移）
    const existing = new Set(bidStore.bids.map(b => b.id))
    const toAdd = oldBids
      .filter(t => !existing.has(t.id))
      .map(t => ({
        id: t.id,
        title: (t.projectInfo && t.projectInfo.projectName) || t.title || '',
        desc: t.desc || '',
        owner: t.owner || '',
        contact: t.contact || '',
        priority: t.priority || 'medium',
        deadline: t.deadline || '',
        stage: 'archive',
        subStatus: t.subStatus === '落标归档' || t.subStatus === '归档结束' ? '落标归档' : '中标归档',
        agencyFee: t.agencyFee || '',
        createdAt: t.createdAt || new Date().toISOString(),
        migratedFrom: 'task'
      }))
    if (!toAdd.length) return
    bidStore.bids.push(...toAdd)
    bidStore.saveBids()
    localStorage.setItem(BID_MIGRATED_KEY, '1')
    logStore.addLog('迁移', `迁移 ${toAdd.length} 条老投标任务到投标管理归档列`, userStore.currentUser?.username || '系统')
  } catch (e) {
    console.warn('migrateBidTasks error:', e)
  }
}
</script>

<style scoped lang="scss">
.app-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

.app-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.app-content {
  flex: 1;
  overflow: auto;
  background: var(--bg);
}
</style>
