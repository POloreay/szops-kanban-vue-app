<template>
  <div class="dashboard-view">
    <!-- 空数据引导 -->
    <div v-if="!active.length" class="panel empty-guide">
      <h3>暂无项目数据</h3>
      <p>当前还没有任何项目数据。在「项目管理」或各阶段页点击「新建项目」，从 Excel 批量导入真实数据后，此处将展示完整决策视图。</p>
    </div>

    <template v-else>
      <!-- 年度/月度/项目维度筛选器 -->
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

      <!-- KPI -->
      <div class="kpis">
        <div class="kpi" v-for="k in kpis" :key="k.label">
          <div class="kpi-label">{{ k.label }}</div>
          <div class="kpi-value">{{ k.value }}</div>
          <div class="kpi-sub">{{ k.sub }}</div>
        </div>
      </div>

      <div class="panels-row">
        <!-- 商机漏斗：投标管理各环节 + 项目管理各阶段 -->
        <div class="panel funnel-panel">
          <div class="panel-header">
            <div>
              <h3 class="panel-title">商机漏斗</h3>
              <div class="panel-subtitle">投标管理各环节 · 项目管理各阶段</div>
            </div>
            <span class="g-pill accent"><span class="dot"></span>实时</span>
          </div>
          <!-- 投标管理漏斗 -->
          <div class="funnel-section">
            <div class="funnel-section-title">投标管理（{{ bidTotalCount }}）</div>
            <div class="funnel">
              <div class="funnel-row" v-for="(row, i) in bidFunnel" :key="'bid-' + i">
                <div class="funnel-label">{{ row.label }}</div>
                <div class="funnel-cell">
                  <div class="funnel-bar" :class="row.cls" :style="{ width: row.width }">{{ row.inside ? row.text : '' }}</div>
                  <span v-if="!row.inside" class="funnel-out-text">{{ row.text }}</span>
                </div>
              </div>
            </div>
          </div>
          <!-- 项目管理漏斗 -->
          <div class="funnel-section">
            <div class="funnel-section-title">项目管理（{{ projTotalCount }}）</div>
            <div class="funnel">
              <div class="funnel-row" v-for="(row, i) in projFunnel" :key="'proj-' + i">
                <div class="funnel-label">{{ row.label }}</div>
                <div class="funnel-cell">
                  <div class="funnel-bar" :class="row.cls" :style="{ width: row.width }">{{ row.inside ? row.text : '' }}</div>
                  <span v-if="!row.inside" class="funnel-out-text">{{ row.text }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 战新业务分布 -->
        <div class="panel">
          <div class="panel-header">
            <div>
              <h3 class="panel-title">战新业务分布</h3>
              <div class="panel-subtitle">按「主标签（战新）」分组 · 空值归为一般项目</div>
            </div>
          </div>
          <div class="chart" style="height:200px;">
            <svg viewBox="0 0 200 200" v-if="donut.total">
              <circle cx="100" cy="100" r="70" fill="none" stroke="var(--border)" stroke-width="28" />
              <circle v-for="(seg, i) in donut.segs" :key="i" cx="100" cy="100" r="70" fill="none"
                :stroke="seg.color" stroke-width="28"
                :stroke-dasharray="seg.dash"
                :stroke-dashoffset="seg.offset"
                transform="rotate(-90 100 100)" />
              <text x="100" y="96" text-anchor="middle" class="ring-center" style="font-size:22px;">{{ donut.total }}</text>
              <text x="100" y="114" text-anchor="middle" style="font-size:10px;fill:var(--muted);">个项目</text>
            </svg>
            <div v-else class="chart-placeholder">暂无数据</div>
          </div>
          <div class="legend-list legend-grid">
            <div class="legend-line" v-for="(seg, i) in donut.segs" :key="i">
              <span class="legend-item"><span class="legend-dot" :style="{ background: seg.color }"></span>{{ seg.label }}</span>
              <span class="legend-line-right"><span class="legend-pct">{{ seg.pct }}%</span><span class="mono-num">{{ seg.count }}</span></span>
            </div>
          </div>
        </div>
      </div>

      <!-- 回款全景 TOP10 -->
      <div class="panel">
        <div class="panel-header">
          <div>
            <h3 class="panel-title">回款全景 · TOP{{ collTop.length }} 项目<span class="panel-title-unit">（万元）</span></h3>
            <div class="panel-subtitle">底条=合同额 · 覆盖条=累计回款 · 回款率 &lt;30% 标红</div>
          </div>
          <div class="panel-totals">
            <span>合同总额 <strong class="mono">{{ fmtWan(totalContractYuan) }} 万</strong></span>
            <span>累计回款 <strong class="mono">{{ fmtWan(totalCollectionYuan) }} 万</strong></span>
            <span class="accent-text">待回款 <strong class="mono">{{ fmtWan(totalContractYuan - totalCollectionYuan) }} 万</strong></span>
          </div>
        </div>
        <div class="budget-col-list" v-if="collTop.length">
          <div class="budget-row coll-row" v-for="r in collTop" :key="r.id">
            <span class="coll-name">{{ r.name }}</span>
            <div class="budget-bars">
              <div class="budget-bar"><div class="budget-bar-fill plan" :style="{ width: r.planWidth }"></div></div>
              <div class="budget-bar"><div class="budget-bar-fill" :class="{ over: r.rate < 0.3 }" :style="{ width: r.actWidth, background: r.rate < 0.3 ? 'var(--biz-red)' : r.color }"></div></div>
            </div>
            <span class="budget-num actual" :style="{ color: r.rate < 0.3 ? 'var(--biz-red)' : undefined, fontWeight: 600 }">{{ Math.round(r.rate * 100) }}%</span>
          </div>
        </div>
        <div v-else class="chart-placeholder">暂无合同数据（需导入含合同额的 Excel）</div>
      </div>

      <div class="panels-row">
        <!-- 收支柱状图 TOP5 -->
        <div class="panel">
          <div class="panel-header"><h3 class="panel-title">收支对比 · 按项目 TOP{{ bars.length }}<span class="panel-title-unit">（万元）</span></h3></div>
          <div class="chart bar-chart" style="height:246px;" v-if="bars.length">
            <svg viewBox="0 0 600 180" preserveAspectRatio="none" class="bar-svg">
              <g class="chart-grid">
                <line x1="40" y1="20" x2="600" y2="20" />
                <line x1="40" y1="60" x2="600" y2="60" />
                <line x1="40" y1="100" x2="600" y2="100" />
                <line x1="40" y1="140" x2="600" y2="140" />
              </g>
              <text x="34" y="24" text-anchor="end" class="chart-axis">{{ axisLabels[0] }}</text>
              <text x="34" y="64" text-anchor="end" class="chart-axis">{{ axisLabels[1] }}</text>
              <text x="34" y="104" text-anchor="end" class="chart-axis">{{ axisLabels[2] }}</text>
              <text x="34" y="144" text-anchor="end" class="chart-axis">{{ axisLabels[3] }}</text>
              <template v-for="(g, gi) in barGroups" :key="gi">
                <rect v-for="(b, bi) in g.rects" :key="bi" :x="b.x" :y="b.y" :width="b.w" :height="b.h" :fill="b.fill" rx="2" />
              </template>
              <line x1="40" y1="140" x2="600" y2="140" stroke="var(--fg)" stroke-width="1" />
            </svg>
            <div class="bar-labels">
              <span class="bar-label" v-for="(g, gi) in barGroups" :key="gi" :title="g.name" :style="{ left: g.labelLeft, width: g.labelWidth }">{{ g.name }}</span>
            </div>
          </div>
          <div v-else class="chart-placeholder">暂无收支数据（需导入含计划收入/成本的 Excel）</div>
          <div class="budget-legend" style="margin-top:var(--space-3);">
            <span class="legend-item"><span class="legend-dot" style="background:var(--biz-blue);"></span>计划收入</span>
            <span class="legend-item"><span class="legend-dot" style="background:var(--biz-teal);"></span>列账收入</span>
            <span class="legend-item"><span class="legend-dot" style="background:var(--biz-green);"></span>计划成本</span>
            <span class="legend-item"><span class="legend-dot" style="background:var(--biz-cyan);"></span>实际成本</span>
          </div>
        </div>

        <!-- 付款/收票/开票概况 -->
        <div class="panel">
          <div class="panel-header"><h3 class="panel-title">付款 / 收票概况<span class="panel-title-unit">（万元）</span></h3></div>
          <div class="rate-list">
            <div class="rate-item" v-for="r in rates" :key="r.label">
              <svg viewBox="0 0 100 100" class="rate-svg">
                <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border)" stroke-width="8" />
                <circle cx="50" cy="50" r="42" fill="none" :stroke="r.color" stroke-width="8" stroke-linecap="round"
                  :stroke-dasharray="r.dash" transform="rotate(-90 50 50)" />
                <text x="50" y="55" text-anchor="middle" class="ring-center" style="font-size:16px;">{{ r.pct }}%</text>
              </svg>
              <div>
                <div class="rate-label">{{ r.label }}</div>
                <div class="rate-value mono">{{ fmtWan(r.value) }} <span class="unit">万</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="panels-row">
        <!-- 创建人排名 -->
        <div class="panel">
          <div class="panel-header"><h3 class="panel-title">创建人排名 · TOP{{ owners.length }}<span class="panel-title-unit">（金额单位：万元）</span></h3></div>
          <div class="budget-col-list" v-if="owners.length">
            <div class="budget-row owner-row" v-for="o in owners" :key="o.name">
              <span class="owner-name">{{ o.name }}</span>
              <div class="budget-bar" style="height:8px;"><div class="budget-bar-fill actual" :style="{ width: o.width }"></div></div>
              <span class="budget-num actual">{{ o.count }}</span>
              <span class="budget-num muted-num">{{ o.amountText }}</span>
            </div>
          </div>
          <div v-else class="chart-placeholder">暂无数据</div>
        </div>

        <!-- 逾期风险榜 -->
        <div class="panel">
          <div class="panel-header"><h3 class="panel-title">逾期风险榜</h3></div>
          <table class="ds-table" v-if="overdueList.length">
            <thead><tr><th>项目</th><th>负责人</th><th>逾期</th></tr></thead>
            <tbody>
              <tr v-for="r in overdueList" :key="r.task.id" @click="openDrawer(r.task)">
                <td class="cell-title">{{ (r.task.projectInfo && r.task.projectInfo.projectName) || r.task.title || '—' }}</td>
                <td class="cell-text">{{ r.task.owner || '—' }}</td>
                <td class="num" :style="{ color: r.days > 7 ? 'var(--bad)' : 'var(--warn)', fontWeight: 600 }">{{ r.days }} 天</td>
              </tr>
            </tbody>
          </table>
          <div v-else class="chart-placeholder">当前无逾期项目</div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, inject } from 'vue'
