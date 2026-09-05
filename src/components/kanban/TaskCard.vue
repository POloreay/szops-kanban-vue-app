<template>
  <div
    class="task-card"
    :class="[
      `priority-${task.priority}`,
      { overdue: isOverdueTask && !archived, warn: isWarnTask && !archived }
    ]"
    @click="$emit('click', task)"
  >
    <div class="task-card-inner">
      <div class="task-card-priority" :class="`priority-${task.priority}`"></div>
      <div class="task-card-body">
        <div class="task-card-title">{{ task.title }}</div>
        <div v-if="task.desc" class="task-card-desc">{{ task.desc }}</div>

        <div class="task-card-badges">
          <!-- 子状态徽章 -->
          <template v-if="task.status === 'impl'">
            <span class="pill" :style="implSub1Style">{{ task.implSub1 || IMPL_SUBS_PATH1[0] }}</span>
            <span class="pill pill-sub2">{{ task.implSub2 || IMPL_SUBS_PATH2[0] }}</span>
          </template>
          <template v-else>
            <span class="pill" :style="subStatusStyle">{{ task.subStatus || '未指定' }}</span>
          </template>

          <!-- 优先级 -->
          <span class="pill" :class="`pill-priority-${task.priority}`">{{ PRIORITY_NAMES[task.priority] }}</span>

          <!-- 确收类型 -->
          <span v-if="task.projectInfo?.confirmType" class="pill pill-confirm">
            确收：{{ task.projectInfo.confirmType }}
          </span>

          <!-- 预警/逾期/待决策 -->
          <span v-if="isWarnTask && !archived" class="pill pill-warn">剩余{{ daysLeft }}天</span>
          <span v-if="isOverdueTask && !archived" class="pill pill-bad">逾期{{ Math.abs(daysLeft) }}天</span>
          <span v-if="task.needDecision && !archived" class="pill pill-decide">⚑ 待决策</span>
        </div>

        <div class="task-card-meta">
          <div class="left">
            <span class="avatar">{{ (task.owner || '?').charAt(0) }}</span>
            <span>{{ task.owner }}</span>
          </div>
          <span v-if="task.projectAmt" class="task-amount">{{ task.projectAmt }}万</span>
          <span v-else-if="task.agencyFee" class="task-amount">{{ fmtMoney(task.agencyFee) }}元</span>
          <span v-else class="task-amount task-amount-muted">待定</span>
        </div>

        <div class="task-card-footer">
          <span class="deadline" :class="{ urgent: (isWarnTask || isOverdueTask) && !archived }">
            {{ deadlineText }}
          </span>
          <span v-if="!archived" class="countdown" :class="countdownClass">
            {{ Math.abs(daysLeft) }}天{{ isOverdueTask ? '逾期' : '' }}
          </span>
        </div>

        <!-- 最新里程碑 -->
        <div v-if="latestMilestone" class="milestone-latest">
          ◆ {{ latestMilestone.date }} {{ latestMilestone.text }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import {
  IMPL_SUBS_PATH1, IMPL_SUBS_PATH2, PRIORITY_NAMES
} from '../../utils/constants'
import {
  getDaysLeft, isOverdue, isWarn, isArchivedTask, fmtMoney, fmtDate
} from '../../utils/business'

const props = defineProps({
  task: { type: Object, required: true },
  index: { type: Number, default: 0 }
})

defineEmits(['click', 'edit', 'delete'])

const archived = computed(() => isArchivedTask(props.task))
const daysLeft = computed(() => getDaysLeft(props.task.deadline))
const isOverdueTask = computed(() => isOverdue(props.task))
const isWarnTask = computed(() => isWarn(props.task))
const deadlineText = computed(() => fmtDate(props.task.deadline))
const latestMilestone = computed(() => {
  const ms = props.task.milestones
  return ms && ms.length ? ms[ms.length - 1] : null
})

const implSub1Style = computed(() => {
  const p1 = props.task.implSub1 || IMPL_SUBS_PATH1[0]
  return p1.includes('不通过')
    ? 'color: var(--bad); background: color-mix(in oklch, var(--bad) 8%, transparent); border-color: color-mix(in oklch, var(--bad) 24%, transparent);'
    : 'color: var(--good); background: color-mix(in oklch, var(--good) 8%, transparent); border-color: color-mix(in oklch, var(--good) 24%, transparent);'
})

const subStatusStyle = computed(() => {
  const subStatusColorMap = {
    '采购意向': 'color: var(--info); background: color-mix(in oklch, var(--info) 8%, transparent); border-color: color-mix(in oklch, var(--info) 24%, transparent);',
    '采购需求': 'color: var(--info); background: color-mix(in oklch, var(--info) 8%, transparent); border-color: color-mix(in oklch, var(--info) 24%, transparent);',
    '采购预告': 'color: var(--good); background: color-mix(in oklch, var(--good) 8%, transparent); border-color: color-mix(in oklch, var(--good) 24%, transparent);',
    '商机录入': 'color: var(--warn); background: color-mix(in oklch, var(--warn) 10%, transparent); border-color: color-mix(in oklch, var(--warn) 28%, transparent);',
    '项目报名': 'color: var(--purple); background: color-mix(in oklch, var(--purple) 8%, transparent); border-color: color-mix(in oklch, var(--purple) 24%, transparent);',
    '标前评审': 'color: var(--warn); background: color-mix(in oklch, var(--warn) 10%, transparent); border-color: color-mix(in oklch, var(--warn) 28%, transparent);',
    '标书编写': 'color: var(--warn); background: color-mix(in oklch, var(--warn) 10%, transparent); border-color: color-mix(in oklch, var(--warn) 28%, transparent);',
    '标书审核': 'color: var(--warn); background: color-mix(in oklch, var(--warn) 10%, transparent); border-color: color-mix(in oklch, var(--warn) 28%, transparent);',
    '标书装订/上传': 'color: var(--warn); background: color-mix(in oklch, var(--warn) 10%, transparent); border-color: color-mix(in oklch, var(--warn) 28%, transparent);',
    '成功中标': 'color: var(--good); background: color-mix(in oklch, var(--good) 8%, transparent); border-color: color-mix(in oklch, var(--good) 24%, transparent);',
    '收入合同签订': 'color: var(--good); background: color-mix(in oklch, var(--good) 8%, transparent); border-color: color-mix(in oklch, var(--good) 24%, transparent);',
    '落标归档': 'color: var(--bad); background: color-mix(in oklch, var(--bad) 8%, transparent); border-color: color-mix(in oklch, var(--bad) 24%, transparent);',
    '归档结束': 'color: var(--muted); background: var(--bg); border-color: var(--border);',
    '流标': 'color: var(--bad); background: color-mix(in oklch, var(--bad) 8%, transparent); border-color: color-mix(in oklch, var(--bad) 24%, transparent);',
    '项目终止': 'color: var(--muted); background: var(--bg); border-color: var(--border);',
    '采购方案': 'color: var(--info); background: color-mix(in oklch, var(--info) 8%, transparent); border-color: color-mix(in oklch, var(--info) 24%, transparent);',
    '现场开标': 'color: var(--info); background: color-mix(in oklch, var(--info) 8%, transparent); border-color: color-mix(in oklch, var(--info) 24%, transparent);',
    '采购结果': 'color: var(--good); background: color-mix(in oklch, var(--good) 8%, transparent); border-color: color-mix(in oklch, var(--good) 24%, transparent);',
    '支出合同签订': 'color: var(--good); background: color-mix(in oklch, var(--good) 8%, transparent); border-color: color-mix(in oklch, var(--good) 24%, transparent);'
  }
  return subStatusColorMap[props.task.subStatus] || 'color: var(--muted); background: var(--bg); border-color: var(--border);'
})

const countdownClass = computed(() => {
  if (isOverdueTask.value) return 'bad'
  if (daysLeft.value <= 3) return 'bad'
  if (daysLeft.value <= 7) return 'warn'
  return 'good'
})
</script>

<style scoped lang="scss">
.task-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: var(--space-3);
  cursor: pointer;
  transition: border-color var(--motion-fast) var(--ease-standard),
              box-shadow var(--motion-fast) var(--ease-standard),
              transform var(--motion-fast) var(--ease-standard);

  &:hover {
    border-color: color-mix(in oklch, var(--accent) 40%, transparent);
    box-shadow: var(--elev-raised);
    transform: translateY(-1px);
  }

  &.overdue {
    border-color: color-mix(in oklch, var(--bad) 30%, transparent);
  }
  &.warn {
    border-color: color-mix(in oklch, var(--warn) 30%, transparent);
  }
}

