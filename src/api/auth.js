import request from './request'

/**
 * 认证相关接口（登录 / 注册 / 当前用户）
 *
 * 后端对接说明：
 * 实现以下接口即可，统一响应结构 { code: 0, message: 'success', data: ... }
 *
 *   POST /auth/login     { userName, password }            -> LoginResult
 *   POST /auth/register  { userName, password, nickName }  -> LoginResult
 *   GET  /auth/profile                                     -> UserInfo
 *
 * LoginResult:
 * {
 *   token: string    访问令牌（前端存入 Cookie，30 分钟有效，后续请求自动携带 Bearer token）
 *   user:  UserInfo
 * }
 *
 * UserInfo（字段以实测现状为准）：
 * {
 *   id:       number|string
 *   userName: string     账号（邮箱或纯数字）
 *   nickName: string     昵称
 *   avatar:   string     可选，未上传时为 ""
 * }
 *
 * 失败时返回 code 非 0，message 为提示信息，
 * 如：账号或密码错误 / 账号已存在 / 参数不合法。
 */

/**
 * 登录
 * @param {{ username: string, password: string }} data
 * @returns {Promise<{ token: string, user: object }>}
 */
export function login(data) {
  return request({
    url: '/auth/login',
    method: 'post',
    data
  })
}

/**
 * 注册
 * @param {{ userName: string, password: string, nickName?: string }} data
 * @returns {Promise<{ token: string, user: object }>}
 */
export function register(data) {
  return request({
    url: '/auth/register',
    method: 'post',
    data
  })
}

/**
 * 获取当前登录用户信息
 * @returns {Promise<object>}
 */
export function getProfile() {
  return request({
    url: '/auth/profile',
    method: 'get'
  })
}
