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
  background: rgba(74, 59, 71, 0.92);
  color: #fff;
  padding: 12px 22px;
  border-radius: 999px;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 6px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.18);
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
