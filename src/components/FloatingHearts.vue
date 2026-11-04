<script setup>
import { ref } from 'vue'

// 生成随机漂浮爱心（纯装饰）
// 数量与透明度都刻意保持克制：只作为背景氛围，不与内容争夺注意力
const hearts = ref(
  Array.from({ length: 9 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    size: 11 + Math.random() * 15,
    duration: 12 + Math.random() * 12,
    delay: -Math.random() * 14,
    opacity: 0.09 + Math.random() * 0.13
  }))
)
</script>

<template>
  <div class="floating-hearts" aria-hidden="true">
    <span
      v-for="h in hearts"
      :key="h.id"
      class="heart"
      :style="{
        left: h.left + '%',
        fontSize: h.size + 'px',
        animationDuration: h.duration + 's',
        animationDelay: h.delay + 's',
        opacity: h.opacity
      }"
      >❤</span
    >
  </div>
</template>

<style scoped>
.floating-hearts {
  position: fixed;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 0;
}

.heart {
  position: absolute;
  bottom: -40px;
  color: var(--pink);
  animation-name: float-up;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
  will-change: transform;
}

@keyframes float-up {
  0% {
    transform: translateY(0) rotate(0deg);
  }
  50% {
    transform: translateY(-55vh) translateX(20px) rotate(15deg);
  }
  100% {
    transform: translateY(-110vh) translateX(-20px) rotate(-15deg);
  }
}

/* 尊重系统的减弱动效设置 */
@media (prefers-reduced-motion: reduce) {
  .heart {
    display: none;
  }
}
</style>
