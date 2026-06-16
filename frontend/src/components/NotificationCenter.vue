<template>
  <div class="notification-center">
    <el-badge :value="unreadCount" :hidden="unreadCount === 0" class="notification-badge" :max="99">
      <el-button
        type="primary"
        :icon="Bell"
        circle
        plain
        class="notification-btn"
        @click="toggleDropdown"
      />
    </el-badge>

    <teleport to="body">
      <div
        v-if="dropdownVisible"
        class="notification-dropdown"
        :style="dropdownStyle"
        @click.stop
      >
        <div class="notification-header">
          <span class="notification-title">通知中心</span>
          <div class="header-actions">
            <el-button
              v-if="unreadCount > 0"
              type="primary"
              link
              size="small"
              @click="handleMarkAllRead"
            >
              全部已读
            </el-button>
          </div>
        </div>

        <div class="notification-list" ref="listRef" @scroll="handleScroll">
          <div v-if="loading && notifications.length === 0" class="loading-state">
            <el-icon class="is-loading"><Loading /></el-icon>
            <span>加载中...</span>
          </div>

          <div v-else-if="notifications.length === 0" class="empty-state">
            <el-empty description="暂无通知" :image-size="60" />
          </div>

          <template v-else>
            <div
              v-for="notification in notifications"
              :key="notification.id"
              class="notification-item"
              :class="{ 'is-read': notification.read }"
              @click="handleItemClick(notification)"
            >
              <div class="notification-icon">
                <component :is="getNotificationIcon(notification.type)" />
              </div>
              <div class="notification-content">
                <div class="notification-item-header">
                  <span class="notification-item-title">{{ notification.title }}</span>
                  <span class="notification-time">{{ formatTime(notification.createdAt) }}</span>
                </div>
                <p class="notification-item-text">{{ notification.content }}</p>
              </div>
              <div class="notification-actions">
                <el-button
                  v-if="!notification.read"
                  type="primary"
                  link
                  size="small"
                  @click.stop="handleMarkRead(notification.id)"
                >
                  标为已读
                </el-button>
                <el-button
                  type="danger"
                  link
                  size="small"
                  @click.stop="handleDelete(notification.id)"
                >
                  删除
                </el-button>
              </div>
            </div>

            <div v-if="loading" class="loading-more">
              <el-icon class="is-loading"><Loading /></el-icon>
              <span>加载更多...</span>
            </div>

            <div v-if="!hasMore && notifications.length > 0" class="no-more">
              没有更多了
            </div>
          </template>
        </div>
      </div>
    </teleport>

    <div
      v-if="dropdownVisible"
      class="notification-overlay"
      @click="closeDropdown"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import {
  Bell,
  Lock,
  Warning,
  Trophy,
  Clock,
  Message,
  Setting,
  Loading
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useNotifications } from '../composables/useNotifications'
import type { Notification, NotificationType } from '../types'

const {
  unreadCount,
  notifications,
  loading,
  hasMore,
  fetchUnreadCount,
  fetchNotifications,
  loadMore,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  startPolling,
  stopPolling
} = useNotifications()

const dropdownVisible = ref(false)
const dropdownStyle = ref({ top: '0px', left: '0px' })
const btnRef = ref<HTMLElement | null>(null)
const listRef = ref<HTMLElement | null>(null)

const getNotificationIcon = (type: NotificationType) => {
  const iconMap: Record<NotificationType, any> = {
    ACCOUNT_LOCKED: Lock,
    NEW_DEVICE_LOGIN: Warning,
    ASSET_TARGET_REACHED: Trophy,
    INVENTORY_REMINDER: Clock,
    SYSTEM_NOTICE: Message,
    ADMIN_ACTION: Setting
  }
  return iconMap[type] || Message
}

const formatTime = (dateStr: string): string => {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 7) return `${days}天前`

  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

