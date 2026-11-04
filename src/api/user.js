import request from './request'

/**
 * 用户资料 / 账号设置接口（「我的」页）
 *
 * 统一响应格式：{ "code": 0, "message": "success", "data": <数据> }
 *
 * 后端 user 实体字段（以现状为准）：userName / nickName / avatar / creatTime。
 * 响应中永不返回 password 字段。
 */

/**
 * 更新当前用户资料（昵称 / 头像）
 * PUT /user/profile
 * 只传要改的字段（avatar / nickName），不传 id：
 * 后端从 token 解析当前用户主键（CullentUtil）定位记录。
 * @param {{ nickName?: string, avatar?: string }} data
 * @returns {Promise<object>} 更新后的完整用户信息
 */
export function updateProfile(data) {
  return request({
    url: '/user/profile',
    method: 'put',
    data
  })
}

/**
 * 修改密码
 * PUT /user/password
 * @param {{ oldPassword: string, newPassword: string }} data
 * @returns {Promise<null>}
 */
export function changePassword(data) {
  return request({
    url: '/user/password',
    method: 'put',
    data
  })
}