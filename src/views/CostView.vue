<template>
  <div class="cost-view">
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
    </div>

    <div v-if="!payRows.length" class="panel empty-guide">
      <h3>暂无付款数据</h3>
      <p>导入含「累计付款 / 累计收票 / 实际成本」等财务字段的 Excel 后，此处将展示付款与成本分析。</p>
    </div>

    <template v-else>

      <div class="kpis">
        <div class="kpi" v-for="k in kpis" :key="k.label">
          <div class="kpi-label">{{ k.label }}</div>
          <div class="kpi-value">{{ k.value }} <span v-if="k.unit" class="unit">万</span></div>
          <div class="kpi-sub">{{ k.sub }}</div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div>
            <h3 class="panel-title">付款 TOP{{ payRows.length }} 项目</h3>
            <div class="panel-subtitle">累计付款 · 实际成本 · 付款率</div>
          </div>
        </div>
        <table class="ds-table">
          <thead><tr><th>项目名称</th><th>负责人</th><th>累计付款（万）</th><th>实际成本</th><th>付款率</th><th>状态</th></tr></thead>
          <tbody>
            <tr v-for="r in payRows" :key="r.task.id" @click="openDrawer(r.task)">
              <td class="cell-title">{{ (r.task.projectInfo && r.task.projectInfo.projectName) || r.task.title || '—' }}</td>
              <td class="cell-text">{{ r.task.owner || '—' }}</td>
              <td class="num">{{ fmtWan(r.paid, 0) }}</td>
              <td class="num">{{ fmtWan(r.actualCost, 0) }}</td>
              <td>
                <div class="progress">
                  <div class="progress-track"><div class="progress-fill" :class="num(r.task.projectInfo?.planCost) > 0 && r.actualCost > num(r.task.projectInfo?.planCost) ? 'bad' : ''" :style="{ width: Math.min(r.rate * 100, 100) + '%' }"></div></div>
                  <span class="progress-label">{{ Math.round(r.rate * 100) }}%</span>
                </div>
              </td>
              <td>
                <span class="g-pill" :class="overClass(r.task)"><span class="dot"></span>{{ overText(r.task) }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="panels-row">
        <div class="panel">
          <div class="panel-header"><h3 class="panel-title">付款 / 收票 / 开票 环形对比</h3></div>
          <div class="ring-grid">
            <div class="ring-card" v-for="r in rings" :key="r.label">
              <svg class="ring-svg" viewBox="0 0 100 100">
                <circle class="ring-track" cx="50" cy="50" r="42" />
                <circle class="ring-fill" :class="r.cls" cx="50" cy="50" r="42" :stroke-dasharray="r.dash" />
                <text class="ring-pct mono" x="50" y="50" text-anchor="middle" dy="0.35em">{{ r.pct }}%</text>
              </svg>
              <div class="ring-label">{{ r.label }}</div>
              <div class="ring-value mono">{{ r.detail }}</div>
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header"><h3 class="panel-title">即将到期付款</h3></div>
          <div class="due-list">
            <div class="due-item" v-for="d in dueSoon" :key="d.task.id">
              <div>
                <div class="due-title">{{ (d.task.projectInfo && d.task.projectInfo.projectName) || d.task.title || '—' }}</div>
                <div class="due-meta">到期 {{ d.task.deadline }}</div>
              </div>
              <div class="due-right">
                <div class="due-amount mono">{{ fmtWan(d.pending, 0) }} 万</div>
                <span class="g-pill" :class="d.cls"><span class="dot"></span>{{ d.daysText }}</span>
              </div>
            </div>
            <div v-if="!dueSoon.length" class="chart-placeholder">暂无即将到期项目</div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, inject } from 'vue'
import { useTaskStore } from '../stores/taskStore'
import ProjectMultiSelect from '../components/kanban/ProjectMultiSelect.vue'
import { activeTasks, paymentRows, sumField, sumPending, pendingOf, fmtWan, num, ratioCohort, contractRatio, matchYearMonth, yearOptions } from '../utils/finance'
import { isOverdue, isWarn, getDaysLeft } from '../utils/business'

const taskStore = useTaskStore()
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

const payRows = computed(() => paymentRows(scopeActive.value).slice(0, 10))

