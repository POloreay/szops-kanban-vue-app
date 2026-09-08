<template>
  <div class="stage-view">
    <!-- 新建项目弹窗（模块内入口，默认落入当前环节） -->
    <TaskFormModal v-model="showNewTask" :default-status="status === 'closed' ? 'talk' : status" />

    <!-- 空数据引导 -->
    <div v-if="!stageTasks.length" class="panel empty-guide">
      <h3>暂无{{ title }}项目</h3>
      <p>当前没有处于「{{ title }}」的项目。</p>
      <button v-if="userStore.currentUser && status !== 'closed'" class="btn-del" @click="showNewTask = true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><path d="M12 5v14M5 12h14"/></svg>
        新建项目
      </button>
    </div>

    <template v-else>
      <!-- KPI -->
      <div class="kpis">
        <div class="kpi" v-for="k in kpis" :key="k.label">
          <div class="kpi-label">{{ k.label }}</div>
          <div class="kpi-value">{{ k.value }}</div>
          <div class="kpi-sub">{{ k.sub }}</div>
        </div>
      </div>

      <!-- 行式项目卡片 -->
      <div class="panel">
        <div class="panel-header">
          <div>
            <h3 class="panel-title">{{ title }}项目</h3>
            <div class="panel-subtitle">{{ subtitle }}</div>
          </div>
          <div class="stage-tools">
            <button v-if="userStore.currentUser && !selectMode && status !== 'closed'" class="btn-del" @click="showNewTask = true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><path d="M12 5v14M5 12h14"/></svg>
              新建项目
            </button>
            <template v-if="!selectMode">
              <button v-if="canManageAny" class="btn-del" @click.stop="enterSelectMode">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg>
                删除项目
              </button>
            </template>
            <template v-else>
              <button class="btn-sm" @click.stop="toggleAll">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="m9 12 2 2 4-4"/></svg>
                {{ allSelected ? '取消全选' : '全选' }}
              </button>
              <button class="btn-del" @click.stop="batchDelete" :disabled="!selectedIds.size">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg>
                删除所选 ({{ selectedIds.size }})
              </button>
              <button class="btn-sm cancel" @click.stop="exitSelectMode">取消</button>
            </template>
            <select class="stage-select" v-model="year">
              <option value="all">全部年度</option>
              <option v-for="y in years" :key="y" :value="y">{{ y }} 年</option>
            </select>
            <select class="stage-select" v-model="month">
              <option value="all">全部月份</option>
              <option v-for="m in 12" :key="m" :value="String(m).padStart(2, '0')">{{ m }} 月</option>
            </select>
            <span class="stage-count">{{ filtered.length }} / {{ stageTasks.length }} 个项目</span>
          </div>
        </div>
        <div class="stage-table-wrap">
          <div class="proj-cards">
            <div
              v-for="(t, i) in filtered"
              :key="t.id"
              class="proj-card"
              :class="[pClass(t.priority), { 'is-overdue': deadlineClass(t) === 'overdue', 'is-selected': selectMode && selectedIds.has(t.id), 'is-disabled': selectMode && !canManage(t), 'no-deadline': !showDeadline }]"
              :title="cardTitle(t)"
              @click="selectMode ? toggleSelect(t) : openDrawer(t)"
            >
              <div v-if="selectMode" class="proj-card-check" @click.stop="toggleSelect(t)">
                <input type="checkbox" :checked="selectedIds.has(t.id)" :disabled="!canManage(t)" />
              </div>
              <div class="proj-card-num">{{ String(i + 1).padStart(2, '0') }}</div>
              <div class="proj-card-main">
                <div class="proj-card-title">{{ projName(t) }}</div>
                <div class="proj-card-desc" v-if="t.desc">{{ t.desc }}</div>
                <div class="proj-card-change">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 12 7-7M8 4h4v4" /></svg>
                  {{ fmtDate(t.createdAt) }} 创建
                </div>
              </div>
              <div class="proj-card-tags">
                <span class="g-pill" :class="statusPillClass"><span class="dot" :style="{ background: statusDotColor }"></span>{{ subStatusText(t) }}</span>
                <span class="g-pill" :class="priorityPill(t.priority)">{{ PRIORITY_NAMES[t.priority] || '中' }}</span>
              </div>
              <div class="proj-card-owner">
                <span class="avatar">{{ (t.owner || '?').slice(0, 1) }}</span>{{ t.owner || '—' }}
              </div>
              <div v-if="showDeadline" class="proj-card-deadline" :class="deadlineClass(t)" :title="planEndFull(t)">
                <svg class="dl-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
                {{ deadlineText(t) }}
              </div>
              <div class="proj-card-amount">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9.5v13" /><path d="m5 3 7 8 7-8" /><path d="M5 13h14" /><path d="M5 17h14" /></svg>
                <strong :class="{ tbd: !hasAmount(t) }">{{ amountText(t) }}</strong>
              </div>
            </div>
          </div>
          <div v-if="!filtered.length" class="stage-empty show">当前筛选条件下暂无项目</div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, inject } from 'vue'
