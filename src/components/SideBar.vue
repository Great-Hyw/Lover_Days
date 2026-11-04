<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { getUserNameFromToken } from '@/utils/token'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const showSidebar = computed(() => route.meta.public !== true)
const drawerOpen = ref(false)

watch(
  () => route.path,
  () => {
    drawerOpen.value = false
  }
)

watch(drawerOpen, (open) => {
  if (typeof document !== 'undefined') {
    document.body.style.overflow = open ? 'hidden' : ''
  }
})

const activeMenu = computed(() => {
  const p = route.path
  if (p === '/' || p === '') return 'home'
  if (p.startsWith('/all')) return 'all'
  if (p.startsWith('/age')) return 'age'
  if (p.startsWith('/mine')) return 'mine'
  return 'home'
})

// desc：菜单项下方的小描述，让菜单信息更有层次
const BASE_MENUS = [
  { key: 'home', label: '首页', icon: '🏠', to: '/', desc: '回到我们的故事' },
  { key: 'all', label: '全部纪念日', icon: '📅', to: '/all', desc: '收藏每一个日子' },
  { key: 'age', label: '年龄计算', icon: '🎂', to: '/age', desc: '精到小数点后八位' },
  { key: 'mine', label: '我的', icon: '👤', to: '/mine', desc: '账号与设置' }
]

// —— 长按可拖拽排序：顺序持久化到 localStorage ——
const MENU_ORDER_KEY = 'love-days:menu-order'
function loadMenuOrder() {
  try {
    const saved = JSON.parse(localStorage.getItem(MENU_ORDER_KEY))
    if (Array.isArray(saved) && saved.length === BASE_MENUS.length) {
      const byKey = {}
      BASE_MENUS.forEach((m) => (byKey[m.key] = m))
      const ordered = saved.map((k) => byKey[k]).filter(Boolean)
      if (ordered.length === BASE_MENUS.length) return ordered
    }
  } catch {}
  return BASE_MENUS
}
const menus = ref(loadMenuOrder())
function persistMenuOrder() {
  try {
    localStorage.setItem(MENU_ORDER_KEY, JSON.stringify(menus.value.map((m) => m.key)))
  } catch {}
}

// 拖拽状态：长按 450ms 激活；激活期间拖动即与目标项交换位置
const dragState = reactive({ key: null, active: false, timer: 0 })
let suppressClick = false
let lastSwapAt = 0 // 换位冷却：避免 pointermove 高频触发导致换位过快
function onNavPointerDown(key, event) {
  if (event.button !== undefined && event.button !== 0) return
  event.preventDefault() // 阻止 <a> 原生拖拽/文本选择，否则 pointermove 被浏览器接管中断
  dragState.key = key
  suppressClick = false
  dragState.timer = window.setTimeout(() => {
    dragState.active = true
  }, 450)
  // 指针捕获：后续 pointermove/up 固定发到本菜单项，避免链接原生拖拽断流
  if (event.currentTarget && event.currentTarget.setPointerCapture) {
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch (e) {}
  }
  window.addEventListener('pointermove', onNavPointerMove)
  window.addEventListener('pointerup', onNavPointerUp)
  window.addEventListener('pointercancel', onNavPointerUp)
}
function onNavPointerMove(event) {
  if (!dragState.active) return
  const el = document.elementFromPoint(event.clientX, event.clientY)?.closest('.nav-item')
  if (!el) return
  const targetKey = el.dataset.key
  if (!targetKey || targetKey === dragState.key) return
  const from = menus.value.findIndex((m) => m.key === dragState.key)
  const to = menus.value.findIndex((m) => m.key === targetKey)
  if (from < 0 || to < 0 || from === to) return
  // 冷却节流：两次换位至少间隔 260ms，让顺序变化更从容
  const now = Date.now()
  if (now - lastSwapAt < 260) return
  lastSwapAt = now
  const arr = [...menus.value]
  ;[arr[from], arr[to]] = [arr[to], arr[from]]
  menus.value = arr
}
function onNavPointerUp() {
  window.clearTimeout(dragState.timer)
  if (dragState.active) {
    dragState.active = false
    suppressClick = true
    persistMenuOrder()
    window.setTimeout(() => (suppressClick = false), 120)
  }
  dragState.key = null
  window.removeEventListener('pointermove', onNavPointerMove)
  window.removeEventListener('pointerup', onNavPointerUp)
  window.removeEventListener('pointercancel', onNavPointerUp)
}
// 长按松手后紧接的 click 会触发导航，这里在捕获阶段拦掉
function onNavClickCapture(event) {
  if (suppressClick) {
    event.preventDefault()
    event.stopPropagation()
    suppressClick = false
  }
}

const user = computed(() => authStore.user)
const isLoggedIn = computed(() => authStore.isLoggedIn)

// 菜单用户名以 token（JWT payload）为准；token 解析不到时回退 user 对象 → '用户'
const displayName = computed(
  () =>
    user.value?.nickName ||
    user.value?.nickname ||
    getUserNameFromToken(authStore.token) ||
    user.value?.userName ||
    user.value?.username ||
    '用户'
)

// —— 点击品牌爱心：从点击处飘出小爱心，点几下飘几个 ——
const floatHearts = ref([])
let heartSeq = 0
function burstHeart(event) {
  const brand = event.currentTarget.closest('.sidebar-brand')
  if (!brand) return
  const rect = brand.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  const id = ++heartSeq
  // 每次点击飘 1 个，随机左右偏移让轨迹错落
  const drift = (Math.random() - 0.5) * 60
  const size = 13 + Math.random() * 7
  floatHearts.value.push({ id, x, y, drift, size })
  window.setTimeout(() => {
    floatHearts.value = floatHearts.value.filter((h) => h.id !== id)
  }, 1600)
}

