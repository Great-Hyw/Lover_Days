<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useAnniversaryStore } from '@/stores/anniversary'
import { formatDateCN, fullYearsPassed, weekdayCN } from '@/utils/date'
import { getTypeMeta } from '@/constants/anniversary'
import { lunarDateCN, lunarToSolarISO, lunarLeapMonth, solarToLunar } from '@/utils/lunar'
import { getLunarRef } from '@/utils/lunarStorage'

/**
 * 首页 —— 结构与原版一致，仅颜色换为暖粉浅色风格。
 * 业务逻辑不变：数据全部来自 Pinia store，
 * 轮播切换 / 触摸滑动 / 跳转详情 / 统计 / 空状态均保留。
 */
const router = useRouter()
const store = useAnniversaryStore()
const { loading, count, decoratedList, upcoming, mainAnniversary } = storeToRefs(store)

onMounted(() => {
  store.fetchList()
})

const years = computed(() =>
  mainAnniversary.value ? fullYearsPassed(mainAnniversary.value.date) : 0
)

// 主卡片农历视图：按农历保存的纪念日默认显示农历日期，可切换
const mainLunarRef = computed(() =>
  mainAnniversary.value ? getLunarRef(mainAnniversary.value.id) : null
)
const mainView = ref(mainLunarRef.value ? 'lunar' : 'solar')
function toggleMainView() {
  mainView.value = mainView.value === 'lunar' ? 'solar' : 'lunar'
}
// 主卡片日期文案：农历视图显示农历日期（有记录用记录；阳历记录即时转换），否则显示公历
const mainDateText = computed(() => {
  if (!mainAnniversary.value) return ''
  if (mainView.value !== 'lunar') return formatDateCN(mainAnniversary.value.date)
  const lr = mainLunarRef.value
  if (lr) return lunarDateCN(lr.y, lr.m, lr.d)
  const [yy, mm, dd] = (mainAnniversary.value.date || '').split('-').map(Number)
  const sol = solarToLunar(yy, mm, dd)
  return sol ? lunarDateCN(sol.year, sol.month, sol.day, sol.isLeap) : formatDateCN(mainAnniversary.value.date)
})
// 主卡片是否为「阳历转农历」查看（无农历记录）
const mainIsSolarToLunar = computed(() => mainView.value === 'lunar' && !mainLunarRef.value)
// 主卡片农历视图下今年/明年农历同日对应公历（提示用）
const mainThisYearLunar = computed(() => {
  const lr = mainLunarRef.value
  if (!lr || mainView.value !== 'lunar' || !mainAnniversary.value) return ''
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const y0 = today.getFullYear()
  for (let y = y0; y <= y0 + 1; y++) {
    const useLeap = lunarLeapMonth(y) === lr.m
    const iso = lunarToSolarISO(y, lr.m, lr.d, useLeap)
    if (!iso) continue
    const d = new Date(iso)
    d.setHours(0, 0, 0, 0)
    if (d >= today) return iso
  }
  return ''
})

const nearCount = computed(() => upcoming.value.filter((i) => i.countdown <= 30).length)

// 主卡片类型标签（相恋日 / 相识日 / 生日 …），来自真实数据
const typeLabel = computed(() => getTypeMeta(mainAnniversary.value?.type).label)

// —— 天数 count-up：仅动显示层，不碰数据 ——
const displayDays = ref(0)
let rafId = null

function animateDays(to) {
  if (rafId) cancelAnimationFrame(rafId)
  const from = displayDays.value
  if (from === to) return
  const t0 = performance.now()
  const dur = 950
  const step = (now) => {
    const p = Math.min(1, (now - t0) / dur)
    // easeOutExpo：先快后缓，大气不拖沓
    const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p)
    displayDays.value = Math.round(from + (to - from) * eased)
    if (p < 1) rafId = requestAnimationFrame(step)
  }
  rafId = requestAnimationFrame(step)
}

watch(
  () => mainAnniversary.value?.passed,
  (v) => animateDays(v ?? 0),
  { immediate: true }
)

onBeforeUnmount(() => {
  if (rafId) cancelAnimationFrame(rafId)
})

// —— 滚动入场：进入视口一次性点亮（纯展示） ——
const vReveal = {
  mounted(el, binding) {
    el.classList.add('reveal')
    if (binding.value) el.style.transitionDelay = `${binding.value}ms`
    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('reveal-in')
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            el.classList.add('reveal-in')
            io.unobserve(el)
          }
        })
      },
      { threshold: 0.12 }
    )
    io.observe(el)
    el._revealIO = io
  },
  unmounted(el) {
    el._revealIO?.disconnect()
  }
}

