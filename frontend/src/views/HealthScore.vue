<template>
  <div class="health-score-page">
    <header class="page-header">
      <div class="header-content">
        <div class="header-left">
          <el-button
            type="primary"
            plain
            :icon="ArrowLeft"
            @click="goBack"
          >
            返回
          </el-button>
          <h1 class="page-title">资产健康度评分</h1>
        </div>
        <div class="header-actions">
          <el-tag
            v-if="currentScore"
            :type="dataQualityTagType"
            effect="light"
          >
            {{ DATA_QUALITY_LABELS[currentScore.dataQuality].label }}
          </el-tag>
          <el-button
            type="primary"
            :icon="Refresh"
            :loading="loading"
            @click="handleRecalculate"
          >
            重新计算
          </el-button>
          <el-button
            type="success"
            :icon="Setting"
            @click="showConfig = !showConfig"
          >
            {{ showConfig ? '隐藏配置' : '评分设置' }}
          </el-button>
        </div>
      </div>
    </header>

    <main class="main-content">
      <div v-if="loading && !currentScore" class="loading-state">
        <el-skeleton :rows="8" animated />
      </div>

      <div v-else-if="error" class="error-state">
        <el-alert
          :title="error"
          type="error"
          :closable="false"
          show-icon
        >
          <template #default>
            <el-button @click="fetchData" style="margin-top: 16px">重试</el-button>
          </template>
        </el-alert>
      </div>

      <template v-else>
        <el-alert
          v-if="currentScore?.dataQualityNote"
          type="info"
          :closable="false"
          show-icon
          :title="currentScore.dataQualityNote"
          class="data-quality-alert"
        />

        <el-tabs v-model="activeTab" class="score-tabs">
          <el-tab-pane label="评分总览" name="overview">
            <div class="overview-section">
              <div class="gauge-section">
                <HealthGauge
                  v-if="currentScore"
                  :score="currentScore.totalScore"
                  :calculated-at="currentScore.calculatedAt"
                  :height="'350px'"
                />
                <div v-if="currentScore" class="score-meta">
                  <div class="meta-item">
                    <span class="meta-label">计算时间</span>
                    <span class="meta-value">{{ formatDate(currentScore.calculatedAt) }}</span>
                  </div>
                </div>
              </div>

              <div class="weight-legend">
                <h3>维度权重</h3>
                <div class="weight-bars">
                  <div
                    v-for="dim in dimensions"
                    :key="dim.key"
                    class="weight-bar-item"
                  >
                    <div class="weight-bar-header">
                      <span
                        class="weight-color"
                        :style="{ backgroundColor: dim.color }"
                      ></span>
                      <span class="weight-label">{{ dim.label }}</span>
                      <span class="weight-percent">{{ (dim.weight * 100).toFixed(0) }}%</span>
                    </div>
                    <div class="weight-bar-bg">
                      <div
                        class="weight-bar-fill"
                        :style="{
                          width: `${dim.weight * 100}%`,
                          backgroundColor: dim.color,
                        }"
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="dimensions-section">
              <h2 class="section-title">各维度评分</h2>
              <div class="dimensions-grid">
                <HealthDimensionCard
                  v-for="dim in dimensions"
                  :key="dim.key"
                  :dimension="dim.key"
                  :score="dim.score"
                  :weight="dim.weight"
                  :suggestion="dim.suggestion"
                  :show-details="true"
                />
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane label="历史趋势" name="history">
            <div class="history-section">
              <div class="history-chart-container">
                <div ref="historyChartRef" class="history-chart"></div>
              </div>
              <div class="history-table-container">
                <h3>历史记录</h3>
                <el-table :data="historyData" style="width: 100%">
                  <el-table-column prop="calculatedAt" label="计算时间" width="180">
                    <template #default="{ row }">
                      {{ formatDate(row.calculatedAt) }}
                    </template>
                  </el-table-column>
                  <el-table-column prop="totalScore" label="总分" width="100">
                    <template #default="{ row }">
                      <el-tag :type="getScoreTagType(row.totalScore)">
                        {{ row.totalScore }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column prop="emergencyReserveScore" label="应急储备" width="100" />
                  <el-table-column prop="assetAllocationScore" label="资产配置" width="100" />
                  <el-table-column prop="growthStabilityScore" label="增长稳定" width="100" />
                  <el-table-column prop="inventoryTimelinessScore" label="盘点及时" width="100" />
                  <el-table-column prop="dataQuality" label="数据质量" width="120">
                    <template #default="{ row }">
                      {{ DATA_QUALITY_LABELS[row.dataQuality]?.label || row.dataQuality }}
                    </template>
                  </el-table-column>
                </el-table>
                <div v-if="history?.hasMore" class="load-more">
                  <el-button @click="loadMoreHistory" :loading="loadingHistory">
                    加载更多
                  </el-button>
                </div>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane label="评分设置" name="config">
            <HealthConfigForm
              :config="currentConfig"
              :default-config="defaultConfig"
              :loading="loading"
              @submit="handleSaveConfig"
              @reset="handleResetConfig"
            />
          </el-tab-pane>
        </el-tabs>

        <div v-if="showConfig" class="floating-config">
          <div class="config-header">
            <h3>快速设置</h3>
            <el-button type="primary" link :icon="Close" @click="showConfig = false" />
          </div>
          <HealthConfigForm
            :config="currentConfig"
            :default-config="defaultConfig"
            :loading="loading"
            @submit="handleSaveConfig"
            @reset="handleResetConfig"
          />
        </div>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Refresh, Setting, Close } from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import { useHealthScore } from '../composables/useHealthScore'