const updateDropdownPosition = () => {
  if (!btnRef.value) return

  const btn = document.querySelector('.notification-btn')
  if (!btn) return

  const rect = btn.getBoundingClientRect()
  const dropdownWidth = 380

  dropdownStyle.value = {
    top: `${rect.bottom + 8}px`,
    left: `${rect.left + rect.width / 2 - dropdownWidth / 2}px`
  }
}

const toggleDropdown = async () => {
  dropdownVisible.value = !dropdownVisible.value

  if (dropdownVisible.value) {
    await nextTick()
    updateDropdownPosition()
    if (notifications.value.length === 0) {
      fetchNotifications(1, true)
    }
  }
}

const closeDropdown = () => {
  dropdownVisible.value = false
}

const handleItemClick = async (notification: Notification) => {
  if (!notification.read) {
    try {
      await markAsRead(notification.id)
    } catch (err) {
      console.error('Mark as read error:', err)
    }
  }
}

const handleMarkRead = async (id: string) => {
  try {
    await markAsRead(id)
    ElMessage.success('已标记为已读')
  } catch (err) {
    ElMessage.error('标记失败')
  }
}

const handleMarkAllRead = async () => {
  try {
    const count = await markAllAsRead()
    ElMessage.success(`已将 ${count} 条通知标记为已读`)
  } catch (err) {
    ElMessage.error('操作失败')
  }
}

const handleDelete = async (id: string) => {
  try {
    await ElMessageBox.confirm(
      '确定要删除这条通知吗？',
      '确认删除',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    await deleteNotification(id)
    ElMessage.success('删除成功')
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

const handleScroll = (e: Event) => {
  const target = e.target as HTMLElement
  const { scrollTop, scrollHeight, clientHeight } = target

  if (scrollHeight - scrollTop - clientHeight < 100) {
    if (hasMore.value && !loading.value) {
      loadMore()
    }
  }
}

const handleClickOutside = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (
    !target.closest('.notification-center') &&
    !target.closest('.notification-dropdown')
  ) {
    closeDropdown()
  }
}

onMounted(() => {
  fetchUnreadCount()
  startPolling()
  document.addEventListener('click', handleClickOutside)
  window.addEventListener('resize', updateDropdownPosition)
})

onUnmounted(() => {
  stopPolling()
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('resize', updateDropdownPosition)
})
</script>

<style scoped>
.notification-center {
  position: relative;
  display: inline-block;
}

.notification-badge {
  display: inline-block;
}

.notification-btn {
  background: rgba(255, 255, 255, 0.2) !important;
  border: none !important;
  color: white !important;
}

.notification-btn:hover {
  background: rgba(255, 255, 255, 0.3) !important;
}

.notification-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 999;
}

.notification-dropdown {
  position: fixed;
  z-index: 1000;
  width: 380px;
  max-height: 500px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.notification-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #eee;
  background: #fafafa;
}

.notification-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.notification-list {
  flex: 1;
  overflow-y: auto;
  max-height: 420px;
}

.notification-item {
  display: flex;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  transition: background-color 0.2s;
}

.notification-item:hover {
  background: #f5f7fa;
}

.notification-item.is-read {
  opacity: 0.7;
}

.notification-icon {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ecf5ff;
  color: #409eff;
  font-size: 18px;
}

.notification-content {
  flex: 1;
  min-width: 0;
}

.notification-item-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 4px;
}

.notification-item-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  line-height: 1.4;
}

.notification-time {
  flex-shrink: 0;
  font-size: 12px;
  color: #909399;
  white-space: nowrap;
}

.notification-item-text {
  font-size: 13px;
  color: #606266;
  line-height: 1.5;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.notification-actions {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.notification-item:hover .notification-actions {
  opacity: 1;
}

.loading-state,
.loading-more,
.no-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px;
  color: #909399;
  font-size: 13px;
}

.empty-state {
  padding: 40px 20px;
  text-align: center;
}

@media (max-width: 768px) {
  .notification-dropdown {
    width: calc(100vw - 20px);
    max-width: 380px;
  }
}
</style>
