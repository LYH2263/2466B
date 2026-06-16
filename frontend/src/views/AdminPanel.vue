<template>
  <div class="admin-container">
    <header class="admin-header">
      <div class="header-content">
        <div class="logo">
          <Setting style="font-size: 32px; color: #e6a23c;" />
          <div class="title">
            <h1>管理员后台</h1>
            <p>用户管理与审计中心</p>
          </div>
        </div>

        <div class="header-nav">
          <el-button
            type="primary"
            plain
            :icon="WalletFilled"
            @click="goToDashboard"
          >
            返回主页
          </el-button>
          <el-button
            type="primary"
            plain
            :icon="List"
            @click="goToTransactions"
          >
            交易流水
          </el-button>
          <el-button
            type="primary"
            plain
            :icon="Document"
            @click="goToReports"
          >
            资产报告
          </el-button>
        </div>

        <div class="header-actions">
          <div v-if="currentUser" class="user-info">
            <el-tag type="danger" size="small" effect="dark">管理员</el-tag>
            <span>{{ currentUser.email }}</span>
            <el-button
              type="danger"
              size="small"
              :icon="SwitchButton"
              @click="handleLogout"
            >
              退出
            </el-button>
          </div>
        </div>
      </div>
    </header>

    <main class="main-content">
      <el-tabs v-model="activeTab" class="admin-tabs">
        <el-tab-pane label="用户管理" name="users">
          <div class="search-bar">
            <el-input
              v-model="searchKeyword"
              placeholder="按邮箱搜索用户..."
              :prefix-icon="Search"
              clearable
              style="width: 320px"
              @keyup.enter="handleSearch"
              @clear="handleSearch"
            />
            <el-button type="primary" :icon="Search" @click="handleSearch">
              搜索
            </el-button>
            <el-button :icon="Refresh" @click="refreshList">
              刷新
            </el-button>
          </div>

          <el-table
            v-loading="loading"
            :data="users"
            border
            stripe
            style="width: 100%"
          >
            <el-table-column prop="email" label="邮箱" min-width="200" />
            <el-table-column label="角色" width="100">
              <template #default="{ row }">
                <el-tag :type="row.role === 'admin' ? 'danger' : 'info'" size="small">
                  {{ row.role === 'admin' ? '管理员' : '普通用户' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag v-if="!row.enabled" type="danger" size="small">已禁用</el-tag>
                <el-tag v-else-if="row.isLocked" type="warning" size="small">已锁定</el-tag>
                <el-tag v-else type="success" size="small">正常</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="failedLoginCount" label="失败次数" width="90" align="center" />
            <el-table-column label="锁定到期" width="170">
              <template #default="{ row }">
                <span v-if="row.isLocked" style="color: #e6a23c">{{ formatDate(row.lockedUntil) }}</span>
                <span v-else style="color: #909399">-</span>
              </template>
            </el-table-column>
            <el-table-column prop="assetRecordCount" label="资产记录" width="100" align="center" />
            <el-table-column prop="transactionCount" label="交易流水" width="100" align="center" />
            <el-table-column label="注册时间" width="170">
              <template #default="{ row }">
                {{ formatDate(row.createdAt) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="360" fixed="right">
              <template #default="{ row }">
                <div class="action-buttons">
                  <el-button
                    v-if="!row.enabled"
                    type="success"
                    size="small"
                    :icon="CircleCheck"
                    @click="handleEnable(row)"
                  >
                    启用
                  </el-button>
                  <el-button
                    v-else
                    type="warning"
                    size="small"
                    :icon="CircleClose"
                    :disabled="isSelf(row.id)"
                    @click="handleDisable(row)"
                  >
                    禁用
                  </el-button>
                  <el-button
                    type="info"
                    size="small"
                    :icon="Unlock"
                    :disabled="!row.isLocked && row.failedLoginCount === 0"
                    @click="handleUnlock(row)"
                  >
                    解锁
                  </el-button>
                  <el-dropdown
                    trigger="click"
                    @command="(cmd) => handleRoleChange(row, cmd)"
                  >
                    <el-button
                      type="primary"
                      size="small"
                      :icon="UserFilled"
                      :disabled="isSelf(row.id)"
                    >
                      角色<el-icon class="el-icon--right"><ArrowDown /></el-icon>
                    </el-button>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item
                          command="user"
                          :disabled="row.role === 'user'"
                        >
                          普通用户
                        </el-dropdown-item>
                        <el-dropdown-item
                          command="admin"
                          :disabled="row.role === 'admin'"
                        >
                          管理员
                        </el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                  <el-button
                    type="danger"
                    size="small"
                    :icon="SwitchButton"
                    :disabled="isSelf(row.id)"
                    @click="handleForceLogout(row)"
                  >
                    强制下线
                  </el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>

          <div class="pagination-container">
            <el-pagination
              v-model:current-page="pagination.page"
              v-model:page-size="pagination.pageSize"
              :page-sizes="[10, 20, 50, 100]"
              :total="pagination.total"
              layout="total, sizes, prev, pager, next, jumper"
              background
              @size-change="handlePageChange"
              @current-change="handlePageChange"
            />
          </div>
        </el-tab-pane>

        <el-tab-pane label="审计日志" name="audit">
          <div class="search-bar">
            <el-button :icon="Refresh" @click="refreshAuditLogs">
              刷新
            </el-button>
          </div>

          <el-table
            v-loading="loading"
            :data="auditLogs"
            border
            stripe
            style="width: 100%"
          >
            <el-table-column label="时间" width="180">
              <template #default="{ row }">
                {{ formatDate(row.createdAt) }}
              </template>
            </el-table-column>
            <el-table-column prop="adminEmail" label="管理员" min-width="180" />
            <el-table-column label="操作" width="140">
              <template #default="{ row }">
                <el-tag :type="getAuditActionType(row.action)" size="small">
                  {{ getAuditActionLabel(row.action) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="targetUserEmail" label="目标用户" min-width="180" />
            <el-table-column prop="detail" label="详情" min-width="300">
              <template #default="{ row }">
                {{ row.detail || '-' }}
              </template>
            </el-table-column>
          </el-table>

          <div class="pagination-container">
            <el-pagination
              v-model:current-page="auditPagination.page"
              v-model:page-size="auditPagination.pageSize"
              :page-sizes="[20, 50, 100]"
              :total="auditPagination.total"
              layout="total, sizes, prev, pager, next, jumper"
              background
              @size-change="handleAuditPageChange"
              @current-change="handleAuditPageChange"
            />
          </div>
        </el-tab-pane>
      </el-tabs>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Setting,
  WalletFilled,
  List,
  Document,
  SwitchButton,
  Search,
  Refresh,
  CircleCheck,
  CircleClose,
  Unlock,
  UserFilled,
  ArrowDown
} from '@element-plus/icons-vue'
import { useAuth } from '../composables/useAuth'
import { useAdmin } from '../composables/useAdmin'
import type { AdminUser, AuditAction } from '../types'
import axios from 'axios'

const router = useRouter()
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
const { currentUser, fetchCurrentUser, clearUser } = useAuth()
const {
  users,
  pagination,
  auditLogs,
  auditPagination,
  loading,
  fetchUsers,
  enableUser,
  disableUser,
  unlockUser,
  changeUserRole,
  forceLogoutUser,
  fetchAuditLogs
} = useAdmin()

const activeTab = ref('users')
const searchKeyword = ref('')

const isSelf = (userId: string) => currentUser.value?.id === userId

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getAuditActionLabel = (action: AuditAction) => {
  const labels: Record<AuditAction, string> = {
    ENABLE_USER: '启用用户',
    DISABLE_USER: '禁用用户',
    UNLOCK_USER: '解锁用户',
    CHANGE_ROLE: '变更角色',
    FORCE_LOGOUT: '强制下线'
  }
  return labels[action] || action
}

const getAuditActionType = (action: AuditAction) => {
  const types: Record<AuditAction, string> = {
    ENABLE_USER: 'success',
    DISABLE_USER: 'danger',
    UNLOCK_USER: 'info',
    CHANGE_ROLE: 'warning',
    FORCE_LOGOUT: 'danger'
  }
  return types[action] || ''
}

const loadUsers = async () => {
  try {
    await fetchUsers(pagination.value.page, pagination.value.pageSize, searchKeyword.value || undefined)
  } catch (err: any) {
    ElMessage.error(err.message || '加载用户列表失败')
  }
}

const handleSearch = () => {
  pagination.value.page = 1
  loadUsers()
}

const refreshList = () => {
  searchKeyword.value = ''
  pagination.value.page = 1
  loadUsers()
}

const handlePageChange = () => {
  loadUsers()
}

const handleEnable = async (row: AdminUser) => {
  try {
    await ElMessageBox.confirm(
      `确定要启用用户 "${row.email}" 吗？`,
      '确认启用',
      {
        confirmButtonText: '启用',
        cancelButtonText: '取消',
        type: 'success'
      }
    )
    await enableUser(row.id)
    ElMessage.success('用户已启用')
    loadUsers()
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error(err.message || '启用失败')
    }
  }
}

const handleDisable = async (row: AdminUser) => {
  try {
    await ElMessageBox.confirm(
      `确定要禁用用户 "${row.email}" 吗？\n禁用后该用户将无法登录，且所有活跃会话将被吊销。`,
      '确认禁用',
      {
        confirmButtonText: '禁用',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger'
      }
    )
    await disableUser(row.id)
    ElMessage.success('用户已禁用')
    loadUsers()
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error(err.message || '禁用失败')
    }
  }
}

const handleUnlock = async (row: AdminUser) => {
  try {
    await ElMessageBox.confirm(
      `确定要重置用户 "${row.email}" 的登录失败锁定状态吗？`,
      '确认解锁',
      {
        confirmButtonText: '解锁',
        cancelButtonText: '取消',
        type: 'info'
      }
    )
    await unlockUser(row.id)
    ElMessage.success('用户已解锁')
    loadUsers()
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error(err.message || '解锁失败')
    }
  }
}

const handleRoleChange = async (row: AdminUser, newRole: string) => {
  const roleLabel = newRole === 'admin' ? '管理员' : '普通用户'
  try {
    await ElMessageBox.confirm(
      `确定要将用户 "${row.email}" 的角色变更为 "${roleLabel}" 吗？`,
      '确认变更角色',
      {
        confirmButtonText: '确认变更',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    await changeUserRole(row.id, newRole as 'user' | 'admin')
    ElMessage.success('角色已更新')
    loadUsers()
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error(err.message || '变更角色失败')
    }
  }
}

const handleForceLogout = async (row: AdminUser) => {
  try {
    await ElMessageBox.confirm(
      `确定要强制下线用户 "${row.email}" 吗？\n该用户的所有活跃会话将被立即吊销。`,
      '确认强制下线',
      {
        confirmButtonText: '强制下线',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger'
      }
    )
    await forceLogoutUser(row.id)
    ElMessage.success('已强制下线该用户')
    loadUsers()
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error(err.message || '强制下线失败')
    }
  }
}

const refreshAuditLogs = () => {
  auditPagination.value.page = 1
  loadAuditLogs()
}

const handleAuditPageChange = () => {
  loadAuditLogs()
}

const loadAuditLogs = async () => {
  try {
    await fetchAuditLogs(auditPagination.value.page, auditPagination.value.pageSize)
  } catch (err: any) {
    ElMessage.error(err.message || '加载审计日志失败')
  }
}

const goToDashboard = () => {
  router.push('/')
}

const goToTransactions = () => {
  router.push('/transactions')
}

const goToReports = () => {
  router.push('/reports')
}

const handleLogout = async () => {
  try {
    await axios.post(`${API_BASE_URL}/api/auth/logout`, {}, {
      withCredentials: true
    })
    clearUser()
    ElMessage.success('已退出登录')
    router.push('/login')
  } catch (err) {
    clearUser()
    router.push('/login')
  }
}

onMounted(async () => {
  await fetchCurrentUser()
  loadUsers()
  loadAuditLogs()
})
</script>

<style scoped>
.admin-container {
  min-height: 100vh;
}

.admin-header {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
  padding: 20px 0;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.header-content {
  max-width: 1600px;
  margin: 0 auto;
  padding: 0 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo {
  display: flex;
  align-items: center;
  gap: 16px;
}

.title h1 {
  font-size: 24px;
  font-weight: 600;
  margin: 0;
}

.title p {
  font-size: 14px;
  opacity: 0.9;
  margin: 4px 0 0 0;
}

.header-nav {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  color: white;
}

.main-content {
  max-width: 1600px;
  margin: 0 auto;
  padding: 24px 20px;
}

.admin-tabs {
  background: white;
  border-radius: 8px;
  padding: 0 20px 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.search-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.action-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.pagination-container {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}

@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    gap: 16px;
    text-align: center;
  }

  .logo {
    flex-direction: column;
  }

  .header-nav,
  .header-actions {
    flex-direction: column;
    width: 100%;
  }

  .user-info {
    flex-direction: column;
  }

  .main-content {
    padding: 16px 12px;
  }

  .search-bar {
    flex-wrap: wrap;
  }
}
</style>
