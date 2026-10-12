/**
 * 本地 Mock 适配器
 *
 * 实现 axios adapter 接口：接收请求 config，返回与后端格式一致的响应。
 * 数据持久化在 localStorage 中，刷新不丢失。
 * 后端就绪后整个文件不会被使用（见 src/api/request.js），可保留也可删除。
 */

const STORAGE_KEY = 'anniversary_list'
const PHOTOS_KEY = 'cloud_photo_list'
const USERS_KEY = 'mock_user_list'

// Mock 相册最多保留的图片数量（base64 占空间，做个上限）
const MAX_PHOTOS = 12

// 模拟网络延迟
const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms))

function buildResponse(data, status = 200, config = {}) {
  return {
    data: {
      code: 0,
      message: 'success',
      data
    },
    status,
    statusText: 'OK',
    headers: {},
    config
  }
}

function buildError(message, status = 400, config = {}) {
  const error = new Error(message)
  error.response = {
    data: { code: status, message },
    status,
    config
  }
  return error
}

function readList() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null
  } catch {
    return null
  }
}

function writeList(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

function readPhotos() {
  try {
    const photos = JSON.parse(localStorage.getItem(PHOTOS_KEY)) || []
    // 兼容早期无 id 的存量照片：从最旧（数组末尾）往前补递减 id，
    // 保证「数组顺序 = id 降序」这一分页前提，并回写持久化
    const realIds = photos.filter((p) => p && p.id !== undefined).map((p) => Number(p.id))
    let next = realIds.length ? Math.min(...realIds) - 1 : Date.now()
    let migrated = false
    for (let i = photos.length - 1; i >= 0; i--) {
      const p = photos[i]
      if (p && p.id === undefined) {
        p.id = next--
        migrated = true
      }
    }
    if (migrated) writePhotos(photos)
    return photos
  } catch {
    return []
  }
}

function writePhotos(photos) {
  localStorage.setItem(PHOTOS_KEY, JSON.stringify(photos.slice(0, MAX_PHOTOS)))
}

// —— 认证辅助 ——
function readUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY)) || []
  } catch {
    return []
  }
}

function writeUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

// 返回不包含密码的用户信息
function toSafeUser(user) {
  return {
    id: user.id,
    username: user.username,
    nickname: user.nickname || user.username,
    avatar: user.avatar || ''
  }
}

// 生成一个简单 token（真实环境由后端签发 JWT）
function makeToken(id) {
  return `mock-token.${id}.${Date.now()}`
}

// 从请求头解析 token 并找到用户
function getUserByToken(config) {
  const auth = config.headers?.Authorization || ''
  const match = String(auth).match(/^Bearer mock-token\.(\d+)\./)
  if (!match) return null
  const id = Number(match[1])
  return readUsers().find((u) => u.id === id) || null
}

// 读取本地文件为 base64（模拟上传到 OSS 后返回的可访问 URL）
function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })
}

function formatDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// 首次使用时生成示例数据
function seedData() {
  const now = new Date().toISOString()
  const loveDate = new Date()
  loveDate.setDate(loveDate.getDate() - 520)
  const birthday = new Date()
  birthday.setMonth(birthday.getMonth() + 45 > 11 ? birthday.getMonth() - 8 : birthday.getMonth() + 1)

  const seeds = [
    {
      id: 1,
      title: '我们在一起啦',
      date: formatDate(loveDate),
      type: 'love',
      icon: '💖',
      color: '#ff6b9d',
      isYearly: true,
      note: '从这一天起，我的世界多了一个你。',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 2,
      title: 'TA 的生日',
      date: formatDate(birthday),
      type: 'birthday',
      icon: '🎂',
      color: '#ffa07a',
      isYearly: true,
      note: '记得准备惊喜礼物哦～',
      createdAt: now,
      updatedAt: now
    }
  ]
  writeList(seeds)
  return seeds
}

