<template>
  <div class="app-container">
    <header class="app-header">
      <div class="header-content">
        <div class="logo">
          <WalletFilled style="font-size: 32px; color: #409eff;" />
          <div class="title">
            <h1>资产统计</h1>
            <p>个人资产管理工具</p>
          </div>
        </div>

        <div class="header-nav">
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
          <el-button
            type="primary"
            plain
            :icon="Calendar"
            @click="goToInventoryPlan"
          >
            盘点计划
          </el-button>
          <el-button
            type="success"
            plain
            :icon="DataAnalysis"
            @click="goToHealthScore"
          >
            健康评分
          </el-button>
          <el-button
            v-if="isAdmin"
            type="warning"
            plain
            :icon="Setting"
            @click="goToAdmin"
          >
            管理后台
          </el-button>
        </div>

        <div class="header-actions">
          <NotificationCenter />
          <div v-if="user" class="user-info">
            <el-tag v-if="user.role === 'admin'" type="danger" size="small" effect="dark">管理员</el-tag>
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
            type="success"
            :icon="UploadFilled"
            @click="showImportWizard = true"
          >
            批量导入
          </el-button>
          <el-button
            v-if="!hasRecords"
            type="primary"
            :icon="DataLine"
            @click="handleFillDemo"
          >
            填充示例数据
          </el-button>
          <el-button
            v-else
            type="danger"
            :icon="DeleteFilled"
            @click="handleClearAll"
          >
            清空数据
          </el-button>
        </div>
      </div>
    </header>

    <main class="main-content">
      <div v-if="loading" class="loading-state">
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
            <el-button @click="fetchRecords" style="margin-top: 16px">重试</el-button>
          </template>
        </el-alert>
      </div>

      <template v-else>
        <DashboardGrid
          ref="dashboardGridRef"
          :widget-props="widgetProps"
          @layout-changed="handleLayoutChanged"
        />
      </template>
    </main>

    <ImportWizard
      v-model="showImportWizard"
      @import-complete="handleImportComplete"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { WalletFilled, DataLine, DeleteFilled, SwitchButton, List, Document, Setting, UploadFilled, Calendar, DataAnalysis } from '@element-plus/icons-vue'
import { useAssets } from '../composables/useAssets'
import { useAuth } from '../composables/useAuth'
import { usePrediction } from '../composables/usePrediction'
import { useInventoryPlans } from '../composables/useInventoryPlans'
import { useHealthScore } from '../composables/useHealthScore'
import type { AssetFormData, PredictionAlgorithm, HealthScoreResult } from '../types'
import axios from 'axios'
import NotificationCenter from '../components/NotificationCenter.vue'
import ImportWizard from '../components/ImportWizard.vue'
import DashboardGrid from '../components/dashboard/DashboardGrid.vue'
import type { WidgetComponentProps } from '../components/dashboard/WidgetRegistry'

const router = useRouter()
const { records, latestRecord, chartData, hasRecords, loading, error, fetchRecords, addRecord, deleteRecord, fillDemoData } = useAssets()
const { currentUser: authUser, isAdmin, fetchCurrentUser, clearUser } = useAuth()
const { plan: inventoryPlan, status: inventoryStatus, loading: inventoryLoading, fetchPlan: fetchInventoryPlan, syncLastInventory } = useInventoryPlans()
const { currentScore: healthScore, loading: healthScoreLoading, fetchScore: fetchHealthScore } = useHealthScore()

const user = ref<{ id: string; email: string; role?: string } | null>(null)
const showImportWizard = ref(false)
const dashboardGridRef = ref<InstanceType<typeof DashboardGrid> | null>(null)

const {
  params: predictionParams,
  result: predictionResult,
  loading: predictionLoading,
  error: predictionError,
  fetchPrediction,
  setAlgorithm,
  setMonthsAhead,
  setTargetAmount,
} = usePrediction({ monthsAhead: 12 })

const widgetProps = computed<WidgetComponentProps>(() => ({
  latestRecord: latestRecord.value,
  chartData: chartData.value,
  prediction: predictionResult.value,
  predictionParams: predictionParams.value,
  predictionLoading: predictionLoading.value,
  predictionError: predictionError.value,
  records: records.value,
  status: inventoryStatus.value,
  plan: inventoryPlan.value,
  loading: inventoryLoading.value,
  healthScore: healthScore.value,
  healthScoreLoading: healthScoreLoading.value,
  refreshPrediction: handleRefreshPrediction,
  changeAlgorithm: handleChangeAlgorithm,
  changeMonths: handleChangeMonths,
  changeTarget: handleChangeTarget,
  submitForm: handleSubmit,
  fillDemo: handleFillDemo,
  handleDelete: handleDelete,
  goToInventoryPlan: goToInventoryPlan,
  fetchInventoryPlan: fetchInventoryPlan,
  handleSyncLastInventory: handleSyncLastInventory,
}))

const fetchUser = async () => {
  try {
    const fetched = await fetchCurrentUser()
    if (fetched) {
      user.value = fetched
    }
  } catch (err) {
  }
}

const handleSubmit = async (formData: AssetFormData) => {
  const result = await addRecord(formData)
  if (result.success) {
    ElMessage.success('添加成功')
    await fetchInventoryPlan()
  } else {
    ElMessage.error(result.error || '添加失败')
  }
}

const handleDelete = async (id: string) => {
  try {
    await ElMessageBox.confirm(
      '确定要删除这条记录吗？',
      '确认删除',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    await deleteRecord(id)
    ElMessage.success('删除成功')
  } catch (err) {
  }
}

const handleFillDemo = async () => {
  try {
    await fillDemoData()
    ElMessage.success('示例数据已填充')
  } catch (err: any) {
    ElMessage.error(err.message || '填充失败')
  }
}

const handleClearAll = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要清空所有记录吗？此操作不可恢复。',
      '确认清空',
      {
        confirmButtonText: '清空',
        cancelButtonText: '取消',
        type: 'danger'
      }
    )

    for (const record of records.value) {
      await deleteRecord(record.id)
    }
    ElMessage.success('数据已清空')
  } catch (err) {
  }
}

const goToTransactions = () => {
  router.push('/transactions')
}

const goToReports = () => {
  router.push('/reports')
}

const goToInventoryPlan = () => {
  router.push('/inventory-plan')
}

const goToHealthScore = () => {
  router.push('/health-score')
}

const goToAdmin = () => {
  router.push('/admin')
}

const handleSyncLastInventory = async () => {
  try {
    await syncLastInventory()
    ElMessage.success('已同步最新盘点日期')
  } catch (err: any) {
    ElMessage.error(err.message || '同步失败')
  }
}

const handleLogout = async () => {
  try {
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

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

const handleRefreshPrediction = async () => {
  await fetchPrediction()
}

const handleChangeAlgorithm = (algo: PredictionAlgorithm) => {
  setAlgorithm(algo)
}

const handleChangeMonths = (m: number) => {
  setMonthsAhead(m)
}

const handleChangeTarget = (t: number | undefined) => {
  setTargetAmount(t)
}

const handleImportComplete = async () => {
  await fetchRecords()
  await fetchInventoryPlan()
  await fetchHealthScore()
  ElMessage.success('导入完成，数据已刷新')
}

function handleLayoutChanged() {
}

watch(
  () => [chartData.value.length, hasRecords.value],
  async () => {
    if (hasRecords.value && chartData.value.length >= 3) {
      await fetchPrediction()
    }
  },
  { immediate: true }
)

onMounted(() => {
  fetchUser()
  fetchRecords()
  fetchInventoryPlan()
  fetchHealthScore()
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
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px 20px;
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
