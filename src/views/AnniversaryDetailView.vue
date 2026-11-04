<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAnniversaryStore } from '@/stores/anniversary'
import {
  formatDateCN,
  weekdayCN,
  daysBetween,
  fullYearsPassed,
  daysUntil
} from '@/utils/date'
import { getTypeMeta } from '@/constants/anniversary'
import { showToast } from '@/utils/toast'
import { lunarDateCN, lunarToSolarISO, lunarLeapMonth, solarToLunar, lunarDaysUntil } from '@/utils/lunar'
import { getLunarRef, setLunarRef } from '@/utils/lunarStorage'
import {
  uploadImage,
  getCloudPhotos,
  deleteCloudPhoto,
  ACCEPT_IMAGE_TYPES,
  MAX_IMAGE_SIZE
} from '@/api/upload'
import ImageCropper from '@/components/ImageCropper.vue'

const route = useRoute()
const router = useRouter()
const store = useAnniversaryStore()

const showDeleteConfirm = ref(false)

// —— 自定义主题背景 ——
const showBgPanel = ref(false)
const uploading = ref(false)
const fileInput = ref(null)
const cloudPhotos = ref([])
const cloudLoaded = ref(false)
const cloudLoading = ref(false)
const cloudHasMore = ref(false)

// 面板打开期间的临时预览背景：
// null  = 面板未打开（Hero 使用已保存的 item.bgImage）
// ''    = 预览默认渐变
// 其他  = 预览该图片 URL
const previewBg = ref(null)

// —— 图片裁剪 ——
const cropperVisible = ref(false)
const cropperFile = ref(null)
const cropperSrc = ref('')
// 标记裁剪来源：local=本地新文件；cloud=云端已有的图（裁剪后作为新图上传）
const cropperSource = ref('local')
const croppingPhoto = ref(null)

// —— 删除云端图片 ——
const photoToDelete = ref(null)
const deletingPhoto = ref(false)

onMounted(async () => {
  await store.fetchList()
  if (!item.value) {
    showToast('纪念日不存在')
    router.replace('/')
  }
})

const item = computed(() =>
  store.decoratedList.find((i) => String(i.id) === String(route.params.id))
)

// 纪念日视图：按农历保存的默认显示农历；阳历保存的也可切农历即时转换查看
const lunarRef = computed(() => (item.value ? getLunarRef(item.value.id) : null))
const view = ref(lunarRef.value ? 'lunar' : 'solar')
function toggleView() {
  view.value = view.value === 'lunar' ? 'solar' : 'lunar'
}

// 主日期文案：农历视图显示农历日期（有记录用记录；阳历记录即时转换），阳历视图显示公历
const heroDateText = computed(() => {
  if (!item.value) return ''
  if (view.value !== 'lunar') return formatDateCN(item.value.date)
  const lr = lunarRef.value
  if (lr) return lunarDateCN(lr.y, lr.m, lr.d)
  const [yy, mm, dd] = (item.value.date || '').split('-').map(Number)
  const sol = solarToLunar(yy, mm, dd)
  return sol ? lunarDateCN(sol.year, sol.month, sol.day, sol.isLeap) : formatDateCN(item.value.date)
})
// 星期（农历视图下不显示）
const heroWeekday = computed(() => {
  if (!item.value) return ''
  if (view.value === 'lunar') return ''
  return weekdayCN(item.value.date)
})
// 是否为「阳历转农历」查看（无农历记录）
const isSolarToLunar = computed(() => view.value === 'lunar' && !lunarRef.value)

// 倒计时跟随视图：农历记录→农历视图按农历同日滚动、阳历视图按公历同日滚动；
// 阳历记录两种视图都按公历（农历为纯查看转换）
const viewCountdown = computed(() => {
  const lr = lunarRef.value
  if (!item.value) return null
  if (lr && view.value === 'lunar') return lunarDaysUntil(lr, item.value.isYearly)
  if (lr && view.value === 'solar') return daysUntil(item.value.date, item.value.isYearly)
  return item.value.countdown
})
// 农历视图下今年/明年农历同日对应公历（提示用）
const thisYearLunar = computed(() => {
  const lr = lunarRef.value
  if (!lr || view.value !== 'lunar' || !item.value) return ''
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const y0 = today.getFullYear()
  for (let y = y0; y <= y0 + 1; y++) {
    const useLeap = lunarLeapMonth(y) === lr.m
    const iso = lunarToSolarISO(y, lr.m, lr.d, useLeap)
    if (!iso) continue
    const d = new Date(iso)
    d.setHours(0, 0, 0, 0)
    if (d >= today) return iso
  }
  return ''
})

