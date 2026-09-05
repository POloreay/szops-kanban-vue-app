<template>
  <div class="todo-view">
    <!-- 顶部：日历筛选 + 统计 -->
    <div class="todo-toolbar panel">
      <div class="cal-filter">
        <button class="cal-nav" type="button" @click="calMonth--" aria-label="上个月">‹</button>
        <div class="cal-title" @click="resetCal">{{ calYear }} 年 {{ calMonth }} 月</div>
        <button class="cal-nav" type="button" @click="calMonth++" aria-label="下个月">›</button>
      </div>
      <div class="cal-stats">
        <button class="stat-chip" :class="{ on: calFilterDay === null }" type="button" @click="calFilterDay = null">
          全部 <b>{{ allTodos.length }}</b>
        </button>
        <button class="stat-chip" :class="{ on: calFilterDay !== null }" type="button" @click="pickCalDay(calFilterDay ?? todayStr)">
          {{ calFilterDay !== null ? calFilterDay + ' 日' : '按日期' }} <b>{{ dayTodos.length }}</b>
        </button>
        <span class="stat-chip static urgent">紧急 <b>{{ urgentCount }}</b></span>
        <span class="stat-chip static soon">临近 <b>{{ soonCount }}</b></span>
        <span class="stat-chip static done">已完成 <b>{{ doneCount }}</b></span>
      </div>
      <div class="toolbar-actions">
        <label class="only-mine">
          <input type="checkbox" v-model="onlyMine" />
          只看我的
        </label>
        <button class="btn-uni" @click="openAdd">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
          新增待办
        </button>
      </div>
    </div>

    <div class="todo-layout">
      <!-- 日历 -->
      <div class="panel cal-panel">
        <div class="cal-week-head">
          <span v-for="w in weekNames" :key="w">{{ w }}</span>
        </div>
        <div class="cal-grid">
          <div
            v-for="(cell, i) in calCells"
            :key="i"
            class="cal-cell"
            :class="{ other: cell.other, today: cell.isToday, selected: cell.dateStr === calFilterDay, 'has-todo': cell.count > 0, weekend: cell.weekend }"
            @click="pickCalDay(cell.dateStr)"
          >
            <span class="cal-day">{{ cell.day }}</span>
            <span v-if="cell.count" class="cal-badge" :class="cell.urgent ? 'urgent' : ''">{{ cell.count }}</span>
          </div>
        </div>
        <div class="cal-legend">
          <span class="lg"><i class="dot urgent"></i>含紧急待办</span>
          <span class="lg"><i class="dot normal"></i>有待办</span>
          <span class="lg"><i class="dot ring"></i>今天</span>
        </div>
      </div>

      <!-- 待办列表 -->
      <div class="panel list-panel">
        <div class="panel-header">
          <div>
            <h3 class="panel-title">{{ calFilterDay !== null ? `${calFilterDay} 日待办` : '全部待办' }}</h3>
            <div class="panel-subtitle">{{ visibleTodos.length }} 条{{ onlyMine ? ' · 仅本人' : '' }}{{ calFilterDay !== null ? ' · 点击日期可取消筛选' : '' }}</div>
          </div>
          <div class="seg-group">
            <button class="seg-btn" :class="{ on: tab === 'todo' }" @click="tab = 'todo'">进行中 {{ undone.length }}</button>
            <button class="seg-btn" :class="{ on: tab === 'done' }" @click="tab = 'done'">已完成 {{ doneCount }}</button>
          </div>
        </div>

        <div v-if="!visibleTodos.length" class="empty-state">
          <p>{{ tab === 'todo' ? '当前没有进行中的待办，点击右上角「新增待办」创建' : '还没有已完成的待办' }}</p>
        </div>

        <div v-else class="todo-list">
          <div
            v-for="g in grouped"
            :key="g.key"
            class="todo-group"
          >
            <div class="group-head" :class="g.key">
              <i class="g-dot"></i>{{ g.label }}<span class="g-count">{{ g.items.length }}</span>
            </div>
            <div
              v-for="t in g.items"
              :key="t.id"
              class="todo-item"
              :class="{ done: t.done }"
            >
              <button class="check" :class="{ checked: t.done }" type="button" @click="onToggle(t)" :aria-label="t.done ? '标记未完成' : '标记完成'">
                <svg v-if="t.done" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
              </button>
              <div class="todo-main">
                <div class="todo-content">{{ t.content }}</div>
                <div class="todo-meta">
                  <span class="owner-chip">{{ t.owner || '未指派' }}</span>
                  <span v-if="t.deadline" class="deadline" :class="urgencyOf(t).cls">{{ t.deadline }}{{ t.time ? ' ' + t.time : '' }}</span>
                  <span v-if="t.done" class="done-tag">已完成</span>
                  <span v-else class="urgent-tag" :class="urgencyOf(t).cls">{{ urgencyOf(t).text }}</span>
                </div>
              </div>
              <div class="todo-actions">
                <button class="icon-btn" type="button" title="编辑" @click="openEdit(t)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                </button>
                <button class="icon-btn danger" type="button" title="删除" @click="onDelete(t)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 新增/编辑弹窗 -->
    <teleport to="body">
      <div class="modal-overlay" v-if="showForm" @click.self="closeForm">
        <div class="modal">
          <div class="modal-header">
            <div>
              <h2 class="modal-title">{{ editingId ? '编辑待办' : '新增待办' }}</h2>
              <div class="modal-subtitle">{{ editingId ? '修改待办内容后保存' : '创建后自动按截止日期计算紧急度' }}</div>
            </div>
            <button class="btn-icon" type="button" @click="closeForm" aria-label="关闭">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <form novalidate @submit.prevent="onSubmit">
            <div class="modal-body">
              <div class="form-row">
                <label>待办内容 <span class="req">*</span></label>
                <textarea class="form-input" v-model.trim="form.content" rows="2" placeholder="如：完成XX项目标书初稿"></textarea>
              </div>
              <div class="form-grid-2">
                <div class="form-row"><label>截止日期</label><input class="form-input" v-model="form.deadline" type="date" /></div>
                <div class="form-row"><label>时间</label><input class="form-input" v-model="form.time" type="time" /></div>
              </div>
              <div class="form-row">
                <label>负责人</label>
                <input class="form-input" v-model.trim="form.owner" :placeholder="defaultOwner" />
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn-cancel" @click="closeForm">取消</button>
              <button type="submit" class="btn-uni">{{ editingId ? '保存修改' : '创建待办' }}</button>
            </div>
          </form>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useTodoStore } from '../stores/todoStore'
