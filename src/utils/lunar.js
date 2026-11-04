/**
 * 农历工具：仅实现生日所需的「农历 → 公历」转换。
 * 数据表为经典 lunarInfo（1900-2100），无第三方依赖。
 */

// 农历数据表：bit 结构参考通行 lunar 算法
//  0x0 0000 0000 0000 0000 0000
//  低 4 位：闰月月份（0 = 无闰月）
//  第 16 位（0x10000）：闰月是否 30 天
//  第 17~4 位高段：正月~腊月大小（1 = 30 天，0 = 29 天）
const lunarInfo = [
  0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2,
  0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977,
  0x04970,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970,
  0x06566,0x0d4a0,0x0ea50,0x06e95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x0c950,
  0x0d4a0,0x1d8a6,0x0b550,0x056a0,0x1a5b4,0x025d0,0x092d0,0x0d2b2,0x0a950,0x0b557,
  0x06ca0,0x0b550,0x15355,0x04da0,0x0a5b0,0x14573,0x052b0,0x0a9a8,0x0e950,0x06aa0,
  0x0aea6,0x0ab50,0x04b60,0x0aae4,0x0a570,0x05260,0x0f263,0x0d950,0x05b57,0x056a0,
  0x096d0,0x04dd5,0x04ad0,0x0a4d0,0x0d4d4,0x0d250,0x0d558,0x0b540,0x0b5a0,0x195a6,
  0x095b0,0x049b0,0x0a974,0x0a4b0,0x0b27a,0x06a50,0x06d40,0x0af46,0x0ab60,0x09570,
  0x04af5,0x04970,0x064b0,0x074a3,0x0ea50,0x06b58,0x055c0,0x0ab60,0x096d5,0x092e0,
  0x0c960,0x0d954,0x0d4a0,0x0da50,0x07552,0x056a0,0x0abb7,0x025d0,0x092d0,0x0cab5,
  0x0a950,0x0b4a0,0x0baa4,0x0ad50,0x055d9,0x04ba0,0x0a5b0,0x15176,0x052b0,0x0a930,
  0x07954,0x06aa0,0x0ad50,0x05b52,0x04b60,0x0a6e6,0x0a4e0,0x0d260,0x0ea65,0x0d530,
  0x05aa0,0x076a3,0x096d0,0x04afb,0x04ad0,0x0a4d0,0x1d0b6,0x0d250,0x0d520,0x0dd45,
  0x0b5a0,0x056d0,0x055b2,0x049b0,0x0a577,0x0a4b0,0x0aa50,0x1b255,0x06d20,0x0ada0,
  0x14b63,0x09370,0x049f8,0x04970,0x064b0,0x168a6,0x0ea50,0x06b20,0x1a6c4,0x0aae0,
  0x092e0,0x0d2e3,0x0c960,0x0d557,0x0d4a0,0x0da50,0x05d55,0x056a0,0x0a6d0,0x055d4,
  0x052d0,0x0a9b8,0x0a950,0x0b4a0,0x0b6a6,0x0ad50,0x055a0,0x0aba4,0x0a5b0,0x052b0,
  0x0b273,0x06930,0x07337,0x06aa0,0x0ad50,0x14b55,0x04b60,0x0a570,0x054e4,0x0d160,
  0x0e968,0x0d520,0x0daa0,0x16aa6,0x056d0,0x04ae0,0x0a9d4,0x0a2d0,0x0d150,0x0f252,
  0x0d520
]

function leapMonth(y) { return lunarInfo[y - 1900] & 0xf }

function leapDays(y) {
  if (!leapMonth(y)) return 0
  return lunarInfo[y - 1900] & 0x10000 ? 30 : 29
}

function monthDays(y, m) {
  return lunarInfo[y - 1900] & (0x10000 >> m) ? 30 : 29
}

function lYearDays(y) {
  let sum = 348
  for (let i = 0x8000; i > 0x8; i >>= 1) sum += lunarInfo[y - 1900] & i ? 1 : 0
  return sum + leapDays(y)
}

/** 农历某年某月（不含闰月）的天数，用于日下拉 */
export function lunarMonthDayCount(y, m) {
  return monthDays(y, m)
}

/** 农历某年的闰月月份（0 = 无闰月）；闰月生日滚动时，目标年无该闰月则按普通月处理 */
export function lunarLeapMonth(y) {
  return leapMonth(y)
}

/**
 * 农历 → 公历
 * @param {number} y 农历年（1900-2100）
 * @param {number} m 农历月（1-12，不含闰月）
 * @param {number} d 农历日（1-30）
 * @returns {{year:number, month:number, day:number}} 公历
 */
