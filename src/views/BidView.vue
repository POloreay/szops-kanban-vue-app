<template>
  <div class="bid-view">
    <!-- 未登录引导 -->
    <div v-if="!userStore.currentUser" class="panel empty-guide">
      <h3>请先登录</h3>
      <p>投标管理需要登录后使用，点击右上角「登录」。</p>
    </div>

    <template v-else>
      <!-- ==================== 统计卡片行 ==================== -->
      <div class="ov-cards">
        <!-- 在途合计（默认选中） -->
        <div
          class="ov-card total"
          :class="{ active: curStage === 'all' }"
          @click="setStage('all')"
        >
          <div class="nm">在途合计（不含归档）</div>
          <div class="ct">{{ activeTotalCount }}<small>个</small></div>
          <div class="am">{{ activeTotalAmountText }}</div>
        </div>
        <!-- 四个在途环节 -->
        <div
          v-for="s in ACTIVE_STAGES"
          :key="s"
          class="ov-card"
          :class="[s, { active: curStage === s }]"
          @click="setStage(s)"
        >
          <div class="nm">{{ BID_STAGES[s].name }}</div>
          <div class="ct">{{ stageCounts[s] }}<small>个</small></div>
          <div class="am">{{ stageAmountText[s] }}</div>
        </div>
        <!-- 归档任务 -->
        <div
          class="ov-card archive"
          :class="{ active: curStage === 'archive' }"
          @click="setStage('archive')"
        >
          <div class="nm">归档任务</div>
          <div class="ct">{{ stageCounts['archive'] }}<small>个</small></div>
          <div class="am">{{ archiveAmountText }}</div>
        </div>
      </div>

      <!-- ==================== 任务卡片面板 ==================== -->
      <div class="panel">
        <div class="panel-head">
          <div>
            <div class="panel-title">
              <span class="bar" :style="{ background: titleBarColor }"></span>
              环节明细 · {{ curStageName }}
              <span class="cur-count">{{ sortedBids.length }} 条</span>
            </div>
            <div class="panel-sub" v-if="curStage !== 'archive'">点击卡片查看详情 · 卡片底色按紧迫度区分</div>
            <div class="panel-sub" v-else>归档任务 · 可恢复或删除</div>
          </div>
          <div class="panel-tools">
            <!-- 排序切换（归档视图隐藏） -->
            <div class="seg" v-if="curStage !== 'archive'">
              <button
                v-for="opt in SORT_OPTIONS"
                :key="opt.key"
                :class="{ on: curSort === opt.key }"
                @click="curSort = opt.key"
              >{{ opt.label }}</button>
            </div>
            <select class="owner-select" v-model="ownerFilter">
              <option value="">全部创建人</option>
              <option v-for="o in bidStore.owners" :key="o" :value="o">{{ o }}</option>
            </select>
            <button class="btn-new" @click="openNew">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><path d="M12 5v14M5 12h14"/></svg>
              新建投标
            </button>
          </div>
        </div>
        <div class="task-grid">
          <div
            v-for="(b, i) in sortedBids"
            :key="b.id"
            class="tcard"
            :class="cardUrgencyClass(b)"
            @click="openDetail(b)"
          >
            <div class="tcard-body">
              <!-- 序号 -->
              <div class="t-idx">{{ String(i + 1).padStart(2, '0') }}</div>
              <!-- 项目名称 -->
              <div class="t-title" :title="b.title">{{ b.title || '未命名商机' }}</div>
              <!-- 紧迫度 / 归档结果 -->
              <div v-if="curStage === 'archive'" class="t-urge t-urge-archive">{{ archiveResultText(b.subStatus) }}</div>
              <div v-else class="t-urge">
                <span v-if="urgencyOf(b).days === 0" class="star">★</span>
                {{ urgeText(b) }}
              </div>
              <!-- 标签列 -->
              <div class="t-tags">
                <template v-if="curStage === 'archive'">
                  <span class="pill" :class="archivePillClass(b.subStatus)"><span class="dot"></span>{{ b.subStatus || '—' }}</span>
                  <span class="pill">{{ b.deadline || '—' }}</span>
                </template>
                <template v-else>
                  <span class="pill" :class="b.stage || 'lead'"><span class="dot"></span>{{ BID_STAGES[b.stage || 'lead'].name }}</span>
                  <span class="pill">{{ b.subStatus || '—' }}</span>
                </template>
              </div>
              <!-- 金额 -->
              <div class="t-info t-col-amt">
                <span class="k">金额</span>
                <span class="v mono">{{ amountText(b) }}</span>
              </div>
              <!-- 负责人 -->
              <div class="t-info t-col-owner">
                <span class="k">负责人</span>
                <span class="v">{{ b.owner || '—' }}</span>
              </div>
              <!-- 截止/归档日期 -->
              <div class="t-info t-col-dead">
                <span class="k">{{ curStage === 'archive' ? '归档日期' : '截止' }}</span>
                <span class="v mono">{{ b.deadline || '—' }}</span>
              </div>
              <!-- 操作区 -->
              <div class="t-ops" @click.stop>
                <!-- 归档视图：恢复 / 删除 -->
                <template v-if="curStage === 'archive'">
                  <button @click="onRestore(b)">恢复</button>
                  <button v-if="canManage(b)" class="danger" @click="onDelete(b)">删除</button>
                </template>
                <!-- 开标准备：中标 / 落标 / 放弃 / 编辑 -->
                <template v-else-if="(b.stage || 'lead') === 'opening'">
                  <button class="good" @click="onResult(b, '中标归档')">中标</button>
                  <button class="bad" @click="onResult(b, '落标归档')">落标</button>
                  <button @click="onResult(b, '放弃归档')">放弃</button>
                  <button v-if="canManage(b)" @click="openEdit(b)">编辑</button>
                </template>
                <!-- 其他环节：流转 / 放弃 / 编辑 -->
                <template v-else>
                  <select v-if="BID_NEXT[b.stage || 'lead']" class="flow-select" :value="''" @change="onMove(b, $event)">
                    <option value="" disabled>流转→</option>
                    <option :value="BID_NEXT[b.stage || 'lead']">进入「{{ BID_STAGES[BID_NEXT[b.stage || 'lead']].name }}」</option>
                    <option value="__giveup">放弃投标（归档）</option>
                  </select>
                  <button v-if="canManage(b)" @click="openEdit(b)">编辑</button>
                </template>
              </div>
            </div>
          </div>
        </div>
        <div v-if="!sortedBids.length" class="empty">当前{{ curStage === 'archive' ? '归档' : '环节' }}暂无项目</div>
      </div>
    </template>

    <!-- 新建/编辑弹窗 -->
    <BidFormModal v-model="showForm" :editing="editingBid" />

    <!-- 详情抽屉 -->
    <teleport to="body">
      <div class="modal-overlay" v-if="detailBid" @click.self="detailBid = null">
        <div class="modal">
          <div class="modal-header">
            <div>
              <h2 class="modal-title">{{ detailBid.title || '未命名商机' }}</h2>
              <div class="modal-subtitle">{{ BID_STAGE_NAMES[detailBid.stage] }} · {{ detailBid.subStatus || '—' }}</div>
            </div>
            <button class="btn-icon" @click="detailBid = null" aria-label="关闭">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="detail-grid">
              <div class="detail-item"><span class="detail-label">创建人</span><span>{{ detailBid.owner || '—' }}</span></div>
              <div class="detail-item"><span class="detail-label">联系人</span><span>{{ detailBid.contact || '—' }}</span></div>
              <div class="detail-item"><span class="detail-label">优先级</span><span>{{ PRIORITY_NAMES[detailBid.priority] || '中' }}</span></div>
              <div class="detail-item"><span class="detail-label">截止日期</span><span class="mono">{{ detailBid.deadline || '—' }}</span></div>
              <div class="detail-item" v-if="detailBid.amount !== '' && detailBid.amount != null && detailBid.amount > 0"><span class="detail-label">预计金额</span><span class="mono">{{ fmtWan(detailBid.amount) }} 万元</span></div>
              <div class="detail-item" v-if="detailBid.agencyFee"><span class="detail-label">代理服务费(元)</span><span class="mono">{{ fmtMoney(detailBid.agencyFee) }}</span></div>
              <div class="detail-item"><span class="detail-label">创建时间</span><span class="mono">{{ fmtDateTime(detailBid.createdAt) }}</span></div>
            </div>
            <div v-if="detailBid.desc" class="detail-desc">{{ detailBid.desc }}</div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-secondary" @click="detailBid = null">关闭</button>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useBidStore } from '../stores/bidStore'