import { useUserStore } from '../stores/userStore'
import { getDaysLeft } from '../utils/business'

const todoStore = useTodoStore()
const userStore = useUserStore()

const weekNames = ['一', '二', '三', '四', '五', '六', '日']

// ===== 日历状态 =====
const now = new Date()
const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
const calYear = ref(now.getFullYear())
const calMonth = ref(now.getMonth() + 1)
const calFilterDay = ref(null) // 'YYYY-MM-DD' 或 null

function resetCal() {
  calYear.value = now.getFullYear()
  calMonth.value = now.getMonth() + 1
  calFilterDay.value = null
}

function pickCalDay(d) {
  if (!d) return
  // 切换到该日期所在月
  const [y, m] = d.split('-').map(Number)
  calYear.value = y
  calMonth.value = m
  calFilterDay.value = calFilterDay.value === d ? null : d
}

// 月份修正
function fixMonth() {
  if (calMonth.value < 1) { calMonth.value = 12; calYear.value-- }
  if (calMonth.value > 12) { calMonth.value = 1; calYear.value++ }
}
watch([calYear, calMonth], () => fixMonth())

const calCells = computed(() => {
  const y = calYear.value
  const m = calMonth.value
  const first = new Date(y, m - 1, 1)
  const daysInMonth = new Date(y, m, 0).getDate()
  // 周一为一周开始
  let lead = first.getDay() - 1
  if (lead < 0) lead = 6
  const cells = []
  const prevMonthDays = new Date(y, m - 1, 0).getDate()
  for (let i = lead; i > 0; i--) {
    cells.push({ day: prevMonthDays - i + 1, other: true, count: 0, dateStr: null })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const wd = new Date(y, m - 1, d).getDay()
    const dayTodos = allTodos.value.filter(t => t.deadline === ds && !t.done)
    cells.push({
      day: d,
      other: false,
      dateStr: ds,
      isToday: ds === todayStr,
      weekend: wd === 0 || wd === 6,
      count: dayTodos.length,
      urgent: dayTodos.some(t => urgencyOf(t).key === 'urgent')
    })
  }
  const trail = (7 - cells.length % 7) % 7
  for (let i = 1; i <= trail; i++) {
    cells.push({ day: i, other: true, count: 0, dateStr: null })
  }
  return cells
})

// ===== 筛选 =====
const onlyMine = ref(false)
const tab = ref('todo')

const allTodos = computed(() => todoStore.todos)