export async function mockAdapter(config) {
  await delay(200 + Math.random() * 300)

  const method = (config.method || 'get').toLowerCase()
  // adapter 拿到的 url 不包含 baseURL，形如 /anniversaries/123
  const url = config.url || ''

  // —— 认证相关 ——
  if (/^\/auth\/login$/.test(url) && method === 'post') {
    const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data
    const { username, password } = body || {}
    if (!username || !password) throw buildError('请输入用户名和密码', 400, config)

    const users = readUsers()
    const user = users.find((u) => u.username === username)
    if (!user || user.password !== password) {
      throw buildError('用户名或密码错误', 400, config)
    }

    const safeUser = toSafeUser(user)
    const token = makeToken(user.id)
    return buildResponse({ token, user: safeUser }, 200, config)
  }

  if (/^\/auth\/register$/.test(url) && method === 'post') {
    const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data
    const { username, password, nickname } = body || {}
    if (!username || !password) throw buildError('请输入用户名和密码', 400, config)
    if (username.length < 2) throw buildError('用户名至少 2 个字符', 400, config)
    if (password.length < 6) throw buildError('密码至少 6 位', 400, config)

    const users = readUsers()
    if (users.some((u) => u.username === username)) {
      throw buildError('用户名已存在', 400, config)
    }

    const user = {
      id: Date.now(),
      username,
      password,
      nickname: nickname || username,
      avatar: ''
    }
    users.push(user)
    writeUsers(users)

    const token = makeToken(user.id)
    return buildResponse({ token, user: toSafeUser(user) }, 201, config)
  }

  if (/^\/auth\/profile$/.test(url) && method === 'get') {
    const user = getUserByToken(config)
    if (!user) throw buildError('未登录或登录已过期', 401, config)
    return buildResponse(toSafeUser(user), 200, config)
  }

  // POST /upload —— 上传图片（真实环境由后端转存阿里云 OSS）
  if (method === 'post' && /^\/upload(?:\?|$)/.test(url)) {
    const formData = config.data
    const file = formData && typeof formData.get === 'function' ? formData.get('file') : null

    if (!file) throw buildError('缺少上传文件', 400, config)
    if (!file.type.startsWith('image/')) throw buildError('仅支持图片文件', 400, config)
    if (file.size > 8 * 1024 * 1024) throw buildError('图片不能超过 8MB', 400, config)

    const dataUrl = await fileToDataURL(file)
    const photo = {
      id: Date.now(),
      key: `anniversary/mock/${Date.now()}-${file.name}`,
      url: dataUrl,
      name: file.name,
      size: file.size,
      anniversaryId: formData.get('anniversaryId') || null
    }
    const photos = readPhotos()
    photos.unshift(photo)
    writePhotos(photos)

    // 与真实后端一致：上传响应不含 id（id 仅由 GET /photos 列表返回）
    return buildResponse({ url: photo.url, key: photo.key }, 201, config)
  }

  // GET /photos —— 云端相册列表（真实环境列举阿里云 OSS 对象）
  // keyset 分页：?lastId=最后一张图id，每页固定 20 条
  if (method === 'get' && /^\/photos(?:\?|$)/.test(url)) {
    const PAGE_SIZE = 20
    const query = new URLSearchParams(url.split('?')[1] || '')
    const lastId = query.get('lastId')
    let photos = readPhotos()
    if (lastId) {
      photos = photos.filter((p) => Number(p.id) < Number(lastId))
    }
    const page = photos.slice(0, PAGE_SIZE)
    return buildResponse({ list: page, hasMore: photos.length > PAGE_SIZE }, 200, config)
  }

  // DELETE /photos  body: { key } —— 删除云端图片（真实环境调用 OSS deleteObject）
  if (method === 'delete' && /^\/photos(?:\?|$)/.test(url)) {
    const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data
    const key = body?.key
    if (!key) throw buildError('缺少图片 key', 400, config)

    const photos = readPhotos()
    const target = photos.find((p) => p.key === key)
    if (!target) throw buildError('图片不存在', 404, config)

    writePhotos(photos.filter((p) => p.key !== key))

    // 检查是否有纪念日正在引用此图
    const currentList = readList()
    const affectedIds = currentList
      .filter((i) => i.bgImage === target.url)
      .map((i) => i.id)

    return buildResponse({ affectedIds }, 200, config)
  }

  const match = url.match(/^\/anniversaries(?:\/([^/?]+))?/)

  if (!match) {
    throw buildError('接口不存在', 404, config)
  }

  const resourceId = match[1]
  let list = readList()
  if (list === null) {
    list = seedData()
  }

  // GET /anniversaries —— 列表
  if (method === 'get' && !resourceId) {
    // 按日期升序排列
    const sorted = [...list].sort((a, b) => new Date(a.date) - new Date(b.date))
    return buildResponse(sorted, 200, config)
  }

  // GET /anniversaries/:id —— 详情
  if (method === 'get' && resourceId) {
    const item = list.find((i) => String(i.id) === String(resourceId))
    if (!item) throw buildError('纪念日不存在', 404, config)
    return buildResponse(item, 200, config)
  }

  // POST /anniversaries —— 新建
  if (method === 'post') {
    const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data
    const now = new Date().toISOString()
    const item = {
      ...body,
      id: Date.now(),
      createdAt: now,
      updatedAt: now
    }
    list.push(item)
    writeList(list)
    return buildResponse(item, 201, config)
  }

  // PUT /anniversaries/:id —— 更新
  if (method === 'put' && resourceId) {
    const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data
    const index = list.findIndex((i) => String(i.id) === String(resourceId))
    if (index === -1) throw buildError('纪念日不存在', 404, config)
    list[index] = { ...list[index], ...body, updatedAt: new Date().toISOString() }
    writeList(list)
    return buildResponse(list[index], 200, config)
  }

  // DELETE /anniversaries/:id —— 删除
  if (method === 'delete' && resourceId) {
    const next = list.filter((i) => String(i.id) !== String(resourceId))
    if (next.length === list.length) throw buildError('纪念日不存在', 404, config)
    writeList(next)
    return buildResponse(null, 200, config)
  }

  throw buildError('不支持的请求方法', 405, config)
}