import { DATA_QUALITY_LABELS, getScoreLevel, HEALTH_DIMENSION_COLORS, HEALTH_DIMENSION_LABELS } from '../types'
import type { HealthConfigForm as HealthConfigFormType, HealthScoreHistoryItem } from '../types'
import HealthGauge from '../components/HealthGauge.vue'
import HealthDimensionCard from '../components/HealthDimensionCard.vue'
import HealthConfigForm from '../components/HealthConfigForm.vue'

const router = useRouter()
const {
  currentScore,
  currentConfig,
  defaultConfig,
  history,
  loading,
  error,
  fetchConfig,
  saveConfig,
  resetConfig,
  fetchScore,
  recalculateScore,
  fetchHistory,
  clearError,
} = useHealthScore()

const activeTab = ref('overview')
const showConfig = ref(false)
const loadingHistory = ref(false)
const historyOffset = ref(0)
const historyData = ref<HealthScoreHistoryItem[]>([])
const historyChartRef = ref<HTMLElement | null>(null)
let historyChartInstance: echarts.ECharts | null = null

const dimensions = computed(() => {
  if (!currentScore.value) return []
  return [
    {
      key: 'emergencyReserve',
      label: HEALTH_DIMENSION_LABELS.emergencyReserve,
      score: currentScore.value.emergencyReserve.score,
      weight: currentScore.value.emergencyReserve.weight,
      suggestion: currentScore.value.emergencyReserve.suggestion,
      color: HEALTH_DIMENSION_COLORS.emergencyReserve,
    },
    {
      key: 'assetAllocation',
      label: HEALTH_DIMENSION_LABELS.assetAllocation,
      score: currentScore.value.assetAllocation.score,
      weight: currentScore.value.assetAllocation.weight,
      suggestion: currentScore.value.assetAllocation.suggestion,
      color: HEALTH_DIMENSION_COLORS.assetAllocation,
    },
    {
      key: 'growthStability',
      label: HEALTH_DIMENSION_LABELS.growthStability,
      score: currentScore.value.growthStability.score,
      weight: currentScore.value.growthStability.weight,
      suggestion: currentScore.value.growthStability.suggestion,
      color: HEALTH_DIMENSION_COLORS.growthStability,
    },
    {
      key: 'inventoryTimeliness',
      label: HEALTH_DIMENSION_LABELS.inventoryTimeliness,
      score: currentScore.value.inventoryTimeliness.score,
      weight: currentScore.value.inventoryTimeliness.weight,
      suggestion: currentScore.value.inventoryTimeliness.suggestion,
      color: HEALTH_DIMENSION_COLORS.inventoryTimeliness,
    },
  ]
})