// —— 主卡片手动切换（与旧版一致） ——
const slideDir = ref('next')
const canSwitch = computed(() => count.value > 1)

const currentIndex = computed(() => {
  if (!mainAnniversary.value) return 0
  return decoratedList.value.findIndex(
    (i) => String(i.id) === String(mainAnniversary.value.id)
  )
})

// 纪念日较多时用计数器代替指示点，避免指示点挤成一条
const showDots = computed(() => decoratedList.value.length <= 8)

function switchCard(dir) {
  if (!canSwitch.value) return
  const len = decoratedList.value.length
  if (!len) return
  slideDir.value = dir
  const idx = currentIndex.value < 0 ? 0 : currentIndex.value
  const nextIdx = dir === 'next' ? (idx + 1) % len : (idx - 1 + len) % len
  store.setMainId(decoratedList.value[nextIdx].id)
}

/** 指示点：直接跳转到某个纪念日 */
function goToIndex(idx) {
  if (idx === currentIndex.value) return
  slideDir.value = idx > currentIndex.value ? 'next' : 'prev'
  store.setMainId(decoratedList.value[idx].id)
}

// 触摸滑动
let touchStartX = 0
let touchStartY = 0
let swipped = false

function onTouchStart(e) {
  touchStartX = e.touches[0].clientX
  touchStartY = e.touches[0].clientY
  swipped = false
}

function onTouchEnd(e) {
  const dx = e.changedTouches[0].clientX - touchStartX
  const dy = e.changedTouches[0].clientY - touchStartY
  if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) {
    swipped = true
    if (dx < 0) switchCard('next')
    else switchCard('prev')
  }
}

// 点击 hero 进详情；刚滑动完产生的 click 要吞掉
function onCardClick() {
  if (swipped) {
    swipped = false
    return
  }
  router.push(`/detail/${mainAnniversary.value.id}`)
}

/** 全部纪念日卡片：错位下沉节奏（桌面端） */
function staggerClass(idx) {
  if (idx % 3 === 1) return 'lg:translate-y-10'
  if (idx % 3 === 2) return 'lg:translate-y-4'
  return ''
}

/** 卡片高亮数字与文案（与旧 AnniversaryCard 逻辑一致，纯展示） */
function highlightOf(item) {
  if (item.countdown === 0) {
    return { num: '就是今天', label: '快送上祝福吧 🎉', isText: true }
  }
  if (item.isYearly && item.countdown !== null) {
    return { num: item.countdown, label: '天后到来', isText: false }
  }
  return { num: item.passed, label: '天啦', isText: false }
}
</script>

