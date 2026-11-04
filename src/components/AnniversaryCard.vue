<script setup>
import { ref, computed, watch } from 'vue'
import { formatDateCN, weekdayCN, daysUntil } from '@/utils/date'
import { getTypeMeta } from '@/constants/anniversary'
import { lunarDateCN, lunarToSolarISO, solarToLunar, lunarDaysUntil } from '@/utils/lunar'

const props = defineProps({
  item: {
    type: Object,
    required: true
  }
})

const typeMeta = computed(() => getTypeMeta(props.item.type))

// 纪念日本地视图（'lunar' | 'solar'）：按农历保存的默认显示农历，
// 阳历保存的也可切到农历即时转换查看（固定转换，不滚动）
const lunarRef = computed(() => props.item.lunarRef || null)
const view = ref(lunarRef.value ? 'lunar' : 'solar')
watch(lunarRef, (lr) => {
  if (lr && view.value === 'solar') view.value = 'lunar'
})
function toggleView() {
  view.value = view.value === 'lunar' ? 'solar' : 'lunar'
}

// 主日期文案：农历视图显示农历日期（有农历记录用记录；阳历记录即时转换），否则显示公历
const dateText = computed(() => {
  if (view.value !== 'lunar') return formatDateCN(props.item.date)
  const lr = lunarRef.value
  if (lr) return lunarDateCN(lr.y, lr.m, lr.d)
  const [yy, mm, dd] = (props.item.date || '').split('-').map(Number)
  const sol = solarToLunar(yy, mm, dd)
  return sol ? lunarDateCN(sol.year, sol.month, sol.day, sol.isLeap) : formatDateCN(props.item.date)
})
// 倒计时跟随视图：农历记录→农历视图按农历同日滚动、阳历视图按公历同日滚动；
// 阳历记录两种视图都按公历（农历为纯查看转换）
const viewCountdown = computed(() => {
  const lr = lunarRef.value
  if (lr && view.value === 'lunar') return lunarDaysUntil(lr, props.item.isYearly)
  if (lr && view.value === 'solar') return daysUntil(props.item.date, props.item.isYearly)
  return props.item.countdown
})

// 农历视图下今年/明年农历同日对应公历（仅按农历保存的提示用）
const thisYearLunar = computed(() => {
  const lr = lunarRef.value
  if (!lr || view.value !== 'lunar') return ''
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const y0 = today.getFullYear()
  for (let y = y0; y <= y0 + 1; y++) {
    const iso = lunarToSolarISO(y, lr.m, lr.d)
    if (!iso) continue
    const d = new Date(iso)
    d.setHours(0, 0, 0, 0)
    if (d >= today) return iso
  }
  return ''
})

// 主展示数字与文案
const highlight = computed(() => {
  const cd = viewCountdown.value
  if (cd === 0) return { num: '就是今天', label: '快送上祝福吧 🎉' }
  if (props.item.isYearly && cd !== null) return { num: cd, label: '天后到来' }
  return { num: props.item.passed, label: '天啦' }
})

// 「就是今天」这类文字型高亮需要更小的字号，避免撑破卡片
const isTextHighlight = computed(() => typeof highlight.value.num === 'string')

const accentStyle = computed(() => ({
  '--accent': props.item.color || 'var(--rose-400)'
}))
</script>

<template>
  <router-link
    :to="`/detail/${item.id}`"
    class="ann-card"
    :class="{ 'has-bg': item.bgImage }"
    :style="accentStyle"
  >
    <!-- 自定义背景图 -->
    <template v-if="item.bgImage">
      <div
        class="card-bgimg"
        :style="{ backgroundImage: `url('${item.bgImage}')` }"
      ></div>
      <div class="card-bgmask"></div>
    </template>

    <!-- 悬停浮现的四角画廊取景框 -->
    <span class="card-corners" aria-hidden="true"><i></i><i></i><i></i><i></i></span>

    <div class="icon-bubble">
      <span>{{ item.icon || typeMeta.icon }}</span>
    </div>

    <div class="info">
      <h3 class="title">{{ item.title }}</h3>
      <div class="sub-row">
        <span class="type-chip">{{ typeMeta.label }}</span>
        <span class="date">
          <template v-if="view === 'lunar'">
            {{ dateText }}
            <span v-if="lunarRef" class="date-weekday lunar-badge">农历</span>
            <span v-else class="date-weekday lunar-badge solar-badge">阳历转农历</span>
          </template>
          <template v-else>
            {{ dateText }}<span class="date-weekday"> · {{ weekdayCN(item.date) }}</span>
          </template>
        </span>
      </div>
      <p v-if="lunarRef && view === 'lunar' && thisYearLunar" class="lunar-note">
        今年农历同日：{{ thisYearLunar }}
      </p>
    </div>
    <!-- 历法切换：所有纪念日可切农历/阳历查看（阻止冒泡，不跳详情） -->
    <button type="button" class="view-toggle" @click.prevent.stop="toggleView">
      {{ view === 'lunar' ? '切到阳历' : '切到农历' }}
    </button>

    <div class="highlight">
      <span class="num" :class="{ 'is-text': isTextHighlight }">{{ highlight.num }}</span>
      <span class="label">{{ highlight.label }}</span>
    </div>
  </router-link>
