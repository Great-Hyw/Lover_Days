<script setup>
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAnniversaryStore } from '@/stores/anniversary'
import { showToast } from '@/utils/toast'
import { launchPortal } from '@/utils/login-portal'
import roobits from '@/components/roobits.vue'
import { removeCookie, setCookie } from '../utils/cookie';

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const anniversaryStore = useAnniversaryStore()
const token=ref(' ');

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


/*
*人机验证的组件脚本
*/
const onSuccess=(t)=>{
  token.value=t;
}
const onError=(error)=>{
  console.log(error);
}
const onExpire=()=>{
  console.log("cf令牌到期");
  removeCookie(rtoken);
}
const onTimeout=()=>{
  console.log("cf超时！！！");
  
}



const isLogin = computed(() => mode.value === 'login')

const HEART_EMOJIS = ['💖', '💕', '💗', '💓', '❤️', '💘']
const rand = (min, max) => min + Math.random() * (max - min)

const hearts = Array.from({ length: 14 }, (_, i) => ({
  id: i,
  left: rand(2, 96),
  size: rand(12, 26),
  duration: rand(12, 22),
  delay: -rand(0, 18),
  opacity: rand(0.28, 0.65),
  drift: rand(-50, 50),
  emoji: HEART_EMOJIS[Math.floor(rand(0, HEART_EMOJIS.length))]
}))


const habdle=(token)=>{
  console.log(token);
  
}

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

  const account = form.username.trim()
  if (!account) {
    errors.username = '请输入账号'
    valid = false
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account) && !/^[0-9]+$/.test(account)) {
    // 账号只能是邮箱或纯数字（字段名不变：userName）
    errors.username = '账号需为邮箱或纯数字'
    valid = false
  }

  if (!form.password) {
    errors.password = '请输入密码'
    valid = false
  } else if (isLogin.value) {
    // 登录：只校验非空，格式交给后端（避免误伤历史密码）
  } else if (form.password.length < 6) {
    errors.password = '密码至少 6 位'
    valid = false
  } else if (!/[A-Za-z]/.test(form.password) || !/[0-9]/.test(form.password)) {
    errors.password = '密码需同时包含字母和数字'
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

    anniversaryStore.reset()

    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    // 先播「心形门户」过渡动画，等玫瑰帷幕盖住画面后再跳转首页
    // （页面切换藏在帷幕之后，用户看到的是帷幕落下、首页浮现）
    launchPortal(() => router.replace(redirect))
  } catch (e) {
    showToast(e?.message || '操作失败，请稍后再试')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="bg-layer"></div>
    <div class="bg-mask"></div>

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
      <div class="brand">
        <span class="brand-mark" aria-hidden="true">♡</span>
        <p class="brand-eyebrow">Forever &amp; Always</p>
        <h1 class="brand-title">Love Days</h1>
        <p class="brand-sub">记录我们的每一个纪念日</p>
      </div>

      <div class="login-card">
       <roobits 
       @success="onSuccess"
       @error="onError"
       @expire="onExpire"
       @timeout="onTimeout"                
       >

       </roobits>
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
            <span class="field-icon" aria-hidden="true">👤</span>
            <input
              v-model.trim="form.username"
              type="text"
              placeholder="邮箱或手机号"
              autocomplete="username"
              @input="errors.username = ''"
            />
          </div>
          <p v-if="errors.username" class="error-msg">{{ errors.username }}</p>

          <div class="field">
            <span class="field-icon" aria-hidden="true">🔒</span>
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
              <span class="field-icon" aria-hidden="true">💌</span>
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

.bg-layer {
  position: absolute;
  inset: 0;
  z-index: 0;
  background:
    radial-gradient(ellipse 90% 65% at 18% 12%, rgba(255, 255, 255, 0.85), transparent 55%),
    radial-gradient(ellipse 70% 55% at 85% 22%, rgba(224, 138, 151, 0.32), transparent 62%),
    radial-gradient(ellipse 80% 60% at 78% 88%, rgba(143, 179, 217, 0.38), transparent 60%),
    radial-gradient(ellipse 60% 45% at 12% 85%, rgba(183, 110, 121, 0.22), transparent 58%),
    linear-gradient(
      160deg,
      #f4f0f2 0%,
      #f7f4f6 30%,
      #eef2f7 62%,
      #e8eef6 100%
    );
}

/* 质感：细颗粒 + 柔光，替代照片的纹理感 */
.bg-layer::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(rgba(42, 52, 68, 0.05) 0.6px, transparent 0.6px),
    radial-gradient(rgba(255, 255, 255, 0.55) 0.6px, transparent 0.6px);
  background-size: 22px 22px, 22px 22px;
  background-position: 0 0, 11px 11px;
  opacity: 0.5;
  pointer-events: none;
}

