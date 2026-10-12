/**
 * Cookie 工具：token 存放于 Cookie，30 分钟有效（与后端会话有效期对齐）
 * 到期浏览器自动删除；HTTPS 环境下自动附加 Secure 标志
 */

// token 有效期：30 分钟（单位：秒）
export const TOKEN_MAX_AGE = 1800

/**
 * 设置 Cookie
 * @param {string} name Cookie 名
 * @param {string} value Cookie 值
 * @param {number} [maxAge=TOKEN_MAX_AGE] 有效期（秒）
 */
export function setCookie(name, value, maxAge = TOKEN_MAX_AGE) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`
}

/**
 * 读取 Cookie
 * @param {string} name Cookie 名
 * @returns {string|null} 值（无则 null）
 */
export function getCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

/**
 * 删除 Cookie（立即过期）
 * @param {string} name Cookie 名
 */
export function removeCookie(name) {
  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`
}
