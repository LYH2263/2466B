<template>
  <div class="app-container">
    <header class="app-header">
      <div class="header-content">
        <div class="logo">
          <el-button
            type="primary"
            plain
            :icon="ArrowLeft"
            circle
            @click="goBack"
          />
          <div class="title">
            <h1>交易流水</h1>
            <p>记录每一笔资金变动</p>
          </div>
        </div>

        <div class="header-actions">
          <div v-if="user" class="user-info">
            <span>{{ user.email }}</span>
            <el-button
              type="danger"
              size="small"
              :icon="SwitchButton"
              @click="handleLogout"
            >
              退出
            </el-button>
          </div>
          <el-button
            v-if="!hasTransactions"
            type="primary"
            :icon="DataLine"
            @click="handleFillDemo"
          >
            填充示例数据
          </el-button>
        </div>
      </div>
    </header>

    <main class="main-content">
      <div v-if="loading && transactions.length === 0" class="loading-state">
        <el-skeleton :rows="10" animated />
      </div>

      <div v-else-if="error" class="error-state">
        <el-alert
          :title="error"
          type="error"
          :closable="false"
          show-icon
        >
          <template #default>
            <el-button @click="refreshAll" style="margin-top: 16px">重试</el-button>
          </template>
        </el-alert>
      </div>

      <template v-else>
        <el-row :gutter="20" class="overview-row">
          <el-col :xs="24" :sm="12" :md="6">
            <el-card class="overview-card income-card" shadow="hover">
              <div class="card-content">
                <div class="card-icon"><Top /></div>
                <div class="card-info">
                  <div class="label">本月收入</div>
                  <div class="value income">
                    {{ overviewStats ? formatMoney(overviewStats.thisMonth.income) : '--' }}
                  </div>
                  <div class="sub-label" v-if="overviewStats">
                    较上月 {{ getDiffText(overviewStats.thisMonth.income - overviewStats.lastMonth.income) }}
                  </div>
                </div>
              </div>
            </el-card>
          </el-col>

          <el-col :xs="24" :sm="12" :md="6">
            <el-card class="overview-card expense-card" shadow="hover">
              <div class="card-content">
                <div class="card-icon"><Bottom /></div>
                <div class="card-info">
                  <div class="label">本月支出</div>
                  <div class="value expense">
                    {{ overviewStats ? formatMoney(overviewStats.thisMonth.expense) : '--' }}
                  </div>
                  <div class="sub-label" v-if="overviewStats">
                    较上月 {{ getDiffText(overviewStats.thisMonth.expense - overviewStats.lastMonth.expense) }}
                  </div>
                </div>
              </div>
            </el-card>
          </el-col>

          <el-col :xs="24" :sm="12" :md="6">
            <el-card class="overview-card net-card" shadow="hover">
              <div class="card-content">
                <div class="card-icon"><Sort /></div>
                <div class="card-info">
                  <div class="label">本月净流入</div>
                  <div class="value" :class="overviewStats && overviewStats.thisMonth.netFlow >= 0 ? 'income' : 'expense'">
                    {{ overviewStats ? formatMoney(overviewStats.thisMonth.netFlow, true) : '--' }}
                  </div>
                  <div class="sub-label" v-if="overviewStats">
                    共 {{ overviewStats.thisMonth.count }} 笔交易
                  </div>
                </div>
              </div>
            </el-card>
          </el-col>

          <el-col :xs="24" :sm="12" :md="6">
            <el-card class="overview-card total-card" shadow="hover">
              <div class="card-content">
                <div class="card-icon"><Coin /></div>
                <div class="card-info">
                  <div class="label">累计净流入</div>
                  <div class="value" :class="overviewStats && overviewStats.total.netFlow >= 0 ? 'income' : 'expense'">
                    {{ overviewStats ? formatMoney(overviewStats.total.netFlow, true) : '--' }}
                  </div>
                  <div class="sub-label" v-if="overviewStats">
                    共 {{ overviewStats.total.count }} 笔交易
                  </div>
                </div>
              </div>
            </el-card>
          </el-col>
        </el-row>

        <TransactionForm
          v-if="showForm"
          :edit-data="editingTransaction"
          @submit="handleSubmit"
          @cancel="handleCancelEdit"
          @fill-demo="handleFillDemo"
        />

        <TransactionChart
          :monthly-stats="monthlyStats"
          :asset-comparison="assetComparison"
          :loading="statsLoading"
          @fill-demo="handleFillDemo"
          @month-change="handleMonthChange"
        />

        <TransactionList
          :transactions="transactions"
          :pagination="pagination"
          :loading="loading"
          @delete="handleDelete"
          @edit="handleEdit"
          @fill-demo="handleFillDemo"
          @search="handleSearch"
          @page-change="handlePageChange"
        />
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  WalletFilled,
  ArrowLeft,
  DataLine,
  SwitchButton,
  Top,
  Bottom,
  Sort,
  Coin
} from '@element-plus/icons-vue'
import { useTransactions } from '../composables/useTransactions'
import type { Transaction, TransactionFormData, TransactionQuery } from '../types'
import axios from 'axios'
import TransactionForm from '../components/TransactionForm.vue'
import TransactionList from '../components/TransactionList.vue'
import TransactionChart from '../components/TransactionChart.vue'

