<template>
  <div class="user-view">
    <!-- 权限拦截：非管理员 -->
    <div v-if="!userStore.isAdmin" class="panel empty-guide">
      <h3>无访问权限</h3>
      <p>用户管理仅管理员可见。当前账号角色为{{ userStore.currentUser ? '普通用户' : '未登录' }}，如需管理用户请联系管理员。</p>
    </div>

    <template v-else>
      <!-- 顶部操作条 -->
      <div class="panel manage-panel">
        <div class="panel-header">
          <div>
            <h3 class="panel-title">用户管理</h3>
            <div class="panel-subtitle">共 {{ users.length }} 个账号 · 管理员可新增账号、重置密码、删除普通用户</div>
          </div>
          <div class="actions">
            <button class="btn-uni" @click="openAdd">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
              新增用户
            </button>
          </div>
        </div>

        <table class="ds-table">
          <thead>
            <tr><th>用户名</th><th>角色</th><th>创建时间</th><th>操作</th></tr>
          </thead>
          <tbody>
            <tr v-for="(u, i) in users" :key="u.username">
              <td class="cell-title">
                <span class="user-cell">
                  <span class="avatar-mini" :class="u.role === 'admin' ? 'admin' : ''">{{ u.username.slice(0, 1) }}</span>
                  {{ u.username }}
                  <span v-if="userStore.currentUser?.username === u.username" class="me-tag">我</span>
                </span>
              </td>
              <td>
                <span class="g-pill" :class="u.role === 'admin' ? 'accent' : ''"><span class="dot"></span>{{ u.role === 'admin' ? '管理员' : '普通用户' }}</span>
              </td>
              <td class="cell-text muted">{{ fmtTime(u.createdAt) }}</td>
              <td>
                <div class="row-actions">
                  <button class="btn-icon-text" @click="openReset(i)">重置密码</button>
                  <button class="btn-icon-text danger" :disabled="u.role === 'admin'" :title="u.role === 'admin' ? '管理员账号不可删除' : ''" @click="onDelete(i)">删除</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- 新增用户弹窗 -->
    <el-dialog v-model="showAdd" title="新增用户" width="420px" :close-on-click-modal="false">
      <el-form label-width="82px" @submit.prevent="onAdd">
        <el-form-item label="用户名">
          <el-input v-model="addForm.username" placeholder="登录用户名（唯一）" maxlength="20" />
        </el-form-item>
        <el-form-item label="初始密码">
          <el-input v-model="addForm.password" type="password" placeholder="至少 4 位" show-password />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="addForm.role" style="width: 100%;">
            <el-option label="普通用户" value="user" />
            <el-option label="管理员" value="admin" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAdd = false">取消</el-button>
        <button type="button" class="btn-uni" @click="onAdd">确认新增</button>
      </template>
    </el-dialog>

    <!-- 重置密码弹窗 -->
    <el-dialog v-model="showReset" :title="`重置密码 · ${resetTarget ? resetTarget.username : ''}`" width="420px" :close-on-click-modal="false">
      <el-form label-width="82px" @submit.prevent="onReset">
        <el-form-item label="新密码">
          <el-input v-model="resetPass" type="password" placeholder="至少 4 位" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showReset = false">取消</el-button>
        <button type="button" class="btn-uni" @click="onReset">确认重置</button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '../stores/userStore'
import { useLogStore } from '../stores/logStore'
import { toEmail } from '../api/supabase'

const userStore = useUserStore()
const logStore = useLogStore()

const users = computed(() => userStore.users)

// 新增
const showAdd = ref(false)
const addForm = ref({ username: '', password: '', role: 'user' })

function openAdd() {
  addForm.value = { username: '', password: '', role: 'user' }
  showAdd.value = true
}