import { useLogStore } from '../stores/logStore'
import { useUserStore } from '../stores/userStore'
import { BID_STAGES, BID_STAGE_ORDER, BID_STAGE_NAMES, BID_NEXT, PRIORITY_NAMES } from '../utils/constants'
import { fmtWan } from '../utils/finance'
import { getDaysLeft, fmtMoney } from '../utils/business'
import BidFormModal from '../components/kanban/BidFormModal.vue'

const bidStore = useBidStore()
const logStore = useLogStore()
const userStore = useUserStore()

onMounted(() => bidStore.loadBids())

const ownerFilter = ref('')

const ACTIVE_STAGES = ['lead', 'signup', 'prepare', 'opening']
const SORT_OPTIONS = [
  { key: 'urgent', label: '紧迫度' },
  { key: 'amount', label: '金额' },
  { key: 'deadline', label: '截止日期' }
]

// 当前选中的环节：'all' = 全部在途，'archive' = 归档，其余为具体环节
const curStage = ref('all')
const curSort = ref('urgent')

function setStage(s) {
  curStage.value = s
}

const curStageName = computed(() => {
  if (curStage.value === 'all') return '全部在途'
  return BID_STAGES[curStage.value]?.name || '全部在途'
})

const titleBarColor = computed(() => {
  const colors = {
    all: 'var(--accent)',
    lead: 'var(--biz-blue, #6366f1)',
    signup: 'var(--chart-gold, #f59e0b)',
    prepare: 'var(--biz-teal, #0d9488)',
    opening: 'var(--chart-orange, #ea580c)',
    archive: '#64748b'
  }
  return colors[curStage.value] || 'var(--accent)'
})