// —— 页脚情话：每隔几秒轮换一句，让菜单角落常换常新 ——
const LOVE_NOTES = [
  '把每个日子都过成纪念日',
  '喜欢是藏不住的心动',
  '慢慢走，沿途都是风景',
  '今天也在认真喜欢',
  '所爱之人，岁岁常伴'
]
const noteIdx = ref(0)
let noteTimer = 0
onMounted(() => {
  noteTimer = setInterval(() => {
    noteIdx.value = (noteIdx.value + 1) % LOVE_NOTES.length
  }, 4200)
})

// —— 菜单框内液体光斑位置（跟随鼠标，驱动 CSS 光斑） ——
const liquidPos = reactive(
  Object.fromEntries(menus.value.map((m) => [m.key, { x: 50, y: 50, on: false }]))
)

// 缓存 matchMedia 结果：避免每次鼠标移动都新建 MediaQueryList（高频事件里的小优化）
const reduceMotionQuery =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null

function prefersReducedMotion() {
  return !!reduceMotionQuery?.matches
}

// 统一把事件坐标换算成「相对菜单项的百分比 + 视口坐标」
// 键盘 / 辅助技术触发的 click 没有指针坐标（clientX/clientY 都是 0），回退到菜单项中心
function resolvePointer(event) {
  const el = event.currentTarget
  const rect = el.getBoundingClientRect()
  let clientX = event.clientX
  let clientY = event.clientY
  if (
    !Number.isFinite(clientX) ||
    !Number.isFinite(clientY) ||
    (clientX === 0 && clientY === 0)
  ) {
    clientX = rect.left + rect.width / 2
    clientY = rect.top + rect.height / 2
  }
  return {
    rect,
    clientX,
    clientY,
    xPct: rect.width ? ((clientX - rect.left) / rect.width) * 100 : 50,
    yPct: rect.height ? ((clientY - rect.top) / rect.height) * 100 : 50
  }
}

function onMenuMove(key, event) {
  const pt = resolvePointer(event)

  liquidPos[key].x = pt.xPct
  liquidPos[key].y = pt.yPct
  liquidPos[key].on = true

  // 记录悬停状态与光标位置：鼠标停住不动时，光标处会持续冒出小火花
  const sys = particleSystems.get(key)
  if (sys) {
    sys.hovering = true
    sys.px = pt.clientX - pt.rect.left
    sys.py = pt.clientY - pt.rect.top
  }

  // 鼠标在框内滑动：沿轨迹持续生成向外扩散、渐隐的彩色粒子（Gemini 风格）
  emitTrail(key, pt.clientX, pt.clientY)
}

function onMenuEnter(key, event) {
  const pt = resolvePointer(event)
  liquidPos[key].x = pt.xPct
  liquidPos[key].y = pt.yPct
  liquidPos[key].on = true
  const sys = particleSystems.get(key)
  if (sys) {
    sys.hovering = true
    sys.px = pt.clientX - pt.rect.left
    sys.py = pt.clientY - pt.rect.top
  }
  // 移入：以光标为中心荡出粒子涟漪（一圈圈粒子向外扩散，非水波环）
  emitRings(key, pt.clientX, pt.clientY, false)
}

function onMenuLeave(key) {
  liquidPos[key].on = false
  const sys = particleSystems.get(key)
  if (sys) {
    // 重置轨迹起点：再次移入时不会从上次离开的位置拉出一条线
    sys.lastX = sys.lastY = null
    sys.hovering = false
  }
}

function onMenuClick(key, event) {
  const pt = resolvePointer(event)
  // 点击：更强的粒子涟漪 + 中心火花爆发
  emitRings(key, pt.clientX, pt.clientY, true)
}

// —— Gemini 风格粒子效果（canvas 粒子被约束在菜单框内部） ——
const particleSystems = new Map()

// Gemini 官网主页的粒子配色：蓝 → 紫 → 粉 → 橙（对应 Gemini 标志的渐变色）
const SPARK_PALETTE = [
  { h: 217, s: 90, l: 62 }, // 蓝  #4285F4
  { h: 271, s: 88, l: 62 }, // 紫  #A142F4
  { h: 336, s: 80, l: 58 }, // 粉  #EA4C89
  { h: 27, s: 100, l: 64 } // 橙  #FF9E48
]
const ROSE_PALETTE = [
  { h: 340, s: 78, l: 58 },
  { h: 330, s: 72, l: 50 },
  { h: 18, s: 88, l: 62 },
  { h: 350, s: 92, l: 70 }
]

function pickColor(key) {
  const palette = activeMenu.value === key ? ROSE_PALETTE : SPARK_PALETTE
  return palette[(Math.random() * palette.length) | 0]
}

