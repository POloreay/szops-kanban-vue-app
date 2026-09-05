// ========== Settings Store（Header 个性化 + todosData 中转） ==========

import { defineStore } from 'pinia'
import { SETTINGS_KEY } from '../utils/constants'
import { cloudFetch, cloudSave } from '../api/supabase'

const DEFAULT_SETTINGS = {
  bgType: 'color',
  bgColor: '#1e293b',
  bgImg: '',
  bgImgSize: 100,
  bgImgPosX: 0,
  bgImgPosY: 0,
  title: '数智运营事业部项目看板',
  icon: '📊',
  todosData: [],
  targetsData: {}
}

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    settings: { ...DEFAULT_SETTINGS },
    tempSettings: null
  }),

  actions: {
    loadSettings() {
      try {
        let s = JSON.parse(localStorage.getItem(SETTINGS_KEY))
        // 兼容历史 pinia persist 插件的对象格式 {settings: {...}}
        if (s && !Array.isArray(s) && s.settings && typeof s.settings === 'object') s = s.settings
        if (s) this.settings = { ...DEFAULT_SETTINGS, ...s }
      } catch (e) {}
      // 一次性修复：重写回纯 settings 对象格式（排除 tempSettings）
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings))
    },

    async cloudLoadSettings() {
      const data = await cloudFetch('settings')
      if (data !== null && data !== undefined && Object.keys(data).length > 0) {
        this.settings = { ...DEFAULT_SETTINGS, ...data }
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings))
      }
    },

    // 持久化设置 + 同步 todosData + 写云端
    persistSettings(todosData) {
      if (todosData) this.settings.todosData = todosData
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings))
      cloudSave('settings', this.settings)
    },

    // 保存设置
    saveSettings(todosData) {
      this.settings = { ...this.tempSettings }
      this.persistSettings(todosData)
    },

    // 恢复默认
    resetSettings() {
      this.settings = { ...DEFAULT_SETTINGS }
      this.tempSettings = { ...DEFAULT_SETTINGS }
      this.persistSettings()
    }
  },

})
