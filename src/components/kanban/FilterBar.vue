<template>
  <div class="filter-bar">
    <el-input
      v-model="taskStore.filterState.search"
      placeholder="搜索项目名称或描述..."
      :prefix-icon="Search"
      clearable
      size="default"
      style="width: 240px"
    />
    <el-select
      v-model="taskStore.filterState.owner"
      placeholder="创建人"
      clearable
      size="default"
      style="width: 120px"
    >
      <el-option v-for="o in taskStore.owners" :key="o" :label="o" :value="o" />
    </el-select>
    <el-select
      v-model="taskStore.filterState.priority"
      placeholder="优先级"
      clearable
      size="default"
      style="width: 100px"
    >
      <el-option label="高" value="high" />
      <el-option label="中" value="medium" />
      <el-option label="低" value="low" />
    </el-select>
    <el-date-picker
      v-model="taskStore.filterState.deadline"
      type="date"
      placeholder="截止日期"
      size="default"
      style="width: 140px"
      value-format="YYYY-MM-DD"
    />
    <el-select
      v-model="taskStore.filterState.status"
      placeholder="环节"
      clearable
      size="default"
      style="width: 120px"
    >
      <el-option label="前期环节" value="talk" />
      <el-option label="采购环节" value="proc" />
      <el-option label="实施环节" value="impl" />
    </el-select>
    <el-select
      v-model="taskStore.filterState.archive"
      size="default"
      style="width: 110px"
    >
      <el-option label="进行中" value="active" />
      <el-option label="已归档" value="archived" />
      <el-option label="全部" value="all" />
    </el-select>
    <el-button size="default" @click="taskStore.clearFilters()">清除筛选</el-button>

    <div class="filter-stats">
      <span class="stat-item">共 <b class="tabular">{{ filteredCount }}</b> 项</span>
      <span class="stat-item warn">预警/逾期 <b class="tabular">{{ warnCount }}</b></span>
      <span class="stat-item decide">待决策 <b class="tabular">{{ decideCount }}</b></span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Search } from '@element-plus/icons-vue'
import { useTaskStore } from '../../stores/taskStore'
import { isArchivedTask, isWarn, isOverdue } from '../../utils/business'

const taskStore = useTaskStore()

const filteredCount = computed(() => taskStore.filteredTasks.length)

const warnCount = computed(() =>
  taskStore.filteredTasks.filter(t => !isArchivedTask(t) && (isWarn(t) || isOverdue(t))).length
)

const decideCount = computed(() =>
  taskStore.filteredTasks.filter(t => !isArchivedTask(t) && t.needDecision).length
)
</script>

<style scoped lang="scss">
.filter-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 12px 16px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 10px;
}

.filter-stats {
  margin-left: auto;
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: var(--text-second);
}

.stat-item {
  b {
    color: var(--text-main);
    font-size: 15px;
  }
  &.warn b { color: var(--danger); }
  &.decide b { color: var(--purple); }
}
</style>