function createSystem(canvas, key) {
  const ctx = canvas.getContext('2d')
  const sys = {
    canvas,
    ctx,
    key,
    particles: [],
    ambient: [],
    t: 0,
    raf: 0,
    running: false,
    w: 0,
    h: 0,
    lastX: null,
    lastY: null,
    hovering: false,
    px: 0,
    py: 0,
    ro: null
  }

  const step = () => {
    sys.t++
    const t = sys.t * 0.016
    ctx.clearRect(0, 0, sys.w, sys.h)

    // ① 环境星尘（Gemini 官网背景同款）：始终沿伪流场漂移 + 闪烁，菜单常驻动感
    for (let i = 0; i < sys.ambient.length; i++) {
      const p = sys.ambient[i]
      // 廉价伪流场：位置 + 时间 → 漂移角度，粒子随流场缓慢旋转漂移
      const a = Math.sin(p.x * 0.018 + t * 0.5) + Math.cos(p.y * 0.021 - t * 0.35)
      p.x += Math.cos(a) * p.spd
      p.y += Math.sin(a) * p.spd
      // 边缘回绕：保证星尘始终留在容器内，且没有可见的出入界
      if (p.x < -4) p.x += sys.w + 8
      else if (p.x > sys.w + 4) p.x -= sys.w + 8
      if (p.y < -4) p.y += sys.h + 8
      else if (p.y > sys.h + 4) p.y -= sys.h + 8
      // 闪烁：正弦控制亮度，偶尔暗到几乎消失再亮起
      const tw = 0.5 + 0.5 * Math.sin(t * p.tw + p.ph)
      const alpha = 0.55 * tw
      if (alpha > 0.02) {
        const r = p.size * (0.6 + 0.4 * tw)
        ctx.beginPath()
        ctx.fillStyle = `hsla(${p.h}, ${p.s}%, ${Math.min(96, p.l + 18)}%, ${(alpha * 0.5).toFixed(3)})`
        ctx.arc(p.x, p.y, r * 2.6, 0, 6.2832)
        ctx.fill()
        ctx.beginPath()
        ctx.fillStyle = `hsla(${p.h}, ${p.s}%, ${p.l}%, ${alpha.toFixed(3)})`
        ctx.arc(p.x, p.y, r, 0, 6.2832)
        ctx.fill()
      }
    }

    // ② 光标悬停（不动）时：从光标位置持续冒出一缕小火花
    if (sys.hovering && (sys.t & 1) === 0) {
      const c = pickColor(sys.key)
      const a = Math.random() * 6.2832
      const sp = 0.25 + Math.random() * 0.9
      const life = 0.5 + Math.random() * 0.7
      addParticle(sys, {
        x: sys.px + (Math.random() - 0.5) * 6,
        y: sys.py + (Math.random() - 0.5) * 6,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 1,
        decay: 1 / (life * 60),
        size: 1 + Math.random() * 1.4,
        friction: 0.94,
        delay: 0,
        spin: (Math.random() - 0.5) * 0.4,
        age: 0,
        tw: 0.2 + Math.random() * 0.3,
        ph: Math.random() * 6.2832,
        h: c.h,
        s: c.s,
        l: c.l
      })
    }

    // ③ 交互粒子（拖尾 / 涟漪 / 爆发）：曲线运动 + 闪烁
    const { particles } = sys
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]
      if (p.delay > 0) {
        p.delay--
        continue
      }
      p.age++
      // 曲线运动：沿速度方向加一个微小的垂直侧向力，粒子划弧线而不是直线飞出
      const ox = p.vx
      const oy = p.vy
      const sp2 = Math.hypot(ox, oy)
      if (sp2 > 0.02) {
        p.vx = ox + (-oy / sp2) * p.spin
        p.vy = oy + (ox / sp2) * p.spin
      }
      p.x += p.vx
      p.y += p.vy
      p.vx *= p.friction
      p.vy *= p.friction
      p.life -= p.decay
      if (p.life <= 0) {
        particles.splice(i, 1)
        continue
      }
      // 闪烁：亮度做正弦调制，粒子像星星一样一闪一闪
      const tw = 0.75 + 0.25 * Math.sin(p.age * p.tw + p.ph)
      const alpha = p.life * p.life * tw
      const r = p.size * (0.35 + 0.65 * p.life)
      // 外层光晕：更大更亮（色相不变、亮度提升），营造发光粒子感
      ctx.beginPath()
      ctx.fillStyle = `hsla(${p.h}, ${p.s}%, ${Math.min(96, p.l + 18)}%, ${(alpha * 0.3).toFixed(3)})`
      ctx.arc(p.x, p.y, r * 3.2, 0, 6.2832)
      ctx.fill()
      // 内核：高饱和亮色实心点，是"粒子"的主体
      ctx.beginPath()
      ctx.fillStyle = `hsla(${p.h}, ${p.s}%, ${p.l}%, ${alpha.toFixed(3)})`
      ctx.arc(p.x, p.y, r, 0, 6.2832)
      ctx.fill()
    }

    // 星尘层永不消失，循环常驻（这就是"一直有动感"的来源）
    sys.raf = requestAnimationFrame(step)
  }

  sys.run = () => {
    if (!sys.running) {
      sys.running = true
      sys.raf = requestAnimationFrame(step)
    }
  }

  const resize = () => {
    const rect = canvas.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    sys.w = rect.width
    sys.h = rect.height
    canvas.width = Math.max(1, Math.round(rect.width * dpr))
    canvas.height = Math.max(1, Math.round(rect.height * dpr))
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  resize()
  if (typeof ResizeObserver !== 'undefined') {
    sys.ro = new ResizeObserver(resize)
    sys.ro.observe(canvas)
  }

  // 初始化环境星尘：数量按画布面积估算（菜单项约 10~14 颗，开销极小）
  if (!prefersReducedMotion() && sys.w > 1 && sys.h > 1) {
    const n = Math.max(8, Math.round((sys.w * sys.h) / 900))
    for (let i = 0; i < n; i++) {
      const c = pickColor(key)
      sys.ambient.push({
        x: Math.random() * sys.w,
        y: Math.random() * sys.h,
        spd: 0.12 + Math.random() * 0.25,
        tw: 0.8 + Math.random() * 1.6,
        ph: Math.random() * 6.2832,
        size: 0.7 + Math.random() * 1.1,
        h: c.h,
        s: c.s,
        l: c.l
      })
    }
  }
  // 星尘常驻，渲染循环直接启动（prefers-reduced-motion 时 canvas 被 CSS 隐藏，无视觉）
  sys.running = true
  sys.raf = requestAnimationFrame(step)

  sys.destroy = () => {
    cancelAnimationFrame(sys.raf)
    if (sys.ro) sys.ro.disconnect()
    sys.particles.length = 0
    sys.ambient.length = 0
    sys.running = false
  }

  return sys
}

