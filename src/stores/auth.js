import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { login as loginApi, register as registerApi, getProfile } from '@/api/auth'
import { useAnniversaryStore } from '@/stores/anniversary'
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
    if (!authData) return
    const tk = authData.token
    if (!tk) return
    // 兼容两种返回结构：
    //  A. { token, user } 包装
    //  B. 扁平 user 实体（后端现状：token 是实体字段，实体内含主键 id）
    let userObj = authData.user
    if (!userObj && (authData.id !== undefined || authData.userName !== undefined)) {
      // 扁平实体：剔除 token 与密码哈希，不写入本地缓存
      const { token: _tk, password: _pwd, ...rest } = authData
      userObj = rest
    }
    token.value = tk
    user.value = userObj || null
    setCookie('token', tk, TOKEN_MAX_AGE)
    if (userObj) {
      localStorage.setItem(USER_KEY, JSON.stringify(userObj))
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

  /** 资料接口返回后同步更新本地用户信息（token 不变） */
  function updateUser(patch) {
    if (!patch) return
    user.value = { ...(user.value || {}), ...patch }
    localStorage.setItem(USER_KEY, JSON.stringify(user.value))
  }

  /** 启动时用本地 token 拉取最新用户信息；仅 401 才登出 */
  async function restore() {
    if (!token.value) return
    try {
      const profile = await getProfile()
      if (profile) {
        user.value = profile
        localStorage.setItem(USER_KEY, JSON.stringify(profile))
      }
    } catch (e) {
      // 仅 token 失效才登出；网络抖动等不误清已有 user
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
    // 联动清空纪念日等业务数据缓存，避免下个账号看到残留
    // 函数内调用以规避 store 间循环依赖
    useAnniversaryStore().reset()
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
    logout,
    updateUser
  }
})
