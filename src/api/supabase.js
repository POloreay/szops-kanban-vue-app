// ========== Supabase 云端 API 封装 + Auth 登录 ==========
// 安全架构（2026-09 加固）：
// - 登录走 Supabase Auth（/auth/v1/token?grant_type=password），拿到 JWT access_token
// - 业务数据请求携带 JWT，Supabase 按 token 的 role（authenticated）+ RLS 鉴权
// - anon key 仅作为 apikey（公开标识，非机密），不再携带数据访问能力
// - 明文密码仅存在 Supabase Auth（服务端哈希），users JSONB 中不再保存密码

import { SUPABASE_URL, SUPABASE_KEY } from '../utils/constants'

let _cloudSyncing = false // 防递归（仅保留给 cloudSaveAll 兼容判断，见下）

// ========== 云端写入串行队列 ==========
// 背景：cloudSave 原用布尔锁防递归，并发调用时后到的请求会被直接丢弃（return false），
// 导致批量删除时部分变更未持久化到云端，随后被 60s 轮询拉回旧数据覆盖本地。
// 改造：同一字段（field）的写入进入串行队列，后者携带最新值覆盖前者；
// 不同字段互不阻塞（tasks/logs 等各自独立队列）。
const _saveQueues = new Map() // field -> Promise 链尾

function enqueueSave(field, value) {
  const prev = _saveQueues.get(field) || Promise.resolve()
  const run = prev.then(async () => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/kanban_data?id=eq.1`, {
      method: 'PATCH',
      headers: authHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
      body: JSON.stringify({ [field]: value, updated_at: new Date().toISOString() })
    })
    if (!res.ok) {
      console.warn(`cloudSave(${field}) failed:`, res.status)
      return false
    }
    return true
  }).catch(e => {
    console.warn(`cloudSave(${field}) error:`, e)
    return false
  })
  // 无论成败，链尾继续接收后续写入；链异常不应阻断后续保存
  _saveQueues.set(field, run.catch(() => {}))
  return run
}

// ========== Auth 会话管理 ==========
const AUTH_SESSION_KEY = 'szops_auth_session'
let _accessToken = null

export function getAccessToken() {
  if (_accessToken) return _accessToken
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY)
    if (raw) {
      const sess = JSON.parse(raw)
      const exp = sess.expires_at || 0
      // 兼容秒级/毫秒级时间戳
      const expMs = exp < 1e12 ? exp * 1000 : exp
      if (sess.access_token && Date.now() < expMs) {
        _accessToken = sess.access_token
        return _accessToken
      }
    }
  } catch (e) {}
  return null
}

export function saveAuthSession(session) {
  _accessToken = session.access_token
  // Supabase 的 expires_at 是秒级时间戳，需转毫秒再存，否则刷新后会被误判过期
  const expiresAtMs = session.expires_at
    ? session.expires_at * 1000
    : Date.now() + (session.expires_in || 3600) * 1000
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: expiresAtMs
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

// 密码登录（password grant），15 秒超时，网络错误与认证错误分开抛
export async function authLogin(username, password) {
  const email = toEmail(username)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)
  let res
  try {
    res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: controller.signal
    })
  } catch (e) {
    clearTimeout(timer)
    const err = new Error(e.name === 'AbortError' ? '登录请求超时（15秒无响应），请检查网络' : '无法连接认证服务器，请检查网络')
    err.networkError = true
    throw err
  }
  clearTimeout(timer)
  if (!res.ok) {
    const body = {}
    try { Object.assign(body, await res.json()) } catch (e) {}
    // 常见 Auth 错误码/文案翻译成中文，其余原样透出
    const raw = body.msg || body.error_description || body.error || ''
    const zhMap = {
      'Invalid login credentials': '用户名或密码错误',
      'invalid_credentials': '用户名或密码错误',
      'Email not confirmed': '邮箱未确认，请联系管理员',
      'User already registered': '该用户已存在',
      'Password should be at least 6 characters': '密码至少需要 6 位字符',
      'Signups not allowed for this instance': '该系统不允许自助注册'
    }
    const msg = zhMap[raw] || raw || '用户名或密码错误'
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

// 写入单字段（串行队列化：同字段并发时排队依次执行，不再丢弃）
export async function cloudSave(field, value) {
  return enqueueSave(field, value)
}

// 供 60s 轮询读取前调用：等待该字段队列中的待写请求全部落库，避免「写未完成→读回旧值」
export async function waitForSaveQueue(field) {
  const tail = _saveQueues.get(field)
  if (tail) await tail
}

// 批量写入四字段（保留原布尔锁，调用点极少且为一次性全量写入）
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