// Hero 实际显示的背景：面板打开时跟随预览，否则使用已保存值
const effectiveBg = computed(() => {
  if (showBgPanel.value && previewBg.value !== null) return previewBg.value
  return item.value?.bgImage || ''
})

// 预览是否有未保存的改动
const bgDirty = computed(() => previewBg.value !== null && previewBg.value !== (item.value?.bgImage || ''))

const typeMeta = computed(() => (item.value ? getTypeMeta(item.value.type) : null))
const years = computed(() => (item.value ? fullYearsPassed(item.value.date) : 0))

const accent = computed(() => item.value?.color || 'var(--pink)')

// 重要的天数里程碑
const MILESTONES = [100, 520, 1000, 1314, 2000, 3000, 5000]

const milestones = computed(() => {
  if (!item.value) return []
  const start = new Date(item.value.date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return MILESTONES.map((days) => {
    const d = new Date(start)
    d.setDate(d.getDate() + days)
    const diff = daysBetween(today, d)
    return {
      days,
      date: d,
      state: diff > 0 ? 'future' : diff === 0 ? 'today' : 'past',
      diff
    }
  })
})

// 已经度过的周年列表（近 5 个）
const anniversaries = computed(() => {
  if (!item.value || !item.value.isYearly) return []
  const start = new Date(item.value.date)
  const result = []
  for (let n = Math.max(1, years.value - 4); n <= years.value; n++) {
    const d = new Date(start)
    d.setFullYear(start.getFullYear() + n)
    result.push({ n, date: new Date(d) })
  }
  return result
})

async function onConfirmDelete() {
  try {
    await store.remove(route.params.id)
    setLunarRef(route.params.id, null)
    showDeleteConfirm.value = false
    showToast('已删除')
    router.push('/')
  } catch (e) {
    showToast(e?.message || '删除失败，请稍后再试')
  }
}

// —— 自定义主题背景相关操作 ——

async function openBgPanel() {
  // 进入面板：预览值初始为当前已保存背景，点图即实时预览
  previewBg.value = item.value?.bgImage || ''
  showBgPanel.value = true
  // 每次打开都重新拉取，避免旧会话遗留的 cloudHasMore/cloudLoaded 状态
  await loadCloudPhotos()
}

/** 关闭面板并丢弃预览（点遮罩 / 取消），Hero 自动恢复已保存背景 */
function cancelPanel() {
  showBgPanel.value = false
  previewBg.value = null
}

/** 确认：把预览中的背景真正保存 */
async function confirmPanel() {
  if (uploading.value) return
  const next = previewBg.value || ''
  const current = item.value?.bgImage || ''

  if (next !== current) {
    try {
      await store.update(route.params.id, { bgImage: next })
      showToast(next ? '背景已更新' : '已恢复默认背景')
    } catch {
      showToast('设置失败，请稍后再试')
      return
    }
  }
  showBgPanel.value = false
  previewBg.value = null
}

function pickLocalFile() {
  fileInput.value?.click()
}

async function onFileChange(event) {
  const file = event.target.files?.[0]
  // 清空 value，使同一张图也能再次触发 change
  event.target.value = ''
  if (!file) return

  if (!ACCEPT_IMAGE_TYPES.includes(file.type)) {
    showToast('仅支持 JPG / PNG / WEBP / GIF 格式')
    return
  }
  if (file.size > MAX_IMAGE_SIZE) {
    showToast('图片不能超过 8MB')
    return
  }

  // 选择后先进入裁剪，确认后再上传
  cropperSource.value = 'local'
  cropperFile.value = file
  cropperSrc.value = ''
  cropperVisible.value = true
}

/** 裁剪确认：上传裁剪后的图片并设为背景 */
async function onCropped({ file }) {
  uploading.value = true
  try {
    const result = await uploadImage(file, { anniversaryId: route.params.id })
    await store.update(route.params.id, { bgImage: result.url })

    // 上传响应不含 id（id 以 GET /photos 列表为准），本地插入仅作即时预览
    cloudPhotos.value.unshift({
      key: result.key,
      url: result.url,
      name: file.name,
      size: file.size
    })
    cloudLoaded.value = true

    // 上传即确认意图：直接保存并关闭面板
    previewBg.value = null
    showBgPanel.value = false
    showToast('背景已更新')
  } catch (e) {
    showToast(e?.message || '上传失败，请稍后再试')
  } finally {
    uploading.value = false
  }
}

/** 裁剪云端已有的图片：裁剪结果作为一张新图上传 */
function cropCloudPhoto(photo) {
  cropperSource.value = 'cloud'
  cropperFile.value = null
  cropperSrc.value = photo.url
  croppingPhoto.value = photo
  cropperVisible.value = true
}

async function loadCloudPhotos() {
  cloudLoading.value = true
  try {
    // 首拉不传 lastId，取最新一页
    const result = await getCloudPhotos()
    cloudPhotos.value = result.list || []
    cloudHasMore.value = !!result.hasMore
    cloudLoaded.value = true
  } catch {
    showToast('云端相册加载失败')
  } finally {
    cloudLoading.value = false
  }
}

/** 加载更多：传当前列表最后一张图片的 id，续拉更早的一页 */
async function loadMoreCloudPhotos() {
  const last = cloudPhotos.value[cloudPhotos.value.length - 1]
  // 后端未返回 id 时无法续拉，隐藏按钮降级为单页展示
  if (!last?.id) {
    cloudHasMore.value = false
    return
  }
  if (cloudLoading.value) return
  cloudLoading.value = true
  try {
    const result = await getCloudPhotos({ lastId: last.id })
    cloudPhotos.value.push(...(result.list || []))
    cloudHasMore.value = !!result.hasMore
  } catch {
    showToast('加载更多失败，请稍后再试')
  } finally {
    cloudLoading.value = false
  }
}

/** 点击云端缩略图：仅实时预览，不保存，面板保持打开 */
function pickCloudPhoto(photo) {
  previewBg.value = photo.url
}

/** 预览默认背景（粉色渐变），确认后才真正保存 */
function previewDefaultBg() {
  previewBg.value = ''
}

// —— 删除云端图片 ——

function askDeletePhoto(photo) {
  photoToDelete.value = photo
}

async function confirmDeletePhoto() {
  if (!photoToDelete.value) return
  deletingPhoto.value = true
  try {
    const result = await deleteCloudPhoto(photoToDelete.value.key)

    // 从本地相册列表移除
    cloudPhotos.value = cloudPhotos.value.filter(
      (p) => p.key !== photoToDelete.value.key
    )

    const deletedUrl = photoToDelete.value.url

    // 预览中正在用这张图：预览恢复默认
    if (previewBg.value === deletedUrl) {
      previewBg.value = ''
    }

    // 已保存的背景用这张图：清空保存值
    const affected = result?.affectedIds || []
    if (
      item.value?.bgImage === deletedUrl ||
      affected.some((id) => String(id) === String(route.params.id))
    ) {
      await store.update(route.params.id, { bgImage: '' })
      showToast('图片已删除，背景已恢复默认')
    } else {
      showToast('图片已删除')
    }

    photoToDelete.value = null
  } catch (e) {
    showToast(e?.message || '删除失败，请稍后再试')
  } finally {
    deletingPhoto.value = false
  }
}
</script>

<template>
  <div class="page detail-page" v-if="item">
    <header class="page-nav">
      <button class="back" type="button" aria-label="返回" @click="router.back()">‹</button>
      <h2>纪念日详情</h2>
      <span class="placeholder"></span>
    </header>

    <!-- 顶部主区 -->
    <section class="hero pop-in" :style="{ '--accent': accent }">
      <div
        v-if="effectiveBg"
        class="hero-bgimg"
        :style="{ backgroundImage: `url('${effectiveBg}')` }"
      ></div>
      <div class="hero-mask" :class="{ dark: !!effectiveBg }"></div>

      <div class="hero-content">
        <span class="type-tag">{{ typeMeta?.label }}</span>
        <h1 class="title">{{ item.title }}</h1>
        <div class="date-row">
          <p class="date">
            {{ heroDateText }}
            <template v-if="heroWeekday"> · {{ heroWeekday }}</template>
            <span v-if="view === 'lunar' && !isSolarToLunar" class="lunar-badge">农历</span>
            <span v-else-if="isSolarToLunar" class="lunar-badge solar-badge">阳历转农历</span>
          </p>
          <!-- 历法切换：所有纪念日可切农历/阳历查看 -->
          <button type="button" class="view-toggle" @click="toggleView">
            {{ view === 'lunar' ? '切到阳历' : '切到农历' }}
          </button>
        </div>
        <p v-if="!isSolarToLunar && view === 'lunar' && thisYearLunar" class="hero-lunar-note">
          今年农历同日：{{ thisYearLunar }}
        </p>
        <p v-else-if="isSolarToLunar" class="hero-lunar-note">
          按阳历保存，农历为即时转换；每年仍按阳历 {{ formatDateCN(item.date) }} 过
        </p>

        <div class="hero-days">
          <span class="days-num">{{ item.passed }}</span>
          <span class="days-unit">天</span>
        </div>
        <p v-if="years" class="years-chip">第 {{ years }} 年</p>
      </div>

      <button
        type="button"
        class="bg-edit-btn"
        :title="item.bgImage ? '更换主题背景' : '设置主题背景'"
        @click="openBgPanel"
      >
        <span aria-hidden="true">📷</span>
      </button>
    </section>

    <!-- 核心数字 -->
    <section class="numbers">
      <div class="num-card">
        <strong :style="{ '--accent': accent }">{{ item.passed }}</strong>
        <span>已经过去</span>
      </div>
      <div class="num-card" v-if="item.isYearly">
        <strong :style="{ '--accent': accent }">
          {{ viewCountdown === null ? '—' : viewCountdown }}
        </strong>
        <span>距下一次{{ view === 'lunar' && lunarRef ? '（农历）' : '' }}</span>
      </div>
      <div class="num-card" v-if="item.isYearly">
        <strong :style="{ '--accent': accent }">{{ years }}</strong>
        <span>共度周年</span>
      </div>
    </section>

    <!-- 倒计时提示 -->
    <section v-if="item.isYearly && viewCountdown !== null" class="banner" :style="{ '--accent': accent }">
      <template v-if="viewCountdown === 0">
        就是今天！祝你们{{ typeMeta?.label }}快乐
      </template>
      <template v-else>
        还有 <em>{{ viewCountdown }}</em> 天就是{{ item.title }}啦，记得准备惊喜～
      </template>
    </section>

    <!-- 备注 -->
    <section v-if="item.note" class="note-block">
      <h3 class="block-title">我们的故事</h3>
      <p>{{ item.note }}</p>
    </section>

    <!-- 已度过的周年 -->
    <section v-if="anniversaries.length" class="note-block">
      <h3 class="block-title">走过的周年</h3>
      <ul class="year-list">
        <li v-for="a in anniversaries" :key="a.n" :style="{ '--accent': accent }">
          <span class="year-n">第 {{ a.n }} 周年</span>
          <span class="year-d">{{ formatDateCN(a.date) }}</span>
          <span class="year-w">{{ weekdayCN(a.date) }}</span>
        </li>
      </ul>
    </section>

    <!-- 里程碑 -->
    <section class="note-block">
      <h3 class="block-title">爱的里程碑</h3>
      <ul class="milestone-list">
        <li
          v-for="m in milestones"
          :key="m.days"
          :class="m.state"
          :style="{ '--accent': accent }"
        >
          <span class="m-days">{{ m.days }} 天</span>
          <span class="m-date">{{ formatDateCN(m.date) }}</span>
          <span class="m-state">
            <template v-if="m.state === 'past'">已达成</template>
            <template v-else-if="m.state === 'today'">就是今天</template>
            <template v-else>还有 {{ m.diff }} 天</template>
          </span>
        </li>
      </ul>
    </section>

    <!-- 操作按钮 -->
    <div class="actions">
      <router-link :to="`/edit/${item.id}`" class="btn btn-ghost action-btn">
        编辑
      </router-link>
      <button
        type="button"
        class="btn btn-ghost action-btn danger-outline"
        @click="showDeleteConfirm = true"
      >
        删除
      </button>
    </div>

    <!-- 删除确认弹窗 -->
    <transition name="fade">
      <div
        v-if="showDeleteConfirm"
        class="modal-mask"
        @click.self="showDeleteConfirm = false"
      >
        <div class="modal pop-in">
          <div class="modal-icon" aria-hidden="true">♡</div>
          <h3>确定要删除吗？</h3>
          <p>「{{ item.title }}」删除后无法恢复哦</p>
          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" @click="showDeleteConfirm = false">
              再想想
            </button>
            <button type="button" class="btn btn-danger" @click="onConfirmDelete">
              确认删除
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- 自定义主题背景面板 -->
    <transition name="fade">
      <div
        v-if="showBgPanel"
        class="modal-mask"
        @click.self="!uploading && cancelPanel()"
      >
        <div class="bg-panel pop-in">
          <h3 class="panel-title">自定义主题背景</h3>

          <input
            ref="fileInput"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            hidden
            @change="onFileChange"
          />

          <button
            type="button"
            class="upload-row"
            :disabled="uploading"
            @click="pickLocalFile"
          >
            <span class="ur-icon" aria-hidden="true">📁</span>
            <span class="ur-text">
              从本地导入
              <small>JPG / PNG / WEBP / GIF，不超过 8MB，可裁剪</small>
            </span>
            <span class="ur-arrow">›</span>
          </button>

          <div class="cloud-header">
            <span>云端相册</span>
            <button
              type="button"
              class="refresh-btn"
              :disabled="cloudLoading"
              @click="loadCloudPhotos"
            >
              {{ cloudLoading ? '加载中…' : '刷新' }}
            </button>
          </div>

          <div v-if="cloudLoading && !cloudPhotos.length" class="cloud-tip">加载中…</div>
          <div v-else-if="!cloudPhotos.length" class="cloud-tip">
            相册还是空的，先从本地导入一张吧
          </div>
          <template v-else>
            <div class="photo-grid">
              <div
                v-for="photo in cloudPhotos"
                :key="photo.key"
                class="photo-item"
                :class="{ active: photo.url === previewBg }"
              >
                <div class="photo-thumb" :title="`预览「${photo.name}」`" @click="pickCloudPhoto(photo)">
                  <img :src="photo.url" :alt="photo.name" />
                  <span v-if="photo.url === previewBg" class="photo-check">✓</span>
                </div>

                <div class="photo-ops">
                  <button
                    type="button"
                    class="op-btn"
                    title="裁剪此图"
                    @click.stop="cropCloudPhoto(photo)"
                  >
                    ✂
                  </button>
                  <button
                    type="button"
                    class="op-btn op-danger"
                    title="删除此图"
                    @click.stop="askDeletePhoto(photo)"
                  >
                    🗑
                  </button>
                </div>
              </div>
            </div>

            <button
              v-if="cloudHasMore"
              type="button"
              class="load-more-btn"
              :disabled="cloudLoading"
              @click="loadMoreCloudPhotos"
            >
              {{ cloudLoading ? '加载中…' : '加载更多' }}
            </button>
          </template>

          <div class="panel-actions">
            <button
              v-if="previewBg !== ''"
              type="button"
              class="btn btn-ghost"
              :disabled="uploading"
              @click="previewDefaultBg"
            >
              恢复默认
            </button>
            <button
              type="button"
              class="btn btn-ghost"
              :disabled="uploading"
              @click="cancelPanel"
            >
              取消
            </button>
            <button
              type="button"
              class="btn btn-primary"
              :disabled="uploading"
              @click="confirmPanel"
            >
              确认
            </button>
          </div>
        </div>
      </div>
    </transition>

    <ImageCropper
      v-model:visible="cropperVisible"
      :file="cropperFile"
      :src="cropperSrc"
      @confirm="onCropped"
    />

    <transition name="fade">
      <div v-if="photoToDelete" class="modal-mask" @click.self="photoToDelete = null">
        <div class="modal pop-in">
          <div class="modal-icon" aria-hidden="true">☁</div>
          <h3>删除这张云端图片？</h3>
          <p>
            「{{ photoToDelete.name }}」将从云端相册删除，
            {{
              photoToDelete.url === item.bgImage || photoToDelete.url === previewBg
                ? '且它正被选为纪念日背景，背景会恢复默认。'
                : '此操作无法恢复。'
            }}
          </p>
          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" :disabled="deletingPhoto" @click="photoToDelete = null">
              取消
            </button>
            <button type="button" class="btn btn-danger" :disabled="deletingPhoto" @click="confirmDeletePhoto">
              {{ deletingPhoto ? '删除中…' : '确认删除' }}
            </button>
          </div>
        </div>
      </div>
    </transition>

    <transition name="fade">
      <div v-if="uploading" class="modal-mask uploading-mask">
        <div class="uploading-box">
          <span class="spinner"></span>
          <p>正在上传…</p>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.detail-page {
  max-width: 720px;
}

/* Hero */
.hero {
  position: relative;
  border-radius: 28px;
  min-height: 280px;
  padding: 36px 28px 32px;
  text-align: center;
  color: #fff;
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.hero-bgimg {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  z-index: 0;
  transform: scale(1.02);
}

.hero-mask {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 85% 10%, rgba(255, 255, 255, 0.22), transparent 42%),
    linear-gradient(
      145deg,
      var(--accent),
      color-mix(in srgb, var(--accent) 55%, #ffc2d4)
    );
  z-index: 1;
}

.hero-mask.dark {
  background: linear-gradient(
    160deg,
    rgba(36, 18, 32, 0.58) 0%,
    rgba(74, 40, 60, 0.55) 50%,
    rgba(28, 14, 28, 0.75) 100%
  );
}

.hero-content {
  position: relative;
  z-index: 2;
}

.type-tag {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.28);
  padding: 6px 14px;
  border-radius: 999px;
  backdrop-filter: blur(6px);
}

.title {
  margin-top: 14px;
  font-size: clamp(1.6rem, 4.5vw, 2.1rem);
  font-weight: 800;
  letter-spacing: 0.01em;
  line-height: 1.2;
  text-shadow: 0 2px 18px rgba(20, 8, 16, 0.25);
}

.date-row {
  margin-top: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  flex-wrap: wrap;
}
.date {
  font-size: 13.5px;
  letter-spacing: 0.04em;
  opacity: 0.92;
}
/* 农历徽章与提示 */
.lunar-badge {
  margin-left: 6px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  color: var(--rose-500);
  background: rgba(255, 255, 255, 0.18);
  vertical-align: 1px;
}
.lunar-badge.solar-badge {
  color: rgba(255, 255, 255, 0.75);
  background: rgba(42, 52, 68, 0.35);
}
.hero-lunar-note {
  margin-top: 6px;
  font-size: 12px;
  opacity: 0.85;
}
/* 详情页历法切换小按钮 */
.view-toggle {
  padding: 4px 12px;
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: #fff;
  background: rgba(255, 255, 255, 0.14);
  cursor: pointer;
  transition: all 0.25s var(--ease-out);
}
.view-toggle:hover {
  background: var(--rose-500);
  border-color: var(--rose-500);
}

.hero-days {
  margin-top: 22px;
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 8px;
}

.days-num {
  font-family: var(--font-display);
  font-size: clamp(3.6rem, 12vw, 5.2rem);
  font-weight: 600;
  line-height: 0.9;
  letter-spacing: -0.02em;
  text-shadow: 0 8px 32px rgba(20, 8, 16, 0.28);
}

.days-unit {
  font-size: 1.25rem;
  font-weight: 700;
  opacity: 0.9;
}

.years-chip {
  display: inline-block;
  margin-top: 12px;
  padding: 5px 14px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.25);
}

