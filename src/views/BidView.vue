<template>
  <div class="bid-view">
    <!-- 导航已由左侧边栏「投标管理」子菜单承担（/bid 总览、/bid/{stage} 环节页） -->

    <!-- 未登录引导 -->
    <div v-if="!userStore.currentUser" class="panel empty-guide">
      <h3>请先登录</h3>
      <p>投标管理需要登录后使用，点击右上角「登录」。</p>
    </div>

    <!-- ==================== 投标总览 ==================== -->
    <template v-else-if="tab === 'overview'">
      <!-- 第一行：各环节数量 + 合计金额（不含归档） -->
      <div class="ov-cards">
        <div
          v-for="s in ACTIVE_STAGES"
          :key="s"
          class="ov-card"
          :class="s"
          @click="goTab(s)"
        >
          <div class="ov-card-name">{{ BID_STAGES[s].name }}</div>
          <div class="ov-card-count">{{ stageCounts[s] }}<span class="ov-unit">个</span></div>
          <div class="ov-card-amount">{{ stageAmountText[s] }}</div>
        </div>
        <div class="ov-card ov-total">
          <div class="ov-card-name">在途合计（不含归档）</div>
          <div class="ov-card-count">{{ activeTotalCount }}<span class="ov-unit">个</span></div>
          <div class="ov-card-amount">{{ activeTotalAmountText }}</div>
        </div>
      </div>

      <!-- 第二行：处置时限紧迫度 TOP5（各环节前5，不含归档） -->
      <div class="panel">
        <div class="panel-header">
          <div>
            <h3 class="panel-title">处置时限紧迫榜 · TOP5</h3>
            <div class="panel-subtitle">各环节按截止日期临近程度排序（已逾期置顶） · 不含归档 · 点击行查看详情</div>
          </div>
          <div class="stage-tools">
            <select class="stage-select" v-model="ownerFilter">
              <option value="">全部创建人</option>
              <option v-for="o in bidStore.owners" :key="o" :value="o">{{ o }}</option>
            </select>
            <button v-if="userStore.currentUser" class="btn-del" @click="openNew">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><path d="M12 5v14M5 12h14"/></svg>
              新建投标
            </button>
          </div>
        </div>
        <table class="ds-table" v-if="urgentList.length">
          <thead>
            <tr><th style="width:110px">环节</th><th>项目/商机名称</th><th>子状态</th><th>创建人</th><th>预计金额(万元)</th><th>截止日期</th><th style="width:120px">处置时限</th></tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in urgentList" :key="r.b.id" @click="openDetail(r.b)">
              <td><span class="g-pill stage-pill" :class="r.stageKey"><span class="dot"></span>{{ BID_STAGES[r.b.stage || 'lead'].name }}</span></td>
              <td class="cell-title" :title="r.b.title">{{ r.b.title || '未命名商机' }}</td>
              <td class="cell-text">{{ r.b.subStatus || '—' }}</td>
              <td class="cell-text">{{ r.b.owner || '—' }}</td>
              <td class="num">{{ r.amountText }}</td>
              <td class="cell-text mono">{{ r.b.deadline || '—' }}</td>
              <td><span class="g-pill" :class="r.cls"><span class="dot"></span>{{ r.daysText }}</span></td>
            </tr>
          </tbody>
        </table>
        <div v-else class="stage-empty show">当前无在途投标（不含归档）</div>
      </div>
    </template>

    <!-- ==================== 各环节页 ==================== -->
    <template v-else>
      <div class="panel">
        <div class="panel-header">
          <div>
            <h3 class="panel-title">{{ BID_STAGES[tab].name }} · {{ lists[tab].length }} 条</h3>
            <div class="panel-subtitle">{{ stageSubtitle(tab) }}</div>
          </div>
          <div class="stage-tools">
            <span class="stage-count">合计 {{ fmtWan(stageAmount(tab)) }} 万元</span>
            <select class="stage-select" v-model="ownerFilter">
              <option value="">全部创建人</option>
              <option v-for="o in bidStore.owners" :key="o" :value="o">{{ o }}</option>
            </select>
            <button v-if="userStore.currentUser" class="btn-del" @click="openNew">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><path d="M12 5v14M5 12h14"/></svg>
              新建投标
            </button>
          </div>
        </div>
        <div class="stage-table-wrap">
          <table class="ds-table">
            <thead>
              <tr>
                <th style="width:50px">序号</th>
                <th>项目/商机名称</th>
                <th>子状态</th>
                <th>创建人</th>
                <th>预计金额(万元)</th>
                <th v-if="tab === 'archive'">归档结果</th>
                <th>截止日期</th>
                <th style="width:120px">处置时限</th>
                <th style="width:200px">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(b, i) in lists[tab]" :key="b.id" @click="openDetail(b)" :class="{ 'row-archived': tab === 'archive' }">
                <td class="num row-idx">{{ String(i + 1).padStart(2, '0') }}</td>
                <td class="cell-title" :title="b.title">{{ b.title || '未命名商机' }}</td>
                <td class="cell-text">{{ b.subStatus || '—' }}</td>
                <td class="cell-text">{{ b.owner || '—' }}</td>
                <td class="num">{{ amountText(b) }}</td>
                <td v-if="tab === 'archive'" class="cell-text">
                  <span class="g-pill" :class="archivePill(b.subStatus)"><span class="dot"></span>{{ b.subStatus || '—' }}</span>
                </td>
                <td class="cell-text mono">{{ b.deadline || '—' }}</td>
                <td><span class="g-pill" :class="deadlinePillClass(b)"><span class="dot"></span>{{ deadlineText(b) }}</span></td>
                <td>
                  <div class="row-ops" @click.stop>
                    <!-- 流转：进入下一环节 -->
                    <select v-if="BID_NEXT[tab]" class="bid-op-select" :value="''" @change="onMove(b, $event)">
                      <option value="" disabled>流转到 →</option>
                      <option :value="BID_NEXT[tab]">进入「{{ BID_STAGES[BID_NEXT[tab]].name }}」</option>
                      <option value="__giveup">放弃投标（归档）</option>
                    </select>
                    <!-- opening：开标结果 -->
                    <template v-else-if="tab === 'opening'">
                      <button class="bid-op-btn good" @click="onResult(b, '中标归档')">中标</button>
                      <button class="bid-op-btn bad" @click="onResult(b, '落标归档')">落标</button>
                      <button class="bid-op-btn" @click="onResult(b, '放弃归档')">放弃</button>
                    </template>
                    <!-- archive：恢复或删除 -->
                    <template v-else>
                      <button class="bid-op-btn" @click="onRestore(b)">恢复</button>
                      <button v-if="canManage(b)" class="bid-op-btn bad" @click="onDelete(b)">删除</button>
                    </template>
                    <button v-if="canManage(b) && tab !== 'archive'" class="bid-op-btn" @click="openEdit(b)">编辑</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-if="!lists[tab].length" class="stage-empty show">本环节暂无项目</div>
        </div>
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
import { useRoute, useRouter } from 'vue-router'
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
const route = useRoute()
const router = useRouter()

