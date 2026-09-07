<template>
  <teleport to="body">
    <div class="modal-overlay" v-if="visible" @click.self="onCancel">
      <div class="modal modal-lg">
        <div class="modal-header">
          <div>
            <h2 class="modal-title">{{ props.editing ? '编辑项目' : '新建项目' }}</h2>
            <div class="modal-subtitle">{{ props.editing ? '修改项目信息后保存，变更将同步到各看板' : '手动录入单个项目，或从 Excel 批量导入' }}</div>
          </div>
          <button class="btn-icon" @click="onCancel" aria-label="关闭">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <form novalidate @submit.prevent="onSubmit">
          <div class="modal-body">
            <!-- Excel 导入入口（新建模式才显示） -->
            <div v-if="!props.editing" class="import-entry">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="34" height="34"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6"/><path d="m9 15 3 3 3-3"/></svg>
              <div class="import-entry-text">
                <div class="import-entry-title">从 Excel 批量导入</div>
                <div class="import-entry-desc">支持 .xlsx / .xls / .csv，不做列名校验，必填字段自动从 Excel 映射（项目名称、创建人、项目经理→联系人）</div>
              </div>
              <button type="button" class="btn-secondary" @click="fileInput?.click()">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 8 5-5 5 5"/><path d="M5 21h14"/></svg>
                选择文件
              </button>
              <input ref="fileInput" type="file" accept=".xlsx,.xls,.csv" style="display:none" @change="onFileChange" />
            </div>

            <!-- 导入预览：逐条勾选 + 阶段确认 -->
            <div v-if="importState === 'preview'" class="import-preview-block">
              <div class="import-error-box warn" v-if="!importRows.length">文件中未解析到有效数据行</div>
              <template v-else>
                <div class="import-summary">
                  已解析 {{ importRows.length }} 条记录，默认全选 · 阶段规则：<b>按系统「项目状态」自动分配</b>（未开工→前期环节，在建→实施环节，完工/验收/业务关闭/财务关闭→实施环节并自动归档）；无状态时按合同金额回退。可逐条勾选或修改阶段
                </div>
                <div class="import-preview-wrap">
                  <table class="ds-table import-preview-table">
                    <thead>
                      <tr>
                        <th style="width:44px">导入</th>
                        <th>项目名称</th>
                        <th style="width:90px">阶段分配</th>
                        <th>创建人</th>
                        <th style="width:110px">合同金额(不含税)</th>
                        <th style="width:90px">截止日期</th>
                        <th style="width:70px">优先级</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(r, i) in importRows" :key="i" :class="{ skip: !r.checked }">
                        <td><input type="checkbox" class="import-check" v-model="r.checked" /></td>
                        <td class="cell-title" :title="r.title">{{ r.title || '—' }}</td>
                        <td>
                          <select class="form-select import-stage-select" v-model="r.stage" @click.stop>
                            <option value="talk">前期环节</option>
                            <option value="proc">采购环节</option>
                            <option value="impl">实施环节</option>
                          </select>
                        </td>
                        <td class="cell-text">{{ r.owner || '—' }}</td>
                        <td class="num">{{ r.contractAmount !== '' && r.contractAmount != null ? r.contractAmount : '—' }}</td>
                        <td class="num">{{ r.deadline || '—' }}</td>
                        <td class="cell-text">{{ r.priority || '—' }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div class="import-actions">
                  <button type="button" class="btn-secondary" @click="resetImport">取消导入</button>
                  <button type="button" class="btn-primary" :disabled="!checkedCount" @click="onConfirmImport">确认导入 {{ checkedCount }} 条</button>
                </div>
              </template>
            </div>

            <div v-if="!props.editing" class="import-divider"><span>或手动录入（XLS 提炼字段，无必填）</span></div>
            <div v-if="props.editing" class="edit-notice">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
              编辑模式可修改项目全部字段（含财务明细），保存后同步到各看板
            </div>
            <!-- 手动新建：阶段 + 子状态选择（无必填校验） -->
            <template v-if="!props.editing">
              <div class="form-grid-2">
                <div class="form-row">
                  <label>项目阶段</label>
                  <select class="form-select" v-model="form.status">
                    <option value="talk">前期环节</option>
                    <option value="proc">采购环节</option>
                    <option value="impl">实施环节</option>
                  </select>
                </div>
                <div class="form-row" v-if="form.status !== 'impl'">
                  <label>子状态</label>
                  <select class="form-select" v-model="form.subStatus">
                    <option value="">未指定</option>
                    <option v-for="s in subStatusOptions" :key="s" :value="s">{{ s }}</option>
                  </select>
                </div>
              </div>
              <div v-if="isCustom" class="form-row">
                <label>自定义子状态名称</label>
                <input class="form-input" v-model.trim="form.customSubStatus" placeholder="请输入自定义子状态名称" />
              </div>
              <div class="form-grid-2">
                <div v-for="f in XLS_QUICK_FIELDS" :key="f.key" class="form-row">
                  <label>{{ f.label }}</label>
                  <select v-if="f.type === 'select'" class="form-select" v-model="form.quickInfo[f.key]">
                    <option value=""></option>
                    <option v-for="opt in f.options" :key="opt" :value="opt">{{ opt }}</option>
                  </select>
                  <input v-else-if="f.type === 'date'" class="form-input" type="date" v-model="form.quickInfo[f.key]" />
                  <input v-else :class="f.type === 'number' ? 'form-input num-input' : 'form-input'" :type="f.type === 'number' ? 'number' : 'text'" v-model="form.quickInfo[f.key]" :placeholder="f.label" />
                </div>
              </div>
              <div class="form-row">
                <label>备注描述</label>
                <textarea class="form-input" v-model="form.desc" rows="2" placeholder="选填：项目背景、交付要求等"></textarea>
              </div>
            </template>

            <!-- 编辑模式：全字段 -->
            <template v-if="props.editing">
            <div class="form-row">
              <label>项目名称 <span class="req">*</span></label>
              <input class="form-input" v-model.trim="form.title" placeholder="如：算力服务器集成项目" />
            </div>
            <div class="form-row">
              <label>描述</label>
              <textarea class="form-input" v-model="form.desc" rows="2" placeholder="开标地点、采购内容、交付进展等"></textarea>
            </div>
            <div class="form-grid-2">
              <div class="form-row"><label>创建人 <span class="req">*</span></label><input class="form-input" v-model.trim="form.owner" placeholder="如：李泉" /></div>
            </div>
            <div class="form-grid-2">
              <div class="form-row">
                <label>项目阶段</label>
                <select class="form-select" v-model="form.status">
                  <option value="talk">前期环节</option>
                  <option value="proc">采购环节</option>
                  <option value="impl">实施环节</option>
                </select>
              </div>
              <div class="form-row" v-if="form.status !== 'impl'">
                <label>子状态</label>
                <select class="form-select" v-model="form.subStatus">
                  <option value="">未指定</option>
                  <option v-for="s in subStatusOptions" :key="s" :value="s">{{ s }}</option>
                </select>
              </div>
            </div>
            <div v-if="isCustom" class="form-row">
              <label>自定义子状态名称</label>
              <input class="form-input" v-model.trim="form.customSubStatus" placeholder="请输入自定义子状态名称" />
            </div>
            </template>

            <!-- 实施环节双通道子状态（编辑模式） -->
            <div v-if="props.editing" class="form-grid-2">
              <div class="form-row"><label>实施-交付通道</label>
                <select class="form-select" v-model="form.implSub1">
                  <option v-for="s in IMPL_SUBS_PATH1" :key="s" :value="s">{{ s }}</option>
                </select>
              </div>
              <div class="form-row"><label>实施-财务通道</label>
                <select class="form-select" v-model="form.implSub2">
                  <option v-for="s in IMPL_SUBS_PATH2" :key="s" :value="s">{{ s }}</option>
                </select>
              </div>
            </div>

            <!-- XLS 项目信息 40 字段（编辑模式放开） -->
            <template v-if="props.editing">
              <div class="form-section-divider">项目信息（财务明细）</div>
              <div class="form-grid-2">
                <div v-for="f in XLS_FIELDS" :key="f.key" class="form-row">
                  <label>{{ f.label }}</label>
                  <input class="form-input" v-model.trim="form.projectInfo[f.key]" :placeholder="f.label" />
                </div>
              </div>
            </template>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-secondary" @click="onCancel">取消</button>
            <button type="submit" class="btn-primary">{{ props.editing ? '保存修改' : '创建项目' }}</button>
          </div>
        </form>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { ref, reactive, nextTick, watch, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { XLS_FIELDS, XLS_QUICK_FIELDS, IMPL_SUBS_PATH1, IMPL_SUBS_PATH2, STATUS_MAP, stageByBuildStatus } from '../../utils/constants'
import { useTaskStore } from '../../stores/taskStore'
import { useLogStore } from '../../stores/logStore'
import { useUserStore } from '../../stores/userStore'

const props = defineProps({
  modelValue: Boolean,
  editing: { type: Object, default: null },
  defaultStatus: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue'])

const taskStore = useTaskStore()
const logStore = useLogStore()
const userStore = useUserStore()

const visible = ref(false)
const fileInput = ref(null)

const form = reactive({
  title: '', desc: '', owner: '',
  status: 'talk', subStatus: '', customSubStatus: '',
  implSub1: '', implSub2: '',
  projectInfo: {},
  quickInfo: {}
})

// XLS 提炼字段默认值（全部空）
function emptyQuickInfo() {
  const o = {}
  XLS_QUICK_FIELDS.forEach(f => { o[f.key] = '' })
  return o
}

// 导入状态
const importState = ref('idle') // idle | preview
const importRows = ref([]) // [{ checked, title, desc, owner, contact, priority, deadline, subStatus, needDecision, agencyFee, contractAmount, stage }]
const checkedCount = computed(() => importRows.value.filter(r => r.checked).length)
// 当前阶段可选子状态
const curSubs = computed(() => STATUS_MAP[form.status]?.subs || [])
// 旧数据兼容：若已有 subStatus 不在新列表中，追加为额外选项
const subStatusOptions = computed(() => {
  const subs = [...curSubs.value]
  if (form.subStatus && !subs.includes(form.subStatus)) subs.push(form.subStatus)
  return subs
})
const isCustom = computed(() => form.subStatus === '其他')
// 阶段变化时重置子状态
watch(() => form.status, (s) => {
  const subs = STATUS_MAP[s]?.subs || []
  if (!subs.includes(form.subStatus)) {
    form.subStatus = subs[0] || ''
    form.customSubStatus = ''
  }
})

// 从一行 Excel 数据中尽力识别字段：先按标准中文列名取，取不到则模糊匹配
function pickField(row, label) {
  if (row[label] != null && String(row[label]).trim() !== '') return row[label]
  // 模糊匹配：Excel 列名包含关键词（去空格后比较）
  const keys = Object.keys(row)
  const norm = s => String(s).replace(/\s+/g, '')
  const target = norm(label)
  for (const k of keys) {
    if (norm(k) === target) return row[k]
  }
  for (const k of keys) {
    if (norm(k).includes(target) || target.includes(norm(k))) return row[k]
  }
  return ''
}

// 导入时顺带识别的 XLS 关键字段（写入 projectInfo，供总览列/战新分布/指标计算/风险预警使用）
const IMPORT_XLS_KEYS = [
  'projectName', 'projectId', 'buildStatus', 'pmName', 'clientName', 'mainTag', 'auxTag',
  'actualGrossMargin', 'accReceipt', 'accInvoice', 'accPayment', 'accCollection',
  'ledgerRevenueTax', 'planRevenueTax', 'contractAmount', 'createdDate',
  // 新增：指标计算/进度/归档/风险字段
  'planRevenueNoTax', 'planCost', 'planGrossMargin', 'ledgerRevenueNoTax',
  'planStartDate', 'planEndDate', 'businessCloseDate', 'financeCloseDate',
  'approvalPassDate',
  'clientCategory', 'workAreaDesc', 'currentActivity', 'isAdvance', 'advanceBudget', 'cancelFlag', 'closeStatus'
]

// 项目状态 → 看板阶段（按系统项目状态自动分配；空/未知回退旧规则：合同金额有值→实施，空→前期）
function stageOfRow(r, contractAmount) {
  const bs = String((r.xlsInfo && r.xlsInfo.buildStatus) || '').trim()
  const mapped = stageByBuildStatus(bs)
  if (mapped) return mapped
  return contractAmount !== '' && contractAmount !== '0' ? 'impl' : 'talk'
}

async function onFileChange(e) {
  const file = e.target.files && e.target.files[0]
  if (!file) return
  try {
    // 动态加载 xlsx：只在导入 Excel 时才下载，减小首屏体积
    const XLSX = await import('xlsx')
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false })
    if (!rows.length) {
      ElMessage.error('文件中未解析到数据行')
      resetImport()
      return
    }
    importRows.value = rows.map(r => {
      const contractAmount = String(pickField(r, '项目收入合同金额(不含税)') ?? '').trim()
      // 顺带识别 XLS 关键字段
      const xlsInfo = {}
      IMPORT_XLS_KEYS.forEach(k => {
        const f = XLS_FIELDS.find(x => x.key === k)
        if (!f) return
        const v = String(pickField(r, f.label) ?? '').trim()
        xlsInfo[k] = v
      })
      // 阶段分配：优先按系统「项目状态」，回退旧规则（合同金额）
      const stage = stageOfRow({ xlsInfo }, contractAmount)
      return {
        checked: true,
        stage,
        title: String(pickField(r, '项目名称') ?? '').trim(),
        desc: String(pickField(r, '描述') ?? '').trim(),
        owner: String(pickField(r, '创建人') ?? '').trim(),
        contact: String(pickField(r, '项目经理名称') ?? '').trim(),
        priority: String(pickField(r, '优先级') ?? '').trim(),
        deadline: '',
        status: String(pickField(r, '状态') ?? '').trim(),
        subStatus: String(pickField(r, '子状态') ?? '').trim(),
        needDecision: String(pickField(r, '需要决策') ?? '').trim(),
        agencyFee: String(pickField(r, '项目代理服务费(元)') ?? '').trim(),
        contractAmount,
        xlsInfo
      }
    })
    // 已上传文件：必填字段从 Excel 现有字段自动填充到手动表单（供补充/微调）
    autoFillFormFromImport(importRows.value)
    importState.value = 'preview'
  } catch (err) {
    console.warn('import parse error:', err)
    ElMessage.error('文件解析失败，请确认是有效的 Excel/CSV 文件')
    resetImport()
  }
}

function resetImport() {
  importState.value = 'idle'
  importRows.value = []
  if (fileInput.value) fileInput.value.value = ''
}

// 已上传 Excel 时：必填字段自动填充到手动表单（取解析首行；纯手动新建不填充）
function autoFillFormFromImport(rows) {
  if (!rows || !rows.length) return
  const first = rows[0]
  if (first.title) form.quickInfo.projectName = first.title
  if (first.owner) form.owner = first.owner
}

function onConfirmImport() {
  const rows = importRows.value.filter(r => r.checked)
  if (!rows.length) {
    ElMessage.error('请至少勾选一条要导入的记录')
    return
  }
  const n = taskStore.importTasks(rows)
  logStore.addLog('导入', `从 Excel 批量导入 ${n} 条项目数据`, userStore.currentUser?.username || '系统')
  ElMessage.success(`成功导入 ${n} 条项目数据`)
  resetImport()
  close()
}

function onSubmit() {
  if (props.editing) {
    // 编辑模式：必填校验 + 全字段（截止日期等已删字段保留原值不覆盖）
    if (!form.title || !form.owner) {
      ElMessage.error('请补全必填项：项目名称、创建人')
      return
    }
    const payload = {
      title: form.title,
      desc: form.desc,
      owner: form.owner,
      status: form.status,
      subStatus: form.status === 'impl' ? '' : (form.subStatus === '其他' && form.customSubStatus ? form.customSubStatus : form.subStatus),
      implSub1: form.implSub1,
      implSub2: form.implSub2
    }
    payload.projectInfo = {}
    XLS_FIELDS.forEach(f => {
      const v = form.projectInfo[f.key]
      payload.projectInfo[f.key] = v === '' || v == null ? '' : v
    })
    taskStore.updateTask(props.editing.id, payload)
    logStore.addLog('编辑', `修改项目「${form.title}」`, userStore.currentUser?.username || '系统')
    ElMessage.success('项目修改已保存')
  } else {
    // 手动新建：XLS 提炼字段，无必填校验
    const quick = { ...form.quickInfo }
    // 项目名称：quickInfo.projectName → title
    const title = String(quick.projectName || '').trim() || '未命名项目'
    // 金额字段转数字
    const numFields = ['contractAmount', 'planRevenueTax', 'planCost', 'actualCost', 'accInvoice', 'accCollection']
    numFields.forEach(k => {
      if (quick[k] !== '' && quick[k] != null) {
        const n = Number(String(quick[k]).replace(/[,&\s]/g, ''))
        quick[k] = isNaN(n) ? quick[k] : n
      }
    })
    // 阶段：优先使用用户选择的阶段，若选了项目状态则自动映射覆盖
    let statusKey = form.status || 'talk'
    const bs = String(quick.buildStatus || '').trim()
    const mapped = stageByBuildStatus(bs)
    if (mapped) statusKey = mapped
    // 子状态：前期「其他」用自定义文本
    let subStatus = form.subStatus
    if (subStatus === '其他' && form.customSubStatus) {
      subStatus = form.customSubStatus
    }
    const payload = {
      title,
      desc: form.desc,
      owner: form.owner || (userStore.currentUser?.username || ''),
      priority: 'medium',
      status: statusKey,
      subStatus: statusKey === 'impl' ? '' : subStatus,
      projectInfo: quick
    }
    taskStore.addTask(payload)
    logStore.addLog('新建', `创建项目「${title}」`, userStore.currentUser?.username || '系统')
    ElMessage.success('项目创建成功')
  }
  close()
}

function onCancel() { close() }

function close() {
  resetImport()
  // 重置表单；若仍处于导入预览状态（已上传文件），保持自动填充的必填字段
  const keep = importState.value === 'preview'
  const saved = keep ? { title: form.title, owner: form.owner } : null
  Object.assign(form, {
    title: '', desc: '', owner: '',
    status: props.defaultStatus || 'talk', subStatus: '', customSubStatus: '',
    implSub1: '', implSub2: '',
    projectInfo: {},
    quickInfo: emptyQuickInfo()
  })
  if (saved) Object.assign(form, saved)
  visible.value = false
  emit('update:modelValue', false)
}

function fillForm(t) {
  const info = t.projectInfo || {}
  Object.assign(form, {
    title: (info.projectName || t.title) || '',
    desc: t.desc || '',
    owner: t.owner || '',
    status: t.status || 'talk',
    subStatus: t.subStatus || '',
    customSubStatus: '',
    implSub1: t.implSub1 || '',
    implSub2: t.implSub2 || '',
    projectInfo: {}
  })
  // 回填 XLS 40 字段
  XLS_FIELDS.forEach(f => {
    const v = info[f.key]
    form.projectInfo[f.key] = v === undefined || v === null ? '' : v
  })
}

watch(() => props.modelValue, async (v) => {
  if (v) {
    if (props.editing) {
      fillForm(props.editing)
    } else {
      form.quickInfo = emptyQuickInfo()
      form.status = props.defaultStatus || 'talk'
      form.subStatus = ''
      form.customSubStatus = ''
    }
    visible.value = true
    await nextTick()
  }
}, { immediate: true })

watch(visible, (v) => {
  if (!v) emit('update:modelValue', false)
})
</script>

<style scoped lang="scss">
.modal-overlay {
  position: fixed;
  inset: 0;
  background: color-mix(in oklab, var(--fg), transparent 60%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: var(--space-6);
}

.modal {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 520px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 8px 32px color-mix(in oklab, var(--fg), transparent 80%);

  &.modal-lg { max-width: 860px; }
}

.modal-header {
  padding: var(--space-5) var(--space-5) var(--space-4);
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  position: sticky;
  top: 0;
  background: var(--surface);
  z-index: 2;
}

.modal-title { font-size: var(--text-base); font-weight: 600; margin: 0; }
.modal-subtitle { font-size: 12px; color: var(--muted); margin-top: 2px; }

.btn-icon {
  background: transparent;
  border: none;
  color: var(--muted);
  cursor: pointer;
  padding: 4px;
  border-radius: var(--radius-sm);
  display: flex;

  svg { width: 16px; height: 16px; }
  &:hover { color: var(--fg); background: var(--bg); }
}

.modal-body { padding: var(--space-5); }

.modal-footer {
  padding: var(--space-4) var(--space-5);
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  position: sticky;
  bottom: 0;
  background: var(--surface);
}

.btn-secondary,
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--motion-fast) var(--ease-standard);
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  white-space: nowrap;
  height: 34px;
  background: var(--accent);
  color: var(--accent-on);
  transition: all var(--motion-fast) var(--ease-standard);

  &:hover { background: var(--primary-hover); }
  &:disabled { opacity: 0.6; cursor: not-allowed; }
}

.btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  height: 34px;
  background: var(--surface);
  color: var(--fg);
  border: 1px solid var(--border);
  transition: all var(--motion-fast) var(--ease-standard);

  &:hover { border-color: color-mix(in oklch, var(--fg) 20%, transparent); }
}

