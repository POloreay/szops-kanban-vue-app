<template>
  <div class="task-drawer-overlay" v-if="visible" @click="close"></div>
  <aside class="task-drawer" :class="{ open: visible }" role="dialog" aria-modal="true">
    <template v-if="task">
      <div class="drawer-header">
        <div>
          <h2 class="drawer-title">{{ drawerTitle }}</h2>
          <div class="drawer-subtitle">{{ task.owner }} · {{ STATUS_NAMES[task.status] }}</div>
        </div>
        <button class="btn-close" @click="close" aria-label="关闭">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="drawer-actions">
        <button v-if="canEdit" class="btn-minor" @click="onEdit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
          编辑
        </button>
      </div>
      <div class="drawer-body">
        <!-- 状态流程条 -->
        <div class="drawer-section">
          <div class="status-flow">
            <template v-for="(s, i) in STATUS_ORDER" :key="s">
              <span class="status-step" :class="{ active: s === task.status, done: stepDone(s) }">{{ STATUS_NAMES[s] }}</span>
              <span v-if="i < STATUS_ORDER.length - 1" class="status-arrow">→</span>
            </template>
          </div>
        </div>

        <!-- 基本信息 -->
        <div class="drawer-section">
          <div class="drawer-section-title">基本信息</div>
          <div class="drawer-info-grid">
            <div class="info-item"><span class="info-label">创建人</span><span class="info-value">{{ task.owner || '—' }}</span></div>
            <div class="info-item"><span class="info-label">联系人</span><span class="info-value">{{ task.contact || '—' }}</span></div>
            <div class="info-item"><span class="info-label">截止日期</span><span class="info-value mono">{{ task.deadline || '—' }}</span></div>
            <div class="info-item"><span class="info-label">剩余天数</span><span class="info-value mono" :style="{ color: daysColor }">{{ daysText }}</span></div>
            <div class="info-item"><span class="info-label">优先级</span><span class="info-value"><span class="g-pill" :class="priorityClass" style="margin:0;">{{ PRIORITY_NAMES[task.priority] || '中' }}</span></span></div>
            <div class="info-item"><span class="info-label">当前子状态</span><span class="info-value">{{ subStatusText }}</span></div>
            <div class="info-item" v-if="task.needDecision"><span class="info-label">需要决策</span><span class="info-value"><span class="g-pill bad" style="margin:0;">⚑ 是</span></span></div>
            <div class="info-item" v-if="task.agencyFee !== '' && task.agencyFee != null"><span class="info-label">项目代理服务费(元)</span><span class="info-value mono">{{ fmtMoney(task.agencyFee) }}</span></div>
          </div>
        </div>

        <!-- 描述 -->
        <div class="drawer-section" v-if="task.desc">
          <div class="drawer-section-title">描述</div>
          <p class="drawer-desc">{{ task.desc }}</p>
        </div>

        <!-- 项目信息（XLS 40字段，有值的显示前12项） -->
        <div class="drawer-section" v-if="projectInfoItems.length">
          <div class="drawer-section-title">项目信息</div>
          <div class="drawer-info-grid">
            <div class="info-item" v-for="it in projectInfoItems" :key="it.key">
              <span class="info-label">{{ it.label }}</span>
              <span class="info-value mono">{{ it.value }}</span>
            </div>
          </div>
        </div>

        <!-- 预算对照 -->
        <div class="drawer-section" v-if="budgetRows.length">
          <div class="drawer-section-title">预算对照</div>
          <div class="budget-row" v-for="row in budgetRows" :key="row.label" style="grid-template-columns:90px 1fr 70px 70px;">
            <span class="budget-label">{{ row.label }}</span>
            <div class="budget-bars">
              <div class="budget-bar"><div class="budget-bar-fill plan" :style="{ width: row.planWidth }"></div></div>
              <div class="budget-bar"><div class="budget-bar-fill actual" :class="{ over: row.over }" :style="{ width: row.actualWidth }"></div></div>
            </div>
            <span class="budget-num plan">{{ row.planText }}</span>
            <span class="budget-num actual" :class="{ over: row.over }" style="font-weight:600;">{{ row.actualText }}</span>
          </div>
        </div>

        <!-- 里程碑 -->
        <div class="drawer-section" v-if="task.milestones && task.milestones.length">
          <div class="drawer-section-title">里程碑</div>
          <div class="milestone-list">
            <div class="milestone" v-for="(ms, i) in task.milestones" :key="i">
              <div class="milestone-dot" :class="{ done: ms.done, current: i === currentMilestoneIdx && !ms.done }"></div>
              <div class="milestone-content">
                <div class="milestone-title">{{ ms.text }}</div>
                <div class="milestone-meta">{{ ms.date }}{{ ms.amount ? ' · ' + ms.amount : '' }}{{ ms.done ? ' · 已确认' : '' }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </aside>
</template>

<script setup>
import { computed, ref, watch, inject } from 'vue'
import { ElMessage } from 'element-plus'
import { STATUS_ORDER, STATUS_NAMES, PRIORITY_NAMES, XLS_FIELDS } from '../../utils/constants'
import { getDaysLeft, isOverdue, isWarn, fmtMoney } from '../../utils/business'
import { useTaskStore } from '../../stores/taskStore'
import { useLogStore } from '../../stores/logStore'
import { useUserStore } from '../../stores/userStore'

const props = defineProps({
  task: { type: Object, default: null }
})
const emit = defineEmits(['close'])

const taskStore = useTaskStore()
const logStore = useLogStore()
const userStore = useUserStore()
const openEditModal = inject('openEditModal', null)

// 权限：创建人本人或管理员可编辑
const isAdmin = computed(() => userStore.isAdmin)
const canEdit = computed(() => {
  if (!props.task) return false
  if (isAdmin.value) return true
  const me = userStore.currentUser?.username
  return !!me && props.task.owner === me
})

const visible = ref(false)
watch(() => props.task, (t) => { visible.value = !!t })
watch(visible, (v) => { if (!v) setTimeout(() => emit('close'), 200) })

function close() { visible.value = false }

function onEdit() {
  if (props.task && openEditModal) openEditModal(props.task)
}

const STATUS_IDX = { talk: 0, bid: 1, proc: 2, impl: 3 }

// 标题：优先取 XLS「项目名称」字段，回退任务标题
const drawerTitle = computed(() => {
  const t = props.task
  if (!t) return ''
  return (t.projectInfo && t.projectInfo.projectName) || t.title || '—'
})
function stepDone(s) {
  return STATUS_IDX[s] < STATUS_IDX[props.task?.status]
}

const daysLeft = computed(() => props.task ? getDaysLeft(props.task.deadline) : 0)
const daysText = computed(() => {
  if (!props.task?.deadline) return '—'
  return daysLeft.value < 0 ? `已逾期 ${Math.abs(daysLeft.value)} 天` : `剩余 ${daysLeft.value} 天`
})
const daysColor = computed(() => {
  if (!props.task?.deadline) return 'var(--muted)'
  if (isOverdue(props.task)) return 'var(--bad)'
  if (isWarn(props.task)) return 'var(--warn)'
  return 'var(--good)'
})

const priorityClass = computed(() => ({
  high: 'bad', medium: 'warn', low: 'good'
}[props.task?.priority] || 'warn'))

const subStatusText = computed(() => {
  const t = props.task
  if (!t) return '—'
  if (t.status === 'impl') return `${t.implSub1 || '项目交付'} · ${t.implSub2 || '财务开票'}`
  return t.subStatus || '未指定'
})

const projectInfoItems = computed(() => {
  const info = props.task?.projectInfo || {}
  return XLS_FIELDS
    .filter(f => info[f.key] !== undefined && info[f.key] !== '' && info[f.key] !== null)
    .slice(0, 12)
    .map(f => ({ key: f.key, label: f.label, value: typeof info[f.key] === 'number' ? fmtMoney(info[f.key]) : String(info[f.key]) }))
})

const budgetRows = computed(() => {
  const info = props.task?.projectInfo || {}
  const pairs = [
    { plan: 'planRevenueNoTax', actual: 'ledgerRevenueNoTax', label: '计划收入' },
    { plan: 'planCost', actual: 'actualCost', label: '计划成本' }
  ]
  const rows = []
  pairs.forEach(p => {
    const plan = Number(info[p.plan] || 0)
    const actual = Number(info[p.actual] || 0)
    if (!plan && !actual) return
    const max = Math.max(plan, actual, 1)
    rows.push({
      label: p.label,
      planWidth: (plan / max * 100).toFixed(0) + '%',
      actualWidth: (actual / max * 100).toFixed(0) + '%',
      planText: plan ? fmtMoney(plan) : '—',
      actualText: actual ? fmtMoney(actual) : '—',
      over: p.label === '计划成本' && actual > plan && plan > 0
    })
  })
  return rows
})

const currentMilestoneIdx = computed(() => {
  const ms = props.task?.milestones || []
  const lastDone = ms.reduce((acc, m, i) => (m.done ? i : acc), -1)
  return Math.min(lastDone + 1, ms.length - 1)
})
</script>

<style scoped lang="scss">
.task-drawer-overlay {
  position: fixed;
  inset: 0;
  background: color-mix(in oklab, var(--fg), transparent 60%);
  z-index: 40;
}

.task-drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 480px;
  max-width: 90vw;
  background: var(--surface);
  border-left: 1px solid var(--border);
  box-shadow: -8px 0 32px color-mix(in oklab, var(--fg), transparent 85%);
  transform: translateX(100%);
  transition: transform var(--motion-base) var(--ease-standard);
  z-index: 41;
  overflow-y: auto;
  display: flex;
  flex-direction: column;

  &.open { transform: translateX(0); }
}

