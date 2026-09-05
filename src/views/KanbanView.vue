<template>
  <div class="kanban-view">
    <!-- 空数据引导 -->
    <div v-if="!active.length && !showClosed" class="panel empty-guide">
      <h3>暂无项目数据</h3>
      <p>点击工具栏「新建项目」从 Excel 批量导入，或手动录入第一条项目。</p>
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

      <!-- 项目总览表 -->
      <div class="panel">
        <div class="panel-header">
          <div>
            <h3 class="panel-title">项目总览</h3>
            <div class="panel-subtitle">点击项目行查看详情 · 可按年度/月度筛选 · 列可自定义</div>
          </div>
          <div class="stage-tools">
            <button v-if="userStore.currentUser" class="btn-new" @click="showNewTask = true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><path d="M12 5v14M5 12h14"/></svg>
              新建项目
            </button>
            <select class="stage-select" v-model="year">
              <option value="all">全部年度</option>
              <option v-for="y in years" :key="y" :value="y">{{ y }} 年</option>
            </select>
            <select class="stage-select" v-model="month">
              <option value="all">全部月份</option>
              <option v-for="m in 12" :key="m" :value="String(m).padStart(2, '0')">{{ m }} 月</option>
            </select>
            <label class="closed-toggle" :title="showClosed ? '当前显示全部未删除项目（含已关闭）' : '当前仅显示活跃项目（默认隐藏业务/财务关闭等终态项目）'">
              <input type="checkbox" v-model="showClosed" />
              显示已关闭项目
            </label>
            <span class="stage-count">{{ filtered.length }} / {{ active.length }} 个项目</span>
            <div class="col-config" ref="colConfigEl">
              <button class="stage-select col-config-btn" type="button" @click.stop="colPanelOpen = !colPanelOpen">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><path d="M3 5h18M3 12h12M3 19h6"/></svg>
                自定义列
              </button>
              <div v-if="colPanelOpen" class="col-panel" @click.stop>
                <div class="col-panel-head">
                  <span>选择要显示的字段</span>
                  <span class="col-panel-count">{{ selectedCols.length }} / {{ LIST_COLUMNS.length }}</span>
                </div>
                <div class="col-panel-list">
                  <label v-for="c in LIST_COLUMNS" :key="c.key" class="col-item">
                    <input type="checkbox" :value="c.key" v-model="selectedCols" />
                    <span>{{ c.label }}</span>
                  </label>
                </div>
                <div class="col-panel-foot">
                  <button type="button" class="col-reset" @click="resetCols">恢复默认</button>
                  <button type="button" class="col-done" @click="colPanelOpen = false">完成</button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="stage-table-wrap">
          <table class="ds-table">
            <thead>
              <tr>
                <th style="width:50px">序号</th>
                <th>项目名称</th>
                <th v-for="c in activeCols" :key="c.key" :title="c.label">{{ c.label }}</th>
                <th style="width:90px">看板阶段</th>
                <th style="width:90px">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(t, i) in filtered" :key="t.id" @click="openDrawer(t)" :class="{ 'row-closed': isClosed(t) }">
                <td class="num row-idx">{{ String(i + 1).padStart(2, '0') }}</td>
                <td class="cell-title" :title="titleFull(t)">
                  {{ projName(t) }}<span v-if="isMgName(t)" class="mg-flag">占位</span><span v-if="isClosed(t)" class="closed-flag">已关闭</span>
                </td>
                <td v-for="c in activeCols" :key="c.key" :class="cellClass(t, c)">
                  <span v-if="c.fmt === 'rate'" :style="rateStyle(t, c)">{{ cellText(t, c) }}</span>
                  <span v-else-if="c.key === 'buildStatus'" class="g-pill" :class="badgePill(t)"><span class="dot" :style="{ background: badgeDot(t) }"></span>{{ cellText(t, c) }}</span>
                  <span v-else>{{ cellText(t, c) }}</span>
                </td>
                <td><span class="g-pill" :class="statusPill(t.status)"><span class="dot" :style="{ background: statusDot(t.status) }"></span>{{ STATUS_NAMES[t.status] }}</span></td>
                <td>
                  <button v-if="canManage(t)" class="row-del" @click.stop="delOne(t)">删除</button>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-if="!filtered.length" class="stage-empty show">当前筛选条件下暂无项目</div>
        </div>
      </div>
    </template>

    <!-- 新建项目弹窗（模块内入口） -->
    <TaskFormModal v-model="showNewTask" />
  </div>
</template>

