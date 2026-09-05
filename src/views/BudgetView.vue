<template>
  <div class="budget-view">
    <!-- 年度/月度筛选器 -->
    <div class="filter-bar">
      <select class="stage-select" v-model="year">
        <option value="all">全部年度</option>
        <option v-for="y in years" :key="y" :value="y">{{ y }} 年</option>
      </select>
      <select class="stage-select" v-model="month">
        <option value="all">全部月份</option>
        <option v-for="m in 12" :key="m" :value="String(m).padStart(2, '0')">{{ m }} 月</option>
      </select>
      <ProjectMultiSelect :projects="implProjects" v-model="selectedProjectIds" />
      <span class="filter-count">{{ filteredActive.length }} / {{ active.length }} 个项目</span>
      <button class="btn btn-secondary target-btn" @click="openTargets">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 10h4.5a2 2 0 0 1 0 4H8"/></svg>
        部门目标设置
      </button>
    </div>

    <!-- 部门目标达成（有目标数据才显示） -->
    <div v-if="hasTargets" class="panel target-panel">
      <div class="panel-header">
        <div>
          <h3 class="panel-title">部门目标达成 · {{ targetPeriodLabel }}</h3>
          <div class="panel-subtitle">实际值取自当前筛选范围（年度/月度/项目多选）的统计结果</div>
        </div>
        <span class="g-pill accent"><span class="dot"></span>{{ curTargetSource }}</span>
      </div>
      <div class="target-grid">
        <div class="target-card" v-for="m in targetCards" :key="m.key" :class="m.state">
          <div class="tc-label">{{ m.label }}</div>
          <div class="tc-value mono">{{ m.actual }} <span class="unit">{{ m.unit }}</span></div>
          <div class="tc-target">目标 {{ m.target }}{{ m.unit }}</div>
          <div class="tc-bar">
            <div class="tc-fill" :style="{ width: m.pct + '%' }"></div>
          </div>
          <div class="tc-foot">
            <span class="tc-pct" :class="m.pct >= 100 ? 'ok' : 'no'">{{ m.pct }}%</span>
            <span class="tc-state">{{ m.stateText }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="!rows.length" class="panel empty-guide">
      <h3>暂无预算数据</h3>
      <p>导入含「计划收入 / 列账收入 / 计划成本 / 实际成本 / 毛利率」等字段的 Excel 后，此处将展示预算对照与部门毛利分析。</p>
    </div>

    <template v-else>

      <!-- KPI：四项带色点 -->
      <div class="kpis">
        <div class="kpi kpi-dot kd-accent">
          <div class="kpi-label">计划收入（未税）</div>
          <div class="kpi-value">{{ kpiText(totals.planRev) }} <span v-if="totals.planRev" class="unit">万</span></div>
          <div class="kpi-delta" :class="deltaCls(totals.planRev, totals.ledgerRev)"><span class="delta-arrow">{{ deltaArrow(totals.planRev, totals.ledgerRev) }}</span>{{ deltaText(totals.planRev, totals.ledgerRev) }}</div>
          <div class="kpi-sub">项目数 {{ rows.length }}</div>
        </div>
        <div class="kpi kpi-dot kd-teal">
          <div class="kpi-label">列账收入（未税）</div>
          <div class="kpi-value">{{ kpiText(totals.ledgerRev) }} <span v-if="totals.ledgerRev" class="unit">万</span></div>
          <div class="kpi-delta" :class="deltaCls(totals.planRev, totals.ledgerRev)"><span class="delta-arrow">{{ deltaArrow(totals.planRev, totals.ledgerRev) }}</span>达成率 {{ (revRate * 100).toFixed(1) }}%</div>
          <div class="kpi-sub">{{ revGapText }}</div>
        </div>
        <div class="kpi kpi-dot kd-gold">
          <div class="kpi-label">计划毛利率</div>
          <div class="kpi-value">{{ totals.planRate ? totals.planRate.toFixed(1) + '%' : '—' }}</div>
          <div class="kpi-delta flat"><span class="delta-arrow">—</span>目标 45%</div>
          <div class="kpi-sub">按计划口径加权</div>
        </div>
        <div class="kpi kpi-dot kd-bad">
          <div class="kpi-label">实际毛利率</div>
          <div class="kpi-value">{{ totals.actualRate ? totals.actualRate.toFixed(1) + '%' : '—' }}</div>
          <div class="kpi-delta" :class="rateDiff > 0 ? 'up' : 'down'"><span class="delta-arrow">{{ rateDiff > 0 ? '↑' : '↓' }}</span>{{ Math.abs(rateDiff).toFixed(1) }}pp</div>
          <div class="kpi-sub">{{ rateDiff >= 0 ? '达到计划' : '低于计划' }}</div>
        </div>
      </div>

      <!-- 预算 6 组对照 · 按项目 -->
      <div class="panel">
        <div class="panel-header">
          <div>
            <h3 class="panel-title">预算 {{ rows.length }} 组对照 · 按项目</h3>
            <div class="panel-subtitle">计划 vs 实际 · 收入 / 成本 / 毛利率</div>
          </div>
          <div class="budget-legend">
            <span class="legend-item"><span class="legend-dot plan-dot"></span>计划</span>
            <span class="legend-item"><span class="legend-dot" style="background: var(--chart-teal);"></span>收入实际</span>
            <span class="legend-item"><span class="legend-dot" style="background: var(--chart-orange);"></span>成本实际</span>
            <span class="legend-item"><span class="legend-dot" style="background: var(--chart-gold);"></span>毛利率</span>
            <span class="legend-item"><span class="legend-dot" style="background: var(--bad);"></span>超预算</span>
          </div>
        </div>
        <div class="budget-cards">
          <div class="budget-card" v-for="r in rows" :key="r.task.id" @click="openDrawer(r.task)">
            <div class="budget-card-head">
              <span class="budget-card-name">{{ (r.task.projectInfo && r.task.projectInfo.projectName) || r.task.title || '—' }}</span>
              <span class="budget-card-tag" :class="r.tagCls"><span class="dot"></span>{{ r.tagText }}</span>
            </div>
            <div class="budget-mini">
              <span class="budget-mini-label"><i style="background: var(--chart-teal);"></i>收入</span>
              <div class="budget-mini-bar"><i class="income" :style="{ width: r.revBar + '%' }"></i></div>
              <span class="budget-mini-nums"><b>{{ numText(r.actualRev) }}</b> / {{ numText(r.planRev) }}</span>
            </div>
            <div class="budget-mini">
              <span class="budget-mini-label"><i :style="{ background: r.costOver ? 'var(--bad)' : 'var(--chart-orange)' }"></i>成本</span>
              <div class="budget-mini-bar"><i class="cost" :class="{ over: r.costOver }" :style="{ width: r.costBar + '%' }"></i></div>
              <span class="budget-mini-nums"><b :class="{ over: r.costOver }">{{ numText(r.actualCost) }}</b> / {{ numText(r.planCost) }}</span>
            </div>
            <div class="budget-mini" v-if="r.showRate">
              <span class="budget-mini-label"><i style="background: var(--chart-gold);"></i>毛利率</span>
              <div class="budget-mini-bar"><i class="rate" :style="{ width: r.rateBar + '%' }"></i></div>
              <span class="budget-mini-nums"><b>{{ rateText(r.actualRate) }}</b> / {{ rateText(r.planRate) }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="panels-row">
        <!-- 预算颜色阈值说明 -->
        <div class="panel">
          <div class="panel-header"><h3 class="panel-title">预算颜色阈值说明</h3></div>
          <div class="threshold-list">
            <div class="threshold-item">
              <span class="g-pill good"><span class="dot"></span>绿色</span>
              <div>
                <div class="t-title">偏差 ≤ ±5%</div>
                <div class="t-desc">预算执行正常，无需干预</div>
              </div>
            </div>
            <div class="threshold-item">
              <span class="g-pill warn"><span class="dot"></span>黄色</span>
              <div>
                <div class="t-title">±5% &lt; 偏差 ≤ ±15%</div>
                <div class="t-desc">需关注，项目经理确认原因</div>
              </div>
            </div>
            <div class="threshold-item">
              <span class="g-pill bad"><span class="dot"></span>红色</span>
              <div>
                <div class="t-title">偏差 &gt; ±15%</div>
                <div class="t-desc">预警，需领导审批调整</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 部门毛利汇总 -->
        <div class="panel">
          <div class="panel-header"><h3 class="panel-title">部门毛利汇总</h3></div>
          <div class="budget-gross-grid">
            <div class="budget-gross-ring">
              <svg viewBox="0 0 100 100">
                <circle class="gtrack" cx="50" cy="50" r="42" />
                <circle class="gfill" cx="50" cy="50" r="42" :stroke-dasharray="grossDash" />
              </svg>
              <div class="budget-gross-center">
                <span class="v">{{ (grossRate * 100).toFixed(1) }}%</span>
                <span class="l">毛利达成率</span>
              </div>
            </div>
            <div class="budget-gross-list">
              <div class="budget-gross-item">
                <div class="t"><span class="n"><i style="background: var(--chart-teal);"></i>计划毛利</span><span class="v">{{ kpiText(gross.plan) }} 万</span></div>
                <div class="budget-mini-bar"><i class="income" style="width: 100%;"></i></div>
              </div>
              <div class="budget-gross-item">
                <div class="t"><span class="n"><i :style="{ background: gross.actual < gross.plan ? 'var(--bad)' : 'var(--chart-orange)' }"></i>实际毛利</span><span class="v" :style="gross.actual < gross.plan ? 'color: var(--bad);' : ''">{{ kpiText(gross.actual) }} 万</span></div>
                <div class="budget-mini-bar"><i class="cost" :class="{ over: gross.actual < gross.plan }" :style="{ width: gross.actualBar + '%' }"></i></div>
              </div>
              <div class="gross-tip" v-if="gross.gap > 0">
                <strong>毛利缺口 {{ kpiText(gross.gap) }} 万</strong> · 实际达成率 {{ (grossRate * 100).toFixed(1) }}%，建议核查超支项目成本原因。
              </div>
              <div class="gross-tip ok-tip" v-else-if="gross.plan > 0">
                <strong>实际毛利已达成计划</strong> · 超出 {{ kpiText(-gross.gap) }} 万，预算执行良好。
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- 部门目标设置弹窗 -->
    <teleport to="body">
      <div class="modal-overlay" v-if="showTargets" @click.self="closeTargets">
        <div class="modal modal-target">
          <div class="modal-header">
            <div>
              <h2 class="modal-title">部门目标设置</h2>
              <div class="modal-subtitle">设置年度 / 季度 / 月度的经营目标，保存后用于达成对比</div>
            </div>
            <button class="btn-icon" type="button" @click="closeTargets" aria-label="关闭">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="target-edit-bar">
              <select class="stage-select" v-model="editYear">
                <option v-for="y in targetYears" :key="y" :value="y">{{ y }} 年</option>
              </select>
              <select class="stage-select" v-model="editType">
                <option value="year">年度目标</option>
                <option value="quarter">季度目标</option>
                <option value="month">月度目标</option>
              </select>
              <select v-if="editType === 'quarter'" class="stage-select" v-model="editQuarter">
                <option value="Q1">Q1（1-3月）</option>
                <option value="Q2">Q2（4-6月）</option>
                <option value="Q3">Q3（7-9月）</option>
                <option value="Q4">Q4（10-12月）</option>
              </select>
              <select v-else-if="editType === 'month'" class="stage-select" v-model="editMonth">
                <option v-for="m in 12" :key="m" :value="String(m).padStart(2, '0')">{{ m }} 月</option>
              </select>
            </div>
            <div class="target-edit-grid">
              <div class="form-row" v-for="m in TARGET_METRICS" :key="m.key">
                <label>{{ m.label }}（{{ m.unit }}）</label>
                <input class="form-input" type="number" min="0" step="0.1" v-model="editForm[m.key]" :placeholder="`选填，单位：${m.unit}`" />
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="onClearTarget">清空该周期目标</button>
            <button type="button" class="btn btn-secondary" @click="closeTargets">取消</button>
            <button type="button" class="btn btn-primary" @click="onSaveTarget">保存目标</button>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { computed, ref, inject, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useTaskStore } from '../stores/taskStore'
import { useTargetStore } from '../stores/targetStore'
import { TARGET_METRICS } from '../utils/constants'
import ProjectMultiSelect from '../components/kanban/ProjectMultiSelect.vue'
import { activeTasks, budgetRowsOf, sumField, fmtWan, num, matchYearMonth, yearOptions } from '../utils/finance'

const taskStore = useTaskStore()
const targetStore = useTargetStore()
const openDrawer = inject('openTaskDrawer', () => {})

const active = computed(() => activeTasks(taskStore.tasks))

// 年度/月度筛选（项目创建日期口径）
const year = ref(String(new Date().getFullYear()))
const month = ref('all')
const years = computed(() => yearOptions(active.value))
const filteredActive = computed(() => active.value.filter(t => matchYearMonth(t, year.value, month.value)))

// ===== 项目维度筛选（实施环节项目多选）=====
const selectedProjectIds = ref([])
const implProjects = computed(() => active.value
  .filter(t => t.status === 'impl')
  .map(t => ({ id: t.id, title: (t.projectInfo && t.projectInfo.projectName) || t.title || '—', owner: t.owner })))
const scopeActive = computed(() => selectedProjectIds.value.length
  ? filteredActive.value.filter(t => selectedProjectIds.value.includes(t.id))
  : filteredActive.value)

// 预算对照行：扩展宽度/标签（过滤：收入/成本/毛利率任一有值）
const rows = computed(() => {
  return budgetRowsOf(scopeActive.value)
    .map(r => {
      const revMax = Math.max(r.planRev, r.actualRev, 1)
      const costMax = Math.max(r.planCost, r.actualCost, 1)
      const showRate = !!(r.planRate || r.actualRate)
      // 标签：成本超支 → 超预算；否则预算内
      return {
        ...r,
        revBar: Math.min(r.actualRev / revMax * 100, 100),
        costBar: Math.min(r.actualCost / costMax * 100, 100),
        rateBar: Math.min(Math.max(r.actualRate, 0), 100),
        showRate,
        tagCls: r.costOver ? 'over' : 'ok',
        tagText: r.costOver ? '超预算' : '预算内'
      }
    })
    .sort((a, b) => b.planRev + b.actualRev + b.planCost + b.actualCost - (a.planRev + a.actualRev + a.planCost + a.actualCost))
})

// 汇总（元）
const totals = computed(() => {
  const list = rows.value
  const planRev = sumField(scopeActive.value, 'planRevenueNoTax')
  const ledgerRev = sumField(scopeActive.value, 'ledgerRevenueNoTax')
  const planCost = sumField(scopeActive.value, 'planCost')
  const actualCost = sumField(scopeActive.value, 'actualCost')
  // 毛利率口径：用收入额加权（无字段项目按收入成本推算），避免 0 收入时权重为 1 的偏差
  const rateList = list.filter(r => num(r.planRate) > 0)
  const planRate = rateList.length
    ? rateList.reduce((a, r) => a + num(r.planRate) * Math.max(r.planRev, r.actualRev, 1), 0) / rateList.reduce((a, r) => a + Math.max(r.planRev, r.actualRev, 1), 0)
    : planRev > 0 ? (planRev - planCost) / planRev * 100 : 0
  const aRateList = list.filter(r => num(r.actualRate) > 0)
  const actualRate = aRateList.length
    ? aRateList.reduce((a, r) => a + num(r.actualRate) * Math.max(r.actualRev, r.planRev, 1), 0) / aRateList.reduce((a, r) => a + Math.max(r.actualRev, r.planRev, 1), 0)
    : ledgerRev > 0 ? (ledgerRev - actualCost) / ledgerRev * 100 : 0
  return { planRev, ledgerRev, planCost, actualCost, planRate, actualRate, count: list.length }
})

const revRate = computed(() => totals.value.planRev > 0 ? totals.value.ledgerRev / totals.value.planRev : 0)
const rateDiff = computed(() => totals.value.actualRate - totals.value.planRate)
const revGapText = computed(() => {
  const d = totals.value.ledgerRev - totals.value.planRev
  if (Math.abs(d) < 1) return '与计划持平'
  return d > 0 ? `超出计划 ${fmtWan(d, 1)} 万` : `距计划 -${fmtWan(Math.abs(d), 1)} 万`
})

// 部门毛利（元）：计划毛利 = planRev-planCost；实际毛利 = ledgerRev-actualCost
const gross = computed(() => {
  const t = totals.value
  const plan = t.planRev - t.planCost
  const actual = t.ledgerRev - t.actualCost
  return {
    plan,
    actual,
    gap: plan - actual,
    actualBar: plan > 0 ? Math.min(actual / plan * 100, 100) : 100
  }
})
const grossRate = computed(() => gross.value.plan > 0 ? Math.max(gross.value.actual / gross.value.plan, 0) : 0)
const GROSS_C = 2 * Math.PI * 42
const grossDash = computed(() => `${Math.min(grossRate.value, 1) * GROSS_C} ${GROSS_C}`)

function kpiText(v) {
  const n = num(v)
  return n ? fmtWan(n, 0) : '—'
}
function numText(v) {
  const n = num(v)
  return n ? fmtWan(n, 0) : '—'
}
function rateText(v) {
  const n = num(v)
  return n ? n.toFixed(1) + '%' : '—'
}
function deltaCls(plan, actual) {
  if (!plan || !actual) return 'flat'
  return actual >= plan ? 'up' : 'down'
}
function deltaArrow(plan, actual) {
  if (!plan || !actual) return '—'
  return actual >= plan ? '↑' : '↓'
}
function deltaText(plan, actual) {
  if (!plan || !actual) return '暂无对比'
  const d = actual - plan
  return Math.abs(d) < 1 ? '持平' : (d > 0 ? '+' : '-') + fmtWan(Math.abs(d), 0) + ' 万'
}

// ===== 部门目标（功能2）=====
// 弹窗状态
const showTargets = ref(false)
const editYear = ref(String(new Date().getFullYear()))
const editType = ref('year')
const editQuarter = ref('Q1')
const editMonth = ref('01')
const editForm = ref({ planRevenue: '', grossRate: '', netProfit: '', budget: '' })

const targetYears = computed(() => {
  const ys = [...new Set([...years.value, String(new Date().getFullYear())])]
  return ys.sort()
})

function openTargets() {
  // 同步主筛选器当前年度
  editYear.value = year.value !== 'all' ? year.value : String(new Date().getFullYear())
  editType.value = 'year'
  loadEditForm()
  showTargets.value = true
}

function loadEditForm() {
  const t = targetStore.getTarget(editYear.value, editType.value,
    editType.value === 'quarter' ? editQuarter.value : editType.value === 'month' ? editMonth.value : null)
  editForm.value = { planRevenue: t?.planRevenue ?? '', grossRate: t?.grossRate ?? '', netProfit: t?.netProfit ?? '', budget: t?.budget ?? '' }
}

watch([editYear, editType, editQuarter, editMonth], loadEditForm)

function closeTargets() {
  showTargets.value = false
}

function onSaveTarget() {
  const v = editType.value === 'quarter' ? editQuarter.value : editType.value === 'month' ? editMonth.value : null
  targetStore.setTarget(editYear.value, editType.value, v, {
    planRevenue: editForm.value.planRevenue,
    grossRate: editForm.value.grossRate,
    netProfit: editForm.value.netProfit,
    budget: editForm.value.budget
  })
  ElMessage.success('部门目标已保存')
  closeTargets()
}

function onClearTarget() {
  const v = editType.value === 'quarter' ? editQuarter.value : editType.value === 'month' ? editMonth.value : null
  targetStore.clearTarget(editYear.value, editType.value, v)
  loadEditForm()
  ElMessage.success('已清空该周期目标')
}

// ===== 目标达成展示：按当前筛选取目标（月度优先 → 季度 → 年度）=====
const curQuarter = computed(() => 'Q' + (Math.floor((parseInt(month.value || '01', 10) - 1) / 3) + 1))

const curTarget = computed(() => {
  if (year.value === 'all') return { data: null, source: '' }
  // 月度筛选时：先查月度目标，无则回落季度，再回落年度
  if (month.value !== 'all') {
    const m = targetStore.getTarget(year.value, 'month', month.value)
    if (m && hasAnyMetric(m)) return { data: m, source: `${month.value} 月目标` }
    const q = targetStore.getTarget(year.value, 'quarter', curQuarter.value)
    if (q && hasAnyMetric(q)) return { data: q, source: `${curQuarter.value} 目标` }
  }
  const q2 = targetStore.getTarget(year.value, 'quarter', curQuarter.value)
  if (month.value === 'all' && q2 && hasAnyMetric(q2)) return { data: q2, source: `${curQuarter.value} 目标` }
  const y = targetStore.getTarget(year.value, 'year')
  if (y && hasAnyMetric(y)) return { data: y, source: `${year.value} 年度目标` }
  return { data: null, source: '' }
})

const curTargetSource = computed(() => curTarget.value.source || '未设置')
const hasTargets = computed(() => !!curTarget.value.data)

function hasAnyMetric(t) {
  return !!t && TARGET_METRICS.some(m => t[m.key] !== '' && t[m.key] !== undefined && t[m.key] !== null && num(t[m.key]) > 0)
}

const targetPeriodLabel = computed(() => {
  if (year.value === 'all') return ''
  if (month.value !== 'all') return `${year.value} 年 ${month.value} 月`
  return `${year.value} 年度`
})

// 实际值口径：与 KPI 一致（列账收入未税 / 实际毛利率 / 毛利近似净利润）
const targetCards = computed(() => {
  const t = curTarget.value.data
  if (!t) return []
  const t2 = totals.value
  const ledgerWan = num(t2.ledgerRev) / 10000
  const actualGrossRate = num(t2.actualRate)
  const actualNet = (num(t2.ledgerRev) - num(t2.actualCost)) / 10000
  const actualBudgetUsed = num(t2.actualCost) / 10000
  const defs = [
    { key: 'planRevenue', label: '计划收入', unit: '万', target: num(t.planRevenue), actual: ledgerWan, actualText: ledgerWan ? fmtWan(t2.ledgerRev, 0) : '—' },
    { key: 'grossRate', label: '毛利率', unit: '%', target: num(t.grossRate), actual: actualGrossRate, actualText: actualGrossRate ? actualGrossRate.toFixed(1) : '—' },
    { key: 'netProfit', label: '净利润', unit: '万', target: num(t.netProfit), actual: actualNet, actualText: actualNet ? fmtWan(actualNet * 10000, 0) : '—' },
    { key: 'budget', label: '可用预算', unit: '万', target: num(t.budget), actual: actualBudgetUsed, actualText: actualBudgetUsed ? fmtWan(t2.actualCost, 0) : '—', invert: true }
  ]
  return defs
    .filter(d => d.target > 0)
    .map(d => {
      // 预算为消耗型指标：达成率 = 目标/实际（越低越好）；其余 = 实际/目标
      const pct = d.invert
        ? (d.actual > 0 ? Math.round(d.target / d.actual * 100) : 100)
        : (d.target > 0 ? Math.round(d.actual / d.target * 100) : 0)
      const ok = d.invert ? d.actual <= d.target : d.actual >= d.target
      return {
        ...d,
        actual: d.actualText,
        pct: Math.min(Math.max(pct, 0), 100),
        state: ok ? 'ok' : 'warn',
        stateText: d.invert ? (ok ? '预算内' : '超预算') : (ok ? '已达成' : '进行中')
      }
    })
})
</script>

<style scoped lang="scss">
.budget-view {
  padding: var(--space-5) var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: 13px;
  flex-wrap: wrap;

  .filter-count { color: var(--muted); }
  .target-btn { margin-left: auto; }
}

@media (max-width: 1100px) {
  .panels-row { grid-template-columns: 1fr; }
}

.empty-guide {
  text-align: center;
  padding: var(--space-12) var(--space-4);

  h3 { font-size: var(--text-base); font-weight: 600; margin-bottom: var(--space-2); color: var(--fg); }
  p { font-size: 13px; color: var(--muted); max-width: 420px; margin: 0 auto; }
}

.unit { font-size: 14px; color: var(--muted); font-weight: 400; }
.delta-arrow { font-family: var(--font-mono); }

.budget-legend {
  display: flex;
  gap: var(--space-5);
  font-size: 12px;
  color: var(--muted);
  flex-wrap: wrap;

  .legend-item { display: inline-flex; align-items: center; gap: 6px; }
  .legend-dot { width: 8px; height: 8px; border-radius: 2px; display: inline-block; }
  .plan-dot { background: color-mix(in oklch, var(--muted) 45%, transparent); }
}

.threshold-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.threshold-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);

  .g-pill { min-width: 60px; justify-content: center; }
  .t-title { font-size: 13px; font-weight: 500; }
  .t-desc { font-size: 11px; color: var(--muted); }
}