// 各环节数量（不受创建人筛选影响，反映全量）
const stageCounts = computed(() => {
  const r = {}
  BID_STAGE_ORDER.forEach(s => {
    r[s] = bidStore.bids.filter(b => (b.stage || 'lead') === s).length
  })
  return r
})

// 各环节金额（万元，受创建人筛选影响，不含归档）
const stageAmount = (s) => (filteredBids.value[s] || []).reduce((a, b) => a + (Number(b.amount) > 0 ? Number(b.amount) : 0), 0)
const stageAmountText = computed(() => {
  const r = {}
  ACTIVE_STAGES.forEach(s => {
    const v = stageAmount(s)
    r[s] = v > 0 ? fmtWan(v, 1) + ' 万元' : '暂无金额'
  })
  return r
})
const activeTotalCount = computed(() => ACTIVE_STAGES.reduce((a, s) => a + (filteredBids.value[s]?.length || 0), 0))
const activeTotalAmount = computed(() => ACTIVE_STAGES.reduce((a, s) => a + stageAmount(s), 0))
const activeTotalAmountText = computed(() => {
  const v = activeTotalAmount.value
  return v > 0 ? fmtWan(v, 1) + ' 万元' : '暂无金额'
})

// 归档金额
const archiveAmount = computed(() =>
  (filteredBids.value['archive'] || []).reduce((a, b) => a + (Number(b.amount) > 0 ? Number(b.amount) : 0), 0)
)
const archiveAmountText = computed(() => {
  const v = archiveAmount.value
  return v > 0 ? fmtWan(v, 1) + ' 万元' : '暂无金额'
})