<script setup>
import { computed, ref, inject, onMounted, onBeforeUnmount, watch } from 'vue'
import { ElMessageBox, ElMessage } from 'element-plus'
import { useTaskStore } from '../stores/taskStore'
import { useLogStore } from '../stores/logStore'
import { useUserStore } from '../stores/userStore'
import { STATUS_NAMES, LIST_COLUMNS, LIST_COLUMNS_DEFAULT, LIST_COLUMNS_STORAGE_KEY, BUILD_STATUS_BADGE } from '../utils/constants'
import { isArchivedTask, isClosedProject, isOverdue } from '../utils/business'
import {
  activeTasks, matchYearMonth, contractAmountOf, fmtWan,
  collectionRateOf, revDoneRateOf, costExecRateOf, marginGapOf, metricsOf
} from '../utils/finance'
import { fmtMoney } from '../utils/business'
import TaskFormModal from '../components/kanban/TaskFormModal.vue'

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

// 单条删除（仅本人创建或管理员）
async function delOne(t) {
  try {
    await ElMessageBox.confirm(
      `确定删除项目「${projName(t)}」吗？删除后不可恢复。`,
      '删除项目',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }
    )
  } catch (e) {
    return
  }
  taskStore.deleteTask(t.id)
  logStore.addLog('删除', `删除项目「${projName(t)}」`, userStore.currentUser?.username || '系统')
  ElMessage.success('项目已删除')
}

const year = ref('all')
const month = ref('all')
// 显示已关闭项目（业务/财务关闭/完工/验收）：默认隐藏
const showClosed = ref(false)
const CLOSED_SHOW_KEY = 'szops_show_closed'

// 列表数据源：开关控制是否包含已关闭项目
const active = computed(() => activeTasks(taskStore.tasks, { includeClosed: showClosed.value }))

const years = computed(() => {
  const ys = [...new Set(active.value.map(t => (t.deadline || '').slice(0, 4)).filter(Boolean))]
  return ys.sort()
})

const filtered = computed(() => active.value.filter(t => matchYearMonth(t, year.value, month.value)))

const kpis = computed(() => {
  const list = filtered.value
  const talk = list.filter(t => t.status === 'talk').length
  const proc = list.filter(t => t.status === 'proc').length
  const impl = list.filter(t => t.status === 'impl').length
  const high = list.filter(t => t.priority === 'high').length
  const overdue = list.filter(t => isOverdue(t)).length
  // 指标口径：仅统计当前列表
  const m = list.map(t => metricsOf(t))
  const contract = m.reduce((a, x) => a + x.contract, 0)
  const inv = m.reduce((a, x) => a + x.accInvoice, 0)
  const col = m.reduce((a, x) => a + x.accCollection, 0)
  const planRev = m.reduce((a, x) => a + x.planRev, 0)
  const ledgerRev = m.reduce((a, x) => a + x.ledgerRev, 0)
  const planCost = m.reduce((a, x) => a + x.planCost, 0)
  const actualCost = m.reduce((a, x) => a + x.actualCost, 0)
  const closedCount = list.filter(t => isClosedProject(t)).length
  return [
    { label: '项目总数', value: list.length, sub: `前期 ${talk} · 采购 ${proc} · 实施 ${impl}${showClosed.value ? ` · 含已关闭 ${closedCount}` : ''}` },
    { label: '合同总额（万元）', value: contract ? fmtWan(contract, 0) : '—', sub: '不含税口径' },
    { label: '回款率', value: inv > 0 ? (col / inv * 100).toFixed(1) + '%' : '—', sub: inv > 0 ? `收款 ${fmtWan(col, 0)} / 开票 ${fmtWan(inv, 0)} 万` : '暂无开票数据' },
    { label: '收入完成率', value: planRev > 0 ? (ledgerRev / planRev * 100).toFixed(1) + '%' : '—', sub: planRev > 0 ? `列账 ${fmtWan(ledgerRev, 0)} / 计划 ${fmtWan(planRev, 0)} 万` : '暂无计划收入' },
    { label: '成本执行率', value: planCost > 0 ? (actualCost / planCost * 100).toFixed(1) + '%' : '—', sub: planCost > 0 ? `实际 ${fmtWan(actualCost, 0)} / 计划 ${fmtWan(planCost, 0)} 万${actualCost > planCost ? ' · 超支' : ''}` : '暂无计划成本' },
    { label: '逾期风险', value: overdue, sub: `待决策 ${list.filter(t => t.needDecision).length} · 高优先级 ${high}` }
  ]
})

