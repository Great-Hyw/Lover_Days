<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAnniversaryStore } from '@/stores/anniversary'
import {
  TYPE_OPTIONS,
  ICON_OPTIONS,
  COLOR_OPTIONS
} from '@/constants/anniversary'
import { calculateAgeDetail, daysBetween, todayStr } from '@/utils/date'
import { showToast } from '@/utils/toast'

const route = useRoute()
const router = useRouter()
const store = useAnniversaryStore()

const isEdit = computed(() => !!route.params.id)
const submitting = ref(false)

const form = reactive({
  title: '',
  date: todayStr(),
  type: 'love',
  icon: '💖',
  color: COLOR_OPTIONS[0],
  isYearly: true,
  note: ''
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
})

// 计算所选日期到今天的天数（未来日期提示倒计时）
const dayInfo = computed(() => {
  if (!form.date) return null
  const diff = daysBetween(form.date, new Date())
  if (diff < 0) return { kind: 'future', days: -diff }
  const age = calculateAgeDetail(form.date)
  return { kind: 'past', days: diff, age }
})

// 选择类型时，自动带出默认图标
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
  if (!form.date) {
    showToast('请选择日期')
    return
  }

  submitting.value = true
  try {
    const payload = {
      title: form.title.trim(),
      date: form.date,
      type: form.type,
      icon: form.icon,
      color: form.color,
      isYearly: form.isYearly,
      note: form.note.trim()
    }

    if (isEdit.value) {
      await store.update(route.params.id, payload)
      showToast('修改成功')
    } else {
      await store.add(payload)
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
  <div class="page">
    <header class="nav-bar">
      <button class="back" @click="router.back()">‹</button>
      <h2>{{ isEdit ? '编辑纪念日' : '添加纪念日' }}</h2>
      <span class="placeholder"></span>
    </header>

    <form class="form pop-in" @submit.prevent="onSubmit">
      <!-- 名称 -->
      <label class="field">
        <span class="label">纪念日名称 <i>*</i></span>
        <input
          v-model="form.title"
          type="text"
          maxlength="20"
          placeholder="例如：我们在一起啦"
        />
      </label>

      <!-- 日期 -->
      <label class="field">
        <span class="label">日期 <i>*</i></span>
        <input v-model="form.date" type="date" :max="todayStr()" />
        <p v-if="dayInfo" class="day-hint">
          <template v-if="dayInfo.kind === 'future'">
            ⏳ 距离这一天还有 <strong>{{ dayInfo.days }}</strong> 天
          </template>
          <template v-else>
            💗 已经过去 <strong>{{ dayInfo.days }}</strong> 天
            <span v-if="dayInfo.age && dayInfo.days > 0" class="day-detail">
              （{{ dayInfo.age.years }} 年 {{ dayInfo.age.months }} 个月 {{ dayInfo.age.days }} 天）
            </span>
          </template>
        </p>
      </label>

      <!-- 类型 -->
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
            <span>{{ t.icon }}</span>
            {{ t.label }}
          </button>
        </div>
      </div>

      <!-- 图标 -->
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

      <!-- 颜色 -->
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

      <!-- 每年循环 -->
      <div class="field row-field">
        <span class="label">每年重复提醒</span>
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

      <!-- 备注 -->
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
.nav-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0 18px;
}

.nav-bar h2 {
  font-size: 18px;
  font-weight: 700;
}

.back {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--white);
  box-shadow: var(--shadow-sm);
  font-size: 22px;
  color: var(--text);
  line-height: 1;
}

.placeholder {
  width: 36px;
}

.form {
  background: var(--white);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  padding: 22px 18px;
}

.field {
  display: block;
  margin-bottom: 22px;
}

.row-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 10px;
}

.row-field .label {
  margin-bottom: 0;
}

.label i {
  color: var(--pink);
  font-style: normal;
}

.field input[type='text'],
.field input[type='date'],
.field textarea {
  width: 100%;
  border: 1.5px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 12px 14px;
  background: #fdfafc;
  color: var(--text);
  outline: none;
  transition: border-color 0.2s;
}

.field textarea {
  resize: none;
}

.field input:focus,
.field textarea:focus {
  border-color: var(--pink-light);
}

/* 类型 chips */
.chip-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 4px;
  border-radius: var(--radius-sm);
  border: 1.5px solid var(--border);
  background: #fff;
  font-size: 12px;
  color: var(--text-secondary);
  transition: all 0.2s;
}

.chip span {
  font-size: 19px;
}

.chip.active {
  border-color: var(--chip-color, var(--pink));
  color: var(--chip-color, var(--pink));
  background: color-mix(in srgb, var(--chip-color, var(--pink)) 8%, white);
  font-weight: 600;
}

/* 图标 */
.icon-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 6px;
}

.icon-item {
  aspect-ratio: 1;
  border-radius: 10px;
  font-size: 18px;
  border: 1.5px solid transparent;
  transition: all 0.15s;
}

.icon-item.active {
  border-color: var(--chip-color, var(--pink));
  background: color-mix(in srgb, var(--chip-color, var(--pink)) 12%, white);
  transform: scale(1.08);
}

/* 颜色 */
.color-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.color-item {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  color: #fff;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s;
}

.color-item.active {
  transform: scale(1.18);
  box-shadow: 0 0 0 3px #fff, 0 0 0 5px var(--pink-lighter);
}

/* 开关 */
.switch {
  width: 48px;
  height: 27px;
  border-radius: 999px;
  background: #e6d9e1;
  position: relative;
  transition: background 0.25s;
}

.switch.on {
  background: var(--chip-color, var(--pink));
}

.knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 21px;
  height: 21px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  transition: transform 0.25s;
}

.switch.on .knob {
  transform: translateX(21px);
}

.day-hint {
  margin-top: 8px;
  font-size: 12.5px;
  color: var(--text-secondary);
}

.day-hint strong {
  color: var(--pink);
  font-weight: 700;
}

.day-detail {
  color: var(--text-secondary);
}

.submit {
  margin-top: 6px;
}
</style>
