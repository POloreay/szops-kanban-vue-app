// ========== 常量定义（照搬逻辑文档，保持数据兼容） ==========

// localStorage 键
export const STORAGE_KEY = 'szops_kanban_v2'
export const TODO_KEY = 'szops_todos_v2'
export const SETTINGS_KEY = 'szops_settings_v2'
export const USER_KEY = 'szops_users_v2'
export const LOG_KEY = 'szops_logs_v2'
export const SESSION_KEY = 'szops_session'

// 部门目标：周期与指标定义
// 周期：year（年度）/ quarter（季度）/ month（月度）
// 指标：planRevenue 计划收入（万元）、grossRate 毛利率（%）、netProfit 净利润（万元）、budget 可用预算（万元）
export const TARGET_PERIODS = [
  { key: 'year', label: '年度' },
  { key: 'quarter', label: '季度' },
  { key: 'month', label: '月度' }
]
export const TARGET_METRICS = [
  { key: 'planRevenue', label: '计划收入', unit: '万元' },
  { key: 'grossRate', label: '毛利率', unit: '%' },
  { key: 'netProfit', label: '净利润', unit: '万元' },
  { key: 'budget', label: '可用预算', unit: '万元' }
]

// 投标管理（独立数据域）：生命周期五环节
// 流转：商机跟踪 → 报名准备 → 投标准备 → 开标准备 → 归档任务
// 报名失败/放弃投标 → 直接归档；开标后按结果中标/落标归档
export const BID_STORAGE_KEY = 'szops_bids_v1'
export const BID_STAGES = {
  lead:    { name: '商机跟踪', subs: ['采购意向', '采购需求', '采购预告', '商机录入'] },
  signup:  { name: '报名准备', subs: ['平台注册', '准备资料', '报名成功', '报名失败'] },
  prepare: { name: '投标准备', subs: ['标前评审', '标书编制', '参数核对', '报价核对'] },
  opening: { name: '开标准备', subs: ['打印封标', '开标', '结果反馈'] },
  archive: { name: '归档任务', subs: ['中标归档', '落标归档', '放弃归档'] }
}
export const BID_STAGE_ORDER = ['lead', 'signup', 'prepare', 'opening', 'archive']
export const BID_STAGE_NAMES = Object.fromEntries(BID_STAGE_ORDER.map(k => [k, BID_STAGES[k].name]))
// 环节正向流转映射（opening 之后进入归档，由开标结果决定子状态）
export const BID_NEXT = { lead: 'signup', signup: 'prepare', prepare: 'opening' }

// 实施环节双通道子状态
export const IMPL_SUBS_PATH1 = ['项目交付', '项目初验', '项目终验', '初验不通过', '终验不通过']
export const IMPL_SUBS_PATH2 = ['财务开票', '财务回款', '财务列收']

// 环节与子状态映射
export const STATUS_MAP = {
  talk: { name: '前期环节', subs: ['采购意向', '采购需求', '采购预告', '商机录入', '项目报名'] },
  bid:  { name: '投标环节', subs: ['标前评审', '标书编写', '标书审核', '标书装订/上传', '成功中标', '收入合同签订', '落标归档', '归档结束'] },
  proc: { name: '采购环节', subs: ['采购需求', '采购方案', '现场开标', '采购结果', '支出合同签订', '流标', '项目终止'] },
  impl: { name: '实施环节' }
}

export const STATUS_NAMES = { talk: '前期环节', bid: '投标环节', proc: '采购环节', impl: '实施环节' }
export const STATUS_KEYS = {
  '前期': 'talk', '前期环节': 'talk', '洽谈': 'talk', '洽谈环节': 'talk',
  '投标': 'bid', '投标环节': 'bid',
  '采购': 'proc', '采购环节': 'proc',
  '实施': 'impl', '实施环节': 'impl'
}
export const PRIORITY_NAMES = { high: '高', medium: '中', low: '低' }
export const PRIORITY_KEYS = { '高': 'high', '中': 'medium', '低': 'low' }
export const STATUS_ORDER = ['talk', 'proc', 'impl']
export const STATUS_COLORS = { talk: '#6366f1', bid: '#f59e0b', proc: '#3b82f6', impl: '#ef4444' }
export const WARN_DAYS = 3
export const ARCHIVE_SUBS = ['落标归档', '归档结束', '流标', '项目终止']

