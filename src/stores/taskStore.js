// ========== Task Store（任务数据 + CRUD + 云同步） ==========

import { defineStore } from 'pinia'
import { uid, isArchivedTask } from '../utils/business'
import { STORAGE_KEY, IMPL_SUBS_PATH1, IMPL_SUBS_PATH2, STATUS_MAP, PRIORITY_KEYS } from '../utils/constants'
import { cloudFetch, cloudSave } from '../api/supabase'

export const useTaskStore = defineStore('task', {
  state: () => ({
    tasks: [],
    currentDetailId: null,
    sortState: { talk: 'default', bid: 'default', proc: 'default', impl: 'default' },
    // 筛选状态
    filterState: {
      search: '',
      owner: '',
      priority: '',
      deadline: '',
      status: '',
      archive: 'active' // active | archived | all
    },
    cloudSyncing: false
  }),

  getters: {
    // 筛选后的任务（逻辑文档第八章）
    filteredTasks(state) {
      let r = [...state.tasks]
      const s = state.filterState.search.trim().toLowerCase()
      const o = state.filterState.owner
      const p = state.filterState.priority
      const dl = state.filterState.deadline
      const st = state.filterState.status
      const af = state.filterState.archive

      if (s) r = r.filter(t => t.title.toLowerCase().includes(s)
        || ((t.projectInfo && t.projectInfo.projectName) || '').toLowerCase().includes(s)
        || (t.desc || '').toLowerCase().includes(s))
      if (o) r = r.filter(t => t.owner === o)
      if (p) r = r.filter(t => t.priority === p)
      if (dl) r = r.filter(t => t.deadline === dl)
      if (st) r = r.filter(t => t.status === st)
      if (af === 'active') r = r.filter(t => !isArchivedTask(t))
      else if (af === 'archived') r = r.filter(t => isArchivedTask(t))

      r.sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
      return r
    },

    // 全部创建人列表
    owners(state) {
      return [...new Set(state.tasks.map(t => t.owner).filter(Boolean))]
    },

    // 当前详情任务
    currentTask(state) {
      return state.tasks.find(t => t.id === state.currentDetailId) || null
    }
  },

  actions: {
    // 本地加载（含子状态迁移）
    loadTasks() {
      try {
        const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
        // 兼容历史 pinia persist 插件的对象格式（含双重嵌套 {tasks:{tasks:[...]}}）
        this.tasks = Array.isArray(raw) ? raw : (Array.isArray(raw?.tasks) ? raw.tasks : (Array.isArray(raw?.tasks?.tasks) ? raw.tasks.tasks : []))
      } catch (e) {
        this.tasks = []
      }
      // 一次性修复：把 localStorage 重写回纯数组格式
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.tasks))
      this._migrateSubStatus()
    },

    // 云端加载
    async cloudLoadTasks() {
      const data = await cloudFetch('tasks')
      if (data !== null && data !== undefined) {
        this.tasks = data
        this._migrateSubStatus()
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.tasks))
      }
    },

    // 保存到本地+云端
    saveTasks() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.tasks))
      cloudSave('tasks', this.tasks)
    },

    // 子状态迁移：'已中标，流程中' → '成功中标'
    _migrateSubStatus() {
      let migrated = false
      this.tasks.forEach(t => {
        if (t.subStatus === '已中标，流程中') {
          t.subStatus = '成功中标'
          migrated = true
        }
      })
      if (migrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(this.tasks))
    },

    // 新建任务
    addTask(data) {
      const task = {
        id: uid(),
        title: data.title,
        desc: data.desc || '',
        owner: data.owner,
        contact: data.contact || '',
        priority: data.priority || 'medium',
        deadline: data.deadline,
        status: data.status || 'talk',
        subStatus: data.subStatus || '',
        implSub1: data.implSub1 || '',
        implSub2: data.implSub2 || '',
        needDecision: data.needDecision || false,
        projectInfo: {},
        milestones: [],
        collections: [],
        agencyFee: '',
        projectAmt: '',
        createdAt: new Date().toISOString()
      }
      this.tasks.push(task)
      this.saveTasks()
      return task
    },

    // 更新任务
    updateTask(id, patch) {
      const t = this.tasks.find(x => x.id === id)
      if (t) {
        Object.assign(t, patch)
        this.saveTasks()
      }
      return t
    },

    // 删除任务
    deleteTask(id) {
      this.tasks = this.tasks.filter(x => x.id !== id)
      this.saveTasks()
    },

    // 拖拽换列
    moveTask(id, newStatus) {
      const t = this.tasks.find(x => x.id === id)
      if (t && t.status !== newStatus) {
        const oldStatus = t.status
        t.status = newStatus
        // 子状态重置（逻辑文档第8.5节）
        if (newStatus === 'impl') {
          t.implSub1 = t.implSub1 || IMPL_SUBS_PATH1[0]
          t.implSub2 = t.implSub2 || IMPL_SUBS_PATH2[0]
          t.subStatus = t.implSub1
        } else {
          const subs = STATUS_MAP[newStatus]?.subs || []
          t.subStatus = subs[0] || ''
          t.implSub1 = ''
          t.implSub2 = ''
        }
        this.saveTasks()
        return { task: t, oldStatus }
      }
      return null
    },

    // Excel 批量导入（中文口径 → task 字段映射；rows 来自导入预览，已含勾选与阶段确认）
    importTasks(rows) {
      const imported = []
      rows.forEach(r => {
        const stage = r.stage || 'talk'
        const statusKey = stage
        const priorityRaw = String(r.priority || '').trim()
        const priorityKey = PRIORITY_KEYS[priorityRaw] || 'medium'
        const contractAmount = r.contractAmount == null || String(r.contractAmount).trim() === '' ? '' : Number(String(r.contractAmount).replace(/[,\s]/g, ''))
        const task = {
          id: uid(),
          title: String(r.title ?? '').trim(),
          desc: String(r.desc ?? '').trim(),
          owner: String(r.owner ?? '').trim(),
          contact: String(r.contact ?? '').trim(),
          priority: priorityKey,
          deadline: this._normDate(r.deadline),
          status: statusKey,
          subStatus: String(r.subStatus ?? '').trim(),
          implSub1: statusKey === 'impl' ? (String(r.subStatus ?? '').trim() || IMPL_SUBS_PATH1[0]) : '',
          implSub2: statusKey === 'impl' ? IMPL_SUBS_PATH2[0] : '',
          needDecision: String(r.needDecision ?? '').trim() === '是',
          projectInfo: Object.assign(
            { contractAmount: contractAmount === '' || isNaN(contractAmount) ? '' : contractAmount },
            r.xlsInfo || {}
          ),
          milestones: [],
          collections: [],
          agencyFee: r.agencyFee === '' || r.agencyFee == null || isNaN(Number(r.agencyFee)) ? '' : Number(r.agencyFee),
          projectAmt: '',
          // 创建日期：优先取 Excel「创建日期」字段，无则用当前时间
          createdAt: (r.xlsInfo && r.xlsInfo.createdDate) ? this._normDate(r.xlsInfo.createdDate) : new Date().toISOString()
        }
        imported.push(task)
      })
      this.tasks.push(...imported)
      this.saveTasks()
      return imported.length
    },

    // 日期规范化：Excel 数字序列号 / Date 对象 / 字符串 → YYYY-MM-DD
    _normDate(v) {
      if (v == null || v === '') return ''
      if (v instanceof Date && !isNaN(v)) {
        const y = v.getFullYear()
        const m = String(v.getMonth() + 1).padStart(2, '0')
        const d = String(v.getDate()).padStart(2, '0')
        return `${y}-${m}-${d}`
      }
      const s = String(v).trim()
      // 纯数字：Excel 日期序列号（1900 体系）
      if (/^\d{5}$/.test(s) || (/^\d+\.?\d*$/.test(s) && Number(s) > 20000 && Number(s) < 80000)) {
        const serial = Math.floor(Number(s))
        // Excel 序列号 → 日期（1900-01-01 = 1，含 1900 闰年 bug 偏移）
        const ms = (serial - 25569) * 86400000
        const dt = new Date(ms)
        if (!isNaN(dt)) {
          const y = dt.getUTCFullYear()
          const m = String(dt.getUTCMonth() + 1).padStart(2, '0')
          const d = String(dt.getUTCDate()).padStart(2, '0')
          return `${y}-${m}-${d}`
        }
      }
      // 已是 YYYY-MM-DD 或其他格式，尝试 Date 解析
      const dt = new Date(s)
      if (!isNaN(dt) && /\d{4}/.test(s)) {
        const y = dt.getFullYear()
        const m = String(dt.getMonth() + 1).padStart(2, '0')
        const d = String(dt.getDate()).padStart(2, '0')
        return `${y}-${m}-${d}`
      }
      return s
    },

    // 清空筛选
    clearFilters() {
      this.filterState = {
        search: '', owner: '', priority: '', deadline: '', status: '', archive: 'active'
      }
    },

    // 设置筛选
    setFilter(key, value) {
      this.filterState[key] = value
    }
  },

  // localStorage 持久化：改用手动保存（saveTasks），避免与 persist 插件双写同一 key 造成格式冲突
})