</template>

<style scoped>
.ann-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 13px;
  padding: 18px;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: 22px;
  box-shadow: var(--shadow-xs), var(--glass-edge);
  overflow: hidden;
  transition: transform var(--dur-base) var(--ease-out),
    box-shadow var(--dur-base) ease, border-color var(--dur-base) ease;
}

/* 顶部内高光发丝线 */
.ann-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.7), transparent);
  z-index: 2;
}

/* 四角描边：悬停时浮现的画廊取景框 */
.card-corners {
  position: absolute;
  inset: 9px;
  z-index: 3;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.4s ease;
}
.ann-card:hover .card-corners {
  opacity: 1;
}
.card-corners i {
  position: absolute;
  width: 13px;
  height: 13px;
  border-color: rgba(255, 255, 255, 0.85);
  box-shadow: 0 0 6px rgba(255, 255, 255, 0.3);
}
.card-corners i:nth-child(1) {
  top: 0;
  left: 0;
  border-top: 1.5px solid;
  border-left: 1.5px solid;
}
.card-corners i:nth-child(2) {
  top: 0;
  right: 0;
  border-top: 1.5px solid;
  border-right: 1.5px solid;
}
.card-corners i:nth-child(3) {
  bottom: 0;
  left: 0;
  border-bottom: 1.5px solid;
  border-left: 1.5px solid;
}
.card-corners i:nth-child(4) {
  bottom: 0;
  right: 0;
  border-bottom: 1.5px solid;
  border-right: 1.5px solid;
}

/* 有自定义背景图 */
.ann-card.has-bg {
  background: #2e212c;
  border-color: transparent;
}

.ann-card.has-bg::before {
  display: none;
}

.card-bgimg,
.card-bgmask {
  position: absolute;
  inset: 0;
  z-index: 0;
}

.card-bgimg {
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

/* 横向遮罩：左侧（文字区）更深，保证长标题与日期可读 */
.card-bgmask {
  background:
    linear-gradient(
      100deg,
      rgba(38, 23, 34, 0.84) 0%,
      rgba(38, 23, 34, 0.62) 42%,
      rgba(38, 23, 34, 0.34) 74%,
      rgba(38, 23, 34, 0.52) 100%
    ),
    linear-gradient(0deg, rgba(30, 16, 27, 0.32) 0%, rgba(30, 16, 27, 0) 62%);
}

/* 内容浮于背景层之上 */
.icon-bubble,
.info,
.highlight {
  position: relative;
  z-index: 1;
}

/* 农历徽章与提示 */
.lunar-badge {
  margin-left: 6px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  color: var(--rose-600);
  background: rgba(183, 110, 121, 0.12);
}
.lunar-badge.solar-badge {
  color: var(--ink-mute);
  background: rgba(61, 74, 92, 0.08);
}
.lunar-note {
  margin-top: 2px;
  font-size: 11px;
  color: var(--ink-soft);
}
/* 卡片内历法切换小按钮 */
.view-toggle {
  flex-shrink: 0;
  align-self: flex-start;
  padding: 4px 12px;
  border: 1px solid rgba(183, 110, 121, 0.35);
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--rose-600);
  background: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.25s var(--ease-out);
  z-index: 4;
}
.view-toggle:hover {
  background: var(--rose-500);
  border-color: var(--rose-500);
  color: #fff;
}

/* 右上角装饰圆（无背景图时） */
.ann-card::after {
  content: '';
  position: absolute;
  right: -34px;
  top: -34px;
  width: 96px;
  height: 96px;
  border-radius: 50%;
  background: var(--accent, var(--rose-400));
  opacity: 0.06;
}

.ann-card.has-bg::after {
  display: none;
}

.ann-card:active {
  transform: scale(0.985);
}

.ann-card:focus-visible {
  outline: 2px solid var(--rose-500);
  outline-offset: 3px;
}

@media (hover: hover) {
  .ann-card:hover {
    transform: translateY(-3px);
    border-color: var(--rose-200);
    box-shadow: var(--shadow-md);
  }

  .ann-card:hover .icon-bubble {
    transform: scale(1.05) rotate(-3deg);
  }
}

