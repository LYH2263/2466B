import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import App from './App.vue'
import Login from './views/Login.vue'
import Dashboard from './views/Dashboard.vue'
import Transactions from './views/Transactions.vue'
import Report from './views/Report.vue'
import AdminPanel from './views/AdminPanel.vue'
import { useAuth } from './composables/useAuth'

const requireAuth = async (_to: any, _from: any, next: any) => {
  const token = localStorage.getItem('accessToken')
  if (!token) {
    return next('/login')
  }
  const { fetchCurrentUser, isLoggedIn } = useAuth()
  if (!isLoggedIn.value) {
    await fetchCurrentUser()
  }
  if (!isLoggedIn.value) {
    return next('/login')
  }
  next()
}

const requireGuest = (_to: any, _from: any, next: any) => {
  const token = localStorage.getItem('accessToken')
  if (token) {
    next('/')
  } else {
    next()
  }
}

const requireAdmin = async (_to: any, _from: any, next: any) => {
  const token = localStorage.getItem('accessToken')
  if (!token) {
    return next('/login')
  }
  const { fetchCurrentUser, isAdmin, isLoggedIn } = useAuth()
  if (!isLoggedIn.value) {
    await fetchCurrentUser()
  }
  if (!isLoggedIn.value) {
    return next('/login')
  }
  if (!isAdmin.value) {
    return next('/')
  }
  next()
}

const routes = [
  {
    path: '/login',
    component: Login,
    beforeEnter: requireGuest
  },
  {
    path: '/',
    component: Dashboard,
    beforeEnter: requireAuth
  },
  {
    path: '/transactions',
    component: Transactions,
    beforeEnter: requireAuth
  },
  {
    path: '/reports',
    component: Report,
    beforeEnter: requireAuth
  },
  {
    path: '/admin',
    component: AdminPanel,
    beforeEnter: requireAdmin
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

const app = createApp(App)

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(ElementPlus)
app.use(router)
app.mount('#app')