const baseList = computed(() => {
  let list = allTodos.value
  if (onlyMine.value && userStore.currentUser) {
    list = list.filter(t => t.owner === userStore.currentUser.username)
  }
  if (calFilterDay.value) {
    list = list.filter(t => t.deadline === calFilterDay.value)
  }
  return list
})

const dayTodos = computed(() => {
  if (!calFilterDay.value) return []
  return baseList.value.filter(t => t.deadline === calFilterDay.value)
})

// 紧急度计算
function urgencyOf(t) {
  if (t.done) return { key: 'done', cls: 'u-done', text: '已完成' }
  if (!t.deadline) return { key: 'none', cls: 'u-none', text: '无期限' }
  const d = getDaysLeft(t.deadline)
  if (d < 0) return { key: 'urgent', cls: 'u-urgent', text: `逾期 ${Math.abs(d)} 天` }
  if (d === 0) return { key: 'urgent', cls: 'u-urgent', text: '今天截止' }
  if (d <= 3) return { key: 'soon', cls: 'u-soon', text: `剩 ${d} 天` }
  return { key: 'normal', cls: 'u-normal', text: `剩 ${d} 天` }
}

const urgencyRank = { urgent: 0, soon: 1, none: 2, normal: 3, done: 4 }

const undone = computed(() => baseList.value.filter(t => !t.done))
const doneList = computed(() => baseList.value.filter(t => t.done))
const doneCount = computed(() => doneList.value.length)

const visibleTodos = computed(() => {
  const list = tab.value === 'todo' ? undone.value : doneList.value
  return [...list].sort((a, b) => {
    // 进行中：紧急优先 → 截止日期升序；已完成：完成时间倒序
    if (tab.value === 'todo') {
      const ra = urgencyRank[urgencyOf(a).key]
      const rb = urgencyRank[urgencyOf(b).key]
      if (ra !== rb) return ra - rb
      return (a.deadline || '9999-12-31').localeCompare(b.deadline || '9999-12-31')
    }
    return String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || ''))
  })
})

// 分组展示（仅进行中 tab）
const grouped = computed(() => {
  if (tab.value !== 'todo') {
    return [{ key: 'done', label: '已完成', items: visibleTodos.value }]
  }
  const defs = [
    { key: 'urgent', label: '紧急（逾期 / 今天截止）' },
    { key: 'soon', label: '临近（3 天内截止）' },
    { key: 'none', label: '无截止日期' },
    { key: 'normal', label: '正常' }
  ]
  return defs
    .map(d => ({ ...d, items: visibleTodos.value.filter(t => urgencyOf(t).key === d.key) }))
    .filter(g => g.items.length)
})

const urgentCount = computed(() => allTodos.value.filter(t => !t.done && ['urgent'].includes(urgencyOf(t).key)).length)
const soonCount = computed(() => allTodos.value.filter(t => !t.done && urgencyOf(t).key === 'soon').length)

// ===== CRUD =====
const showForm = ref(false)
const editingId = ref(null)
const form = ref({ content: '', deadline: '', time: '', owner: '' })

const defaultOwner = computed(() => userStore.currentUser?.username || '')

function openAdd() {
  if (!userStore.currentUser) {
    ElMessage.warning('请先登录后再创建待办')
    return
  }
  editingId.value = null
  form.value = {
    content: '',
    deadline: calFilterDay.value || '',
    time: '',
    owner: defaultOwner.value
  }
  showForm.value = true
}

function openEdit(t) {
  editingId.value = t.id
  form.value = { content: t.content, deadline: t.deadline || '', time: t.time || '', owner: t.owner || '' }
  showForm.value = true
}

function closeForm() {
  showForm.value = false
  editingId.value = null
}

function onSubmit() {
  if (!form.value.content) {
    ElMessage.warning('请填写待办内容')
    return
  }
  if (editingId.value) {
    todoStore.updateTodo(editingId.value, {
      content: form.value.content,
      deadline: form.value.deadline,
      time: form.value.time,
      owner: form.value.owner,
      updatedAt: new Date().toISOString()
    })
    ElMessage.success('待办已更新')
  } else {
    todoStore.addTodo({
      content: form.value.content,
      deadline: form.value.deadline,
      time: form.value.time,
      owner: form.value.owner || defaultOwner.value
    })
    ElMessage.success('待办已创建')
  }
  closeForm()
}