.bg-edit-btn {
  position: absolute;
  top: 14px;
  right: 14px;
  z-index: 3;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  font-size: 16px;
  display: grid;
  place-items: center;
  transition: background 0.2s, transform 0.2s;
}

.bg-edit-btn:hover {
  background: rgba(255, 255, 255, 0.36);
}

.bg-edit-btn:active {
  transform: scale(0.92);
}

/* 数字卡片 */
.numbers {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-top: 16px;
}

.num-card {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: 20px;
  box-shadow: var(--shadow-xs), var(--glass-edge);
  text-align: center;
  padding: 18px 8px 16px;
  transition: transform var(--dur-base) var(--ease-out), box-shadow var(--dur-base) ease;
}

.num-card:hover {
  transform: translateY(-2px);
  background: var(--glass-bg-strong);
  box-shadow: var(--shadow-sm), var(--glass-edge);
  border-color: var(--rose-200);
}

.num-card strong {
  display: block;
  font-family: var(--font-display);
  font-size: clamp(1.6rem, 4vw, 2rem);
  font-weight: 600;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  /* 香槟金 → 该纪念日的强调色，数字也有镀金质感 */
  background: linear-gradient(115deg, #a8763e 0%, #d9b980 35%, var(--accent, var(--rose-500)) 88%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
  filter: drop-shadow(0 2px 10px rgba(150, 100, 60, 0.25));
}

.num-card span {
  display: block;
  margin-top: 8px;
  font-size: 11.5px;
  letter-spacing: 0.08em;
  color: var(--ink-mute);
}

/* 横幅 */
.banner {
  margin-top: 14px;
  background: color-mix(in srgb, var(--accent) 9%, white);
  border: 1px solid color-mix(in srgb, var(--accent) 18%, transparent);
  color: var(--ink);
  border-radius: 18px;
  padding: 16px 18px;
  font-size: 14px;
  line-height: 1.55;
}

.banner em {
  font-style: normal;
  font-family: var(--font-display);
  font-weight: 700;
  color: var(--accent);
  font-size: 1.35em;
  margin: 0 3px;
}

/* 内容区块 */
.note-block {
  margin-top: 16px;
  background: var(--bg-card);
  border: 1px solid var(--hairline);
  border-radius: 22px;
  box-shadow: var(--shadow-xs);
  padding: 20px 18px;
}

.block-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 15px;
  font-weight: 700;
  color: var(--ink);
  margin-bottom: 14px;
  letter-spacing: 0.02em;
}