const dataQualityTagType = computed(() => {
  if (!currentScore.value) return 'info'
  const quality = currentScore.value.dataQuality
  switch (quality) {
    case 'FULL':
      return 'success'
    case 'PARTIAL':
      return 'warning'
    case 'LIMITED':
    case 'INSUFFICIENT':
      return 'danger'
    default:
      return 'info'
  }
})

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getScoreTagType(score: number) {
  if (score >= 90) return 'success'
  if (score >= 80) return ''
  if (score >= 70) return 'warning'
  return 'danger'
}

async function fetchData() {
  clearError()
  await Promise.all([fetchConfig(), fetchScore()])
  await fetchHistoryData()
}

async function fetchHistoryData() {
  historyOffset.value = 0
  historyData.value = []
  const result = await fetchHistory(30, 0)
  if (result?.scores) {
    historyData.value = result.scores
  }
  updateHistoryChart()
}

async function loadMoreHistory() {
  loadingHistory.value = true
  try {
    historyOffset.value += 30
    const result = await fetchHistory(30, historyOffset.value)
    if (result?.scores) {
      historyData.value = [...historyData.value, ...result.scores]
    }
    updateHistoryChart()
  } finally {
    loadingHistory.value = false
  }
}

async function handleRecalculate() {
  try {
    await recalculateScore()
    await fetchHistoryData()
    ElMessage.success('评分已重新计算')
  } catch (err: any) {
    ElMessage.error(err.message || '重新计算失败')
  }
}

async function handleSaveConfig(data: HealthConfigFormType) {
  try {
    await saveConfig(data)
    await recalculateScore()
    ElMessage.success('配置保存成功，评分已更新')
  } catch (err: any) {
    ElMessage.error(err.message || '保存配置失败')
  }
}

async function handleResetConfig() {
  try {
    await ElMessageBox.confirm(
      '确定要重置为默认配置吗？',
      '确认重置',
      {
        confirmButtonText: '重置',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
    await resetConfig()
    await recalculateScore()
    ElMessage.success('配置已重置为默认值')
  } catch (err) {
  }
}

function goBack() {
  router.push('/')
}

function initHistoryChart() {
  if (!historyChartRef.value) return

  historyChartInstance = echarts.init(historyChartRef.value)
  updateHistoryChart()
}

function updateHistoryChart() {
  if (!historyChartInstance || historyData.value.length === 0) return

  const sortedData = [...historyData.value].sort(
    (a, b) => new Date(a.calculatedAt).getTime() - new Date(b.calculatedAt).getTime()
  )

  const dates = sortedData.map((d) =>
    new Date(d.calculatedAt).toLocaleDateString('zh-CN')
  )

  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        let result = `${params[0].axisValue}<br/>`
        params.forEach((p: any) => {
          result += `${p.marker} ${p.seriesName}: ${p.value}<br/>`
        })
        return result
      },
    },
    legend: {
      data: ['总分', '应急储备', '资产配置', '增长稳定', '盘点及时'],
      bottom: 0,
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: dates,
      boundaryGap: false,
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      splitLine: {
        lineStyle: {
          type: 'dashed',
        },
      },
    },
    series: [
      {
        name: '总分',
        type: 'line',
        data: sortedData.map((d) => d.totalScore),
        smooth: true,
        lineStyle: {
          width: 3,
          color: '#409eff',
        },
        itemStyle: {
          color: '#409eff',
        },
      },
      {
        name: '应急储备',
        type: 'line',
        data: sortedData.map((d) => d.emergencyReserveScore),
        smooth: true,
        lineStyle: {
          color: HEALTH_DIMENSION_COLORS.emergencyReserve,
        },
        itemStyle: {
          color: HEALTH_DIMENSION_COLORS.emergencyReserve,
        },
      },
      {
        name: '资产配置',
        type: 'line',
        data: sortedData.map((d) => d.assetAllocationScore),
        smooth: true,
        lineStyle: {
          color: HEALTH_DIMENSION_COLORS.assetAllocation,
        },
        itemStyle: {
          color: HEALTH_DIMENSION_COLORS.assetAllocation,
        },
      },
      {
        name: '增长稳定',
        type: 'line',
        data: sortedData.map((d) => d.growthStabilityScore),
        smooth: true,
        lineStyle: {
          color: HEALTH_DIMENSION_COLORS.growthStability,
        },
        itemStyle: {
          color: HEALTH_DIMENSION_COLORS.growthStability,
        },
      },
      {
        name: '盘点及时',
        type: 'line',
        data: sortedData.map((d) => d.inventoryTimelinessScore),
        smooth: true,
        lineStyle: {
          color: HEALTH_DIMENSION_COLORS.inventoryTimeliness,
        },
        itemStyle: {
          color: HEALTH_DIMENSION_COLORS.inventoryTimeliness,
        },
      },
    ],
  }

  historyChartInstance.setOption(option)
}

