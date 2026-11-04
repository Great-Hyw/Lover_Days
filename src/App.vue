<script setup>
import FloatingHearts from '@/components/FloatingHearts.vue'
import ScrollProgress from '@/components/ScrollProgress.vue'
import Toast from '@/components/Toast.vue'
import AuroraBackground from '@/components/AuroraBackground.vue'
import { portalActive } from '@/utils/login-portal'
</script>

<template>
  <!-- 页面动态背景：四团极光色块缓慢漂移（在所有内容之下） -->
  <AuroraBackground />
  <ScrollProgress />
  <FloatingHearts />
  <router-view v-slot="{ Component }">
    <transition name="fade" mode="out-in">
      <component :is="Component" />
    </transition>
  </router-view>
  <Toast />

  <!-- 登录/注册成功后的过渡：玫瑰帷幕合拢 → 中缝亮灯 → 心形弹出 → 帷幕打开露出首页 -->
  <div v-if="portalActive" class="login-portal" aria-hidden="true">
    <div class="portal-curtain portal-curtain--left"></div>
    <div class="portal-curtain portal-curtain--right"></div>
    <div class="portal-seam"></div>
    <div class="portal-heart"></div>
  </div>
</template>

<style scoped>
.login-portal {
  position: fixed;
  inset: 0;
  z-index: 200;
  overflow: hidden;
  pointer-events: none;
}

/* 玫瑰帷幕：左右两扇，与侧边栏同套配色，先合拢盖住屏幕，再向外打开 */
.portal-curtain {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 50.5%;
  background:
    radial-gradient(120% 90% at 50% 130%, rgba(255, 214, 178, 0.35), transparent 60%),
    linear-gradient(160deg, #f08cab 0%, #e76f9c 45%, #d65a89 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18);
  animation-duration: 1.7s;
  animation-timing-function: cubic-bezier(0.65, 0, 0.35, 1);
  animation-fill-mode: both;
}
.portal-curtain--left {
  left: 0;
  border-right: 1px solid rgba(255, 255, 255, 0.4);
  animation-name: curtain-left;
}
.portal-curtain--right {
  right: 0;
  border-left: 1px solid rgba(255, 255, 255, 0.4);
  animation-name: curtain-right;
}

/* 时序（占 1.7s 的百分比）：
   合拢 8%→38%（0.14s→0.65s） | 停留 38%→52%（0.65s→0.88s，路由切换藏在此刻）
   打开 52%→96%（0.88s→1.63s） */
@keyframes curtain-left {
  0%, 8% { transform: translateX(-101%); }
  38% { transform: translateX(0); }
  52% { transform: translateX(0); }
  96%, 100% { transform: translateX(-101%); }
}
@keyframes curtain-right {
  0%, 8% { transform: translateX(101%); }
  38% { transform: translateX(0); }
  52% { transform: translateX(0); }
  96%, 100% { transform: translateX(101%); }
}

/* 中缝光带：帷幕合拢到位的瞬间亮起，像门缝里透出的光 */
.portal-seam {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 2px;
  margin-left: -1px;
  background: linear-gradient(
    180deg,
    transparent,
    rgba(255, 244, 248, 0.95) 30%,
    #fff 50%,
    rgba(255, 244, 248, 0.95) 70%,
    transparent
  );
  box-shadow: 0 0 26px 8px rgba(255, 214, 226, 0.7);
  opacity: 0;
  animation: seam-flash 1.7s ease-in-out both;
}
@keyframes seam-flash {
  0%, 36% { opacity: 0; }
  45% { opacity: 1; }
  54% { opacity: 1; }
  64%, 100% { opacity: 0; }
}

/* 中央心形（纯 CSS 绘制，不用 emoji）：合拢时弹出，帷幕打开时放大消散 */
.portal-heart {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 46px;
  height: 46px;
  background: linear-gradient(160deg, #ffffff, #ffd7e6);
  border-radius: 8px;
  transform: translate(-50%, -50%) rotate(45deg) scale(0);
  filter: drop-shadow(0 0 16px rgba(255, 214, 226, 0.85))
    drop-shadow(0 6px 18px rgba(173, 56, 96, 0.5));
  animation: heart-cycle 1.7s var(--ease-out) both;
}
/* 旋转 45° 的方块 + 两个半圆 = 经典 CSS 心形 */
.portal-heart::before,
.portal-heart::after {
  content: '';
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: inherit;
}
.portal-heart::before {
  top: -50%;
  left: 0;
}
.portal-heart::after {
  left: -50%;
  top: 0;
}

@keyframes heart-cycle {
  0%, 38% {
    transform: translate(-50%, -50%) rotate(45deg) scale(0);
    opacity: 0;
  }
  47% {
    transform: translate(-50%, -50%) rotate(45deg) scale(1.15);
    opacity: 1;
  }
  53% {
    transform: translate(-50%, -50%) rotate(45deg) scale(1.02);
    opacity: 1;
  }
  66% {
    transform: translate(-50%, -50%) rotate(45deg) scale(1.55);
    opacity: 0;
  }
  100% {
    transform: translate(-50%, -50%) rotate(45deg) scale(1.55);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .login-portal {
    display: none;
  }
}
</style>