// 按环节+ownerFilter过滤
const filteredBids = computed(() => {
  const r = {}
  BID_STAGE_ORDER.forEach(s => {
    r[s] = bidStore.bids.filter(b => (b.stage || 'lead') === s && (!ownerFilter.value || b.owner === ownerFilter.value))
  })
  return r
})

// 排序后的任务列表
const sortedBids = computed(() => {
  let list
  if (curStage.value === 'all') {
    // 全部在途（不含归档）
    list = bidStore.bids.filter(b =>
      (b.stage || 'lead') !== 'archive' && (!ownerFilter.value || b.owner === ownerFilter.value)
    )
  } else {
    list = filteredBids.value[curStage.value] || []
  }

  // 归档：按截止日期倒序（最近归档的在前）
  if (curStage.value === 'archive') {
    return [...list].sort((a, b) => {
      const da = a.deadline ? new Date(a.deadline).getTime() : 0
      const db = b.deadline ? new Date(b.deadline).getTime() : 0
      return db - da
    })
  }

  // 在途：按选中排序方式
  return [...list].sort((a, b) => {
    if (curSort.value === 'amount') return (Number(b.amount) || 0) - (Number(a.amount) || 0)
    if (curSort.value === 'deadline') {
      const da = a.deadline ? getDaysLeft(a.deadline) : 99999
      const db = b.deadline ? getDaysLeft(b.deadline) : 99999
      return da - db
    }
    // 紧迫度：逾期最前，然后剩余天数升序，无截止最后
    const da = a.deadline ? getDaysLeft(a.deadline) : 99999
    const db = b.deadline ? getDaysLeft(b.deadline) : 99999
    return da - db
  })
})

// 紧迫度判定
function urgencyOf(b) {
  if (!b.deadline) return { key: 'none', days: null }
  const d = getDaysLeft(b.deadline)
  if (d < 0) return { key: 'bad', days: d }
  if (d <= 3) return { key: 'bad', days: d }
  if (d <= 5) return { key: 'warn', days: d }
  return { key: 'normal', days: d }
}

function urgeText(b) {
  if (!b.deadline) return '未设截止'
  const d = getDaysLeft(b.deadline)
  if (d < 0) return `逾期 ${Math.abs(d)} 天`
  if (d === 0) return '今日到期'
  return `剩 ${d} 天`
}

function cardUrgencyClass(b) {
  if (curStage.value === 'archive') return 'archive'
  return urgencyOf(b).key
}

function archiveResultText(sub) {
  if (sub === '中标归档') return '中标'
  if (sub === '落标归档') return '落标'
  if (sub === '放弃归档') return '放弃'
  return '已归档'
}

function amountText(b) {
  const v = Number(b.amount)
  return v > 0 ? fmtWan(v, 1) + ' 万' : '—'
}

function archivePillClass(sub) {
  if (sub === '中标归档') return 'good'
  if (sub === '落标归档') return 'bad'
  return 'warn'
}

// 权限（2026-09-08 调整）：投标管理模块所有用户拥有全部权限
function canManage(_b) {
  return !!userStore.currentUser
}

// 新建/编辑
const showForm = ref(false)
const editingBid = ref(null)
function openNew() {
  if (!userStore.currentUser) {
    ElMessage.warning('请先登录')
    return
  }
  editingBid.value = null
  showForm.value = true
}
function openEdit(b) {
  editingBid.value = b
  showForm.value = true
}

// 详情
const detailBid = ref(null)
function openDetail(b) { detailBid.value = b }

// 环节流转
async function onMove(b, e) {
  const v = e.target.value
  e.target.value = ''
  if (!v) return
  if (v === '__giveup') {
    try {
      await ElMessageBox.confirm(
        `确定放弃「${b.title || '未命名商机'}」投标吗？将移入归档任务。`,
        '放弃投标',
        { confirmButtonText: '放弃并归档', cancelButtonText: '取消', type: 'warning' }
      )
    } catch (err) { return }
    bidStore.archiveBid(b.id, '放弃归档')
    logStore.addLog('投标', `放弃投标并归档「${b.title}」`, userStore.currentUser?.username || '系统')
    ElMessage.success('已归档')
    return
  }
  bidStore.moveBid(b.id, v)
  ElMessage.success(`已进入「${BID_STAGE_NAMES[v]}」`)
}

