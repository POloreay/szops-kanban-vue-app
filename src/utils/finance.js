// ========== 财务数据汇总工具（从 task.projectInfo 动态计算） ==========
// 单位说明：projectInfo 内金额均为元，视图展示按「万元」换算（/10000）

import { isArchivedTask, isClosedProject } from './business'

// 项目信息金额字段取值（元 → 数字，空/非法返回 0）
export function num(v) {
  if (v === '' || v === undefined || v === null) return 0
  const n = Number(v)
  return isNaN(n) ? 0 : n
}

// 元 → 万元（保留 1 位小数的数字）
export function toWan(v) {
  return num(v) / 10000
}

// 万元格式化：1234.5 → "1,234.5"，小值保留 1 位
export function fmtWan(v, digits = 1) {
  const w = num(v) / 10000
  return w.toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

// 项目的合同额（元）：仅取 projectInfo.contractAmount，不再回退 agencyFee（口径不同）
export function contractAmountOf(t) {
  const info = t?.projectInfo || {}
  return num(info.contractAmount)
}

// 项目的累计回款（元）：accCollection
export function collectionOf(t) {
  return num(t?.projectInfo?.accCollection)
}

// 有效项目（active，含全部四阶段；默认排除已关闭项目：落标/流标归档 + 系统项目状态已关闭）
export function activeTasks(tasks, opts = {}) {
  const includeClosed = !!opts.includeClosed
  return tasks.filter(t => {
    if (isArchivedTask(t)) return false
    if (!includeClosed && isClosedProject(t)) return false
    return true
  })
}

// 是否显示已关闭项目（总览页开关传递；includeClosed=true 时返回全部，含老归档）
export function allTasksIncludingClosed(tasks) {
  return tasks.filter(t => !isArchivedTask(t))
}

// ===== 汇总（均返回元）=====
export function sumField(tasks, path) {
  return tasks.reduce((acc, t) => {
    const info = t.projectInfo || {}
    return acc + num(info[path])
  }, 0)
}

// 合同总额（仅统计有 contractAmount 的项目，不再回退 agencyFee）
export function totalContract(tasks) {
  return tasks.reduce((acc, t) => acc + contractAmountOf(t), 0)
}

// 累计回款
export function totalCollection(tasks) {
  return tasks.reduce((acc, t) => acc + collectionOf(t), 0)
}

// 回款率（0-1）
export function collectionRate(tasks) {
  const c = totalCollection(tasks)
  const total = totalContract(tasks)
  return total > 0 ? c / total : 0
}

// 分母口径比率：仅统计分母字段有值的项目，避免字段缺失导致比率失真（如付款/开票 400%）
// 返回 { n: 分子合计, d: 分母合计, rate: 比率 }
export function ratioCohort(tasks, numPath, denPath) {
  let n = 0
  let d = 0
  tasks.forEach(t => {
    const info = t.projectInfo || {}
    const dv = num(info[denPath])
    if (dv > 0) {
      d += dv
      n += num(info[numPath])
    }
  })
  return { n, d, rate: d > 0 ? n / d : 0 }
}

// 待付款合计（逐项目正差额求和，避免全局轧差被超付项目抵消）
export function sumPending(tasks) {
  return tasks.reduce((acc, t) => {
    const info = t.projectInfo || {}
    return acc + Math.max(num(info.accInvoice) - num(info.accPayment), 0)
  }, 0)
}

// 项目的待付款额（开票-付款，负数归零）
export function pendingOf(t) {
  const info = t?.projectInfo || {}
  return Math.max(num(info.accInvoice) - num(info.accPayment), 0)
}

// 合同口径比率：仅统计有合同额（projectInfo.contractAmount，不含代理服务费回退）的项目
export function contractRatio(tasks, field) {
  let n = 0
  let d = 0
  tasks.forEach(t => {
    const info = t.projectInfo || {}
    const c = num(info.contractAmount)
    if (c > 0) {
      d += c
      n += num(info[field])
    }
  })
  return { n, d, rate: d > 0 ? n / d : 0 }
}

// 付款率 = accPayment / accInvoice（开票口径）
export function paymentRate(tasks) {
  const p = sumField(tasks, 'accPayment')
  const i = sumField(tasks, 'accInvoice')
  return i > 0 ? p / i : 0
}

// 收票率 = accReceipt / accPayment（实付口径收票覆盖）
export function receiptRate(tasks) {
  const r = sumField(tasks, 'accReceipt')
  const p = sumField(tasks, 'accPayment')
  return p > 0 ? r / p : 0
}

// 开票率 = accInvoice / contractAmount（合同口径，与 CostView 一致）
export function invoiceRate(tasks) {
  const r = contractRatio(tasks, 'accInvoice')
  return r.rate
}

// 回款明细行（按合同额降序，过滤无合同额的）
export function revenueRows(tasks) {
  return tasks
    .map(t => {
      const contract = contractAmountOf(t)
      const collected = collectionOf(t)
      const rate = contract > 0 ? collected / contract : 0
      return { task: t, contract, collected, rate }
    })
    .filter(r => r.contract > 0)
    .sort((a, b) => b.contract - a.contract)
}

// 付款明细行（按累计付款降序）
export function paymentRows(tasks) {
  return tasks
    .map(t => {
      const info = t.projectInfo || {}
      const paid = num(info.accPayment)
      const actualCost = num(info.actualCost)
      const rate = actualCost > 0 ? paid / actualCost : 0
      return { task: t, paid, actualCost, rate }
    })
    .filter(r => r.paid > 0 || r.actualCost > 0)
    .sort((a, b) => b.paid - a.paid)
}

// 预算对照行（计划 vs 实际收入/成本/毛利率，过滤全空项目）
export function budgetRowsOf(tasks) {
  return tasks
    .map(t => {
      const info = t.projectInfo || {}
      const planRev = num(info.planRevenueNoTax)
      const actualRev = num(info.ledgerRevenueNoTax)
      const planCost = num(info.planCost)
      const actualCost = num(info.actualCost)
      const planRate = num(info.planGrossMargin)
      const actualRate = num(info.actualGrossMargin)
      return {
        task: t,
        planRev, actualRev, planCost, actualCost, planRate, actualRate,
        costOver: planCost > 0 && actualCost > planCost,
        revAchieve: planRev > 0 ? actualRev / planRev : 0,
        costDeviation: planCost > 0 ? (actualCost - planCost) / planCost : 0
      }
    })
    .filter(r => r.planRev > 0 || r.actualRev > 0 || r.planCost > 0 || r.actualCost > 0)
}

// 柱状图数据：TOP N 项目的四项金额（计划收入/列账收入/计划成本/实际成本，万元）
// 排序口径：计划收入(含税) + 列账收入(含税)，同口径相加
export function barTopN(tasks, n = 5) {
  return tasks
    .map(t => {
      const info = t.projectInfo || {}
      const fullName = (info.projectName || t.title || '—')
      return {
        id: t.id,
        name: fullName,
        fullName,
        planRev: toWan(info.planRevenueTax),
        actualRev: toWan(info.ledgerRevenueTax),
        planCost: toWan(info.planCost),
        actualCost: toWan(info.actualCost)
      }
    })
    .filter(r => r.planRev > 0 || r.actualRev > 0 || r.planCost > 0 || r.actualCost > 0)
    .sort((a, b) => (b.planRev + b.actualRev) - (a.planRev + a.actualRev))
    .slice(0, n)
}

// 回款全景 TOP N（合同额降序；底条=合同额，覆盖条=回款）
export function collectionTopN(tasks, n = 10) {
  return revenueRows(tasks)
    .slice(0, n)
    .map((r, i) => ({
      id: r.task.id,
      name: r.task.title,
      contract: r.contract,
      collected: r.collected,
      rate: r.rate,
      color: ['#4472C4', '#11799E', '#A9D08E', '#D0F0FF'][i % 4]
    }))
}

// 创建人排名 TOP N
export function ownerTopN(tasks, n = 5) {
  const map = {}
  tasks.forEach(t => {
    if (!t.owner) return
    if (!map[t.owner]) map[t.owner] = { name: t.owner, count: 0, amount: 0 }
    map[t.owner].count += 1
    map[t.owner].amount += contractAmountOf(t)
  })
  return Object.values(map)
    .sort((a, b) => b.count - a.count || b.amount - a.amount)
    .slice(0, n)
}

// 逾期风险榜（逾期天数降序；项目口径：计划完成时间 planEndDate，仅在建/未开工项目计入）
export function overdueRank(tasks) {
  return tasks
    .map(t => {
      const info = t.projectInfo || {}
      const pe = info.planEndDate || ''
      if (!pe || info.buildStatus === '完工' || CLOSED_BUILD_STATUS_SET.has(info.buildStatus)) return null
      const d = new Date(String(pe).replace(/\//g, '-'))
      if (isNaN(d)) return null
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      d.setHours(0, 0, 0, 0)
      const days = Math.round((today - d) / 86400000)
      if (days <= 0) return null
      return { task: t, days }
    })
    .filter(Boolean)
    .sort((a, b) => b.days - a.days)
}
const CLOSED_BUILD_STATUS_SET = new Set(['完工', '验收', '业务关闭', '财务关闭'])

// ===== 经营分析「轮盘」配置数据源：项目选择器 =====
// 按年度/月度/项目经理筛出的全部状态项目（含已关闭），供用户勾选纳入统计范围
export function selectableProjects(tasks, { year = 'all', month = 'all', pm = 'all' } = {}) {
  return tasks
    .filter(t => !isArchivedTask(t))
    .filter(t => matchYearMonth(t, year, month))
    .filter(t => pm === 'all' || String(t.projectInfo?.pmName || '').trim() === pm)
    .map(t => ({
      id: t.id,
      name: t.projectInfo?.projectName || t.title || '—',
      pm: t.projectInfo?.pmName || '',
      buildStatus: t.projectInfo?.buildStatus || '',
      createdDate: t.projectInfo?.createdDate || '',
      contract: contractAmountOf(t)
    }))
    .sort((a, b) => b.contract - a.contract || a.name.localeCompare(b.name))
}
// 可选项目经理清单（全部状态项目）
export function pmOptions(tasks) {
  const set = new Set()
  tasks.forEach(t => {
    const pm = String(t.projectInfo?.pmName || '').trim()
    if (pm) set.add(pm)
  })
  return [...set].sort((a, b) => a.localeCompare(b, 'zh-CN'))
}

// 年度/月度筛选（全局口径：项目创建日期 projectInfo.createdDate，与 deadline 无关）
export function matchYearMonth(t, year, month) {
  const dateStr = (t.projectInfo && t.projectInfo.createdDate) || ''
  // 未选择具体年度且未选择具体月份时，无创建日期的项目也应显示
  if (year === 'all' && month === 'all') return true
  if (!dateStr) return false
  // 兼容 "2025-03-15" / "2025/3/15" / "2025-03" 等格式
  const parts = String(dateStr).replace(/\//g, '-').split('-')
  const y = parts[0]
  const m = parts[1] ? String(parseInt(parts[1], 10)).padStart(2, '0') : ''
  if (year !== 'all' && y !== year) return false
  if (month !== 'all' && m !== month) return false
  return true
}

// ===== 单项目指标计算（总览页 4 计算列 + 经营分析矩阵共用口径）=====
// 回款率 = 累计收款 / 累计开票（开票为 0 返回 null）
export function collectionRateOf(t) {
  const inv = num(t?.projectInfo?.accInvoice)
  const col = num(t?.projectInfo?.accCollection)
  return inv > 0 ? col / inv : null
}
// 收入完成率 = 列账收入(含税) / 计划收入(含税)（计划收入为 0 返回 null）
export function revDoneRateOf(t) {
  const plan = num(t?.projectInfo?.planRevenueTax)
  const act = num(t?.projectInfo?.ledgerRevenueTax)
  return plan > 0 ? act / plan : null
}
// 成本执行率 = 实际成本 / 计划成本（计划成本为 0 返回 null）
export function costExecRateOf(t) {
  const plan = num(t?.projectInfo?.planCost)
  const act = num(t?.projectInfo?.actualCost)
  return plan > 0 ? act / plan : null
}
// 毛利差(pp) = 实际毛利率 - 计划毛利率（任一为空返回 null）
export function marginGapOf(t) {
  const info = t?.projectInfo || {}
  const p = String(info.planGrossMargin ?? '').trim()
  const a = String(info.actualGrossMargin ?? '').trim()
  if (p === '' || a === '' || isNaN(Number(p)) || isNaN(Number(a))) return null
  return Number(a) - Number(p)
}
// 单项目指标汇总对象（供表格/分析复用）
export function metricsOf(t) {
  return {
    contract: contractAmountOf(t),
    planRev: num(t?.projectInfo?.planRevenueTax),
    ledgerRev: num(t?.projectInfo?.ledgerRevenueTax),
    accInvoice: num(t?.projectInfo?.accInvoice),
    accCollection: num(t?.projectInfo?.accCollection),
    planCost: num(t?.projectInfo?.planCost),
    actualCost: num(t?.projectInfo?.actualCost),
    planRate: String(t?.projectInfo?.planGrossMargin ?? '').trim() === '' ? null : num(t?.projectInfo?.planGrossMargin),
    actualRate: String(t?.projectInfo?.actualGrossMargin ?? '').trim() === '' ? null : num(t?.projectInfo?.actualGrossMargin),
    collectionRate: collectionRateOf(t),
    revDoneRate: revDoneRateOf(t),
    costExecRate: costExecRateOf(t),
    marginGap: marginGapOf(t)
  }
}

// ===== 分组指标矩阵（经营分析页：按维度值分组，输出指标行）=====
// dimKey: 'buildStatus' | 'mainTag' | 'pmName' | 'clientName'
export function groupMetrics(tasks, dimKey) {
  const map = new Map()
  tasks.forEach(t => {
    const raw = String((t.projectInfo && t.projectInfo[dimKey]) || '').trim()
    const label = raw || (dimKey === 'mainTag' ? '一般项目' : '未填写')
    if (!map.has(label)) {
      map.set(label, { label, count: 0, contract: 0, planRev: 0, ledgerRev: 0, accInvoice: 0, accCollection: 0, planCost: 0, actualCost: 0, planRateSum: 0, planRateN: 0, actualRateSum: 0, actualRateN: 0 })
    }
    const g = map.get(label)
    const m = metricsOf(t)
    g.count += 1
    g.contract += m.contract
    g.planRev += m.planRev
    g.ledgerRev += m.ledgerRev
    g.accInvoice += m.accInvoice
    g.accCollection += m.accCollection
    g.planCost += m.planCost
    g.actualCost += m.actualCost
    if (m.planRate !== null) { g.planRateSum += m.planRate; g.planRateN += 1 }
    if (m.actualRate !== null) { g.actualRateSum += m.actualRate; g.actualRateN += 1 }
  })
  const rows = [...map.values()].map(g => ({
    ...g,
    revDoneRate: g.planRev > 0 ? g.ledgerRev / g.planRev : null,
    collectionRate: g.accInvoice > 0 ? g.accCollection / g.accInvoice : null,
    costExecRate: g.planCost > 0 ? g.actualCost / g.planCost : null,
    planRate: g.planRateN ? g.planRateSum / g.planRateN : null,
    actualRate: g.actualRateN ? g.actualRateSum / g.actualRateN : null,
    marginGap: (g.planRateN && g.actualRateN) ? (g.actualRateSum / g.actualRateN) - (g.planRateSum / g.planRateN) : null
  }))
  // 排序：按合同额降序，「未填写/一般项目」靠后
  rows.sort((a, b) => {
    const fallback = l => (l === '未填写' || l === '一般项目') ? 1 : 0
    if (fallback(a.label) !== fallback(b.label)) return fallback(a.label) - fallback(b.label)
    return b.contract - a.contract || b.count - a.count
  })
  return rows
}

// 合计行（矩阵底部）
export function groupMetricsTotal(tasks) {
  const rows = groupMetrics(tasks, 'projectId') // 每项目一组再聚合等于总体
  const g = rows.reduce((acc, r) => ({
    count: acc.count + r.count,
    contract: acc.contract + r.contract,
    planRev: acc.planRev + r.planRev,
    ledgerRev: acc.ledgerRev + r.ledgerRev,
    accInvoice: acc.accInvoice + r.accInvoice,
    accCollection: acc.accCollection + r.accCollection,
    planCost: acc.planCost + r.planCost,
    actualCost: acc.actualCost + r.actualCost,
    planRateSum: acc.planRateSum + r.planRateSum,
    planRateN: acc.planRateN + r.planRateN,
    actualRateSum: acc.actualRateSum + r.actualRateSum,
    actualRateN: acc.actualRateN + r.actualRateN
  }), { count: 0, contract: 0, planRev: 0, ledgerRev: 0, accInvoice: 0, accCollection: 0, planCost: 0, actualCost: 0, planRateSum: 0, planRateN: 0, actualRateSum: 0, actualRateN: 0 })
  return {
    ...g,
    label: '合计',
    revDoneRate: g.planRev > 0 ? g.ledgerRev / g.planRev : null,
    collectionRate: g.accInvoice > 0 ? g.accCollection / g.accInvoice : null,
    costExecRate: g.planCost > 0 ? g.actualCost / g.planCost : null,
    planRate: g.planRateN ? g.planRateSum / g.planRateN : null,
    actualRate: g.actualRateN ? g.actualRateSum / g.actualRateN : null,
    marginGap: (g.planRateN && g.actualRateN) ? (g.actualRateSum / g.actualRateN) - (g.planRateSum / g.planRateN) : null
  }
}

// ===== 排名预警清单（经营分析页）=====
// 回款率最低 TopN（排除开票为 0）
export function worstCollection(tasks, n = 5) {
  return tasks
    .map(t => ({ task: t, rate: collectionRateOf(t) }))
    .filter(r => r.rate !== null)
    .sort((a, b) => a.rate - b.rate)
    .slice(0, n)
}
// 实际毛利率最低 TopN（排除毛利率为空/无收入）
export function worstMargin(tasks, n = 5) {
  return tasks
    .map(t => {
      const info = t.projectInfo || {}
      const rate = String(info.actualGrossMargin ?? '').trim()
      return { task: t, rate: rate === '' || isNaN(Number(rate)) ? null : Number(rate) }
    })
    .filter(r => r.rate !== null)
    .sort((a, b) => a.rate - b.rate)
    .slice(0, n)
}
// 超支项目清单（成本执行率>100%）
export function costOverruns(tasks) {
  return tasks
    .map(t => ({ task: t, rate: costExecRateOf(t) }))
    .filter(r => r.rate !== null && r.rate > 1)
    .sort((a, b) => b.rate - a.rate)
}
// 零收款在建项目（系统状态=在建 且 累计收款=0，按创建日期升序）
export function zeroCollectionOngoing(tasks) {
  return tasks
    .filter(t => t.projectInfo?.buildStatus === '在建' && num(t.projectInfo?.accCollection) === 0)
    .sort((a, b) => String(a.projectInfo?.createdDate || '').localeCompare(String(b.projectInfo?.createdDate || '')))
}

// ===== 风险预警（总览页风险中心）=====
// 是否逾期风险：计划完成时间 < 今天 且 状态=在建
export function planOverdue(t) {
  const pe = t?.projectInfo?.planEndDate
  if (!pe || t?.projectInfo?.buildStatus !== '在建') return false
  const d = new Date(String(pe).replace(/\//g, '-'))
  if (isNaN(d)) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  return d < today
}
// 逾期兜底：无计划日期 + 在建 + 零收款 + 创建超1年
export function staleOngoing(t) {
  const info = t?.projectInfo || {}
  if (info.buildStatus !== '在建') return false
  if (info.planEndDate) return false
  if (num(info.accCollection) !== 0) return false
  const created = String(info.createdDate || '')
  if (!created) return false
  const d = new Date(created)
  if (isNaN(d)) return false
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
  return d < oneYearAgo
}
// 停工预警：当前业务活动含「停工」
export function isHalted(t) {
  return String(t?.projectInfo?.currentActivity || '').includes('停工')
}
// 全部风险清单（供风险中心渲染）
export function riskList(tasks) {
  const list = []
  tasks.forEach(t => {
    const info = t.projectInfo || {}
    if (planOverdue(t)) list.push({ task: t, type: '逾期风险', detail: `计划完成 ${info.planEndDate}，仍在建` })
    else if (staleOngoing(t)) list.push({ task: t, type: '长期停滞', detail: `创建 ${info.createdDate || '—'}，在建且零收款超1年` })
    if (isHalted(t)) list.push({ task: t, type: '停工预警', detail: info.currentActivity })
    if (String(info.isAdvance).trim() === '是') list.push({ task: t, type: '垫资项目', detail: `垫资峰值 ${num(info.advanceBudget) ? fmtWanStatic(num(info.advanceBudget)) + ' 万' : '—'}` })
    if (String(info.cancelFlag).trim() === 'X') list.push({ task: t, type: '注销标识', detail: '系统标注已注销' })
    const ce = costExecRateOf(t)
    if (ce !== null && ce > 1) list.push({ task: t, type: '成本超支', detail: `成本执行率 ${(ce * 100).toFixed(0)}%` })
  })
  return list
}
function fmtWanStatic(v) {
  return (v / 10000).toLocaleString('zh-CN', { maximumFractionDigits: 1 })
}

// 紧迫度排序（剩余天数升序；无日期排后）
export function byUrgency(a, b) {
  const da = a.deadline ? new Date(a.deadline).getTime() : Infinity
  const db = b.deadline ? new Date(b.deadline).getTime() : Infinity
  return da - db
}

// ===== 年度选项（全局口径：项目创建日期）=====
export function yearOptions(tasks) {
  const ys = [...new Set(tasks.map(t => String(t.projectInfo?.createdDate || '').replace(/\//g, '-').slice(0, 4)).filter(y => /^\d{4}$/.test(y)))]
  return ys.sort()
}
