import { ref, computed } from 'vue'
import axios from 'axios'
import type { CurrentUser } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

const currentUser = ref<CurrentUser | null>(null)
const userLoading = ref(false)

export function useAuth() {
  const isAdmin = computed(() => currentUser.value?.role === 'admin')
  const isLoggedIn = computed(() => !!currentUser.value)

  const fetchCurrentUser = async () => {
    const token = localStorage.getItem('accessToken')
    if (!token) {
      currentUser.value = null
      return null
    }

    userLoading.value = true
    try {
      const response = await axios.get(`${API_BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      currentUser.value = response.data.user
      return currentUser.value
    } catch (err) {
      localStorage.removeItem('accessToken')
      currentUser.value = null
      return null
    } finally {
      userLoading.value = false
    }
  }

  const setUser = (user: CurrentUser | null) => {
    currentUser.value = user
  }

  const clearUser = () => {
    currentUser.value = null
    localStorage.removeItem('accessToken')
  }

  return {
    currentUser,
    userLoading,
    isAdmin,
    isLoggedIn,
    fetchCurrentUser,
    setUser,
    clearUser
  }
}