.block-title::before {
  content: '';
  width: 3px;
  height: 14px;
  border-radius: 2px;
  background: linear-gradient(180deg, var(--rose-500), var(--rose-300));
}

.note-block p {
  font-size: 14.5px;
  line-height: 1.8;
  color: var(--ink-soft);
}

.year-list li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 0;
  border-bottom: 1px solid var(--hairline);
  font-size: 13.5px;
}

.year-list li:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.year-n {
  font-weight: 700;
  color: var(--accent);
  width: 80px;
  flex-shrink: 0;
}

.year-d {
  flex: 1;
  color: var(--ink);
}

.year-w {
  color: var(--ink-mute);
  font-size: 12.5px;
}

.milestone-list li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 14px;
  margin-bottom: 8px;
  font-size: 13.5px;
  background: var(--bg-soft);
  border: 1px solid transparent;
  transition: transform var(--dur-fast) ease;
}

.milestone-list li:last-child {
  margin-bottom: 0;
}

.milestone-list li.past {
  background: color-mix(in srgb, var(--accent) 8%, white);
  border-color: color-mix(in srgb, var(--accent) 12%, transparent);
}

.milestone-list li.today {
  background: color-mix(in srgb, var(--accent) 16%, white);
  border-color: color-mix(in srgb, var(--accent) 28%, transparent);
  font-weight: 700;
}

