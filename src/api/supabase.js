// ========== Supabase 云端 API 封装（照搬逻辑文档第六章） ==========

import { SUPABASE_URL, SUPABASE_KEY } from '../utils/constants'

let _cloudSyncing = false // 防递归

// 拉取单字段
export async function cloudFetch(field) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/kanban_data?id=eq.1&select=${field}`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
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
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
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
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
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