<template>
  <div class="home-nouveau relative min-h-screen overflow-hidden">
    <!-- ═══ 背景装饰层：柔光光斑（无网格） ═══ -->
    <div class="pointer-events-none absolute inset-0" aria-hidden="true">
      <div class="blob blob-a animate-float-slow"></div>
      <div class="blob blob-b animate-float-slower"></div>
    </div>

    <div class="relative mx-auto max-w-[1280px] px-5 pb-28 pt-3 sm:px-8 sm:pt-4 lg:px-12 lg:pt-12">
      <!-- 加载中 -->
      <div v-if="loading && !count" class="grid min-h-[60vh] place-items-center">
        <p class="loading-text text-sm tracking-[0.4em]" style="color: var(--ink-mute)">加载中…</p>
      </div>

      <template v-else-if="count">
        <!-- ═══ 顶栏 ═══ -->
        <header v-reveal class="mb-10 flex items-end justify-between gap-6 lg:mb-14">
          <div>

            <p class="text-[11px] font-bold uppercase tracking-[0.5em]" style="color: var(--rose-400)">
              Love&nbsp;Days&nbsp;Archive
            </p>
            <h1 class="mt-3 font-display text-4xl font-semibold leading-none tracking-tight sm:text-5xl" style="color: var(--ink)">
              我们的<span style="color: var(--rose-500)">纪念日</span>
            </h1>
            <p class="mt-3 text-sm" style="color: var(--ink-soft)">
              把相爱的每一天，都好好收藏
            </p>
            <div class="flourish mt-5 w-56 sm:w-72" aria-hidden="true">✦</div>
          </div>

          <!-- 桌面端添加入口（移动端用 FAB） -->
          <router-link
            v-if="count"
            to="/add"
            class="hidden shrink-0 items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white transition duration-300 hover:-translate-y-0.5 active:scale-95 lg:inline-flex"
            style="background: linear-gradient(135deg, var(--rose-500), var(--rose-600)); box-shadow: 0 8px 22px rgba(173,56,96,0.28)"
          >
            <span class="text-base leading-none" aria-hidden="true">＋</span>添加纪念日
          </router-link>
        </header>

        <!-- ═══ HERO：超大标题 + 倾斜照片悬浮 ═══ -->
        <section
          v-if="mainAnniversary"
          v-reveal
          class="relative"
          role="link"
          tabindex="0"
          :aria-label="`查看「${mainAnniversary.title}」详情`"
          @click="onCardClick"
          @keydown.enter.prevent="onCardClick"
          @keydown.space.prevent="onCardClick"
          @touchstart.passive="onTouchStart"
          @touchend.passive="onTouchEnd"
        >
          <Transition mode="out-in" :name="slideDir === 'next' ? 'slide-next' : 'slide-prev'">
            <div :key="mainAnniversary.id" class="hero-grid grid items-center gap-10 lg:grid-cols-[1.12fr_0.88fr] lg:gap-14">
              <!-- 左：巨型字排版 -->
              <div class="relative min-w-0 cursor-pointer">
                <!-- 幽灵描边字：空间感衬底 -->
                <span class="hero-ghost select-none" aria-hidden="true">FOREVER</span>

                <div class="relative">
                  <!-- 小字眉标：编辑风 caps，宽字距 -->
                  <p class="mb-4 text-[10px] font-bold uppercase tracking-[0.45em]" style="color: var(--ink-mute)">
                    &middot; OUR STORY &middot;
                  </p>

                  <!-- 类型徽章 -->
                  <span
                    class="inline-flex -rotate-2 items-center gap-2 rounded-xl px-3.5 py-2 text-[11px] font-black uppercase tracking-[0.3em] text-white shadow-[0_8px_24px_rgba(204,75,121,0.35)]"
                    :style="{ background: 'linear-gradient(120deg, var(--rose-400), var(--rose-600))' }"
                  >
                    <span class="text-base leading-none">{{ mainAnniversary.icon || '💖' }}</span>
                    {{ typeLabel }}
                  </span>

                  <h2
                    class="mt-5 cursor-pointer font-display text-[clamp(2.4rem,6.5vw,4.2rem)] font-semibold leading-[1.06] tracking-tight"
                    style="color: var(--ink)"
                  >
                    {{ mainAnniversary.title }}
                  </h2>

                  <!-- 巨型天数 -->
                  <div class="mt-2 flex items-baseline gap-4">
                    <span
                      class="days-giant text-gilt inline-block cursor-pointer font-display font-semibold leading-none tracking-tighter tabular-nums"
                    >
                      {{ displayDays }}
                    </span>
                    <span class="text-[clamp(1.2rem,3vw,2rem)] font-bold" style="color: var(--ink-soft)">天</span>
                  </div>
                  <p class="mt-1.5 text-[10px] font-bold uppercase tracking-[0.4em]" style="color: var(--ink-mute)">
                    Days together
                  </p>

                  <div
                    class="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4 border-t pt-6"
                    style="border-color: var(--hairline)"
                  >
                    <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <p class="text-sm" style="color: var(--ink-soft)">
                        始于
                        <span class="font-bold" style="color: var(--ink)">
                          {{ mainDateText }}
                          <span v-if="mainView === 'lunar' && !mainIsSolarToLunar" class="lunar-badge">农历</span>
                          <span v-else-if="mainIsSolarToLunar" class="lunar-badge solar-badge">阳历转农历</span>
                        </span>
                        <span v-if="!mainIsSolarToLunar && mainView === 'lunar' && mainThisYearLunar" class="text-xs" style="color: var(--rose-500)">
                          （今年农历同日：{{ mainThisYearLunar }}）
                        </span>
                        <span v-if="mainIsSolarToLunar" class="text-xs" style="color: var(--ink-mute)">按阳历保存 · 每年按公历纪念</span>
                        <span v-if="years" class="ml-2 rounded-full px-3 py-1 text-xs" style="background: var(--rose-50); color: var(--rose-600)">
                          第 {{ years }} 年
                        </span>
                      </p>
                      <button type="button" class="home-view-toggle" @click.stop="toggleMainView">
                        {{ mainView === 'lunar' ? '切到阳历' : '切到农历' }}
                      </button>
                    </div>
                    <span
                      class="group inline-flex cursor-pointer items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition duration-300"
                      style="background: var(--rose-50); color: var(--rose-600)"
                    >
                      查看详情
                      <i
                        class="not-italic transition-transform duration-300 group-hover:translate-x-1"
                        aria-hidden="true"
                        >→</i
                      >
                    </span>
                  </div>
                </div>
              </div>

              <!-- 右：倾斜照片悬浮台 -->
              <div class="photo-stage relative mx-auto w-full max-w-[460px] lg:max-w-none">
                <!-- 底部渐变投影块：立体景深 -->
                <div
                  class="absolute inset-6 rotate-6 rounded-[2.8rem] opacity-50 blur-md"
                  :style="{ background: 'linear-gradient(130deg, var(--rose-300), var(--rose-500) 55%, var(--rose-400))' }"
                  aria-hidden="true"
                ></div>

                <!-- 照片主体：默认倾斜，悬停回正 -->
                <div
                  class="photo-card group relative aspect-[4/5] -rotate-2 cursor-pointer overflow-hidden rounded-[2.5rem] shadow-[0_40px_90px_rgba(173,56,96,0.25)] transition-transform duration-700 ease-[cubic-bezier(0.19,1,0.22,1)] hover:rotate-0 sm:aspect-[5/5]"
                  style="border: 1px solid rgba(255,255,255,0.6)"
                >
                  <img
                    v-if="mainAnniversary.bgImage"
                    :src="mainAnniversary.bgImage"
                    :alt="mainAnniversary.title"
                    class="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <!-- 无背景图时的渐变艺术块 -->
                  <div
                    v-else
                    class="grid h-full w-full place-items-center"
                    :style="{
                      background:
                        'linear-gradient(140deg, var(--rose-300) 0%, var(--rose-500) 52%, var(--rose-400) 100%)'
                    }"
                  >
                    <span class="text-[7rem] drop-shadow-2xl">{{ mainAnniversary.icon || '💖' }}</span>
                  </div>
                  <!-- 照片上的轻遮罩 -->
                  <div
                    class="absolute inset-0"
                    style="background: linear-gradient(to top, rgba(226,233,242,0.35), transparent 60%)"
                    aria-hidden="true"
                  ></div>
                  <!-- 画廊四角取景框 -->
                  <span class="photo-corners" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
                </div>

                <!-- 贴纸徽章：第 N 年 -->
                <div
                  v-if="years"
                  class="absolute -bottom-5 -left-3 rotate-3 rounded-2xl bg-white px-5 py-3 shadow-[0_16px_40px_rgba(173,56,96,0.2)] sm:-left-8"
                  style="color: var(--ink)"
                >
                  <p class="text-[10px] font-bold uppercase tracking-[0.3em]" style="color: var(--rose-500)">Anniversary</p>
                  <p class="text-2xl font-black leading-tight">第 {{ years }} 年</p>
                </div>

                <!-- 旋转光环徽章 -->
                <div
                  class="absolute -right-2 -top-6 grid h-20 w-20 place-items-center rounded-full sm:-right-5"
                  :style="{ background: 'linear-gradient(135deg, var(--rose-400), var(--rose-600))' }"
                  aria-hidden="true"
                >
                  <span class="animate-spin-slow text-3xl text-white">✦</span>
                </div>
              </div>
            </div>
          </Transition>
        </section>

        <!-- ═══ 轮播控制 ═══ -->
        <div v-if="canSwitch" v-reveal class="mt-10 flex items-center justify-center gap-5">
          <button
            type="button"
            class="grid h-11 w-11 place-items-center rounded-full text-xl font-black transition duration-300 hover:scale-110 active:scale-95"
            style="background: rgba(255, 255, 255, 0.55); backdrop-filter: blur(20px) saturate(160%); -webkit-backdrop-filter: blur(20px) saturate(160%); color: var(--rose-500); border: 1px solid rgba(255, 255, 255, 0.7); box-shadow: var(--shadow-sm), inset 0 1px 0 rgba(255, 255, 255, 0.65)"
            aria-label="上一个纪念日"
            @click.stop="switchCard('prev')"
          >
            ‹
          </button>

          <div v-if="showDots" class="flex items-center gap-2">
            <button
              v-for="(item, idx) in decoratedList"
              :key="item.id"
              type="button"
              class="h-1.5 rounded-full transition-all duration-500"
              :class="idx === currentIndex ? 'w-10' : 'w-3 hover:opacity-80'"
              :style="idx === currentIndex ? { background: 'linear-gradient(90deg, var(--rose-500), var(--rose-300))' } : { background: 'var(--rose-200)' }"
              :aria-label="`切换到「${item.title}」`"
              :aria-current="idx === currentIndex ? 'true' : undefined"
              @click.stop="goToIndex(idx)"
            ></button>
          </div>
          <span v-else class="text-sm font-bold tabular-nums tracking-widest" style="color: var(--ink-mute)">
            {{ currentIndex + 1 }} / {{ decoratedList.length }}
          </span>

          <button
            type="button"
            class="grid h-11 w-11 place-items-center rounded-full text-xl font-black transition duration-300 hover:scale-110 active:scale-95"
            style="background: rgba(255, 255, 255, 0.55); backdrop-filter: blur(20px) saturate(160%); -webkit-backdrop-filter: blur(20px) saturate(160%); color: var(--rose-500); border: 1px solid rgba(255, 255, 255, 0.7); box-shadow: var(--shadow-sm), inset 0 1px 0 rgba(255, 255, 255, 0.65)"
            aria-label="下一个纪念日"
            @click.stop="switchCard('next')"
          >
            ›
          </button>
        </div>

        <!-- ═══ 斜切跑马灯条带 ═══ -->
        <div class="marquee-band my-14 lg:my-20" aria-hidden="true">
          <div class="marquee-track animate-marquee">
            <p v-for="n in 2" :key="n" class="marquee-group">
              FOREVER &amp; ALWAYS
              <span class="mx-6" style="color: rgba(255,255,255,0.7)">✦</span>
              每一天都算数
              <span class="mx-6" style="color: rgba(255,255,255,0.7)">✦</span>
              把相爱的每一天都好好收藏
              <span class="mx-6" style="color: rgba(255,255,255,0.7)">✦</span>
              LOVE&nbsp;DAYS
              <span class="mx-6" style="color: rgba(255,255,255,0.7)">✦</span>
            </p>
          </div>
        </div>

        <!-- ═══ 统计：三张独立白卡 ═══ -->
        <section class="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
          <div
            v-reveal="0"
            class="stat-tile group relative overflow-hidden rounded-3xl p-7 transition duration-500 hover:-translate-y-1.5 sm:p-8"
            style="background: rgba(255, 255, 255, 0.55); backdrop-filter: blur(20px) saturate(160%); -webkit-backdrop-filter: blur(20px) saturate(160%); border: 1px solid rgba(255, 255, 255, 0.7); box-shadow: var(--shadow-sm), inset 0 1px 0 rgba(255, 255, 255, 0.65)"
          >
            <p class="stat-num font-black tabular-nums" style="color: var(--rose-500)">{{ count }}</p>
            <p class="mt-1 text-xs font-bold uppercase tracking-[0.35em]" style="color: var(--ink-mute)">纪念日</p>
          </div>
          <div
            v-reveal="90"
            class="stat-tile group relative overflow-hidden rounded-3xl p-7 transition duration-500 hover:-translate-y-1.5 sm:p-8"
            style="background: rgba(255, 255, 255, 0.55); backdrop-filter: blur(20px) saturate(160%); -webkit-backdrop-filter: blur(20px) saturate(160%); border: 1px solid rgba(255, 255, 255, 0.7); box-shadow: var(--shadow-sm), inset 0 1px 0 rgba(255, 255, 255, 0.65)"
          >
            <p class="stat-num font-black tabular-nums" style="color: var(--rose-500)">{{ nearCount }}</p>
            <p class="mt-1 text-xs font-bold uppercase tracking-[0.35em]" style="color: var(--ink-mute)">30天内到来</p>
          </div>
          <div
            v-reveal="180"
            class="stat-tile group relative overflow-hidden rounded-3xl p-7 transition duration-500 hover:-translate-y-1.5 sm:p-8"
            style="background: rgba(255, 255, 255, 0.55); backdrop-filter: blur(20px) saturate(160%); -webkit-backdrop-filter: blur(20px) saturate(160%); border: 1px solid rgba(255, 255, 255, 0.7); box-shadow: var(--shadow-sm), inset 0 1px 0 rgba(255, 255, 255, 0.65)"
          >
            <p class="stat-num font-black tabular-nums" style="color: var(--rose-500)">{{ upcoming.length }}</p>
            <p class="mt-1 text-xs font-bold uppercase tracking-[0.35em]" style="color: var(--ink-mute)">每年循环</p>
          </div>
        </section>

        <!-- ═══ 即将到来：票券横列 ═══ -->
        <section v-if="upcoming.length" class="mt-16 lg:mt-24">
          <div v-reveal class="mb-7 flex items-end justify-between gap-4">
            <h3 class="font-display text-2xl font-semibold tracking-tight sm:text-3xl" style="color: var(--ink)">
              即将<span style="color: var(--rose-500)">到来</span>
            </h3>
            <span class="text-xs uppercase tracking-[0.35em]" style="color: var(--ink-mute)">Upcoming</span>
          </div>

          <div
            v-reveal="80"
            class="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4"
          >
            <router-link
              v-for="item in upcoming.slice(0, 4)"
              :key="item.id"
              :to="`/detail/${item.id}`"
              class="ticket group relative min-w-[240px] snap-start overflow-hidden rounded-3xl p-5 transition duration-500 hover:-translate-y-1.5 sm:min-w-0"
              style="background: rgba(255, 255, 255, 0.55); backdrop-filter: blur(20px) saturate(160%); -webkit-backdrop-filter: blur(20px) saturate(160%); border: 1px solid rgba(255, 255, 255, 0.7); box-shadow: var(--shadow-sm), inset 0 1px 0 rgba(255, 255, 255, 0.65)"
              :style="{ '--ac': item.color || 'var(--rose-400)' }"
            >
              <span
                class="absolute inset-y-5 left-0 w-1 rounded-full"
                :style="{ background: 'var(--ac)' }"
                aria-hidden="true"
              ></span>
              <div class="flex items-center gap-3 pl-3">
                <span
                  class="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-xl transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110"
                  :style="{ background: 'color-mix(in srgb, var(--ac) 18%, transparent)' }"
                >
                  {{ item.icon }}
                </span>
                <p class="min-w-0 flex-1 truncate font-bold" style="color: var(--ink)">{{ item.title }}</p>
              </div>
              <div class="mt-4 flex items-baseline gap-1.5 pl-3">
                <span
                  class="text-4xl font-black tabular-nums transition-colors duration-500"
                  :style="{ color: 'var(--ac)' }"
                >
                  {{ item.countdown === 0 ? '今天' : item.countdown }}
                </span>
                <span v-if="item.countdown !== 0" class="text-sm" style="color: var(--ink-mute)">天后</span>
              </div>
            </router-link>
          </div>
        </section>

        <!-- ═══ 全部纪念日：错位不对称网格 ═══ -->
        <section class="mt-16 lg:mt-24">
          <div v-reveal class="mb-7 flex items-end justify-between gap-4">
            <h3 class="font-display text-2xl font-semibold tracking-tight sm:text-3xl" style="color: var(--ink)">
              全部<span style="color: var(--rose-500)">纪念日</span>
            </h3>
            <span class="text-xs uppercase tracking-[0.35em]" style="color: var(--ink-mute)">共 {{ count }} 个</span>
          </div>

          <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <div
              v-for="(item, idx) in decoratedList"
              :key="item.id"
              v-reveal="(idx % 3) * 90"
              class="transition-transform duration-700 ease-[cubic-bezier(0.19,1,0.22,1)]"
              :class="staggerClass(idx)"
            >
              <router-link
                :to="`/detail/${item.id}`"
                class="ann-card group relative block overflow-hidden rounded-3xl p-6 transition duration-500 hover:-translate-y-2"
                style="background: rgba(255, 255, 255, 0.55); backdrop-filter: blur(20px) saturate(160%); -webkit-backdrop-filter: blur(20px) saturate(160%); border: 1px solid rgba(255, 255, 255, 0.7); box-shadow: var(--shadow-sm), inset 0 1px 0 rgba(255, 255, 255, 0.65)"
                :style="{ '--ac': item.color || 'var(--rose-400)' }"
              >
                <!-- 背景图（有则铺满压暗） -->
                <div
                  v-if="item.bgImage"
                  class="absolute inset-0 z-0 bg-cover bg-center"
                  :style="{ backgroundImage: `url('${item.bgImage}')` }"
                  aria-hidden="true"
                ></div>
                <div
                  v-if="item.bgImage"
                  class="absolute inset-0 z-0"
                  style="background: linear-gradient(to top, rgba(255,255,255,0.92), rgba(255,255,255,0.55) 55%, rgba(255,255,255,0.85))"
                  aria-hidden="true"
                ></div>

                <div class="relative z-10">
                  <div class="flex items-start justify-between gap-4">
                    <span
                      class="grid h-13 w-13 shrink-0 place-items-center rounded-2xl p-3 text-2xl transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110"
                      :style="{
                        background: 'linear-gradient(135deg, color-mix(in srgb, var(--ac) 85%, white), var(--ac))'
                      }"
                    >
                      {{ item.icon || getTypeMeta(item.type).icon }}
                    </span>
                    <span
                      class="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em]"
                      style="background: var(--rose-50); color: var(--rose-600)"
                    >
                      {{ getTypeMeta(item.type).label }}
                    </span>
                  </div>

                  <h4 class="mt-5 line-clamp-2 text-xl font-black leading-snug" style="color: var(--ink)">
                    {{ item.title }}
                  </h4>
                  <p class="mt-2 text-xs" style="color: var(--ink-mute)">
                    {{ formatDateCN(item.date) }} · {{ weekdayCN(item.date) }}
                  </p>

                  <div
                    class="mt-6 flex items-end justify-between border-t pt-4"
                    style="border-color: var(--hairline)"
                  >
                    <span
                      class="text-[11px] font-bold opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                      style="color: var(--ink-mute)"
                    >
                      查看详情 →
                    </span>
                    <span
                      class="text-right font-black leading-none tabular-nums"
                      :class="highlightOf(item).isText ? 'is-text' : 'text-3xl'"
                      :style="{ color: 'var(--ac)' }"
                    >
                      {{ highlightOf(item).num }}
                    </span>
                  </div>
                  <p class="mt-1.5 text-right text-[11px]" style="color: var(--ink-mute)">
                    {{ highlightOf(item).label }}
                  </p>
                </div>
              </router-link>
            </div>
          </div>
        </section>
      </template>

      <!-- ═══ 空状态 ═══ -->
      <section v-else v-reveal class="grid min-h-[70vh] place-items-center text-center">
        <div>
          <div
            class="mx-auto grid h-36 w-36 animate-float-slow place-items-center rounded-full text-7xl"
            style="background: linear-gradient(135deg, var(--rose-400), var(--rose-600)); box-shadow: var(--shadow-lg)"
          >
            💌
          </div>
          <h3 class="mt-10 text-3xl font-black sm:text-4xl" style="color: var(--ink)">还没有纪念日</h3>
          <p class="mt-3 text-sm" style="color: var(--ink-soft)">添加第一个属于你们的日子吧</p>
          <router-link
            to="/add"
            class="mt-9 inline-flex items-center gap-2 rounded-full px-8 py-4 text-sm font-black tracking-widest text-white transition duration-300 hover:-translate-y-1 active:scale-95"
            style="background: linear-gradient(120deg, var(--rose-500), var(--rose-600)); box-shadow: 0 12px 32px rgba(173,56,96,0.35)"
          >
            ＋ 添加纪念日
          </router-link>
        </div>
      </section>
    </div>

    <!-- ═══ 悬浮添加按钮（移动端 / 平板） ═══ -->
    <router-link
      v-if="count"
      to="/add"
      class="fixed bottom-7 right-6 z-40 grid h-14 w-14 place-items-center rounded-full text-2xl font-bold text-white transition-transform duration-300 active:scale-90 lg:hidden"
      style="background: linear-gradient(135deg, var(--rose-500), var(--rose-600)); box-shadow: 0 12px 32px rgba(173,56,96,0.35)"
      aria-label="添加纪念日"
    >
      ＋
    </router-link>
  </div>
