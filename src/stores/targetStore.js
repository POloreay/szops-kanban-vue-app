// ========== Target Store（部门目标：年度/季度/月度 × 四项指标） ==========
// 数据结构：{ '2026': { planRevenue: 100, grossRate: 45, netProfit: 20, budget: 300, quarters: { 'Q1': {...}, 'Q2': {...} }, months: { '01': {...}, ... } } }
// 单位：planRevenue/netProfit/budget 为万元，grossRate 为 %
// 持久化：本地 TARGET_KEY + 云端 settings.targetsData（与 todosData 同机制）

import { defineStore } from 'pinia'
import { cloudFetch, cloudSave, waitForSaveQueue } from '../api/supabase'

const TARGET_KEY = 'szops_targets_v2'
const METRICS = ['planRevenue', 'grossRate', 'netProfit', 'budget']

function emptyMetric() {
  return { planRevenue: '', grossRate: '', netProfit: '', budget: '' }
}

function ensureYear(map, year) {
  if (!map[year]) {
    map[year] = {
      ...emptyMetric(),
      quarters: { Q1: emptyMetric(), Q2: emptyMetric(), Q3: emptyMetric(), Q4: emptyMetric() },
      months: {}
    }
  }
  if (!map[year].quarters) map[year].quarters = { Q1: emptyMetric(), Q2: emptyMetric(), Q3: emptyMetric(), Q4: emptyMetric() }
  if (!map[year].months) map[year].months = {}
  return map[year]
}

export const useTargetStore = defineStore('target', {
  state: () => ({
    targets: {} // { [year]: { ...metrics, quarters, months } }
  }),

  getters: {
    // 取某年度某周期目标：period = { type: 'year'|'quarter'|'month', value: 'Q1'|'01'|null }
    getTarget(state) {
      return (year, periodType, periodValue) => {
        const y = state.targets[String(year)]
        if (!y) return null
        if (periodType === 'year') return y
        if (periodType === 'quarter') return y.quarters?.[periodValue] || null
        if (periodType === 'month') return y.months?.[periodValue] || null
        return null
      }
    }
  },

  actions: {
    loadTargets() {
      try {
        const raw = JSON.parse(localStorage.getItem(TARGET_KEY) || '{}')
        this.targets = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
      } catch (e) {
        this.targets = {}
      }
      localStorage.setItem(TARGET_KEY, JSON.stringify(this.targets))
    },

    async cloudLoadTargets() {
      await waitForSaveQueue('settings')
      const s = await cloudFetch('settings')
      if (s && s.targetsData && typeof s.targetsData === 'object') {
        this.targets = s.targetsData
        localStorage.setItem(TARGET_KEY, JSON.stringify(this.targets))
      }
    },

    saveTargets() {
      localStorage.setItem(TARGET_KEY, JSON.stringify(this.targets))
      // 云端：拉取 settings 后合并写回，避免覆盖其他字段
      cloudFetch('settings').then(s => {
        const merged = { ...(s || {}), targetsData: this.targets }
        cloudSave('settings', merged)
      })
    },

    // 设置目标：type='year'|'quarter'|'month'，value 仅 quarter/month 需要（'Q1'/'01'）
    setTarget(year, type, value, metrics) {
      const y = ensureYear(this.targets, String(year))
      let slot = y
      if (type === 'quarter') slot = ensureYear(this.targets, String(year)).quarters[value]
      if (type === 'month') slot = ensureYear(this.targets, String(year)).months[value]
      METRICS.forEach(k => {
        if (metrics[k] !== undefined) slot[k] = metrics[k]
      })
      this.saveTargets()
    },

    clearTarget(year, type, value) {
      const y = this.targets[String(year)]
      if (!y) return
      if (type === 'year') {
        this.targets[String(year)] = { ...emptyMetric(), quarters: y.quarters, months: y.months }
      } else if (type === 'quarter' && y.quarters?.[value]) {
        y.quarters[value] = emptyMetric()
      } else if (type === 'month' && y.months?.[value]) {
        delete y.months[value]
      }
      this.saveTargets()
    }
  }
})
