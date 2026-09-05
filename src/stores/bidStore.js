// ========== Bid Store（投标管理独立数据域：商机跟踪/报名准备/投标准备/准备开标/归档任务） ==========
// 与项目管理数据（taskStore）完全独立；中标后可在项目管理另行新建项目
// 持久化：本地 BID_STORAGE_KEY + 云端 settings.bidsData（与 todosData/targetsData 同机制）

import { defineStore } from 'pinia'
import { uid } from '../utils/business'
import { BID_STORAGE_KEY, BID_STAGES } from '../utils/constants'
import { cloudFetch, cloudSave } from '../api/supabase'

export const useBidStore = defineStore('bid', {
  state: () => ({
    bids: [],
    cloudSyncing: false
  }),

  getters: {
    // 按环节取列表（archive 列包含所有归档子状态）
    byStage(state) {
      return (stage) => state.bids.filter(b => (b.stage || 'lead') === stage)
    },
    owners(state) {
      return [...new Set(state.bids.map(b => b.owner).filter(Boolean))]
    }
  },

  actions: {
    loadBids() {
      try {
        const raw = JSON.parse(localStorage.getItem(BID_STORAGE_KEY) || '[]')
        this.bids = Array.isArray(raw) ? raw : []
      } catch (e) {
        this.bids = []
      }
      localStorage.setItem(BID_STORAGE_KEY, JSON.stringify(this.bids))
    },

    async cloudLoadBids() {
      const s = await cloudFetch('settings')
      if (s && Array.isArray(s.bidsData)) {
        this.bids = s.bidsData
        localStorage.setItem(BID_STORAGE_KEY, JSON.stringify(this.bids))
      }
    },

    saveBids() {
      localStorage.setItem(BID_STORAGE_KEY, JSON.stringify(this.bids))
      // 云端：拉取 settings 后合并写回，避免覆盖其他字段（todosData/targetsData 同机制）
      cloudFetch('settings').then(s => {
        const merged = { ...(s || {}), bidsData: this.bids }
        cloudSave('settings', merged)
      })
    },

    // 新建投标记录（字段延续项目管理表单口径）
    addBid(data) {
      const stage = data.stage || 'lead'
      const bid = {
        id: uid(),
        title: data.title || '',
        desc: data.desc || '',
        owner: data.owner || '',
        contact: data.contact || '',
        priority: data.priority || 'medium',
        deadline: data.deadline || '',
        stage,
        subStatus: data.subStatus || (BID_STAGES[stage]?.subs[0] || ''),
        agencyFee: data.agencyFee || '',
        createdAt: new Date().toISOString()
      }
      this.bids.push(bid)
      this.saveBids()
      return bid
    },

    updateBid(id, patch) {
      const b = this.bids.find(x => x.id === id)
      if (b) {
        Object.assign(b, patch)
        this.saveBids()
      }
      return b
    },

    deleteBid(id) {
      this.bids = this.bids.filter(x => x.id !== id)
      this.saveBids()
    },

    // 环节流转：进入下一环节，子状态重置为该环节首个子状态
    moveBid(id, newStage, subStatus) {
      const b = this.bids.find(x => x.id === id)
      if (b && b.stage !== newStage) {
        b.stage = newStage
        b.subStatus = subStatus || (BID_STAGES[newStage]?.subs[0] || '')
        this.saveBids()
        return b
      }
      return null
    },

    // 放弃投标 / 落标：直接归档
    archiveBid(id, subStatus) {
      return this.moveBid(id, 'archive', subStatus || '放弃归档')
    }
  }
})