import { useTaskStore } from '../stores/taskStore'
import { useBidStore } from '../stores/bidStore'
import { BIZ_COLORS, BID_STAGES, BID_STAGE_ORDER } from '../utils/constants'
import ProjectMultiSelect from '../components/kanban/ProjectMultiSelect.vue'
import {
  activeTasks, totalContract, totalCollection, collectionTopN, barTopN,
  ownerTopN, overdueRank, sumField, fmtWan, ratioCohort, contractRatio, matchYearMonth, yearOptions
} from '../utils/finance'

const taskStore = useTaskStore()
const bidStore = useBidStore()
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
  .map(t => {
    const info = t.projectInfo || {}
    const planRev = Number(info.planRevenueTax)
    return {
      id: t.id,
      title: info.projectName || t.title || '—',
      owner: t.owner,
      planRevText: planRev > 0 ? fmtWan(planRev, 1) : '',
      year: String(info.createdDate || '').slice(0, 4),
      pm: String(info.pmName || '').trim()
    }
  }))
const scopeActive = computed(() => selectedProjectIds.value.length
  ? filteredActive.value.filter(t => selectedProjectIds.value.includes(t.id))
  : filteredActive.value)

const totalContractYuan = computed(() => totalContract(scopeActive.value))
const totalCollectionYuan = computed(() => totalCollection(scopeActive.value))

