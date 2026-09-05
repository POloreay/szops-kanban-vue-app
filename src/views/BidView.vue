<template>
  <div class="bid-view">
    <!-- 顶部工具条 -->
    <div class="bid-toolbar">
      <div class="bid-stats">
        <span class="bid-stat">商机 <b>{{ countOf('lead') }}</b></span>
        <span class="bid-stat">报名 <b>{{ countOf('signup') }}</b></span>
        <span class="bid-stat">投标 <b>{{ countOf('prepare') }}</b></span>
        <span class="bid-stat">开标 <b>{{ countOf('opening') }}</b></span>
        <span class="bid-stat muted">归档 <b>{{ countOf('archive') }}</b></span>
      </div>
      <div class="bid-tools">
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

    <!-- 未登录引导 -->
    <div v-if="!userStore.currentUser" class="panel empty-guide">
      <h3>请先登录</h3>
      <p>投标管理需要登录后使用，点击右上角「登录」。</p>
    </div>

    <!-- 五列看板 -->
    <div v-else class="bid-board">
      <div class="bid-col" v-for="stage in BID_STAGE_ORDER" :key="stage">
        <div class="bid-col-head">
          <span class="bid-col-name">{{ BID_STAGES[stage].name }}</span>
          <span class="bid-col-count">{{ lists[stage].length }}</span>
        </div>
        <div class="bid-col-body">
          <div
            v-for="b in lists[stage]"
            :key="b.id"
            class="bid-card"
            :class="[pClass(b.priority), { 'is-archived': stage === 'archive', 'is-overdue': isOverdue(b) }]"
            @click="openDetail(b)"
          >
            <div class="bid-card-title" :title="b.title">{{ b.title || '未命名商机' }}</div>
            <div class="bid-card-sub" v-if="b.subStatus">{{ b.subStatus }}</div>
            <div class="bid-card-meta">
              <span class="g-pill" :class="priorityPill(b.priority)">{{ PRIORITY_NAMES[b.priority] || '中' }}</span>
              <span class="bid-card-owner" v-if="b.owner">{{ b.owner }}</span>
              <span class="bid-card-dl" :class="deadlineClass(b)">{{ deadlineText(b) }}</span>
            </div>
            <!-- 操作区 -->
            <div class="bid-card-ops" @click.stop>
              <!-- 流转：进入下一环节 -->
              <select
                v-if="BID_NEXT[stage]"
                class="bid-op-select"
                :value="''"
                @change="onMove(b, $event)"
              >
                <option value="" disabled>流转到 →</option>
                <option :value="BID_NEXT[stage]">进入「{{ BID_STAGES[BID_NEXT[stage]].name }}」</option>
                <option value="__giveup">放弃投标（归档）</option>
              </select>
              <!-- opening：开标结果 -->
              <template v-else-if="stage === 'opening'">
                <button class="bid-op-btn good" @click="onResult(b, '中标归档')">中标</button>
                <button class="bid-op-btn bad" @click="onResult(b, '落标归档')">落标</button>
                <button class="bid-op-btn" @click="onResult(b, '放弃归档')">放弃</button>
              </template>
              <!-- archive：恢复或删除 -->
              <template v-else>
                <button class="bid-op-btn" @click="onRestore(b)">恢复</button>
                <button v-if="canManage(b)" class="bid-op-btn bad" @click="onDelete(b)">删除</button>
              </template>
              <button v-if="canManage(b) && stage !== 'archive'" class="bid-op-btn" @click="openEdit(b)">编辑</button>
            </div>
          </div>
          <div v-if="!lists[stage].length" class="bid-col-empty">暂无项目</div>
        </div>
      </div>
    </div>

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
import { isOverdue, getDaysLeft, fmtMoney } from '../utils/business'
import BidFormModal from '../components/kanban/BidFormModal.vue'

const bidStore = useBidStore()
const logStore = useLogStore()
const userStore = useUserStore()

onMounted(() => bidStore.loadBids())

const ownerFilter = ref('')

const lists = computed(() => {
  const r = {}
  BID_STAGE_ORDER.forEach(s => {
    r[s] = bidStore.bids.filter(b => (b.stage || 'lead') === s && (!ownerFilter.value || b.owner === ownerFilter.value))
  })
  return r
})

function countOf(stage) {
  return bidStore.bids.filter(b => (b.stage || 'lead') === stage).length
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

// 归档恢复：回到准备开标
function onRestore(b) {
  bidStore.moveBid(b.id, 'opening', '结果反馈')
  ElMessage.success('已恢复到「准备开标」')
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
function pClass(p) { return { high: 'p-high', medium: 'p-mid', low: 'p-low' }[p] || 'p-mid' }
function priorityPill(p) { return { high: 'bad', medium: 'warn', low: 'good' }[p] || 'warn' }
function deadlineClass(b) {
  if (!b.deadline) return 'normal'
  if (isOverdue(b)) return 'overdue'
  return getDaysLeft(b.deadline) <= 7 ? 'soon' : 'normal'
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

.bid-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.bid-stats {
  display: flex;
  gap: var(--space-3);
  font-size: 13px;
  color: var(--muted);

  .bid-stat b {
    color: var(--fg);
    font-family: var(--font-mono);
    font-size: 15px;
    margin: 0 2px;
  }
  .bid-stat.muted b { color: var(--muted); }
}

.bid-tools {
  display: flex;
  align-items: center;
  gap: var(--space-2);
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

// 五列看板
.bid-board {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: var(--space-3);
  align-items: start;
}

@media (max-width: 1400px) {
  .bid-board { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 1000px) {
  .bid-board { grid-template-columns: repeat(2, 1fr); }
}

.bid-col {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--space-2);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-height: 200px;
}

.bid-col-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 4px;

  .bid-col-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--fg);
  }
  .bid-col-count {
    font-size: 12px;
    font-family: var(--font-mono);
    color: var(--muted);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-pill);
    padding: 0 8px;
  }
}

.bid-col-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  max-height: calc(100vh - 300px);
  overflow-y: auto;
}

.bid-col-empty {
  text-align: center;
  font-size: 12px;
  color: var(--muted);
  padding: var(--space-5) 0;
}

.bid-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  cursor: pointer;
  transition: border-color var(--motion-fast), box-shadow var(--motion-fast);

  &:hover {
    border-color: color-mix(in oklch, var(--accent) 40%, transparent);
    box-shadow: var(--elev-raised);
  }

  &.is-archived { opacity: 0.72; }
  &.is-overdue { border-color: color-mix(in oklch, var(--bad) 30%, transparent); }
}

.bid-card-title {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.bid-card-sub {
  font-size: 11px;
  color: var(--accent);
  margin-top: 2px;
}

.bid-card-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  flex-wrap: wrap;
  font-size: 11px;
  color: var(--muted);

  .bid-card-dl {
    &.overdue { color: var(--bad); }
    &.soon { color: var(--warn); }
    &.normal { color: var(--muted); }
  }
}

.bid-card-ops {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.bid-op-select {
  font: inherit;
  font-size: 11px;
  padding: 2px 4px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--fg);
  cursor: pointer;
}

.bid-op-btn {
  font: inherit;
  font-size: 11px;
  padding: 2px 8px;
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
