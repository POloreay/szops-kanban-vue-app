import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  { path: '/', redirect: '/dashboard' },
  { path: '/dashboard', name: 'dashboard', component: () => import('../views/DashboardView.vue') },
  { path: '/kanban', name: 'kanban', component: () => import('../views/KanbanView.vue') },
  { path: '/kanban/pre', name: 'stage-pre', component: () => import('../views/StageView.vue'), props: { status: 'talk', title: '前期环节', subtitle: '采购意向 / 需求 / 预告 / 商机录入 / 项目报名' } },
  { path: '/kanban/bid', name: 'stage-bid', component: () => import('../views/StageView.vue'), props: { status: 'bid', title: '投标环节', subtitle: '标前评审 / 标书编写审核 / 中标 / 收入合同签订' } },
  { path: '/kanban/procurement', name: 'stage-proc', component: () => import('../views/StageView.vue'), props: { status: 'proc', title: '采购环节', subtitle: '采购方案 / 现场开标 / 采购结果 / 支出合同签订' } },
  { path: '/kanban/implementation', name: 'stage-impl', component: () => import('../views/StageView.vue'), props: { status: 'impl', title: '实施环节', subtitle: '项目交付 · 初验 · 终验 / 财务开票 · 回款 · 列收' } },
  { path: '/revenue', name: 'revenue', component: () => import('../views/RevenueView.vue') },
  { path: '/cost', name: 'cost', component: () => import('../views/CostView.vue') },
  { path: '/budget', name: 'budget', component: () => import('../views/BudgetView.vue') },
  { path: '/todo', name: 'todo', component: () => import('../views/TodoView.vue') },
  { path: '/users', name: 'users', component: () => import('../views/UserManageView.vue') }
]

const router = createRouter({
  history: createWebHashHistory('/szops-kanban/'),
  routes
})

export default router
