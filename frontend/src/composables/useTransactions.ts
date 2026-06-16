import { ref, computed } from 'vue'
import axios from 'axios'
import type {
  Transaction,
  TransactionFormData,
  TransactionQuery,
  Pagination,
  MonthlyStat,
  OverviewStats,
  AssetComparison
} from '../types'

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

export function useTransactions() {
  const transactions = ref<Transaction[]>([])
  const pagination = ref<Pagination>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0
  })
  const loading = ref(false)
  const error = ref('')
  const monthlyStats = ref<MonthlyStat[]>([])
  const overviewStats = ref<OverviewStats | null>(null)
  const assetComparison = ref<AssetComparison[]>([])

  const fetchTransactions = async (query?: TransactionQuery) => {
    loading.value = true
    error.value = ''
    try {
      const params: any = {
        page: query?.page || pagination.value.page,
        pageSize: query?.pageSize || pagination.value.pageSize
      }
      if (query?.direction) params.direction = query.direction
      if (query?.category) params.category = query.category
      if (query?.startDate) params.startDate = query.startDate
      if (query?.endDate) params.endDate = query.endDate
      if (query?.keyword) params.keyword = query.keyword

      const response = await api.get('/api/transactions', { params })
      transactions.value = response.data.transactions
      pagination.value = response.data.pagination
    } catch (err: any) {
      error.value = err.response?.data?.error || '获取交易记录失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  const getTransaction = async (id: string): Promise<Transaction | null> => {
    try {
      const response = await api.get(`/api/transactions/${id}`)
      return response.data.transaction
    } catch (err: any) {
      throw new Error(err.response?.data?.error || '获取交易记录失败')
    }
  }

  const addTransaction = async (formData: TransactionFormData): Promise<{ success: boolean; error?: string }> => {
    try {
      const payload = {
        ...formData,
        amount: formData.amount!
      }
      await api.post('/api/transactions', payload)
      return { success: true }
    } catch (err: any) {
      const message = err.response?.data?.error || '添加失败'
      return { success: false, error: message }
    }
  }

  const updateTransaction = async (id: string, formData: Partial<TransactionFormData>): Promise<{ success: boolean; error?: string }> => {
    try {
      await api.put(`/api/transactions/${id}`, formData)
      return { success: true }
    } catch (err: any) {
      const message = err.response?.data?.error || '更新失败'
      return { success: false, error: message }
    }
  }

  const deleteTransaction = async (id: string): Promise<void> => {
    try {
      await api.delete(`/api/transactions/${id}`)
    } catch (err: any) {
      throw new Error(err.response?.data?.error || '删除失败')
    }
  }

  const fetchMonthlyStats = async (months: number = 12) => {
    try {
      const response = await api.get('/api/transactions/stats/monthly', {
        params: { months }
      })
      monthlyStats.value = response.data.monthlyStats
    } catch (err: any) {
      throw new Error(err.response?.data?.error || '获取月度统计失败')
    }
  }

  const fetchOverviewStats = async () => {
    try {
      const response = await api.get('/api/transactions/stats/overview')
      overviewStats.value = response.data
    } catch (err: any) {
      throw new Error(err.response?.data?.error || '获取概览统计失败')
    }
  }

  const fetchAssetComparison = async (months: number = 12) => {
    try {
      const response = await api.get('/api/transactions/stats/asset-comparison', {
        params: { months }
      })
      assetComparison.value = response.data.comparison
    } catch (err: any) {
      throw new Error(err.response?.data?.error || '获取资产对照分析失败')
    }
  }

  const fillDemoTransactions = async () => {
    const demoData: TransactionFormData[] = [
      { date: '2024-01-05', amount: 15000, direction: 'INCOME', category: 'CASH', counterparty: '工资', note: '1月工资' },
      { date: '2024-01-10', amount: 2000, direction: 'EXPENSE', category: 'CASH', counterparty: '餐饮', note: '日常餐饮' },
      { date: '2024-01-15', amount: 5000, direction: 'EXPENSE', category: 'CASH', counterparty: '房租', note: '1月房租' },
      { date: '2024-01-20', amount: 10000, direction: 'TRANSFER', category: 'LONG_TERM_INVEST', counterparty: '转入', note: '转入股票账户' },
      { date: '2024-02-05', amount: 15000, direction: 'INCOME', category: 'CASH', counterparty: '工资', note: '2月工资' },
      { date: '2024-02-12', amount: 3000, direction: 'EXPENSE', category: 'CASH', counterparty: '购物', note: '春节购物' },
      { date: '2024-02-20', amount: 5000, direction: 'EXPENSE', category: 'CASH', counterparty: '房租', note: '2月房租' },
      { date: '2024-03-05', amount: 16000, direction: 'INCOME', category: 'CASH', counterparty: '工资', note: '3月工资' },
      { date: '2024-03-10', amount: 8000, direction: 'INCOME', category: 'LONG_TERM_INVEST', counterparty: '投资收益', note: '股票分红' },
      { date: '2024-03-15', amount: 5000, direction: 'EXPENSE', category: 'CASH', counterparty: '房租', note: '3月房租' },
      { date: '2024-03-25', amount: 1500, direction: 'EXPENSE', category: 'CASH', counterparty: '交通', note: '出行费用' },
      { date: '2024-04-05', amount: 16000, direction: 'INCOME', category: 'CASH', counterparty: '工资', note: '4月工资' },
      { date: '2024-04-18', amount: 3000, direction: 'EXPENSE', category: 'STABLE_BOND', counterparty: '购买', note: '买入债券基金' },
      { date: '2024-04-20', amount: 5000, direction: 'EXPENSE', category: 'CASH', counterparty: '房租', note: '4月房租' },
      { date: '2024-05-05', amount: 16000, direction: 'INCOME', category: 'CASH', counterparty: '工资', note: '5月工资' },
      { date: '2024-05-12', amount: 2500, direction: 'EXPENSE', category: 'CASH', counterparty: '餐饮', note: '聚餐等' },
      { date: '2024-05-20', amount: 5000, direction: 'EXPENSE', category: 'CASH', counterparty: '房租', note: '5月房租' },
      { date: '2024-06-05', amount: 17000, direction: 'INCOME', category: 'CASH', counterparty: '工资', note: '6月工资+奖金' },
      { date: '2024-06-15', amount: 20000, direction: 'TRANSFER', category: 'LONG_TERM_INVEST', counterparty: '转入', note: '追加投资' },
      { date: '2024-06-20', amount: 5000, direction: 'EXPENSE', category: 'CASH', counterparty: '房租', note: '6月房租' }
    ]

    for (const data of demoData) {
      await api.post('/api/transactions', data)
    }
  }

  const hasTransactions = computed(() => transactions.value.length > 0)

  return {
    transactions,
    pagination,
    loading,
    error,
    monthlyStats,
    overviewStats,
    assetComparison,
    hasTransactions,
    fetchTransactions,
    getTransaction,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    fetchMonthlyStats,
    fetchOverviewStats,
    fetchAssetComparison,
    fillDemoTransactions
  }
}
