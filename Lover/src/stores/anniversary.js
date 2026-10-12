import { defineStore } from 'pinia'
import {
  getAnniversaryList,
  createAnniversary,
  updateAnniversary,
  deleteAnniversary
} from '@/api/anniversary'
import { daysPassed, daysUntil } from '@/utils/date'

const MAIN_ID_KEY = 'main_anniversary_id'

export const useAnniversaryStore = defineStore('anniversary', {
  state: () => ({
    list: [],
    loading: false,
    loaded: false,
    // 用户自己选定的首页主卡片 id（本地持久化）
    mainId: localStorage.getItem(MAIN_ID_KEY) || ''
  }),

  getters: {
    /** 为每条纪念日附加展示用的计算字段 */
    decoratedList(state) {
      return state.list.map((item) => {
        const passed = daysPassed(item.date)
        const countdown = daysUntil(item.date, item.isYearly)
        return {
          ...item,
          passed,
          countdown,
          // 展示状态：today 今天 | upcoming 即将到来 | past 已度过
          status: passed === 0 ? 'today' : countdown !== null && item.isYearly ? 'yearly' : 'past'
        }
      })
    },

    /** 即将到来（按倒计时天数升序，年度重复的纪念日） */
    upcoming() {
      return this.decoratedList
        .filter((i) => i.isYearly && i.countdown !== null)
        .sort((a, b) => a.countdown - b.countdown)
    },

    /** 已经度过的日子（按已过天数降序，最近度过的在前） */
    pastDays() {
      return this.decoratedList
        .filter((i) => !i.isYearly || i.countdown === null)
        .sort((a, b) => b.passed - a.passed)
    },

    /**
     * 首页主卡片展示的纪念日：
     * 优先使用用户自己选定的 mainId；若已失效（被删除）则回退到
     * type=love 的第一条，再否则取第一条。
     *
     * 后端对接说明：mainId 属于用户偏好，后端可提供
     *   GET /user/preferences -> { mainAnniversaryId }
     *   PUT /user/preferences  { mainAnniversaryId }
     * Mock 模式下保存在 localStorage（key: main_anniversary_id）。
     */
    mainAnniversary() {
      if (this.mainId) {
        const selected = this.decoratedList.find(
          (i) => String(i.id) === String(this.mainId)
        )
        if (selected) return selected
      }
      const love = this.decoratedList.find((i) => i.type === 'love')
      return love || this.decoratedList[0] || null
    },

    count(state) {
      return state.list.length
    }
  },

  actions: {
    async fetchList(force = false) {
      if (this.loading || (this.loaded && !force)) return
      this.loading = true
      try {
        this.list = await getAnniversaryList()
        this.loaded = true
      } finally {
        this.loading = false
      }
    },

    /** 切换首页主卡片并持久化选择 */
    setMainId(id) {
      this.mainId = String(id)
      localStorage.setItem(MAIN_ID_KEY, String(id))
    },

    async add(data) {
      const created = await createAnniversary(data)
      this.list.push(created)
      return created
    },

    async update(id, data) {
      const updated = await updateAnniversary(id, data)
      const index = this.list.findIndex((i) => String(i.id) === String(id))
      if (index !== -1) {
        this.list[index] = updated
      }
      return updated
    },

    async remove(id) {
      await deleteAnniversary(id)
      this.list = this.list.filter((i) => String(i.id) !== String(id))
    }
  }
})