.m-days {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 15px;
  color: var(--accent);
  width: 72px;
  flex-shrink: 0;
}

.m-date {
  flex: 1;
  color: var(--ink);
}

.m-state {
  color: var(--ink-mute);
  font-size: 12.5px;
}

li.past .m-state {
  color: var(--accent);
}

.actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.action-btn {
  flex: 1;
}

.danger-outline {
  color: #c44a5c;
  border-color: rgba(196, 74, 92, 0.28);
}

.danger-outline:hover:not(:disabled) {
  background: #f4f7fb;
  border-color: rgba(196, 74, 92, 0.45);
}

/* 弹窗 */
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(43, 24, 38, 0.48);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
}

.modal {
  width: 100%;
  max-width: 340px;
  background: #fff;
  border-radius: 24px;
  padding: 30px 22px 22px;
  text-align: center;
  box-shadow: var(--shadow-xl);
  border: 1px solid var(--hairline);
}

.modal-icon {
  font-family: var(--font-display);
  font-size: 42px;
  line-height: 1;
  margin-bottom: 8px;
  color: var(--rose-500);
}

.modal h3 {
  font-size: 17px;
  font-weight: 700;
  margin-bottom: 8px;
  color: var(--ink);
}

.modal p {
  font-size: 13.5px;
  color: var(--ink-mute);
  margin-bottom: 22px;
  line-height: 1.55;
}