function addParticle(sys, p) {
  // 单菜单项粒子上限（性能保护）：超出时丢弃最旧的粒子
  if (sys.particles.length >= 240) {
    sys.particles.splice(0, sys.particles.length - 239)
  }
  sys.particles.push(p)
  sys.run()
}

// 鼠标移动轨迹：在光标附近持续生成向外扩散、渐变消失的彩色粒子（Gemini 风格拖尾）
function emitTrail(key, clientX, clientY) {
  if (prefersReducedMotion()) return
  const sys = particleSystems.get(key)
  if (!sys) return

  const rect = sys.canvas.getBoundingClientRect()
  const x = clientX - rect.left
  const y = clientY - rect.top
  if (sys.lastX === null || sys.lastY === null) {
    sys.lastX = clientX
    sys.lastY = clientY
    return
  }
  const dx = clientX - sys.lastX
  const dy = clientY - sys.lastY
  const dist = Math.hypot(dx, dy)
  sys.lastX = clientX
  sys.lastY = clientY
  if (dist < 4) return

  const baseAng = Math.atan2(-dy, -dx)
  // 滑动越快，单位距离生成的粒子越多，形成连续的彩色火花拖尾
  const count = dist > 18 ? 6 : dist > 9 ? 4 : 3
  for (let i = 0; i < count; i++) {
    const c = pickColor(key)
    const ang = baseAng + (Math.random() - 0.5) * 2.4
    const sp = 0.5 + Math.random() * 1.7
    const life = 0.9 + Math.random() * 0.9
    addParticle(sys, {
      x: x + (Math.random() - 0.5) * 10,
      y: y + (Math.random() - 0.5) * 10,
      vx: Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp,
      life: 1,
      decay: 1 / (life * 60),
      size: 1.4 + Math.random() * 1.8,
      friction: 0.94,
      delay: 0,
      // 曲线 + 闪烁参数：粒子划弧线飞出，亮度如星星般明暗交替
      spin: (Math.random() - 0.5) * 0.5,
      age: 0,
      tw: 0.2 + Math.random() * 0.3,
      ph: Math.random() * 6.2832,
      h: c.h,
      s: c.s,
      l: c.l
    })
  }
}

// 移入 / 点击：以光标为中心荡出几圈粒子涟漪
function emitRings(key, clientX, clientY, strong = false) {
  if (prefersReducedMotion()) return
  const sys = particleSystems.get(key)
  if (!sys) return

  const rect = sys.canvas.getBoundingClientRect()
  const cx = clientX - rect.left
  const cy = clientY - rect.top
  const rings = strong ? 4 : 3
  const per = strong ? 26 : 20
  const gap = strong ? 15 : 13

  for (let r = 0; r < rings; r++) {
    const radius = 5 + r * gap
    for (let i = 0; i < per; i++) {
      const c = pickColor(key)
      const a = (i / per) * Math.PI * 2 + Math.random() * 0.25
      const sp = 1.0 + Math.random() * 1.1 + r * 0.15
      const life = (strong ? 1.05 : 0.9) + Math.random() * 0.6
      addParticle(sys, {
        x: cx + Math.cos(a) * radius,
        y: cy + Math.sin(a) * radius,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 1,
        decay: 1 / (life * 60),
        size: 1.4 + Math.random() * 1.6,
        friction: 0.92,
        delay: r * 7 + ((Math.random() * 4) | 0),
        spin: (Math.random() - 0.5) * 0.6,
        age: 0,
        tw: 0.2 + Math.random() * 0.3,
        ph: Math.random() * 6.2832,
        h: c.h,
        s: c.s,
        l: c.l
      })
    }
  }

  // 点击时再炸开一小簇火花
  if (strong) {
    for (let i = 0; i < 26; i++) {
      const c = pickColor(key)
      const a = Math.random() * Math.PI * 2
      const sp = 1.4 + Math.random() * 2.4
      const life = 0.7 + Math.random() * 0.8
      addParticle(sys, {
        x: cx,
        y: cy,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 1,
        decay: 1 / (life * 60),
        size: 1.2 + Math.random() * 1.8,
        friction: 0.9,
        delay: 0,
        spin: (Math.random() - 0.5) * 0.7,
        age: 0,
        tw: 0.2 + Math.random() * 0.3,
        ph: Math.random() * 6.2832,
        h: c.h,
        s: c.s,
        l: c.l
      })
    }
  }
}

// 注意：Vue 每次重渲染都会重新触发函数 ref（runtime-core patch 中 setRef 无条件调用），
// 而 mousemove 会更新 liquidPos 触发重渲染。若每次都重建 canvas 系统，粒子会被瞬间清空，
// 所以这里必须对「同一个 canvas 元素」直接返回，保留正在运行的粒子系统。
function bindParticleCanvas(key, el) {
  const old = particleSystems.get(key)
  if (old && old.canvas === el) return
  if (old) {
    old.destroy()
    particleSystems.delete(key)
  }
  if (el) particleSystems.set(key, createSystem(el, key))
}

// 稳定的 ref 回调（每个菜单键一个），避免每次渲染创建新闭包
const canvasBinders = Object.fromEntries(
  menus.value.map((m) => [m.key, (el) => bindParticleCanvas(m.key, el)])
)

onBeforeUnmount(() => {
  if (noteTimer) clearInterval(noteTimer)
  window.clearTimeout(dragState.timer)
  if (dragState.active) persistMenuOrder()
  window.removeEventListener('pointermove', onNavPointerMove)
  window.removeEventListener('pointerup', onNavPointerUp)
  window.removeEventListener('pointercancel', onNavPointerUp)
  particleSystems.forEach((s) => s.destroy())
  particleSystems.clear()
})

function handleLogout() {
  drawerOpen.value = false
  authStore.logout()
  router.replace({ name: 'login' })
}
</script>

