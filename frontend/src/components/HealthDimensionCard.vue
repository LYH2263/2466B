<template>
  <div class="dimension-card" :class="scoreClass">
    <div class="card-header">
      <div class="dimension-info">
        <span class="dimension-icon" :style="{ backgroundColor: color }">
          <el-icon><TrendCharts /></el-icon>
        </span>
        <div class="dimension-text">
          <h3 class="dimension-title">{{ title }}</h3>
          <span class="dimension-weight">权重 {{ (weight * 100).toFixed(0) }}%</span>
        </div>
      </div>
      <div class="score-display">
        <span class="score-value" :style="{ color: scoreColor }">{{ score }}</span>
        <span class="score-max">/100</span>
      </div>
    </div>

    <div class="score-bar">
      <div
        class="score-progress"
        :style="{
          width: `${score}%`,
          backgroundColor: scoreColor,
        }"
      ></div>
    </div>

    <div class="score-level-badge" :style="{ backgroundColor: scoreColor }">
      {{ scoreLevel.label }}
    </div>

    <div class="suggestion-section">
      <div class="suggestion-icon">
        <el-icon><QuestionFilled /></el-icon>
      </div>
      <p class="suggestion-text">{{ suggestion }}</p>
    </div>

    <div v-if="showDetails" class="detail-stats">
      <slot name="details"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { TrendCharts, QuestionFilled } from '@element-plus/icons-vue'
import { getScoreLevel, HEALTH_DIMENSION_COLORS } from '../types'

const props = withDefaults(
  defineProps<{
    dimension: string
    score: number
    weight: number
    suggestion: string
    showDetails?: boolean
  }>(),
  {
    showDetails: false,
  }
)

const title = computed(
  () =>
    ({
      emergencyReserve: '应急储备充足度',
      assetAllocation: '资产配置合理度',
      growthStability: '增长稳定性',
      inventoryTimeliness: '盘点及时性',
    }[props.dimension] || props.dimension)
)

const color = computed(
  () => HEALTH_DIMENSION_COLORS[props.dimension] || '#409eff'
)

const scoreLevel = computed(() => getScoreLevel(props.score))

const scoreColor = computed(() => scoreLevel.value.color)

const scoreClass = computed(() => {
  if (props.score >= 90) return 'score-excellent'
  if (props.score >= 80) return 'score-good'
  if (props.score >= 70) return 'score-medium'
  if (props.score >= 60) return 'score-pass'
  return 'score-poor'
})
</script>

<style scoped>
.dimension-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  transition: transform 0.2s, box-shadow 0.2s;
}

.dimension-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.dimension-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.dimension-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.dimension-icon :deep(.el-icon) {
  font-size: 20px;
}

.dimension-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dimension-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin: 0;
}

.dimension-weight {
  font-size: 12px;
  color: #999;
}

.score-display {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.score-value {
  font-size: 32px;
  font-weight: bold;
  line-height: 1;
}

.score-max {
  font-size: 14px;
  color: #999;
}

.score-bar {
  height: 8px;
  background: #f0f0f0;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 12px;
}

.score-progress {
  height: 100%;
  border-radius: 4px;
  transition: width 0.5s ease;
}

.score-level-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  color: white;
  font-size: 12px;
  font-weight: 500;
  margin-bottom: 16px;
}

.suggestion-section {
  display: flex;
  gap: 10px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
  border-left: 3px solid #409eff;
}

.suggestion-icon {
  color: #409eff;
  font-size: 16px;
  flex-shrink: 0;
  margin-top: 2px;
}

.suggestion-text {
  margin: 0;
  font-size: 13px;
  color: #555;
  line-height: 1.6;
}

.detail-stats {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #eee;
}

.score-excellent {
  border-top: 3px solid #67c23a;
}

.score-good {
  border-top: 3px solid #95d475;
}

.score-medium {
  border-top: 3px solid #e6a23c;
}

.score-pass {
  border-top: 3px solid #f56c6c;
}

.score-poor {
  border-top: 3px solid #f56c6c;
}
</style>