async function onAdd() {
  const { username, password, role } = addForm.value
  if (!username || !password) {
    ElMessage.warning('请填写用户名和初始密码')
    return
  }
  if (String(password).length < 4) {
    ElMessage.warning('密码至少 4 位')
    return
  }
  const ok = await userStore.addUser(username.trim(), password, role)
  if (ok) {
    logStore.addLog('用户管理', `新增用户 ${username.trim()}（${role === 'admin' ? '管理员' : '普通用户'}）`, userStore.currentUser?.username)
    showAdd.value = false
    ElMessageBox.alert(
      `列表已记录「${username.trim()}」，但 Auth 登录账号需到 Supabase 控制台创建：Authentication → Users → Add user → 邮箱填 ${toEmail(username.trim())}，密码同上，并勾选 Auto Confirm User。`,
      '还需一步：创建 Auth 账号',
      { confirmButtonText: '知道了', type: 'warning' }
    )
  } else {
    ElMessage.error('用户名已存在')
  }
}

// 重置密码
const showReset = ref(false)
const resetIdx = ref(-1)
const resetPass = ref('')
const resetTarget = computed(() => users.value[resetIdx.value] || null)

function openReset(i) {
  resetIdx.value = i
  resetPass.value = ''
  showReset.value = true
}

async function onReset() {
  const t = resetTarget.value
  if (!t) return
  if (!resetPass.value || String(resetPass.value).length < 4) {
    ElMessage.warning('新密码至少 4 位')
    return
  }
  const ok = await userStore.editUserPass(resetIdx.value, resetPass.value)
  if (ok) {
    logStore.addLog('用户管理', `重置用户 ${t.username} 的密码`, userStore.currentUser?.username)
    showReset.value = false
    ElMessageBox.alert(
      `重置「${t.username}」的密码需到 Supabase 控制台操作：Authentication → Users → 找到该用户 → Reset password。`,
      '还需一步：控制台重置密码',
      { confirmButtonText: '知道了', type: 'warning' }
    )
  } else {
    ElMessage.error('重置失败')
  }
}

// 删除
async function onDelete(i) {
  const u = users.value[i]
  if (!u || u.role === 'admin') return
  try {
    await ElMessageBox.confirm(
      `确定删除用户「${u.username}」？该账号将无法登录，操作不可恢复。`,
      '删除用户',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }
    )
  } catch (e) {
    return
  }
  const ok = await userStore.deleteUser(i)
  if (ok) {
    logStore.addLog('用户管理', `删除用户 ${u.username}`, userStore.currentUser?.username)
    ElMessageBox.alert(
      `列表已移除「${u.username}」，Auth 账号需到 Supabase 控制台删除：Authentication → Users → 找到该用户 → Delete。`,
      '还需一步：删除 Auth 账号',
      { confirmButtonText: '知道了', type: 'warning' }
    )
  } else {
    ElMessage.error('删除失败：管理员账号不可删除')
  }
}

function fmtTime(s) {
  if (!s) return '—'
  const d = new Date(s)
  if (isNaN(d.getTime())) return '—'
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
</script>

<style scoped lang="scss">
.user-view {
  padding: var(--space-5) var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.empty-guide {
  text-align: center;
  padding: var(--space-12) var(--space-4);

  h3 { font-size: var(--text-base); font-weight: 600; margin-bottom: var(--space-2); color: var(--fg); }
  p { font-size: 13px; color: var(--muted); max-width: 420px; margin: 0 auto; }
}

.manage-panel {
  padding: var(--space-5);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-4);
}

.panel-title { font-size: var(--text-lg); font-weight: 600; margin: 0; }
.panel-subtitle { font-size: 12px; color: var(--muted); margin-top: 4px; }

.user-cell {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.avatar-mini {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-pill);
  background: var(--accent-soft);
  color: var(--accent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;

  &.admin {
    background: color-mix(in oklch, var(--chart-gold) 14%, transparent);
    color: var(--chart-gold);
  }
}

.me-tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: var(--radius-pill);
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 500;
}

.muted { color: var(--muted); }

.row-actions {
  display: flex;
  gap: var(--space-2);
}

.btn-icon-text {
  border: none;
  background: transparent;
  color: var(--accent);
  font-size: 12px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  transition: background var(--motion-fast) var(--ease-standard);

  &:hover { background: var(--accent-soft); }
  &.danger { color: var(--bad); }
  &.danger:hover { background: color-mix(in oklch, var(--bad) 8%, transparent); }
  &:disabled { color: var(--muted); cursor: not-allowed; opacity: 0.55; }
  &:disabled:hover { background: transparent; }
}
</style>