<template>
  <template v-if="showSidebar">
    <button
      class="menu-toggle"
      :class="{ 'is-hidden': drawerOpen }"
      type="button"
      aria-label="打开菜单"
      @click="drawerOpen = true"
    >
      <span></span>
      <span></span>
      <span></span>
    </button>

    <transition name="mask-fade">
      <div
        v-if="drawerOpen"
        class="drawer-mask"
        @click="drawerOpen = false"
      ></div>
    </transition>

    <aside class="sidebar" :class="{ open: drawerOpen }">
      <!-- 极光：两团缓慢漂移的柔光（纯 CSS transform 动画，不拦截交互） -->
      <div class="sidebar-aurora" aria-hidden="true"></div>

      <div class="sidebar-brand">
        <!-- 飘心层：点击爱心时从点击处向上飘散 -->
        <span v-for="h in floatHearts" :key="h.id"
          class="heart-float"
          :style="{ left: h.x + 'px', top: h.y + 'px', '--drift': h.drift + 'px', fontSize: h.size + 'px' }"
          aria-hidden="true">♥</span>
        <span class="brand-heart" aria-hidden="true" @click="burstHeart" title="点我一下"><span class="heart-pulse">♡</span></span>
        <div class="brand-copy">
          <span class="brand-eyebrow"><i class="eyebrow-star" aria-hidden="true">✦</i>Archive</span>
          <span class="brand-text">Love Days</span>
        </div>
        <button
          class="drawer-close"
          type="button"
          aria-label="关闭菜单"
          @click="drawerOpen = false"
        >
          ✕
        </button>
      </div>
      <div class="brand-divider"></div>

      <TransitionGroup tag="nav" name="menu-flip" class="sidebar-nav">
        <router-link
          v-for="(item, i) in menus"
          :key="item.key"
          :to="item.to"
          class="nav-item"
          :data-key="item.key"
          draggable="false"
          :class="{
            active: activeMenu === item.key,
            dragging: dragState.active && dragState.key === item.key,
            [`nav-item--${item.key}`]: true
          }"
          :style="{
            animationDelay: `${0.06 * i + 0.1}s`,
            '--lx': liquidPos[item.key].x + '%',
            '--ly': liquidPos[item.key].y + '%'
          }"
          @pointerdown="onNavPointerDown(item.key, $event)"
          @contextmenu.prevent
          @click.capture="onNavClickCapture($event)"
          @mouseenter="onMenuEnter(item.key, $event)"
          @mousemove="onMenuMove(item.key, $event)"
          @mouseleave="onMenuLeave(item.key)"
          @click="onMenuClick(item.key, $event)"
        >
          <!-- 跟随鼠标的液体光斑 -->
          <span
            class="liquid-spot"
            :class="{ on: liquidPos[item.key].on }"
            aria-hidden="true"
          ></span>

          <!-- Gemini 风格粒子层（canvas 与菜单框等大，粒子不溢出容器） -->
          <canvas
            :ref="canvasBinders[item.key]"
            class="particle-canvas"
            aria-hidden="true"
          ></canvas>

          <span class="nav-icon" aria-hidden="true">{{ item.icon }}</span>
          <span class="nav-text">
            <span class="nav-label">{{ item.label }}</span>
            <span class="nav-desc">{{ item.desc }}</span>
          </span>
        </router-link>
      </TransitionGroup>

      <div class="sidebar-footer">
        <!-- 玫瑰金 ✦ 饰带 -->
        <div class="footer-flourish" aria-hidden="true">✦</div>
        <!-- 轮换情话小卡 -->
        <div class="love-note" aria-hidden="true">
          <span class="love-note-heart">✦</span>
          <span class="love-note-text" :key="noteIdx">{{ LOVE_NOTES[noteIdx] }}</span>
        </div>
        <div v-if="isLoggedIn" class="user-block">
          <button
            class="user-avatar group relative cursor-pointer"
            title="管理头像与资料"
            @click="router.push('/mine')"
          >
            <div class="user-avatar-inner">
              <img v-if="user?.avatar" :src="user.avatar" :alt="displayName" />
              <span v-else>{{ displayName[0] }}</span>
            </div>
            <span class="avatar-edit-mask" aria-hidden="true">✎</span>
          </button>
          <div class="user-info">
            <span class="user-name">{{ displayName }}</span>
            <button class="logout-btn" @click="handleLogout">退出登录</button>
          </div>
        </div>
      </div>
    </aside>
  </template>
</template>

<style scoped>
.sidebar {
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  width: 232px;
  display: flex;
  flex-direction: column;
  /* 分层背景（雾蓝灰版）：右上雾蓝柔光 + 中左一抹玫瑰金 + 右下浅薰，底是冷灰蓝渐变 */
  background:
    radial-gradient(150% 55% at 88% -6%, rgba(143, 175, 212, 0.45), transparent 58%),
    radial-gradient(130% 50% at -12% 42%, rgba(230, 165, 165, 0.28), transparent 55%),
    radial-gradient(140% 55% at 115% 100%, rgba(185, 185, 222, 0.24), transparent 62%),
    linear-gradient(178deg, #eef1f6 0%, #e3e9f1 45%, #d7dfea 100%);
  border-right: 1px solid rgba(120, 140, 165, 0.3);
  box-shadow: 4px 0 28px rgba(110, 130, 160, 0.14);
  z-index: 30;
  animation: sidebar-in 0.4s var(--ease-out) both;
}

.sidebar::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(140, 170, 205, 0.5), transparent);
  pointer-events: none;
}

/* 右缘光带：一道垂直细光，强调菜单边界 */
.sidebar::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  right: 0;
  width: 1px;
  background: linear-gradient(180deg, transparent, rgba(240, 245, 252, 0.6) 30%, rgba(214, 140, 150, 0.5) 62%, transparent);
  pointer-events: none;
}

