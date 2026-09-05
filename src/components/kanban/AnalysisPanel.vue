<template>
  <div class="analysis-panel">
    <!-- 维度 Tab + 轮盘配置入口 -->
    <div class="panel-header">
      <div>
        <h3 class="panel-title">经营分析</h3>
        <div class="panel-subtitle">四维度指标矩阵 · 默认含已关闭项目 · 点击行可跳转总览</div>
      </div>
      <div class="ana-tools">
        <div class="dim-tabs">
          <button v-for="d in DIMS" :key="d.key" class="dim-tab" :class="{ active: dim === d.key }" type="button" @click="dim = d.key">{{ d.label }}</button>
        </div>
        <button class="scope-btn" type="button" :class="{ active: scopeOn }" @click="scopeOpen = !scopeOpen" title="统计范围配置">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
            <circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="3.5" /><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M5.8 5.8l1.4 1.4M16.8 16.8l1.4 1.4M18.2 5.8l-1.4 1.4M7.2 16.8l-1.4 1.4" />
          </svg>
          统计范围
          <span v-if="scopeOn" class="scope-badge">{{ selectedIds.length }}</span>
        </button>
      </div>
    </div>

    <!-- 轮盘：统计范围选择弹层 -->
    <div v-if="scopeOpen" class="scope-panel">
      <div class="scope-head">
        <span class="scope-title">统计范围（默认全部项目 · 含已关闭）</span>
        <button class="scope-reset" type="button" @click="resetScope">恢复默认</button>
      </div>
      <div class="scope-filters">
        <select class="stage-select" v-model="scopeYear">
          <option value="all">全部年度</option>
          <option v-for="y in scopeYears" :key="y" :value="y">{{ y }} 年</option>
        </select>
        <select class="stage-select" v-model="scopeMonth">
          <option value="all">全部月份</option>
          <option v-for="m in 12" :key="m" :value="String(m).padStart(2, '0')">{{ m }} 月</option>
        </select>
        <select class="stage-select" v-model="scopePm">
          <option value="all">全部项目经理</option>
          <option v-for="p in pmList" :key="p" :value="p">{{ p }}</option>
        </select>
        <span class="scope-count">{{ selectable.length }} 个项目可选</span>
        <button class="scope-checks" type="button" @click="checkAllVisible">全选当前列表</button>
        <button class="scope-checks" type="button" @click="clearVisible">清空选择</button>
      </div>
      <div class="scope-list">
        <label v-for="p in selectable" :key="p.id" class="scope-item" :class="{ closed: CLOSED_SET.has(p.buildStatus) }">
          <input type="checkbox" :value="p.id" v-model="selectedIds" />
          <span class="scope-name" :title="p.name">{{ p.name }}</span>
          <span class="scope-pm">{{ p.pm || '—' }}</span>
          <span class="scope-status">{{ p.buildStatus || '—' }}</span>
          <span class="scope-date">{{ (p.createdDate || '').slice(0, 10) }}</span>
          <span class="scope-amount">{{ p.contract ? fmtWan(p.contract, 0) + ' 万' : '—' }}</span>
        </label>
      </div>
      <div class="scope-foot">
        <span>已选 {{ selectedIds.length }} / {{ selectable.length }}（筛选条件仅影响列表，不直接改变统计范围）</span>
        <button class="scope-done" type="button" @click="scopeOpen = false">完成</button>
      </div>
    </div>

    <!-- 指标矩阵 -->
    <div class="matrix-wrap">
      <table class="ds-table">
        <thead>
          <tr>
            <th>{{ dimLabel }}</th>
            <th>项目数</th>
            <th>合同金额</th>
            <th>计划收入</th>
            <th>列账收入</th>
            <th>收入完成率</th>
            <th>累计开票</th>
            <th>累计收款</th>
            <th>回款率</th>
            <th>计划成本</th>
            <th>实际成本</th>
            <th>成本执行率</th>
            <th>计划毛利率</th>
            <th>实际毛利率</th>
            <th>毛利差</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.label" @click="jumpToOverview(r.label)">
            <td class="cell-dim">{{ r.label }}</td>
            <td class="num">{{ r.count }}</td>
            <td class="num">{{ fmtWan(r.contract, 1) }}</td>
            <td class="num">{{ fmtWan(r.planRev, 1) }}</td>
            <td class="num">{{ fmtWan(r.ledgerRev, 1) }}</td>
            <td class="num" :style="rateStyle(r.revDoneRate)">{{ pct(r.revDoneRate) }}</td>
            <td class="num">{{ fmtWan(r.accInvoice, 1) }}</td>
            <td class="num">{{ fmtWan(r.accCollection, 1) }}</td>
            <td class="num" :style="rateStyle(r.collectionRate, 'coll')">{{ pct(r.collectionRate) }}</td>
            <td class="num">{{ fmtWan(r.planCost, 1) }}</td>
            <td class="num">{{ fmtWan(r.actualCost, 1) }}</td>
            <td class="num" :style="rateStyle(r.costExecRate, 'cost')">{{ pct(r.costExecRate) }}</td>
            <td class="num">{{ r.planRate === null ? '—' : r.planRate.toFixed(1) + '%' }}</td>
            <td class="num">{{ r.actualRate === null ? '—' : r.actualRate.toFixed(1) + '%' }}</td>
            <td class="num" :style="rateStyle(r.marginGap, 'gap')">{{ r.marginGap === null ? '—' : (r.marginGap > 0 ? '+' : '') + r.marginGap.toFixed(1) }}</td>
          </tr>
          <tr class="row-total" v-if="total">
            <td class="cell-dim">合计</td>
            <td class="num">{{ total.count }}</td>
            <td class="num">{{ fmtWan(total.contract, 1) }}</td>
            <td class="num">{{ fmtWan(total.planRev, 1) }}</td>
            <td class="num">{{ fmtWan(total.ledgerRev, 1) }}</td>
            <td class="num" :style="rateStyle(total.revDoneRate)">{{ pct(total.revDoneRate) }}</td>
            <td class="num">{{ fmtWan(total.accInvoice, 1) }}</td>
            <td class="num">{{ fmtWan(total.accCollection, 1) }}</td>
            <td class="num" :style="rateStyle(total.collectionRate, 'coll')">{{ pct(total.collectionRate) }}</td>
            <td class="num">{{ fmtWan(total.planCost, 1) }}</td>
            <td class="num">{{ fmtWan(total.actualCost, 1) }}</td>
            <td class="num" :style="rateStyle(total.costExecRate, 'cost')">{{ pct(total.costExecRate) }}</td>
            <td class="num">{{ total.planRate === null ? '—' : total.planRate.toFixed(1) + '%' }}</td>
            <td class="num">{{ total.actualRate === null ? '—' : total.actualRate.toFixed(1) + '%' }}</td>
            <td class="num" :style="rateStyle(total.marginGap, 'gap')">{{ total.marginGap === null ? '—' : (total.marginGap > 0 ? '+' : '') + total.marginGap.toFixed(1) }}</td>
          </tr>
        </tbody>
      </table>
      <div v-if="!rows.length" class="stage-empty show">当前统计范围内暂无项目</div>
    </div>

    <!-- 排名预警 -->
    <div class="warn-grid">
      <div class="warn-card">
        <div class="warn-title">回款率最低 TOP5</div>
        <div class="warn-row" v-for="r in worstColl" :key="r.task.id" @click="openDrawer(r.task)">
          <span class="warn-name" :title="r.task.projectInfo?.projectName || r.task.title">{{ r.task.projectInfo?.projectName || r.task.title }}</span>
          <span class="warn-val bad">{{ (r.rate * 100).toFixed(1) }}%</span>
        </div>
        <div v-if="!worstColl.length" class="warn-empty">暂无开票项目</div>
      </div>
      <div class="warn-card">
        <div class="warn-title">实际毛利率最低 TOP5</div>
        <div class="warn-row" v-for="r in worstMarg" :key="r.task.id" @click="openDrawer(r.task)">
          <span class="warn-name" :title="r.task.projectInfo?.projectName || r.task.title">{{ r.task.projectInfo?.projectName || r.task.title }}</span>
          <span class="warn-val" :class="r.rate < 0 ? 'bad' : 'warn'">{{ r.rate.toFixed(1) }}%</span>
        </div>
        <div v-if="!worstMarg.length" class="warn-empty">暂无毛利率数据</div>
      </div>
      <div class="warn-card">
        <div class="warn-title">成本超支项目（执行率 &gt;100%）</div>
        <div class="warn-row" v-for="r in overruns" :key="r.task.id" @click="openDrawer(r.task)">
          <span class="warn-name" :title="r.task.projectInfo?.projectName || r.task.title">{{ r.task.projectInfo?.projectName || r.task.title }}</span>
          <span class="warn-val bad">{{ (r.rate * 100).toFixed(0) }}%</span>
        </div>
        <div v-if="!overruns.length" class="warn-empty">无超支项目</div>
      </div>
      <div class="warn-card">
        <div class="warn-title">零收款在建项目</div>
        <div class="warn-row" v-for="t in zeroColl" :key="t.id" @click="openDrawer(t)">
          <span class="warn-name" :title="t.projectInfo?.projectName || t.title">{{ t.projectInfo?.projectName || t.title }}</span>
          <span class="warn-val muted">{{ (t.projectInfo?.createdDate || '').slice(0, 10) || '—' }}</span>
        </div>
        <div v-if="!zeroColl.length" class="warn-empty">无零收款在建项目</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch, inject } from 'vue'