/* === 图标 === */
.icon-bubble {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 16px;
  font-size: 26px;
  background: color-mix(in srgb, var(--accent, var(--rose-400)) 12%, white);
  transition: transform var(--dur-slow) var(--ease-out);
}

.has-bg .icon-bubble {
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

/* === 文案 === */
.info {
  flex: 1;
  min-width: 0;
}

.title {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 15.5px;
  font-weight: 700;
  line-height: 1.35;
  letter-spacing: 0.2px;
  color: var(--ink);
}

.has-bg .title {
  color: #fff;
  text-shadow: 0 1px 10px rgba(24, 8, 18, 0.45);
}

.sub-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  margin-top: 7px;
  min-width: 0;
}

.type-chip {
  flex-shrink: 0;
  padding: 2px 9px;
  border-radius: var(--radius-full);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.5px;
  color: var(--accent, var(--rose-600));
  border: 1px solid color-mix(in srgb, var(--accent, var(--rose-400)) 26%, transparent);
  background: color-mix(in srgb, var(--accent, var(--rose-400)) 8%, white);
}

.has-bg .type-chip {
  color: #fff;
  border-color: rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.2);
}

.date {
  min-width: 0;
  font-size: 11.5px;
  letter-spacing: 0.2px;
  color: var(--ink-mute);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.has-bg .date {
  color: rgba(255, 255, 255, 0.84);
}

/* === 右侧高亮数字：衬线体 === */
.highlight {
  flex: 0 1 auto;
  min-width: 0;
  max-width: 42%;
  text-align: right;
}

.num {
  display: block;
  font-family: var(--font-display);
  font-size: 24px;
  font-weight: 700;
  line-height: 1.08;
  letter-spacing: -0.01em;
  color: var(--rose-600);
  font-variant-numeric: tabular-nums;
}

.num.is-text {
  font-family: var(--font-sans);
  font-size: 16px;
  letter-spacing: 0;
}

.has-bg .num {
  color: #fff;
  text-shadow: 0 1px 10px rgba(24, 8, 18, 0.45);
}

.label {
  display: block;
  margin-top: 3px;
  font-size: 11px;
  line-height: 1.3;
  color: var(--ink-mute);
}

.has-bg .label {
  color: rgba(255, 255, 255, 0.84);
}

/* ============================================
   响应式断点
   ============================================ */

/* 超窄屏：收起星期，保证日期单行完整可读 */
@media (max-width: 399px) {
  .date-weekday {
    display: none;
  }
}

/* 小屏手机 (≤360px) */
@media (max-width: 360px) {
  .ann-card {
    padding: 15px 14px;
    gap: 11px;
  }

  .icon-bubble {
    width: 46px;
    height: 46px;
    border-radius: 14px;
    font-size: 22px;
  }

  .title {
    font-size: 14.5px;
  }

  .num {
    font-size: 21px;
  }

  .num.is-text {
    font-size: 15px;
  }

  .type-chip {
    font-size: 10px;
    padding: 2px 7px;
  }

  .date {
    font-size: 11px;
  }

  .label {
    font-size: 10.5px;
  }
}

/* 大屏手机 (≥430px) */
@media (min-width: 430px) {
  .ann-card {
    padding: 19px 20px;
  }

  .icon-bubble {
    width: 54px;
    height: 54px;
  }
}

/* 多列网格（≥680px，与 .card-grid 的列数切换一致）
   列宽变窄后收起星期，让类型标签与日期保持单行 */
@media (min-width: 680px) {
  .date-weekday {
    display: none;
  }
  .ann-card {
    gap: 12px;
    padding: 17px 16px;
  }

  .icon-bubble {
    width: 50px;
    height: 50px;
    border-radius: 15px;
    font-size: 24px;
  }

  .title {
    font-size: 15px;
  }

  .num {
    font-size: 23px;
  }

  .highlight {
    max-width: 38%;
  }
}

/* 桌面双列中等宽度 (≥1080px，1080-1439 区间)：主区网格约 340-430px 宽 */
@media (min-width: 1080px) {
  .ann-card {
    padding: 18px;
  }

  .icon-bubble {
    width: 52px;
    height: 52px;
  }
}

/* 超宽屏两列较宽卡片 (≥1440px)：主区每张约 460px，卡片更舒展充实 */
@media (min-width: 1440px) {
  .ann-card {
    gap: 15px;
    padding: 22px 24px;
  }

  .icon-bubble {
    width: 56px;
    height: 56px;
    border-radius: 17px;
    font-size: 27px;
  }

  .title {
    font-size: 16px;
  }

  .num {
    font-size: 27px;
  }
}
</style>