.gross-tip {
  padding: var(--space-3);
  background: color-mix(in oklch, var(--bad) 6%, transparent);
  border: 1px solid color-mix(in oklch, var(--bad) 20%, transparent);
  border-radius: var(--radius-sm);
  font-size: 12px;

  strong { color: var(--bad); }

  &.ok-tip {
    background: color-mix(in oklch, var(--good) 6%, transparent);
    border-color: color-mix(in oklch, var(--good) 20%, transparent);

    strong { color: var(--good); }
  }
}

// ===== 部门目标达成面板 =====
.target-panel {
  padding: var(--space-5);
}

.target-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-4);
}

@media (max-width: 1100px) {
  .target-grid { grid-template-columns: repeat(2, 1fr); }
}

.target-card {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--surface);

  &.ok { border-color: color-mix(in oklch, var(--good) 30%, var(--border)); }
  &.warn { border-color: color-mix(in oklch, var(--warn) 40%, var(--border)); }
}

.tc-label { font-size: 12px; color: var(--muted); font-weight: 500; }

.tc-value {
  font-size: var(--text-xl);
  font-weight: 600;
  font-family: var(--font-mono);

  .unit { font-size: 12px; color: var(--muted); font-weight: 400; }
}

.tc-target { font-size: 11px; color: var(--muted); }

