<template>
  <div class="app-layout">
    <AppSidebar :collapsed="collapsed" @toggle="collapsed = !collapsed" />
    <div class="app-main">
      <AppHeader @toggle="collapsed = !collapsed" @new-task="showNewTask = true" />
      <main class="app-content">
        <router-view />
      </main>
    </div>
    <TaskFormModal v-model="showNewTask" :editing="editingTask" />
    <TaskDrawer :task="drawerTask" @close="drawerTask = null" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, provide, watch } from 'vue'
import { ElMessage } from 'element-plus'
import AppSidebar from './components/layout/AppSidebar.vue'
import AppHeader from './components/layout/AppHeader.vue'
import TaskFormModal from './components/kanban/TaskFormModal.vue'
import TaskDrawer from './components/kanban/TaskDrawer.vue'
import { useTaskStore } from './stores/taskStore'
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
const userStore = useUserStore()
const settingsStore = useSettingsStore()
const logStore = useLogStore()
const todoStore = useTodoStore()
const targetStore = useTargetStore()

onMounted(async () => {
  userStore.restoreSession()
  userStore.getUsers()

  taskStore.loadTasks()
  settingsStore.loadSettings()
  logStore.getLogs()
  todoStore.loadTodos()
  targetStore.loadTargets()

  await Promise.all([
    taskStore.cloudLoadTasks(),
    settingsStore.cloudLoadSettings(),
    userStore.cloudLoadUsers(),
    logStore.cloudLoadLogs(),
    todoStore.cloudLoadTodos(),
    targetStore.cloudLoadTargets()
  ])

  setInterval(async () => {
    await taskStore.cloudLoadTasks()
  }, 60000)
})
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
