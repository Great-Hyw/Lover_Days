<script setup>
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useAnniversaryStore } from '@/stores/anniversary'
import { formatDateCN, fullYearsPassed } from '@/utils/date'
import AnniversaryCard from '@/components/AnniversaryCard.vue'

const router = useRouter()
const store = useAnniversaryStore()
const { loading, count, decoratedList, upcoming, mainAnniversary } = storeToRefs(store)

onMounted(() => {
  store.fetchList()
})

const years = computed(() =>
  mainAnniversary.value ? fullYearsPassed(mainAnniversary.value.date) : 0
)

const nearCount = computed(() => upcoming.value.filter((i) => i.countdown <= 30).length)

const heroStyle = computed(() =>
  mainAnniversary.value?.color
    ? { '--hero': mainAnniversary.value.color }
    : {}
)

// —— 主卡片手动切换 ——
// 滑动方向，用于决定过渡动画方向
const slideDir = ref('next')
const canSwitch = computed(() => count.value > 1)

const currentIndex = computed(() => {
  if (!mainAnniversary.value) return 0
  return decoratedList.value.findIndex(
    (i) => String(i.id) === String(mainAnniversary.value.id)
  )
})

function switchCard(dir) {
  if (!canSwitch.value) return
  const len = decoratedList.value.length
  if (!len) return
  slideDir.value = dir
  const idx = currentIndex.value < 0 ? 0 : currentIndex.value
  const nextIdx =
    dir === 'next' ? (idx + 1) % len : (idx - 1 + len) % len
  store.setMainId(decoratedList.value[nextIdx].id)
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
  // 水平滑动超过阈值且横向位移大于纵向位移才切换
  if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) {
    swipped = true
    switchCard(dx < 0 ? 'next' : 'prev')
  }
}

// 点击卡片进详情；刚滑动完产生的 click 要吞掉
function onCardClick() {
  if (swipped) {
    swipped = false
    return
  }
  router.push(`/detail/${mainAnniversary.value.id}`)
}
</script>

<template>
  <div class="page">
    <!-- 顶部问候 -->
    <header class="hero-header pop-in">
      <h1>我们的纪念日</h1>
      <p>把相爱的每一天，都好好收藏 ✨</p>
    </header>

    <!-- 加载中 -->
    <div v-if="loading && !count" class="loading-dot">加载中…</div>

    <template v-else-if="count">
      <!-- 主纪念日大卡片（可左右切换） -->
      <section
        v-if="mainAnniversary"
        class="hero-card pop-in"
        :class="{ 'has-bg': mainAnniversary.bgImage }"
        :style="heroStyle"
        @click="onCardClick"
        @touchstart.passive="onTouchStart"
        @touchend.passive="onTouchEnd"
      >
        <!-- 左右切换按钮（多于 1 个纪念日时显示） -->
        <button
          v-if="canSwitch"
          type="button"
          class="switch-btn switch-prev"
          aria-label="上一个纪念日"
          @click.stop="switchCard('prev')"
        >
          ‹
        </button>
        <button
          v-if="canSwitch"
          type="button"
          class="switch-btn switch-next"
          aria-label="下一个纪念日"
          @click.stop="switchCard('next')"
        >
          ›
        </button>

        <!-- 滑动切换的内容 -->
        <transition
          mode="out-in"
          :name="slideDir === 'next' ? 'slide-next' : 'slide-prev'"
        >
          <div :key="mainAnniversary.id" class="hero-inner">
            <!-- 自定义背景图 -->
            <template v-if="mainAnniversary.bgImage">
              <div
                class="hero-bgimg"
                :style="{ backgroundImage: `url('${mainAnniversary.bgImage}')` }"
              ></div>
              <div class="hero-bgmask"></div>
            </template>

            <!-- 无背景图时的装饰光斑 -->
            <template v-else>
              <div class="hero-glow hero-glow-1"></div>
              <div class="hero-glow hero-glow-2"></div>
            </template>

            <div class="hero-top">
              <span class="hero-icon heartbeat">{{ mainAnniversary.icon || '💖' }}</span>
              <span class="hero-title">{{ mainAnniversary.title }}</span>
            </div>

            <div class="hero-days">
              <span class="days-num">{{ mainAnniversary.passed }}</span>
              <span class="days-unit">天</span>
            </div>

            <div class="hero-foot">
              <span>
                始于 {{ formatDateCN(mainAnniversary.date) }}
                <template v-if="years"> · 第 {{ years }} 年</template>
              </span>
              <span class="hero-arrow">查看详情 →</span>
            </div>
          </div>
        </transition>
      </section>

      <!-- 当前位置指示点 -->
      <div v-if="canSwitch" class="hero-dots">
        <span
          v-for="(item, idx) in decoratedList"
          :key="item.id"
          class="dot"
          :class="{ active: idx === currentIndex }"
          @click="store.setMainId(item.id); slideDir = idx > currentIndex ? 'next' : 'prev'"
        ></span>
      </div>

      <!-- 统计 -->
      <section class="stats pop-in">
        <div class="stat-item">
          <strong>{{ count }}</strong>
          <span>纪念日</span>
        </div>
        <div class="stat-item">
          <strong>{{ nearCount }}</strong>
          <span>30天内到来</span>
        </div>
        <div class="stat-item">
          <strong>{{ upcoming.length }}</strong>
          <span>每年循环</span>
        </div>
      </section>

      <!-- 即将到来 -->
      <template v-if="upcoming.length">
        <h2 class="section-title">即将到来</h2>
        <section class="upcoming-list">
          <div
            v-for="item in upcoming.slice(0, 4)"
            :key="item.id"
            class="upcoming-item"
            :style="{ '--accent': item.color }"
            @click="$router.push(`/detail/${item.id}`)"
          >
            <span class="up-icon">{{ item.icon }}</span>
            <span class="up-name">{{ item.title }}</span>
            <span class="up-days">
              <em v-if="item.countdown === 0">今天</em>
              <template v-else>
                <em>{{ item.countdown }}</em>天
              </template>
            </span>
          </div>
        </section>
      </template>

      <!-- 全部纪念日 -->
      <h2 class="section-title">全部纪念日</h2>
      <section class="card-grid">
        <AnniversaryCard
          v-for="item in decoratedList"
          :key="item.id"
          :item="item"
          class="pop-in"
        />
      </section>
    </template>

    <!-- 空状态 -->
    <section v-else class="empty pop-in">
      <div class="empty-emoji">💌</div>
      <h3>还没有纪念日</h3>
      <p>添加第一个属于你们的日子吧</p>
      <router-link to="/add" class="btn btn-primary">＋ 添加纪念日</router-link>
    </section>

    <!-- 悬浮添加按钮 -->
    <router-link v-if="count" to="/add" class="fab" aria-label="添加纪念日">＋</router-link>
  </div>
