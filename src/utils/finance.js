// ========== 财务数据汇总工具（从 task.projectInfo 动态计算） ==========
// 单位说明：projectInfo 内金额均为元，视图展示按「万元」换算（/10000）

import { isArchivedTask } from './business'

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

// 有效项目（active，含全部四阶段）
export function activeTasks(tasks) {
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
        name: fullName.length > 6 ? fullName.slice(0, 6) : fullName,
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

// 逾期风险榜（逾期天数降序）
export function overdueRank(tasks) {
  return tasks
    .map(t => {
      const dl = t.deadline ? new Date(t.deadline) : null
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      dl && dl.setHours(0, 0, 0, 0)
      const days = dl ? Math.round((today - dl) / 86400000) : 0
      return { task: t, days }
    })
    .filter(r => r.days > 0)
    .sort((a, b) => b.days - a.days)
}

// 年度/月度筛选（支持 deadline 或 createdDate）
export function matchYearMonth(t, year, month) {
  const dateStr = t.deadline || (t.projectInfo && t.projectInfo.createdDate) || ''
  // 未选择具体年度且未选择具体月份时，无日期项目（如 Excel 导入）也应显示
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

// 紧迫度排序（逾期天数降序置顶 → 剩余天数升序）
export function byUrgency(a, b) {
  const da = a.deadline ? new Date(a.deadline).getTime() : Infinity
  const db = b.deadline ? new Date(b.deadline).getTime() : Infinity
  return da - db
}
