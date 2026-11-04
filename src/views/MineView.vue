<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAnniversaryStore } from '@/stores/anniversary'
import { updateProfile, changePassword } from '@/api/user'
import { fullYearsPassed } from '@/utils/date'
import { ACCEPT_IMAGE_TYPES, MAX_IMAGE_SIZE } from '@/api/upload'
import { showToast } from '@/utils/toast'

const router = useRouter()
const authStore = useAuthStore()
const annStore = useAnniversaryStore()

const user = computed(() => authStore.user || {})
const nick = computed(() => user.value.nickName || user.value.nickname || '')
const name = computed(() => user.value.userName || user.value.username || '')
const initial = computed(() => nick.value[0] || name.value[0] || 'U')

const joinISO = computed(() => user.value.creatTime || user.value.createdAt || '')
const joinDays = computed(() => {
  if (!joinISO.value) return null
  return Math.max(0, Math.floor((Date.now() - new Date(joinISO.value).getTime()) / 86400000))
})

// —— 统计 ——
onMounted(() => {
  if (!annStore.loaded) annStore.fetchList().catch(() => {})
})
const annList = computed(() => annStore.decoratedList || [])
const totalAnn = computed(() => annList.value.length)
// 纪念日绑定行：名称 + 已过天数 + 重复年（第几天 / 第几周年）
const annRows = computed(() =>
  annList.value.map((i) => ({
    ...i,
    years: fullYearsPassed(i.date)
  }))
)

// —— 纪念日切换：左右点击切换当前展示的纪念日（名称 / 天数 / 重复年联动） ——
const curIdx = ref(0)
const curAnn = computed(() =>
  annRows.value.length ? annRows.value[curIdx.value % annRows.value.length] : null
)
function prevAnn() {
  const n = annRows.value.length
  if (!n) return
  curIdx.value = (curIdx.value - 1 + n) % n
}
function nextAnn() {
  const n = annRows.value.length
  if (!n) return
  curIdx.value = (curIdx.value + 1) % n
}
// 点击名称进入详情页
function goDetail() {
  if (!curAnn.value || !curAnn.value.id) return
  router.push(`/detail/${curAnn.value.id}`)
}

// —— 昵称行内编辑 ——
const editingName = ref(false)
const nickInput = ref('')
const savingName = ref(false)
function startEditName() {
  nickInput.value = user.value.nickName || ''
  editingName.value = true
}
async function saveName() {
  const v = nickInput.value.trim()
  if (v.length < 2 || v.length > 20) {
    showToast('昵称需要 2-20 个字符')
    return
  }
  savingName.value = true
  try {
    const updated = await updateProfile({ nickName: v })
    // 后端 success() 可能不带用户数据：本地兜底同步昵称
    const isUserObj = updated && typeof updated === 'object' && (updated.userName !== undefined || updated.id !== undefined)
    authStore.updateUser(isUserObj ? updated : { nickName: v })
    showToast('昵称已更新')
    editingName.value = false
  } catch (e) {
    showToast(e.message || '昵称更新失败，请重试')
  }
  savingName.value = false
}

// —— 头像 ——
const fileInput = ref(null)
const uploading = ref(false)
function pickAvatar() {
  fileInput.value?.click()
}
async function onAvatarChosen(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  if (!ACCEPT_IMAGE_TYPES.includes(file.type)) {
    showToast('仅支持 JPG / PNG / WebP / GIF')
    return
  }
  if (file.size > MAX_IMAGE_SIZE) {
    showToast('图片不能超过 8MB')
    return
  }
  uploading.value = true
  try {
    // 不走上传接口：本地压缩成 base64 dataURL，随 avatar 字段直接提交 /user/profile
    const avatar = await fileToAvatarDataUrl(file)
    // 只传 avatar，不传 id：后端从 token 解析当前用户主键（CullentUtil）
    const updated = await updateProfile({ avatar })
    // 后端 success() 可能不带用户数据：返回完整实体则整体同步，否则本地兜底
    const isUserObj = updated && typeof updated === 'object' && (updated.userName !== undefined || updated.id !== undefined)
    authStore.updateUser(isUserObj ? updated : { avatar })
    showToast('头像已更新')
  } catch (e) {
    showToast(e.message || '头像上传失败，请重试')
  } finally {
    uploading.value = false
  }
}

