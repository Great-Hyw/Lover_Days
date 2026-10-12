import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth'
import './styles/main.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// 路由就绪前用本地 token 恢复登录状态（失败会自动清除）
useAuthStore(pinia).restore()

app.mount('#app')
