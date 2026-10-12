<script setup>
import FloatingHearts from '@/components/FloatingHearts.vue'
import Toast from '@/components/Toast.vue'
</script>

<template>
  <FloatingHearts />
  <router-view v-slot="{ Component }">
    <transition name="fade" mode="out-in">
      <component :is="Component" />
    </transition>
  </router-view>
  <Toast />
</template>
