import { ref, computed } from 'vue'
import axios from 'axios'
import type {
  HealthScoreResult,
  HealthConfig,
  HealthConfigForm,
  HealthScoreHistoryResponse,
} from '../types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

export function useHealthScore() {
  const currentScore = ref<HealthScoreResult | null>(null)
  const currentConfig = ref<HealthConfig | null>(null)
  const defaultConfig = ref<HealthConfigForm | null>(null)
  const history = ref<HealthScoreHistoryResponse | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const hasConfig = computed(() => currentConfig.value !== null)

  const fetchConfig = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/health/config`, {
        withCredentials: true,
      })
      currentConfig.value = response.data.config
      defaultConfig.value = response.data.defaultConfig || null
      return response.data
    } catch (err: any) {
      error.value = err.response?.data?.error || '获取配置失败'
      throw err
    }
  }

  const saveConfig = async (config: HealthConfigForm) => {
    try {
      loading.value = true
      error.value = null
      const response = await axios.post(`${API_BASE_URL}/api/health/config`, config, {
        withCredentials: true,
      })
      currentConfig.value = response.data.config
      return response.data
    } catch (err: any) {
      error.value = err.response?.data?.error || '保存配置失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  const resetConfig = async () => {
    try {
      loading.value = true
      error.value = null
      await axios.delete(`${API_BASE_URL}/api/health/config`, {
        withCredentials: true,
      })
      currentConfig.value = null
      await fetchConfig()
    } catch (err: any) {
      error.value = err.response?.data?.error || '重置配置失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  const fetchScore = async (recalculate = false) => {
    try {
      loading.value = true
      error.value = null
      const params = recalculate ? { recalculate: 'true' } : {}
      const response = await axios.get(`${API_BASE_URL}/api/health/score`, {
        params,
        withCredentials: true,
      })
      currentScore.value = response.data.score
      return response.data
    } catch (err: any) {
      error.value = err.response?.data?.error || '获取评分失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  const recalculateScore = async () => {
    try {
      loading.value = true
      error.value = null
      const response = await axios.post(
        `${API_BASE_URL}/api/health/score/recalculate`,
        {},
        {
          withCredentials: true,
        }
      )
      currentScore.value = response.data.score
      return response.data
    } catch (err: any) {
      error.value = err.response?.data?.error || '重新计算评分失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  const fetchHistory = async (limit = 30, offset = 0) => {
    try {
      loading.value = true
      error.value = null
      const response = await axios.get(`${API_BASE_URL}/api/health/score/history`, {
        params: { limit, offset },
        withCredentials: true,
      })
      history.value = response.data
      return response.data
    } catch (err: any) {
      error.value = err.response?.data?.error || '获取历史数据失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  const previewScore = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/health/score/preview`, {
        withCredentials: true,
      })
      return response.data.score as HealthScoreResult
    } catch (err: any) {
      error.value = err.response?.data?.error || '预览评分失败'
      throw err
    }
  }

  const clearError = () => {
    error.value = null
  }

  return {
    currentScore,
    currentConfig,
    defaultConfig,
    history,
    loading,
    error,
    hasConfig,
    fetchConfig,
    saveConfig,
    resetConfig,
    fetchScore,
    recalculateScore,
    fetchHistory,
    previewScore,
    clearError,
  }
}
