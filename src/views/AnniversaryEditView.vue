<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAnniversaryStore } from '@/stores/anniversary'
import { TYPE_OPTIONS, ICON_OPTIONS, COLOR_OPTIONS } from '@/constants/anniversary'
import { calculateAgeDetail, daysBetween, todayStr } from '@/utils/date'
import { showToast } from '@/utils/toast'
import { lunarMonthDayCount, lunarToSolarISO, lunarDateCN, solarToLunar, lunarLeapMonth } from '@/utils/lunar'
import { getLunarRef, setLunarRef } from '@/utils/lunarStorage'

const route = useRoute()
const router = useRouter()
const store = useAnniversaryStore()
const isEdit = computed(() => !!route.params.id)
const submitting = ref(false)

const form = reactive({
  title: '',
  date: todayStr(),
  type: 'love',
  icon: '\uD83D\uDC96',
  color: COLOR_OPTIONS[0],
  isYearly: true,
  note: ''
})

// —— 年/月/日 三栏下拉（独立 ref，选完立即写回 form.date） ——
const today = new Date()
const CURRENT_YEAR = today.getFullYear()
const YEAR_RANGE = 100

function parseDate(str) {
  if (!str) return { y: CURRENT_YEAR, m: today.getMonth() + 1, d: today.getDate() }
  const [y, m, d] = str.split('-').map(Number)
  return { y: y || CURRENT_YEAR, m: m || 1, d: d || 1 }
}

const init = parseDate(form.date)
const dateY = ref(init.y)
const dateM = ref(init.m)
const dateD = ref(init.d)

const yearList = computed(() => {
  const arr = []
  for (let y = CURRENT_YEAR - YEAR_RANGE; y <= CURRENT_YEAR + 10; y++) arr.push(y)
  return arr
})
const monthList = computed(() => Array.from({ length: 12 }, (_, i) => i + 1))
const dayList = computed(() => {
  const max = new Date(dateY.value, dateM.value, 0).getDate()
  return Array.from({ length: max }, (_, i) => i + 1)
})

watch([dateY, dateM, dateD], () => {
  const max = new Date(dateY.value, dateM.value, 0).getDate()
  if (dateD.value > max) dateD.value = max
  const mm = String(dateM.value).padStart(2, '0')
  const dd = String(dateD.value).padStart(2, '0')
  form.date = `${dateY.value}-${mm}-${dd}`
})

// —— 阳历 / 农历 输入切换（保存时农历转公历，接口契约不变） ——
const calendarType = ref('solar') // 'solar' | 'lunar'
const selLYear = ref(0)
const selLMonth = ref(0)
const selLDay = ref(0)
// 农历年：与年龄页一致，1900-2100
const lunarYearList = computed(() => {
  const arr = []
  for (let y = 1900; y <= 2100; y++) arr.push(y)
  return arr
})
const lunarMonthList = computed(() => Array.from({ length: 12 }, (_, i) => i + 1))
const lunarDayList = computed(() => {
  if (!selLYear.value || !selLMonth.value) return []
  const max = lunarMonthDayCount(selLYear.value, selLMonth.value)
  return Array.from({ length: max }, (_, i) => i + 1)
})
// 切换输入方式：切到农历时，用当前阳历选择自动转成农历预填，方便微调
function switchCalendar(t) {
  calendarType.value = t
  if (t === 'lunar' && (!selLYear.value || !selLMonth.value || !selLDay.value)) {
    const sol = solarToLunar(dateY.value, dateM.value, dateD.value)
    if (sol) {
      selLYear.value = sol.year
      selLMonth.value = sol.month
      selLDay.value = sol.day
    }
  }
}
// 农历月变化时夹紧日号
watch([selLYear, selLMonth], () => {
  if (!selLYear.value || !selLMonth.value) return
  const max = lunarMonthDayCount(selLYear.value, selLMonth.value)
  if (selLDay.value > max) selLDay.value = max
})

onMounted(async () => {
  if (!isEdit.value) return
  await store.fetchList()
  const item = store.list.find((i) => String(i.id) === String(route.params.id))
  if (!item) {
    showToast('纪念日不存在')
    router.replace('/')
    return
  }
  Object.assign(form, {
    title: item.title,
    date: item.date,
    type: item.type,
    icon: item.icon,
    color: item.color,
    isYearly: item.isYearly,
    note: item.note || ''
  })
  const parts = parseDate(item.date)
  dateY.value = parts.y
  dateM.value = parts.m
  dateD.value = parts.d
  // 按农历保存的纪念日：恢复为农历输入视图
  const lr = getLunarRef(item.id)
  if (lr) {
    calendarType.value = 'lunar'
    selLYear.value = lr.y
    selLMonth.value = lr.m
    selLDay.value = lr.d
  }
})