.import-entry {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4);
  border: 1.5px dashed color-mix(in oklch, var(--accent) 35%, var(--border));
  border-radius: var(--radius-md);
  background: var(--accent-soft);
  margin-bottom: var(--space-4);

  svg { color: var(--accent); flex-shrink: 0; }
}

.import-entry-text { flex: 1; min-width: 0; }
.import-entry-title { font-size: 13px; font-weight: 600; }
.import-entry-desc {
  font-size: 11px;
  color: var(--muted);
  margin-top: 2px;
  line-height: 1.5;
}

.import-divider {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  color: var(--muted);
  font-size: 11px;
  margin-bottom: var(--space-4);

  &::before, &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border);
  }
}

.import-preview-block { margin-bottom: var(--space-2); }

.import-error-box.warn {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-sm);
  font-size: 12px;
  margin-bottom: var(--space-3);
  background: color-mix(in oklch, var(--warn) 10%, transparent);
  border: 1px solid color-mix(in oklch, var(--warn) 30%, transparent);
  color: color-mix(in oklch, var(--warn) 60%, black);
}

.import-summary {
  font-size: 12px;
  color: var(--muted);
  margin-bottom: var(--space-2);
  line-height: 1.6;

  b { color: var(--fg); }
}

.import-preview-wrap {
  max-height: 320px;
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);

  th { position: sticky; top: 0; background: var(--bg); z-index: 1; }
  td {
    max-width: 180px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  tr.skip { opacity: 0.45; }
}

.import-check {
  accent-color: var(--accent);
  cursor: pointer;
}

.import-stage-select {
  padding: 4px 6px;
  font-size: 12px;
  width: 100%;
}

.import-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.cell-title {
  font-weight: 500;
  max-width: 240px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cell-text { font-size: 12px; }

.form-row { margin-bottom: var(--space-4); }

.form-section-divider {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
  margin: var(--space-5) 0 var(--space-4);

  &::before, &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border);
  }
}

.form-row label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: var(--fg);
  margin-bottom: 6px;
}

.req { color: var(--bad); }

.form-input,
.form-select {
  font: inherit;
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--fg);
  font-size: 13px;
  transition: border-color var(--motion-fast), box-shadow var(--motion-fast);

  &:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: var(--focus-ring);
  }
}

.form-grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 var(--space-4);
}

.edit-notice {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--warn);
  background: color-mix(in oklch, var(--warn) 8%, transparent);
  border: 1px solid color-mix(in oklch, var(--warn) 24%, transparent);
  border-radius: var(--radius-sm);
  padding: 8px 10px;
  margin-bottom: var(--space-4);

  svg { flex-shrink: 0; }
}
</style>