</template>

<style scoped>
/* 主卡片农历徽章与切换 */
.lunar-badge {
  margin-left: 6px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  color: var(--rose-600);
  background: var(--rose-50);
  vertical-align: 1px;
}
.lunar-badge.solar-badge {
  color: var(--ink-mute);
  background: rgba(61, 74, 92, 0.08);
}
.home-view-toggle {
  padding: 4px 12px;
  border: 1px solid rgba(183, 110, 121, 0.35);
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--rose-600);
  background: transparent;
  cursor: pointer;
  transition: all 0.25s var(--ease-out);
}
.home-view-toggle:hover {
  background: var(--rose-500);
  border-color: var(--rose-500);
  color: #fff;
}
/* ============================================
   首页 —— 暖粉浅色风格，结构与原版一致
   ============================================ */

/* 背景柔光光斑（无网格） */
.blob {
  position: absolute;
  border-radius: 9999px;
  filter: blur(90px);
}

.blob-a {
  top: -14%;
  right: -10%;
  width: 46vw;
  height: 46vw;
  background: rgba(140, 172, 208, 0.06);
}

.blob-b {
  bottom: -18%;
  left: -12%;
  width: 42vw;
  height: 42vw;
  background: rgba(183, 110, 121, 0.05);
}

/* ============================================
   HERO：幽灵描边字 / 巨型天数
   ============================================ */
