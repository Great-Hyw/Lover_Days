<script setup>
import { ref } from 'vue'

// 生成随机漂浮爱心（纯装饰）
const hearts = ref(
  Array.from({ length: 14 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    size: 12 + Math.random() * 20,
    duration: 9 + Math.random() * 10,
    delay: -Math.random() * 12,
    opacity: 0.12 + Math.random() * 0.22
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
</style>
