<script setup>
// 页面动态背景：四团柔和的极光色块（玫瑰 / 香槟金 / 紫罗兰 / 玫粉）缓慢漂移
// 色块用径向渐变自带柔边（不加 blur 滤镜），动画只用 transform（GPU 合成层），开销极低
const BLOBS = [
  { cls: 'b-rose' },
  { cls: 'b-gold' },
  { cls: 'b-purple' },
  { cls: 'b-pink' }
]
</script>

<template>
  <div class="aurora-bg" aria-hidden="true">
    <div
      v-for="b in BLOBS"
      :key="b.cls"
      class="aurora-blob"
      :class="b.cls"
    ></div>
  </div>
</template>

<style scoped>
.aurora-bg {
  position: fixed;
  inset: 0;
  z-index: -1; /* 位于所有页面内容之下、body 底色之上 */
  overflow: hidden;
  pointer-events: none;
}

.aurora-blob {
  position: absolute;
  border-radius: 50%;
  will-change: transform;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
  animation-direction: alternate;
}

/* 玫瑰：右上 */
.b-rose {
  width: 55vmax;
  height: 55vmax;
  top: -14%;
  right: -10%;
  background: radial-gradient(circle, rgba(204, 75, 121, 0.1) 0%, transparent 66%);
  animation-name: drift-a;
  animation-duration: 26s;
  animation-delay: -4s;
}

/* 香槟金：左下 */
.b-gold {
  width: 46vmax;
  height: 46vmax;
  bottom: -20%;
  left: -12%;
  background: radial-gradient(circle, rgba(194, 160, 119, 0.12) 0%, transparent 64%);
  animation-name: drift-b;
  animation-duration: 31s;
  animation-delay: -12s;
}

/* 紫罗兰：中部偏左（最淡，只添一点层次） */
.b-purple {
  width: 40vmax;
  height: 40vmax;
  top: 24%;
  left: 14%;
  background: radial-gradient(circle, rgba(166, 132, 212, 0.08) 0%, transparent 62%);
  animation-name: drift-c;
  animation-duration: 23s;
  animation-delay: -8s;
}

/* 玫粉：右下 */
.b-pink {
  width: 38vmax;
  height: 38vmax;
  bottom: 2%;
  right: 8%;
  background: radial-gradient(circle, rgba(214, 113, 147, 0.09) 0%, transparent 63%);
  animation-name: drift-a;
  animation-duration: 28s;
  animation-delay: -17s;
}

/* 三组漂移轨迹：各自方向/幅度不同，叠加后运动不重复、不呆板 */
@keyframes drift-a {
  from { transform: translate3d(0, 0, 0) scale(1); }
  to { transform: translate3d(-46px, 34px, 0) scale(1.14); }
}
@keyframes drift-b {
  from { transform: translate3d(0, 0, 0) scale(1.08); }
  to { transform: translate3d(52px, -30px, 0) scale(0.96); }
}
@keyframes drift-c {
  from { transform: translate3d(0, 0, 0) scale(1); }
  to { transform: translate3d(38px, 44px, 0) scale(1.1); }
}

/* 减弱动效：色块静止（保留静态柔光背景） */
@media (prefers-reduced-motion: reduce) {
  .aurora-blob {
    animation: none;
  }
}
</style>