/**
 * 图片文件 → 头像用 base64 dataURL：
 * 居中裁成正方形并压缩到 maxSize，统一转 JPEG（透明底垫白），
 * 控制体积（约 20~40KB），避免 JSON 请求体过大。
 */
function fileToAvatarDataUrl(file, maxSize = 256, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('读取图片失败'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('图片解析失败'))
      img.onload = () => {
        try {
          const side = Math.min(img.width, img.height)
          const sx = (img.width - side) / 2
          const sy = (img.height - side) / 2
          const out = Math.min(side, maxSize)
          const canvas = document.createElement('canvas')
          canvas.width = out
          canvas.height = out
          const ctx = canvas.getContext('2d')
          // 透明 PNG/GIF 转 JPEG 前垫白底，避免变黑
          ctx.fillStyle = '#fff'
          ctx.fillRect(0, 0, out, out)
          ctx.drawImage(img, sx, sy, side, side, 0, 0, out, out)
          resolve(canvas.toDataURL('image/jpeg', quality))
        } catch (err) {
          reject(new Error('头像处理失败'))
        }
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

// —— 修改密码 ——
const pwdOpen = ref(false)
const oldPwd = ref('')
const newPwd = ref('')
const confirmPwd = ref('')
const savingPwd = ref(false)
async function savePwd() {
  if (!oldPwd.value) {
    showToast('请输入原密码')
    return
  }
  if (newPwd.value.length < 6) {
    showToast('新密码至少 6 位')
    return
  }
  if (!/[A-Za-z]/.test(newPwd.value) || !/[0-9]/.test(newPwd.value)) {
    showToast('新密码需同时包含字母和数字')
    return
  }
  if (newPwd.value !== confirmPwd.value) {
    showToast('两次输入的新密码不一致')
    return
  }
  savingPwd.value = true
  try {
    await changePassword({ oldPassword: oldPwd.value, newPassword: newPwd.value })
    showToast('密码已修改，请重新登录')
    pwdOpen.value = false
    oldPwd.value = ''
    newPwd.value = ''
    confirmPwd.value = ''
    authStore.logout()
    router.push('/login')
  } catch (e) {
    // 后端返回的 message（如「原密码错误」）经拦截器成为 Error，这里 toast 给用户看
    showToast(e.message || '修改密码失败，请重试')
  }
  savingPwd.value = false
}

function onLogout() {
  authStore.logout()
  router.push('/login')
}
</script>

<template>
  <div class="mine-page mx-auto max-w-3xl px-5 py-10 sm:py-14">
    <!-- 页头 -->
    <header class="mb-8">
      <p class="text-[10px] font-bold uppercase tracking-[0.45em]" style="color: var(--ink-mute)">
        &middot; My Account &middot;
      </p>
      <h1 class="mt-2 font-display text-3xl font-semibold leading-none tracking-tight sm:text-4xl" style="color: var(--ink)">
        我的<span style="color: var(--rose-500)">账户</span>
      </h1>
      <p class="mt-2 text-sm" style="color: var(--ink-soft)">
        资料 · 统计 · 安全设置
      </p>
      <div class="flourish mt-4 w-48 sm:w-60" aria-hidden="true">✦</div>
    </header>

    <!-- 用户卡 -->
    <div class="card relative overflow-hidden p-7 sm:p-9">
      <!-- 装饰：玫瑰金光晕 + 角饰 -->
      <div class="avatar-glow" aria-hidden="true"></div>
      <div class="card-corners" aria-hidden="true"><i></i><i></i><i></i><i></i></div>

      <div class="relative flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-8">
        <!-- 头像：点击更换 -->
        <div
          class="avatar-ring group relative grid h-24 w-24 shrink-0 cursor-pointer place-items-center rounded-full"
          :title="uploading ? '上传中…' : '点击更换头像'"
          @click="pickAvatar"
        >
          <img
            v-if="user.avatar"
            :src="user.avatar"
            :alt="nick || name"
            class="h-[88px] w-[88px] rounded-full object-cover"
          />
          <span
            v-else
            class="grid h-[88px] w-[88px] place-items-center rounded-full font-display text-4xl font-semibold text-white"
            style="background: linear-gradient(135deg, var(--rose-400), var(--rose-600))"
          >
            {{ initial }}
          </span>
          <span class="avatar-mask absolute inset-0 grid place-items-center rounded-full text-xs font-bold text-white">
            {{ uploading ? '上传中' : '更换' }}
          </span>
          <input
            ref="fileInput"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            class="hidden"
            @change="onAvatarChosen"
          />
        </div>

        <div class="flex-1 text-center sm:text-left">
          <div class="flex items-center justify-center gap-3 sm:justify-start">
            <template v-if="!editingName">
              <span
                class="text-[10px] font-bold tracking-wider"
                style="color: var(--ink-mute)"
                aria-hidden="true"
              >昵称</span>
              <h2 class="font-display text-2xl font-semibold" style="color: var(--ink)">
                {{ nick || name || '用户' }}
              </h2>
              <button
                class="grid h-8 w-8 place-items-center rounded-full text-sm transition-transform duration-200 hover:scale-110"
                style="color: var(--rose-400)"
                aria-label="修改昵称"
                @click="startEditName"
              >
                ✎
              </button>
            </template>
            <template v-else>
              <input
                v-model="nickInput"
                maxlength="20"
                class="nick-input"
                @keyup.enter="saveName"
              />
              <button
                class="grid h-8 w-8 place-items-center rounded-full text-sm font-bold text-white disabled:opacity-50"
                style="background: var(--rose-500)"
                :disabled="savingName"
                aria-label="保存"
                @click="saveName"
              >
                ✓
              </button>
              <button
                class="grid h-8 w-8 place-items-center rounded-full text-sm"
                style="color: var(--ink-mute); background: rgba(255, 255, 255, 0.5)"
                aria-label="取消"
                @click="editingName = false"
              >
                ✕
              </button>
            </template>
          </div>
          <p class="mt-1.5 flex items-baseline gap-1.5 text-sm" style="color: var(--ink-soft)">
            <span class="text-[10px] font-bold tracking-wider" style="color: var(--ink-mute)">账号</span>
            @{{ name }}
          </p>
          <p class="mt-1.5 inline-flex items-center gap-2 text-xs" style="color: var(--ink-mute)">
            <span class="h-1 w-1 rounded-full" style="background: var(--rose-300)" aria-hidden="true"></span>
            <span v-if="joinDays !== null">与 Love Days 相遇 {{ joinDays }} 天</span>
          </p>
        </div>
      </div>
    </div>

    <!-- 纪念日绑定卡：整卡可点击进详情，左右箭头切换（stop 拦截） -->
    <div
      class="card ann-card my-6 grid grid-cols-3 overflow-hidden"
      :class="{ clickable: !!curAnn }"
      :title="curAnn ? '查看详情' : ''"
      @click="goDetail"
    >
      <div class="stat-cell ann-bind-cell">
        <div class="ann-bind-head">
          <button
            type="button"
            class="ann-arrow"
            :disabled="!annRows.length"
            aria-label="上一个纪念日"
            @click.stop="prevAnn"
          >‹</button>
          <button
            type="button"
            class="ann-title"
            :class="{ empty: !curAnn, link: !!curAnn }"
            :disabled="!curAnn"
            :title="curAnn ? '查看详情' : ''"
            @click="goDetail"
          >
            {{ curAnn ? curAnn.title : '暂无纪念日' }}
          </button>
          <button
            type="button"
            class="ann-arrow"
            :disabled="!annRows.length"
            aria-label="下一个纪念日"
            @click.stop="nextAnn"
          >›</button>
        </div>
        <span class="stat-label">Anniversary</span>
        <span class="stat-cn">
          <template v-if="annRows.length">{{ curIdx + 1 }} / {{ annRows.length }}</template>
          <template v-else>去首页添加</template>
        </span>
      </div>
      <div class="stat-cell">
        <span class="stat-num text-gilt block tabular">{{ curAnn ? curAnn.passed : 0 }}</span>
        <span class="stat-label">Days together</span>
        <span class="stat-cn">在一起的天数</span>
      </div>
      <div class="stat-cell">
        <span class="stat-num text-gilt block tabular">{{ curAnn ? curAnn.years : 0 }}</span>
        <span class="stat-label">Years</span>
        <span class="stat-cn">{{ curAnn && curAnn.isYearly ? '重复年（每年）' : '重复年' }}</span>
      </div>
    </div>

    <!-- 设置 -->
    <div class="card overflow-hidden">
      <button class="setting-row" @click="pickAvatar">
        <span class="flex-1 text-left">
          <span class="row-title">更换头像</span>
          <span class="row-desc">JPG / PNG / WebP · ≤8MB</span>
        </span>
        <span class="row-arrow" aria-hidden="true">›</span>
      </button>
      <div class="setting-divider"></div>
      <button class="setting-row" @click="pwdOpen = !pwdOpen">
        <span class="flex-1 text-left">
          <span class="row-title">修改密码</span>
          <span class="row-desc">定期更换更安全</span>
        </span>
        <span class="row-arrow" :class="{ open: pwdOpen }" aria-hidden="true">›</span>
      </button>
      <!-- 密码表单（展开式） -->
      <div v-if="pwdOpen" class="pwd-panel">
        <label class="block">
          <span class="mb-1.5 block text-[11px] font-bold tracking-wider" style="color: var(--ink-mute)">原密码</span>
          <input v-model="oldPwd" type="password" placeholder="输入当前密码" class="pwd-input" />
        </label>
        <label class="mt-3 block">
          <span class="mb-1.5 block text-[11px] font-bold tracking-wider" style="color: var(--ink-mute)">新密码</span>
          <input v-model="newPwd" type="password" placeholder="至少 6 位" class="pwd-input" />
        </label>
        <label class="mt-3 block">
          <span class="mb-1.5 block text-[11px] font-bold tracking-wider" style="color: var(--ink-mute)">确认新密码</span>
          <input v-model="confirmPwd" type="password" placeholder="再输入一次" class="pwd-input" />
        </label>
        <button
          class="mt-5 rounded-full px-7 py-2.5 text-sm font-bold text-white transition-transform duration-300 hover:scale-[1.03] active:scale-[0.97] disabled:opacity-50"
          style="background: linear-gradient(135deg, var(--rose-500), var(--rose-600)); box-shadow: 0 8px 22px rgba(192, 61, 108, 0.32)"
          :disabled="savingPwd"
          @click="savePwd"
        >
          保存并重新登录
        </button>
      </div>
      <div class="setting-divider"></div>
      <button class="setting-row danger" @click="onLogout">
        <span class="flex-1 text-left">
          <span class="row-title" style="color: #c0364a">退出登录</span>
          <span class="row-desc">清除本地登录信息</span>
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.tabular {
  font-variant-numeric: tabular-nums;
}

/* —— 用户卡：玫瑰金光晕 + 四角 —— */
.avatar-glow {
  position: absolute;
  top: -70px;
  right: -60px;
  width: 240px;
  height: 240px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(183, 110, 121, 0.18), transparent 70%);
  pointer-events: none;
}
.card-corners {
  position: absolute;
  inset: 12px;
  pointer-events: none;
}
.card-corners i {
  position: absolute;
  width: 16px;
  height: 16px;
  border-color: rgba(255, 255, 255, 0.75);
}
.card-corners i:nth-child(1) {
  top: 0;
  left: 0;
  border-top: 1.5px solid;
  border-left: 1.5px solid;
}
.card-corners i:nth-child(2) {
  top: 0;
  right: 0;
  border-top: 1.5px solid;
  border-right: 1.5px solid;
}
.card-corners i:nth-child(3) {
  bottom: 0;
  left: 0;
  border-bottom: 1.5px solid;
  border-left: 1.5px solid;
}
.card-corners i:nth-child(4) {
  bottom: 0;
  right: 0;
  border-bottom: 1.5px solid;
  border-right: 1.5px solid;
}

/* —— 头像：玫瑰金锥形渐变环 —— */
.avatar-ring {
  padding: 5px;
  border-radius: 50%;
  background: conic-gradient(from 210deg, #d9a3a3, #b76e79, #8fb3d9, #d9a3a3);
  box-shadow: 0 10px 28px rgba(80, 100, 130, 0.2);
}
.avatar-mask {
  background: rgba(42, 52, 68, 0.45);
  opacity: 0;
  transition: opacity 0.3s ease;
  backdrop-filter: blur(2px);
}
.avatar-ring:hover .avatar-mask,
.avatar-ring:focus-visible .avatar-mask {
  opacity: 1;
}

.nick-input {
  border-radius: 10px;
  padding: 6px 12px;
  font-size: 1.05rem;
  font-weight: 600;
  outline: none;
  background: rgba(255, 255, 255, 0.75);
  color: var(--ink);
  box-shadow: inset 0 0 0 1px var(--hairline);
}

/* —— 统计：单卡三栏，发丝线分隔 —— */
.stat-cell {
  padding: 22px 12px 18px;
  text-align: center;
  position: relative;
}
.stat-cell + .stat-cell::before {
  content: '';
  position: absolute;
  left: 0;
  top: 22%;
  bottom: 22%;
  width: 1px;
  background: linear-gradient(180deg, transparent, var(--hairline-strong), transparent);
}
.stat-num {
  font-family: var(--font-display);
  font-size: clamp(1.8rem, 4.5vw, 2.4rem);
  font-weight: 600;
  line-height: 1;
}
.stat-label {
  display: block;
  margin-top: 7px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--ink-mute);
}
.stat-cn {
  display: block;
  margin-top: 2px;
  font-size: 11px;
  color: var(--ink-soft);
}

/* —— 纪念日绑定卡：整卡可点击进详情 —— */
.ann-card {
  cursor: default;
  transition: transform 0.25s ease, box-shadow 0.25s ease;
}
.ann-card.clickable {
  cursor: pointer;
}
.ann-card.clickable:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 30px rgba(110, 130, 160, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.9);
}
/* —— 纪念日绑定卡内：名称 + 左右切换箭头 —— */
.ann-bind-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16px 10px 18px;
}
.ann-bind-head {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
}
.ann-arrow {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  font-size: 15px;
  line-height: 1;
  color: var(--acc-deep);
  background: rgba(255, 255, 255, 0.7);
  box-shadow: inset 0 0 0 1px var(--hairline-strong), 0 3px 8px rgba(110, 130, 160, 0.14);
  transition: background 0.25s ease, transform 0.25s ease, opacity 0.25s ease;
}
.ann-arrow:not(:disabled):hover {
  background: linear-gradient(150deg, #fdf3f4, #f9e6e9);
  transform: scale(1.08);
}
.ann-arrow:disabled {
  opacity: 0.35;
  cursor: default;
}
.ann-title {
  display: block;
  min-width: 0;
  max-width: 132px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-display);
  font-size: clamp(0.95rem, 2.6vw, 1.25rem);
  font-weight: 600;
  line-height: 1.2;
  color: var(--acc-deep);
}
.ann-title.empty {
  color: var(--ink-mute);
  font-weight: 500;
  cursor: default;
}
.ann-title.link {
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 8px;
  background: none;
  border: none;
  text-align: center;
  transition: color 0.25s ease, background 0.25s ease, box-shadow 0.25s ease;
}
.ann-title.link:hover {
  color: var(--rose-500);
  background: rgba(183, 110, 121, 0.08);
  box-shadow: inset 0 0 0 1px rgba(183, 110, 121, 0.25);
}