import { groupMetrics, groupMetricsTotal, worstCollection, worstMargin, costOverruns, zeroCollectionOngoing, fmtWan, selectableProjects, pmOptions, yearOptions } from '../../utils/finance'

const props = defineProps({
  // 全部项目（含已关闭、排除老归档），由父级 KanbanView 传入
  tasks: { type: Array, default: () => [] },
  year: { type: String, default: 'all' },
  month: { type: String, default: 'all' }
})
const emit = defineEmits(['jump'])

const openDrawer = inject('openTaskDrawer', () => {})

const DIMS = [
  { key: 'buildStatus', label: '项目状态' },
  { key: 'mainTag', label: '战新标签' },
  { key: 'pmName', label: '项目经理' },
  { key: 'clientName', label: '客户' }
]
const CLOSED_SET = new Set(['完工', '验收', '业务关闭', '财务关闭'])

const dim = ref('buildStatus')
const dimLabel = computed(() => DIMS.find(d => d.key === dim.value).label)

// ===== 轮盘：统计范围 =====
const scopeOpen = ref(false)
const scopeYear = ref('all')
const scopeMonth = ref('all')
const scopePm = ref('all')
const selectedIds = ref([])
const SCOPE_KEY = 'szops_analysis_scope'
try {
  const saved = JSON.parse(localStorage.getItem(SCOPE_KEY) || 'null')
  if (Array.isArray(saved)) selectedIds.value = saved
} catch (e) { /* ignore */ }
watch(selectedIds, (v) => {
  try { localStorage.setItem(SCOPE_KEY, JSON.stringify(v)) } catch (e) { /* ignore */ }
}, { deep: true })

