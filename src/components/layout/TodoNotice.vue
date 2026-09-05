<template>
  <transition name="notice-slide">
    <div v-if="visible" class="todo-notice" role="alert" aria-label="待办公告">
      <div class="notice-head">
        <div class="notice-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          待办公告
        </div>
        <button class="notice-close" type="button" aria-label="关闭公告" @click="close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="notice-body">
        <p class="notice-summary">
          <span class="hello">{{ userStore.currentUser?.username }}</span>，您有
          <b class="num">{{ myUndone.length }}</b> 条待办<template v-if="urgentCount > 0">，其中 <b class="num bad">{{ urgentCount }}</b> 条已逾期 / 今日截止</template><template v-else>，暂无紧急事项</template>
        </p>

        <ul v-if="top3.length" class="notice-list">
          <li v-for="t in top3" :key="t.id" :class="`lv-${t.urgency.key}`">
            <span class="dot" aria-hidden="true"></span>
            <span class="content" :title="t.content">{{ t.content }}</span>
            <span class="deadline">{{ t.urgency.text }}<template v-if="t.deadline"> · {{ t.deadline }}</template></span>
          </li>
        </ul>

        <button class="notice-goto" type="button" @click="gotoTodo">查看全部待办 →</button>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useTodoStore } from '../../stores/todoStore'
import { useUserStore } from '../../stores/userStore'
import { getDaysLeft } from '../../utils/business'

const router = useRouter()
const todoStore = useTodoStore()
const userStore = useUserStore()

const visible = ref(false)
// 手动关闭后的冷却时间：短时间内反复切换标签页不重复打扰
const COOLDOWN_MS = 30 * 1000
let lastCloseAt = 0

// 紧急度分级（与 TodoView 口径一致）
function urgencyOf(t) {
  if (t.done) return { key: 'done', text: '已完成' }
  if (!t.deadline) return { key: 'none', text: '无期限' }
  const d = getDaysLeft(t.deadline)
  if (d < 0) return { key: 'urgent', text: `逾期 ${Math.abs(d)} 天` }
  if (d === 0) return { key: 'urgent', text: '今天截止' }
  if (d <= 3) return { key: 'soon', text: `剩 ${d} 天` }
  return { key: 'normal', text: `剩 ${d} 天` }
}

// 本人未完成待办
const myUndone = computed(() => {
  const me = userStore.currentUser?.username
  if (!me) return []
  return todoStore.todos.filter(t => !t.done && t.owner === me)
})

const urgentCount = computed(() => myUndone.value.filter(t => urgencyOf(t).key === 'urgent').length)

// 最紧急 3 条（紧急 → 临近 → 无期限/正常，同级按截止日期升序）
const top3 = computed(() => {
  const rank = { urgent: 0, soon: 1, none: 2, normal: 3 }
  return [...myUndone.value]
    .sort((a, b) => {
      const ra = rank[urgencyOf(a).key]
      const rb = rank[urgencyOf(b).key]
      if (ra !== rb) return ra - rb
      return (a.deadline || '9999-12-31').localeCompare(b.deadline || '9999-12-31')
    })
    .slice(0, 3)
    .map(t => ({ ...t, urgency: urgencyOf(t) }))
})

function show() {
  if (!userStore.currentUser) return
  if (myUndone.value.length === 0) return
  if (Date.now() - lastCloseAt < COOLDOWN_MS) return
  visible.value = true
}

function close() {
  visible.value = false
  lastCloseAt = Date.now()
}

function gotoTodo() {
  close()
  router.push('/todo')
}

// 登录成功（含刷新后恢复会话）时提醒
watch(() => userStore.currentUser, (u, old) => {
  if (u && u !== old) {
    // 等待登录弹窗关闭、数据就绪后再滑入
    setTimeout(show, 600)
  }
})

// 切回浏览器标签页时提醒，并顺手拉一次云端待办保证数据最新
function onVisibility() {
  if (document.visibilityState === 'visible') {
    todoStore.cloudLoadTodos().catch(() => {})
    show()
  }
}

onMounted(() => {
  document.addEventListener('visibilitychange', onVisibility)
})

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibility)
})
</script>

<style scoped lang="scss">
.todo-notice {
  position: fixed;
  top: 68px;
  right: 16px;
  width: 330px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: 0 12px 32px color-mix(in oklch, #111111 16%, transparent);
  z-index: 1600;
  overflow: hidden;
}

.notice-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: var(--accent-soft);
  border-bottom: 1px solid color-mix(in oklch, var(--accent) 18%, transparent);

  .notice-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
    color: var(--accent);

    svg {
      width: 15px;
      height: 15px;
    }
  }

  .notice-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    padding: 0;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    transition: all var(--motion-fast) var(--ease-standard);

    svg {
      width: 13px;
      height: 13px;
    }

    &:hover {
      background: color-mix(in oklch, var(--fg) 8%, transparent);
      color: var(--fg);
    }
  }
}

.notice-body {
  padding: 12px 14px 13px;
}

.notice-summary {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--fg);
  line-height: 1.6;

  .hello {
    font-weight: 600;
  }

  .num {
    font-weight: 700;
    color: var(--accent);
    font-size: 14px;
  }

  .num.bad {
    color: var(--bad);
  }
}

.notice-list {
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: 1px dashed var(--border);

  li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 0;
    border-bottom: 1px dashed var(--border);

    &:last-child {
      border-bottom: none;
    }

    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
      background: var(--muted);
    }

    .content {
      flex: 1;
      min-width: 0;
      font-size: 13px;
      color: var(--fg);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .deadline {
      flex-shrink: 0;
      font-size: 12px;
      color: var(--muted);
      white-space: nowrap;
    }

    &.lv-urgent {
      .dot { background: var(--bad); box-shadow: 0 0 0 3px color-mix(in oklch, var(--bad) 15%, transparent); }
      .deadline { color: var(--bad); font-weight: 600; }
    }

    &.lv-soon {
      .dot { background: var(--warn); box-shadow: 0 0 0 3px color-mix(in oklch, var(--warn) 15%, transparent); }
      .deadline { color: var(--warn); }
    }

    &.lv-normal .dot { background: var(--good); }
  }
}

.notice-goto {
  display: block;
  width: 100%;
  margin-top: 10px;
  padding: 8px 0;
  border: 1px solid color-mix(in oklch, var(--accent) 30%, transparent);
  border-radius: var(--radius-md);
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--motion-fast) var(--ease-standard);

  &:hover {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-on);
  }
}

// 右侧滑入 / 滑出
.notice-slide-enter-active,
.notice-slide-leave-active {
  transition: transform 0.35s var(--ease-standard), opacity 0.35s var(--ease-standard);
}

.notice-slide-enter-from,
.notice-slide-leave-to {
  transform: translateX(calc(100% + 32px));
  opacity: 0;
}
</style>