async function onDelete(t) {
  try {
    await ElMessageBox.confirm(`确定删除待办「${t.content.length > 20 ? t.content.slice(0, 20) + '…' : t.content}」？`, '删除待办', { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' })
  } catch (e) {
    return
  }
  todoStore.deleteTodo(t.id)
  ElMessage.success('已删除')
}

function onToggle(t) {
  todoStore.updateTodo(t.id, { done: !t.done, updatedAt: new Date().toISOString() })
}
</script>

<style scoped lang="scss">
.todo-view {
  padding: var(--space-5) var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

// ===== 顶部工具条 =====
.todo-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-5);
  padding: var(--space-3) var(--space-5);
  flex-wrap: wrap;
}

.cal-filter {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.cal-nav {
  width: 28px;
  height: 28px;
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: var(--radius-sm);
  color: var(--muted);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  transition: all var(--motion-fast) var(--ease-standard);

  &:hover { color: var(--fg); border-color: var(--muted); }
}

.cal-title {
  font-size: 15px;
  font-weight: 600;
  min-width: 118px;
  text-align: center;
  cursor: pointer;
  color: var(--fg);

  &:hover { color: var(--accent); }
}

.cal-stats {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.stat-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: var(--radius-pill);
  padding: 4px 12px;
  font-size: 12px;
  color: var(--muted);
  cursor: pointer;
  transition: all var(--motion-fast) var(--ease-standard);

  b { color: var(--fg); font-family: var(--font-mono); }

  &:hover { border-color: var(--muted); }

  &.on {
    border-color: var(--accent);
    color: var(--accent);
    background: var(--accent-soft);
    b { color: var(--accent); }
  }

  &.static { cursor: default; }
  &.static:hover { border-color: var(--border); }

  &.urgent b { color: var(--bad); }
  &.soon b { color: var(--warn); }
  &.done b { color: var(--good); }
}

.toolbar-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.only-mine {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--muted);
  cursor: pointer;

  input { accent-color: var(--accent); cursor: pointer; }
}

// ===== 布局 =====
.todo-layout {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: var(--space-5);
  align-items: start;
}

@media (max-width: 1100px) {
  .todo-layout { grid-template-columns: 1fr; }
}

// ===== 日历 =====
.cal-panel {
  padding: var(--space-4);
}

.cal-week-head {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
  font-size: 11px;
  color: var(--muted);
  margin-bottom: var(--space-2);

  span { padding: 4px 0; }
}

.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.cal-cell {
  position: relative;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-family: var(--font-mono);
  color: var(--fg);
  cursor: pointer;
  transition: all var(--motion-fast) var(--ease-standard);

  &.other { color: color-mix(in oklch, var(--muted) 40%, transparent); }
  &.weekend .cal-day { color: color-mix(in oklch, var(--accent) 65%, var(--muted)); }
  &.has-todo { background: var(--accent-soft); font-weight: 600; }
  &.today { box-shadow: inset 0 0 0 1.5px var(--accent); }
  &.selected { background: var(--accent); color: var(--accent-on); }
  &.selected.has-todo { background: var(--accent); }
  &:hover { background: var(--bg); }
  &.selected:hover { background: var(--accent); }
}

.cal-badge {
  position: absolute;
  bottom: 2px;
  right: 3px;
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  border-radius: var(--radius-pill);
  background: var(--accent);
  color: #fff;
  font-size: 9px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;

  &.urgent { background: var(--bad); }
}

.cal-cell.selected .cal-badge {
  background: #fff;
  color: var(--accent);
}

.cal-legend {
  display: flex;
  gap: var(--space-4);
  margin-top: var(--space-3);
  font-size: 11px;
  color: var(--muted);
  flex-wrap: wrap;

  .lg { display: inline-flex; align-items: center; gap: 5px; }
  .dot { width: 8px; height: 8px; border-radius: 3px; display: inline-block; }
  .dot.urgent { background: var(--bad); }
  .dot.normal { background: var(--accent-soft); box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--accent) 35%, transparent); }
  .dot.ring { background: transparent; box-shadow: inset 0 0 0 1.5px var(--accent); }
}

// ===== 列表 =====
.list-panel {
  padding: var(--space-5);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-4);
  gap: var(--space-3);
}

.panel-title { font-size: var(--text-lg); font-weight: 600; margin: 0; }
.panel-subtitle { font-size: 12px; color: var(--muted); margin-top: 4px; }

.seg-group {
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  flex-shrink: 0;
}

.seg-btn {
  border: none;
  background: var(--surface);
  padding: 6px 14px;
  font-size: 12px;
  color: var(--muted);
  cursor: pointer;
  transition: all var(--motion-fast) var(--ease-standard);

  &.on { background: var(--accent-soft); color: var(--accent); font-weight: 600; }
  &:not(.on):hover { color: var(--fg); background: var(--bg); }
}

