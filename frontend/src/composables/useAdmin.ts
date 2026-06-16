import { ref } from 'vue'
import axios from 'axios'
import type { AdminUser, UserListResponse, AuditLog, AuditLogResponse, AdminPagination } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

function getAuthHeader() {
  const token = localStorage.getItem('accessToken')
  return { Authorization: `Bearer ${token}` }
}

export function useAdmin() {
  const users = ref<AdminUser[]>([])
  const pagination = ref<AdminPagination>({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0
  })
  const auditLogs = ref<AuditLog[]>([])
  const auditPagination = ref<AdminPagination>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0
  })
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fetchUsers = async (page = 1, pageSize = 10, search?: string) => {
    loading.value = true
    error.value = null
    try {
      const params: any = { page, pageSize }
      if (search) params.search = search

      const response = await axios.get<UserListResponse>(`${API_BASE_URL}/api/admin/users`, {
        headers: getAuthHeader(),
        params
      })
      users.value = response.data.users
      pagination.value = response.data.pagination
      return response.data
    } catch (err: any) {
      error.value = err.response?.data?.error || '获取用户列表失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  const enableUser = async (userId: string) => {
    try {
      await axios.patch(`${API_BASE_URL}/api/admin/users/${userId}/enable`, {}, {
        headers: getAuthHeader()
      })
    } catch (err: any) {
      error.value = err.response?.data?.error || '启用用户失败'
      throw err
    }
  }

  const disableUser = async (userId: string) => {
    try {
      await axios.patch(`${API_BASE_URL}/api/admin/users/${userId}/disable`, {}, {
        headers: getAuthHeader()
      })
    } catch (err: any) {
      error.value = err.response?.data?.error || '禁用用户失败'
      throw err
    }
  }

  const unlockUser = async (userId: string) => {
    try {
      await axios.patch(`${API_BASE_URL}/api/admin/users/${userId}/unlock`, {}, {
        headers: getAuthHeader()
      })
    } catch (err: any) {
      error.value = err.response?.data?.error || '解锁用户失败'
      throw err
    }
  }

  const changeUserRole = async (userId: string, role: 'user' | 'admin') => {
    try {
      await axios.patch(`${API_BASE_URL}/api/admin/users/${userId}/role`, { role }, {
        headers: getAuthHeader()
      })
    } catch (err: any) {
      error.value = err.response?.data?.error || '修改角色失败'
      throw err
    }
  }

  const forceLogoutUser = async (userId: string) => {
    try {
      await axios.post(`${API_BASE_URL}/api/admin/users/${userId}/force-logout`, {}, {
        headers: getAuthHeader()
      })
    } catch (err: any) {
      error.value = err.response?.data?.error || '强制下线失败'
      throw err
    }
  }

  const fetchAuditLogs = async (page = 1, pageSize = 20) => {
    loading.value = true
    error.value = null
    try {
      const response = await axios.get<AuditLogResponse>(`${API_BASE_URL}/api/admin/audit-logs`, {
        headers: getAuthHeader(),
        params: { page, pageSize }
      })
      auditLogs.value = response.data.logs
      auditPagination.value = response.data.pagination
      return response.data
    } catch (err: any) {
      error.value = err.response?.data?.error || '获取审计日志失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  return {
    users,
    pagination,
    auditLogs,
    auditPagination,
    loading,
    error,
    fetchUsers,
    enableUser,
    disableUser,
    unlockUser,
    changeUserRole,
    forceLogoutUser,
    fetchAuditLogs
  }
}
