import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { login as loginApi, register as registerApi, getProfile } from '@/api/auth'
import { setCookie, getCookie, removeCookie, TOKEN_MAX_AGE } from '@/utils/cookie'

const USER_KEY = 'user_info'

/** 安全读取 localStorage 中的 user_info，坏数据自动清除 */
function readStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    if (!raw || raw === 'undefined') return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    localStorage.removeItem(USER_KEY)
    return null
  }
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref(getCookie('token') || '')
  const user = ref(readStoredUser())

  const isLoggedIn = computed(() => !!token.value)

  /** 登录/注册成功后保存登录态：token 入 Cookie，user 入 localStorage */
  function setAuth(authData) {
    if (!authData || !authData.token) return
    token.value = authData.token
    user.value = authData.user || null
    setCookie('token', authData.token, TOKEN_MAX_AGE)
    if (authData.user) {
      localStorage.setItem(USER_KEY, JSON.stringify(authData.user))
    }
  }

  async function login(form) {
    const result = await loginApi(form)
    setAuth(result)
    return result
  }

  async function register(form) {
    const result = await registerApi(form)
    setAuth(result)
    return result
  }

  /** 启动时用本地 token 拉取最新用户信息；仅 401 才登出 */
  async function restore() {
    if (!token.value) return
    try {
      const profile = await getProfile()
      user.value = profile
      localStorage.setItem(USER_KEY, JSON.stringify(profile))
    } catch (e) {
      // 仅 token 失效才登出；网络抖动等不误清
      if (e?.response?.status === 401) {
        logout()
      }
    }
  }

  function logout() {
    token.value = ''
    user.value = null
    removeCookie('token')
    localStorage.removeItem(USER_KEY)
  }

  // 监听 request.js 发出的 auth:unauthorized 事件（HTTP 200 + code=401 或 HTTP 401）
  // 同步清空内存中的登录态，避免 isLoggedIn 仍为 true
  window.addEventListener('auth:unauthorized', () => {
    token.value = ''
    user.value = null
  })

  return {
    token,
    user,
    isLoggedIn,
    login,
    register,
    restore,
    logout
  }
})