import { ElMessageBox, ElMessage } from 'element-plus'
import { useTaskStore } from '../stores/taskStore'
import { useLogStore } from '../stores/logStore'
import { useUserStore } from '../stores/userStore'
import { PRIORITY_NAMES } from '../utils/constants'
import { isArchivedTask, isClosedProject, isAnyArchived, fmtDate } from '../utils/business'
import { activeTasks, matchYearMonth, contractAmountOf, fmtWan, yearOptions } from '../utils/finance'
import TaskFormModal from '../components/kanban/TaskFormModal.vue'

const props = defineProps({
  status: { type: String, required: true },
  title: { type: String, required: true },
  subtitle: { type: String, default: '' }
})

// 项目名称：优先取 XLS「项目名称」字段，回退任务标题
function projName(t) {
  return (t.projectInfo && t.projectInfo.projectName) || t.title || '—'
}

const taskStore = useTaskStore()
const logStore = useLogStore()
const userStore = useUserStore()
const openDrawer = inject('openTaskDrawer', () => {})
const showNewTask = ref(false)

// 权限：创建人本人或管理员可管理
const isAdmin = computed(() => userStore.isAdmin)
function canManage(t) {
  if (isAdmin.value) return true
  const me = userStore.currentUser?.username
  return !!me && t.owner === me
}
const canManageAny = computed(() => isAdmin.value || stageTasks.value.some(t => t.owner === userStore.currentUser?.username))

// ===== 批量删除：选择模式 =====
const selectMode = ref(false)
const selectedIds = ref(new Set())

function enterSelectMode() {
  selectMode.value = true
  selectedIds.value = new Set()
}

function exitSelectMode() {
  selectMode.value = false
  selectedIds.value = new Set()
}

function toggleSelect(t) {
  if (!canManage(t)) return
  const s = new Set(selectedIds.value)
  if (s.has(t.id)) s.delete(t.id)
  else s.add(t.id)
  selectedIds.value = s
}

const allSelected = computed(() => {
  const manageable = filtered.value.filter(t => canManage(t))
  return manageable.length > 0 && manageable.every(t => selectedIds.value.has(t.id))
})

function toggleAll() {
  const manageable = filtered.value.filter(t => canManage(t))
  if (allSelected.value) {
    selectedIds.value = new Set()
  } else {
    selectedIds.value = new Set(manageable.map(t => t.id))
  }
}

async function batchDelete() {
  const ids = [...selectedIds.value]
  if (!ids.length) return
  const names = ids.map(id => filtered.value.find(t => t.id === id)).filter(Boolean).map(t => projName(t))
  const preview = names.length > 3 ? names.slice(0, 3).join('、') + ` 等 ${names.length} 个` : names.join('、')
  try {
    await ElMessageBox.confirm(
      `确定删除「${preview}」项目吗？删除后不可恢复。`,
      '批量删除项目',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }
    )
  } catch (e) {
    return
  }
  taskStore.deleteTasks(ids)
  logStore.addLog('删除', `批量删除 ${ids.length} 个项目（${props.title}）：${names.join('、')}`, userStore.currentUser?.username || '系统')
  ElMessage.success(`已删除 ${ids.length} 个项目`)
  exitSelectMode()
}

const year = ref('all')
const month = ref('all')

// 数据源：closed 视图展示已关闭项目（业务/财务关闭等终态），其余按阶段过滨（活跃项目）
const stageTasks = computed(() => {
  if (props.status === 'closed') {
    return taskStore.tasks.filter(t => isClosedProject(t))
  }
  return activeTasks(taskStore.tasks).filter(t => t.status === props.status)
})
const filtered = computed(() => stageTasks.value.filter(t => matchYearMonth(t, year.value, month.value)))

const years = computed(() => yearOptions(taskStore.tasks))

