// ========== Log Store（操作日志，上限5000） ==========

import { defineStore } from 'pinia'
import { LOG_KEY } from '../utils/constants'
import { cloudFetch, cloudSave } from '../api/supabase'

export const useLogStore = defineStore('log', {
  state: () => ({
    logs: []
  }),

  actions: {
    getLogs() {
      try {
        const raw = JSON.parse(localStorage.getItem(LOG_KEY) || '[]')
        // 兼容历史 pinia persist 插件的对象格式 {logs: [...]}
        this.logs = Array.isArray(raw) ? raw : (Array.isArray(raw?.logs) ? raw.logs : [])
      } catch (e) {
        this.logs = []
      }
      // 一次性修复：重写回纯数组格式
      localStorage.setItem(LOG_KEY, JSON.stringify(this.logs))
      return this.logs
    },

    async cloudLoadLogs() {
      const data = await cloudFetch('logs')
      if (data !== null && data !== undefined && Array.isArray(data)) {
        this.logs = data
        localStorage.setItem(LOG_KEY, JSON.stringify(data))
      }
    },

    saveLogs() {
      localStorage.setItem(LOG_KEY, JSON.stringify(this.logs))
      cloudSave('logs', this.logs)
    },

    addLog(action, detail, username) {
      this.logs.unshift({
        time: new Date().toISOString(),
        user: username || 'system',
        action,
        detail
      })
      if (this.logs.length > 5000) this.logs.length = 5000
      this.saveLogs()
    },

    clearLogs() {
      this.logs = []
      this.saveLogs()
    }
  },

})
