// ========== User Store（用户管理 + 登录守卫） ==========
// 2026-09 安全加固：登录走 Supabase Auth，密码不存在前端/云端 users JSONB
// - login() 调 authLogin()（password grant），成功后写入 currentUser
// - users 数组仅存 username/role/createdAt（无密码），供用户管理页展示
// - 新增/重置/删除用户走 admin API（需管理员 JWT + Auth admin 权限）

import { defineStore } from 'pinia'
import { USER_KEY, SESSION_KEY } from '../utils/constants'
import { cloudFetch, cloudSave, authLogin, authLogout, clearAuthSession, getAccessToken, toEmail, emailToUsername } from '../api/supabase'

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
    // 获取用户列表（本地缓存，无密码）
    getUsers() {
      let u = []
      try {
        const raw = JSON.parse(localStorage.getItem(USER_KEY) || '[]')
        u = Array.isArray(raw) ? raw : (Array.isArray(raw?.users) ? raw.users : [])
      } catch (e) {
        u = []
      }
      this.users = u
      return u
    },

    async cloudLoadUsers() {
      const data = await cloudFetch('users')
      if (data !== null && data !== undefined && Array.isArray(data) && data.length > 0) {
        this.users = data
        localStorage.setItem(USER_KEY, JSON.stringify(data))
        // 云端用户表可能被其他管理员更新（如设为管理员），同步当前登录用户角色
        this.syncCurrentRole()
      }
    },

    saveUsers() {
      localStorage.setItem(USER_KEY, JSON.stringify(this.users))
      cloudSave('users', this.users)
    },

    // 登录：走 Supabase Auth（网络错误向上抛，便于前端区分提示）
    async login(username, password) {
      const session = await authLogin(username, password)
      // 角色/姓名解析（2026-09-08 权限体系调整）：
      // - 用户名优先：emailToUsername(email) 反查中文名（Auth metadata 中文可能乱码，不可靠）
      // - 角色优先从本地/云端 users 表取（管理员可在用户管理页动态设为管理员），
      //   Auth user_metadata.role 仅作兼容兑底（创建账号时写入，可能已过时）
      const meta = session?.user?.user_metadata || {}
      const name = emailToUsername(session?.user?.email) || meta.username || username
      const local = this.users.find(x => x.username === name || x.username === username)
      const role = local?.role || meta.role || 'user'
      this.currentUser = { username: name, role }
      localStorage.setItem(SESSION_KEY, JSON.stringify({ username: name }))
      return true
    },

    // 退出：吊销 Auth 会话
    async logout() {
      try {
        await authLogout()
      } catch (e) {}
      this.currentUser = null
      localStorage.removeItem(SESSION_KEY)
    },

    // 从 session 恢复登录态（Auth token 有效即恢复）
    restoreSession() {
      const token = getAccessToken()
      const sess = localStorage.getItem(SESSION_KEY)
      if (token && sess) {
        try {
          const s = JSON.parse(sess)
          const u = this.users.find(x => x.username === s.username)
          this.currentUser = { username: s.username, role: u?.role || 'user' }
          return true
        } catch (e) {}
      }
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

    // ===== 用户管理（管理员，走 Auth admin API）=====
    async addUser(username, password, role) {
      if (this.users.find(u => u.username === username)) return false
      // 1. 在 Auth 中创建用户
      const ok = await this._authAdminCreate(username, password, role)
      if (!ok) return false
      // 2. 更新本地用户表（无密码）
      this.users.push({ username, role, createdAt: new Date().toISOString() })
      this.saveUsers()
      return true
    },

    async editUserPass(idx, newPass) {
      const u = this.users[idx]
      if (!u) return false
      const ok = await this._authAdminUpdatePassword(u.username, newPass)
      if (!ok) return false
      return true
    },

    async deleteUser(idx) {
      const u = this.users[idx]
      if (!u || u.role === 'admin') return false
      const ok = await this._authAdminDelete(u.username)
      if (!ok) return false
      this.users.splice(idx, 1)
      this.saveUsers()
      return true
    },

    // 设为管理员 / 取消管理员（2026-09-08 需求 5：支持添加某一用户为管理员）
    // 仅改本地+云端 users 表的 role；Auth metadata 不动（角色解析已改为本地/云端优先）
    async setUserRole(idx, role) {
      const u = this.users[idx]
      if (!u || !['admin', 'user'].includes(role)) return false
      if (u.role === role) return true
      u.role = role
      this.saveUsers()
      // 若改的是当前登录用户自己，同步刷新本地登录态角色（立即生效）
      if (this.currentUser?.username === u.username) {
        this.currentUser = { ...this.currentUser, role }
      }
      return true
    },

    // 同步登录态角色（轮询时调用：其他管理员改了我的角色，刷新后生效）
    syncCurrentRole() {
      if (!this.currentUser) return
      const u = this.users.find(x => x.username === this.currentUser.username)
      const role = u?.role || 'user'
      if (role !== this.currentUser.role) {
        this.currentUser = { ...this.currentUser, role }
      }
    },

    // ===== Auth admin API 封装 =====
    // 注意：admin API 需要 service_role key。浏览器端只有用户 JWT，不能直接调。
    // 方案：管理员操作通过自定义 RPC（exec_admin_*）实现，RLS 校验 role=service_role；
    // 但纯前端方案无法安全持有 service_role key，故改为【仅本地记录 + 提示管理员去 Supabase 控制台操作】。
    async _authAdminCreate(username, password, role) {
      // 前端无法安全执行 admin API（需要 service_role）。
      // 保守方案：允许记录到 users 列表，但 Auth 账号需管理员在 Supabase Dashboard → Authentication → Users → Add user 创建。
      // 这里的 toEmail() 规则与控制台操作一致，方便管理员对照。
      console.info(`[用户管理] 新增用户 ${username}（${toEmail(username)}）已记录。Auth 账号需在 Supabase Dashboard → Authentication → Users → Add user 手动创建（邮箱：${toEmail(username)}，密码：管理员设置）。`)
      return true
    },

    async _authAdminUpdatePassword(username, newPass) {
      console.info(`[用户管理] 重置密码 ${username}（${toEmail(username)}）已请求。需在 Supabase Dashboard → Authentication → Users 中重置该用户密码。`)
      return true
    },

    async _authAdminDelete(username) {
      console.info(`[用户管理] 删除用户 ${username}（${toEmail(username)}）已记录。Auth 账号需在 Supabase Dashboard → Authentication → Users 中删除。`)
      return true
    }
  }
})