const scopeOn = computed(() => selectedIds.value.length > 0)

// 统计基数：默认全部（含已关闭），勾选后仅统计选中项目
const baseTasks = computed(() => {
  const ymFiltered = props.tasks.filter(t => matchYM(t))
  if (!scopeOn.value) return ymFiltered
  const ids = new Set(selectedIds.value)
  return ymFiltered.filter(t => ids.has(t.id))
})

function matchYM(t) {
  // 复用全局年度/月度筛选（createdDate 口径）
  const ds = String(t.projectInfo?.createdDate || '').replace(/\//g, '-')
  if (props.year === 'all' && props.month === 'all') return true
  if (!ds) return false
  const parts = ds.split('-')
  const y = parts[0]
  const m = parts[1] ? String(parseInt(parts[1], 10)).padStart(2, '0') : ''
  if (props.year !== 'all' && y !== props.year) return false
  if (props.month !== 'all' && m !== props.month) return false
  return true
}

// 轮盘列表数据源
const selectable = computed(() => selectableProjects(props.tasks, { year: scopeYear.value, month: scopeMonth.value, pm: scopePm.value }))
const pmList = computed(() => pmOptions(props.tasks))
const scopeYears = computed(() => yearOptions(props.tasks))

function checkAllVisible() {
  const ids = new Set(selectedIds.value)
  selectable.value.forEach(p => ids.add(p.id))
  selectedIds.value = [...ids]
}
function clearVisible() {
  selectedIds.value = []
}
function resetScope() {
  selectedIds.value = []
  scopeYear.value = 'all'
  scopeMonth.value = 'all'
  scopePm.value = 'all'
}

// ===== 矩阵 =====
const rows = computed(() => groupMetrics(baseTasks.value, dim.value))
const total = computed(() => groupMetricsTotal(baseTasks.value))

// ===== 排名预警 =====
const worstColl = computed(() => worstCollection(baseTasks.value, 5))
const worstMarg = computed(() => worstMargin(baseTasks.value, 5))
const overruns = computed(() => costOverruns(baseTasks.value))
const zeroColl = computed(() => zeroCollectionOngoing(baseTasks.value))

// 跳转总览并应用维度筛选（emit 给父级切换 Tab）
function jumpToOverview(label) {
  emit('jump', { dim: dim.value, label })
}

function pct(v) {
  return v === null || v === undefined ? '—' : (v * 100).toFixed(1) + '%'
}
function rateStyle(v, kind) {
  if (v === null || v === undefined) return {}
  if (kind === 'coll') {
    if (v < 0.3) return { color: 'var(--bad)', fontWeight: 600 }
    if (v < 0.6) return { color: 'var(--warn)', fontWeight: 600 }
    return { fontWeight: 600 }
  }
  if (kind === 'cost') {
    if (v > 1) return { color: 'var(--bad)', fontWeight: 600 }
    return { fontWeight: 600 }
  }
  if (kind === 'gap') {
    if (v < 0) return { color: 'var(--bad)', fontWeight: 600 }
    return { fontWeight: 600 }
  }
  return { fontWeight: 600 }
}
</script>

<style scoped lang="scss">
.analysis-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.ana-tools {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.dim-tabs {
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.dim-tab {
  font: inherit;
  font-size: 12px;
  padding: 5px 12px;
  border: none;
  background: var(--surface);
  color: var(--muted);
  cursor: pointer;
  transition: all var(--motion-fast) var(--ease-standard);

  & + .dim-tab { border-left: 1px solid var(--border); }
  &:hover { color: var(--fg); }
  &.active {
    background: var(--accent);
    color: var(--accent-on);
    font-weight: 500;
  }
}

.scope-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font: inherit;
  font-size: 12px;
  padding: 5px 12px;
  height: 28px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--fg);
  cursor: pointer;
  transition: all var(--motion-fast) var(--ease-standard);

  &:hover { border-color: color-mix(in oklch, var(--accent) 40%, transparent); }
  &.active {
    background: var(--accent-soft);
    border-color: color-mix(in oklch, var(--accent) 40%, transparent);
    color: var(--accent);
  }

  .scope-badge {
    font-family: var(--font-mono);
    background: var(--accent);
    color: var(--accent-on);
    border-radius: var(--radius-pill);
    padding: 0 6px;
    font-size: 10px;
    line-height: 16px;
  }
}

// 轮盘弹层
.scope-panel {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg);
  padding: var(--space-3) var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.scope-head {
  display: flex;
  justify-content: space-between;
  align-items: center;

  .scope-title { font-size: 12px; font-weight: 600; color: var(--fg); }
  .scope-reset {
    font: inherit;
    font-size: 12px;
    border: none;
    background: transparent;
    color: var(--accent);
    cursor: pointer;
    padding: 2px 6px;
    &:hover { text-decoration: underline; }
  }
}

.scope-filters {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
  font-size: 12px;

  .scope-count { color: var(--muted); }

  .scope-checks {
    font: inherit;
    font-size: 12px;
    padding: 4px 10px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--fg);
    cursor: pointer;
    &:hover { border-color: color-mix(in oklch, var(--accent) 40%, transparent); color: var(--accent); }
  }
}