.bg-mask {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 70% 55% at 50% 8%, rgba(214, 140, 150, 0.12), transparent 55%),
    linear-gradient(
      180deg,
      rgba(238, 242, 247, 0.28) 0%,
      rgba(238, 242, 247, 0.1) 45%,
      rgba(226, 233, 242, 0.5) 100%
    );
  z-index: 1;
}

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
  filter: drop-shadow(0 2px 6px rgba(80, 30, 55, 0.3));
  animation-name: heart-float;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
  will-change: transform, opacity;
}

@keyframes heart-float {
  0% {
    opacity: 0;
    transform: translate3d(0, 0, 0) rotate(0deg) scale(0.8);
  }
  10% {
    opacity: var(--heart-opacity, 0.5);
  }
  50% {
    opacity: var(--heart-opacity, 0.5);
    transform: translate3d(calc(var(--heart-drift, 0px) * 0.5), -55vh, 0)
      rotate(12deg) scale(1);
  }
  85% {
    opacity: var(--heart-opacity, 0.5);
  }
  100% {
    opacity: 0;
    transform: translate3d(var(--heart-drift, 0px), -110vh, 0)
      rotate(-10deg) scale(0.9);
  }
}

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
  padding: 32px 20px;
  gap: 28px;
}

.brand {
  text-align: center;
  color: #3d4a5c;
  animation: brand-in 0.8s var(--ease-out) both;
}

@keyframes brand-in {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.brand-mark {
  display: block;
  font-family: var(--font-display);
  font-size: 36px;
  line-height: 1;
  margin-bottom: 10px;
  color: #b76e79;
  text-shadow: 0 0 16px rgba(214, 140, 150, 0.55);
  animation: heartbeat 1.8s ease-in-out infinite;
}

.brand-eyebrow {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.42em;
  text-transform: uppercase;
  color: rgba(183, 110, 121, 0.92);
}

.brand-title {
  font-family: var(--font-display);
  font-size: clamp(2.4rem, 8vw, 3.2rem);
  font-weight: 600;
  letter-spacing: 0.06em;
  margin-top: 6px;
  color: #5a3d4d;
  text-shadow: 0 4px 24px rgba(255, 255, 255, 0.75);
}

.brand-sub {
  margin-top: 10px;
  font-size: 13.5px;
  letter-spacing: 0.18em;
  color: rgba(61, 74, 92, 0.82);
}

.login-card {
  width: 100%;
  max-width: 380px;
  background: rgba(255, 255, 255, 0.66);
  backdrop-filter: blur(24px) saturate(1.4);
  -webkit-backdrop-filter: blur(24px) saturate(1.4);
  border: 1px solid rgba(255, 255, 255, 0.85);
  border-radius: 28px;
  padding: 24px 22px 20px;
  box-shadow:
    0 24px 60px rgba(110, 130, 160, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
  animation: brand-in 0.9s var(--ease-out) 0.08s both;
}

.tabs {
  display: flex;
  background: rgba(226, 233, 242, 0.72);
  border-radius: 999px;
  padding: 4px;
  margin-bottom: 22px;
}

.tab {
  flex: 1;
  padding: 10px 0;
  font-size: 14px;
  font-weight: 600;
  color: rgba(61, 74, 92, 0.78);
  border-radius: 999px;
  transition: all 0.28s var(--ease-out);
}

.tab.active {
  background: linear-gradient(135deg, #e6b0bb, #cf8ba0);
  color: #fff;
  box-shadow: 0 6px 16px rgba(183, 110, 121, 0.35);
}

.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.field {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 16px;
  padding: 0 14px;
  height: 50px;
  border: 1px solid transparent;
  transition: box-shadow 0.2s, border-color 0.2s;
}

.field:focus-within {
  border-color: rgba(204, 75, 121, 0.45);
  box-shadow: 0 0 0 3px rgba(204, 75, 121, 0.18);
}

.field-icon {
  font-size: 15px;
  opacity: 0.85;
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
  background: rgba(226, 61, 91, 0.85);
  padding: 5px 12px;
  border-radius: 10px;
  margin: -6px 0 -2px;
  box-shadow: 0 6px 16px rgba(226, 61, 91, 0.3);
}

.submit-btn {
  margin-top: 8px;
  height: 50px;
  border-radius: 16px;
  background: linear-gradient(135deg, #d85684, #b93a60);
  color: #fff;
  font-size: 15.5px;
  font-weight: 700;
  letter-spacing: 0.28em;
  box-shadow: 0 12px 28px rgba(185, 58, 96, 0.42);
  transition: transform 0.15s, box-shadow 0.2s;
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 16px 34px rgba(185, 58, 96, 0.5);
}

.submit-btn:active {
  transform: scale(0.98);
}

.submit-btn:disabled {
  opacity: 0.7;
}
</style>
