import { createRouter, createWebHashHistory } from 'vue-router'
import { getCookie } from '@/utils/cookie'

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { title: '登录', public: true }
  },
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomeView.vue'),
    meta: { title: '我们的纪念日' }
  },
  {
    path: '/add',
    name: 'add',
    component: () => import('@/views/AnniversaryEditView.vue'),
    meta: { title: '添加纪念日' }
  },
  {
    path: '/edit/:id',
    name: 'edit',
    component: () => import('@/views/AnniversaryEditView.vue'),
    meta: { title: '编辑纪念日' }
  },
  {
    path: '/detail/:id',
    name: 'detail',
    component: () => import('@/views/AnniversaryDetailView.vue'),
    meta: { title: '纪念日详情' }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  }
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · Love Days` : 'Love Days'
})

// —— 全局登录守卫（白名单策略）——
// 除显式标记 meta.public 的路由（目前仅登录页）外，
// 所有路由均为受保护路由：
//   1. 未登录访问任意受保护路由（含根路径 /）-> 重定向到登录页，
//      并通过 redirect 记录原目标地址，登录成功后自动跳回；
//   2. 已登录用户访问登录页 -> 直接进入首页。
router.beforeEach((to) => {
  const token = getCookie('token')

  if (!to.meta.public && !token) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.name === 'login' && token) {
    return { path: '/' }
  }
  return true
})

export default router
