/** 纪念日类型选项 */
export const TYPE_OPTIONS = [
  { value: 'love', label: '相恋日', icon: '💖' },
  { value: 'meet', label: '相识日', icon: '👫' },
  { value: 'proposal', label: '求婚日', icon: '💍' },
  { value: 'birthday', label: '生日', icon: '🎂' },
  { value: 'festival', label: '节日', icon: '🎉' },
  { value: 'travel', label: '旅行', icon: '✈️' },
  { value: 'gift', label: '礼物', icon: '🎁' },
  { value: 'custom', label: '自定义', icon: '⭐' }
]

/** 可选 emoji 图标 */
export const ICON_OPTIONS = [
  '💖', '💕', '💘', '💝', '💍', '💋', '🌹', '👫',
  '🤝', '👀', '🎂', '🎉', '🎁', '✈️', '🏠', '⭐',
  '🌙', '☀️', '🌈', '🍓', '🧸', '📷', '🎵', '📚'
]

/** 可选主题色 */
export const COLOR_OPTIONS = [
  '#ff6b9d', '#ff8fab', '#ffa07a', '#ffc75f',
  '#f98491', '#c084fc', '#7dd3fc', '#6ee7b7',
  '#fca5a5', '#f9a8d4', '#a5b4fc', '#fdba74'
]

export function getTypeMeta(type) {
  return TYPE_OPTIONS.find((t) => t.value === type) || TYPE_OPTIONS[TYPE_OPTIONS.length - 1]
}
