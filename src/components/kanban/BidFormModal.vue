<template>
  <teleport to="body">
    <div class="modal-overlay" v-if="visible" @click.self="onCancel">
      <div class="modal">
        <div class="modal-header">
          <div>
            <h2 class="modal-title">{{ props.editing ? '编辑投标' : '新建投标' }}</h2>
            <div class="modal-subtitle">字段延续项目管理口径：名称 / 描述 / 创建人 / 联系人 / 截止日期 / 优先级 / 环节 / 预计金额</div>
          </div>
          <button class="btn-icon" @click="onCancel" aria-label="关闭">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <form novalidate @submit.prevent="onSubmit">
          <div class="modal-body">
            <div class="form-row">
              <label>项目/商机名称 <span class="req">*</span></label>
              <input class="form-input" v-model.trim="form.title" placeholder="如：智慧园区集成项目投标" />
            </div>
            <div class="form-row">
              <label>描述</label>
              <textarea class="form-input" v-model="form.desc" rows="2" placeholder="采购内容、开标时间地点等"></textarea>
            </div>
            <div class="form-grid-2">
              <div class="form-row"><label>创建人 <span class="req">*</span></label><input class="form-input" v-model.trim="form.owner" placeholder="如：李泉" /></div>
              <div class="form-row"><label>联系人</label><input class="form-input" v-model.trim="form.contact" placeholder="如：张永宁" /></div>
            </div>
            <div class="form-grid-2">
              <div class="form-row"><label>截止日期 <span class="req">*</span></label><input class="form-input" v-model="form.deadline" type="date" /></div>
              <div class="form-row"><label>优先级</label>
                <select class="form-select" v-model="form.priority">
                  <option value="高">高</option><option value="中">中</option><option value="低">低</option>
                </select>
              </div>
            </div>
            <div class="form-grid-2">
              <div class="form-row">
                <label>生命周期环节</label>
                <select class="form-select" v-model="form.stage">
                  <option v-for="s in BID_STAGE_ORDER" :key="s" :value="s">{{ BID_STAGES[s].name }}</option>
                </select>
              </div>
              <div class="form-row">
                <label>子状态</label>
                <select class="form-select" v-model="form.subStatus">
                  <option value="">未指定</option>
                  <option v-for="s in curSubs" :key="s" :value="s">{{ s }}</option>
                </select>
              </div>
            </div>
            <div class="form-grid-2">
              <div class="form-row"><label>项目代理服务费(元)</label><input class="form-input" v-model="form.agencyFee" type="number" min="0" step="0.01" placeholder="选填" /></div>
              <div class="form-row"><label>预计金额(万元)</label><input class="form-input" v-model="form.amountWan" type="number" min="0" step="0.01" placeholder="选填，如 120.56" /></div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-secondary" @click="onCancel">取消</button>
            <button type="submit" class="btn-primary">{{ props.editing ? '保存修改' : '创建投标' }}</button>
          </div>
        </form>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { ref, reactive, computed, nextTick, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { BID_STAGES, BID_STAGE_ORDER } from '../../utils/constants'
import { useBidStore } from '../../stores/bidStore'
import { useLogStore } from '../../stores/logStore'
import { useUserStore } from '../../stores/userStore'

const props = defineProps({ modelValue: Boolean, editing: { type: Object, default: null } })
const emit = defineEmits(['update:modelValue'])

const bidStore = useBidStore()
const logStore = useLogStore()
const userStore = useUserStore()

const visible = ref(false)

const form = reactive({
  title: '', desc: '', owner: '', contact: '', deadline: '',
  priority: '中', stage: 'lead', subStatus: '', agencyFee: '', amountWan: ''
})

const curSubs = computed(() => BID_STAGES[form.stage]?.subs || [])

// 环节变化时若子状态不属于新环节则重置
watch(() => form.stage, (s) => {
  if (!BID_STAGES[s]?.subs.includes(form.subStatus)) {
    form.subStatus = BID_STAGES[s]?.subs[0] || ''
  }
})

function fillForm(b) {
  Object.assign(form, {
    title: b?.title || '',
    desc: b?.desc || '',
    owner: b?.owner || '',
    contact: b?.contact || '',
    deadline: b?.deadline || '',
    priority: b?.priority || '中',
    stage: b?.stage || 'lead',
    subStatus: b?.subStatus || '',
    agencyFee: b?.agencyFee === '' || b?.agencyFee == null ? '' : b.agencyFee,
    amountWan: b?.amount ? b.amount / 10000 : ''
  })
}

// 万元输入 → 元存储
function amountYuan() {
  return form.amountWan === '' || form.amountWan == null ? '' : Math.round(Number(form.amountWan) * 10000)
}

function onSubmit() {
  if (!form.title || !form.owner || !form.deadline) {
    ElMessage.error('请补全必填项：名称、创建人、截止日期')
    return
  }
  const priorityKey = { '高': 'high', '中': 'medium', '低': 'low' }[form.priority] || 'medium'
  if (props.editing) {
    bidStore.updateBid(props.editing.id, {
      title: form.title,
      desc: form.desc,
      owner: form.owner,
      contact: form.contact,
      deadline: form.deadline,
      priority: priorityKey,
      stage: form.stage,
      subStatus: form.subStatus,
      agencyFee: form.agencyFee === '' ? '' : Number(form.agencyFee),
      amount: amountYuan()
    })
    logStore.addLog('编辑', `修改投标「${form.title}」`, userStore.currentUser?.username || '系统')
    ElMessage.success('投标修改已保存')
  } else {
    bidStore.addBid({
      title: form.title,
      desc: form.desc,
      owner: form.owner,
      contact: form.contact,
      deadline: form.deadline,
      priority: priorityKey,
      stage: form.stage,
      subStatus: form.subStatus,
      agencyFee: form.agencyFee === '' ? '' : Number(form.agencyFee),
      amount: amountYuan()
    })
    logStore.addLog('新建', `创建投标「${form.title}」`, userStore.currentUser?.username || '系统')
    ElMessage.success('投标创建成功')
  }
  close()
}

function onCancel() { close() }

function close() {
  Object.assign(form, {
    title: '', desc: '', owner: '', contact: '', deadline: '',
    priority: '中', stage: 'lead', subStatus: '', agencyFee: '', amountWan: ''
  })
  visible.value = false
  emit('update:modelValue', false)
}

watch(() => props.modelValue, async (v) => {
  if (v) {
    if (props.editing) fillForm(props.editing)
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
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  height: 34px;
}

.btn-primary {
  border: none;
  background: var(--accent);
  color: var(--accent-on);

  &:hover { background: var(--primary-hover); }
  &:disabled { opacity: 0.6; cursor: not-allowed; }
}

.btn-secondary {
  background: var(--surface);
  color: var(--fg);
  border: 1px solid var(--border);

  &:hover { border-color: color-mix(in oklch, var(--fg) 20%, transparent); }
}

.form-row { margin-bottom: var(--space-4); }

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
</style>
