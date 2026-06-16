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
        <InventoryStatusCard
          :status="inventoryStatus"
          :plan="inventoryPlan"
          :loading="inventoryLoading"
          @edit="goToInventoryPlan"
          @refresh="fetchInventoryPlan"
          @sync-last="handleSyncLastInventory"
        />

        <div class="health-score-overview" v-if="healthScore">
          <el-card shadow="hover" class="health-card">
            <template #header>
              <div class="card-header">
                <div class="header-left">
                  <el-icon :size="20" color="#67c23a"><DataAnalysis /></el-icon>
                  <span>资产健康度评分</span>
                </div>
                <el-button type="primary" link @click="goToHealthScore">
                  查看详情
                </el-button>
              </div>
            </template>
            <div v-if="healthScoreLoading" class="loading">
              <el-skeleton :rows="2" animated />
            </div>
            <div v-else class="health-content">
              <div class="health-score-main">
                <div class="score-circle" :style="{ borderColor: getScoreColor(healthScore.totalScore) }">
                  <span class="score-value" :style="{ color: getScoreColor(healthScore.totalScore) }">
                    {{ healthScore.totalScore }}
                  </span>
                  <span class="score-label">分</span>
                </div>
                <div class="score-info">
                  <div class="score-level" :style="{ color: getScoreColor(healthScore.totalScore) }">
                    {{ getScoreLevelText(healthScore.totalScore) }}
                  </div>
                  <div class="score-desc">{{ getScoreDescription(healthScore.totalScore) }}</div>
                  <div class="score-time">
                    计算时间: {{ formatScoreDate(healthScore.calculatedAt) }}
                  </div>
                </div>
              </div>
              <div class="health-dimensions">
                <div class="dimension-item" v-for="dim in getDimensions(healthScore)" :key="dim.key">
                  <div class="dimension-header">
                    <span class="dimension-name">{{ dim.label }}</span>
                    <span class="dimension-score" :style="{ color: getScoreColor(dim.score) }">
                      {{ dim.score }}
                    </span>
                  </div>
                  <div class="dimension-bar">
                    <div
                      class="dimension-progress"
                      :style="{
                        width: `${dim.score}%`,
                        backgroundColor: getScoreColor(dim.score),
                      }"
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </el-card>
        </div>

        <AssetSummary :latest-record="latestRecord" />

        <AssetForm
          @submit="handleSubmit"
          @fill-demo="handleFillDemo"
        />

        <AssetChart
          :chart-data="chartData"
          :prediction="predictionResult"
          @fill-demo="handleFillDemo"
        />

        <PredictionPanel
          :params="predictionParams"
          :result="predictionResult"
          :loading="predictionLoading"
          :error="predictionError"
          :chart-data="chartData"
          :refresh="handleRefreshPrediction"
          :on-change-algorithm="handleChangeAlgorithm"
          :on-change-months="handleChangeMonths"
          :on-change-target="handleChangeTarget"
        />

        <AssetList
          :records="records"
          @delete="handleDelete"
          @fill-demo="handleFillDemo"
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
import { onMounted, ref, watch } from 'vue'
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
import AssetSummary from '../components/AssetSummary.vue'
import AssetForm from '../components/AssetForm.vue'
import AssetChart from '../components/AssetChart.vue'
import AssetList from '../components/AssetList.vue'
import NotificationCenter from '../components/NotificationCenter.vue'
import PredictionPanel from '../components/PredictionPanel.vue'
import ImportWizard from '../components/ImportWizard.vue'
import InventoryStatusCard from '../components/InventoryStatusCard.vue'

const router = useRouter()
const { records, latestRecord, chartData, hasRecords, loading, error, fetchRecords, addRecord, deleteRecord, fillDemoData } = useAssets()
const { currentUser: authUser, isAdmin, fetchCurrentUser, clearUser } = useAuth()
const { plan: inventoryPlan, status: inventoryStatus, loading: inventoryLoading, fetchPlan: fetchInventoryPlan, syncLastInventory } = useInventoryPlans()
const { currentScore: healthScore, loading: healthScoreLoading, fetchScore: fetchHealthScore } = useHealthScore()

const user = ref<{ id: string; email: string; role?: string } | null>(null)
const showImportWizard = ref(false)

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

function getScoreColor(score: number) {
  if (score >= 90) return '#67c23a'
  if (score >= 80) return '#95d475'
  if (score >= 70) return '#e6a23c'
  if (score >= 60) return '#f56c6c'
  return '#f56c6c'
}

function getScoreLevelText(score: number) {
  if (score >= 90) return '优秀'
  if (score >= 80) return '良好'
  if (score >= 70) return '中等'
  if (score >= 60) return '及格'
  return '较差'
}

function getScoreDescription(score: number) {
  if (score >= 90) return '财务状况非常健康'
  if (score >= 80) return '财务状况良好'
  if (score >= 70) return '财务状况一般，有改进空间'
  if (score >= 60) return '财务状况需要关注'
  return '财务状况较差，急需改进'
}

function formatScoreDate(dateStr: string) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('zh-CN')
}

function getDimensions(score: HealthScoreResult) {
  return [
    { key: 'emergencyReserve', label: '应急储备', score: score.emergencyReserve.score },
    { key: 'assetAllocation', label: '资产配置', score: score.assetAllocation.score },
    { key: 'growthStability', label: '增长稳定', score: score.growthStability.score },
    { key: 'inventoryTimeliness', label: '盘点及时', score: score.inventoryTimeliness.score },
  ]
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

.health-score-overview {
  margin-bottom: 24px;
}

.health-card .card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.health-card .header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 16px;
}

.health-content {
  display: flex;
  gap: 32px;
}

.health-score-main {
  display: flex;
  align-items: center;
  gap: 24px;
  flex-shrink: 0;
}

.score-circle {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  border: 4px solid;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.score-value {
  font-size: 32px;
  font-weight: bold;
  line-height: 1;
}

.score-label {
  font-size: 14px;
  color: #666;
  margin-top: 4px;
}

.score-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.score-level {
  font-size: 20px;
  font-weight: bold;
}

.score-desc {
  font-size: 14px;
  color: #666;
}

.score-time {
  font-size: 12px;
  color: #999;
  margin-top: 8px;
}

.health-dimensions {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  justify-content: center;
}

.dimension-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dimension-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
}

.dimension-name {
  color: #555;
}

.dimension-score {
  font-weight: 600;
}

.dimension-bar {
  height: 6px;
  background: #f0f0f0;
  border-radius: 3px;
  overflow: hidden;
}

.dimension-progress {
  height: 100%;
  border-radius: 3px;
  transition: width 0.5s ease;
}

.loading {
  padding: 20px 0;
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

  .health-content {
    flex-direction: column;
    gap: 24px;
  }

  .health-score-main {
    flex-direction: column;
    text-align: center;
  }
}
</style>
