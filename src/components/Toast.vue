<script setup>
import { toastState } from '@/utils/toast'
</script>

<template>
  <transition name="toast">
    <div v-if="toastState.visible" class="toast">
      <span class="toast-icon">💗</span>
      {{ toastState.message }}
    </div>
  </transition>
</template>

<style scoped>
.toast {
  position: fixed;
  left: 50%;
  bottom: 80px;
  transform: translateX(-50%);
  z-index: 999;
  background: rgba(34, 44, 60, 0.92);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: #fff;
  padding: 12px 24px;
  border-radius: var(--radius-full);
  font-size: 14px;
  letter-spacing: 0.3px;
  display: flex;
  align-items: center;
  gap: 7px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow: 0 12px 36px rgba(24, 8, 18, 0.28);
  white-space: nowrap;
}

.toast-icon {
  font-size: 16px;
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 16px);
}
</style>
