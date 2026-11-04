/**
 * 纪念日农历引用本地存储（与年龄页的 love-days:lunar-birthdays 分开，互不干扰）。
 * 约定：后端接口只存公历 YYYY-MM-DD；某纪念日是否按农历保存、以及其农历年/月/日
 * 记录在这里，形如 { [id]: { y, m, d } }。
 */

const KEY = 'love-days:lunar-anniversaries'

function loadAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}')
  } catch {
    return {}
  }
}

function saveAll(map) {
  localStorage.setItem(KEY, JSON.stringify(map))
}

/** 某纪念日的农历引用，无则返回 null */
export function getLunarRef(id) {
  return loadAll()[String(id)] || null
}

/**
 * 保存某纪念日的农历引用 { y, m, d }；传 null 表示清除（转为阳历保存）。
 * @param {string|number} id 纪念日 id
 * @param {{y:number, m:number, d:number} | null} ref
 */
export function setLunarRef(id, ref) {
  const all = loadAll()
  if (ref && ref.y && ref.m && ref.d) {
    all[String(id)] = { y: Number(ref.y), m: Number(ref.m), d: Number(ref.d) }
  } else {
    delete all[String(id)]
  }
  saveAll(all)
}

/** 清理已不存在纪念日的孤儿农历记录 */
export function pruneLunarRefs(validIds) {
  const all = loadAll()
  const set = new Set(validIds.map((id) => String(id)))
  let changed = false
  for (const k of Object.keys(all)) {
    if (!set.has(k)) {
      delete all[k]
      changed = true
    }
  }
  if (changed) saveAll(all)
}