// ========== User Store（用户管理 + 登录守卫） ==========

import { defineStore } from 'pinia'
import { USER_KEY, SESSION_KEY } from '../utils/constants'
import { cloudFetch, cloudSave } from '../api/supabase'

export const useUserStore = defineStore('user', {
  state: () => ({
    users: [],
    currentUser: null,
    _pendingAction: null
  }),

  getters: {
    isLoggedIn(state) {
      return state.currentUser !== null
    },
    isAdmin(state) {
      return state.currentUser?.role === 'admin'
    }
  },

  actions: {
    // 获取用户列表（确保 admin 存在）
    getUsers() {
      let u = []
      try {
        const raw = JSON.parse(localStorage.getItem(USER_KEY) || '[]')
        // 兼容 pinia persist 插件的对象格式 {users: [...]} 与旧版数组格式 [...]
        u = Array.isArray(raw) ? raw : (Array.isArray(raw?.users) ? raw.users : [])
      } catch (e) {
        u = []
      }
      if (!Array.isArray(u) || !u.find(x => x.role === 'admin')) {
        u = [{ username: 'liquanadmin', password: 'SSLZschh11!!', role: 'admin', createdAt: new Date().toISOString() }, ...(Array.isArray(u) ? u : [])]
        localStorage.setItem(USER_KEY, JSON.stringify(u))
      }
      this.users = u
      return u
    },

    async cloudLoadUsers() {
      const data = await cloudFetch('users')
      if (data !== null && data !== undefined && Array.isArray(data) && data.length > 0) {
        this.users = data
        localStorage.setItem(USER_KEY, JSON.stringify(data))
      } else {
        const users = this.getUsers()
        if (users.length > 0) cloudSave('users', users)
      }
    },

    saveUsers() {
      localStorage.setItem(USER_KEY, JSON.stringify(this.users))
      cloudSave('users', this.users)
    },

    // 登录
    login(username, password) {
      const user = this.users.find(u => u.username === username && u.password === password)
      if (!user) return false
      this.currentUser = user
      localStorage.setItem(SESSION_KEY, JSON.stringify({ username: user.username }))
      return true
    },

    // 退出
    logout() {
      this.currentUser = null
      localStorage.removeItem(SESSION_KEY)
    },

    // 从 session 恢复登录态
    restoreSession() {
      const sess = localStorage.getItem(SESSION_KEY)
      if (sess) {
        try {
          const s = JSON.parse(sess)
          const users = this.getUsers()
          const u = users.find(x => x.username === s.username)
          if (u) {
            this.currentUser = u
            return true
          }
        } catch (e) {}
      }
      this.getUsers() // 确保 admin 存在
      return false
    },

    // 登录守卫（返回 true=已登录，false=弹登录框）
    requireLogin(actionFn) {
      if (this.currentUser) {
        if (actionFn) actionFn()
        return true
      }
      this._pendingAction = actionFn || null
      return false
    },

    // 恢复挂起操作
    resumePending() {
      if (this._pendingAction) {
        const fn = this._pendingAction
        this._pendingAction = null
        fn()
      }
    },

    // 用户管理
    addUser(username, password, role) {
      if (this.users.find(u => u.username === username)) return false
      this.users.push({ username, password, role, createdAt: new Date().toISOString() })
      this.saveUsers()
      return true
    },

    editUserPass(idx, newPass) {
      if (this.users[idx]) {
        this.users[idx].password = newPass
        this.saveUsers()
        if (this.currentUser?.username === this.users[idx].username) {
          this.currentUser.password = newPass
        }
      }
    },

    deleteUser(idx) {
      if (this.users[idx]?.role === 'admin') return false
      this.users.splice(idx, 1)
      this.saveUsers()
      return true
    }
  },

  // localStorage 持久化：改用手动保存（saveUsers），避免与 persist 插件双写同一 key 造成格式冲突
})