/* —— 设置行 —— */
.setting-row {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 16px 22px;
  transition: background 0.2s ease, transform 0.2s var(--ease-out, ease);
}
.setting-row:hover {
  background: rgba(255, 255, 255, 0.35);
}
.row-title {
  display: block;
  font-size: 14px;
  font-weight: 700;
  color: var(--ink);
}
.row-desc {
  display: block;
  margin-top: 1px;
  font-size: 11px;
  color: var(--ink-mute);
}
.row-arrow {
  color: var(--ink-mute);
  font-size: 20px;
  line-height: 1;
  transition: transform 0.3s ease;
}
.row-arrow.open {
  transform: rotate(90deg);
}
.setting-row.danger:hover {
  background: rgba(192, 54, 74, 0.06);
}
.setting-divider {
  height: 1px;
  background: var(--hairline);
}

/* —— 密码面板：左侧强调线 —— */
.pwd-panel {
  margin: 4px 22px 22px;
  padding: 18px 18px 18px 20px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.4);
  box-shadow: inset 3px 0 0 var(--rose-400), inset 0 0 0 1px var(--hairline);
}
.pwd-input {
  width: 100%;
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 14px;
  outline: none;
  background: rgba(255, 255, 255, 0.75);
  color: var(--ink);
  box-shadow: inset 0 0 0 1px var(--hairline);
}
.pwd-input:focus {
  box-shadow: inset 0 0 0 1px var(--rose-300);
}
</style>
