<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import {
  getBirthdayList,
  saveBirthday,
  deleteBirthday,
  calcAgeLocal
} from '@/api/birthday'
import { showToast } from '@/utils/toast'
import { lunarMonthDayCount, lunarToSolarISO, lunarToSolar, lunarDateCN, solarToLunar, lunarLeapMonth } from '@/utils/lunar'

const list = ref([])
const loading = ref(true)
const ages = ref({}) // id -> '25.12345678'，前端本地计算，每秒刷新

// 历法：solar 阳历 / lunar 农历
const calendarType = ref('solar')

// 农历生日记录：后端只存公历 birthday（YYYY-MM-DD），
// 前端在本地记住哪些生日是农历的 + 农历年月日，用于按农历显示与计算
const LUNAR_KEY = 'love-days:lunar-birthdays'
const lunarStore = reactive({}) // { [id]: { y, m, d } }
function loadLunarStore() {
  try {
    const raw = JSON.parse(localStorage.getItem(LUNAR_KEY) || '{}')
    Object.keys(raw).forEach((k) => (lunarStore[k] = raw[k]))
  } catch (e) {}
}
function persistLunarStore() {
  try { localStorage.setItem(LUNAR_KEY, JSON.stringify({ ...lunarStore })) } catch (e) {}
}
// 每张卡片当前的显示历法：'lunar' | 'solar'（默认农历生日显农历，阳历生日显阳历）
const cardView = reactive({}) // { [id]: 'lunar' | 'solar' }
function viewOf(b) {
  const v = cardView[b.id]
  if (v) return v
  return lunarStore[b.id] ? 'lunar' : 'solar'
}
// 阳历年月日逐个选择（替代日历弹窗）
const selYear = ref('')
const selMonth = ref('')
const selDay = ref('')
// 农历年月日逐个选择
const selLYear = ref('')
const selLMonth = ref('')
const selLDay = ref('')

const now = new Date()
const yearList = Array.from({ length: now.getFullYear() - 1899 }, (_, i) => now.getFullYear() - i)
const monthList = Array.from({ length: 12 }, (_, i) => i + 1)
// 农历：不开放闰月，只列常规 1-12 月；年份限 1900-2100（数据表覆盖）
const lunarYearList = yearList.filter((y) => y >= 1900 && y <= 2100)
const lunarMonthList = monthList
const lunarDayList = computed(() => {
  if (!selLYear.value || !selLMonth.value) return Array.from({ length: 30 }, (_, i) => i + 1)
  const n = lunarMonthDayCount(+selLYear.value, +selLMonth.value)
  if (selLDay.value && +selLDay.value > n) selLDay.value = ''
  return Array.from({ length: n }, (_, i) => i + 1)
})

// 某年某月有多少天（含闰年）
function daysInMonth(y, m) {
  return new Date(y, m, 0).getDate()
}

// 日下拉选项：随年月变化；切月/切年导致天数不足时自动修正
const dayList = computed(() => {
  if (!selYear.value || !selMonth.value) return Array.from({ length: 31 }, (_, i) => i + 1)
  const n = daysInMonth(+selYear.value, +selMonth.value)
  if (selDay.value && +selDay.value > n) selDay.value = ''
  return Array.from({ length: n }, (_, i) => i + 1)
})

// 由年月日拼成 YYYY-MM-DD（接口契约不变：生日只传年月日；
// 农历选择时即时转公历后保存，后续计算/展示统一按公历处理）
const birthDate = computed(() => {
  if (calendarType.value === 'lunar') {
    return selLYear.value && selLMonth.value && selLDay.value
      ? lunarToSolarISO(+selLYear.value, +selLMonth.value, +selLDay.value)
      : ''
  }
  return selYear.value && selMonth.value && selDay.value
    ? `${selYear.value}-${String(selMonth.value).padStart(2, '0')}-${String(selDay.value).padStart(2, '0')}`
    : ''
})

