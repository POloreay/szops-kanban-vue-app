// ========== 统一权限工具（2026-09-08 权限体系调整） ==========
// 规则：
// 1. 管理员：全局增删改查、可读可写全部权限
// 2. 投标管理：所有用户全权限（BidView 内已放开，不经本文件）
// 3. 项目管理：普通用户对自己负责的项目（projectInfo.pmName === 当前用户名）有全部权限；
//    对模块内全部内容（含他人项目）只读
// 4. 其余模块（仪表盘/收入/成本/预算/待办等）：所有用户全权限
//
// 注意：此为前端交互权限控制（按钮显示/操作拦截），数据层安全由 Supabase RLS（需登录）保障。

/**
 * 判断当前登录用户是否可管理（增删改）某条项目任务
 * @param {Object} task 任务对象（含 projectInfo.pmName / owner）
 * @param {Object} currentUser 当前用户 { username, role }
 * @returns {boolean}
 */
export function canManageTask(task, currentUser) {
  if (!currentUser) return false
  if (currentUser.role === 'admin') return true
  const me = currentUser.username
  if (!me || !task) return false
  // 项目经理维度：projectInfo.pmName 与当前用户名一致 → 拥有该项目全部权限
  const pmName = String(task?.projectInfo?.pmName || '').trim()
  if (pmName && pmName === me) return true
  // 兼容旧行为：项目创建人仍可管理自己创建的项目
  if (task.owner === me) return true
  return false
}

/**
 * 判断当前登录用户是否可查看某条项目（只读门槛）
 * 当前规则：所有登录用户对项目管理模块全部内容只读 → 恒 true
 */
export function canViewTask(_task, _currentUser) {
  return true
}