.hero-ghost {
  position: absolute;
  top: -0.62em;
  left: -0.05em;
  z-index: 0;
  font-size: clamp(4.5rem, 13vw, 10rem);
  font-weight: 900;
  letter-spacing: 0.02em;
  line-height: 1;
  color: transparent;
  -webkit-text-stroke: 1.5px rgba(204, 75, 121, 0.1);
  pointer-events: none;
  user-select: none;
  /* 极慢漂浮：页面常有一点点"活着"的呼吸感 */
  animation: ghost-float 9s ease-in-out infinite;
}

@keyframes ghost-float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-ghost {
    animation: none;
  }
}

/* 照片四角取景框：常驻的画廊画框感 */
.photo-corners {
  position: absolute;
  inset: 14px;
  z-index: 3;
  pointer-events: none;
}
.photo-corners i {
  position: absolute;
  width: 22px;
  height: 22px;
  border-color: rgba(255, 255, 255, 0.85);
  box-shadow: 0 0 8px rgba(255, 255, 255, 0.35);
}
.photo-corners i:nth-child(1) {
  top: 0;
  left: 0;
  border-top: 2px solid;
  border-left: 2px solid;
}
.photo-corners i:nth-child(2) {
  top: 0;
  right: 0;
  border-top: 2px solid;
  border-right: 2px solid;
}
.photo-corners i:nth-child(3) {
  bottom: 0;
  left: 0;
  border-bottom: 2px solid;
  border-left: 2px solid;
}
.photo-corners i:nth-child(4) {
  bottom: 0;
  right: 0;
  border-bottom: 2px solid;
  border-right: 2px solid;
}