// 开标结果
function onResult(b, sub) {
  bidStore.archiveBid(b.id, sub)
  logStore.addLog('投标', `「${b.title}」开标结果：${sub.replace('归档', '')}`, userStore.currentUser?.username || '系统')
  ElMessage.success(`已按「${sub}」归档`)
}

// 归档恢复：回到开标准备
function onRestore(b) {
  bidStore.moveBid(b.id, 'opening', '结果反馈')
  ElMessage.success('已恢复到「开标准备」')
}

// 删除（敏感，弹确认）
async function onDelete(b) {
  try {
    await ElMessageBox.confirm(
      `确定删除「${b.title || '未命名商机'}」吗？删除后不可恢复。`,
      '删除投标记录',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }
    )
  } catch (e) { return }
  bidStore.deleteBid(b.id)
  if (detailBid.value?.id === b.id) detailBid.value = null
  logStore.addLog('删除', `删除投标记录「${b.title}」`, userStore.currentUser?.username || '系统')
  ElMessage.success('已删除')
}

// 样式工具
function fmtDateTime(s) {
  if (!s) return '—'
  const d = new Date(s)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
</script>

<style scoped lang="scss">
.bid-view {
  padding: var(--space-5) var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-height: 100%;
}

.empty-guide {
  text-align: center;
  padding: var(--space-8) var(--space-6);
  h3 { font-size: var(--text-base); margin-bottom: var(--space-2); }
  p { color: var(--muted); font-size: 13px; }
}

/* ===== 统计卡片行 ===== */
.ov-cards {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 14px;
}
@media (max-width: 1200px) {
  .ov-cards { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 760px) {
  .ov-cards { grid-template-columns: repeat(2, 1fr); }
}

.ov-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--space-4) 18px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: all .18s ease;
  box-shadow: 0 1px 2px rgba(15, 23, 42, .04);

  &::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
    background: var(--c, var(--accent));
  }

  &.lead    { --c: var(--biz-blue, #6366f1); }
  &.signup  { --c: var(--chart-gold, #f59e0b); }
  &.prepare { --c: var(--biz-teal, #0d9488); }
  &.opening { --c: var(--chart-orange, #ea580c); }
  &.total   { --c: var(--accent); }
  &.archive { --c: #64748b; }

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(15, 23, 42, .08);
    border-color: color-mix(in oklch, var(--c, var(--accent)) 45%, transparent);
  }
  &.active {
    box-shadow: 0 0 0 2px var(--c, var(--accent)), 0 4px 12px rgba(15, 23, 42, .08);
    border-color: var(--c, var(--accent));
  }

  .nm {
    font-size: 12px;
    color: var(--muted);
    font-weight: 500;
  }
  .ct {
    font-size: 28px;
    font-weight: 700;
    font-family: var(--font-mono);
    color: var(--fg);
    line-height: 1.2;
    margin-top: 2px;

    small {
      font-size: 12px;
      font-weight: 400;
      color: var(--muted);
      font-family: inherit;
      margin-left: 3px;
    }
  }
  .am {
    font-size: 12px;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
    margin-top: 4px;
  }
}

/* ===== Panel ===== */
.panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: 0 1px 3px rgba(15, 23, 42, .04);
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
  gap: 10px;
}

.panel-title {
  font-size: 15px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;

  .bar {
    width: 4px;
    height: 16px;
    border-radius: 2px;
    display: inline-block;
  }
  .cur-count {
    font-size: 12px;
    font-weight: 500;
    color: var(--muted);
  }
}

.panel-sub {
  font-size: 12px;
  color: var(--muted);
  margin-top: 2px;
}

.panel-tools {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

/* 排序切换 */
.seg {
  display: inline-flex;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 2px;
  gap: 2px;

  button {
    border: none;
    background: transparent;
    padding: 5px 12px;
    font-size: 12px;
    border-radius: 6px;
    cursor: pointer;
    color: var(--muted);
    font-weight: 500;
    transition: all .15s;
    font-family: inherit;

    &.on {
      background: var(--accent);
      color: var(--accent-on);
      box-shadow: 0 1px 3px color-mix(in oklch, var(--accent) 40%, transparent);
    }
  }
}

/* 创建人筛选 */
.owner-select {
  font: inherit;
  font-size: 12px;
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--fg);
  cursor: pointer;
}

/* 新建按钮 */
.btn-new {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 30px;
  padding: 0 14px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: var(--accent-on);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: background .15s;

  svg { flex-shrink: 0; }
  &:hover { background: var(--primary-hover); }
}

/* ===== 任务卡片网格 ===== */
.task-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px 20px;
}

/* 单行任务卡片 */
.tcard {
  position: relative;
  border-radius: 11px;
  border: 1px solid;
  overflow: hidden;
  cursor: pointer;
  transition: all .16s ease;
  box-shadow: 0 1px 3px rgba(15, 23, 42, .05);
  display: flex;
  align-items: stretch;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 14px rgba(15, 23, 42, .1);
  }

  /* 左侧通高侧边条 */
  &::before {
    content: '';
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 4px;
    background: var(--bc, var(--accent));
    z-index: 1;
  }

  /* 紧迫度底色 */
  &.bad {
    background: color-mix(in srgb, #dc2626 6%, var(--surface));
    border-color: color-mix(in srgb, #dc2626 30%, var(--border));
    --bc: #dc2626;
  }
  &.warn {
    background: color-mix(in srgb, #ea580c 6%, var(--surface));
    border-color: color-mix(in srgb, #ea580c 30%, var(--border));
    --bc: #ea580c;
  }
  &.normal {
    background: color-mix(in srgb, #2563eb 4%, var(--surface));
    border-color: color-mix(in srgb, #2563eb 25%, var(--border));
    --bc: #2563eb;
  }
  &.none {
    background: var(--surface);
    border-color: var(--border);
    --bc: var(--muted);
  }
  &.archive {
    background: color-mix(in srgb, #64748b 4%, var(--surface));
    border-color: var(--border);
    --bc: #64748b;
    opacity: .85;
    &:hover { opacity: 1; }
  }
}

.tcard-body {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0;
  padding: 10px 12px 10px 16px;
  min-width: 0;
}

/* 序号列 */
.t-idx {
  flex: 0 0 36px;
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--muted);
  font-weight: 600;
  text-align: center;
  margin-right: 14px;
}

/* 标题列 */
.t-title {
  flex: 0 0 240px;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--fg);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-right: 12px;
}

/* 紧迫度列 */
.t-urge {
  flex: 0 0 110px;
  font-size: 15px;
  font-weight: 800;
  font-family: var(--font-mono);
  line-height: 1.1;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 4px;

  .star {
    font-size: 13px;
    color: #f59e0b;
    animation: pulse 1.4s ease infinite;
  }

  .tcard.bad & { color: #dc2626; }
  .tcard.warn & { color: #ea580c; }
  .tcard.normal & { color: #059669; }
  .tcard.none & {
    color: var(--muted);
    font-size: 13px;
    font-weight: 600;
  }
}
@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.25); opacity: .75; }
}

/* 归档视图紧迫度列 */
.t-urge-archive {
  color: #64748b;
  font-size: 14px;
  font-weight: 700;
}

/* 标签列 */
.t-tags {
  flex: 0 0 170px;
  display: flex;
  gap: 6px;
  padding-right: 12px;
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  padding: 2px 9px;
  border-radius: 999px;
  font-weight: 500;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--fg);
  white-space: nowrap;

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--c, var(--muted));
  }

  &.lead .dot { background: var(--biz-blue, #6366f1); }
  &.signup .dot { background: var(--chart-gold, #f59e0b); }
  &.prepare .dot { background: var(--biz-teal, #0d9488); }
  &.opening .dot { background: var(--chart-orange, #ea580c); }

  &.good {
    background: color-mix(in srgb, #059669 8%, var(--surface));
    border-color: color-mix(in srgb, #059669 30%, var(--border));
    color: #059669;
    .dot { background: #059669; }
  }
  &.bad {
    background: color-mix(in srgb, #dc2626 8%, var(--surface));
    border-color: color-mix(in srgb, #dc2626 30%, var(--border));
    color: #dc2626;
    .dot { background: #dc2626; }
  }
  &.warn {
    background: color-mix(in srgb, #ea580c 8%, var(--surface));
    border-color: color-mix(in srgb, #ea580c 30%, var(--border));
    color: #ea580c;
    .dot { background: #ea580c; }
  }
}

/* 属性信息列 */
.t-info {
  font-size: 12px;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 5px;

  .k { color: var(--muted); font-size: 11px; }
  .v {
    font-weight: 600;
    color: var(--fg);
    font-variant-numeric: tabular-nums;
  }
  .v.mono { font-family: var(--font-mono); }
}
.t-col-amt { flex: 0 0 110px; padding-right: 12px; }
.t-col-owner { flex: 0 0 90px; padding-right: 12px; }
.t-col-dead { flex: 0 0 120px; padding-right: 12px; }

/* 操作区 */
.t-ops {
  display: flex;
  gap: 5px;
  flex-shrink: 0;
  align-items: center;
  margin-left: auto;

  button {
    border: 1px solid var(--border);
    background: var(--surface);
    font-size: 11.5px;
    padding: 4px 10px;
    cursor: pointer;
    font-family: inherit;
    color: var(--muted);
    transition: all .15s;
    border-radius: 6px;
    white-space: nowrap;

    &:hover {
      border-color: var(--accent);
      color: var(--accent);
    }
    &.good:hover { border-color: #059669; color: #059669; }
    &.bad:hover { border-color: #dc2626; color: #dc2626; }
    &.danger:hover { border-color: #dc2626; color: #dc2626; }
  }
}

.flow-select {
  font: inherit;
  font-size: 11.5px;
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--muted);
  cursor: pointer;

  &:hover { border-color: var(--accent); color: var(--accent); }
}

/* ===== 弹窗 ===== */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: color-mix(in oklab, var(--fg), transparent 60%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: var(--space-6);
}

.modal {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 520px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 8px 32px color-mix(in oklab, var(--fg), transparent 80%);
}

.modal-header {
  padding: var(--space-5) var(--space-5) var(--space-4);
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.modal-title { font-size: var(--text-base); font-weight: 600; margin: 0; }
.modal-subtitle { font-size: 12px; color: var(--muted); margin-top: 2px; }

.btn-icon {
  background: transparent;
  border: none;
  color: var(--muted);
  cursor: pointer;
  padding: 4px;
  border-radius: var(--radius-sm);
  display: flex;

  svg { width: 16px; height: 16px; }
  &:hover { color: var(--fg); background: var(--bg); }
}

.modal-body { padding: var(--space-5); }

.modal-footer {
  padding: var(--space-4) var(--space-5);
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
  font-size: 13px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.detail-label { font-size: 11px; color: var(--muted); }
.mono { font-family: var(--font-mono); }

.detail-desc {
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--border);
  font-size: 13px;
  color: var(--fg);
  line-height: 1.6;
  white-space: pre-wrap;
}

.btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  height: 34px;
  background: var(--surface);
  color: var(--fg);
  border: 1px solid var(--border);

  &:hover { border-color: color-mix(in oklch, var(--fg) 20%, transparent); }
}

.empty {
  padding: 36px 20px;
  text-align: center;
  color: var(--muted);
  font-size: 13px;
}
</style>
