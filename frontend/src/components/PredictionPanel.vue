<template>
  <el-card class="prediction-panel">
    <template #header>
      <div class="panel-header">
        <div class="title">
          <TrendCharts style="color: #409eff; margin-right: 8px;" />
          <span>趋势预测</span>
        </div>
        <el-tooltip v-if="!canPredictNow" content="至少需要3个月的有效数据" placement="top">
          <el-tag type="info" size="small" effect="plain">数据不足</el-tag>
        </el-tooltip>
      </div>
    </template>

    <div class="panel-content">
      <div class="control-section">
        <div class="form-row">
          <div class="form-item">
            <label class="label">预测算法</label>
            <el-select
              v-model="localAlgorithm"
              :disabled="loading"
              size="default"
              style="width: 100%;"
            >
              <el-option label="线性回归 (推荐)" value="linear" />
              <el-option label="移动平均" value="movingAverage" />
              <el-option label="Holt 双指数平滑" value="exponentialSmoothing" />
            </el-select>
          </div>

          <div class="form-item">
            <label class="label">预测月数: {{ localMonths }} 个月</label>
            <el-slider
              v-model="localMonths"
              :min="1"
              :max="60"
              :step="1"
              :marks="sliderMarks"
              :disabled="loading"
              show-stops
            />
          </div>

          <div class="form-item">
            <label class="label">目标金额 (元)</label>
            <el-input-number
              v-model="localTarget"
              :min="0"
              :max="999999999"
              :step="10000"
              :disabled="loading"
              :controls="true"
              size="default"
              style="width: 100%;"
              placeholder="可选，用于计算达成时间"
            />
            <div v-if="!localTarget" class="hint">输入目标金额后可查看预计达成时间</div>
          </div>
        </div>

        <div class="action-row">
          <el-button
            type="primary"
            :icon="RefreshRight"
            :loading="loading"
            @click="handleRefresh"
          >
            重新计算预测
          </el-button>
          <el-alert
            v-if="error"
            :title="error"
            type="error"
            :closable="false"
            show-icon
            style="flex: 1; margin-left: 12px;"
          />
        </div>
      </div>

      <el-divider v-if="result" />

      <div v-if="loading" class="loading-section">
        <el-skeleton :rows="6" animated />
      </div>

      <div v-else-if="!result" class="empty-tip">
        <el-empty :description="emptyText" :image-size="80">
          <el-button v-if="hasAnyData" type="primary" size="small" @click="handleRefresh">
            开始预测
          </el-button>
        </el-empty>
      </div>

      <div v-else-if="!result.canPredict" class="empty-tip">
        <el-empty :description="result.message || '无法进行预测'" :image-size="80" />
      </div>

      <template v-else>
        <div class="metrics-section">
          <div class="metric-card">
            <div class="metric-label">月均增长</div>
            <div class="metric-value" :class="growthClass">
              {{ result.metrics.slope >= 0 ? '+' : '' }}¥{{ formatNumber(result.metrics.slope) }}
            </div>
            <div class="metric-sub">
              {{ result.monthlyGrowthRate !== undefined ? (result.monthlyGrowthRate >= 0 ? '+' : '') + result.monthlyGrowthRate + '% / 月' : '-' }}
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-label">预测期末资产</div>
            <div class="metric-value">
              ¥{{ formatNumber(lastPredValue) }}
            </div>
            <div class="metric-sub">
              {{ result.predictions[result.predictions.length - 1]?.date }}
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-label">置信水平</div>
            <div class="metric-value">{{ result.metrics.confidenceLevel }}%</div>
            <div class="metric-sub" v-if="result.metrics.rSquared !== undefined">
              R² = {{ result.metrics.rSquared.toFixed(4) }}
            </div>
            <div class="metric-sub" v-else>-</div>
          </div>

          <div class="metric-card target-card" :class="{ 'target-reached': hasReachedTarget, 'target-warn': !result.targetReachDate && localTarget }">
            <div class="metric-label">目标达成</div>
            <template v-if="hasReachedTarget">
              <div class="metric-value" style="color: #67c23a;">已达成 ✓</div>
              <div class="metric-sub">当前已超过目标金额</div>
            </template>
            <template v-else-if="result.targetReachDate">
              <div class="metric-value">{{ result.targetReachDate }}</div>
              <div class="metric-sub">
                预计还需 {{ result.targetReachMonths }} 个月
              </div>
            </template>
            <template v-else>
              <div class="metric-value" style="color: #909399;">-</div>
              <div class="metric-sub">
                {{ localTarget ? '当前趋势无法在可预见范围内达成' : '请输入目标金额' }}
              </div>
            </template>
          </div>
        </div>

        <el-divider content-position="left">
          <span style="font-weight: 600;">预测明细</span>
        </el-divider>

        <div class="table-section">
          <el-table
            :data="result.predictions"
            stripe
            border
            size="small"
            max-height="360"
            style="width: 100%;"
          >
            <el-table-column
              type="index"
              label="序号"
              width="60"
              align="center"
            />
            <el-table-column
              prop="date"
              label="月份"
              min-width="100"
              align="center"
            />
            <el-table-column
              label="预测资产 (元)"
              min-width="140"
              align="right"
            >
              <template #default="{ row }">
                <span style="font-weight: 600; color: #f56c6c;">
                  ¥{{ formatNumber(row.value) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column
              label="置信区间下限"
              min-width="140"
              align="right"
            >
              <template #default="{ row }">
                <span style="color: #e6a23c;">¥{{ formatNumber(row.lower) }}</span>
              </template>
            </el-table-column>
            <el-table-column
              label="置信区间上限"
              min-width="140"
              align="right"
            >
              <template #default="{ row }">
                <span style="color: #67c23a;">¥{{ formatNumber(row.upper) }}</span>
              </template>
            </el-table-column>
            <el-table-column
              label="区间宽度"
              min-width="120"
              align="right"
            >
              <template #default="{ row }">
                <span style="color: #909399;">±¥{{ formatNumber(Math.round((row.upper - row.lower) / 2)) }}</span>
              </template>
            </el-table-column>
            <el-table-column
              v-if="localTarget"
              label="进度"
              min-width="140"
              align="center"
            >
              <template #default="{ row }">
                <el-progress
                  :percentage="targetPercent(row.value)"
                  :color="progressColor(row.value)"
                  :stroke-width="8"
                />
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div v-if="outlierCount > 0" class="outlier-notice">
          <el-alert
            :title="`检测到 ${outlierCount} 个异常值数据点已在预测中剔除（Z-score > 3）`"
            type="warning"
            :closable="false"
            show-icon
          />
        </div>
      </template>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { TrendCharts, RefreshRight } from '@element-plus/icons-vue'
import type { PredictionParams, PredictionResult, PredictionAlgorithm, AssetRecord } from '../types'

interface Props {
  params: PredictionParams
  result: PredictionResult | null
  loading: boolean
  error: string
  chartData: AssetRecord[]
  refresh: () => Promise<void> | void
  onChangeAlgorithm: (algo: PredictionAlgorithm) => void
  onChangeMonths: (m: number) => void
  onChangeTarget: (t: number | undefined) => void
}

const props = defineProps<Props>()

const localAlgorithm = ref<PredictionAlgorithm>(props.params.algorithm)
const localMonths = ref<number>(props.params.monthsAhead)
const localTarget = ref<number | undefined>(props.params.targetAmount)

watch(
  () => props.params,
  (p) => {
    localAlgorithm.value = p.algorithm
    localMonths.value = p.monthsAhead
    localTarget.value = p.targetAmount
  },
  { deep: true }
)

watch(localAlgorithm, (v) => props.onChangeAlgorithm(v))
watch(localMonths, (v) => props.onChangeMonths(v))
watch(localTarget, (v) => props.onChangeTarget(v))

const sliderMarks = {
  1: '1月',
  3: '3月',
  6: '6月',
  12: '1年',
  24: '2年',
  36: '3年',
  60: '5年',
}

const hasAnyData = computed(() => props.chartData && props.chartData.length > 0)

const canPredictNow = computed(() => props.chartData && props.chartData.length >= 3)

const emptyText = computed(() => {
  if (!hasAnyData.value) return '请先添加资产记录以开启预测'
  if (!canPredictNow.value) return '数据点不足（至少3个月）'
  return '点击按钮开始计算预测'
})

const lastPredValue = computed(() => {
  if (!props.result?.predictions?.length) return 0
  return props.result.predictions[props.result.predictions.length - 1].value
})

const growthClass = computed(() => {
  const s = props.result?.metrics?.slope
  if (s === undefined) return ''
  if (s > 0) return 'growth-up'
  if (s < 0) return 'growth-down'
  return ''
})

const hasReachedTarget = computed(() => {
  if (!localTarget.value || !props.result) return false
  return props.result.targetReachMonths === 0
})

const outlierCount = computed(() => {
  if (!props.result?.processedData) return 0
  return props.result.processedData.filter(d => d.isOutlier).length
})

const formatNumber = (v: number | string | undefined | null): string => {
  if (v === undefined || v === null || v === '') return '0'
  const n = typeof v === 'number' ? v : Number(v)
  if (isNaN(n)) return '0'
  return Math.round(n).toLocaleString('zh-CN')
}

const targetPercent = (v: number): number => {
  if (!localTarget.value) return 0
  return Math.min(100, Math.round((v / localTarget.value) * 100))
}

const progressColor = (v: number): string => {
  const p = targetPercent(v)
  if (p >= 100) return '#67c23a'
  if (p >= 75) return '#409eff'
  if (p >= 50) return '#e6a23c'
  return '#f56c6c'
}

const handleRefresh = async () => {
  try {
    await props.refresh()
    ElMessage.success('预测已更新')
  } catch (e: any) {
    ElMessage.error(e?.message || '更新失败')
  }
}
</script>

<style scoped>
.prediction-panel {
  margin-bottom: 20px;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 16px;
  font-weight: 600;
}

.title {
  display: flex;
  align-items: center;
}

.panel-content {
  padding: 4px 0;
}

.control-section {
  padding: 4px 0;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 2fr 1fr;
  gap: 20px;
  margin-bottom: 16px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.label {
  font-size: 13px;
  font-weight: 500;
  color: #606266;
}

.hint {
  font-size: 12px;
  color: #909399;
}

.action-row {
  display: flex;
  align-items: center;
}

.loading-section {
  padding: 20px 0;
}

.empty-tip {
  padding: 30px 0;
}

.metrics-section {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.metric-card {
  background: linear-gradient(135deg, #f8f9ff 0%, #ffffff 100%);
  border: 1px solid #ebeef5;
  border-radius: 10px;
  padding: 16px;
  transition: all 0.2s ease;
}

.metric-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
  transform: translateY(-2px);
}

.metric-label {
  font-size: 13px;
  color: #909399;
  margin-bottom: 8px;
}

.metric-value {
  font-size: 22px;
  font-weight: 700;
  color: #303133;
  margin-bottom: 4px;
  letter-spacing: -0.5px;
}

.metric-value.growth-up {
  color: #67c23a;
}

.metric-value.growth-down {
  color: #f56c6c;
}

.metric-sub {
  font-size: 12px;
  color: #909399;
}

.target-card {
  background: linear-gradient(135deg, #ecf5ff 0%, #ffffff 100%);
  border-color: #b3d8ff;
}

.target-card.target-reached {
  background: linear-gradient(135deg, #f0f9eb 0%, #ffffff 100%);
  border-color: #c2e7b0;
}

.target-card.target-warn {
  background: linear-gradient(135deg, #fdf6ec 0%, #ffffff 100%);
  border-color: #f5dab1;
}

.table-section {
  margin-top: 8px;
}

.outlier-notice {
  margin-top: 16px;
}

@media (max-width: 1100px) {
  .form-row {
    grid-template-columns: 1fr 1fr;
  }

  .form-row .form-item:nth-child(2) {
    grid-column: 1 / -1;
  }

  .metrics-section {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 600px) {
  .form-row {
    grid-template-columns: 1fr;
  }

  .form-row .form-item:nth-child(2) {
    grid-column: auto;
  }

  .metrics-section {
    grid-template-columns: 1fr;
  }

  .action-row {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }
}
</style>
