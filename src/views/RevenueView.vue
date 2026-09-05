<template>
  <div class="revenue-view">
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

    <div v-if="!rows.length" class="panel empty-guide">
      <h3>暂无回款数据</h3>
      <p>导入含「累计收款」等财务字段的 Excel 后，此处将展示回款明细与趋势。</p>
    </div>

    <template v-else>

      <div class="kpis">
        <div class="kpi" v-for="k in kpis" :key="k.label">
          <div class="kpi-label">{{ k.label }}</div>
          <div class="kpi-value">{{ k.value }} <span v-if="k.unit" class="unit">万</span></div>
          <div class="kpi-sub">{{ k.sub }}</div>
        </div>
      </div>

      <div class="panels-row">
        <div class="panel">
          <div class="panel-header">
            <div>
              <h3 class="panel-title">回款明细 · 按项目</h3>
              <div class="panel-subtitle">点击行查看项目详情</div>
            </div>
          </div>
          <table class="ds-table">
            <thead><tr><th>项目名称</th><th>合同额（万）</th><th>累计回款</th><th>回款率</th><th>状态</th></tr></thead>
            <tbody>
              <tr v-for="r in rows" :key="r.task.id" @click="openDrawer(r.task)">
                <td class="cell-title">{{ (r.task.projectInfo && r.task.projectInfo.projectName) || r.task.title || '—' }}</td>
                <td class="num">{{ fmtWan(r.contract, 0) }}</td>
                <td class="num">{{ fmtWan(r.collected, 0) }}</td>
                <td>
                  <div class="progress">
                    <div class="progress-track"><div class="progress-fill" :class="rateClass(r.rate)" :style="{ width: Math.min(r.rate * 100, 100) + '%' }"></div></div>
                    <span class="progress-label">{{ Math.round(r.rate * 100) }}%</span>
                  </div>
                </td>
                <td><span class="g-pill" :class="statusClass(r.rate)"><span class="dot"></span>{{ statusText(r.rate) }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="panel">
          <div class="panel-header"><h3 class="panel-title">回款趋势 · 近 6 月</h3></div>
          <div class="chart" style="height:220px;" v-if="trend.length">
            <svg viewBox="0 0 400 200" preserveAspectRatio="none">
              <defs>
                <linearGradient id="rev-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.18" />
                  <stop offset="100%" stop-color="var(--accent)" stop-opacity="0" />
                </linearGradient>
              </defs>
              <g class="chart-grid">
                <line x1="30" y1="30" x2="400" y2="30" />
                <line x1="30" y1="80" x2="400" y2="80" />
                <line x1="30" y1="130" x2="400" y2="130" />
                <line x1="30" y1="170" x2="400" y2="170" />
              </g>
              <text x="24" y="34" text-anchor="end" class="chart-axis">{{ trendAxis[0] }}</text>
              <text x="24" y="84" text-anchor="end" class="chart-axis">{{ trendAxis[1] }}</text>
              <text x="24" y="134" text-anchor="end" class="chart-axis">{{ trendAxis[2] }}</text>
              <text x="24" y="174" text-anchor="end" class="chart-axis">{{ trendAxis[3] }}</text>
              <polygon :fill="'url(#rev-grad)'" :points="trendArea" />
              <polyline fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :points="trendLine" />
              <circle v-for="(p, i) in trendPoints" :key="i" :cx="p.x" :cy="p.y" r="3" fill="var(--accent)" />
              <text v-for="(p, i) in trendPoints" :key="'t' + i" :x="p.x" y="188" text-anchor="middle" class="chart-axis">{{ p.label }}</text>
            </svg>
          </div>
          <div v-else class="chart-placeholder">暂无趋势数据</div>
          <div class="trend-foot">
            <span>月均回款</span><strong class="mono">{{ avgTrend }} 万</strong>
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
import { activeTasks, revenueRows, totalContract, totalCollection, fmtWan, num, matchYearMonth } from '../utils/finance'

const taskStore = useTaskStore()
const openDrawer = inject('openTaskDrawer', () => {})

const active = computed(() => activeTasks(taskStore.tasks))

// 年度/月度筛选
const year = ref(String(new Date().getFullYear()))
const month = ref('all')
const years = computed(() => {
  const ys = [...new Set(active.value.map(t => {
    const d = t.deadline || (t.projectInfo && t.projectInfo.createdDate) || ''
    return String(d).replace(/\//g, '-').slice(0, 4)
  }).filter(Boolean))]
  return ys.sort()
})
const filteredActive = computed(() => active.value.filter(t => matchYearMonth(t, year.value, month.value)))

// ===== 项目维度筛选（实施环节项目多选）=====
const selectedProjectIds = ref([])
const implProjects = computed(() => active.value
  .filter(t => t.status === 'impl')
  .map(t => ({ id: t.id, title: (t.projectInfo && t.projectInfo.projectName) || t.title || '—', owner: t.owner })))
const scopeActive = computed(() => selectedProjectIds.value.length
  ? filteredActive.value.filter(t => selectedProjectIds.value.includes(t.id))
  : filteredActive.value)

const rows = computed(() => revenueRows(scopeActive.value))

const kpis = computed(() => {
  const contract = totalContract(scopeActive.value)
  const collected = totalCollection(scopeActive.value)
  const audit = scopeActive.value.reduce((a, t) => a + num(t.projectInfo?.auditAmount), 0)
  const rate = contract > 0 ? collected / contract : 0
  return [
    { label: '合同总额', value: contract ? fmtWan(contract, 0) : '—', unit: contract > 0, sub: '含税' },
    { label: '累计回款', value: collected ? fmtWan(collected, 0) : '—', unit: collected > 0, sub: contract ? `回款率 ${(rate * 100).toFixed(1)}%` : '暂无数据' },
    { label: '待回款', value: contract ? fmtWan(contract - collected, 0) : '—', unit: contract > 0, sub: '含未到期' },
    { label: '审计金额', value: audit ? fmtWan(audit, 0) : '—', unit: audit > 0, sub: '较合同额' }
  ]
})

// 回款趋势：按截止日期月度分布累计回款额（含年度筛选，近6个月或选择年度的12个月）
const trend = computed(() => {
  const now = new Date()
  const months = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({ y: d.getFullYear(), m: d.getMonth() + 1, label: `${d.getMonth() + 1} 月`, value: 0 })
  }
  // 按项目截止月分布累计回款额
  scopeActive.value.forEach(t => {
    if (!t.deadline) return
    const parts = String(t.deadline).replace(/\//g, '-').split('-')
    const y = parseInt(parts[0], 10)
    const m = parseInt(parts[1], 10)
    if (!y || !m) return
    const target = months.find(x => x.y === y && x.m === m)
    if (target) target.value += num(t.projectInfo?.accCollection) / 10000
  })
  return months
})

const trendMax = computed(() => Math.max(...trend.value.map(x => x.value), 1))
const trendAxis = computed(() => {
  const max = trendMax.value
  const step = max / 4
  return [0, 1, 2, 3].map(i => Math.round(max - i * step))
})
const trendPoints = computed(() => trend.value.map((x, i) => ({
  x: 40 + i * 70,
  y: 170 - (x.value / trendMax.value) * 130,
  label: x.label
})))
const trendLine = computed(() => trendPoints.value.map(p => `${p.x},${p.y}`).join(' '))
const trendArea = computed(() => {
  const pts = trendPoints.value
  return pts.map(p => `${p.x},${p.y}`).join(' ') + ` ${pts[pts.length - 1].x},170 ${pts[0].x},170`
})
const avgTrend = computed(() => {
  const vals = trend.value.map(x => x.value)
  return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(0)
})

function rateClass(r) {
  if (r < 0.3) return 'bad'
  if (r < 0.5) return 'warn'
  return 'good'
}
function statusClass(r) {
  if (r < 0.3) return 'bad'
  if (r < 0.5) return 'warn'
  return 'good'
}
function statusText(r) {
  if (r < 0.3) return '预警'
  if (r < 0.5) return '关注'
  return '正常'
}
</script>

<style scoped lang="scss">
.revenue-view {
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

.trend-foot {
  display: flex;
  justify-content: space-between;
  margin-top: var(--space-3);
  font-size: 12px;

  span { color: var(--muted); }
  strong { font-family: var(--font-mono); font-weight: 600; }
}
</style>