const router = useRouter()
const {
  transactions,
  pagination,
  loading,
  error,
  monthlyStats,
  overviewStats,
  assetComparison,
  hasTransactions,
  fetchTransactions,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  fetchMonthlyStats,
  fetchOverviewStats,
  fetchAssetComparison,
  fillDemoTransactions
} = useTransactions()

const user = ref<{ id: string; email: string } | null>(null)
const showForm = ref(true)
const editingTransaction = ref<Transaction | null>(null)
const statsLoading = ref(false)
const currentMonthCount = ref(12)

const fetchUser = async () => {
  try {
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
    const token = localStorage.getItem('accessToken')

    const response = await axios.get(`${API_BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })

    user.value = response.data.user
  } catch (err) {
  }
}

const refreshAll = async () => {
  await Promise.all([
    fetchTransactions(),
    fetchMonthlyStats(currentMonthCount.value),
    fetchOverviewStats(),
    fetchAssetComparison(currentMonthCount.value)
  ])
}

const formatMoney = (value: number, withSign: boolean = false): string => {
  const formatted = new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2
  }).format(Math.abs(value))

  if (withSign) {
    return value >= 0 ? `+${formatted}` : `-${formatted}`
  }
  return formatted
}

const getDiffText = (diff: number): string => {
  if (diff === 0) return '持平'
  const sign = diff > 0 ? '+' : '-'
  return `${sign}${formatMoney(Math.abs(diff))}`
}

const handleSubmit = async (formData: TransactionFormData) => {
  let result
  if (editingTransaction.value) {
    result = await updateTransaction(editingTransaction.value.id, formData)
  } else {
    result = await addTransaction(formData)
  }

  if (result.success) {
    ElMessage.success(editingTransaction.value ? '更新成功' : '添加成功')
    handleCancelEdit()
    await refreshAll()
  } else {
    ElMessage.error(result.error || '操作失败')
  }
}

const handleDelete = async (id: string) => {
  try {
    await deleteTransaction(id)
    ElMessage.success('删除成功')
    await refreshAll()
  } catch (err: any) {
    ElMessage.error(err.message || '删除失败')
  }
}

const handleEdit = (transaction: Transaction) => {
  editingTransaction.value = transaction
  showForm.value = true
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const handleCancelEdit = () => {
  editingTransaction.value = null
}

const handleSearch = async (filters: any) => {
  const query: TransactionQuery = {
    page: 1,
    pageSize: pagination.value.pageSize
  }
  if (filters.direction) query.direction = filters.direction
  if (filters.category) query.category = filters.category
  if (filters.keyword) query.keyword = filters.keyword
  if (filters.dateRange && filters.dateRange.length === 2) {
    query.startDate = filters.dateRange[0]
    query.endDate = filters.dateRange[1]
  }
  await fetchTransactions(query)
}

const handlePageChange = async (page?: number, pageSize?: number) => {
  const query: TransactionQuery = {
    page: page || pagination.value.page,
    pageSize: pageSize || pagination.value.pageSize
  }
  await fetchTransactions(query)
}

const handleMonthChange = async (months: number) => {
  currentMonthCount.value = months
  statsLoading.value = true
  try {
    await Promise.all([
      fetchMonthlyStats(months),
      fetchAssetComparison(months)
    ])
  } finally {
    statsLoading.value = false
  }
}

const handleFillDemo = async () => {
  try {
    await ElMessageBox.confirm(
      '将填充20条示例交易数据，是否继续？',
      '填充示例数据',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'info'
      }
    )
    await fillDemoTransactions()
    ElMessage.success('示例数据已填充')
    await refreshAll()
  } catch (err) {
  }
}

const handleLogout = async () => {
  try {
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

    await axios.post(`${API_BASE_URL}/api/auth/logout`, {}, {
      withCredentials: true
    })

    localStorage.removeItem('accessToken')
    ElMessage.success('已退出登录')
    router.push('/login')
  } catch (err) {
    localStorage.removeItem('accessToken')
    router.push('/login')
  }
}

const goBack = () => {
  router.push('/')
}

onMounted(async () => {
  await fetchUser()
  await refreshAll()
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background-color: #f5f7fa;
  min-height: 100vh;
}
</style>

<style scoped>
.app-container {
  min-height: 100vh;
}

.app-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 20px 0;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.header-content {
  max-width: 1400px;
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
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px 20px;
}

.overview-row {
  margin-bottom: 0;
}

.overview-card {
  margin-bottom: 20px;
}

.card-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.card-icon {
  font-size: 32px;
  display: flex;
  align-items: center;
}

.income-card .card-icon {
  color: #67c23a;
}

.expense-card .card-icon {
  color: #f56c6c;
}

.net-card .card-icon {
  color: #409eff;
}

.total-card .card-icon {
  color: #722ed1;
}

.card-info {
  flex: 1;
}

.label {
  font-size: 14px;
  color: #606266;
  margin-bottom: 4px;
}

.value {
  font-size: 22px;
  font-weight: 600;
  color: #303133;
}

.value.income {
  color: #67c23a;
}

.value.expense {
  color: #f56c6c;
}

.sub-label {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.loading-state,
.error-state {
  padding: 40px 0;
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
}
</style>
