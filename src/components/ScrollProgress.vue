<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const bar = ref(null)
let raf = 0

const update = () => {
  raf = 0
  const el = document.documentElement
  const max = el.scrollHeight - el.clientHeight
  const p = max > 0 ? el.scrollTop / max : 0
  if (bar.value) bar.value.style.transform = 'scaleX(' + p.toFixed(4) + ')'
}

const onScroll = () => {
  if (!raf) raf = requestAnimationFrame(update)
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll)
  update()
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onScroll)
  if (raf) cancelAnimationFrame(raf)
})
</script>

<template>
  <div class="scroll-progress" aria-hidden="true">
    <div class="scroll-progress-bar" ref="bar"></div>
  </div>
</template>

<style scoped>
/* 视口顶端 2px 玫瑰金进度线：rAF 节流，随阅读推进 */
.scroll-progress {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  z-index: 60;
  pointer-events: none;
  background: rgba(80, 100, 130, 0.08);
}

.scroll-progress-bar {
  width: 100%;
  height: 100%;
  transform-origin: left center;
  transform: scaleX(0);
  background: linear-gradient(90deg, #b76e79 0%, #d8a8a8 45%, var(--rose-400) 100%);
  box-shadow: 0 0 10px rgba(183, 110, 121, 0.55);
}
</style>