function statusPill(s) {
  return { talk: '', proc: 'warn', impl: 'good' }[s] || ''
}
function statusDot(s) {
  return { talk: 'var(--chart-orange)', proc: 'var(--warn)', impl: 'var(--good)' }[s] || 'var(--muted)'
}

// 系统项目状态徽标（buildStatus）
function badgePill(t) {
  return (BUILD_STATUS_BADGE[t?.projectInfo?.buildStatus] || {}).pill || ''
}
function badgeDot(t) {
  return (BUILD_STATUS_BADGE[t?.projectInfo?.buildStatus] || {}).dot || 'var(--muted)'
}
function isClosed(t) {
  return isClosedProject(t)
}

// ===== 项目名称：优先取 XLS「项目名称」字段，回退任务标题 =====
function projName(t) {
  return (t.projectInfo && t.projectInfo.projectName) || t.title || '—'
}
// 名称全称（悬浮提示）：名称 + 编号
function titleFull(t) {
  const info = t.projectInfo || {}
  const name = info.projectName || t.title || '—'
  return info.projectId ? `${name}（编号 ${info.projectId}）` : name
}
// MG 开头占位名
function isMgName(t) {
  const n = projName(t)
  return /^MG\d+/i.test(n)
}

// ===== 可配置列（个人习惯，按用户持久化）=====
const colPanelOpen = ref(false)
const colConfigEl = ref(null)

function loadCols() {
  try {
    const raw = JSON.parse(localStorage.getItem(LIST_COLUMNS_STORAGE_KEY) || 'null')
    if (Array.isArray(raw)) {
      // 过滤掉已下线的字段 key，保持顺序
      const valid = raw.filter(k => LIST_COLUMNS.some(c => c.key === k))
      return valid.length ? valid : [...LIST_COLUMNS_DEFAULT]
    }
  } catch (e) { /* ignore */ }
  return [...LIST_COLUMNS_DEFAULT]
}

const selectedCols = ref(loadCols())

// 实际渲染的列（按 LIST_COLUMNS 定义顺序 + 用户选择）
const activeCols = computed(() => LIST_COLUMNS.filter(c => selectedCols.value.includes(c.key)))

watch(selectedCols, (v) => {
  localStorage.setItem(LIST_COLUMNS_STORAGE_KEY, JSON.stringify(v))
}, { deep: true })

// 已关闭项目开关持久化
try {
  const saved = localStorage.getItem(CLOSED_SHOW_KEY)
  if (saved === '1') showClosed.value = true
} catch (e) { /* ignore */ }
watch(showClosed, (v) => {
  try { localStorage.setItem(CLOSED_SHOW_KEY, v ? '1' : '0') } catch (e) { /* ignore */ }
})

function resetCols() {
  selectedCols.value = [...LIST_COLUMNS_DEFAULT]
}

function onDocClick(e) {
  if (colConfigEl.value && !colConfigEl.value.contains(e.target)) colPanelOpen.value = false
}
onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))

// 单元格取值与格式化
function cellText(t, c) {
  const info = t.projectInfo || {}
  // 计算列
  switch (c.key) {
    case 'revDoneRate': {
      const r = revDoneRateOf(t)
      return r === null ? '—' : (r * 100).toFixed(1) + '%'
    }
    case 'collectionRate': {
      const r = collectionRateOf(t)
      return r === null ? '—' : (r * 100).toFixed(1) + '%'
    }
    case 'costExecRate': {
      const r = costExecRateOf(t)
      return r === null ? '—' : (r * 100).toFixed(1) + '%'
    }
    case 'marginGap': {
      const r = marginGapOf(t)
      return r === null ? '—' : (r > 0 ? '+' : '') + r.toFixed(1)
    }
  }
  // 创建日期列：优先取 Excel「创建日期」(projectInfo.createdDate)，回退本地创建时间
  const v = c.key === 'createdAt'
    ? (info.createdDate || t.createdAt)
    : info[c.key]
  if (v === '' || v === undefined || v === null) return '—'
  if (c.fmt === 'money') {
    const n = Number(v)
    return isNaN(n) ? v : fmtWan(n)
  }
  if (c.fmt === 'date') {
    return String(v).slice(0, 10) || '—'
  }
  if (c.fmt === 'num') {
    return String(v)
  }
  return String(v)
}