</template>

<style scoped>
.hero-header {
  text-align: center;
  padding: 14px 0 22px;
}

.hero-header h1 {
  font-size: 26px;
  font-weight: 800;
  background: linear-gradient(120deg, var(--pink), var(--purple));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.hero-header p {
  margin-top: 6px;
  font-size: 13.5px;
  color: var(--text-secondary);
}

/* 主卡片：宽度与下方列表卡片一致，高度固定 */
.hero-card {
  position: relative;
  width: 100%;
  height: 330px;
  border-radius: var(--radius-lg);
  color: #fff;
  background: linear-gradient(135deg, var(--hero, var(--pink)) 0%, #ff9ebb 100%);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  cursor: pointer;
}

/* 滑动内容层：撑满卡片，纵向 flex 分布 */
.hero-inner {
  position: relative;
  height: 100%;
  padding: 26px 28px;
  display: flex;
  flex-direction: column;
}

/* 有自定义背景图时不用渐变 */
.hero-card.has-bg {
  background: #4a3240;
}

.hero-bgimg,
.hero-bgmask {
  position: absolute;
  inset: 0;
  z-index: 0;
}

.hero-bgimg {
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

.hero-bgmask {
  background: linear-gradient(
    135deg,
    rgba(60, 30, 48, 0.52) 0%,
    rgba(60, 30, 48, 0.3) 45%,
    rgba(60, 30, 48, 0.62) 100%
  );
}

/* 内容浮于背景层之上 */
.hero-top,
.hero-days,
.hero-foot {
  position: relative;
  z-index: 1;
}

/* —— 左右切换按钮 —— */
.switch-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 3;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 22px;
  line-height: 1;
  background: rgba(50, 28, 42, 0.28);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  border: 1px solid rgba(255, 255, 255, 0.35);
  transition: background 0.2s, transform 0.15s;
}

.switch-prev {
  left: 8px;
  padding-right: 3px;
}

.switch-next {
  right: 8px;
  padding-left: 3px;
}

.switch-btn:hover {
  background: rgba(50, 28, 42, 0.45);
}

.switch-btn:active {
  transform: translateY(-50%) scale(0.9);
}

/* —— 指示点 —— */
.hero-dots {
  display: flex;
  justify-content: center;
  gap: 6px;
  margin: 2px 0 4px;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: rgba(255, 107, 157, 0.3);
  cursor: pointer;
  transition: width 0.25s ease, background 0.25s ease;
}

.dot.active {
  width: 18px;
  background: var(--pink);
}

/* —— 滑动过渡动画 —— */
.slide-next-enter-active,
.slide-next-leave-active,
.slide-prev-enter-active,
.slide-prev-leave-active {
  transition: transform 0.32s ease, opacity 0.32s ease;
}

.slide-next-enter-from {
  transform: translateX(42%);
  opacity: 0;
}

.slide-next-leave-to {
  transform: translateX(-42%);
  opacity: 0;
}

.slide-prev-enter-from {
  transform: translateX(-42%);
  opacity: 0;
}

.slide-prev-leave-to {
  transform: translateX(42%);
  opacity: 0;
}

.hero-glow {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.18);
}

.hero-glow-1 {
  width: 160px;
  height: 160px;
  right: -50px;
  top: -60px;
}

.hero-glow-2 {
  width: 100px;
  height: 100px;
  left: -30px;
  bottom: -40px;
}

.hero-top {
  display: flex;
  align-items: center;
  gap: 10px;
}

.hero-icon {
  font-size: 24px;
}

.hero-title {
  font-size: 15px;
  font-weight: 600;
  opacity: 0.95;
}

.hero-days {
  /* 在加高的卡片中垂直居中分布 */
  margin: auto 0;
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.days-num {
  font-size: clamp(44px, 11vw, 64px);
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.days-unit {
  font-size: clamp(15px, 3.5vw, 19px);
  opacity: 0.9;
}

.hero-foot {
  display: flex;
  justify-content: space-between;
  font-size: 12.5px;
  opacity: 0.92;
}

/* 统计 */
.stats {
  display: flex;
  margin-top: 16px;
  /* 顶部受光渐变 */
  background: linear-gradient(145deg, #ffffff 0%, #fdf4f9 100%);
  border-radius: var(--radius-md);
  padding: 18px 0;
  /* 立体三层：顶部内高光 + 接触阴影 + 环境投影 */
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    0 2px 4px rgba(214, 81, 132, 0.08),
    0 10px 24px rgba(255, 107, 157, 0.14);
  transition: transform 0.22s ease, box-shadow 0.22s ease;
}

.stats:hover {
  transform: translateY(-3px);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    0 4px 8px rgba(214, 81, 132, 0.1),
    0 18px 34px rgba(255, 107, 157, 0.2);
}

.stat-item {
  flex: 1;
  text-align: center;
}

.stat-item + .stat-item {
  border-left: 1px solid rgba(255, 107, 157, 0.16);
}

.stat-item strong {
  display: block;
  font-size: 24px;
  color: var(--pink);
  font-weight: 800;
  /* 数字轻微凸起 */
  text-shadow: 0 1.5px 0 rgba(255, 255, 255, 0.9),
    0 3px 8px rgba(255, 107, 157, 0.3);
}

.stat-item span {
  font-size: 12px;
  color: var(--text-secondary);
}

/* 即将到来 */
.upcoming-list {
  display: grid;
  gap: 12px;
}

.upcoming-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 13px;
  /* 顶部受光的微妙渐变 */
  background: linear-gradient(145deg, #ffffff 0%, #fdf4f9 100%);
  border-radius: 16px;
  padding: 15px 18px;
  cursor: pointer;
  /* 立体三层：顶部内高光 + 贴近接触阴影 + 大环境投影 */
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    0 2px 4px rgba(214, 81, 132, 0.08),
    0 10px 24px rgba(255, 107, 157, 0.14);
  transition: transform 0.22s ease, box-shadow 0.22s ease;
}

/* 悬停：浮起 */
.upcoming-item:hover {
  transform: translateY(-3px);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    0 4px 8px rgba(214, 81, 132, 0.1),
    0 18px 34px rgba(255, 107, 157, 0.2);
}

/* 按下：回弹凹陷感 */
.upcoming-item:active {
  transform: translateY(0) scale(0.98);
  box-shadow:
    inset 0 2px 5px rgba(214, 81, 132, 0.14),
    0 2px 4px rgba(214, 81, 132, 0.06);
}

/* 凸起的图标气泡 */
.up-icon {
  flex-shrink: 0;
  width: 42px;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  border-radius: 13px;
  background: linear-gradient(
    145deg,
    color-mix(in srgb, var(--accent) 18%, white),
    color-mix(in srgb, var(--accent) 8%, white)
  );
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.85),
    0 3px 8px color-mix(in srgb, var(--accent) 28%, transparent);
}

.up-name {
  flex: 1;
  font-size: 14.5px;
  font-weight: 600;
}

/* 天数胶囊 */
.up-days {
  flex-shrink: 0;
  font-size: 12.5px;
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--accent) 9%, white);
  padding: 5px 13px;
  border-radius: 999px;
  box-shadow: inset 0 1px 2px color-mix(in srgb, var(--accent) 20%, transparent);
}

.up-days em {
  font-style: normal;
  font-size: 17px;
  font-weight: 800;
  color: var(--accent);
  margin-right: 2px;
}

/* 卡片网格 */
.card-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
}

/* 悬浮按钮 */
.fab {
  position: fixed;
  right: 22px;
  bottom: 28px;
  width: 58px;
  height: 58px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--pink), var(--pink-light));
  color: #fff;
  font-size: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 24px rgba(255, 107, 157, 0.45);
  z-index: 50;
  transition: transform 0.2s;
}

.fab:active {
  transform: scale(0.92);
}

/* 空状态 */
.empty {
  text-align: center;
  padding: 70px 20px;
}

.empty-emoji {
  font-size: 56px;
  margin-bottom: 16px;
}

.empty h3 {
  font-size: 18px;
  margin-bottom: 8px;
}

.empty p {
  font-size: 13.5px;
  color: var(--text-secondary);
  margin-bottom: 24px;
}
</style>