const dayInfo = computed(() => {
  // 农历模式：先把选择的农历转成公历，提示用转换结果
  let target = form.date
  let lunarText = ''
  if (calendarType.value === 'lunar') {
    if (!selLYear.value || !selLMonth.value || !selLDay.value) return null
    target = lunarToSolarISO(selLYear.value, selLMonth.value, selLDay.value)
    if (!target) return null
    lunarText = lunarDateCN(selLYear.value, selLMonth.value, selLDay.value)
  }
  const diff = daysBetween(target, new Date())
  if (diff < 0) return { kind: 'future', days: -diff, lunarText }
  const age = calculateAgeDetail(target)
  return { kind: 'past', days: diff, age, lunarText }
})

// 农历选择的即时预览：转换后的公历日期
const lunarPreviewISO = computed(() => {
  if (calendarType.value !== 'lunar' || !selLYear.value || !selLMonth.value || !selLDay.value) return ''
  return lunarToSolarISO(selLYear.value, selLMonth.value, selLDay.value)
})

function onTypeChange(type) {
  form.type = type
  const meta = TYPE_OPTIONS.find((t) => t.value === type)
  if (meta) form.icon = meta.icon
}

async function onSubmit() {
  if (!form.title.trim()) {
    showToast('请填写纪念日名称')
    return
  }
  // 农历：必选农历年月日，且转为公历存储（接口契约不变）
  let saveDate = form.date
  let lunarRef = null
  if (calendarType.value === 'lunar') {
    if (!selLYear.value || !selLMonth.value || !selLDay.value) {
      showToast('请选择农历日期')
      return
    }
    saveDate = lunarToSolarISO(selLYear.value, selLMonth.value, selLDay.value)
    if (!saveDate) {
      showToast('农历日期无效')
      return
    }
    lunarRef = { y: selLYear.value, m: selLMonth.value, d: selLDay.value }
  } else if (!form.date) {
    showToast('请选择日期')
    return
  }
  submitting.value = true
  try {
    const payload = {
      title: form.title.trim(),
      date: saveDate,
      type: form.type,
      icon: form.icon,
      color: form.color,
      isYearly: form.isYearly,
      note: form.note.trim()
    }
    if (isEdit.value) {
      await store.update(route.params.id, payload)
      if (lunarRef) setLunarRef(route.params.id, lunarRef)
      else setLunarRef(route.params.id, null)
      showToast('修改成功')
    } else {
      const created = await store.add(payload)
      if (lunarRef && created?.id) setLunarRef(created.id, lunarRef)
      showToast('添加成功，要一直幸福哦')
    }
    router.push('/')
  } catch (e) {
    showToast('保存失败，请稍后再试')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="page edit-page">
    <header class="page-nav">
      <button class="back" type="button" aria-label="返回" @click="router.back()">‹</button>
      <h2>{{ isEdit ? '编辑纪念日' : '添加纪念日' }}</h2>
      <span class="placeholder"></span>
    </header>

    <form class="form pop-in" @submit.prevent="onSubmit">
      <div class="form-intro">
        <p class="eyebrow">{{ isEdit ? 'Edit Memory' : 'New Memory' }}</p>
        <p class="hint">填写这一天的名字与故事，把它好好收藏起来</p>
      </div>

      <label class="field">
        <span class="label">纪念日名称 <i>*</i></span>
        <input
          v-model="form.title"
          type="text"
          maxlength="20"
          placeholder="例如：我们在一起啦"
        />
      </label>

      <div class="field">
        <span class="label">日期 <i>*</i></span>
        <div class="calendar-switch">
          <button
            type="button"
            :class="{ on: calendarType === 'solar' }"
            @click="switchCalendar('solar')"
          >阳历</button>
          <button
            type="button"
            :class="{ on: calendarType === 'lunar' }"
            @click="switchCalendar('lunar')"
          >农历</button>
        </div>
        <!-- 阳历三选 -->
        <div v-if="calendarType === 'solar'" class="date-picker">
          <select v-model.number="dateY" class="date-sel">
            <option v-for="y in yearList" :key="y" :value="y">{{ y }}年</option>
          </select>
          <select v-model.number="dateM" class="date-sel">
            <option v-for="m in monthList" :key="m" :value="m">{{ m }}月</option>
          </select>
          <select v-model.number="dateD" class="date-sel">
            <option v-for="d in dayList" :key="d" :value="d">{{ d }}日</option>
          </select>
        </div>
        <!-- 农历三选 -->
        <div v-else class="date-picker">
          <select v-model.number="selLYear" class="date-sel">
            <option v-for="y in lunarYearList" :key="y" :value="y">{{ y }}年</option>
          </select>
          <select v-model.number="selLMonth" class="date-sel">
            <option v-for="m in lunarMonthList" :key="m" :value="m">{{ m }}月</option>
          </select>
          <select v-model.number="selLDay" class="date-sel">
            <option v-for="d in lunarDayList" :key="d" :value="d">{{ d }}日</option>
          </select>
        </div>
        <p v-if="dayInfo" class="day-hint">
          <template v-if="calendarType === 'lunar'">
            <span v-if="lunarPreviewISO">对应公历：<strong>{{ lunarPreviewISO }}</strong> · {{ dayInfo.lunarText }}</span>
          </template>
          <template v-else>
            <template v-if="dayInfo.kind === 'future'">
              距离这一天还有 <strong>{{ dayInfo.days }}</strong> 天
            </template>
            <template v-else>
              已经过去 <strong>{{ dayInfo.days }}</strong> 天
              <span v-if="dayInfo.age && dayInfo.days > 0" class="day-detail">
                （{{ dayInfo.age.years }} 年 {{ dayInfo.age.months }} 个月 {{ dayInfo.age.days }} 天）
              </span>
            </template>
          </template>
        </p>
        <p v-if="calendarType === 'lunar' && lunarPreviewISO" class="day-hint lunar-hint">
          每年按农历这天过；保存后可切换农历 / 阳历显示
        </p>
      </div>

      <div class="field">
        <span class="label">类型</span>
        <div class="chip-grid">
          <button
            v-for="t in TYPE_OPTIONS"
            :key="t.value"
            type="button"
            class="chip"
            :class="{ active: form.type === t.value }"
            :style="form.type === t.value ? { '--chip-color': form.color } : {}"
            @click="onTypeChange(t.value)"
          >
            <span>{{ t.icon }}</span>{{ t.label }}
          </button>
        </div>
      </div>

      <div class="field">
        <span class="label">图标</span>
        <div class="icon-grid">
          <button
            v-for="icon in ICON_OPTIONS"
            :key="icon"
            type="button"
            class="icon-item"
            :class="{ active: form.icon === icon }"
            :style="form.icon === icon ? { '--chip-color': form.color } : {}"
            @click="form.icon = icon"
          >
            {{ icon }}
          </button>
        </div>
      </div>

      <div class="field">
        <span class="label">主题色</span>
        <div class="color-grid">
          <button
            v-for="color in COLOR_OPTIONS"
            :key="color"
            type="button"
            class="color-item"
            :class="{ active: form.color === color }"
            :style="{ background: color }"
            @click="form.color = color"
          >
            <span v-if="form.color === color">✓</span>
          </button>
        </div>
      </div>

      <div class="field row-field">
        <div>
          <span class="label">每年重复提醒</span>
          <p class="switch-hint">到了周年纪念日会自动倒计时</p>
        </div>
        <button
          type="button"
          class="switch"
          :class="{ on: form.isYearly }"
          :style="form.isYearly ? { '--chip-color': form.color } : {}"
          role="switch"
          :aria-checked="form.isYearly"
          @click="form.isYearly = !form.isYearly"
        >
          <span class="knob"></span>
        </button>
      </div>

      <label class="field">
        <span class="label">备注</span>
        <textarea
          v-model="form.note"
          rows="3"
          maxlength="120"
          placeholder="写下这一天的故事…（选填）"
        ></textarea>
      </label>

      <button class="btn btn-primary btn-block submit" type="submit" :disabled="submitting">
        {{ submitting ? '保存中…' : isEdit ? '保存修改' : '添加纪念日' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.edit-page {
  max-width: 640px;
}

.form {
  background: var(--bg-card);
  border: 1px solid var(--hairline);
  border-radius: 24px;
  box-shadow: var(--shadow-sm);
  padding: 26px 22px 24px;
}

.form-intro {
  margin-bottom: 26px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--hairline);
}

.eyebrow {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.32em;
  text-transform: uppercase;
  color: var(--rose-400);
}

.hint {
  margin-top: 8px;
  font-size: 14px;
  color: var(--ink-soft);
  line-height: 1.5;
}

.field {
  display: block;
  margin-bottom: 24px;
}

.row-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.label {
  display: block;
  font-size: 13.5px;
  font-weight: 700;
  margin-bottom: 10px;
  color: var(--ink);
  letter-spacing: 0.02em;
}

.row-field .label {
  margin-bottom: 2px;
}

.label i {
  color: var(--rose-500);
  font-style: normal;
}

.switch-hint {
  font-size: 12px;
  color: var(--ink-mute);
}

.field input[type='text'],
.field textarea {
  width: 100%;
  border: 1.5px solid var(--border);
  border-radius: 14px;
  padding: 13px 15px;
  background: #f6f8fb;
  color: var(--ink);
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
}

.field textarea {
  resize: none;
  line-height: 1.6;
}

.field input:focus,
.field textarea:focus {
  border-color: var(--rose-300);
  background: #fff;
  box-shadow: 0 0 0 3px rgba(204, 75, 121, 0.12);
}

/* 阳历 / 农历切换（雾蓝玻璃胶囊，与年龄页同款） */
.calendar-switch {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  margin-bottom: 10px;
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
.lunar-hint {
  font-size: 12px;
  color: var(--ink-soft);
  margin-top: 4px;
}
.date-picker {
  display: flex;
  gap: 8px;
}

.date-sel {
  flex: 1;
  border: 1.5px solid var(--border);
  border-radius: 14px;
  padding: 12px 8px;
  background: #f6f8fb;
  color: var(--ink);
  font-size: 15px;
  font-weight: 500;
  outline: none;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23b39aa6' d='M6 8.5L1 3h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 28px;
}

.date-sel:focus {
  border-color: var(--rose-300);
  box-shadow: 0 0 0 3px rgba(204, 75, 121, 0.12);
  background-color: #fff;
}

.chip-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 12px 4px;
  border-radius: 14px;
  border: 1.5px solid var(--border);
  background: #fff;
  font-size: 12px;
  color: var(--ink-mute);
  transition: all 0.2s var(--ease-out);
}

.chip span {
  font-size: 20px;
}

.chip.active {
  border-color: var(--chip-color, var(--rose-500));
  color: var(--chip-color, var(--rose-600));
  background: color-mix(in srgb, var(--chip-color, var(--rose-500)) 8%, white);
  font-weight: 700;
  box-shadow: 0 4px 14px color-mix(in srgb, var(--chip-color, var(--rose-500)) 18%, transparent);
}

.icon-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 6px;
}

.icon-item {
  aspect-ratio: 1;
  border-radius: 12px;
  font-size: 18px;
  border: 1.5px solid transparent;
  background: var(--bg-soft);
  transition: all 0.15s ease;
}

.icon-item.active {
  border-color: var(--chip-color, var(--rose-500));
  background: color-mix(in srgb, var(--chip-color, var(--rose-500)) 12%, white);
  transform: scale(1.08);
}

.color-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.color-item {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  color: #fff;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s ease;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.25);
}

.color-item.active {
  transform: scale(1.16);
  box-shadow: 0 0 0 3px #fff, 0 0 0 5px var(--rose-200);
}

.switch {
  width: 50px;
  height: 28px;
  border-radius: 999px;
  background: #e6d9e1;
  position: relative;
  flex-shrink: 0;
  transition: background 0.25s ease;
}

.switch.on {
  background: var(--chip-color, var(--rose-500));
}

.knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.18);
  transition: transform 0.25s var(--ease-out);
}

.switch.on .knob {
  transform: translateX(22px);
}

.day-hint {
  margin-top: 10px;
  font-size: 12.5px;
  color: var(--ink-mute);
  padding: 8px 12px;
  border-radius: 10px;
  background: var(--rose-50);
}

.day-hint strong {
  color: var(--rose-600);
  font-weight: 700;
  font-family: var(--font-display);
  font-size: 1.15em;
}

.day-detail {
  color: var(--ink-mute);
}

.submit {
  margin-top: 4px;
  height: 50px;
  font-size: 15.5px;
}

@media (max-width: 420px) {
  .chip-grid {
    grid-template-columns: repeat(3, 1fr);
  }

  .icon-grid {
    grid-template-columns: repeat(6, 1fr);
  }

  .form {
    padding: 22px 16px 20px;
  }
}
</style>