const kpis = computed(() => {
  const list = stageTasks.value
  const total = activeTasks(taskStore.tasks).length || 1
  const high = list.filter(t => t.priority === 'high')
  const contract = list.reduce((a, t) => a + contractAmountOf(t), 0)
  const withAmount = list.filter(t => contractAmountOf(t) > 0)
  const avg = withAmount.length ? contract / withAmount.length : 0
  return [
    { label: '项目数量', value: list.length, sub: `占全部 ${Math.round(list.length / total * 100)}%` },
    { label: '合同总额', value: contract ? fmtWan(contract, 0) + ' 万' : '待定', sub: props.status === 'talk' ? '尚在前期阶段' : '含税' },
    { label: '高优先级', value: high.length, sub: high.length ? projName(high[0]) : '暂无' },
    { label: '平均金额（万）', value: withAmount.length ? fmtWan(avg, 0) : '—', sub: `${withAmount.length} 个有金额项目` }
  ]
})

const statusPillClass = computed(() => ({ talk: '', closed: 'warn', proc: 'warn', impl: 'good' }[props.status] || ''))
const statusDotColor = computed(() => ({ talk: 'var(--chart-orange)', closed: 'var(--chart-orange)', proc: 'var(--warn)', impl: 'var(--good)' }[props.status] || 'var(--muted)'))
// 剩余处置期限：仅前期/采购阶段显示（需求：实施/已关闭不展示）
const showDeadline = computed(() => props.status === 'talk' || props.status === 'proc')

function subStatusText(t) {
  if (props.status === 'closed') return (t.projectInfo && t.projectInfo.buildStatus) || '已关闭'
  if (t.status === 'impl') return t.implSub1 || '项目交付'
  return t.subStatus || STATUS_FALLBACK[t.status] || '进行中'
}
const STATUS_FALLBACK = { talk: '前期沟通', proc: '采购中', impl: '实施中' }

function hasAmount(t) { return contractAmountOf(t) > 0 }
function amountText(t) {
  const v = contractAmountOf(t)
  return v > 0 ? fmtWan(v, 0) + ' 万' : '待定'
}
function pClass(p) { return { high: 'p-high', medium: 'p-mid', low: 'p-low' }[p] || 'p-mid' }
function priorityPill(p) { return { high: 'bad', medium: 'warn', low: 'good' }[p] || 'warn' }

