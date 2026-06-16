import { ref, computed } from 'vue'
import axios from 'axios'
import type {
  InventoryPlan,
  InventoryStatus,
  InventoryPlanWithStatus,
  InventoryPlanCreateForm,
  InventoryPlanUpdateForm,
  InventoryCycleType,
} from '../types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

function getAuthHeaders() {
  const token = localStorage.getItem('accessToken')
  return {
    Authorization: token ? `Bearer ${token}` : '',
  }
}

export function useInventoryPlans() {
  const plan = ref<InventoryPlan | null>(null)
  const status = ref<InventoryStatus | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const hasPlan = computed(() => !!plan.value)
  const isOverdue = computed(() => status.value?.isOverdue ?? false)
  const daysUntilNext = computed(() => status.value?.daysUntilNext)
  const cycleDescription = computed(() => status.value?.cycleDescription)

  async function fetchPlan(options: { orCreate?: boolean } = {}): Promise<InventoryPlanWithStatus | null> {
    loading.value = true
    error.value = null
    try {
      const url = options.orCreate
        ? `${API_BASE_URL}/api/inventory-plans/or-create`
        : `${API_BASE_URL}/api/inventory-plans`
      const response = await axios.get(url, { headers: getAuthHeaders() })
      plan.value = response.data.plan
      status.value = response.data.status
      return response.data
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || '获取盘点计划失败'
      error.value = msg
      throw err
    } finally {
      loading.value = false
    }
  }

  async function fetchStatus(): Promise<InventoryStatus | null> {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/inventory-plans/status`, {
        headers: getAuthHeaders(),
      })
      status.value = response.data
      return response.data
    } catch (err) {
      throw err
    }
  }

  async function createPlan(form: InventoryPlanCreateForm): Promise<InventoryPlanWithStatus> {
    loading.value = true
    error.value = null
    try {
      const response = await axios.post(`${API_BASE_URL}/api/inventory-plans`, form, {
        headers: getAuthHeaders(),
      })
      plan.value = response.data.plan
      status.value = response.data.status
      return response.data
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || '创建盘点计划失败'
      error.value = msg
      throw err
    } finally {
      loading.value = false
    }
  }

  async function updatePlan(form: InventoryPlanUpdateForm): Promise<InventoryPlanWithStatus> {
    loading.value = true
    error.value = null
    try {
      const response = await axios.put(`${API_BASE_URL}/api/inventory-plans`, form, {
        headers: getAuthHeaders(),
      })
      plan.value = response.data.plan
      status.value = response.data.status
      return response.data
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || '更新盘点计划失败'
      error.value = msg
      throw err
    } finally {
      loading.value = false
    }
  }

  async function syncLastInventory(): Promise<InventoryPlanWithStatus | null> {
    try {
      const response = await axios.patch(
        `${API_BASE_URL}/api/inventory-plans/sync-last-inventory`,
        {},
        { headers: getAuthHeaders() }
      )
      plan.value = response.data.plan
      status.value = response.data.status
      return response.data
    } catch (err) {
      throw err
    }
  }

  async function preview(params: {
    cycleType: InventoryCycleType
    customIntervalDays?: number
    weeklyDayOfWeek?: number
    monthlyDayOfMonth?: number
    skipHolidays?: boolean
    lastInventoryDate?: string
  }): Promise<InventoryStatus> {
    const response = await axios.post(`${API_BASE_URL}/api/inventory-plans/preview`, params, {
      headers: getAuthHeaders(),
    })
    return response.data
  }

  function reset() {
    plan.value = null
    status.value = null
    error.value = null
  }

  return {
    plan,
    status,
    loading,
    error,
    hasPlan,
    isOverdue,
    daysUntilNext,
    cycleDescription,
    fetchPlan,
    fetchStatus,
    createPlan,
    updatePlan,
    syncLastInventory,
    preview,
    reset,
  }
}
