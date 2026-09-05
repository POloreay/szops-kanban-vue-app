<template>
  <aside class="sidebar" :class="{ collapsed }">
    <div class="brand">
      <div class="brand-mark">数</div>
      <span v-show="!collapsed" class="brand-text">数智运营看板</span>
    </div>
    <nav class="nav" aria-label="主导航">
      <template v-for="group in navGroups" :key="group.label">
        <span v-show="!collapsed" class="nav-group-label">{{ group.label }}</span>
        <template v-for="item in group.items" :key="item.path">
          <!-- 带子导航的分组（项目管理） -->
          <div v-if="item.children" class="nav-item-group">
            <router-link
              :to="item.path"
              class="nav-link"
              :class="{ active: currentPath === item.path }"
            >
              <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <component :is="item.iconComp" />
              </svg>
              <span v-show="!collapsed" class="nav-label">{{ item.label }}</span>
            </router-link>
            <button
              v-show="!collapsed"
              class="nav-toggle"
              :class="{ open: groupOpen || isChildActive }"
              type="button"
              :aria-expanded="groupOpen || isChildActive"
              @click="groupOpen = !groupOpen"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6" /></svg>
            </button>
            <div class="nav-sub" :class="{ open: (groupOpen || isChildActive) && !collapsed }">
              <router-link
                v-for="child in item.children"
                :key="child.path"
                :to="child.path"
                class="nav-sub-link"
                :class="{ active: currentPath === child.path }"
              >
                {{ child.label }}
              </router-link>
            </div>
          </div>
          <!-- 普通链接 -->
          <router-link
            v-else
            :to="item.path"
            class="nav-link"
            :class="{ active: currentPath === item.path }"
          >
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <component :is="item.iconComp" />
            </svg>
            <span v-show="!collapsed" class="nav-label">{{ item.label }}</span>
          </router-link>
        </template>
      </template>
    </nav>
    <div v-show="!collapsed" class="sidebar-footer">
      <div class="avatar">李</div>
      <div class="user-meta">
        <span class="user-name">{{ userStore.currentUser?.username || '未登录' }}</span>
        <span class="user-role">{{ userStore.currentUser ? (userStore.isAdmin ? '管理员' : '项目经理') : '请先登录' }}</span>
      </div>
    </div>
    <button v-show="collapsed" class="toggle-btn" @click="$emit('toggle')" title="展开侧栏">
      <span>▶</span>
    </button>
  </aside>
</template>