// Excel 批量导入列（以用户导出 Excel 为基准，10 列）
export const EXCEL_COLS = ['项目名称', '描述', '创建人', '联系人', '优先级', '截止日期', '状态', '子状态', '需要决策', '项目代理服务费(元)']

// ===== 系统项目状态（XLS「项目状态」字段）→ 看板阶段映射 =====
// 未开工→前期环节；在建→实施环节；完工/验收/业务关闭/财务关闭→实施环节+归档（isArchivedTask 识别）
export const BUILD_STATUS_LIST = ['未开工', '在建', '完工', '验收', '业务关闭', '财务关闭']
export const CLOSED_BUILD_STATUS = ['完工', '验收', '业务关闭', '财务关闭']
// 状态徽标配色：未开工灰 / 在建蓝 / 完工青 / 验收绿 / 业务关闭橙 / 财务关闭深灰
export const BUILD_STATUS_BADGE = {
  '未开工': { pill: '', dot: 'var(--muted)' },
  '在建': { pill: 'accent', dot: 'var(--accent)' },
  '完工': { pill: 'good', dot: 'var(--chart-teal)' },
  '验收': { pill: 'good', dot: 'var(--good)' },
  '业务关闭': { pill: 'warn', dot: 'var(--chart-orange)' },
  '财务关闭': { pill: '', dot: 'var(--muted)' }
}
// 项目状态 → 看板阶段（导入时自动分配）
export function stageByBuildStatus(bs) {
  if (bs === '未开工') return 'talk'
  if (CLOSED_BUILD_STATUS.includes(bs)) return 'impl' // 归档由 isClosedProject 识别
  if (bs === '在建') return 'impl'
  return '' // 未知/空值由调用方回退旧规则
}

