import request from './request'

/**
 * 生日 / 年龄计算相关接口
 *
 * 数据模型 Birthday：
 * {
 *   id:       number           主键
 *   birthday: string           生日，只含年月日，如 1998-05-20
 *   createdAt: string          创建时间 ISO
 *   updatedAt: string          更新时间 ISO
 * }
 *
 * 年龄计算口径：age = 出生至今的总秒数 / 一年秒数（365.2425 天 = 31556952 秒），
 * 前端只选年月日，时刻统一按当天 00:00:00 计（后端存库时自行补齐时间即可）。
 *
 * 统一响应格式：{ "code": 0, "message": "success", "data": <数据> }
 */

/**
 * 保存生日（id 为空=新增，否则=更新）
 * POST /birthdays
 * @param {object} data { id?, birthday }
 * @returns {Promise<Birthday>}
 */
export function saveBirthday(data) {
  return request({
    url: '/birthdays',
    method: 'post',
    data
  })
}

/**
 * 当前用户的生日列表
 * GET /birthdays
 * @returns {Promise<Birthday[]>}
 */
export function getBirthdayList() {
  return request({
    url: '/birthdays',
    method: 'get'
  })
}

/**
 * 删除生日
 * DELETE /birthdays/:id
 * @param {number|string} id
 */
export function deleteBirthday(id) {
  return request({
    url: `/birthdays/${id}`,
    method: 'delete'
  })
}

/*
 * 年龄计算由前端本地完成（calcAgeLocal：ms / 31556952e3），无需后端接口。
 * 此函数保留仅为兼容历史代码，前端当前未调用。
 */
// GET /birthdays/:id/age
export function getBirthdayAge(id) {
  return request({
    url: `/birthdays/${id}/age`,
    method: 'get'
  })
}

/**
 * 前端本地 age tick（与后端同公式，用于每秒刷新展示）
 * age = (now - birthday) / 31556920 秒 = ... / 31556952
 */
export const SECONDS_PER_YEAR = 365.2425 * 86400

export function calcAgeLocal(birthday) {
  const ms = Date.now() - new Date(birthday).getTime()
  return ms / 1000 / SECONDS_PER_YEAR
}