.drawer-header {
  padding: var(--space-5);
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-3);
}

.drawer-title {
  font-size: var(--text-lg);
  font-weight: 600;
  margin: 0;
}

.drawer-subtitle {
  font-size: 12px;
  color: var(--muted);
  margin-top: 2px;
}

.btn-close {
  background: transparent;
  border: none;
  color: var(--muted);
  cursor: pointer;
  padding: 4px;
  border-radius: var(--radius-sm);
  display: flex;

  svg { width: 18px; height: 18px; }
  &:hover { color: var(--fg); background: var(--bg); }
}

.drawer-actions {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-5);
  border-bottom: 1px solid var(--border);
  justify-content: flex-start;
  align-items: center;
}

.btn-minor {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 500;
  color: var(--fg);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 5px 10px;
  cursor: pointer;
  transition: all var(--motion-fast) var(--ease-standard);

  &:hover { border-color: color-mix(in oklch, var(--fg) 20%, transparent); }

  &.danger {
    color: var(--bad);
    border-color: color-mix(in oklch, var(--bad) 30%, transparent);

    &:hover {
      background: color-mix(in oklch, var(--bad) 8%, transparent);
      border-color: color-mix(in oklch, var(--bad) 45%, transparent);
    }
  }
}

.drawer-body {
  padding: var(--space-5);
  flex: 1;
}

