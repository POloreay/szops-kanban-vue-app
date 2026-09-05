<template>
  <div class="pms" ref="rootEl" :class="{ open }">
    <button class="pms-trigger" type="button" @click="open = !open" :aria-expanded="open">
      <svg class="pms-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M3 5h18M3 12h18M3 19h10" />
      </svg>
      <span class="pms-label">{{ summaryText }}</span>
      <span v-if="selected.length" class="pms-clear" title="清空选择" @click.stop="clearAll">✕</span>
      <svg class="pms-caret" :class="{ open }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
    </button>

    <div v-if="open" class="pms-panel">
      <div class="pms-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
        <input v-model.trim="keyword" type="text" placeholder="搜索项目名称…" />
      </div>
      <div class="pms-actions">
        <button type="button" @click="selectAllVisible">全选本页</button>
        <button type="button" @click="clearAll">清空</button>
        <span class="pms-count">已选 {{ selected.length }} / {{ projects.length }}</span>
      </div>
      <div class="pms-list">
        <label v-for="p in filteredProjects" :key="p.id" class="pms-item" :class="{ checked: isSelected(p.id) }">
          <input type="checkbox" :checked="isSelected(p.id)" @change="toggle(p.id)" />
          <div class="pms-info">
            <span class="pms-name" :title="p.title">{{ p.title }}</span>
            <span class="pms-meta">
              <span class="pms-meta-item" v-if="p.planRevText">计划收入 {{ p.planRevText }} 万</span>
              <span class="pms-meta-item" v-if="p.year">{{ p.year }} 年</span>
              <span class="pms-meta-item" v-if="p.pm">项目经理 {{ p.pm }}</span>
            </span>
          </div>
        </label>
        <div v-if="!filteredProjects.length" class="pms-empty">未找到匹配项目</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  projects: { type: Array, default: () => [] }, // {id, title, planRevText, year, pm, owner}
  modelValue: { type: Array, default: () => [] } // 已选项目 id 数组
})
const emit = defineEmits(['update:modelValue'])

const open = ref(false)
const keyword = ref('')
const rootEl = ref(null)

const selected = computed(() => props.modelValue)

const summaryText = computed(() => {
  if (!selected.value.length) return '全部实施项目'
  if (selected.value.length === 1) {
    const p = props.projects.find(x => x.id === selected.value[0])
    return p ? truncate(p.title, 10) : '已选 1 个项目'
  }
  return `已选 ${selected.value.length} 个项目`
})

function truncate(s, n) {
  return s.length > n ? s.slice(0, n) + '…' : s
}

const filteredProjects = computed(() => {
  if (!keyword.value) return props.projects
  return props.projects.filter(p => p.title.toLowerCase().includes(keyword.value.toLowerCase()))
})

function isSelected(id) {
  return selected.value.includes(id)
}

function toggle(id) {
  const list = selected.value.includes(id)
    ? selected.value.filter(x => x !== id)
    : [...selected.value, id]
  emit('update:modelValue', list)
}

function selectAllVisible() {
  const ids = filteredProjects.value.map(p => p.id)
  const merged = [...new Set([...selected.value, ...ids])]
  emit('update:modelValue', merged)
}

function clearAll() {
  emit('update:modelValue', [])
}

function onDocClick(e) {
  if (rootEl.value && !rootEl.value.contains(e.target)) open.value = false
}

onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))
</script>

<style scoped lang="scss">
.pms {
  position: relative;
}

.pms-trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--muted);
  font-size: 13px;
  cursor: pointer;
  max-width: 260px;
  transition: all var(--motion-fast) var(--ease-standard);

  &:hover { border-color: var(--muted); color: var(--fg); }
  &.open { border-color: var(--accent); color: var(--accent); }
}

.pms-ico { width: 14px; height: 14px; flex-shrink: 0; }

.pms-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
}

.pms-clear {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--bg);
  color: var(--muted);
  font-size: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  &:hover { background: var(--bad); color: #fff; }
}

.pms-caret {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  transition: transform var(--motion-fast) var(--ease-standard);
  &.open { transform: rotate(180deg); }
}

.pms-panel {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  width: 480px;
  max-height: 440px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.14);
  z-index: 120;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.pms-search {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);

  svg { width: 14px; height: 14px; color: var(--muted); flex-shrink: 0; }

  input {
    flex: 1;
    border: none;
    outline: none;
    font-size: 13px;
    color: var(--fg);
    background: transparent;

    &::placeholder { color: var(--muted); }
  }
}

.pms-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  font-size: 12px;

  button {
    border: none;
    background: var(--bg);
    color: var(--accent);
    font-size: 12px;
    padding: 3px 10px;
    border-radius: var(--radius-sm);
    cursor: pointer;

    &:hover { background: var(--accent-soft); }
  }

  .pms-count { margin-left: auto; color: var(--muted); }
}

.pms-list {
  overflow-y: auto;
  padding: var(--space-2);
}

.pms-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 13px;
  transition: background var(--motion-fast) var(--ease-standard);

  &:hover { background: var(--bg); }
  &.checked { background: var(--accent-soft); }

  input { accent-color: var(--accent); cursor: pointer; flex-shrink: 0; margin-top: 2px; }

  .pms-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }

  .pms-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--fg);
    font-weight: 500;
    font-size: 13px;
  }

  .pms-meta {
    display: flex;
    gap: 10px;
    font-size: 11px;
    color: var(--muted);
    white-space: nowrap;
  }

  .pms-meta-item {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-variant-numeric: tabular-nums;
  }
}

.pms-empty {
  text-align: center;
  color: var(--muted);
  font-size: 12px;
  padding: var(--space-5);
}
</style>