.tc-bar {
  height: 6px;
  border-radius: var(--radius-pill);
  background: var(--bg);
  overflow: hidden;
}

.tc-fill {
  height: 100%;
  border-radius: var(--radius-pill);
  background: var(--accent);
  transition: width var(--motion-base) var(--ease-standard);
}

.target-card.ok .tc-fill { background: var(--good); }
.target-card.warn .tc-fill { background: var(--warn); }

.tc-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.tc-pct {
  font-family: var(--font-mono);
  font-weight: 600;

  &.ok { color: var(--good); }
  &.no { color: var(--warn); }
}

.tc-state { color: var(--muted); }

// ===== 目标设置弹窗 =====
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(17, 17, 17, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: var(--surface);
  border-radius: var(--radius-lg);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.16);
  overflow: hidden;
  width: 560px;
  max-width: calc(100vw - 32px);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: var(--space-5) var(--space-6) var(--space-3);
}

.modal-title { font-size: var(--text-xl); font-weight: 600; margin: 0; }
.modal-subtitle { font-size: 12px; color: var(--muted); margin-top: 4px; }

.btn-icon {
  width: 30px;
  height: 30px;
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  color: var(--muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;

  svg { width: 15px; height: 15px; }
  &:hover { background: var(--bg); color: var(--fg); }
}

.modal-body {
  padding: var(--space-3) var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.target-edit-bar {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.target-edit-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 6px;

  label { font-size: 12px; color: var(--muted); font-weight: 500; }
}

.form-input {
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  background: var(--surface);
  color: var(--fg);
  font-family: inherit;

  &:focus { outline: none; border-color: var(--accent); box-shadow: var(--focus-ring); }
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-6) var(--space-5);
}

// ===== 按钮样式（对齐 AppHeader 规格与新建项目按钮） =====
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

  svg { flex-shrink: 0; }
}

.btn-primary {
  background: var(--accent);
  color: var(--accent-on);

  &:hover { background: var(--primary-hover); }
}

.btn-secondary {
  background: var(--surface);
  color: var(--fg);
  border: 1px solid var(--border);

  &:hover { border-color: color-mix(in oklch, var(--fg) 20%, transparent); }
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