const kpis = computed(() => {
  const paid = sumField(scopeActive.value, 'accPayment')
  const receipt = sumField(scopeActive.value, 'accReceipt')
  const invoice = sumField(scopeActive.value, 'accInvoice')
  const actualCost = sumField(scopeActive.value, 'actualCost')
  const planCost = sumField(scopeActive.value, 'planCost')
  // 分母口径：仅统计分母有值的项目，避免缺字段导致比率失真
  const payRate = ratioCohort(scopeActive.value, 'accPayment', 'accInvoice')
  const recRate = ratioCohort(scopeActive.value, 'accReceipt', 'accPayment')
  // 待付款：逐项目正差额求和，避免全局轧差被超付项目抵消
  const pending = sumPending(scopeActive.value)
  return [
    { label: '累计付款', value: paid ? fmtWan(paid, 0) : '—', unit: paid > 0, sub: payRate.d ? `付款率 ${(payRate.rate * 100).toFixed(0)}%` : '暂无开票数据' },
    { label: '累计收票', value: receipt ? fmtWan(receipt, 0) : '—', unit: receipt > 0, sub: recRate.d ? `收票率 ${(recRate.rate * 100).toFixed(0)}%` : '暂无付款数据' },
    { label: '实际成本', value: actualCost ? fmtWan(actualCost, 0) : '—', unit: actualCost > 0, sub: planCost ? `计划 ${fmtWan(planCost, 0)} 万` : '暂无计划' },
    { label: '待付款', value: paid || invoice ? fmtWan(pending, 0) : '—', unit: !!(paid || invoice), sub: '逐项目待付正差额合计' }
  ]
})

const rings = computed(() => {
  const payRate = ratioCohort(scopeActive.value, 'accPayment', 'accInvoice')
  const recRate = ratioCohort(scopeActive.value, 'accReceipt', 'accPayment')
  const invRate = contractRatio(scopeActive.value, 'accInvoice')
  const C = 2 * Math.PI * 42
  const mk = (label, cohort, cls) => {
    const pct = Math.round(cohort.rate * 100)
    return { label, pct, cls, dash: `${Math.min(pct / 100, 1) * C} ${C}`, detail: cohort.d ? `${fmtWan(cohort.n, 0)} / ${fmtWan(cohort.d, 0)} 万` : '—' }
  }
  return [
    mk('付款率', payRate, ''),
    mk('收票率', recRate, 'good'),
    mk('开票率', invRate, 'warn')
  ]
})

// 即将到期付款：截止日期临近或已逾期，且仍有待付款的项目
const dueSoon = computed(() => {
  return scopeActive.value
    .filter(t => t.deadline && pendingOf(t) > 0 && (isOverdue(t) || getDaysLeft(t.deadline) <= 30))
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
    .slice(0, 5)
    .map(t => {
      const d = getDaysLeft(t.deadline)
      return {
        task: t,
        pending: pendingOf(t),
        daysText: d < 0 ? `已逾期 ${Math.abs(d)} 天` : `剩余 ${d} 天`,
        cls: d < 0 ? 'bad' : d <= 14 ? 'warn' : ''
      }
    })
})

// 状态：超预算 > 超付 > 正常（付款率口径=付款/实际成本，超付即付款超过实际成本）
function overClass(t) {
  const info = t.projectInfo || {}
  if (num(info.planCost) > 0 && num(info.actualCost) > num(info.planCost)) return 'bad'
  if (num(info.actualCost) > 0 && num(info.accPayment) > num(info.actualCost)) return 'warn'
  return 'good'
}
function overText(t) {
  const info = t.projectInfo || {}
  if (num(info.planCost) > 0 && num(info.actualCost) > num(info.planCost)) return '超预算'
  if (num(info.actualCost) > 0 && num(info.accPayment) > num(info.actualCost)) return '超付'
  return '正常'
}
</script>

<style scoped lang="scss">
.cost-view {
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

  .filter-count { color: var(--muted); }
}

.kpis {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-4);
}

@media (max-width: 1100px) {
  .kpis { grid-template-columns: repeat(2, 1fr); }
  .panels-row { grid-template-columns: 1fr; }
}

.empty-guide {
  text-align: center;
  padding: var(--space-12) var(--space-4);

  h3 { font-size: var(--text-base); font-weight: 600; margin-bottom: var(--space-2); color: var(--fg); }
  p { font-size: 13px; color: var(--muted); max-width: 420px; margin: 0 auto; }
}

.unit { font-size: 14px; color: var(--muted); font-weight: 400; }

.cell-title {
  font-weight: 500;
  max-width: 240px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cell-text { font-size: 13px; }

.ring-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-4);
}

.ring-card {
  text-align: center;
  padding: var(--space-4);
  position: relative;
}

.ring-svg {
  width: 100px;
  height: 100px;
  margin: 0 auto;
  display: block;
}

.ring-pct {
  font-size: 16px;
  font-weight: 600;
  fill: var(--fg);
}

.ring-label {
  font-size: 12px;
  color: var(--muted);
  margin-top: var(--space-1);
}

.ring-value {
  font-size: 11px;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

.due-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.due-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

.due-title { font-size: 13px; font-weight: 500; }
.due-meta { font-size: 11px; color: var(--muted); margin-top: 2px; }

.due-right {
  text-align: right;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.due-amount {
  font-family: var(--font-mono);
  font-weight: 600;
}
</style>