// KPI（口径与项目总览/经营分析统一：回款率=累计收款/累计开票；逾期=计划完成时间超期且非终态）
const kpis = computed(() => {
  const talk = scopeActive.value.filter(t => t.status === 'talk').length
  const proc = scopeActive.value.filter(t => t.status === 'proc').length
  const impl = scopeActive.value.filter(t => t.status === 'impl').length
  const overdue = overdueRank(scopeActive.value).length
  const totalInvoice = sumField(scopeActive.value, 'accInvoice')
  const rate = totalInvoice > 0 ? totalCollectionYuan.value / totalInvoice : 0
  return [
    { label: '在执行项目', value: scopeActive.value.length, sub: `前期 ${talk} · 采购 ${proc} · 实施 ${impl}` },
    { label: '合同总额（万元）', value: totalContractYuan.value ? fmtWan(totalContractYuan.value, 0) : '—', sub: '不含税口径（与项目管理一致）' },
    { label: '累计回款率', value: totalInvoice ? (rate * 100).toFixed(1) + '%' : '—', sub: totalInvoice ? `收款 ${fmtWan(totalCollectionYuan.value, 0)} / 开票 ${fmtWan(totalInvoice, 0)}` : '暂无开票数据' },
    { label: '逾期风险项目', value: overdue, sub: overdue ? `待决策 ${scopeActive.value.filter(t => t.needDecision).length} 个 · 最长逾期 ${Math.max(...overdueRank(scopeActive.value).map(r => r.days))} 天` : `待决策 ${scopeActive.value.filter(t => t.needDecision).length} 个` }
  ]
})