<script setup>
import { computed, h, ref, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from '../../stores/userStore'

defineProps({ collapsed: Boolean })
defineEmits(['toggle'])

const route = useRoute()
const userStore = useUserStore()
const groupOpen = ref(false)

const currentPath = computed(() => route.path)

// 任一子路由激活时分组自动展开
const isChildActive = computed(() => currentPath.value.startsWith('/kanban/'))
watchEffect(() => {
  if (isChildActive.value) groupOpen.value = true
})

// SVG 图标渲染函数
const iconDashboard = () => [
  h('rect', { x: 3, y: 3, width: 7, height: 9, rx: 1 }),
  h('rect', { x: 14, y: 3, width: 7, height: 5, rx: 1 }),
  h('rect', { x: 14, y: 12, width: 7, height: 9, rx: 1 }),
  h('rect', { x: 3, y: 16, width: 7, height: 5, rx: 1 })
]
const iconProjects = () => h('path', { d: 'M3 7h6l2 2h10v11a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7z' })
const iconBid = () => [
  h('path', { d: 'M19 5 5 19' }),
  h('path', { d: 'M14.5 4.5a3.5 3.5 0 0 1 5 5L7 22H2v-5z' })
]
const iconRevenue = () => h('path', { d: 'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' })
const iconCost = () => [
  h('rect', { x: 3, y: 4, width: 18, height: 16, rx: 2 }),
  h('path', { d: 'M7 8h10M7 12h10M7 16h6' })
]
const iconBudget = () => [
  h('circle', { cx: 12, cy: 12, r: 9 }),
  h('path', { d: 'M12 7v10M9 10h4.5a2 2 0 0 1 0 4H8' })
]
const iconTodo = () => [
  h('rect', { x: 3, y: 4, width: 18, height: 16, rx: 2 }),
  h('path', { d: 'M8 9l2 2 4-4M8 15l2 2 4-4' })
]
const iconUsers = () => [
  h('circle', { cx: 9, cy: 8, r: 3.5 }),
  h('path', { d: 'M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6' }),
  h('circle', { cx: 17.5, cy: 9, r: 2.5 }),
  h('path', { d: 'M16.5 14.5c2.5.3 4.5 2.5 4.5 5.1' })
]

// 三个视图组：业务视图 / 个人空间 / 用户管理（仅 admin）
const navGroups = computed(() => {
  const groups = [
    {
      label: '业务视图',
      items: [
        { path: '/dashboard', label: '仪表盘总览', iconComp: iconDashboard },
        {
          path: '/kanban',
          label: '项目管理',
          iconComp: iconProjects,
          children: [
            { path: '/kanban/pre', label: '前期阶段' },
            { path: '/kanban/procurement', label: '采购阶段' },
            { path: '/kanban/implementation', label: '实施阶段' },
            { path: '/kanban/closed', label: '已关闭项目' }
          ]
        },
        {
          path: '/bid',
          label: '投标管理',
          iconComp: iconBid
        },
        { path: '/revenue', label: '收入管理', iconComp: iconRevenue },
        { path: '/cost', label: '成本管理', iconComp: iconCost },
        { path: '/budget', label: '预算管理', iconComp: iconBudget }
      ]
    },
    {
      label: '个人空间',
      items: [
        { path: '/todo', label: '个人待办', iconComp: iconTodo }
      ]
    }
  ]
  if (userStore.isAdmin) {
    groups.push({
      label: '用户管理',
      items: [
        { path: '/users', label: '用户管理', iconComp: iconUsers }
      ]
    })
  }
  return groups
})
</script>

<style scoped lang="scss">
.sidebar {
  width: 240px;
  background: var(--surface);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  transition: width 0.2s var(--ease-standard);
  flex-shrink: 0;
  height: 100vh;

  &.collapsed {
    width: 56px;
  }
}

.brand {
  height: 56px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 var(--space-4);
  flex-shrink: 0;
}

.brand-mark {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: var(--accent-on);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  flex-shrink: 0;
}

.brand-text {
  font-size: 15px;
  font-weight: 600;
  color: var(--fg);
  white-space: nowrap;
}

.nav {
  flex: 1;
  padding: var(--space-2) var(--space-3);
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
}

.nav-group-label {
  font-size: 11px;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: var(--space-3) var(--space-2) var(--space-1);
  font-weight: 500;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 8px var(--space-2);
  border-radius: var(--radius-sm);
  color: var(--muted);
  transition: all var(--motion-fast) var(--ease-standard);
  text-decoration: none;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 500;

  &:hover {
    background: var(--bg);
    color: var(--fg);
  }

  &.active {
    background: var(--accent-soft);
    color: var(--accent);
  }
}

.nav-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.nav-label {
  flex: 1;
}

// --- 二级导航（项目阶段） ---
.nav-item-group {
  position: relative;
}
.nav-toggle {
  position: absolute;
  right: 4px;
  top: 4px;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--muted);
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: transform var(--motion-fast) var(--ease-standard), background var(--motion-fast) var(--ease-standard);

  &:hover {
    background: var(--bg);
    color: var(--fg);
  }

  svg { width: 12px; height: 12px; }
  &.open { transform: rotate(180deg); }
}
.nav-sub {
  display: none;
  flex-direction: column;
  gap: 2px;
  padding-left: 28px;
  margin-bottom: 2px;

  &.open { display: flex; }
}
.nav-sub-link {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  color: var(--muted);
  text-decoration: none;
  font-size: 13px;
  font-weight: 400;
  transition: background var(--motion-fast) var(--ease-standard), color var(--motion-fast) var(--ease-standard);

  &::before {
    content: '';
    width: 4px;
    height: 4px;
    border-radius: var(--radius-pill);
    background: var(--border);
    flex-shrink: 0;
  }

  &:hover {
    background: var(--bg);
    color: var(--fg);

    &::before { background: var(--muted); }
  }

  &.active {
    color: var(--accent);
    font-weight: 500;
    background: var(--accent-soft);

    &::before { background: var(--accent); }
  }
}

.sidebar-footer {
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-shrink: 0;
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-pill);
  background: var(--accent);
  color: var(--accent-on);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  flex-shrink: 0;
}

.user-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.user-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--fg);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-role {
  font-size: 11px;
  color: var(--muted);
}

.toggle-btn {
  margin: var(--space-2);
  padding: var(--space-2);
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--muted);
  cursor: pointer;
  font-size: 12px;
  transition: all var(--motion-fast) var(--ease-standard);

  &:hover {
    color: var(--fg);
    border-color: var(--muted);
  }
}

// 响应式：窄屏侧栏变水平
@media (max-width: 1024px) {
  .sidebar {
    position: relative;
    width: 100%;
    height: auto;
    border-right: none;
    border-bottom: 1px solid var(--border);

    &.collapsed {
      width: 100%;
    }
  }
  .nav {
    flex-direction: row;
    overflow-x: auto;
    padding-bottom: var(--space-2);
  }
  .nav-group-label,
  .sidebar-footer,
  .toggle-btn {
    display: none;
  }
  .nav > template + .nav-link {
    margin-left: 0;
  }
  .nav-sub {
    display: none;

    &.open {
      display: flex;
      flex-direction: row;
      padding-left: 0;
      gap: var(--space-2);
    }
  }
  .nav-item-group {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }
}
</style>
