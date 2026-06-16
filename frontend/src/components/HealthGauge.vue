<template>
  <div class="health-gauge-container">
    <div ref="chartRef" class="gauge-chart"></div>
    <div v-if="showDetails" class="gauge-details">
      <div class="score-level" :style="{ color: scoreLevel.color }">
        {{ scoreLevel.label }}
      </div>
      <div class="score-description">{{ scoreLevel.description }}</div>
      <div v-if="calculatedAt" class="calculated-at">
        计算时间：{{ formatDate(calculatedAt) }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import * as echarts from 'echarts'
import { getScoreLevel } from '../types'

const props = withDefaults(
  defineProps<{
    score: number
    calculatedAt?: string
    showDetails?: boolean
    height?: string
  }>(),
  {
    showDetails: true,
    height: '300px',
    calculatedAt: '',
  }
)

const chartRef = ref<HTMLElement | null>(null)
let chartInstance: echarts.ECharts | null = null

const scoreLevel = computed(() => getScoreLevel(props.score))

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

function initChart() {
  if (!chartRef.value) return

  chartInstance = echarts.init(chartRef.value)
  updateChart()
}

function updateChart() {
  if (!chartInstance) return

  const option = {
    series: [
      {
        type: 'gauge',
        startAngle: 200,
        endAngle: -20,
        min: 0,
        max: 100,
        splitNumber: 10,
        itemStyle: {
          color: scoreLevel.value.color,
        },
        progress: {
          show: true,
          width: 24,
        },
        pointer: {
          show: false,
        },
        axisLine: {
          lineStyle: {
            width: 24,
            color: [
              [0.6, '#f56c6c'],
              [0.8, '#e6a23c'],
              [1, '#67c23a'],
            ],
          },
        },
        axisTick: {
          distance: -36,
          splitNumber: 5,
          lineStyle: {
            width: 2,
            color: '#999',
          },
        },
        splitLine: {
          distance: -40,
          length: 10,
          lineStyle: {
            width: 3,
            color: '#999',
          },
        },
        axisLabel: {
          distance: -20,
          color: '#999',
          fontSize: 12,
        },
        anchor: {
          show: false,
        },
        title: {
          show: false,
        },
        detail: {
          valueAnimation: true,
          width: '60%',
          lineHeight: 40,
          borderRadius: 8,
          offsetCenter: [0, '-5%'],
          fontSize: 48,
          fontWeight: 'bold',
          formatter: '{value}',
          color: scoreLevel.value.color,
        },
        data: [
          {
            value: props.score,
          },
        ],
      },
      {
        type: 'gauge',
        startAngle: 200,
        endAngle: -20,
        min: 0,
        max: 100,
        itemStyle: {
          color: '#e6e6e6',
        },
        progress: {
          show: false,
        },
        pointer: {
          show: false,
        },
        axisLine: {
          show: false,
        },
        axisTick: {
          show: false,
        },
        splitLine: {
          show: false,
        },
        axisLabel: {
          show: false,
        },
        detail: {
          show: false,
        },
      },
    ],
  }

  chartInstance.setOption(option)
}

function handleResize() {
  chartInstance?.resize()
}

watch(
  () => props.score,
  () => {
    updateChart()
  }
)

onMounted(() => {
  initChart()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  chartInstance?.dispose()
})
</script>

<style scoped>
.health-gauge-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}

.gauge-chart {
  width: 100%;
}

.gauge-details {
  text-align: center;
  margin-top: -20px;
}

.score-level {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 8px;
}

.score-description {
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
}

.calculated-at {
  font-size: 12px;
  color: #999;
}
</style>
