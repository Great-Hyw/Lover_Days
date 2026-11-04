<script setup>
import SideBar from '@/components/SideBar.vue'
</script>

<template>
  <div class="layout-root">
    <SideBar />
    <div class="app-main">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </div>
  </div>
</template>

<style scoped>
@media (min-width: 1024px) {
  .app-main {
    margin-left: 232px;
  }
}

/* 手机/平板：顶部为汉堡按钮预留空间，避免遮挡页面标题/返回键 */
@media (max-width: 1023px) {
  .app-main {
    padding-top: 52px;
  }
}
</style>