.modal-actions {
  display: flex;
  gap: 10px;
}

.modal-actions .btn {
  flex: 1;
  padding: 11px 0;
  font-size: 14px;
}

.bg-panel {
  width: 100%;
  max-width: 400px;
  max-height: 86vh;
  overflow-y: auto;
  background: #fff;
  border-radius: 24px;
  padding: 22px 20px 18px;
  box-shadow: var(--shadow-xl);
  border: 1px solid var(--hairline);
}

.panel-title {
  font-size: 17px;
  font-weight: 700;
  text-align: center;
  margin-bottom: 18px;
  color: var(--ink);
}

.upload-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 14px;
  border: 1.5px dashed var(--rose-200);
  border-radius: 16px;
  background: var(--rose-50);
  transition: border-color 0.2s, background 0.2s;
}

.upload-row:hover:not(:disabled) {
  border-color: var(--rose-400);
  background: color-mix(in srgb, var(--rose-400) 8%, white);
}

.upload-row:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.ur-icon {
  font-size: 22px;
}

.ur-text {
  flex: 1;
  text-align: left;
  font-size: 14.5px;
  font-weight: 600;
  color: var(--ink);
}

.ur-text small {
  display: block;
  font-size: 11.5px;
  font-weight: 400;
  color: var(--ink-mute);
  margin-top: 3px;
}