.days-giant {
  font-family: var(--font-display);
  font-size: clamp(5.2rem, 13vw, 10.5rem);
  font-weight: 600;
}

/* ============================================
   跑马灯：斜切条带
   ============================================ */
.marquee-band {
  transform: rotate(-1.2deg) scale(1.03);
  background: linear-gradient(90deg, var(--rose-500) 0%, var(--rose-400) 55%, var(--rose-300) 100%);
  box-shadow: 0 18px 50px rgba(204, 75, 121, 0.2);
  overflow: hidden;
}

.marquee-track {
  display: flex;
  width: max-content;
  padding: 14px 0;
}

.marquee-group {
  white-space: nowrap;
  font-size: 15px;
  font-weight: 900;
  letter-spacing: 0.35em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.95);
}

/* ============================================
   统计卡片
   ============================================ */
.stat-num {
  font-size: clamp(3rem, 6vw, 4.2rem);
  line-height: 1;
}

/* 全部纪念日卡片高亮数字文字型时缩小 */
.is-text {
  font-size: 1.4rem;
  letter-spacing: 0.02em;
}

/* ============================================
   滚动入场 reveal（一次性点亮）
   ============================================ */
.reveal {
  opacity: 0;
  transform: translateY(32px) scale(0.985);
  transition:
    opacity 0.9s cubic-bezier(0.19, 1, 0.22, 1),
    transform 0.9s cubic-bezier(0.19, 1, 0.22, 1);
  will-change: opacity, transform;
}