function planEndOf(t) {
  const pe = t?.projectInfo?.planEndDate
  if (!pe) return null
  const d = new Date(String(pe).replace(/\//g, '-'))
  return isNaN(d) ? null : d
}
function planEndFull(t) {
  const pe = t?.projectInfo?.planEndDate
  return pe ? `计划完成：${String(pe).slice(0, 10)}` : '未设置计划完成时间'
}
function cardTitle(t) {
  return `${projName(t)} · ${planEndFull(t)}`
}

function deadlineClass(t) {
  const d = planEndOf(t)
  if (!d) return 'normal'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (d < today) return 'overdue'
  const days = Math.round((d - today) / 86400000)
  return days <= 60 ? 'soon' : 'normal'
}

function deadlineText(t) {
  const d = planEndOf(t)
  if (!d) return '未设置'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = Math.round((d - today) / 86400000)
  if (days < 0) return `已逾期 ${Math.abs(days)} 天`
  return `剩余 ${days} 天`
}
</script>

<style scoped lang="scss">
.stage-view {
  padding: var(--space-5) var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.kpis {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-4);
}

/* 任务卡片容器：逐行堆叠，卡间留 7px 空白间隔 */
.proj-cards {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

@media (max-width: 1100px) {
  .kpis { grid-template-columns: repeat(2, 1fr); }

  .proj-card {
    grid-template-columns: 36px minmax(0, 1fr);
    row-gap: var(--space-2);

    .proj-card-main { grid-column: 2; grid-row: 1; }
    .proj-card-deadline { grid-column: 2; grid-row: 2; justify-content: flex-start; }
    .proj-card-tags { grid-column: 2; grid-row: 3; justify-content: flex-start; }
    .proj-card-owner { grid-column: 2; grid-row: 4; }
    .proj-card-amount { grid-column: 2; grid-row: 5; justify-content: flex-start; }

    &.no-deadline {
      .proj-card-amount { grid-row: 2; }
      .proj-card-tags { grid-row: 3; }
      .proj-card-owner { grid-row: 4; }
    }
  }
}

.empty-guide {
  text-align: center;
  padding: var(--space-12) var(--space-4);

  h3 { font-size: var(--text-base); font-weight: 600; margin-bottom: var(--space-2); color: var(--fg); }
  p { font-size: 13px; color: var(--muted); max-width: 420px; margin: 0 auto; }

  .btn-del {
    margin-top: var(--space-4);
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 32px;
    padding: 0 14px;
    border: none;
    border-radius: var(--radius-sm);
    background: var(--accent);
    color: var(--accent-on);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: background var(--motion-fast) var(--ease-standard);

    svg { flex-shrink: 0; }
    &:hover { background: var(--primary-hover); }
  }
}

.proj-card {
  position: relative;
  display: grid;
  grid-template-columns: 36px minmax(0, 1.6fr) auto 100px 130px 96px;
  align-items: center;
  gap: var(--space-4);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4) var(--space-3) calc(var(--space-5) + 6px);
  cursor: pointer;
  transition: border-color var(--motion-fast), box-shadow var(--motion-fast), transform var(--motion-fast);
  overflow: hidden;

  &:hover {
    border-color: color-mix(in oklch, var(--accent) 40%, transparent);
    box-shadow: var(--elev-raised);
    transform: translateY(-1px);
  }

  &.no-deadline {
    grid-template-columns: 36px minmax(0, 1.6fr) auto 100px 96px;
  }

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 10px;
    background: var(--muted);
  }

  &.p-high::before { background: var(--bad-soft); }
  &.p-mid::before { background: var(--warn-soft); }
  &.p-low::before { background: var(--good-soft); }

  &.is-overdue {
    background: color-mix(in oklch, var(--bad) 3%, var(--surface));
    border-color: color-mix(in oklch, var(--bad) 22%, transparent);
  }
  &.is-overdue:hover { border-color: color-mix(in oklch, var(--bad) 45%, transparent); }

  &.is-selected {
    background: color-mix(in oklch, var(--accent) 6%, var(--surface));
    border-color: color-mix(in oklch, var(--accent) 45%, transparent);
    box-shadow: 0 0 0 1px color-mix(in oklch, var(--accent) 30%, transparent);
  }

  &.is-disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
}

.proj-card-num {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: 20px;
  font-weight: 600;
  line-height: 1;
  color: color-mix(in oklch, var(--fg) 14%, transparent);
  text-align: center;
  user-select: none;
}

.proj-card:hover .proj-card-num { color: color-mix(in oklch, var(--fg) 26%, transparent); }

/* 选择模式复选框 */
.proj-card-check {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 2;
  cursor: pointer;

  input[type="checkbox"] {
    width: 18px;
    height: 18px;
    accent-color: var(--accent);
    cursor: pointer;
  }
}

.proj-card-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.proj-card-title {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.proj-card-desc {
  font-size: 12px;
  color: var(--muted);
  line-height: 1.5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.proj-card-change {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--muted);
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  svg { width: 10px; height: 10px; flex-shrink: 0; }
}

.proj-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: flex-end;
}

.proj-card-owner {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--fg);
  min-width: 0;

  .avatar {
    width: 22px;
    height: 22px;
    border-radius: var(--radius-pill);
    background: color-mix(in oklch, var(--accent) 18%, transparent);
    color: var(--accent);
    display: grid;
    place-items: center;
    font-size: 10px;
    font-weight: 600;
    flex-shrink: 0;
  }
}

.proj-card-deadline {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  font-size: 11px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;

  .dl-icon { width: 12px; height: 12px; flex-shrink: 0; }

  &.overdue {
    color: var(--bad);
    background: color-mix(in oklch, var(--bad) 8%, transparent);
    padding: 2px 8px;
    border-radius: var(--radius-pill);
    font-weight: 500;
  }
  &.soon {
    color: var(--warn);
    background: color-mix(in oklch, var(--warn) 10%, transparent);
    padding: 2px 8px;
    border-radius: var(--radius-pill);
    font-weight: 500;
  }
  &.normal {
    color: var(--good);
    background: color-mix(in oklch, var(--good) 10%, transparent);
    padding: 2px 8px;
    border-radius: var(--radius-pill);
    font-weight: 500;
  }
}

.proj-card-amount {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  font-size: 12px;
  color: var(--muted);
  white-space: nowrap;

  svg { width: 12px; height: 12px; flex-shrink: 0; }

  strong {
    color: var(--good);
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    font-weight: 600;

    &.tbd { color: var(--muted); font-weight: 400; }
  }
}

// 工具条删除按钮（与新建项目同主色样式）
.btn-del {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 30px;
  padding: 0 12px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: var(--accent-on);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: background var(--motion-fast) var(--ease-standard);

  svg { flex-shrink: 0; }
  &:hover { background: var(--primary-hover); }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
}

// 工具条小按钮（选择模式）
.btn-sm {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 30px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--fg);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: all var(--motion-fast) var(--ease-standard);

  svg { flex-shrink: 0; }
  &:hover { border-color: var(--accent); color: var(--accent); }

  &.cancel:hover { border-color: var(--bad); color: var(--bad); }
}
</style>