/**
 * 农历 → 公历。语义：m 为真实月号（1-12），闰月用 isLeap 标记（如 闰四月=4+isLeap）。
 * @param {number} y 农历年（1900-2100）
 * @param {number} m 农历月（1-12）
 * @param {number} d 农历日（1-30）
 * @param {boolean} isLeap 是否为闰月
 * @returns {{year:number, month:number, day:number} | null} 公历
 */
export function lunarToSolar(y, m, d, isLeap) {
  if (y < 1900 || y > 2100 || m < 1 || m > 12) return null
  // 以 UTC 基准做整数天偏移，避免历史时区（LMT）在本地 Date 上跨日期
  let offset = 0
  for (let i = 1900; i < y; i++) offset += lYearDays(i)
  const leap = leapMonth(y)
  if (isLeap) {
    // 闰月插在真实第 m 月之后：起点 = 1..m 月天数和
    for (let i = 1; i <= m; i++) offset += monthDays(y, i)
  } else {
    for (let i = 1; i < m; i++) offset += monthDays(y, i)
    // 闰月在第 leap 月与第 leap+1 月之间，m 在其后则补闰月天数
    if (leap > 0 && leap < m) offset += leapDays(y)
  }
  offset += d - 1
  const t = new Date(Date.UTC(1900, 0, 31) + offset * 86400000)
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() }
}

/** 农历 → 公历 YYYY-MM-DD（保存/接口统一用公历字符串；闰月传 isLeap） */
export function lunarToSolarISO(y, m, d, isLeap) {
  const r = lunarToSolar(y, m, d, isLeap)
  if (!r) return ''
  return r.year + '-' + String(r.month).padStart(2, '0') + '-' + String(r.day).padStart(2, '0')
}

const LUNAR_MONTH_CN = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月']
const LUNAR_DAY_CN = [
  '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'
]

/** 农历中文月名（1-12 → 正月…腊月） */
export function lunarMonthCN(m) {
  return LUNAR_MONTH_CN[m - 1] || m + '月'
}

/** 农历中文日名（1-30 → 初一…三十） */
export function lunarDayCN(d) {
  return LUNAR_DAY_CN[d - 1] || d + '日'
}

/** 农历日期中文，如「二〇〇七年 正月初一」；闰月加「闰」前缀（year 为 0/空可省略年份） */
export function lunarDateCN(y, m, d, isLeap) {
  const yStr = y ? y + '年 ' : ''
  return yStr + (isLeap ? '闰' : '') + lunarMonthCN(m) + lunarDayCN(d)
}

/**
 * 公历 → 农历（槽位月序算法，与 lunarToSolar 互逆）
 * @param {number} year 公历年
 * @param {number} month 公历月（1-12）
 * @param {number} day 公历日
 * @returns {{year:number, month:number, day:number, isLeap:boolean} | null}
 */
export function solarToLunar(year, month, day) {
  const base = Date.UTC(1900, 0, 31) // 农历1900年正月初一
  const target = Date.UTC(year, month - 1, day)
  let offset = Math.floor((target - base) / 86400000)
  // 定位农历年
  let i = 1900
  while (i < 2101 && offset >= lYearDays(i)) {
    offset -= lYearDays(i)
    i++
  }
  if (i > 2100) return null
  const y = i
  const leap = leapMonth(y)
  // 槽位月序：无闰年 12 槽；闰月在 leap 月后插入闰月槽（共 13 槽）
  const slotCount = leap > 0 ? 13 : 12
  for (let pos = 1; pos <= slotCount; pos++) {
    const isLeapSlot = leap > 0 && pos === leap + 1
    const realM = isLeapSlot ? leap : pos - (leap > 0 && pos > leap + 1 ? 1 : 0)
    const slotDays = isLeapSlot ? leapDays(y) : monthDays(y, realM)
    if (offset < slotDays) {
      return { year: y, month: realM, day: offset + 1, isLeap: isLeapSlot }
    }
    offset -= slotDays
  }
  return null
}

/**
 * 距下一次（今年或明年）农历同日的天数（年度滚动语义）：
 * 今年未过取今年，已过取明年；目标年无该闰月则按普通月处理。
 * 非年度（isYearly=false）或无有效转换时返回 null。
 */
export function lunarDaysUntil(lr, isYearly = true) {
  if (!lr || !lr.m || !lr.d || !isYearly) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const y0 = today.getFullYear()
  for (let y = y0; y <= y0 + 1; y++) {
    const useLeap = lunarLeapMonth(y) === lr.m
    const iso = lunarToSolarISO(y, lr.m, lr.d, useLeap)
    if (!iso) continue
    const dt = new Date(iso)
    dt.setHours(0, 0, 0, 0)
    if (dt >= today) return Math.round((dt - today) / 86400000)
  }
  return null
}