.empty-state {
  text-align: center;
  padding: var(--space-12) var(--space-4);
  color: var(--muted);
  font-size: 13px;
}

.todo-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.todo-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.group-head {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  font-weight: 600;
  color: var(--fg);

  .g-dot { width: 8px; height: 8px; border-radius: 3px; display: inline-block; }
  .g-count {
    font-size: 11px;
    color: var(--muted);
    font-weight: 400;
    background: var(--bg);
    border-radius: var(--radius-pill);
    padding: 1px 8px;
  }

  &.urgent { color: var(--bad); .g-dot { background: var(--bad); } }
  &.soon { color: color-mix(in oklch, var(--warn) 75%, var(--fg)); .g-dot { background: var(--warn); } }
  &.none { color: var(--muted); .g-dot { background: var(--border); } }
  &.normal { color: var(--fg); .g-dot { background: var(--accent); } }
  &.done { color: var(--good); .g-dot { background: var(--good); } }
}

.todo-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  transition: border-color var(--motion-fast) var(--ease-standard), box-shadow var(--motion-fast) var(--ease-standard);

  &:hover {
    border-color: color-mix(in oklch, var(--accent) 35%, var(--border));
    box-shadow: var(--elev-raised);
  }

  &.done { opacity: 0.62; }
  &.done .todo-content { text-decoration: line-through; color: var(--muted); }
}

.check {
  width: 20px;
  height: 20px;
  border: 1.5px solid var(--border);
  border-radius: var(--radius-pill);
  background: var(--surface);
  cursor: pointer;
  flex-shrink: 0;
  margin-top: 1px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--motion-fast) var(--ease-standard);

  svg { width: 11px; height: 11px; }

  &:hover { border-color: var(--accent); }

  &.checked {
    background: var(--good);
    border-color: var(--good);
    color: #fff;
  }
}

.todo-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.todo-content {
  font-size: 13px;
  color: var(--fg);
  line-height: 1.5;
  word-break: break-all;
}

.todo-meta {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
  font-size: 11px;
}

.owner-chip {
  color: var(--muted);
  background: var(--bg);
  padding: 1px 8px;
  border-radius: var(--radius-pill);
}

.deadline {
  font-family: var(--font-mono);
  color: var(--muted);

  &.u-urgent { color: var(--bad); font-weight: 600; }
  &.u-soon { color: var(--warn); font-weight: 600; }
}

.urgent-tag {
  padding: 1px 8px;
  border-radius: var(--radius-pill);
  font-weight: 500;

  &.u-urgent { background: color-mix(in oklch, var(--bad) 8%, transparent); color: var(--bad); }
  &.u-soon { background: color-mix(in oklch, var(--warn) 12%, transparent); color: color-mix(in oklch, var(--warn) 75%, var(--fg)); }
  &.u-normal { background: var(--bg); color: var(--muted); }
  &.u-none { background: var(--bg); color: var(--muted); }
  &.u-done { background: color-mix(in oklch, var(--good) 8%, transparent); color: var(--good); }
}

.done-tag {
  padding: 1px 8px;
  border-radius: var(--radius-pill);
  background: color-mix(in oklch, var(--good) 8%, transparent);
  color: var(--good);
}

.todo-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity var(--motion-fast) var(--ease-standard);
  flex-shrink: 0;
}

.todo-item:hover .todo-actions { opacity: 1; }

.icon-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  color: var(--muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--motion-fast) var(--ease-standard);

  svg { width: 14px; height: 14px; }

  &:hover { background: var(--accent-soft); color: var(--accent); }
  &.danger:hover { background: color-mix(in oklch, var(--bad) 8%, transparent); color: var(--bad); }
}

// ===== 弹窗（复用全局 modal 样式类名） =====
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
  width: 480px;
  max-width: calc(100vw - 32px);
  background: var(--surface);
  border-radius: var(--radius-lg);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.16);
  overflow: hidden;
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

.form-row {
  display: flex;
  flex-direction: column;
  gap: 6px;

  label { font-size: 12px; color: var(--muted); font-weight: 500; }
  .req { color: var(--bad); }
}

.form-grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
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

  // 取消按钮与主按钮同规格（形状/大小一致，仅配色为白底）
  .btn-cancel {
    height: 34px;
    padding: 6px 12px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--fg);
    font-size: 13px;
    cursor: pointer;

    &:hover { background: var(--bg-hover, #f5f7fa); }
  }
}
</style>