/* 极光：两团缓慢漂移的柔光，让背景有"呼吸感"（仅 transform 动画，不触发重绘） */
.sidebar-aurora {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}
.sidebar-aurora::before,
.sidebar-aurora::after {
  content: '';
  position: absolute;
  width: 230px;
  height: 230px;
  border-radius: 50%;
  filter: blur(52px);
  opacity: 0.8;
  will-change: transform;
}
.sidebar-aurora::before {
  top: -52px;
  left: -64px;
  background: radial-gradient(circle, rgba(140, 172, 208, 0.55), transparent 68%);
  animation: aurora-a 28s ease-in-out infinite alternate;
}
.sidebar-aurora::after {
  bottom: 8%;
  right: -70px;
  background: radial-gradient(circle, rgba(230, 160, 165, 0.5), transparent 68%);
  animation: aurora-b 34s ease-in-out infinite alternate;
}
@keyframes aurora-a {
  from { transform: translate3d(0, 0, 0); }
  to { transform: translate3d(46px, 66px, 0) scale(1.2); }
}
@keyframes aurora-b {
  from { transform: translate3d(0, 0, 0); }
  to { transform: translate3d(-42px, -60px, 0) scale(1.25); }
}

/* 内容浮在极光之上 */
.sidebar-brand,
.sidebar-nav,
.sidebar-footer {
  position: relative;
  z-index: 1;
}

@keyframes sidebar-in {
  from {
    opacity: 0;
    transform: translateX(-12px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 28px 20px 22px;
}

.drawer-close {
  display: none;
}

/* 点击爱心后飘出的小爱心：自点击处向上飘，左右微摆，渐隐消失 */
.heart-float {
  position: absolute;
  z-index: 3;
  pointer-events: none;
  color: #e08a97;
  line-height: 1;
  text-shadow: 0 0 10px rgba(224, 138, 151, 0.65), 0 2px 6px rgba(120, 60, 80, 0.2);
  opacity: 0;
  animation: heart-rise 1.5s var(--ease-out) forwards;
  will-change: transform, opacity;
}
@keyframes heart-rise {
  0% {
    opacity: 0;
    transform: translate(0, 0) scale(0.4) rotate(0deg);
  }
  15% {
    opacity: 1;
  }
  60% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(var(--drift), -120px) scale(1.15) rotate(10deg);
  }
}

/* 心形 logo：无框裸心，只有 ♡ 本身带一点柔光，菜单的"脉搏" */
.brand-heart {
  cursor: pointer;
  display: flex;
  align-items: center;
  font-family: var(--font-display);
  font-size: 30px;
  color: #c6818c;
  line-height: 1;
  text-shadow: 0 0 14px rgba(214, 140, 150, 0.45), 0 2px 6px rgba(120, 60, 80, 0.18);
}

/* ♦ 只有 ♡ 本身在跳，外层玻璃框完全静止 */
.heart-pulse {
  display: inline-block;
  line-height: 1;
  animation: brand-beat 2.8s ease-in-out infinite;
  transform-origin: center;
}
@keyframes brand-beat {
  0%, 100% { transform: scale(1); }
  25% { transform: scale(1.12); }
  40% { transform: scale(1); }
  55% { transform: scale(1.07); }
}

.brand-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.brand-eyebrow {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: rgba(96, 112, 134, 0.8);
}

/* 眉标前的玫瑰金 ✦ */
.eyebrow-star {
  font-style: normal;
  margin-right: 5px;
  color: #b76e79;
  text-shadow: 0 0 8px rgba(214, 140, 150, 0.7);
}

.brand-text {
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 600;
  letter-spacing: 0.04em;
  line-height: 1.1;
  /* 渐变文字：深玫瑰金 → 玫瑰金 → 亮玫瑰金，雾蓝底上的"玫瑰金"质感 */
  background: linear-gradient(120deg, #8e4a56 15%, #b76e79 55%, #d9a3a3 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 1px 8px rgba(183, 110, 121, 0.35));
}

.brand-divider {
  margin: 0 18px;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(150, 178, 210, 0.5) 30%,
    rgba(150, 178, 210, 0.5) 70%,
    transparent
  );
}

.sidebar-nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 14px;
  counter-reset: nav;
}

/* 每个菜单项一个专属强调色（玫瑰 / 香槟金 / 紫罗兰），避免清一色白卡的单调 */
.nav-item--home {
  --acc: #d64a7c;
  --acc-soft: rgba(214, 74, 124, 0.14);
  --acc-deep: #a83259;
}
.nav-item--all {
  --acc: #b76e79;
  --acc-soft: rgba(183, 110, 121, 0.16);
  --acc-deep: #8e4a56;
}
.nav-item--mine {
  --acc: #7a4bd0;
  --acc-soft: rgba(122, 75, 208, 0.12);
  --acc-deep: #5d38a8;
}
.nav-item--age {
  --acc: #c99a3f;
  --acc-soft: rgba(201, 154, 63, 0.16);
  --acc-deep: #9c721f;
}

.nav-item {
  position: relative;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  /* 手机端：触摸手势完全交给 Pointer Events，避免浏览器滚动/缩放
     接管导致 pointercancel 中断长按拖拽 */
  touch-action: none;
  display: flex;
  align-items: center;
  gap: 12px;
  counter-increment: nav;
  padding: 12px 14px;
  border-radius: 16px;
  font-size: 14.5px;
  font-weight: 500;
  letter-spacing: 0.3px;
  color: rgba(42, 52, 68, 0.82);
  overflow: hidden;
  isolation: isolate;
  opacity: 0;
  /* 入场只做淡入：transform 完全留给 TransitionGroup 的 FLIP 换位动画 */
  animation: nav-in 0.45s var(--ease-out) forwards;
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.66), rgba(255, 255, 255, 0.38));
  border: 1px solid rgba(255, 255, 255, 0.75);
  /* 磨砂玻璃：透出底下极光，高级感关键 */
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  /* 顶缘一抹冷白霜光 */
  box-shadow: inset 0 1px 0 rgba(235, 242, 250, 0.6);
  transition: color 0.4s ease, background 0.4s ease, border-color 0.4s ease,
    box-shadow 0.4s ease, translate 0.45s var(--ease-out);
}