.task-card-inner {
  display: flex;
  gap: var(--space-2);
}

.task-card-priority {
  width: 3px;
  align-self: stretch;
  border-radius: var(--radius-pill);
  flex-shrink: 0;

  &.priority-high { background: var(--bad); }
  &.priority-medium { background: var(--warn); }
  &.priority-low { background: var(--good); }
}

.task-card-body {
  flex: 1;
  min-width: 0;
}

.task-card-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--fg);
  margin-bottom: var(--space-2);
  line-height: 1.4;
}

.task-card-desc {
  font-size: 12px;
  color: var(--muted);
  margin-bottom: var(--space-2);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-card-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: var(--space-2);
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--muted);
  font-weight: 500;
  white-space: nowrap;
}

.pill-sub2 {
  color: var(--purple);
  background: color-mix(in oklch, var(--purple) 8%, transparent);
  border-color: color-mix(in oklch, var(--purple) 24%, transparent);
}

.pill-confirm {
  color: var(--info);
  background: color-mix(in oklch, var(--info) 8%, transparent);
  border-color: color-mix(in oklch, var(--info) 24%, transparent);
}

.pill-priority-high {
  color: var(--bad);
  background: color-mix(in oklch, var(--bad) 8%, transparent);
  border-color: color-mix(in oklch, var(--bad) 24%, transparent);
}
.pill-priority-medium {
  color: var(--warn);
  background: color-mix(in oklch, var(--warn) 10%, transparent);
  border-color: color-mix(in oklch, var(--warn) 28%, transparent);
}
.pill-priority-low {
  color: var(--good);
  background: color-mix(in oklch, var(--good) 8%, transparent);
  border-color: color-mix(in oklch, var(--good) 24%, transparent);
}