// 项目管理手动新建：XLS 提炼字段（快速录入，不设必填校验）
export const XLS_QUICK_FIELDS = [
  { key: 'projectName', label: '项目名称', type: 'text' },
  { key: 'projectId', label: '项目编号', type: 'text' },
  { key: 'projectType', label: '项目类型', type: 'text' },
  { key: 'projectNature', label: '项目性质', type: 'text' },
  { key: 'mainTag', label: '主标签（战新）', type: 'text' },
  { key: 'clientName', label: '客户名称', type: 'text' },
  { key: 'pmName', label: '项目经理名称', type: 'text' },
  { key: 'buildStatus', label: '项目状态', type: 'select', options: BUILD_STATUS_LIST },
  { key: 'createdDate', label: '创建日期', type: 'date' },
  { key: 'planStartDate', label: '计划开始时间', type: 'date' },
  { key: 'planEndDate', label: '计划完成时间', type: 'date' },
  { key: 'contractAmount', label: '合同金额(不含税)', type: 'number' },
  { key: 'planRevenueTax', label: '计划收入(含税)', type: 'number' },
  { key: 'planCost', label: '计划成本', type: 'number' },
  { key: 'actualCost', label: '实际成本', type: 'number' },
  { key: 'accInvoice', label: '累计开票(含税)', type: 'number' },
  { key: 'accCollection', label: '累计收款(含税)', type: 'number' }
]
// 项目总览列表：可配置列（默认显示14个字段；固定列「序号/项目名称/状态/操作」不在此配置范围）
// fmt: text 纯文本 | money 元→万元格式化 | pill 优先级标签 | date 日期 | pct 百分比 | rate 比率列（带颜色阈值）
export const LIST_COLUMNS = [
  { key: 'projectId', label: '项目编号', fmt: 'text' },
  { key: 'buildStatus', label: '项目状态', fmt: 'text' },
  { key: 'pmName', label: '项目经理', fmt: 'text' },
  { key: 'clientName', label: '客户名称', fmt: 'text' },
  { key: 'mainTag', label: '主标签（战新）', fmt: 'text' },
  { key: 'contractAmount', label: '合同金额(不含税/万元)', fmt: 'money' },
  { key: 'planRevenueTax', label: '计划收入(含税/万元)', fmt: 'money' },
  { key: 'ledgerRevenueTax', label: '列账收入(含税/万元)', fmt: 'money' },
  { key: 'revDoneRate', label: '收入完成率', fmt: 'rate' },
  { key: 'accInvoice', label: '累计开票(万元)', fmt: 'money' },
  { key: 'accCollection', label: '累计收款(万元)', fmt: 'money' },
  { key: 'collectionRate', label: '回款率', fmt: 'rate' },
  { key: 'planCost', label: '计划成本(万元)', fmt: 'money' },
  { key: 'actualCost', label: '实际成本(万元)', fmt: 'money' },
  { key: 'costExecRate', label: '成本执行率', fmt: 'rate' },
  { key: 'planGrossMargin', label: '计划毛利率', fmt: 'num' },
  { key: 'actualGrossMargin', label: '实际毛利率', fmt: 'num' },
  { key: 'marginGap', label: '毛利差(pp)', fmt: 'rate' },
  { key: 'accPayment', label: '累计付款(万元)', fmt: 'money' },
  { key: 'accReceipt', label: '累计收票(万元)', fmt: 'money' },
  { key: 'createdAt', label: '创建日期', fmt: 'date' },
  { key: 'auxTag', label: '辅助标签(战新)', fmt: 'text' },
  { key: 'clientCategory', label: '客户分类', fmt: 'text' },
  { key: 'workAreaDesc', label: '施工区域', fmt: 'text' },
  { key: 'planStartDate', label: '计划开始', fmt: 'date' },
  { key: 'planEndDate', label: '计划完成', fmt: 'date' },
  { key: 'businessCloseDate', label: '业务关闭日期', fmt: 'date' },
  { key: 'financeCloseDate', label: '财务关闭日期', fmt: 'date' },
  { key: 'currentActivity', label: '当前业务活动', fmt: 'text' }
]
export const LIST_COLUMNS_DEFAULT = ['projectId', 'buildStatus', 'pmName', 'clientName', 'mainTag', 'contractAmount', 'planRevenueTax', 'ledgerRevenueTax', 'revDoneRate', 'accInvoice', 'accCollection', 'collectionRate', 'planCost', 'actualCost', 'costExecRate', 'planGrossMargin', 'actualGrossMargin', 'marginGap', 'createdAt']
export const LIST_COLUMNS_STORAGE_KEY = 'szops_list_columns'

// 方案M图表配色（对齐用户Excel填充色）
export const BIZ_COLORS = {
  blue: '#4472C4',  // 计划收入
  teal: '#11799E',  // 列账收入 / 投标段
  green: '#A9D08E', // 计划成本（浅）
  cyan: '#D0F0FF',  // 实际成本（浅）
  red: '#C00000',   // 预警红
  ink: '#33502a'    // 浅色段深字
}

