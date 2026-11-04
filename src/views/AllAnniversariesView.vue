<script setup>
import { computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useAnniversaryStore } from '@/stores/anniversary'
import AnniversaryCard from '@/components/AnniversaryCard.vue'
import { formatDateCN } from '@/utils/date'

const store = useAnniversaryStore()
const { loading, count, decoratedList } = storeToRefs(store)

onMounted(() => {
  store.fetchList()
})

// 按 date 升序（后端已按 date 升序返回，这里再保险排序一次）
const sortedList = computed(() =>
  [...decoratedList.value].sort((a, b) => new Date(a.date) - new Date(b.date))
)

// 按年份分组展示
const yearGroups = computed(() => {
  const groups = {}
  sortedList.value.forEach((item) => {
    const year = new Date(item.date).getFullYear()
    if (!groups[year]) groups[year] = []
    groups[year].push(item)
  })
  return Object.entries(groups).sort((a, b) => Number(a[0]) - Number(b[0]))
})
</script>

<template>
  <div class="all-page">
    <div class="relative mx-auto max-w-[1180px] px-5 pb-28 pt-8 sm:px-8 lg:px-12 lg:pt-12">
      <!-- 顶栏 -->
      <header class="mb-8 flex items-end justify-between gap-6 lg:mb-10">
        <div>
          <p class="text-[11px] font-bold uppercase tracking-[0.4em]" style="color: var(--rose-400)">
            All&nbsp;Anniversaries
          </p>
          <h1 class="mt-2 font-display text-3xl font-semibold leading-none tracking-tight sm:text-4xl" style="color: var(--ink)">
            全部<span style="color: var(--rose-500)">纪念日</span>
          </h1>
          <p class="mt-2 text-sm" style="color: var(--ink-soft)">
            共 {{ count }} 个，按日期从早到晚排列
          </p>
          <div class="flourish mt-4 w-48 sm:w-60" aria-hidden="true">✦</div>
        </div>

        <router-link
          to="/add"
          class="hidden shrink-0 items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white transition duration-300 hover:-translate-y-0.5 active:scale-95 lg:inline-flex"
          style="background: linear-gradient(135deg, var(--rose-500), var(--rose-600)); box-shadow: 0 8px 22px rgba(173,56,96,0.28)"
        >
          <span class="text-base leading-none" aria-hidden="true">＋</span>添加纪念日
        </router-link>
      </header>

      <!-- 加载中 -->
      <div v-if="loading" class="grid min-h-[50vh] place-items-center">
        <p class="text-sm tracking-[0.3em]" style="color: var(--ink-mute)">加载中…</p>
      </div>

      <template v-else-if="count">
        <!-- 按年份分组 -->
        <div v-for="([year, items]) in yearGroups" :key="year" class="year-group">
          <!-- 年份标题 -->
          <div class="year-header flex items-center gap-4 mb-5">
            <span class="text-gilt text-lg" aria-hidden="true">✦</span>
            <span class="year-num text-gilt font-display text-3xl font-semibold">{{ year }}</span>
            <span class="flex-1 h-px" style="background: linear-gradient(90deg, var(--hairline-strong), transparent)"></span>
            <span class="text-xs font-bold" style="color: var(--ink-mute)">{{ items.length }} 个</span>
          </div>

          <!-- 卡片网格 -->
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AnniversaryCard
              v-for="item in items"
              :key="item.id"
              :item="item"
            />
          </div>
        </div>
      </template>

      <!-- 空状态 -->
      <section v-else class="grid min-h-[60vh] place-items-center text-center">
        <div>
          <div
            class="mx-auto grid h-32 w-32 animate-float-slow place-items-center rounded-full text-6xl"
            style="background: linear-gradient(135deg, var(--rose-400), var(--rose-600)); box-shadow: var(--shadow-lg)"
          >
            💌
          </div>
          <h3 class="mt-8 text-2xl font-black" style="color: var(--ink)">还没有纪念日</h3>
          <p class="mt-2 text-sm" style="color: var(--ink-soft)">添加第一个属于你们的日子吧</p>
          <router-link to="/add" class="btn btn-primary mt-7">
            ＋ 添加纪念日
          </router-link>
        </div>
      </section>
    </div>

    <!-- 移动端悬浮添加按钮 -->
    <router-link
      v-if="count"
      to="/add"
      class="fixed bottom-7 right-6 z-40 grid h-14 w-14 place-items-center rounded-full text-2xl font-bold text-white transition-transform duration-300 active:scale-90 lg:hidden"
      style="background: linear-gradient(135deg, var(--rose-500), var(--rose-600)); box-shadow: 0 12px 32px rgba(173,56,96,0.35)"
      aria-label="添加纪念日"
    >
      ＋
    </router-link>
  </div>
</template>

<style scoped>
.year-group {
  margin-bottom: 40px;
}

.year-num {
  font-family: var(--font-display);
  letter-spacing: 1px;
}

@media (max-width: 1023px) {
  .all-page {
    padding-bottom: 100px;
  }
}
</style>