function handleResize() {
  historyChartInstance?.resize()
}

watch(
  () => activeTab.value,
  (tab) => {
    if (tab === 'history') {
      setTimeout(() => {
        initHistoryChart()
      }, 100)
    }
  }
)

onMounted(() => {
  fetchData()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  historyChartInstance?.dispose()
})
</script>

<style scoped>
.health-score-page {
  min-height: 100vh;
  background-color: #f5f7fa;
}

.page-header {
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

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
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

.data-quality-alert {
  margin-bottom: 24px;
}

.score-tabs {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.overview-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 32px;
  margin-bottom: 32px;
}

.gauge-section {
  text-align: center;
}

.score-meta {
  display: flex;
  justify-content: center;
  gap: 24px;
  margin-top: 16px;
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.meta-label {
  font-size: 12px;
  color: #999;
}

.meta-value {
  font-size: 14px;
  color: #333;
  font-weight: 500;
}

.weight-legend {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 24px;
}

.weight-legend h3 {
  margin: 0 0 20px 0;
  font-size: 18px;
  color: #333;
}

.weight-bars {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.weight-bar-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.weight-bar-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.weight-color {
  width: 12px;
  height: 12px;
  border-radius: 2px;
}

.weight-label {
  font-size: 14px;
  color: #333;
  flex: 1;
}

.weight-percent {
  font-size: 14px;
  font-weight: 600;
  color: #666;
}

.weight-bar-bg {
  height: 8px;
  background: #e9ecef;
  border-radius: 4px;
  overflow: hidden;
}

.weight-bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.5s ease;
}

.section-title {
  font-size: 20px;
  font-weight: 600;
  color: #333;
  margin: 0 0 20px 0;
}

.dimensions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.history-section {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.history-chart-container {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 20px;
}

.history-chart {
  width: 100%;
  height: 400px;
}

.history-table-container h3 {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin: 0 0 16px 0;
}

.load-more {
  text-align: center;
  margin-top: 20px;
}

.floating-config {
  position: fixed;
  right: 0;
  top: 0;
  bottom: 0;
  width: 500px;
  background: white;
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  overflow-y: auto;
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

.config-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #eee;
  position: sticky;
  top: 0;
  background: white;
  z-index: 1;
}

.config-header h3 {
  margin: 0;
  font-size: 18px;
  color: #333;
}

@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    gap: 16px;
    text-align: center;
  }

  .header-actions {
    flex-wrap: wrap;
    justify-content: center;
  }

  .overview-section {
    grid-template-columns: 1fr;
    gap: 24px;
  }

  .dimensions-grid {
    grid-template-columns: 1fr;
  }

  .floating-config {
    width: 100%;
  }
}
</style>