const todayStr = () => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function formatDateCN(iso) {
  const d = new Date(iso)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

// 卡片主日期文案：按当前视图（农历显示农历日期；阳历显示公历日期）
// 阳历生日切到农历视图时，将其公历日期即时转为农历显示（固定转换，不滚动）
function cardDateText(b) {
  if (viewOf(b) !== 'lunar') return formatDateCN(b.birthday)
  const lr = lunarStore[b.id]
  if (lr) return lunarDateCN(lr.y, lr.m, lr.d, lr.isLeap)
  const [yy, mm, dd] = b.birthday.split('-').map(Number)
  const sol = solarToLunar(yy, mm, dd)
  return sol ? lunarDateCN(sol.year, sol.month, sol.day, sol.isLeap) : formatDateCN(b.birthday)
}

// 下一个生日的公历日期：今年生日没过去显示今年，已过去则显示明年
// （农历视图取今年/明年农历同日；阳历视图按公历月日）
function nextBirthdayISO(item) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (viewOf(item) === 'lunar') {
    const ref = lrRef(item)
    if (!ref) return ''
    for (let y = today.getFullYear(); y <= today.getFullYear() + 1; y++) {
      const useLeap = ref.isLeap && lunarLeapMonth(y) === ref.m
      const iso = lunarToSolarISO(y, ref.m, ref.d, useLeap)
      if (!iso) continue
      const d = new Date(iso)
      d.setHours(0, 0, 0, 0)
      if (d >= today) return iso
    }
    return ''
  }
  const b = new Date(item.birthday)
  const thisYear = new Date(today.getFullYear(), b.getMonth(), b.getDate())
  if (thisYear < today) thisYear.setFullYear(today.getFullYear() + 1)
  const p = (n) => String(n).padStart(2, '0')
  return thisYear.getFullYear() + '-' + p(thisYear.getMonth() + 1) + '-' + p(thisYear.getDate())
}

// 切换卡片显示历法
function toggleView(b) {
  cardView[b.id] = viewOf(b) === 'lunar' ? 'solar' : 'lunar'
}


// 出生至今总天数
function totalDays(iso) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

// 距下一个生日还有多少天
// 农历视图：无论生日按哪种历法保存，都取农历月日，按今年/明年农历同日滚动
// 阳历视图：按存储公历的月日
function lrRef(item) {
  const lr = lunarStore[item.id]
  if (lr) return { m: lr.m, d: lr.d, isLeap: !!lr.isLeap }
  const [yy, mm, dd] = item.birthday.split('-').map(Number)
  const sol = solarToLunar(yy, mm, dd)
  return sol ? { m: sol.month, d: sol.day, isLeap: sol.isLeap } : null
}
function nextBirthdayIn(item) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (viewOf(item) === 'lunar') {
    const ref = lrRef(item)
    if (!ref) return null
    const y0 = today.getFullYear()
    for (let y = y0; y <= y0 + 1; y++) {
      // 闰月生日：目标年无该闰月则按普通月处理
      const useLeap = ref.isLeap && lunarLeapMonth(y) === ref.m
      const iso = lunarToSolarISO(y, ref.m, ref.d, useLeap)
      if (!iso) continue
      const d = new Date(iso)
      d.setHours(0, 0, 0, 0)
      if (d >= today) return Math.round((d - today) / 86400000)
    }
    return null
  }
  const b = new Date(item.birthday)
  const thisYear = new Date(today.getFullYear(), b.getMonth(), b.getDate())
  if (thisYear < today) thisYear.setFullYear(today.getFullYear() + 1)
  return Math.round((thisYear - today) / 86400000)
}

// 农历口径年龄：每年农历生日 +1 岁（连续小数 = 已满农历周岁 + 距上次农历生日的进度）
// 与阳历口径（calcAgeLocal）的区别：周岁增长节点在农历生日，而非公历生日
function lunarAgeLocal(item) {
  const ref = lrRef(item)
  if (!ref) return null
  const now = new Date()
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  // 出生农历年（按出生记录的公历转农历）
  const [yy, mm, dd] = item.birthday.split('-').map(Number)
  const birthLunar = solarToLunar(yy, mm, dd)
  if (!birthLunar) return null
  const birthYear = birthLunar.year
  // 当前农历年
  const cur = solarToLunar(today.getFullYear(), today.getMonth() + 1, today.getDate())
  if (!cur) return null
  const curYear = cur.year
  // 今年农历生日对应公历
  const useLeapThis = ref.isLeap && lunarLeapMonth(curYear) === ref.m
  const thisBD = lunarToSolar(curYear, ref.m, ref.d, useLeapThis)
  if (!thisBD) return null
  const thisBDTime = new Date(thisBD.year, thisBD.month - 1, thisBD.day).getTime()
  let whole, lastBDTime, nextBDTime
  if (thisBDTime <= today.getTime()) {
    // 今年农历生日已过：已满 curYear - birthYear 周岁，进度从今年农历生日起算
    whole = curYear - birthYear
    lastBDTime = thisBDTime
    const useLeapNext = ref.isLeap && lunarLeapMonth(curYear + 1) === ref.m
    const nextBD = lunarToSolar(curYear + 1, ref.m, ref.d, useLeapNext)
    nextBDTime = nextBD ? new Date(nextBD.year, nextBD.month - 1, nextBD.day).getTime() : lastBDTime + 354 * 86400000
  } else {
    // 今年农历生日未到：上个农历生日在去年，未满 curYear - 1 - birthYear ... 实际已满 curYear - birthYear - 1
    whole = curYear - birthYear - 1
    const useLeapLast = ref.isLeap && lunarLeapMonth(curYear - 1) === ref.m
    const lastBD = lunarToSolar(curYear - 1, ref.m, ref.d, useLeapLast)
    lastBDTime = lastBD ? new Date(lastBD.year, lastBD.month - 1, lastBD.day).getTime() : thisBDTime - 354 * 86400000
    nextBDTime = thisBDTime
  }
  const frac = (now.getTime() - lastBDTime) / (nextBDTime - lastBDTime)
  return whole + Math.min(Math.max(frac, 0), 1)
}

