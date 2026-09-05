<template>
  <div class="kanban-col" :data-status="status">
    <div class="kanban-col-header">
      <div class="kanban-col-title">
        <span class="pill" :class="pillClass">
          <span class="dot" :style="{ background: statusColor }"></span>
          {{ statusName }}
        </span>
        <span class="kanban-col-count">{{ colTasks.length }}</span>
      </div>
      <button class="btn-icon" :title="sortLabel" @click="toggleSort">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="5" r="1" />
          <circle cx="12" cy="12" r="1" />
          <circle cx="12" cy="19" r="1" />
        </svg>
      </button>
    </div>
    <div class="kanban-cards">
      <TaskCard
        v-for="(task, i) in colTasks"
        :key="task.id"
        :task="task"
        :index="i + 1"
        @click="onCardClick"
        @edit="onCardEdit"
        @delete="onCardDelete"
      />
      <div v-if="!colTasks.length" class="empty-hint">暂无任务</div>
      <button class="add-task-btn" @click="onAddTask">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        添加任务
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useTaskStore } from '../../stores/taskStore'
import { STATUS_NAMES, STATUS_COLORS, SORT_CYCLES } from '../../utils/constants'
import TaskCard from './TaskCard.vue'
const props = defineProps({ status: String })
const emit = defineEmits(['card-click', 'card-edit', 'card-delete', 'add-task'])

const taskStore = useTaskStore()

const statusName = computed(() => STATUS_NAMES[props.status])
const statusColor = computed(() => STATUS_COLORS[props.status])

const pillClass = computed(() => {
  const map = { talk: '', bid: 'accent', proc: 'warn', impl: 'good' }
  return map[props.status] || ''
})

const colTasks = computed(() => {
  let tasks = taskStore.filteredTasks.filter(t => t.status === props.status)
  const ss = taskStore.sortState[props.status] || 'default'
  if (ss === 'asc') tasks = [...tasks].sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'))
  else if (ss === 'desc') tasks = [...tasks].sort((a, b) => b.title.localeCompare(a.title, 'zh-CN'))
  return tasks
})

const sortLabel = computed(() => {
  const ss = taskStore.sortState[props.status] || 'default'
  return { default: '默认排序', asc: '标题升序', desc: '标题降序' }[ss]
})

function toggleSort() {
  const cur = taskStore.sortState[props.status] || 'default'
  const idx = SORT_CYCLES.indexOf(cur)
  taskStore.sortState[props.status] = SORT_CYCLES[(idx + 1) % SORT_CYCLES.length]
}

function onCardClick(task) { emit('card-click', task) }
function onCardEdit(task) { emit('card-edit', task) }
function onCardDelete(task) { emit('card-delete', task) }
function onAddTask() { emit('add-task', props.status) }
</script>

<style scoped lang="scss">
.kanban-col {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  min-height: 200px;
  display: flex;
  flex-direction: column;
}

.kanban-col-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-2) var(--space-2) var(--space-3);
  margin-bottom: var(--space-2);
}

.kanban-col-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 13px;
  font-weight: 600;
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--muted);
  font-weight: 500;
  white-space: nowrap;

  &.good {
    color: var(--good);
    background: color-mix(in oklch, var(--good) 8%, transparent);
    border-color: color-mix(in oklch, var(--good) 24%, transparent);
  }
  &.warn {
    color: var(--warn);
    background: color-mix(in oklch, var(--warn) 10%, transparent);
    border-color: color-mix(in oklch, var(--warn) 28%, transparent);
  }
  &.accent {
    color: var(--accent);
    background: var(--accent-soft);
    border-color: color-mix(in oklch, var(--accent) 24%, transparent);
  }
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: var(--radius-pill);
  background: currentColor;
}

.kanban-col-count {
  font-size: 11px;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
  font-family: var(--font-mono);
  padding: 1px 7px;
  border-radius: var(--radius-pill);
  background: var(--surface);
  border: 1px solid var(--border);
}

.btn-icon {
  background: transparent;
  border: none;
  color: var(--muted);
  cursor: pointer;
  padding: 4px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--motion-fast) var(--ease-standard);

  svg {
    width: 16px;
    height: 16px;
  }

  &:hover {
    color: var(--fg);
    background: var(--bg);
  }
}

.kanban-cards {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  overflow-y: auto;
}

.empty-hint {
  text-align: center;
  color: var(--muted);
  font-size: 13px;
  padding: var(--space-5) 0;
}

.add-task-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 8px;
  background: var(--accent);
  border: none;
  border-radius: var(--radius-sm);
  color: var(--accent-on);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all var(--motion-fast) var(--ease-standard);

  &:hover {
    background: var(--primary-hover);
  }
}
</style>
