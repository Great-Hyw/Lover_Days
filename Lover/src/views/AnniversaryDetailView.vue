<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAnniversaryStore } from '@/stores/anniversary'
import {
  formatDateCN,
  weekdayCN,
  daysBetween,
  fullYearsPassed
} from '@/utils/date'
import { getTypeMeta } from '@/constants/anniversary'
import { showToast } from '@/utils/toast'
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
  await store.remove(route.params.id)
  showDeleteConfirm.value = false
  showToast('已删除')
  router.push('/')
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
  <div class="page" v-if="item">
    <header class="nav-bar">
      <button class="back" @click="router.back()">‹</button>
      <h2>纪念日详情</h2>
      <span class="placeholder"></span>
    </header>

    <!-- 顶部主区 -->
    <section class="hero" :style="{ '--accent': accent }">
      <!-- 自定义背景图（面板打开时跟随预览） -->
      <div
        v-if="effectiveBg"
        class="hero-bgimg"
        :style="{ backgroundImage: `url('${effectiveBg}')` }"
      ></div>
      <!-- 遮罩：有背景图时用深色遮罩保证文字可读 -->
      <div class="hero-mask" :class="{ dark: !!effectiveBg }"></div>

      <div class="hero-content">
        <div class="hero-glow"></div>
        <span class="big-icon heartbeat">{{ item.icon || typeMeta?.icon }}</span>
        <h1 class="title">{{ item.title }}</h1>
        <span class="type-tag">{{ typeMeta?.label }}</span>
        <p class="date">
          {{ formatDateCN(item.date) }} · {{ weekdayCN(item.date) }}
        </p>
      </div>

      <!-- 更换主题背景 -->
      <button
        type="button"
        class="bg-edit-btn"
        :title="item.bgImage ? '更换主题背景' : '设置主题背景'"
        @click="openBgPanel"
      >
        📷
      </button>
    </section>

    <!-- 核心数字 -->
    <section class="numbers">
      <div class="num-card">
        <strong :style="{ color: accent }">{{ item.passed }}</strong>
        <span>已经过去（天）</span>
      </div>
      <div class="num-card" v-if="item.isYearly">
        <strong :style="{ color: accent }">
          {{ item.countdown === null ? '—' : item.countdown }}
        </strong>
        <span>距下一次（天）</span>
      </div>
      <div class="num-card" v-if="item.isYearly">
        <strong :style="{ color: accent }">{{ years }}</strong>
        <span>共度周年</span>
      </div>
    </section>

    <!-- 倒计时提示 -->
    <section v-if="item.isYearly && item.countdown !== null" class="banner">
      <template v-if="item.countdown === 0">
        🎉 就是今天！祝你们{{ typeMeta?.label }}快乐
      </template>
      <template v-else>
        还有 <em>{{ item.countdown }}</em> 天就是{{ item.title }}啦，记得准备惊喜～
      </template>
    </section>

    <!-- 备注 -->
    <section v-if="item.note" class="note-block">
      <h3 class="block-title">📝 我们的故事</h3>
      <p>{{ item.note }}</p>
    </section>

    <!-- 已度过的周年 -->
    <section v-if="anniversaries.length" class="note-block">
      <h3 class="block-title">🎀 走过的周年</h3>
      <ul class="year-list">
        <li v-for="a in anniversaries" :key="a.n">
          <span class="year-n">第 {{ a.n }} 周年</span>
          <span class="year-d">{{ formatDateCN(a.date) }}</span>
          <span class="year-w">{{ weekdayCN(a.date) }}</span>
        </li>
      </ul>
    </section>

    <!-- 里程碑 -->
    <section class="note-block">
      <h3 class="block-title">🌟 爱的里程碑</h3>
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
            <template v-else-if="m.state === 'today'">就是今天 🎊</template>
            <template v-else>还有 {{ m.diff }} 天</template>
          </span>
        </li>
      </ul>
    </section>

    <!-- 操作按钮 -->
    <div class="actions">
      <router-link :to="`/edit/${item.id}`" class="btn btn-ghost action-btn">
        ✏️ 编辑
      </router-link>
      <button
        type="button"
        class="btn btn-ghost action-btn"
        @click="showDeleteConfirm = true"
      >
        🗑 删除
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
          <div class="modal-icon">🥺</div>
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

          <!-- 隐藏的文件选择框 -->
          <input
            ref="fileInput"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            hidden
            @change="onFileChange"
          />

          <!-- 本地导入 -->
          <button
            type="button"
            class="upload-row"
            :disabled="uploading"
            @click="pickLocalFile"
          >
            <span class="ur-icon">📁</span>
            <span class="ur-text">
              从本地导入
              <small>JPG / PNG / WEBP / GIF，不超过 8MB，可裁剪</small>
            </span>
            <span class="ur-arrow">›</span>
          </button>

          <!-- 云端相册（后端接入阿里云 OSS / 阿里云相册） -->
          <div class="cloud-header">
            <span>☁️ 云端相册</span>
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

              <!-- 图片操作：裁剪 / 删除 -->
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

          <!-- 底部操作：点图即时预览，确认后才保存 -->
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

    <!-- 图片裁剪 -->
    <ImageCropper
      v-model:visible="cropperVisible"
      :file="cropperFile"
      :src="cropperSrc"
      @confirm="onCropped"
    />

    <!-- 删除云端图片确认 -->
    <transition name="fade">
      <div v-if="photoToDelete" class="modal-mask" @click.self="photoToDelete = null">
        <div class="modal pop-in">
          <div class="modal-icon">☁️</div>
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

    <!-- 上传中遮罩 -->
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
.nav-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0 18px;
}