function tick() {
  // 每秒刷新；农历视图按农历口径（每年农历生日 +1 岁），阳历视图按公历口径
  const o = {}
  for (const b of list.value) {
    const v = viewOf(b) === 'lunar' ? lunarAgeLocal(b) : calcAgeLocal(b.birthday)
    o[b.id] = v == null ? '' : v.toFixed(8)
  }
  ages.value = o
}

async function load() {
  loading.value = true
  try {
    list.value = await getBirthdayList()
  } catch (e) {
    showToast(e.message || '获取生日列表失败')
  }
  loading.value = false
  // 本地农历标记只对仍存在的生日有效，清理孤儿记录
  const ids = new Set(list.value.map((b) => String(b.id)))
  Object.keys(lunarStore).forEach((k) => {
    if (!ids.has(k)) delete lunarStore[k]
  })
  persistLunarStore()
  // 年龄由前端本地计算（tick 每秒刷新），不依赖后端 /age 接口
}

async function onSave() {
  if (!birthDate.value) {
    showToast('请选择生日日期')
    return
  }
  if (birthDate.value > todayStr()) {
    showToast('生日不能晚于今天')
    return
  }
  // 生日只传年月日（YYYY-MM-DD），时刻由后端统一处理
  try {
    const saved = await saveBirthday({ birthday: birthDate.value })
    // 农历生日：记住 id → 农历年月日（后续按农历显示/滚动员计算）
    if (calendarType.value === 'lunar') {
      lunarStore[saved.id] = { y: +selLYear.value, m: +selLMonth.value, d: +selLDay.value }
    } else {
      delete lunarStore[saved.id]
    }
    persistLunarStore()
    showToast(calendarType.value === 'lunar' ? '农历生日已保存' : '生日已保存')
    selYear.value = ''
    selMonth.value = ''
    selDay.value = ''
    selLYear.value = ''
    selLMonth.value = ''
    selLDay.value = ''
    await load()
    tick()
  } catch (e) {
    showToast(e.message || '保存失败，请重试')
  }
}

async function onDelete(id) {
  try {
    await deleteBirthday(id)
    delete lunarStore[id]
    delete cardView[id]
    persistLunarStore()
    showToast('已删除')
    await load()
  } catch (e) {
    showToast(e.message || '删除失败，请重试')
  }
}