.pill-warn {
  color: var(--warn);
  background: color-mix(in oklch, var(--warn) 10%, transparent);
  border-color: color-mix(in oklch, var(--warn) 28%, transparent);
}

.pill-bad {
  color: var(--bad);
  background: color-mix(in oklch, var(--bad) 8%, transparent);
  border-color: color-mix(in oklch, var(--bad) 24%, transparent);
}

.pill-decide {
  color: var(--purple);
  background: color-mix(in oklch, var(--purple) 8%, transparent);
  border-color: color-mix(in oklch, var(--purple) 24%, transparent);
}

.task-card-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  font-size: 11px;
  color: var(--muted);
}

.task-card-meta .left {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.avatar {
  width: 20px;
  height: 20px;
  border-radius: var(--radius-pill);
  background: var(--accent);
  color: var(--accent-on);
  font-size: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  flex-shrink: 0;
}

.task-amount {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: 12px;
  color: var(--fg);
  font-weight: 500;
}

.task-amount-muted {
  color: var(--muted);
  font-weight: 400;
}

.task-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.deadline {
  font-size: 11px;
  color: var(--muted);
  font-family: var(--font-mono);

  &.urgent {
    color: var(--bad);
    font-weight: 600;
  }
}

.countdown {
  font-size: 11px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  font-family: var(--font-mono);
  padding: 1px 6px;
  border-radius: var(--radius-pill);

  &.good {
    color: var(--good);
    background: color-mix(in oklch, var(--good) 8%, transparent);
  }
  &.warn {
    color: var(--warn);
    background: color-mix(in oklch, var(--warn) 10%, transparent);
  }
  &.bad {
    color: var(--bad);
    background: color-mix(in oklch, var(--bad) 8%, transparent);
  }
}

.milestone-latest {
  margin-top: var(--space-2);
  font-size: 11px;
  color: var(--muted);
  border-top: 1px solid var(--border);
  padding-top: var(--space-1);
}
</style>
