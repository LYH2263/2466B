import { ref, computed } from 'vue'
import axios from 'axios'
import type { ReportData, ReportQuery, AvailablePeriods } from '../types'

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
      } catch {
        localStorage.removeItem('accessToken')
        window.location.href = '/login'
        return Promise.reject(error)
      }
    }
    return Promise.reject(error)
  }
)

export function useReports() {
  const reportData = ref<ReportData | null>(null)
  const availablePeriods = ref<AvailablePeriods | null>(null)
  const loading = ref(false)
  const error = ref('')
  const exportingPdf = ref(false)

  const fetchAvailablePeriods = async () => {
    try {
      const response = await api.get('/api/reports/available-periods')
      availablePeriods.value = response.data
    } catch (err: any) {
      error.value = err.response?.data?.error || '获取可用周期失败'
    }
  }

  const generateReport = async (query: ReportQuery) => {
    loading.value = true
    error.value = ''
    reportData.value = null
    try {
      const params: any = {
        period: query.period,
        year: query.year
      }
      if (query.month !== undefined) {
        params.month = query.month
      }
      const response = await api.get('/api/reports/generate', { params })
      reportData.value = response.data
    } catch (err: any) {
      error.value = err.response?.data?.error || '生成报表失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  const formatMoney = (num: number): string => {
    if (num === null || num === undefined) return '¥0.00'
    return '¥' + num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const formatPercent = (num: number): string => {
    if (num === null || num === undefined) return '0.00%'
    return num.toFixed(2) + '%'
  }

  const getExportFileName = (data: ReportData): string => {
    const dateStr = new Date().toISOString().split('T')[0]
    if (data.period === 'monthly') {
      return `资产报告_${data.year}年${data.month}月_${dateStr}.pdf`
    }
    return `资产报告_${data.year}年度_${dateStr}.pdf`
  }

  const hasData = computed(() => reportData.value?.hasData ?? false)

  return {
    reportData,
    availablePeriods,
    loading,
    error,
    exportingPdf,
    fetchAvailablePeriods,
    generateReport,
    formatMoney,
    formatPercent,
    getExportFileName,
    hasData
  }
}
