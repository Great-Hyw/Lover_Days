<script setup>
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { showToast } from '@/utils/toast'
import bgImage from '@/assets/love-bg.jpg'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

// login / register
const mode = ref('login')
const loading = ref(false)

const form = reactive({
  username: '',
  password: '',
  nickname: ''
})

const errors = reactive({
  username: '',
  password: '',
  nickname: ''
})

const isLogin = computed(() => mode.value === 'login')

// —— 背景飘浮爱心：从屏幕底部缓慢向上飘动 ——
const HEART_EMOJIS = ['💖', '💕', '💗', '💓', '❤️', '💘']
const rand = (min, max) => min + Math.random() * (max - min)

const hearts = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  left: rand(2, 96), // 水平起始位置（%）
  size: rand(14, 30), // 大小
  duration: rand(10, 20), // 飘升耗时（秒）
  delay: -rand(0, 18), // 负延迟，首屏即分布在各高度
  opacity: rand(0.4, 0.85),
  drift: rand(-50, 50), // 上升过程中的水平漂移
  emoji: HEART_EMOJIS[Math.floor(rand(0, HEART_EMOJIS.length))]
}))

function switchMode(target) {
  mode.value = target
  errors.username = ''
  errors.password = ''
  errors.nickname = ''
}

function validate() {
  errors.username = ''
  errors.password = ''
  errors.nickname = ''
  let valid = true

  if (!form.username.trim()) {
    errors.username = '请输入用户名'
    valid = false
  } else if (form.username.trim().length < 2) {
    errors.username = '用户名至少 2 个字符'
    valid = false
  }

  if (!form.password) {
    errors.password = '请输入密码'
    valid = false
  } else if (form.password.length < 6) {
    errors.password = '密码至少 6 位'
    valid = false
  }

  if (!isLogin.value && !form.nickname.trim()) {
    errors.nickname = '请输入昵称'
    valid = false
  }

  return valid
}

async function onSubmit() {
  if (loading.value) return
  if (!validate()) return

  loading.value = true
  try {
    if (isLogin.value) {
      await authStore.login({
        userName: form.username.trim(),
        password: form.password
      })
      showToast('欢迎回来～')
    } else {
      await authStore.register({
        userName: form.username.trim(),
        password: form.password,
        nickName: form.nickname.trim()
      })
      showToast('注册成功，欢迎加入～')
    }

    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    router.replace(redirect)
  } catch (e) {
    showToast(e?.message || '操作失败，请稍后再试')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <!-- 全屏背景图 -->
    <div class="bg-layer" :style="{ backgroundImage: `url('${bgImage}')` }"></div>
    <div class="bg-mask"></div>

    <!-- 从底部向上飘动的爱心 -->
    <div class="hearts-layer" aria-hidden="true">
      <span
        v-for="h in hearts"
        :key="h.id"
        class="float-heart"
        :style="{
          left: h.left + '%',
          fontSize: h.size + 'px',
          animationDuration: h.duration + 's',
          animationDelay: h.delay + 's',
          '--heart-opacity': h.opacity,
          '--heart-drift': h.drift + 'px'
        }"
      >{{ h.emoji }}</span>
    </div>

    <div class="content">
      <!-- 标题 -->
      <div class="brand">
        <span class="brand-icon">💞</span>
        <h1 class="brand-title">Love Days</h1>
        <p class="brand-sub">记录我们的每一个纪念日</p>
      </div>

      <!-- 登录卡片 -->
      <div class="login-card">
        <div class="tabs">
          <button
            type="button"
            class="tab"
            :class="{ active: isLogin }"
            @click="switchMode('login')"
          >
            登录
          </button>
          <button
            type="button"
            class="tab"
            :class="{ active: !isLogin }"
            @click="switchMode('register')"
          >
            注册
          </button>
        </div>

        <form class="form" novalidate @submit.prevent="onSubmit">
          <div class="field">
            <span class="field-icon">👤</span>
            <input
              v-model.trim="form.username"
              type="text"
              placeholder="用户名"
              autocomplete="username"
              @input="errors.username = ''"
            />
          </div>
          <p v-if="errors.username" class="error-msg">{{ errors.username }}</p>

          <div class="field">
            <span class="field-icon">🔒</span>
            <input
              v-model="form.password"
              type="password"
              placeholder="密码"
              :autocomplete="isLogin ? 'current-password' : 'new-password'"
              @input="errors.password = ''"
            />
          </div>
          <p v-if="errors.password" class="error-msg">{{ errors.password }}</p>

          <template v-if="!isLogin">
            <div class="field">
              <span class="field-icon">💌</span>
              <input
                v-model.trim="form.nickname"
                type="text"
                placeholder="昵称（如何称呼你）"
                autocomplete="nickname"
                @input="errors.nickname = ''"
              />
            </div>
            <p v-if="errors.nickname" class="error-msg">{{ errors.nickname }}</p>
          </template>

          <button type="submit" class="submit-btn" :disabled="loading">
            {{ loading ? '请稍候…' : isLogin ? '登 录' : '注 册' }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
}

/* 背景图层 */
.bg-layer {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  z-index: 0;
}

.bg-mask {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    rgba(70, 40, 58, 0.32) 0%,
    rgba(90, 50, 72, 0.42) 55%,
    rgba(50, 28, 44, 0.6) 100%
  );
  z-index: 1;
}

