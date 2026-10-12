import axios from 'axios'
import { mockAdapter } from '@/mock/mockAdapter'
import { getCookie, removeCookie } from '@/utils/cookie'
import { showToast } from '@/utils/toast'

/**
 * 统一的 axios 实例
 *
 * 分流规则：
 * 1. 认证接口（/auth/*：登录 / 注册 / 当前用户）始终发送真实 HTTP 请求到后端，
 *    用户凭据不写入浏览器本地存储，也不会被 Mock 拦截；
 * 2. 其余接口在 VITE_USE_MOCK=true 时由本地 Mock 适配器接管，
 *    后端全部就绪后将其改为 false，所有请求即走真实后端。
 */
const useMock = import.meta.env.VITE_USE_MOCK === 'true'
// 真实网络适配器（浏览器环境为 XMLHttpRequest）
const realAdapter = axios.getAdapter(['xhr', 'http', 'fetch'])

const service = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10000,
  adapter: (config) => {
    const isAuthRequest = /^\/auth\//.test(config.url || '')
    // 认证请求必须走真实后端；非 Mock 模式下所有请求都走真实后端
    if (!useMock || isAuthRequest) {
      return realAdapter(config)
    }
    return mockAdapter(config)
  }
})

// 请求拦截器：统一携带 token（存于 Cookie，30 分钟有效）
service.interceptors.request.use(
  (config) => {
    const token = getCookie('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// 响应拦截器：统一处理后端返回结构 { code, message, data }
//
// 后端约定：HTTP 永远返回 200，错误信息通过响应体 code+message 表达。
//   code === 0      → 业务成功，返回 data
//   code === 401    → token 失效（缺失/无效/过期），清登录态并跳登录页
//   code !== 0 其他 → 业务错误，抛出 Error(message)，页面 toast 展示
// 另：网络层错误（断网/超时/5xx）走 error 分支。
function handleUnauthorized(message) {
  removeCookie('token')
  localStorage.removeItem('user_info')
  // 通知 auth store 同步清空内存中的登录态（token/user ref）
  window.dispatchEvent(new Event('auth:unauthorized'))
  showToast(message || '登录已过期，请重新登录')
  window.location.hash = '#/login'
}

service.interceptors.response.use(
  (response) => {
    const res = response.data

    if (res.code !== undefined && res.code !== 0) {
      // token 失效：HTTP 200 + code=401（后端实际行为）
      if (res.code === 401) {
        handleUnauthorized(res.message)
      }
      console.error(`[请求错误] ${res.message || 'Error'}`)
      return Promise.reject(new Error(res.message || '请求失败'))
    }

    return res.data !== undefined ? res.data : res
  },
  (error) => {
    // 兜底：若后端某天改回 HTTP 401 状态码，仍能正确处理
    if (error.response?.status === 401) {
      handleUnauthorized(error.response.data?.message)
    }
    console.error(`[网络错误] ${error.message}`)
    return Promise.reject(error)
  }
)

export default service
