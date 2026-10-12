<script setup>
import { computed } from 'vue'
import { formatDateCN, weekdayCN } from '@/utils/date'
import { getTypeMeta } from '@/constants/anniversary'

const props = defineProps({
  item: {
    type: Object,
    required: true
  }
})

const typeMeta = computed(() => getTypeMeta(props.item.type))

// 主展示数字与文案
const highlight = computed(() => {
  if (props.item.countdown === 0) {
    return { num: '就是今天', label: '快送上祝福吧 🎉' }
  }
  if (props.item.isYearly && props.item.countdown !== null) {
    return { num: props.item.countdown, label: '天后到来' }
  }
  return { num: props.item.passed, label: '天啦' }
})

const accentStyle = computed(() => ({
  '--accent': props.item.color || 'var(--pink)'
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

    <div class="icon-bubble">
      <span>{{ item.icon || typeMeta.icon }}</span>
    </div>

    <div class="info">
      <h3 class="title">{{ item.title }}</h3>
      <div class="sub-row">
        <span class="type-chip">{{ typeMeta.label }}</span>
        <span class="date">
          {{ formatDateCN(item.date) }} · {{ weekdayCN(item.date) }}
        </span>
      </div>
    </div>

    <div class="highlight">
      <span class="num">{{ highlight.num }}</span>
      <span class="label">{{ highlight.label }}</span>
    </div>
  </router-link>
</template>

<style scoped>
.ann-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 16px;
  background: var(--white);
  border-radius: var(--radius-md);
  padding: 28px 22px;
  box-shadow: var(--shadow-sm);
  transition: transform 0.25s ease, box-shadow 0.25s ease;
  overflow: hidden;
}

/* 有自定义背景图 */
.ann-card.has-bg {
  background: #4a3240;
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

.card-bgmask {
  background: linear-gradient(
    105deg,
    rgba(55, 30, 45, 0.62) 0%,
    rgba(55, 30, 45, 0.32) 55%,
    rgba(55, 30, 45, 0.58) 100%
  );
}

/* 内容浮于背景层之上 */
.icon-bubble,
.info,
.highlight {
  position: relative;
  z-index: 1;
}

.ann-card::after {
  content: '';
  position: absolute;
  right: -30px;
  top: -30px;
  width: 90px;
  height: 90px;
  border-radius: 50%;
  background: var(--accent);
  opacity: 0.08;
}

/* 有背景图时隐藏装饰圆 */
.ann-card.has-bg::after {
  display: none;
}

.ann-card:active {
  transform: scale(0.98);
}

@media (hover: hover) {
  .ann-card:hover {
    transform: translateY(-3px);
    box-shadow: var(--shadow-md);
  }
}

.icon-bubble {
  flex-shrink: 0;
  width: 62px;
  height: 62px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--accent) 14%, white);
  font-size: 31px;
}

.has-bg .icon-bubble {
  background: rgba(255, 255, 255, 0.22);
  backdrop-filter: blur(4px);
}

.info {
  flex: 1;
  min-width: 0;
}

.title {
  font-size: 17px;
  font-weight: 700;
  margin-bottom: 9px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.has-bg .title {
  color: #fff;
}

.sub-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.type-chip {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, white);
  padding: 2px 9px;
  border-radius: 999px;
  font-weight: 600;
}

.has-bg .type-chip {
  color: #fff;
  background: rgba(255, 255, 255, 0.24);
}

.date {
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.has-bg .date {
  color: rgba(255, 255, 255, 0.82);
}

.highlight {
  flex-shrink: 0;
  text-align: right;
  z-index: 1;
}

.num {
  display: block;
  font-size: 26px;
  font-weight: 800;
  color: var(--accent);
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
}

.has-bg .num {
  color: #fff;
}

.label {
  font-size: 12px;
  color: var(--text-secondary);
}

.has-bg .label {
  color: rgba(255, 255, 255, 0.82);
}
</style>