// XLS 项目信息字段（86个，对齐 Excel 实际表头，不含序号）
export const XLS_FIELDS = [
  { key: 'projectId', label: '项目编号' },
  { key: 'userCode', label: '用户自定义编码' },
  { key: 'projectName', label: '项目名称' },
  { key: 'shortName', label: '项目简称' },
  { key: 'partyProjectCode', label: '甲方项目编号' },
  { key: 'approvalType', label: '立项方式' },
  { key: 'projectTypeCode', label: '项目类型编号' },
  { key: 'projectType', label: '项目类型' },
  { key: 'projectNature', label: '项目性质' },
  { key: 'confirmType', label: '确收类型' },
  { key: 'netBusinessModel', label: '净额业务模式' },
  { key: 'isTotalPkg', label: '是否总包' },
  { key: 'expansionType', label: '拓展类型' },
  { key: 'isMainGovCollab', label: '是否主实政企协同' },
  { key: 'collabType', label: '协同类型' },
  { key: 'contractHasWorkload', label: '合同是否约定工作量' },
  { key: 'hasCommercialSubstance', label: '是否具有商业实质' },
  { key: 'isAdvance', label: '是否垫资' },
  { key: 'advanceBudget', label: '垫资峰值预算' },
  { key: 'accountingMethod', label: '核算方法' },
  { key: 'mainTag', label: '主标签（战新）' },
  { key: 'auxTag', label: '辅助标签（战新）' },
  { key: 'approvalBasis', label: '立项依据' },
  { key: 'createdBy', label: '创建人' },
  { key: 'createdDate', label: '创建日期' },
  { key: 'approvalPassDate', label: '立项审批通过日期' },
  { key: 'planStartDate', label: '计划开始时间' },
  { key: 'planEndDate', label: '计划完成时间' },
  { key: 'businessCloseDate', label: '业务关闭日期' },
  { key: 'financeCloseDate', label: '财务关闭日期' },
  { key: 'projectLevel', label: '项目层级' },
  { key: 'parentProjectCode', label: '上层项目编号' },
  { key: 'topProjectCode', label: '顶层项目编号' },
  { key: 'currentActivity', label: '项目当前业务活动' },
  { key: 'buildStatus', label: '项目状态' },
  { key: 'isSensitive', label: '是否敏感项目' },
  { key: 'cancelFlag', label: '项目注销标识' },
  { key: 'workAreaCode', label: '施工区域编号' },
  { key: 'workAreaDesc', label: '施工区域描述' },
  { key: 'companyCode', label: '所属公司编号' },
  { key: 'companyName', label: '所属公司' },
  { key: 'deptCode', label: '负责部门编号' },
  { key: 'deptName', label: '负责部门名称' },
  { key: 'pmCode', label: '项目经理编号' },
  { key: 'pmName', label: '项目经理名称' },
  { key: 'clientManager', label: '客户经理' },
  { key: 'proTypeCode', label: '专业类型编号' },
  { key: 'proTypeDesc', label: '专业类型描述' },
  { key: 'isEmergencyRelated', label: '是否关联应急项目' },
  { key: 'siteManager', label: '项目现场负责人' },
  { key: 'smallBusinessUnit', label: '划小经营单元' },
  { key: 'clientCode', label: '客户编码' },
  { key: 'clientName', label: '客户名称' },
  { key: 'clientCategory', label: '客户/供应商分类' },
  { key: 'contact', label: '联系人' },
  { key: 'planRevenueTax', label: '计划收入(含税)' },
  { key: 'taxDesc', label: '稅码描述' },
  { key: 'planRevenueNoTax', label: '计划收入(不含税)' },
  { key: 'outsourceType', label: '专业型外包类型' },
  { key: 'supportOutsourceType', label: '支撑型外包类型' },
  { key: 'planCost', label: '计划成本' },
  { key: 'planMaterial', label: '材料费成本' },
  { key: 'planLabor', label: '人工成本' },
  { key: 'planOutsource', label: '外包/合作费成本' },
  { key: 'planOther', label: '其他费成本' },
  { key: 'planRD', label: '研发支出费成本' },
  { key: 'planGrossMargin', label: '计划毛利率%' },
  { key: 'actualGrossMargin', label: '实际毛利率%' },
  { key: 'contractAmount', label: '项目收入合同金额(不含税)' },
  { key: 'auditAmount', label: '审定金额（不含税）' },
  { key: 'ledgerRevenueTax', label: '列账收入(含税)' },
  { key: 'ledgerRevenueNoTax', label: '列账收入(未税)' },
  { key: 'accPayment', label: '累计付款(含税)' },
  { key: 'accCollection', label: '累计收款(含税)' },
  { key: 'accInvoice', label: '累计开票(含税)' },
  { key: 'accInvoiceNoTax', label: '累计开票(不含税)' },
  { key: 'accReceipt', label: '累计收票(含税)' },
  { key: 'actualCost', label: '实际成本' },
  { key: 'actualOutsource', label: '实际外包成本' },
  { key: 'actualMaterial', label: '实际材料成本' },
  { key: 'actualLabor', label: '实际人工成本' },
  { key: 'actualOther', label: '实际其他成本' },
  { key: 'actualRD', label: '实际研发支出成本' },
  { key: 'closeStatus', label: '项目结项状态' },
  { key: 'isRelated', label: '是否关联交易' },
  { key: 'budgetChange', label: '预算变更次数' }
]

