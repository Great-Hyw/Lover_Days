import request from './request'

/**
 * 纪念日相关接口
 *
 * 数据模型 Anniversary：
 * {
 *   id:          number | string   主键
 *   title:       string            纪念日名称，如「第一次见面」
 *   date:        string            日期，格式 YYYY-MM-DD
 *   type:        string            类型：love(相恋) | meet(相识) | birthday(生日)
 *                                        | festival(节日) | proposal(求婚) | custom(自定义)
 *   icon:        string            emoji 图标，如 💖
 *   color:       string            主题色（十六进制），如 #ff6b9d
 *   isYearly:    boolean           是否每年重复（用于倒计时计算）
 *   note:        string            备注
 *   bgImage:     string            自定义主题背景图 URL（为空则使用默认渐变）
 *                                        由 POST /upload 上传至阿里云 OSS 后返回
 *   createdAt:   string            创建时间 ISO 字符串
 *   updatedAt:   string            更新时间 ISO 字符串
 * }
 *
 * 统一响应格式（后端请按此约定返回）：
 *   成功：{ "code": 0, "message": "success", "data": <数据> }
 *   失败：{ "code": <非0数字>, "message": "错误信息" }
 */

/**
 * 获取纪念日列表
 * GET /anniversaries
 * @returns {Promise<Anniversary[]>}
 */
export function getAnniversaryList() {
  return request({
    url: '/anniversaries',
    method: 'get'
  })
}

/**
 * 获取单个纪念日详情
 * GET /anniversaries/:id
 * @param {number|string} id
 * @returns {Promise<Anniversary>}
 */
export function getAnniversaryDetail(id) {
  return request({
    url: `/anniversaries/${id}`,
    method: 'get'
  })
}

/**
 * 新建纪念日
 * POST /anniversaries
 * @param {Omit<Anniversary, 'id' | 'createdAt' | 'updatedAt'>} data
 * @returns {Promise<Anniversary>} 创建后的完整对象（后端生成 id）
 */
export function createAnniversary(data) {
  return request({
    url: '/anniversaries',
    method: 'post',
    data
  })
}

/**
 * 更新纪念日
 * PUT /anniversaries/:id
 * @param {number|string} id
 * @param {Partial<Anniversary>} data
 * @returns {Promise<Anniversary>}
 */
export function updateAnniversary(id, data) {
  return request({
    url: `/anniversaries/${id}`,
    method: 'put',
    data
  })
}

/**
 * 删除纪念日
 * DELETE /anniversaries/:id
 * @param {number|string} id
 * @returns {Promise<null>}
 */
export function deleteAnniversary(id) {
  return request({
    url: `/anniversaries/${id}`,
    method: 'delete'
  })
}
