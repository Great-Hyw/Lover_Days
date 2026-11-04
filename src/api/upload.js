import request from './request'

/**
 * 图片上传 / 云端相册接口
 *
 * 这一层是预留给后端接入【阿里云 OSS / 阿里云相册】的接口。
 * 后端实现建议：
 *   1. 接收前端 multipart/form-data 文件流，做格式与大小校验；
 *   2. 使用阿里云 OSS SDK（ali-oss / @alicloud/pop）上传到指定 Bucket，
 *      建议 key 规则：anniversary/{userId}/{时间戳}-{uuid}.{ext}；
 *   3. 返回可公开（或带签名）访问的 URL；
 *   4. GET /photos 可通过 OSS listObjectsV2 列举相册文件（支持游标分页）。
 *
 * Mock 模式下（VITE_USE_MOCK=true）请求被本地适配器接管：
 * 文件会转成 base64 保存在浏览器中，接口签名与真实接口完全一致，
 * 后端就绪后切换开关即可，页面代码无需改动。
 */

/** 允许上传的图片类型 */
export const ACCEPT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

/** 大小限制：8MB */
export const MAX_IMAGE_SIZE = 8 * 1024 * 1024

/**
 * 归一化后端返回的图片记录（Photo 实体整行）。
 *
 * 后端 JSON 为 camelCase（见接口规范 3.9.4）：
 *   { id, key, userId, url, name, size, createdAt }
 * 兜底兼容 snake_case（_key/user_id/created_at），统一输出：
 *   { id, key, url, name, size, userId, createdAt }
 */
function normalizePhoto(raw) {
  if (!raw || typeof raw !== 'object') return raw
  return {
    id: raw.id,
    key: raw.key ?? raw._key,
    url: raw.url,
    name: raw.name,
    size: raw.size,
    userId: raw.userId ?? raw.user_id,
    createdAt: raw.createdAt ?? raw.created_at
  }
}

/**
 * 上传图片到云端（后端转存阿里云 OSS）
 *
 * POST /upload
 * Content-Type: multipart/form-data
 * Body: file=<二进制文件>&anniversaryId=<所属纪念日id>
 *
 * anniversaryId 仅用于后端记录图片来源（如按纪念日聚合/清理），
 * 不会自动绑定纪念日背景；设置背景仍需前端再调 PUT /anniversaries/:id。
 *
 * @param {File} file 本地选择的图片文件
 * @param {{ anniversaryId?: number|string, onProgress?: (e:{loaded:number,total:number,progress:number}) => void }} [options]
 *        anniversaryId：图片所属纪念日 id；onProgress：上传进度回调（真实网络下可用）
 * @returns {Promise<{ key: string, url: string, name: string, size: number, userId: number|string, createdAt: string }>}
 *   后端上传响应不含 id（图片 id 仅由 GET /photos 列表返回，分页游标只依赖列表接口）。
 *   key：OSS 对象 key，删除用；url：存入纪念日 bgImage；其余为文件元信息
 */
export function uploadImage(file, { anniversaryId, onProgress } = {}) {
  const formData = new FormData()
  formData.append('file', file)
  if (anniversaryId !== undefined && anniversaryId !== null) {
    formData.append('anniversaryId', anniversaryId)
  }

  return request({
    url: '/upload',
    method: 'post',
    data: formData,
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (!onProgress) return
      onProgress({
        loaded: e.loaded,
        total: e.total || file.size,
        progress: e.total ? Math.round((e.loaded / e.total) * 100) : 0
      })
    }
  }).then(normalizePhoto)
}

/**
 * 获取云端相册图片列表（对接阿里云相册 / OSS 文件列表）
 *
 * GET /photos?lastId=<最后一张图片的id>
 *
 * keyset 分页：不传 lastId 取第一页（最新一页）；
 * 续拉时传当前列表最后一张图片的 id，后端返回 id 更小的下一页。
 * 每页条数由后端固定（20 条），前端不传 limit。
 *
 * @param {{ lastId?: number|string|null }} [params]
 * @returns {Promise<{ list: CloudPhoto[], hasMore: boolean }>}
 *
 * CloudPhoto（后端 Photo 实体整行，camelCase）:
 * {
 *   id:        number|string  图片记录 id（分页游标用）
 *   key:       string         OSS 对象 key
 *   url:       string         可访问地址
 *   name:      string         文件名
 *   size:      number         字节数
 *   userId:    number|string  所属用户
 *   createdAt: string         上传日期 YYYY-MM-DD
 * }
 */
export function getCloudPhotos(params = {}) {
  return request({
    url: '/photos',
    method: 'get',
    params: {
      lastId: params.lastId ?? undefined
    }
  }).then((res) => {
    // 边界校验：后端响应结构偏离接口规范 3.10.3 时给出明确告警，便于及早发现契约偏差
    if (typeof res === 'string') {
      console.warn('[photos] 后端 data 为字符串（期望对象 {list, hasMore}）:', res)
      return { list: [], hasMore: false }
    }
    if (res && typeof res === 'object') {
      if (res.hashMore !== undefined) {
        console.warn('[photos] 后端字段名是 hashMore（拼写错误），规范字段为 hasMore，已按缺失处理')
      }
      if (!Array.isArray(res.list)) {
        console.warn('[photos] 后端 data.list 缺失或不是数组:', res.list)
      }
    }
    return {
      list: (Array.isArray(res?.list) ? res.list : []).map(normalizePhoto),
      hasMore: !!res?.hasMore
    }
  })
}

/**
 * 删除云端相册中的图片（后端删除阿里云 OSS 对象）
 *
 * DELETE /photos
 * Body: { key }
 *
 * key 通过请求体传递（不拼进 URL 路径），避免 key 含 '/' 时路由解析问题。
 * 后端实现：调用 OSS deleteObject(key)；
 * 若该图片正被某个纪念日引用（bgImage 对应的 url），后端可一并返回
 * affectedIds（受影响的纪念日 id 列表），前端据此提示用户。
 *
 * @param {string} key OSS 对象 key
 * @returns {Promise<{ affectedIds: Array<number|string> }>}
 */
export function deleteCloudPhoto(key) {
  return request({
    url: '/photos',
    method: 'delete',
    data: { key }
  })
}