// 商机漏斗：投标管理5环节 + 项目管理4阶段（全部展示，含0数据项）
const bidFunnel = computed(() => {
  const maxCount = Math.max(...BID_STAGE_ORDER.map(s => bidStore.byStage(s).length), 1)
  return BID_STAGE_ORDER.map((stage, i) => {
    const count = bidStore.byStage(stage).length
    const w = Math.max(count / maxCount * 100, 8)
    return {
      label: BID_STAGES[stage].name,
      count,
      text: `${count} 个`,
      width: w + '%',
      cls: `s${i + 1}`,
      inside: w >= 24
    }
  })
})

const projFunnel = computed(() => {
  const tasks = scopeActive.value
  const stages = [
    { key: 'talk', label: '前期阶段', cls: 's1' },
    { key: 'proc', label: '采购阶段', cls: 's2' },
    { key: 'impl', label: '实施阶段', cls: 's3' },
    { key: 'closed', label: '已关闭项目', cls: 's4' }
  ]
  const counts = stages.map(s => tasks.filter(t => t.status === s.key || (s.key === 'closed' && ['完工', '验收', '业务关闭', '财务关闭'].includes(t.subStatus))).length)
  const max = Math.max(...counts, 1)
  return stages.map((s, i) => ({
    label: s.label,
    count: counts[i],
    text: `${counts[i]} 个`,
    width: Math.max(counts[i] / max * 100, 8) + '%',
    cls: s.cls,
    inside: counts[i] / max * 100 >= 24
  }))
})

const projTotalCount = computed(() => scopeActive.value.length)
const bidTotalCount = computed(() => bidStore.bids.length)

// 战新业务分布环图（按主标签 mainTag 分组，空值归「一般项目」；配色沿用 BIZ_COLORS）
const donut = computed(() => {
  const total = scopeActive.value.length
  if (!total) return { total: 0, segs: [] }
  // 动态分组：主标签去重计数
  const counts = new Map()
  scopeActive.value.forEach(t => {
    const tag = String((t.projectInfo && t.projectInfo.mainTag) || '').trim()
    const label = tag || '一般项目'
    counts.set(label, (counts.get(label) || 0) + 1)
  })
  // 排序：数量降序；「一般项目」排最后
  const entries = [...counts.entries()].sort((a, b) => {
    if (a[0] === '一般项目') return 1
    if (b[0] === '一般项目') return -1
    return b[1] - a[1]
  })
  const palette = [BIZ_COLORS.blue, BIZ_COLORS.teal, BIZ_COLORS.green, BIZ_COLORS.cyan, BIZ_COLORS.red, BIZ_COLORS.ink]
  const C = 2 * Math.PI * 70 // 439.8
  let acc = 0
  const segs = entries.map(([label, count], i) => {
    const len = count / total * C
    const seg = {
      label, count,
      pct: Math.round(count / total * 100),
      color: label === '一般项目' ? 'var(--muted)' : palette[i % palette.length],
      dash: `${len} ${C}`,
      offset: -acc
    }
    acc += len
    return seg
  })
  return { total, segs }
})

// 回款全景 TOP10
const collTop = computed(() => {
  const rows = collectionTopN(scopeActive.value, 10)
  const maxContract = Math.max(...rows.map(r => r.contract), 1)
  return rows.map(r => ({
    ...r,
    planWidth: (r.contract / maxContract * 100).toFixed(0) + '%',
    actWidth: (r.collected / maxContract * 100).toFixed(0) + '%'
  }))
})