.reveal-in {
  opacity: 1;
  transform: none;
}

/* ============================================
   HERO 滑动切换过渡
   ============================================ */
.slide-next-enter-active,
.slide-next-leave-active,
.slide-prev-enter-active,
.slide-prev-leave-active {
  transition:
    transform 0.5s cubic-bezier(0.19, 1, 0.22, 1),
    opacity 0.5s ease;
}

.slide-next-enter-from {
  transform: translateX(52%);
  opacity: 0;
}

.slide-next-leave-to {
  transform: translateX(-52%);
  opacity: 0;
}

.slide-prev-enter-from {
  transform: translateX(-52%);
  opacity: 0;
}

.slide-prev-leave-to {
  transform: translateX(52%);
  opacity: 0;
}

/* ============================================
   工具：滚动条隐藏 / 焦点可达
   ============================================ */
.no-scrollbar {
  scrollbar-width: none;
}

.no-scrollbar::-webkit-scrollbar {
  display: none;
}

.home-nouveau :deep(a:focus-visible),
.home-nouveau :deep(button:focus-visible),
.home-nouveau [role='link']:focus-visible {
  outline: 2px solid var(--rose-500);
  outline-offset: 3px;
  border-radius: 6px;
}

/* h-13/w-13 不在默认刻度中，用等值表达 */
.h-13 {
  height: 3.25rem;
}

.w-13 {
  width: 3.25rem;
}

/* ============================================
   减弱动效：尊重系统设置
   ============================================ */
@media (prefers-reduced-motion: reduce) {
  .reveal {
    opacity: 1;
    transform: none;
    transition: none;
  }

  .animate-marquee,
  .animate-float-slow,
  .animate-float-slower,
  .animate-spin-slow {
    animation: none;
  }

  .slide-next-enter-active,
  .slide-next-leave-active,
  .slide-prev-enter-active,
  .slide-prev-leave-active {
    transition: opacity 0.2s ease;
  }

  .slide-next-enter-from,
  .slide-next-leave-to,
  .slide-prev-enter-from,
  .slide-prev-leave-to {
    transform: none;
  }
}
</style>