// 预算对照组
export const BUDGET_PAIRS = [
  { plan: 'planCost', actual: 'actualCost', label: '总成本' },
  { plan: 'planMaterial', actual: 'actualMaterial', label: '材料费' },
  { plan: 'planLabor', actual: 'actualLabor', label: '人工成本' },
  { plan: 'planOutsource', actual: 'actualOutsource', label: '外包/合作费' },
  { plan: 'planOther', actual: 'actualOther', label: '其他费' },
  { plan: 'planRD', actual: 'actualRD', label: '研发支出费' }
]

// 里程碑模板
export const MILESTONE_TEMPLATES = [
  {
    name: '投标项目',
    events: ['意向确认', '需求调研完成', '方案提交', '投标报名', '标书编写完成', '开标', '中标公示', '合同签订']
  },
  {
    name: '采购项目',
    events: ['采购需求确认', '采购方案审批', '招标公告', '开标评标', '采购结果公示', '合同签订']
  },
  {
    name: '交付项目',
    events: ['项目启动', '方案设计完成', '开发完成', '测试验收', '试运行', '终验交付', '项目关闭']
  }
]

// 排序循环
export const SORT_CYCLES = ['default', 'asc', 'desc']

// Header 预设颜色
export const HEADER_COLORS = [
  { name: '深空蓝', hex: '#1e293b' }, { name: '午夜黑', hex: '#0f172a' },
  { name: '石墨灰', hex: '#374151' }, { name: '深青', hex: '#134e4a' },
  { name: '森林绿', hex: '#14532d' }, { name: '酒红', hex: '#7f1d1d' },
  { name: '深紫', hex: '#3b0764' }, { name: '靛蓝', hex: '#1e3a5f' },
  { name: '靛青', hex: '#1e40af' }, { name: '宝蓝', hex: '#1d4ed8' },
  { name: '青绿', hex: '#0f766e' }, { name: '翠绿', hex: '#15803d' },
  { name: '琥珀', hex: '#b45309' }, { name: '玫红', hex: '#be123c' },
  { name: '朱红', hex: '#dc2626' }, { name: '岩灰', hex: '#78716c' },
  { name: '深棕', hex: '#5b3a29' }, { name: '极夜紫', hex: '#581c87' }
]

export const HEADER_ICONS = ['📊', '📋', '🏢', '💼', '🚀', '⚡', '🎯', '🔮', '💡', '🗂', '📁', '📈', '🔧', '🎨', '🌟', '💎', '🏆', '🔔', '🖊', '🖥']

// Supabase 云配置
export const SUPABASE_URL = 'https://iauyjnujldspveynwmxt.supabase.co'
export const SUPABASE_KEY = 'sb_publishable_YmEn345fUTisJqtkiAaoGg_FkwUGdvc'
