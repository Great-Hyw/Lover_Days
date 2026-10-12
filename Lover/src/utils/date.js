/**
 * 日期计算工具
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000

function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/** 两个日期相差的整天数（end - start），忽略时分秒 */
export function daysBetween(start, end) {
  return Math.round((startOfDay(end) - startOfDay(start)) / MS_PER_DAY)
}

/** 从某个日期到今天已经过去多少天（今天为 0） */
export function daysPassed(dateStr) {
  return daysBetween(dateStr, new Date())
}

/**
 * 距离下一次纪念日还有多少天。
 * - 非年度重复：日期在未来则倒计时，已过则返回 null
 * - 年度重复：取今年或明年的同月同日（2月29日闰年特殊处理为2月28日）
 *   若今年的日期就是今天，返回 0；已过则顺延到明年
 */
export function daysUntil(dateStr, isYearly = false) {
  const target = startOfDay(dateStr)
  const today = startOfDay(new Date())

  if (!isYearly) {
    const diff = daysBetween(today, target)
    return diff >= 0 ? diff : null
  }

  const thisYear = today.getFullYear()
  const next = safeDate(thisYear, target.getMonth(), target.getDate())

  if (next >= today) {
    return daysBetween(today, next)
  }
  const nextYearDate = safeDate(thisYear + 1, target.getMonth(), target.getDate())
  return daysBetween(today, nextYearDate)
}

function safeDate(year, month, day) {
  // 处理 2 月 29 日在平年的情况
  const lastDay = new Date(year, month + 1, 0).getDate()
  return startOfDay(new Date(year, month, Math.min(day, lastDay)))
}

/** 格式化为中文日期：2024年5月20日 */
export function formatDateCN(dateStr) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

const WEEK = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

/** 获取星期几 */
export function weekdayCN(dateStr) {
  return WEEK[new Date(dateStr).getDay()]
}

/** 今天的日期字符串 YYYY-MM-DD，用于日期选择框最大值等 */
export function todayStr() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 在一起的第 N 年（按整年计算，不满一年为 0） */
export function fullYearsPassed(dateStr) {
  const start = startOfDay(dateStr)
  const today = startOfDay(new Date())
  let years = today.getFullYear() - start.getFullYear()
  const anniversaryThisYear = safeDate(today.getFullYear(), start.getMonth(), start.getDate())
  if (anniversaryThisYear > today) years -= 1
  return Math.max(years, 0)
}

/** 某年某月（month 为 0-11）的天数 */
function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

/** 给日期加上指定月数，日号超出目标月天数时夹紧到月末（与 Java Period 规则一致） */
function addMonthsClamped(date, months) {
  const y = date.getFullYear()
  const m = date.getMonth()
  const d = date.getDate()
  const total = y * 12 + m + months
  const ny = Math.floor(total / 12)
  const nm = ((total % 12) + 12) % 12
  const nd = Math.min(d, daysInMonth(ny, nm))
  return startOfDay(new Date(ny, nm, nd))
}

/**
 * 精确计算从 dateStr 到 now 已经过的年、月、日。
 * - 先取整年，再取整月，最后取剩余天数；
 * - 2月29日、月末等边界通过“夹紧”处理；
 * - 输入非法或日期在未来时返回 null。
 */
export function calculateAgeDetail(dateStr, nowInput = new Date()) {
  if (!dateStr) return null
  const start = startOfDay(dateStr)
  if (Number.isNaN(start.getTime())) return null
  const now = startOfDay(nowInput)
  if (start.getTime() > now.getTime()) return null

  let years = now.getFullYear() - start.getFullYear()
  let cursor = addMonthsClamped(start, years * 12)
  if (cursor.getTime() > now.getTime()) {
    years -= 1
    cursor = addMonthsClamped(start, years * 12)
  }

  let months = 0
  while (months < 11) {
    const next = addMonthsClamped(start, years * 12 + months + 1)
    if (next.getTime() > now.getTime()) break
    months += 1
  }

  const days = daysBetween(addMonthsClamped(start, years * 12 + months), now)
  const totalDays = daysBetween(start, now)
  return { years, months, days, totalDays }
}