// 收支柱状图 TOP5
const bars = computed(() => barTopN(scopeActive.value, 5))
const axisLabels = computed(() => {
  const max = Math.max(...bars.value.flatMap(b => [b.planRev, b.actualRev, b.planCost, b.actualCost]), 1)
  const step = max / 4
  return [0, 1, 2, 3].map(i => Math.round(max - i * step))
})
const barGroups = computed(() => {
  const max = Math.max(...bars.value.flatMap(b => [b.planRev, b.actualRev, b.planCost, b.actualCost]), 1)
  const n = bars.value.length
  const slot = (600 - 60) / n
  return bars.value.map((b, i) => {
    const cx = 60 + i * slot + slot / 2
    const bw = 22
    const h = v => Math.max(v / max * 120, 1)
    return {
      name: b.name,
      labelLeft: (cx / 600 * 100).toFixed(1) + '%',
      labelWidth: Math.min(slot / 600 * 100, 40).toFixed(1) + '%',
      rects: [
        { x: cx - bw * 2 - 3, y: 140 - h(b.planRev), w: bw, h: h(b.planRev), fill: 'var(--biz-blue)' },
        { x: cx - bw - 1, y: 140 - h(b.actualRev), w: bw, h: h(b.actualRev), fill: 'var(--biz-teal)' },
        { x: cx + 1, y: 140 - h(b.planCost), w: bw, h: h(b.planCost), fill: 'var(--biz-green)' },
        { x: cx + bw + 3, y: 140 - h(b.actualCost), w: bw, h: h(b.actualCost), fill: 'var(--biz-cyan)' }
      ]
    }
  })
})

// 付款/收票/开票三环（分母口径：仅统计分母有值的项目；开票率用合同口径，与 CostView 一致）
const rates = computed(() => {
  const payRate = ratioCohort(scopeActive.value, 'accPayment', 'accInvoice')
  const recRate = ratioCohort(scopeActive.value, 'accReceipt', 'accPayment')
  const invRate = contractRatio(scopeActive.value, 'accInvoice')
  const mk = (label, cohort, color) => {
    const pct = Math.round(cohort.rate * 100)
    const C = 2 * Math.PI * 42
    return { label, value: cohort.n, pct, color, dash: `${Math.min(pct / 100, 1) * C} ${C}` }
  }
  return [
    mk('累计付款', payRate, 'var(--chart-orange)'),
    mk('累计收票', recRate, 'var(--good)'),
    mk('累计开票', invRate, 'var(--warn)')
  ]
})

// 创建人排名
const owners = computed(() => {
  const rows = ownerTopN(scopeActive.value, 5)
  const maxCount = Math.max(...rows.map(o => o.count), 1)
  return rows.map(o => ({
    name: o.name,
    count: o.count,
    width: (o.count / maxCount * 100).toFixed(0) + '%',
    amountText: o.amount > 0 ? fmtWan(o.amount, 0) : '—'
  }))
})

// 逾期风险榜
const overdueList = computed(() => overdueRank(scopeActive.value).slice(0, 6))
</script>

<style scoped lang="scss">
.dashboard-view {
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

.panel-totals {
  display: flex;
  gap: var(--space-5);
  font-size: 12px;

  > span { color: var(--muted); }
  strong { color: var(--fg); font-family: var(--font-mono); margin-left: 4px; }
  .accent-text strong { color: var(--accent); }
}

.funnel-panel {
  grid-row: span 2;
}

.funnel-section {
  margin-bottom: var(--space-4);

  &:last-child { margin-bottom: 0; }
}

.funnel-section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--fg);
  margin-bottom: var(--space-2);
  padding-bottom: 4px;
  border-bottom: 1px solid var(--border);
}

.funnel-foot {
  margin-top: var(--space-4);
  font-size: 11px;
  color: var(--muted);
  display: flex;
  gap: var(--space-4);
}

.funnel-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.funnel-out-text {
  font-size: 12px;
  color: var(--muted);
  white-space: nowrap;
}

.legend-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  margin-top: var(--space-2);
}

// 双列图例（战新分布）
.legend-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px var(--space-4);
}

.legend-line-right {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  white-space: nowrap;
}

.legend-pct {
  color: var(--muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.legend-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 2px;
}

.mono-num {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.budget-col-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.coll-row {
  display: grid;
  grid-template-columns: 160px 1fr 70px;
  align-items: center;
  gap: var(--space-3);
  font-size: 13px;
}

.coll-name {
  font-size: 12px;
  color: var(--fg);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.owner-row {
  display: grid;
  grid-template-columns: 80px 1fr 50px 50px;
  align-items: center;
  gap: var(--space-3);
}

.owner-name { font-size: 12px; font-weight: 500; }
.muted-num { color: var(--muted); }

.bar-svg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: calc(100% - 56px);
}

.rate-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.rate-item {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.rate-svg { width: 80px; height: 80px; flex-shrink: 0; }
.rate-label { font-size: 12px; color: var(--muted); }
.rate-value {
  font-family: var(--font-mono);
  font-size: var(--text-lg);
  font-weight: 600;

  .unit { font-size: 12px; color: var(--muted); font-weight: 400; }
}

.cell-title {
  font-size: 12px;
  font-weight: 500;
  max-width: 200px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cell-text { font-size: 12px; }
</style>
