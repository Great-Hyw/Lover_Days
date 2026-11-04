import { ref } from 'vue'

/**
 * 「玫瑰帷幕」过渡动画：登录/注册成功 → 首页
 * 时序（共 1.7s）：
 *   140ms    左右两扇玫瑰色帷幕滑入合拢
 *   ~650ms   帷幕合拢到位（中缝亮灯、心形弹出）—— 此时执行路由跳转
 *   880ms    帷幕向外打开，首页浮现
 *   1700ms   动画结束，移除遮罩
 *
 * prefers-reduced-motion 时跳过动画，直接跳转。
 */
export const portalActive = ref(false)

const OPAQUE_AT = 650 // 帷幕完全盖住所需毫秒数
const TOTAL = 1700    // 动画总时长

let opaqueTimer = 0
let endTimer = 0

/**
 * 启动门户过渡动画
 * @param {() => void} onOpaque 帷幕盖住画面时执行（在这里做路由跳转最安全）
 */
export function launchPortal(onOpaque) {
  // 尊重系统「减少动态效果」设置：不播动画，直接跳转
  if (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  ) {
    onOpaque()
    return
  }
  clearTimeout(opaqueTimer)
  clearTimeout(endTimer)
  portalActive.value = true
  opaqueTimer = setTimeout(onOpaque, OPAQUE_AT)
  endTimer = setTimeout(() => {
    portalActive.value = false
  }, TOTAL)
}
