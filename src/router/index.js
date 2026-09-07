import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  { path: '/', redirect: '/dashboard' },
  { path: '/dashboard', name: 'dashboard', component: () => import('../views/DashboardView.vue') },
  { path: '/kanban', name: 'kanban', component: () => import('../views/KanbanView.vue') },
  { path: '/kanban/pre', name: 'stage-pre', component: () => import('../views/StageView.vue'), props: { status: 'talk', title: '前期环节', subtitle: '收入合同起草 / 收入合同签订 / 翔云项目立项 / 其他' } },
  { path: '/kanban/procurement', name: 'stage-proc', component: () => import('../views/StageView.vue'), props: { status: 'proc', title: '采购环节', subtitle: '采购需求 / 方案 / 公告公示 / 现场开标 / 候选公示 / 采购结果 / 结果公示 / 支出合同起草签订' } },
  { path: '/kanban/implementation', name: 'stage-impl', component: () => import('../views/StageView.vue'), props: { status: 'impl', title: '实施环节', subtitle: '项目交付 · 初验 · 终验 / 财务开票 · 回款 · 列收' } },
  { path: '/kanban/closed', name: 'stage-closed', component: () => import('../views/StageView.vue'), props: { status: 'closed', title: '已关闭项目', subtitle: '完工 / 验收 / 业务关闭 / 财务关闭 等终态项目' } },
  { path: '/bid', name: 'bid', component: () => import('../views/BidView.vue') },
  { path: '/bid/lead', name: 'bid-lead', component: () => import('../views/BidView.vue'), props: { stage: 'lead' } },
  { path: '/bid/signup', name: 'bid-signup', component: () => import('../views/BidView.vue'), props: { stage: 'signup' } },
  { path: '/bid/prepare', name: 'bid-prepare', component: () => import('../views/BidView.vue'), props: { stage: 'prepare' } },
  { path: '/bid/opening', name: 'bid-opening', component: () => import('../views/BidView.vue'), props: { stage: 'opening' } },
  { path: '/bid/archive', name: 'bid-archive', component: () => import('../views/BidView.vue'), props: { stage: 'archive' } },
  { path: '/revenue', name: 'revenue', component: () => import('../views/RevenueView.vue') },
  { path: '/cost', name: 'cost', component: () => import('../views/CostView.vue') },
  { path: '/budget', name: 'budget', component: () => import('../views/BudgetView.vue') },
  { path: '/todo', name: 'todo', component: () => import('../views/TodoView.vue') },
  { path: '/users', name: 'users', component: () => import('../views/UserManageView.vue') }
]

const router = createRouter({
  history: createWebHashHistory('/szops-kanban-vue-app/'),
  routes
})

export default router