onMounted(() => bidStore.loadBids())

const ownerFilter = ref('')

// Tab 由路由驱动（与项目管理子页一致）：/bid = 总览，/bid/{stage} = 环节页
const ACTIVE_STAGES = ['lead', 'signup', 'prepare', 'opening']
const tab = computed(() => {
  const m = route.path.match(/^\/bid\/(lead|signup|prepare|opening|archive)$/)
  return m ? m[1] : 'overview'
})
function goTab(t) {
  router.push(t === 'overview' ? '/bid' : `/bid/${t}`)
}

const lists = computed(() => {
  const r = {}
  BID_STAGE_ORDER.forEach(s => {
    r[s] = bidStore.bids.filter(b => (b.stage || 'lead') === s && (!ownerFilter.value || b.owner === ownerFilter.value))
  })
  return r
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
const stageAmount = (s) => (lists.value[s] || []).reduce((a, b) => a + (Number(b.amount) > 0 ? Number(b.amount) : 0), 0)
const stageAmountText = computed(() => {
  const r = {}
  ACTIVE_STAGES.forEach(s => {
    const v = stageAmount(s)
    r[s] = v > 0 ? fmtWan(v, 1) + ' 万元' : '暂无金额'
  })
  return r
})
const activeTotalCount = computed(() => ACTIVE_STAGES.reduce((a, s) => a + (lists.value[s]?.length || 0), 0))
const activeTotalAmount = computed(() => ACTIVE_STAGES.reduce((a, s) => a + stageAmount(s), 0))
const activeTotalAmountText = computed(() => {
  const v = activeTotalAmount.value
  return v > 0 ? fmtWan(v, 1) + ' 万元' : '暂无金额'
})

// 处置时限紧迫榜：四个在途环节各取 TOP5 按剩余天数升序（逾期在前），再整表按紧迫度排序截取前5
const urgentList = computed(() => {
  const rows = []
  ACTIVE_STAGES.forEach(s => {
    (lists.value[s] || []).forEach(b => {
      if (!b.deadline) return
      const d = getDaysLeft(b.deadline)
      rows.push({ b, stageKey: s, days: d })
    })
  })
  rows.sort((a, x) => a.days - x.days)
  return rows.slice(0, 5).map(r => {
    const d = r.days
    return {
      b: r.b,
      stageKey: r.stageKey,
      amountText: amountText(r.b),
      daysText: d < 0 ? `已逾期 ${Math.abs(d)} 天` : `剩 ${d} 天`,
      cls: d < 0 ? 'bad' : d <= 3 ? 'bad' : d <= 7 ? 'warn' : ''
    }
  })
})

function amountText(b) {
  const v = Number(b.amount)
  return v > 0 ? fmtWan(v, 1) : '—'
}

function stageSubtitle(s) {
  const subs = BID_STAGES[s].subs
  if (s === 'archive') return `归档结果：${subs.join(' / ')} · 可恢复或删除`
  return `子状态：${subs.join(' / ')}`
}

function archivePill(sub) {
  if (sub === '中标归档') return 'good'
  if (sub === '落标归档') return 'bad'
  return 'warn'
}

// 权限：创建人本人或管理员
const isAdmin = computed(() => userStore.isAdmin)
function canManage(b) {
  if (isAdmin.value) return true
  const me = userStore.currentUser?.username
  return !!me && b.owner === me
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
function deadlinePillClass(b) {
  if (!b.deadline) return ''
  const d = getDaysLeft(b.deadline)
  if (d < 0) return 'bad'
  if (d <= 7) return 'warn'
  return 'good'
}
function deadlineText(b) {
  if (!b.deadline) return '未设截止'
  const d = getDaysLeft(b.deadline)
  if (d < 0) return `逾期 ${Math.abs(d)} 天`
  return `剩 ${d} 天`
}
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

// 总览第一行：环节卡片
.ov-cards {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: var(--space-3);
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
  padding: var(--space-4);
  cursor: pointer;
  transition: all var(--motion-fast) var(--ease-standard);
  display: flex;
  flex-direction: column;
  gap: 6px;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
    background: var(--stage-color, var(--accent));
  }
  &.lead    { --stage-color: var(--biz-blue); }
  &.signup  { --stage-color: var(--chart-gold); }
  &.prepare { --stage-color: var(--biz-teal); }
  &.opening { --stage-color: var(--chart-orange); }
  &.ov-total { --stage-color: var(--accent); cursor: default; }

  &:hover {
    border-color: color-mix(in oklch, var(--stage-color, var(--accent)) 45%, transparent);
    transform: translateY(-1px);
  }
}
.ov-card-name {
  font-size: 12px;
  color: var(--muted);
  font-weight: 500;
}
.ov-card-count {
  font-size: 26px;
  font-weight: 600;
  font-family: var(--font-mono);
  color: var(--fg);
  line-height: 1.1;

  .ov-unit {
    font-size: 12px;
    font-weight: 400;
    color: var(--muted);
    margin-left: 4px;
  }
}
.ov-card-amount {
  font-size: 12px;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

// 环节 pill 配色
.stage-pill {
  &.lead    .dot { background: var(--biz-blue); }
  &.signup  .dot { background: var(--chart-gold); }
  &.prepare .dot { background: var(--biz-teal); }
  &.opening .dot { background: var(--chart-orange); }
}

// 表格行操作
.row-ops {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}
.row-archived td { opacity: 0.72; }
.row-idx { color: var(--muted); }

.bid-op-select {
  font: inherit;
  font-size: 11px;
  padding: 3px 6px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--fg);
  cursor: pointer;
}
.bid-op-btn {
  font: inherit;
  font-size: 11px;
  padding: 3px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--fg);
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--motion-fast) var(--ease-standard);

  &:hover { border-color: var(--accent); color: var(--accent); }
  &.good:hover { border-color: var(--good); color: var(--good); }
  &.bad:hover { border-color: var(--bad); color: var(--bad); }
}

// 主色按钮（与项目看板删除按钮同款）
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
}

// 弹窗（与全局弹窗同款）
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

.btn-secondary,
.btn-primary {
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
}

.btn-primary {
  border: none;
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
</style>