.nav-bar h2 {
  font-size: 18px;
  font-weight: 700;
}

.back {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--white);
  box-shadow: var(--shadow-sm);
  font-size: 22px;
  color: var(--text);
  line-height: 1;
}

.placeholder {
  width: 36px;
}

/* Hero */
.hero {
  position: relative;
  border-radius: var(--radius-lg);
  padding: 34px 24px 26px;
  text-align: center;
  color: #fff;
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

/* 自定义背景图层 */
.hero-bgimg {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  z-index: 0;
}

/* 遮罩层：默认主题渐变；有自定义图时改为深色渐变保证文字可读 */
.hero-mask {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    135deg,
    var(--accent),
    color-mix(in srgb, var(--accent) 55%, #ffc2d4)
  );
  z-index: 1;
}

.hero-mask.dark {
  background: linear-gradient(
    160deg,
    rgba(40, 22, 38, 0.55) 0%,
    rgba(74, 40, 60, 0.62) 55%,
    rgba(30, 18, 32, 0.72) 100%
  );
}

.hero-content {
  position: relative;
  z-index: 2;
}

.hero-glow {
  position: absolute;
  width: 180px;
  height: 180px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  right: -60px;
  top: -70px;
}

.big-icon {
  display: block;
  font-size: 54px;
  margin-bottom: 10px;
}

.title {
  font-size: 22px;
  font-weight: 800;
}

.type-tag {
  display: inline-block;
  margin-top: 8px;
  font-size: 11.5px;
  background: rgba(255, 255, 255, 0.25);
  padding: 3px 12px;
  border-radius: 999px;
}

.date {
  margin-top: 12px;
  font-size: 13px;
  opacity: 0.92;
}

/* 更换背景按钮 */
.bg-edit-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 3;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.22);
  backdrop-filter: blur(4px);
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s, transform 0.2s;
}

.bg-edit-btn:hover {
  background: rgba(255, 255, 255, 0.38);
}

.bg-edit-btn:active {
  transform: scale(0.9);
}

/* 数字卡片 */
.numbers {
  display: flex;
  gap: 10px;
  margin-top: 14px;
}

.num-card {
  flex: 1;
  background: var(--white);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  text-align: center;
  padding: 16px 8px;
}

.num-card strong {
  display: block;
  font-size: 26px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.num-card span {
  font-size: 11.5px;
  color: var(--text-secondary);
}

/* 横幅 */
.banner {
  margin-top: 14px;
  background: color-mix(in srgb, var(--accent) 10%, white);
  color: var(--text);
  border-radius: var(--radius-md);
  padding: 15px 18px;
  font-size: 14px;
}

.banner em {
  font-style: normal;
  font-weight: 800;
  color: var(--accent);
  font-size: 17px;
  margin: 0 2px;
}

/* 内容区块 */
.note-block {
  margin-top: 16px;
  background: var(--white);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  padding: 18px;
}

.block-title {
  font-size: 15px;
  font-weight: 700;
  margin-bottom: 12px;
}

.note-block p {
  font-size: 14px;
  line-height: 1.75;
  color: #6b5a66;
}

/* 周年列表 */
.year-list li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 0;
  border-bottom: 1px dashed var(--border);
  font-size: 13.5px;
}

.year-list li:last-child {
  border-bottom: none;
}

.year-n {
  font-weight: 700;
  color: var(--accent);
  width: 76px;
  flex-shrink: 0;
}

.year-d {
  flex: 1;
}

.year-w {
  color: var(--text-secondary);
  font-size: 12.5px;
}

/* 里程碑 */
.milestone-list li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  margin-bottom: 7px;
  font-size: 13.5px;
  background: #fdf6f9;
}

.milestone-list li.past {
  background: color-mix(in srgb, var(--accent) 8%, white);
}

