import { ref } from 'vue'
import axios from 'axios'
import type { Notification, NotificationListResponse } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

const unreadCount = ref(0)
const notifications = ref<Notification[]>([])
const loading = ref(false)
const hasMore = ref(false)
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)

let pollingTimer: number | null = null
const POLLING_INTERVAL = 30000

export function useNotifications() {
  const getAuthHeaders = () => {
    const token = localStorage.getItem('accessToken')
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  const fetchUnreadCount = async (): Promise<number> => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/notifications/unread-count`, {
        headers: getAuthHeaders()
      })
      unreadCount.value = response.data.count
      return response.data.count
    } catch (err) {
      console.error('Fetch unread count error:', err)
      return 0
    }
  }

  const fetchNotifications = async (pageNum: number = 1, reset: boolean = false) => {
    loading.value = true
    try {
      const response = await axios.get<NotificationListResponse>(
        `${API_BASE_URL}/api/notifications`,
        {
          headers: getAuthHeaders(),
          params: {
            page: pageNum,
            pageSize: pageSize.value
          }
        }
      )

      if (reset) {
        notifications.value = response.data.notifications
      } else {
        notifications.value = [...notifications.value, ...response.data.notifications]
      }

      page.value = pageNum
      total.value = response.data.pagination.total
      hasMore.value = pageNum < response.data.pagination.totalPages

      return response.data
    } catch (err) {
      console.error('Fetch notifications error:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  const loadMore = async () => {
    if (loading.value || !hasMore.value) return
    await fetchNotifications(page.value + 1, false)
  }

  const refresh = async () => {
    await Promise.all([
      fetchUnreadCount(),
      fetchNotifications(1, true)
    ])
  }

  const markAsRead = async (notificationId: string) => {
    try {
      await axios.patch(
        `${API_BASE_URL}/api/notifications/${notificationId}/read`,
        {},
        { headers: getAuthHeaders() }
      )

      const notification = notifications.value.find(n => n.id === notificationId)
      if (notification) {
        notification.read = true
        notification.readAt = new Date().toISOString()
      }

      if (unreadCount.value > 0) {
        unreadCount.value--
      }
    } catch (err) {
      console.error('Mark as read error:', err)
      throw err
    }
  }

  const markAllAsRead = async () => {
    try {
      const response = await axios.patch(
        `${API_BASE_URL}/api/notifications/read-all`,
        {},
        { headers: getAuthHeaders() }
      )

      notifications.value.forEach(n => {
        n.read = true
      })

      unreadCount.value = 0

      return response.data.count
    } catch (err) {
      console.error('Mark all as read error:', err)
      throw err
    }
  }

  const deleteNotification = async (notificationId: string) => {
    try {
      await axios.delete(
        `${API_BASE_URL}/api/notifications/${notificationId}`,
        { headers: getAuthHeaders() }
      )

      const index = notifications.value.findIndex(n => n.id === notificationId)
      if (index > -1) {
        const wasUnread = !notifications.value[index].read
        notifications.value.splice(index, 1)
        if (wasUnread && unreadCount.value > 0) {
          unreadCount.value--
        }
        total.value--
      }
    } catch (err) {
      console.error('Delete notification error:', err)
      throw err
    }
  }

  const startPolling = () => {
    if (pollingTimer) return
    pollingTimer = window.setInterval(() => {
      fetchUnreadCount()
    }, POLLING_INTERVAL)
  }

  const stopPolling = () => {
    if (pollingTimer) {
      clearInterval(pollingTimer)
      pollingTimer = null
    }
  }

  return {
    unreadCount,
    notifications,
    loading,
    hasMore,
    page,
    pageSize,
    total,
    fetchUnreadCount,
    fetchNotifications,
    loadMore,
    refresh,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    startPolling,
    stopPolling
  }
}
