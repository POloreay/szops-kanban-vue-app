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
        <!-- 看板阶段流程条 -->
        <div class="drawer-section">
          <div class="status-flow">
            <template v-for="(s, i) in STATUS_ORDER" :key="s">
              <span class="status-step" :class="{ active: s === task.status, done: stepDone(s) }">{{ STATUS_NAMES[s] }}</span>
              <span v-if="i < STATUS_ORDER.length - 1" class="status-arrow">→</span>
            </template>
          </div>
        </div>

        <!-- 项目生命周期条（六段，按日期字段点亮） -->
        <div class="drawer-section" v-if="lifecycleNodes.length">
          <div class="drawer-section-title">项目生命周期</div>
          <div class="lifecycle-bar" :class="{ overdue: lifecycleOverdue }">
            <template v-for="(n, i) in lifecycleNodes" :key="n.label">
              <div class="lc-node" :class="{ lit: n.lit, current: i === lifecycleCurrentIdx && !lifecycleOverdue, dim: !n.date }">
                <div class="lc-dot"></div>
                <div class="lc-label">{{ n.label }}</div>
                <div class="lc-date mono">{{ n.date || '未填写' }}</div>
              </div>
              <div v-if="i < lifecycleNodes.length - 1" class="lc-line" :class="{ lit: n.lit && lifecycleNodes[i + 1]?.lit }"></div>
            </template>
          </div>
          <div v-if="lifecycleOverdue" class="lc-warn">⚠ 计划完成时间已过，项目仍在建，请关注交付风险</div>
        </div>

        <!-- 实施双通道进展（仅实施环节项目） -->
        <div class="drawer-section" v-if="task.status === 'impl'">
          <div class="drawer-section-title">实施双通道进展</div>
          <div class="impl-dual">
            <div class="impl-lane">
              <div class="impl-lane-head"><span class="impl-lane-tag delivery">交付通道</span><span class="impl-lane-cur">{{ task.implSub1 || '项目交付' }}</span></div>
              <div class="impl-track">
                <template v-for="(s, i) in IMPL_SUBS_PATH1" :key="s">
                  <span class="impl-step" :class="implStepCls(task.implSub1, s, IMPL_SUBS_PATH1)">{{ s }}</span>
                  <span v-if="i < IMPL_SUBS_PATH1.length - 1" class="impl-arrow">→</span>
                </template>
              </div>
            </div>
            <div class="impl-lane">
              <div class="impl-lane-head"><span class="impl-lane-tag finance">财务通道</span><span class="impl-lane-cur">{{ task.implSub2 || '财务开票' }}</span></div>
              <div class="impl-track">
                <template v-for="(s, i) in IMPL_SUBS_PATH2" :key="s">
                  <span class="impl-step" :class="implStepCls(task.implSub2, s, IMPL_SUBS_PATH2)">{{ s }}</span>
                  <span v-if="i < IMPL_SUBS_PATH2.length - 1" class="impl-arrow">→</span>
                </template>
              </div>
            </div>
          </div>
        </div>

        <!-- 非实施环节子状态 -->
        <div class="drawer-section" v-if="task.status !== 'impl' && task.subStatus">
          <div class="drawer-section-title">子状态</div>
          <span class="g-pill" style="margin:0;">{{ task.subStatus }}</span>
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
import { STATUS_ORDER, STATUS_NAMES, IMPL_SUBS_PATH1, IMPL_SUBS_PATH2, XLS_FIELDS } from '../../utils/constants'
import { fmtMoney } from '../../utils/business'
import { useTaskStore } from '../../stores/taskStore'
import { useLogStore } from '../../stores/logStore'
import { useUserStore } from '../../stores/userStore'
import { canManageTask } from '../../utils/permissions'

const props = defineProps({
  task: { type: Object, default: null }
})
const emit = defineEmits(['close'])

const taskStore = useTaskStore()
const logStore = useLogStore()
const userStore = useUserStore()
const openEditModal = inject('openEditModal', null)

// 权限（2026-09-08 调整）：管理员全局可编辑；普通用户仅对自己负责（pmName=本人）或自己创建的项目可编辑
const isAdmin = computed(() => userStore.isAdmin)
const canEdit = computed(() => {
  if (!props.task) return false
  return canManageTask(props.task, userStore.currentUser)
})

const visible = ref(false)
watch(() => props.task, (t) => { visible.value = !!t })
watch(visible, (v) => { if (!v) setTimeout(() => emit('close'), 200) })

function close() { visible.value = false }

function onEdit() {
  if (props.task && openEditModal) openEditModal(props.task)
}

const STATUS_IDX = { talk: 0, proc: 1, impl: 2 }

// 标题：优先取 XLS「项目名称」字段，回退任务标题
const drawerTitle = computed(() => {
  const t = props.task
  if (!t) return ''
  return (t.projectInfo && t.projectInfo.projectName) || t.title || '—'
})
function stepDone(s) {
  return STATUS_IDX[s] < STATUS_IDX[props.task?.status]
}

// 实施双通道步骤样式：当前项高亮，已完成置绿
function implStepCls(cur, s, path) {
  const ci = path.indexOf(cur)
  const si = path.indexOf(s)
  if (cur && si === ci) return 'cur'
  if (ci >= 0 && si < ci) return 'done'
  return ''
}

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