.ur-arrow {
  font-size: 22px;
  color: var(--ink-mute);
}

.cloud-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 20px 0 12px;
  font-size: 14.5px;
  font-weight: 700;
  color: var(--ink);
}

.refresh-btn {
  font-size: 12.5px;
  color: var(--rose-600);
  background: var(--rose-50);
  padding: 5px 14px;
  border-radius: 999px;
  border: 1px solid var(--rose-100);
  transition: background 0.2s;
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.cloud-tip {
  font-size: 13px;
  color: var(--ink-mute);
  text-align: center;
  padding: 26px 10px;
  background: var(--bg-soft);
  border-radius: 14px;
}

.load-more-btn {
  display: block;
  width: 100%;
  margin-top: 12px;
  padding: 10px 0;
  font-size: 13px;
  color: var(--rose-600);
  background: #fff;
  border: 1px solid var(--rose-200);
  border-radius: 12px;
  transition: background 0.2s, opacity 0.2s;
}

.load-more-btn:hover:not(:disabled) {
  background: var(--rose-50);
}

.load-more-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.photo-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 9px;
}

.photo-item {
  position: relative;
  border-radius: 14px;
  border: 2px solid transparent;
  background: #edf1f6;
  transition: transform 0.15s, border-color 0.15s;
}

.photo-thumb {
  position: relative;
  aspect-ratio: 1;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
}