// 比率列颜色阈值
function rateStyle(t, c) {
  let v = null
  if (c.key === 'revDoneRate') v = revDoneRateOf(t)
  else if (c.key === 'collectionRate') v = collectionRateOf(t)
  else if (c.key === 'costExecRate') v = costExecRateOf(t)
  else if (c.key === 'marginGap') return { color: marginGapOf(t) !== null && marginGapOf(t) < 0 ? 'var(--bad)' : undefined, fontWeight: 600 }
  if (v === null) return {}
  if (c.key === 'collectionRate') {
    if (v < 0.3) return { color: 'var(--bad)', fontWeight: 600 }
    if (v < 0.6) return { color: 'var(--warn)', fontWeight: 600 }
    return { fontWeight: 600 }
  }
  if (c.key === 'costExecRate') {
    if (v > 1) return { color: 'var(--bad)', fontWeight: 600 }
    return { fontWeight: 600 }
  }
  return {}
}

function cellClass(t, c) {
  return c.fmt === 'money' || c.fmt === 'num' || c.fmt === 'rate' ? 'num' : 'cell-text'
}
</script>

<style scoped lang="scss">
.kanban-view {
  padding: var(--space-5) var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.kpis {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: var(--space-4);
}

@media (max-width: 1400px) {
  .kpis { grid-template-columns: repeat(3, 1fr); }
}

@media (max-width: 900px) {
  .kpis { grid-template-columns: repeat(2, 1fr); }
}

.empty-guide {
  text-align: center;
  padding: var(--space-12) var(--space-4);

  h3 { font-size: var(--text-base); font-weight: 600; margin-bottom: var(--space-2); color: var(--fg); }
  p { font-size: 13px; color: var(--muted); max-width: 420px; margin: 0 auto; }
}

.cell-title {
  font-weight: 500;
  min-width: 220px;
  white-space: normal;
  word-break: break-all;
  line-height: 1.5;
}

.cell-text { font-size: 13px; }

// 已关闭行淡显
.row-closed td { opacity: 0.62; }

// MG 占位名标记
.mg-flag,
.closed-flag {
  display: inline-block;
  font-size: 10px;
  font-weight: 500;
  padding: 0 5px;
  border-radius: var(--radius-sm);
  margin-left: 6px;
  vertical-align: 1px;
  white-space: nowrap;
}
.mg-flag {
  background: color-mix(in oklch, var(--muted) 14%, transparent);
  color: var(--muted);
  border: 1px solid color-mix(in oklch, var(--muted) 26%, transparent);
}
.closed-flag {
  background: color-mix(in oklch, var(--chart-orange) 12%, transparent);
  color: var(--chart-orange);
  border: 1px solid color-mix(in oklch, var(--chart-orange) 28%, transparent);
}

// 新建项目按钮（主色，与全站新建入口同款）
.btn-new {
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
}

// 已关闭开关
.closed-toggle {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--fg);
  cursor: pointer;
  white-space: nowrap;
  user-select: none;

  input { accent-color: var(--accent); cursor: pointer; }
}

// ===== 自定义列选择器 =====
.col-config {
  position: relative;
}

.col-config-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;

  svg { flex-shrink: 0; }
}

.col-panel {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  width: 300px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.14);
  z-index: 120;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.col-panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  font-size: 12px;
  font-weight: 600;
  color: var(--fg);

  .col-panel-count {
    font-weight: 400;
    color: var(--muted);
    font-family: var(--font-mono);
  }
}

.col-panel-list {
  max-height: 300px;
  overflow-y: auto;
  padding: var(--space-2);
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px;
}

.col-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--fg);
  cursor: pointer;
  white-space: nowrap;

  &:hover { background: var(--bg); }

  input { accent-color: var(--accent); cursor: pointer; flex-shrink: 0; }
}

.col-panel-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-top: 1px solid var(--border);

  button {
    border: none;
    background: var(--bg);
    color: var(--accent);
    font-size: 12px;
    padding: 4px 10px;
    border-radius: var(--radius-sm);
    cursor: pointer;

    &:hover { background: var(--accent-soft); }
  }

  .col-done {
    background: var(--accent);
    color: var(--accent-on);
    font-weight: 500;

    &:hover { background: var(--primary-hover); }
  }
}

.row-idx {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: color-mix(in oklch, var(--fg) 30%, transparent);
  text-align: center;
}

// 表格行内删除按钮（小号描边）
.row-del {
  font: inherit;
  font-size: 12px;
  padding: 3px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid color-mix(in oklch, var(--bad) 30%, transparent);
  background: var(--surface);
  color: var(--bad);
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--motion-fast) var(--ease-standard);

  &:hover {
    background: color-mix(in oklch, var(--bad) 8%, transparent);
    border-color: color-mix(in oklch, var(--bad) 45%, transparent);
  }
}
</style>
