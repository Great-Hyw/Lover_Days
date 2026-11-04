<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' }, // YYYY-MM-DD
  max: { type: String, default: '' }, // YYYY-MM-DD，之后的日期禁选
  placeholder: { type: String, default: '选择日期' }
})
const emit = defineEmits(['update:modelValue'])

const WEEKS = ['一', '二', '三', '四', '五', '六', '日']
const pad = (n) => String(n).padStart(2, '0')
const fmt = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`

const root = ref(null)
const open = ref(false)
const mode = ref('days') // days | months | years
const viewYear = ref(2026)
const viewMonth = ref(0)

function syncView() {
  const d = props.modelValue ? new Date(props.modelValue) : new Date()
  if (!isNaN(d)) {
    viewYear.value = d.getFullYear()
    viewMonth.value = d.getMonth()
  }
}
watch(() => props.modelValue, syncView, { immediate: true })

const display = computed(() => {
  return props.modelValue || ''
})

const todayStr = () => {
  const d = new Date()
  return fmt(d.getFullYear(), d.getMonth(), d.getDate())
}

// 日历格子：前追上月末尾、后补下月开头，对齐 6 行
const cells = computed(() => {
  const arr = []
  const first = new Date(viewYear.value, viewMonth.value, 1)
  const offset = (first.getDay() + 6) % 7 // 周一起算
  const prevDim = new Date(viewYear.value, viewMonth.value, 0).getDate()
  const prevM = viewMonth.value === 0 ? 11 : viewMonth.value - 1
  const prevY = viewMonth.value === 0 ? viewYear.value - 1 : viewYear.value
  for (let i = offset - 1; i >= 0; i--) {
    arr.push({ d: prevDim - i, y: prevY, m: prevM, other: true })
  }
  const dim = new Date(viewYear.value, viewMonth.value + 1, 0).getDate()
  for (let d = 1; d <= dim; d++) arr.push({ d, y: viewYear.value, m: viewMonth.value, other: false })
  const nextM = viewMonth.value === 11 ? 0 : viewMonth.value + 1
  const nextY = viewMonth.value === 11 ? viewYear.value + 1 : viewYear.value
  let n = 1
  while (arr.length % 7) arr.push({ d: n++, y: nextY, m: nextM, other: true })
  return arr.map((c) => ({ ...c, key: fmt(c.y, c.m, c.d) }))
})

const maxStr = computed(() => props.max || '')
function isFuture(key) {
  return maxStr.value !== '' && key > maxStr.value
}
const todayKey = computed(todayStr)

const headerLabel = computed(() => {
  if (mode.value === 'days') return `${viewYear.value} 年 ${viewMonth.value + 1} 月`
  if (mode.value === 'months') return `${viewYear.value} 年`
  return `${startYear.value} – ${startYear.value + 11}`
})

// 年格：当前年份前后 12 年
const startYear = ref(viewYear.value - (viewYear.value % 12))
watch([viewYear, mode], () => {
  if (mode.value === 'years') startYear.value = viewYear.value - (viewYear.value % 12)
})
const yearCells = computed(() => {
  const arr = []
  for (let i = 0; i < 12; i++) arr.push({ y: startYear.value + i, current: startYear.value + i === viewYear.value })
  return arr
})
const MONTHS = computed(() => {
  const arr = []
  for (let i = 0; i < 12; i++) arr.push({ m: i, label: `${i + 1} 月`, current: i === viewMonth.value })
  return arr
})

function shiftMonth(delta) {
  let m = viewMonth.value + delta
  let y = viewYear.value
  if (m < 0) { m = 11; y-- } else if (m > 11) { m = 0; y++ }
  viewMonth.value = m
  viewYear.value = y
}
function shiftYearBlock(delta) {
  startYear.value += delta * 12
}

function pickCell(c) {
  if (isFuture(c.key)) return
  emit('update:modelValue', c.key)
  open.value = false
}
function pickYear(y) {
  viewYear.value = y
  mode.value = 'months'
}
function pickMonth(m) {
  viewMonth.value = m
  mode.value = 'days'
}
function toggle() {
  open.value = !open.value
  if (open.value) syncView()
}

function onClickOutside(e) {
  if (root.value && !root.value.contains(e.target)) open.value = false
}
function onKey(e) {
  if (e.key === 'Escape') open.value = false
}
onMounted(() => {
  document.addEventListener('click', onClickOutside)
  document.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside)
  document.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div ref="root" class="dp-wrap">
    <button type="button" class="dp-trigger" @click="toggle">
      <span :class="['dp-value', { placeholder: !display }]">
        {{ display || placeholder }}
      </span>
      <span class="dp-icon" aria-hidden="true">▦</span>
    </button>
    <transition name="dp-pop">
      <div v-if="open" class="dp-panel">
        <!-- 头部导航 -->
        <div class="dp-header">
          <button
            v-if="mode === 'days'"
            type="button"
            class="dp-nav"
            aria-label="上个月"
            @click="shiftMonth(-1)"
          >‹</button>
          <button v-else type="button" class="dp-nav" aria-label="上一组" @click="shiftYearBlock(-1)">‹</button>
          <button type="button" class="dp-label" @click="mode = mode === 'days' ? 'years' : 'days'">
            {{ headerLabel }}
          </button>
          <button
            v-if="mode === 'days'"
            type="button"
            class="dp-nav"
            aria-label="下个月"
            @click="shiftMonth(1)"
          >›</button>
          <button v-else type="button" class="dp-nav" aria-label="下一组" @click="shiftYearBlock(1)">›</button>
        </div>

        <!-- 日期模式 -->
        <template v-if="mode === 'days'">
          <div class="dp-weeks">
            <span v-for="w in WEEKS" :key="w">{{ w }}</span>
          </div>
          <div class="dp-grid">
            <button
              v-for="c in cells"
              :key="c.key"
              type="button"
              :class="[
                'dp-cell',
                { other: c.other, selected: c.key === modelValue, today: c.key === todayKey, disabled: isFuture(c.key) }
              ]"
              :disabled="isFuture(c.key)"
              @click="pickCell(c)"
            >
              {{ c.d }}
            </button>
          </div>
        </template>

        <!-- 月份模式 -->
        <div v-else-if="mode === 'months'" class="dp-grid dp-grid-lg">
          <button
            v-for="mo in MONTHS"
            :key="mo.m"
            type="button"
            :class="['dp-cell-lg', { selected: mo.current }]"
            @click="pickMonth(mo.m)"
          >
            {{ mo.label }}
          </button>
        </div>

        <!-- 年份模式 -->
        <div v-else class="dp-grid dp-grid-lg">
          <button
            v-for="yc in yearCells"
            :key="yc.y"
            type="button"
            :class="['dp-cell-lg', { selected: yc.current }]"
            @click="pickYear(yc.y)"
          >
            {{ yc.y }}
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.dp-wrap {
  position: relative;
  width: 100%;
}

.dp-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  border-radius: 12px;
  padding: 10px 14px;
  font-size: 14px;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.7);
  box-shadow: inset 0 0 0 1px var(--hairline);
  transition: box-shadow 0.2s ease;
}
.dp-trigger:hover {
  box-shadow: inset 0 0 0 1px var(--rose-300);
}
.dp-value {
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}
.dp-value.placeholder {
  color: var(--ink-mute);
}
.dp-icon {
  color: var(--rose-400);
  font-size: 13px;
  letter-spacing: -1px;
}

/* 弹出面板：磨砂玻璃 */
.dp-panel {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 50;
  width: min(300px, calc(100vw - 32px));
  padding: 14px 14px 10px;
  border-radius: 18px;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  box-shadow: var(--shadow-lg), var(--glass-edge);
}

.dp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.dp-nav {
  width: 30px;
  height: 30px;
  border-radius: 9px;
  font-size: 18px;
  line-height: 1;
  color: var(--rose-500);
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s ease;
}
.dp-nav:hover {
  background: rgba(183, 110, 121, 0.14);
  transform: scale(1.08);
}
.dp-label {
  flex: 1;
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 600;
  color: var(--ink);
  border-radius: 9px;
  padding: 4px 6px;
  cursor: pointer;
  transition: background 0.2s ease;
}
.dp-label:hover {
  background: rgba(183, 110, 121, 0.12);
}

.dp-weeks {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  margin-bottom: 4px;
}
.dp-weeks span {
  text-align: center;
  font-size: 10px;
  font-weight: 700;
  color: var(--ink-mute);
  padding: 2px 0;
}

.dp-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}
.dp-grid-lg {
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  padding: 4px 0 2px;
}

.dp-cell {
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  border-radius: 10px;
  font-size: 13px;
  color: var(--ink);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease;
}
.dp-cell:hover {
  background: rgba(183, 110, 121, 0.14);
  transform: scale(1.06);
}
.dp-cell.other {
  color: var(--ink-mute);
  opacity: 0.55;
}
.dp-cell.today {
  font-weight: 700;
  box-shadow: inset 0 0 0 1px var(--rose-300);
}
.dp-cell.selected {
  background: linear-gradient(135deg, var(--rose-500), var(--rose-600));
  color: #fff;
  font-weight: 700;
  box-shadow: 0 4px 12px rgba(192, 61, 108, 0.32);
}
.dp-cell.selected:hover {
  background: linear-gradient(135deg, var(--rose-500), var(--rose-600));
}
.dp-cell.disabled {
  opacity: 0.3;
  cursor: not-allowed;
  text-decoration: line-through;
}
.dp-cell.disabled:hover {
  background: none;
  transform: none;
}

.dp-cell-lg {
  padding: 12px 4px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  color: var(--ink);
  cursor: pointer;
  transition: background 0.15s ease, transform 0.15s ease;
}
.dp-cell-lg:hover {
  background: rgba(183, 110, 121, 0.14);
  transform: scale(1.04);
}
.dp-cell-lg.selected {
  background: linear-gradient(135deg, var(--rose-500), var(--rose-600));
  color: #fff;
  box-shadow: 0 4px 12px rgba(192, 61, 108, 0.32);
}

/* 弹出过渡 */
.dp-pop-enter-active,
.dp-pop-leave-active {
  transition: opacity 0.2s ease, transform 0.2s var(--ease-out, ease);
}
.dp-pop-enter-from,
.dp-pop-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.97);
}
</style>
