<template>
  <div class="health-score-widget">
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

      <div v-if="loading" class="loading">
        <el-skeleton :rows="2" animated />
      </div>

      <div v-else-if="!healthScore" class="empty-state">
        <el-empty description="暂无健康评分数据" :image-size="60" />
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
</template>

<script setup lang="ts">
import { DataAnalysis } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import type { HealthScoreResult } from '../../types'

interface Props {
  healthScore: HealthScoreResult | null
  healthScoreLoading?: boolean
}

defineProps<Props>()

const router = useRouter()

function goToHealthScore() {
  router.push('/health-score')
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
</script>

<style scoped>
.health-score-widget {
  height: 100%;
}

.health-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.health-card :deep(.el-card__body) {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 16px;
}

.health-content {
  display: flex;
  gap: 32px;
  flex: 1;
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
  flex-shrink: 0;
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
  min-width: 200px;
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

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

@media (max-width: 768px) {
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