/* 飘浮爱心层：在遮罩之上、内容卡片之下 */
.hearts-layer {
  position: absolute;
  inset: 0;
  z-index: 2;
  overflow: hidden;
  pointer-events: none;
}

.float-heart {
  position: absolute;
  bottom: -40px;
  line-height: 1;
  user-select: none;
  opacity: 0;
  filter: drop-shadow(0 2px 6px rgba(80, 30, 55, 0.35));
  animation-name: heart-float;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
  will-change: transform, opacity;
}

/* 从屏幕底部缓慢飘到顶部，带轻微水平漂移与旋转 */
@keyframes heart-float {
  0% {
    opacity: 0;
    transform: translate3d(0, 0, 0) rotate(0deg) scale(0.8);
  }
  10% {
    opacity: var(--heart-opacity, 0.6);
  }
  50% {
    opacity: var(--heart-opacity, 0.6);
    transform: translate3d(calc(var(--heart-drift, 0px) * 0.5), -55vh, 0)
      rotate(12deg) scale(1);
  }
  85% {
    opacity: var(--heart-opacity, 0.6);
  }
  100% {
    opacity: 0;
    transform: translate3d(var(--heart-drift, 0px), -110vh, 0)
      rotate(-10deg) scale(0.9);
  }
}

/* 尊重系统的减弱动效设置 */
@media (prefers-reduced-motion: reduce) {
  .float-heart {
    display: none;
  }
}

.content {
  position: relative;
  z-index: 3;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 28px 20px;
  gap: 26px;
}

/* 品牌标题 */
.brand {
  text-align: center;
  color: #fff;
}

.brand-icon {
  font-size: 44px;
  display: block;
  margin-bottom: 6px;
  animation: heartbeat 1.6s ease-in-out infinite;
}

@keyframes heartbeat {
  0%, 100% { transform: scale(1); }
  14% { transform: scale(1.12); }
  28% { transform: scale(1); }
  42% { transform: scale(1.12); }
}

.brand-title {
  font-size: 30px;
  font-weight: 800;
  letter-spacing: 1px;
  text-shadow: 0 2px 12px rgba(50, 20, 40, 0.35);
}

.brand-sub {
  margin-top: 6px;
  font-size: 13.5px;
  opacity: 0.92;
  text-shadow: 0 1px 8px rgba(50, 20, 40, 0.4);
}

/* 毛玻璃登录卡片 */
.login-card {
  width: 100%;
  max-width: 360px;
  background: rgba(255, 255, 255, 0.22);
  backdrop-filter: blur(18px) saturate(1.3);
  -webkit-backdrop-filter: blur(18px) saturate(1.3);
  border: 1.5px solid rgba(255, 255, 255, 0.35);
  border-radius: 22px;
  padding: 22px 22px 18px;
  box-shadow: 0 18px 50px rgba(60, 28, 48, 0.28);
}

.tabs {
  display: flex;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 999px;
  padding: 4px;
  margin-bottom: 20px;
}

.tab {
  flex: 1;
  padding: 9px 0;
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
  border-radius: 999px;
  transition: all 0.25s ease;
}

.tab.active {
  background: #fff;
  color: var(--pink, #ff6b9d);
  box-shadow: 0 4px 12px rgba(80, 30, 55, 0.15);
}

/* 表单 */
.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.field {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(255, 255, 255, 0.85);
  border-radius: 14px;
  padding: 0 14px;
  height: 48px;
  transition: box-shadow 0.2s;
}

.field:focus-within {
  box-shadow: 0 0 0 2.5px rgba(255, 107, 157, 0.55);
}

.field-icon {
  font-size: 16px;
}

.field input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 14.5px;
  color: #3d2b36;
  height: 100%;
}

.field input::placeholder {
  color: #a994a0;
}

.field input:focus {
  outline: none;
}

.error-msg {
  font-size: 12px;
  color: #fff;
  background: rgba(226, 61, 91, 0.75);
  padding: 4px 12px;
  border-radius: 8px;
  /* 抵消 form 的 gap，让错误提示紧贴对应输入框 */
  margin: -6px 0 -2px;
}

.submit-btn {
  /* form 已有 12px gap，这里补到与原来一致的总间距 */
  margin-top: 6px;
  height: 48px;
  border-radius: 14px;
  background: linear-gradient(135deg, #ff7aa8, #ff5f94);
  color: #fff;
  font-size: 15.5px;
  font-weight: 700;
  letter-spacing: 3px;
  box-shadow: 0 10px 24px rgba(255, 95, 148, 0.4);
  transition: transform 0.15s, box-shadow 0.2s;
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 14px 28px rgba(255, 95, 148, 0.48);
}

.submit-btn:active {
  transform: scale(0.98);
}

.submit-btn:disabled {
  opacity: 0.7;
}
</style>
