<template>
  <div class="ring-comp">
    <svg :viewBox="`0 0 100 100`">
      <circle class="ring-track" cx="50" cy="50" r="42" />
      <circle
        class="ring-fill"
        :class="level"
        cx="50" cy="50" r="42"
        :stroke="strokeColor"
        :stroke-dasharray="dashArray"
      />
      <text x="50" y="55" text-anchor="middle" class="ring-center" :style="{ fontSize: textSize }">{{ percent }}%</text>
    </svg>
    <div class="ring-label">{{ label }}</div>
    <div class="ring-value">{{ value }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  percent: { type: Number, default: 0 },
  label: { type: String, default: '' },
  value: { type: String, default: '' },
  color: { type: String, default: '' },
  level: { type: String, default: '' }, // '' | good | warn | bad
  textSize: { type: String, default: '16px' }
})

const clamped = computed(() => Math.max(0, Math.min(100, props.percent)))
const dashArray = computed(() => {
  const circ = 2 * Math.PI * 42
  const filled = circ * clamped.value / 100
  return `${filled} ${circ}`
})
const strokeColor = computed(() => {
  if (props.color) return props.color
  if (props.level === 'good') return 'var(--good)'
  if (props.level === 'warn') return 'var(--warn)'
  if (props.level === 'bad') return 'var(--bad)'
  return 'var(--accent)'
})
</script>

<style scoped lang="scss">
.ring-comp {
  text-align: center;
}
svg {
  width: 100px;
  height: 100px;
  margin: 0 auto var(--space-2);
}
</style>