.milestone-list li.today {
  background: color-mix(in srgb, var(--accent) 18%, white);
  font-weight: 700;
}

.m-days {
  font-weight: 800;
  color: var(--accent);
  width: 74px;
  flex-shrink: 0;
}

.m-date {
  flex: 1;
}

.m-state {
  color: var(--text-secondary);
  font-size: 12.5px;
}

li.past .m-state {
  color: var(--accent);
}

/* 操作 */
.actions {
  display: flex;
  gap: 12px;
  margin-top: 22px;
}

.action-btn {
  flex: 1;
}

/* 删除确认弹窗 */
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(74, 59, 71, 0.45);
  backdrop-filter: blur(3px);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
}

.modal {
  width: 100%;
  max-width: 320px;
  background: #fff;
  border-radius: var(--radius-md);
  padding: 28px 22px 22px;
  text-align: center;
  box-shadow: var(--shadow-lg);
}

.modal-icon {
  font-size: 44px;
  margin-bottom: 10px;
}

.modal h3 {
  font-size: 17px;
  font-weight: 700;
  margin-bottom: 8px;
}

.modal p {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 22px;
}

.modal-actions {
  display: flex;
  gap: 10px;
}

.modal-actions .btn {
  flex: 1;
  padding: 10px 0;
  font-size: 14px;
}

/* 自定义主题背景面板 */
.bg-panel {
  width: 100%;
  max-width: 380px;
  max-height: 86vh;
  overflow-y: auto;
  background: #fff;
  border-radius: var(--radius-md);
  padding: 22px 20px 18px;
  box-shadow: var(--shadow-lg);
}

.panel-title {
  font-size: 17px;
  font-weight: 700;
  text-align: center;
  margin-bottom: 18px;
}

/* 本地导入行 */
.upload-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 14px;
  border: 1.5px dashed var(--pink-lighter);
  border-radius: var(--radius-sm);
  background: var(--pink-bg);
  transition: border-color 0.2s, background 0.2s;
}

.upload-row:hover:not(:disabled) {
  border-color: var(--pink);
  background: color-mix(in srgb, var(--pink) 7%, white);
}

.upload-row:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.ur-icon {
  font-size: 24px;
}

.ur-text {
  flex: 1;
  text-align: left;
  font-size: 14.5px;
  font-weight: 600;
  color: var(--text);
}

.ur-text small {
  display: block;
  font-size: 11.5px;
  font-weight: 400;
  color: var(--text-secondary);
  margin-top: 3px;
}

.ur-arrow {
  font-size: 22px;
  color: var(--text-secondary);
}

/* 云端相册 */
.cloud-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 20px 0 12px;
  font-size: 14.5px;
  font-weight: 700;
}

.refresh-btn {
  font-size: 12.5px;
  color: var(--pink);
  background: var(--pink-bg);
  padding: 5px 14px;
  border-radius: 999px;
  transition: background 0.2s;
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.cloud-tip {
  font-size: 13px;
  color: var(--text-secondary);
  text-align: center;
  padding: 26px 10px;
  background: #faf7fa;
  border-radius: var(--radius-sm);
}

.load-more-btn {
  display: block;
  width: 100%;
  margin-top: 12px;
  padding: 9px 0;
  font-size: 13px;
  color: var(--pink, #ff6b9d);
  background: #fff;
  border: 1px solid var(--pink, #ff6b9d);
  border-radius: var(--radius-sm);
  transition: background 0.2s, opacity 0.2s;
}

.load-more-btn:hover:not(:disabled) {
  background: rgba(255, 107, 157, 0.08);
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
  border-radius: 12px;
  border: 2px solid transparent;
  background: #f5eef2;
  transition: transform 0.15s, border-color 0.15s;
}

.photo-thumb {
  position: relative;
  aspect-ratio: 1;
  border-radius: 10px;
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
  border-color: var(--pink);
}

.photo-check {
  position: absolute;
  right: 5px;
  bottom: 5px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--pink);
  color: #fff;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 裁剪/删除操作按钮 */
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

/* 触屏设备：操作按钮常驻 */
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

/* 上传中 */
.uploading-mask {
  z-index: 300;
  background: rgba(50, 32, 44, 0.45);
}

.uploading-box {
  background: #fff;
  border-radius: var(--radius-md);
  padding: 28px 36px;
  text-align: center;
  box-shadow: var(--shadow-lg);
}

.uploading-box p {
  margin-top: 14px;
  font-size: 14px;
  color: var(--text-secondary);
}

.spinner {
  display: inline-block;
  width: 34px;
  height: 34px;
  border: 3px solid var(--pink-lighter);
  border-top-color: var(--pink);
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
</style>