@keyframes nav-in {
  to {
    opacity: 1;
  }
}

/* 换位平滑：FLIP 过渡（transform 专用于此） */
.menu-flip-move {
  transition: transform 0.5s var(--ease-out), translate 0.3s var(--ease-out);
}

/* 长按拖拽中：视觉提升，跟随鼠标（scale/rotate 用独立属性，不与 FLIP 的 transform 冲突） */
.nav-item.dragging {
  z-index: 5;
  scale: 1.06;
  rotate: -0.6deg;
  opacity: 0.94;
  cursor: grabbing;
  border-color: var(--acc);
  box-shadow: 0 14px 30px rgba(110, 130, 160, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.85);
}

.nav-item:hover {
  color: #252f3f;
  border-color: var(--acc);
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.92), rgba(255, 255, 255, 0.66));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 10px 24px rgba(110, 130, 160, 0.16),
    0 0 18px var(--acc-soft);
  translate: 0 -2px;
}

/* hover 时从右侧滑入的小箭头 */
.nav-item::after {
  content: '→';
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translate(-6px, -50%);
  font-size: 13px;
  color: var(--acc);
  opacity: 0;
  transition: opacity 0.35s ease, transform 0.4s var(--ease-out);
  pointer-events: none;
}
.nav-item:hover::after {
  opacity: 1;
  transform: translate(0, -50%);
}

