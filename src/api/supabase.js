// ========== Supabase 云端 API 封装 + Auth 登录 ==========
// 安全架构（2026-09 加固）：
// - 登录走 Supabase Auth（/auth/v1/token?grant_type=password），拿到 JWT access_token
// - 业务数据请求携带 JWT，Supabase 按 token 的 role（authenticated）+ RLS 鉴权
// - anon key 仅作为 apikey（公开标识，非机密），不再携带数据访问能力
// - 明文密码仅存在 Supabase Auth（服务端哈希），users JSONB 中不再保存密码

import { SUPABASE_URL, SUPABASE_KEY } from '../utils/constants'

let _cloudSyncing = false // 防递归

// ========== Auth 会话管理 ==========
const AUTH_SESSION_KEY = 'szops_auth_session'
let _accessToken = null

export function getAccessToken() {
  if (_accessToken) return _accessToken
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY)
    if (raw) {
      const sess = JSON.parse(raw)
      if (sess.access_token && Date.now() < (sess.expires_at || 0)) {
        _accessToken = sess.access_token
        return _accessToken
      }
    }
  } catch (e) {}
  return null
}

export function saveAuthSession(session) {
  _accessToken = session.access_token
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at || (Date.now() + (session.expires_in || 3600) * 1000)
  }))
}

export function clearAuthSession() {
  _accessToken = null
  localStorage.removeItem(AUTH_SESSION_KEY)
}

// 构造带 JWT 的请求头（未登录时仅带 apikey，配合 RLS 将被拒绝）
function authHeaders(extra = {}) {
  const token = getAccessToken()
  return {
    apikey: SUPABASE_KEY,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra
  }
}

// 密码登录（password grant）
export async function authLogin(username, password) {
  const email = toEmail(username)
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
  if (!res.ok) {
    const body = {}
    try { Object.assign(body, await res.json()) } catch (e) {}
    const msg = body.msg || body.error_description || body.error || '用户名或密码错误'
    throw new Error(msg)
  }
  const session = await res.json()
  saveAuthSession(session)
  return session
}

// 退出（吊销 refresh token；需带 access_token 调用）
export async function authLogout() {
  const sess = (() => { try { return JSON.parse(localStorage.getItem(AUTH_SESSION_KEY) || 'null') } catch (e) { return null } })()
  const at = sess?.access_token
  const rt = sess?.refresh_token
  clearAuthSession()
  if (!at || !rt) return
  try {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json', Authorization: `Bearer ${at}` },
      body: JSON.stringify({ refresh_token: rt })
    })
  } catch (e) {}
}

// 用户名转 Auth 邮箱（建用户时同规则）
export function toEmail(username) {
  const map = {
    'liquanadmin': 'liquanadmin@szops.local',
    '张永宁': 'zhangyongning@szops.local',
    '张彦飞': 'zhangyanfei@szops.local',
    '刘添宇': 'liutianyu@szops.local',
    '王渊文': 'wangyuanwen@szops.local',
    '陈琳': 'chenlin@szops.local',
    '颉严东': 'xieyandong@szops.local',
    '李泉': 'liquan@szops.local'
  }
  return map[username] || `${encodeURIComponent(username)}@szops.local`
}

// 反查：邮箱后缀映射回中文用户名（用于登录后展示 currentUser）
export function emailToUsername(email) {
  const map = {
    'liquanadmin@szops.local': 'liquanadmin',
    'zhangyongning@szops.local': '张永宁',
    'zhangyanfei@szops.local': '张彦飞',
    'liutianyu@szops.local': '刘添宇',
    'wangyuanwen@szops.local': '王渊文',
    'chenlin@szops.local': '陈琳',
    'xieyandong@szops.local': '颉严东',
    'liquan@szops.local': '李泉'
  }
  return map[email] || email.split('@')[0]
}

// ========== 业务数据读写（携带 JWT）==========
// 拉取单字段
export async function cloudFetch(field) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/kanban_data?id=eq.1&select=${field}`,
      { headers: authHeaders() }
    )
    if (!res.ok) return null
    const data = await res.json()
    return data && data[0] ? data[0][field] : null
  } catch (e) {
    console.warn('cloudFetch error:', e)
    return null
  }
}

// 写入单字段
export async function cloudSave(field, value) {
  if (_cloudSyncing) return false
  _cloudSyncing = true
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/kanban_data?id=eq.1`, {
      method: 'PATCH',
      headers: authHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
      body: JSON.stringify({ [field]: value, updated_at: new Date().toISOString() })
    })
    return res.ok
  } catch (e) {
    console.warn('cloudSave error:', e)
    return false
  } finally {
    _cloudSyncing = false
  }
}

// 批量写入四字段
export async function cloudSaveAll(tasksVal, settingsVal, usersVal, logsVal) {
  if (_cloudSyncing) return false
  _cloudSyncing = true
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/kanban_data?id=eq.1`, {
      method: 'PATCH',
      headers: authHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
      body: JSON.stringify({
        tasks: tasksVal,
        settings: settingsVal,
        users: usersVal,
        logs: logsVal,
        updated_at: new Date().toISOString()
      })
    })
    return res.ok
  } catch (e) {
    console.warn('cloudSaveAll error:', e)
    return false
  } finally {
    _cloudSyncing = false
  }
}
