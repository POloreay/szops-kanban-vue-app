// ========== 业务工具函数（照搬逻辑文档） ==========

import { ARCHIVE_SUBS, WARN_DAYS } from './constants'

// 唯一ID
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5)
}

// HTML 转义
export function esc(s) {
  const d = document.createElement('div')
  d.textContent = s || ''
  return d.innerHTML
}

// 金额格式化（千分位2位小数）
export function fmtMoney(v) {
  if (v === '' || v === undefined || v === null) return ''
  const n = Number(v)
  return isNaN(n) ? v : n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// 截止日期天数差（双方清零时分秒）
export function getDaysLeft(dl) {
  const t = new Date()
  t.setHours(0, 0, 0, 0)
  const d = new Date(dl)
  d.setHours(0, 0, 0, 0)
  return Math.round((d - t) / 86400000)
}

// 是否逾期
export function isOverdue(t) {
  return getDaysLeft(t.deadline) < 0
}

// 是否预警（截止前3天内）
export function isWarn(t) {
  const d = getDaysLeft(t.deadline)
  return d >= 0 && d <= WARN_DAYS
}

// 日期格式化：M月D日 [HH:mm]
export function fmtDate(s) {
  if (!s) return ''
  const d = new Date(s)
  const base = `${d.getMonth() + 1}月${d.getDate()}日`
  if (s.includes('T') && s.length > 10) {
    const h = String(d.getHours()).padStart(2, '0')
    const m = String(d.getMinutes()).padStart(2, '0')
    return base + ` ${h}:${m}`
  }
  return base
}

// 是否归档任务（impl 永不归档）
export function isArchivedTask(t) {
  if (t.status === 'impl') return false
  return ARCHIVE_SUBS.includes(t.subStatus)
}