.nav-item.active {
  background: linear-gradient(135deg, #ffffff 0%, #f4f7fb 100%);
  border-color: rgba(183, 110, 121, 0.55);
  color: var(--acc-deep);
  font-weight: 600;
  /* 呼吸光晕：金环明暗缓慢交替，选中项"活着"
     nav-in 必须并列保留：它的 forwards 填充维持 opacity/transform，
     若被简写覆盖，选中项会退回 opacity:0 而消失 */
  animation: nav-in 0.45s var(--ease-out) forwards, active-breath 6s ease-in-out infinite;
}

@keyframes active-breath {
  0%,
  100% {
    box-shadow: 0 6px 18px rgba(183, 110, 121, 0.16), 0 0 0 1px rgba(183, 110, 121, 0.35);
  }
  50% {
    box-shadow: 0 10px 26px rgba(183, 110, 121, 0.24), 0 0 0 1px rgba(183, 110, 121, 0.6),
      0 0 26px var(--acc-soft);
  }
}

.nav-item.active::after {
  /* 编辑风序号：01/02/03，像精品菜单的目录页码 */
  content: '0' counter(nav);
  opacity: 0.42;
  transform: translate(0, -50%);
  color: var(--acc-deep);
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.14em;
  transition: opacity 0.3s ease;
}

.nav-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 56%;
  border-radius: 0 3px 3px 0;
  /* 玫瑰金 → 强调色，比纯强调色更贵气 */
  background: linear-gradient(180deg, #e8c3c3 0%, var(--acc) 45%, var(--acc-deep) 100%);
  z-index: 3;
}

/* 图标：放进半透明彩色瓷片，强调色随菜单变化 */
.nav-icon {
  position: relative;
  z-index: 3;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 11px;
  font-size: 17px;
  line-height: 1;
  background: var(--acc-soft);
  border: 1px solid rgba(255, 255, 255, 0.9);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
  transition: transform 0.4s var(--ease-out), box-shadow 0.4s ease;
}

.nav-item:hover .nav-icon,
.nav-item.active .nav-icon {
  transform: scale(1.08);
}

.nav-item:hover .nav-icon {
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 0 14px var(--acc-soft);
}

/* 双行文字：主标签 + 小描述 */
.nav-text {
  position: relative;
  z-index: 3;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding-right: 16px;
}

.nav-label {
  font-size: 14.5px;
  line-height: 1.15;
}

.nav-desc {
  font-size: 10px;
  letter-spacing: 0.06em;
  color: rgba(80, 96, 118, 0.6);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nav-item.active .nav-desc {
  color: var(--acc-deep);
  opacity: 0.7;
}

/* —— 液体光斑：跟着手指在菜单内滑动 —— */
.liquid-spot {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.5s ease;
  background: radial-gradient(
    circle 68px at var(--lx, 50%) var(--ly, 50%),
    rgba(214, 140, 150, 0.36) 0%,
    rgba(214, 140, 150, 0.12) 38%,
    transparent 68%
  );
}

.liquid-spot.on {
  opacity: 1;
}

.nav-item.active .liquid-spot {
  background: radial-gradient(
    circle 70px at var(--lx, 50%) var(--ly, 50%),
    rgba(214, 140, 150, 0.28) 0%,
    rgba(240, 200, 200, 0.1) 40%,
    transparent 70%
  );
}

/* —— Gemini 风格粒子层：canvas 铺满菜单框，粒子被裁剪在容器内部 —— */
/* 注意：canvas 是替换元素，绝对定位下 inset:0 不会拉伸它，必须显式给 100% 宽高 */
.particle-canvas {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  z-index: 2;
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .liquid-spot,
  .particle-canvas {
    display: none !important;
  }
  .sidebar-aurora::before,
  .sidebar-aurora::after,
  .heart-pulse,
  .love-note-heart,
  .nav-item.active {
    animation: none !important;
  }
  .nav-item:hover {
    translate: 0 0;
  }
  .nav-item.active {
    box-shadow: 0 6px 18px rgba(183, 110, 121, 0.16), 0 0 0 1px rgba(183, 110, 121, 0.35);
  }
}

.sidebar-footer {
  padding: 14px;
  border-top: 1px solid rgba(120, 140, 165, 0.3);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* 页脚 ✦ 玫瑰金饰带：两段渐隐细线托一颗星 */
.footer-flourish {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #c6818c;
  font-size: 10px;
  text-shadow: 0 0 8px rgba(214, 140, 150, 0.5);
}
.footer-flourish::before,
.footer-flourish::after {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(198, 129, 140, 0.45), transparent);
}

/* 轮换情话小卡：页脚的"碎碎念"，让菜单显得有温度 */
.love-note {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border-radius: 13px;
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(183, 110, 121, 0.35);
  box-shadow: inset 0 1px 0 rgba(235, 242, 250, 0.32);
  font-size: 11.5px;
  letter-spacing: 0.04em;
  color: rgba(58, 70, 90, 0.85);
}

.love-note-heart {
  flex-shrink: 0;
  color: #b76e79;
  font-size: 12px;
  animation: sparkle-spin 12s linear infinite;
}

@keyframes sparkle-spin {
  0% { transform: rotate(0deg) scale(1); }
  50% { transform: rotate(180deg) scale(1.3); }
  100% { transform: rotate(360deg) scale(1); }
}

.love-note-text {
  min-width: 0;
  animation: note-in 0.5s var(--ease-out) both;
}

@keyframes note-in {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}

.user-block {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.62);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(183, 110, 121, 0.4);
  box-shadow: inset 0 1px 0 rgba(235, 242, 250, 0.32);
}

/* 头像：玫瑰金系 conic 渐变环（呼应菜单的玫瑰金强调）+ 悬停可编辑 */
.user-avatar {
  position: relative;
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  padding: 2px;
  background: conic-gradient(from 200deg, #e8b4a8, #cf9ba8, #c4b0dc, #e8b4a8);
  transition: transform 0.3s var(--ease-out, ease), box-shadow 0.3s ease;
}
.user-avatar:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(80, 100, 130, 0.22);
}

/* 悬停「✎」蒙层：点击跳「我的」管理头像 */
.avatar-edit-mask {
  position: absolute;
  inset: 2px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  font-size: 13px;
  color: #fff;
  background: rgba(42, 52, 68, 0.5);
  opacity: 0;
  transition: opacity 0.25s ease;
}
.user-avatar:hover .avatar-edit-mask,
.user-avatar:focus-visible .avatar-edit-mask {
  opacity: 1;
}

.user-avatar-inner {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  overflow: hidden;
  background: linear-gradient(135deg, #fff, #eef1f6);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 600;
  color: var(--rose-600);
}

.user-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.user-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.user-name {
  font-size: 13.5px;
  font-weight: 600;
  color: #2a3444;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
}

.logout-btn {
  font-size: 11.5px;
  color: rgba(80, 96, 118, 0.65);
  text-align: left;
  padding: 3px 10px;
  border-radius: 8px;
  background: rgba(120, 140, 165, 0.1);
  border: 1px solid rgba(120, 140, 165, 0.3);
  transition: color var(--dur-slow) ease, background var(--dur-slow) ease,
    transform var(--dur-base) var(--ease-out);
}

.logout-btn:hover {
  color: var(--rose-600);
  background: #fff;
  transform: translateY(-1px);
}

.logout-btn:active {
  transform: translateY(0) scale(0.96);
}

.menu-toggle {
  display: none;
}

.drawer-mask {
  display: none;
}

@media (min-width: 1024px) {
  .sidebar {
    transform: translateX(0);
  }
}

@media (max-width: 1023px) {
  .menu-toggle {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 5px;
    position: fixed;
    top: 12px;
    left: 12px;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: linear-gradient(135deg, #d8a8a8 0%, #c68d8d 55%, #b76e79 100%);
    box-shadow: 0 4px 14px rgba(183, 110, 121, 0.22),
      inset 0 1px 0 rgba(255, 255, 255, 0.35);
    z-index: 60;
    transition: transform 0.2s var(--ease-out), box-shadow 0.2s ease, opacity 0.2s ease;
  }

  .menu-toggle:active {
    transform: scale(0.92);
  }

  .menu-toggle.is-hidden {
    opacity: 0;
    pointer-events: none;
    transform: scale(0.8);
  }

  .menu-toggle span {
    display: block;
    width: 19px;
    height: 2px;
    border-radius: 2px;
    background: #fff;
    transition: transform 0.25s ease, opacity 0.2s ease;
  }

  .drawer-mask {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(43, 20, 33, 0.45);
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);
    z-index: 40;
  }

  .mask-fade-enter-active,
  .mask-fade-leave-active {
    transition: opacity 0.28s ease;
  }

  .mask-fade-enter-from,
  .mask-fade-leave-to {
    opacity: 0;
  }

  .sidebar {
    width: min(272px, 82vw);
    transform: translateX(-100%);
    transition: transform 0.32s var(--ease-out);
    animation: none;
    z-index: 50;
    box-shadow: 8px 0 32px rgba(110, 130, 160, 0.22);
    /* 手机端抽屉内容超高时可滚动（nav-item 自身仍是拖动专用触摸区） */
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .sidebar.open {
    transform: translateX(0);
  }

  .sidebar-brand {
    justify-content: flex-start;
  }

  .drawer-close {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: auto;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    font-size: 13px;
    color: rgba(42, 52, 68, 0.85);
    background: rgba(255, 255, 255, 0.6);
    border: 1px solid rgba(183, 110, 121, 0.4);
    transition: background 0.2s ease, transform 0.15s var(--ease-out);
  }

  .drawer-close:active {
    transform: scale(0.9);
    background: rgba(255, 255, 255, 0.26);
  }

  .nav-item {
    opacity: 1;
    transform: none;
    animation: none;
  }
}
</style>