// ===== 项目生命周期条（六段：创建→立项→计划开始→计划完成→业务关闭→财务关闭）=====
const LC_DEFS = [
  { key: 'createdDate', label: '创建' },
  { key: 'approvalPassDate', label: '立项' },
  { key: 'planStartDate', label: '计划开始' },
  { key: 'planEndDate', label: '计划完成' },
  { key: 'businessCloseDate', label: '业务关闭' },
  { key: 'financeCloseDate', label: '财务关闭' }
]
const lifecycleNodes = computed(() => {
  const info = props.task?.projectInfo || {}
  return LC_DEFS.map(d => {
    const date = String(info[d.key] || '').trim()
    return { label: d.label, date: date ? date.slice(0, 10) : '', lit: !!date }
  })
})
const lifecycleCurrentIdx = computed(() => {
  const nodes = lifecycleNodes.value
  let last = -1
  nodes.forEach((n, i) => { if (n.lit) last = i })
  return Math.min(last + 1, nodes.length - 1)
})
// 计划完成已过但仍在建 → 整条橙色预警
const lifecycleOverdue = computed(() => {
  const t = props.task
  if (!t) return false
  const info = t.projectInfo || {}
  if (info.buildStatus !== '在建' || !info.planEndDate) return false
  const d = new Date(String(info.planEndDate).replace(/\//g, '-'))
  if (isNaN(d)) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  return d < today
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

// ===== 生命周期条 =====
.lifecycle-bar {
  display: flex;
  align-items: flex-start;
  gap: 0;
  padding: var(--space-2) 0 var(--space-1);
}

.lc-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  min-width: 56px;
  flex: 0 0 auto;

  .lc-dot {
    width: 14px;
    height: 14px;
    border-radius: var(--radius-pill);
    border: 2px solid var(--border);
    background: var(--surface);
    transition: all var(--motion-fast) var(--ease-standard);
  }

  .lc-label { font-size: 11px; color: var(--muted); white-space: nowrap; }
  .lc-date { font-size: 10px; color: var(--muted); white-space: nowrap; }

  &.lit .lc-dot {
    border-color: var(--good);
    background: color-mix(in oklch, var(--good) 18%, transparent);
  }
  &.lit .lc-label { color: var(--fg); font-weight: 500; }
  &.dim { opacity: 0.55; }

  &.current .lc-dot {
    border-color: var(--accent);
    background: var(--accent-soft);
    box-shadow: 0 0 0 3px color-mix(in oklch, var(--accent) 16%, transparent);
    animation: lcPulse 1.6s ease-in-out infinite;
  }
  &.current .lc-label { color: var(--accent); font-weight: 600; }

  .lifecycle-bar.overdue & {
    &.lit .lc-dot {
      border-color: var(--warn);
      background: color-mix(in oklch, var(--warn) 18%, transparent);
    }
    &.current .lc-dot {
      border-color: var(--warn);
      background: color-mix(in oklch, var(--warn) 18%, transparent);
      box-shadow: 0 0 0 3px color-mix(in oklch, var(--warn) 18%, transparent);
    }
    &.current .lc-label { color: var(--warn); }
  }
}

@keyframes lcPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.12); }
}

.lc-line {
  flex: 1 1 0;
  height: 2px;
  background: var(--border);
  margin-top: 6px;
  min-width: 12px;

  &.lit { background: color-mix(in oklch, var(--good) 55%, transparent); }

  .lifecycle-bar.overdue &.lit { background: color-mix(in oklch, var(--warn) 55%, transparent); }
}

.lc-warn {
  margin-top: var(--space-2);
  font-size: 12px;
  color: var(--warn);
  background: color-mix(in oklch, var(--warn) 8%, transparent);
  border: 1px solid color-mix(in oklch, var(--warn) 26%, transparent);
  border-radius: var(--radius-sm);
  padding: 6px 10px;
}

.milestone-list { display: flex; flex-direction: column; gap: var(--space-3); }

// ===== 实施双通道进展 =====
.impl-dual {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.impl-lane {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
}

.impl-lane-head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.impl-lane-tag {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 8px;
  border-radius: var(--radius-pill);

  &.delivery {
    color: var(--biz-blue);
    background: color-mix(in oklch, var(--biz-blue) 12%, transparent);
    border: 1px solid color-mix(in oklch, var(--biz-blue) 28%, transparent);
  }
  &.finance {
    color: var(--chart-gold);
    background: color-mix(in oklch, var(--chart-gold) 12%, transparent);
    border: 1px solid color-mix(in oklch, var(--chart-gold) 28%, transparent);
  }
}

.impl-lane-cur {
  font-size: 12px;
  font-weight: 600;
  color: var(--fg);
}

.impl-track {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.impl-step {
  font-size: 11px;
  color: var(--muted);
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);

  &.done {
    color: var(--good);
    border-color: color-mix(in oklch, var(--good) 24%, transparent);
  }
  &.cur {
    color: var(--accent);
    background: var(--accent-soft);
    border-color: color-mix(in oklch, var(--accent) 30%, transparent);
    font-weight: 600;
  }
}

.impl-arrow { color: var(--border); font-size: 11px; }

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
