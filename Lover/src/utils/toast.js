import { reactive } from 'vue'

export const toastState = reactive({
  visible: false,
  message: '',
  timer: null
})

export function showToast(message, duration = 2000) {
  toastState.message = message
  toastState.visible = true
  clearTimeout(toastState.timer)
  toastState.timer = setTimeout(() => {
    toastState.visible = false
  }, duration)
}