let timer = 0
onMounted(async () => {
  loadLunarStore()
  await load()
  tick()
  timer = setInterval(tick, 1000)
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="age-page mx-auto max-w-4xl px-5 py-10 sm:py-14">
    <!-- 页头 -->
    <header class="mb-8">
      <p class="text-[10px] font-bold uppercase tracking-[0.45em]" style="color: var(--ink-mute)">
        &middot; Age Calculator &middot;
      </p>
      <h1 class="mt-2 font-display text-3xl font-semibold leading-none tracking-tight sm:text-4xl" style="color: var(--ink)">
        年龄<span style="color: var(--rose-500)">计算器</span>
      </h1>
      <p class="mt-2 text-sm" style="color: var(--ink-soft)">
        输入生日，精确到小数点后 8 位 —— 每一秒都被认真计数
      </p>
      <div class="flourish mt-4 w-48 sm:w-60" aria-hidden="true">✦</div>
    </header>

    <!-- 录入表单：列表为空才显示；有生日后隐藏，删光后再出现 -->
    <form
      v-if="!list.length"
      class="card mb-8 flex flex-col gap-4 p-6 sm:flex-row sm:items-end sm:gap-5"
      @submit.prevent="onSave"
    >
      <div class="flex flex-1 flex-col gap-1.5">
        <!-- 历法切换：阳历 / 农历 -->
        <div class="calendar-switch" role="tablist" aria-label="选择历法">
          <button
            type="button"
            role="tab"
            :aria-selected="calendarType === 'solar'"
            :class="{ on: calendarType === 'solar' }"
            @click="calendarType = 'solar'"
          >阳历</button>
          <button
            type="button"
            role="tab"
            :aria-selected="calendarType === 'lunar'"
            :class="{ on: calendarType === 'lunar' }"
            @click="calendarType = 'lunar'"
          >农历</button>
        </div>

        <!-- 阳历：年 / 月 / 日 -->
        <div v-if="calendarType === 'solar'" class="flex gap-2.5">
          <label class="date-select">
            <span class="date-select__arrow" aria-hidden="true">▾</span>
            <select v-model="selYear">
              <option value="">年</option>
              <option v-for="y in yearList" :key="y" :value="y">{{ y }} 年</option>
            </select>
          </label>
          <label class="date-select">
            <span class="date-select__arrow" aria-hidden="true">▾</span>
            <select v-model="selMonth">
              <option value="">月</option>
              <option v-for="m in monthList" :key="m" :value="m">{{ m }} 月</option>
            </select>
          </label>
          <label class="date-select">
            <span class="date-select__arrow" aria-hidden="true">▾</span>
            <select v-model="selDay">
              <option value="">日</option>
              <option v-for="d in dayList" :key="d" :value="d">{{ d }} 日</option>
            </select>
          </label>
        </div>

        <!-- 农历：年 / 月 / 日（保存时自动转为公历） -->
        <div v-else class="flex gap-2.5">
          <label class="date-select">
            <span class="date-select__arrow" aria-hidden="true">▾</span>
            <select v-model="selLYear">
              <option value="">年</option>
              <option v-for="y in lunarYearList" :key="y" :value="y">{{ y }} 年</option>
            </select>
          </label>
          <label class="date-select">
            <span class="date-select__arrow" aria-hidden="true">▾</span>
            <select v-model="selLMonth">
              <option value="">月</option>
              <option v-for="m in lunarMonthList" :key="m" :value="m">{{ m }} 月</option>
            </select>
          </label>
          <label class="date-select">
            <span class="date-select__arrow" aria-hidden="true">▾</span>
            <select v-model="selLDay">
              <option value="">日</option>
              <option v-for="d in lunarDayList" :key="d" :value="d">{{ d }} 日</option>
            </select>
          </label>
        </div>

        <!-- 农历提示：农历按农历算，每年跟随农历日 -->
        <span v-if="calendarType === 'lunar'" class="text-[10px]" style="color: var(--ink-soft)">
          农历生日按农历计算：每年以当年（今年/明年）的农历同日过生日；保存后可切换农历 / 阳历显示
        </span>
      </div>

      <button
        type="submit"
        class="shrink-0 rounded-full px-7 py-3 text-sm font-bold text-white transition-transform duration-300 hover:scale-[1.03] active:scale-[0.97]"
        style="background: linear-gradient(135deg, var(--rose-500), var(--rose-600)); box-shadow: 0 8px 22px rgba(192, 61, 108, 0.32)"
      >
        保存并计算
      </button>
    </form>

    <!-- 加载中 -->
    <div v-if="loading" class="grid min-h-[40vh] place-items-center">
      <p class="text-sm tracking-[0.3em]" style="color: var(--ink-mute)">加载中…</p>
    </div>

    <!-- 空状态 -->
    <div v-else-if="!list.length" class="grid min-h-[40vh] place-items-center text-center">
      <div>
        <div class="mx-auto text-5xl" aria-hidden="true">🎂</div>
        <h3 class="mt-6 text-xl font-black" style="color: var(--ink)">还没有保存生日</h3>
        <p class="mt-2 text-sm" style="color: var(--ink-soft)">选好年月日，保存后即可看到精确到 8 位小数的年龄</p>
      </div>
    </div>

    <!-- 年龄卡片 -->
    <div v-else class="flex flex-col gap-6">
      <div v-for="b in list" :key="b.id" class="card group relative overflow-hidden p-8 sm:p-12">
        <!-- 右上角删除 -->
        <button
          class="absolute right-5 top-5 grid h-9 w-9 place-items-center rounded-full text-sm opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style="color: var(--ink-mute); background: rgba(255, 255, 255, 0.5)"
          aria-label="删除"
          @click="onDelete(b.id)"
        >
          ✕
        </button>

        <div class="flex items-center gap-3">
          <span class="text-3xl" aria-hidden="true">🎂</span>
          <span class="text-xs font-bold uppercase tracking-[0.3em]" style="color: var(--ink-mute)">
            Birthday
          </span>
          <!-- 按农历保存的生日：显示农历徽章 -->
          <span
            v-if="lunarStore[b.id]"
            class="text-[10px] font-bold px-2.5 py-1 rounded-full"
            style="color: var(--rose-600); background: rgba(183, 110, 121, 0.12)"
          >农历</span>
          <!-- 阳历生日当前切到农历视图时：显示转换徽章 -->
          <span
            v-else-if="viewOf(b) === 'lunar'"
            class="text-[10px] font-bold px-2.5 py-1 rounded-full"
            style="color: var(--ink-mute); background: rgba(61, 74, 92, 0.08)"
          >阳历转农历</span>
        </div>
        <div class="mt-2 flex flex-wrap items-center gap-3">
          <p class="font-display text-xl font-semibold sm:text-2xl" style="color: var(--ink)">
            {{ cardDateText(b) }}
          </p>
          <button type="button" class="view-toggle" @click="toggleView(b)">
            {{ viewOf(b) === 'lunar' ? '切到阳历' : '切到农历' }}
          </button>
        </div>

        <!-- 巨型年龄数字：每秒刷新 -->
        <div class="mt-5">
          <span
            class="age-num block font-display font-semibold leading-none tabular"
            :class="ages[b.id] ? 'text-gilt' : ''"
          >
            {{ ages[b.id] || '…' }}
          </span>
          <span class="mt-2 block text-[11px] font-bold uppercase tracking-[0.45em]" style="color: var(--ink-mute)">
            Years old
          </span>
        </div>

        <!-- 次级数据 -->
        <div
          class="mt-6 flex flex-wrap gap-x-8 gap-y-2 border-t pt-4 text-sm"
          style="border-color: var(--hairline); color: var(--ink-soft)"
        >
          <span>已度过 <b style="color: var(--ink)">{{ totalDays(b.birthday) }}</b> 天</span>
          <span v-if="viewOf(b) === 'lunar' && nextBirthdayISO(b)" class="text-xs" style="color: var(--rose-500)">
            下一个生日：{{ nextBirthdayISO(b) }}
          </span>
          <span>距下一个生日 <b style="color: var(--ink)">{{ nextBirthdayIn(b) ?? '—' }}</b> 天</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.age-num {
  font-size: clamp(3rem, 10vw, 6.5rem);
  line-height: 1;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.015em;
}

/* 历法切换：阳历 / 农历（雾蓝玻璃胶囊） */
.calendar-switch {
  display: inline-flex;
  align-self: flex-start;
  gap: 2px;
  padding: 3px;
  border-radius: 999px;
  background: rgba(226, 233, 242, 0.65);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.7);
}
.calendar-switch button {
  padding: 5px 14px;
  border: none;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: rgba(61, 74, 92, 0.75);
  background: transparent;
  cursor: pointer;
  transition: all 0.25s var(--ease-out);
}
.calendar-switch button.on {
  background: linear-gradient(135deg, #e6b0bb, #cf8ba0);
  color: #fff;
  box-shadow: 0 4px 12px rgba(183, 110, 121, 0.35);
}

/* 卡片内历法切换小按钮 */
.view-toggle {
  padding: 4px 12px;
  border: 1px solid rgba(183, 110, 121, 0.35);
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--rose-600);
  background: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: all 0.22s var(--ease-out);
}
.view-toggle:hover {
  background: rgba(183, 110, 121, 0.1);
  box-shadow: 0 3px 10px rgba(183, 110, 121, 0.18);
}

/* 年月日三联动下拉（玻璃质感，替代日历弹窗） */
.date-select {
  position: relative;
  flex: 1 1 0;
  min-width: 0;
}
.date-select select {
  width: 100%;
  appearance: none;
  -webkit-appearance: none;
  border: 1px solid var(--hairline);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: 0 4px 18px rgba(24, 34, 54, 0.06);
  padding: 10px 30px 10px 14px;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--ink);
  cursor: pointer;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.date-select select:hover {
  border-color: rgba(183, 110, 121, 0.5);
}
.date-select select:focus {
  border-color: var(--rose-400, #d2919b);
  box-shadow: 0 0 0 3px rgba(183, 110, 121, 0.18);
}
.date-select__arrow {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  font-size: 0.8rem;
  color: var(--ink-mute);
}
</style>
