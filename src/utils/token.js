/**
 * token（JWT）解析工具
 *
 * 菜单用户名的展示以 token 为准：JWT 的 payload（中间段）是 base64url 编码的 JSON，
 * 不同后端字段命名不一，这里按常见字段名依次容错查找。
 * token 不是 JWT（如不透明字符串）或解析失败时返回空串，由调用方回退到其他来源。
 */

/**
 * 安全解析 JWT 的 payload
 * @param {string} token JWT 字符串（可为空）
 * @returns {object|null} payload 对象；格式非法或解析失败返回 null
 */
export function parseTokenPayload(token) {
  if (!token || typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    // base64url -> base64（补 -/_ 与 = 填充）
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    b64 += '='.repeat((4 - (b64.length % 4)) % 4)
    // atob 得到的是 latin1 字节串，逐字节转 UTF-8 再解码（支持中文用户名）
    const bytes = atob(b64)
    const bin = bytes
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
    const obj = JSON.parse(decodeURIComponent(bin))
    return obj && typeof obj === 'object' ? obj : null
  } catch {
    return null
  }
}

/**
 * 从 token 中取显示的用户名
 * 字段优先级：username > userName > name > nickName > nickname > sub
 * （sub 常为用户名或 id，放最后且只接受字符串，避免把数字 id 当名字显示）
 * @param {string} token JWT 字符串（可为空）
 * @returns {string} 用户名；取不到返回空串
 */
export function getUserNameFromToken(token) {
  const p = parseTokenPayload(token)
  if (!p) return ''
  const keys = ['username', 'userName', 'name', 'nickName', 'nickname', 'sub']
  for (const k of keys) {
    const v = p[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}
