import { ref, watch } from 'vue'
import axios from 'axios'
import type { PredictionResult, PredictionParams } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        const response = await axios.post(`${API_BASE_URL}/api/auth/refresh`, {}, {
          withCredentials: true
        })

        const { accessToken } = response.data
        localStorage.setItem('accessToken', accessToken)

        originalRequest.headers.Authorization = `Bearer ${accessToken}`
        return api(originalRequest)
      } catch (refreshError) {
        localStorage.removeItem('accessToken')
        window.location.href = '/login'
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

export function usePrediction(initialParams?: Partial<PredictionParams>) {
  const params = ref<PredictionParams>({
    algorithm: initialParams?.algorithm || 'linear',
    monthsAhead: initialParams?.monthsAhead || 12,
    targetAmount: initialParams?.targetAmount,
  })

  const result = ref<PredictionResult | null>(null)
  const loading = ref(false)
  const error = ref('')

  const fetchPrediction = async () => {
    loading.value = true
    error.value = ''
    result.value = null
    try {
      const query: Record<string, any> = {
        algorithm: params.value.algorithm,
        monthsAhead: params.value.monthsAhead,
      }
      if (params.value.targetAmount !== undefined && params.value.targetAmount !== null) {
        query.targetAmount = params.value.targetAmount
      }

      const response = await api.get('/api/prediction/forecast', { params: query })
      result.value = response.data
    } catch (err: any) {
      error.value = err.response?.data?.error || '预测请求失败'
    } finally {
      loading.value = false
    }
  }

  const setAlgorithm = (algo: PredictionParams['algorithm']) => {
    params.value.algorithm = algo
  }

  const setMonthsAhead = (months: number) => {
    params.value.monthsAhead = Math.max(1, Math.min(120, Math.floor(months)))
  }

  const setTargetAmount = (amount: number | undefined) => {
    params.value.targetAmount = amount && amount > 0 ? amount : undefined
  }

  watch(
    () => [params.value.algorithm, params.value.monthsAhead, params.value.targetAmount],
    () => {
      fetchPrediction()
    },
    { deep: false }
  )

  return {
    params,
    result,
    loading,
    error,
    fetchPrediction,
    setAlgorithm,
    setMonthsAhead,
    setTargetAmount,
  }
}