.drawer-section { margin-bottom: var(--space-6); }

.drawer-section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: var(--space-3);
}

.drawer-info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3) var(--space-4);
}

.info-item { display: flex; flex-direction: column; gap: 2px; }
.info-label { font-size: 11px; color: var(--muted); }
.info-value {
  font-size: 13px;
  color: var(--fg);
  font-weight: 500;

  &.mono {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
  }
}

.drawer-desc {
  font-size: 13px;
  color: var(--fg);
  line-height: 1.6;
}

.status-flow {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.status-step {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--muted);
  padding: 4px 10px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);

  &.active {
    color: var(--accent);
    background: var(--accent-soft);
    border-color: color-mix(in oklch, var(--accent) 30%, transparent);
    font-weight: 500;
  }
  &.done {
    color: var(--good);
    border-color: color-mix(in oklch, var(--good) 24%, transparent);
  }
}

.status-arrow { color: var(--border); font-size: 12px; }

.milestone-list { display: flex; flex-direction: column; gap: var(--space-3); }

.milestone {
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
}

.milestone-dot {
  width: 20px;
  height: 20px;
  border-radius: var(--radius-pill);
  border: 2px solid var(--border);
  flex-shrink: 0;
  margin-top: 2px;

  &.current {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
}

.milestone-content { flex: 1; min-width: 0; }
.milestone-title { font-size: 13px; font-weight: 500; color: var(--fg); }
.milestone-meta { font-size: 11px; color: var(--muted); margin-top: 2px; }
</style>