.scope-list {
  max-height: 260px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  display: flex;
  flex-direction: column;
}

.scope-item {
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr) 80px 70px 90px 90px;
  align-items: center;
  gap: var(--space-2);
  padding: 6px 10px;
  font-size: 12px;
  color: var(--fg);
  cursor: pointer;
  border-bottom: 1px solid color-mix(in oklch, var(--border) 50%, transparent);

  &:last-child { border-bottom: none; }
  &:hover { background: var(--bg); }
  &.closed .scope-name { opacity: 0.62; }

  input { accent-color: var(--accent); cursor: pointer; }

  .scope-name {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-weight: 500;
  }
  .scope-pm, .scope-status, .scope-date { color: var(--muted); font-size: 11px; }
  .scope-amount {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    text-align: right;
    font-size: 11px;
  }
}

.scope-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: var(--muted);

  .scope-done {
    font: inherit;
    font-size: 12px;
    padding: 4px 14px;
    border: none;
    border-radius: var(--radius-sm);
    background: var(--accent);
    color: var(--accent-on);
    font-weight: 500;
    cursor: pointer;
    &:hover { background: var(--primary-hover); }
  }
}

// 矩阵
.matrix-wrap { overflow-x: auto; }

.matrix-wrap table { min-width: 1100px; }

.cell-dim {
  font-weight: 600;
  white-space: nowrap;
  position: sticky;
  left: 0;
  background: var(--surface);
}

.row-total td {
  background: color-mix(in oklch, var(--accent) 6%, var(--surface));
  font-weight: 600;
  border-top: 2px solid var(--border);
}

// 排名预警卡片
.warn-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-4);
}

@media (max-width: 1400px) {
  .warn-grid { grid-template-columns: repeat(2, 1fr); }
}

.warn-card {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  background: var(--surface);
}

.warn-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--fg);
  margin-bottom: var(--space-2);
}

.warn-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
  font-size: 12px;
  padding: 4px 0;
  cursor: pointer;

  &:hover .warn-name { color: var(--accent); }
}

.warn-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--fg);
}

.warn-val {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  flex-shrink: 0;

  &.bad { color: var(--bad); }
  &.warn { color: var(--warn); }
  &.muted { color: var(--muted); font-weight: 400; }
}

.warn-empty {
  font-size: 12px;
  color: var(--muted);
  padding: 4px 0;
}
</style>