.photo-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.25s ease;
}

.photo-thumb:hover img {
  transform: scale(1.06);
}

.photo-item:hover {
  transform: scale(1.02);
}

.photo-item.active {
  border-color: var(--rose-500);
}

.photo-check {
  position: absolute;
  right: 5px;
  bottom: 5px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--rose-500);
  color: #fff;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.photo-ops {
  position: absolute;
  top: 5px;
  right: 5px;
  display: flex;
  gap: 4px;
  opacity: 0;
  transform: translateY(-3px);
  transition: opacity 0.2s, transform 0.2s;
}

.photo-item:hover .photo-ops,
.photo-item:focus-within .photo-ops {
  opacity: 1;
  transform: translateY(0);
}

@media (hover: none) {
  .photo-ops {
    opacity: 1;
    transform: none;
  }
}

.op-btn {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(50, 32, 44, 0.62);
  backdrop-filter: blur(4px);
  color: #fff;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, transform 0.15s;
}

.op-btn:hover {
  background: rgba(50, 32, 44, 0.85);
}

.op-btn:active {
  transform: scale(0.88);
}

.op-danger:hover {
  background: #e23d5b;
}

.uploading-mask {
  z-index: 300;
  background: rgba(50, 32, 44, 0.45);
}

.uploading-box {
  background: #fff;
  border-radius: 22px;
  padding: 28px 36px;
  text-align: center;
  box-shadow: var(--shadow-lg);
}

.uploading-box p {
  margin-top: 14px;
  font-size: 14px;
  color: var(--ink-mute);
}

.spinner {
  display: inline-block;
  width: 34px;
  height: 34px;
  border: 3px solid var(--rose-100);
  border-top-color: var(--rose-500);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.panel-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.panel-actions .btn {
  flex: 1;
}

@media (max-width: 420px) {
  .numbers {
    gap: 8px;
  }

  .num-card {
    padding: 14px 4px 12px;
  }

  .num-card span {
    font-size: 10.5px;
    letter-spacing: 0.02em;
  }
}
</style>
