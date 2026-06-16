<template>
  <div class="asset-chart">
    <el-card class="chart-card">
      <template #header>
        <div class="card-header">
          <span>资产趋势图</span>
          <el-tag v-if="prediction?.canPredict" type="success" effect="light" size="small">
            {{ algorithmLabel }} · 预测 {{ prediction?.predictions?.length || 0 }} 个月
          </el-tag>
        </div>
      </template>

      <div v-if="chartData.length === 0" class="empty-state">
        <el-empty description="暂无数据，请先添加资产记录或填充示例数据">
          <el-button type="primary" @click="$emit('fill-demo')">填充示例数据</el-button>
        </el-empty>
      </div>

      <v-chart
        v-else
        class="chart"
        :option="chartOption"
        autoresize
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DataZoomComponent
} from 'echarts/components'
import VChart from 'vue-echarts'
import type { AssetRecord, PredictionResult, PredictionAlgorithm } from '../types'

use([
  CanvasRenderer,
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DataZoomComponent
])

interface Props {
  chartData: AssetRecord[]
  prediction?: PredictionResult | null
}

const props = defineProps<Props>()

defineEmits<{
  'fill-demo': []
}>()

const algorithmLabelMap: Record<PredictionAlgorithm, string> = {
  linear: '线性回归',
  movingAverage: '移动平均',
  exponentialSmoothing: '指数平滑',
}

const algorithmLabel = computed(() => {
  if (!props.prediction) return ''
  return algorithmLabelMap[props.prediction.algorithm] || props.prediction.algorithm
})

const chartOption = computed(() => {
  const historyDates = props.chartData.map(r => {
    const d = new Date(r.date)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const cashData = props.chartData.map(r => r.cash)
  const investData = props.chartData.map(r => r.longTermInvest)
  const bondData = props.chartData.map(r => r.stableBond)
  const totalData = props.chartData.map(r => r.total)

  const pred = props.prediction
  const hasPrediction = !!(pred && pred.canPredict && pred.predictions && pred.predictions.length > 0)

  let allDates: string[] = [...historyDates]
  let predictedDates: string[] = []
  let predictedValues: (number | null)[] = []
  let lowerBand: (number | null)[] = []
  let upperBand: (number | null)[] = []

  if (hasPrediction) {
    const lastHistoryTotal = totalData[totalData.length - 1]
    predictedDates = pred!.predictions.map(p => p.date)
    allDates = [...historyDates, ...predictedDates]

    const gapLen = historyDates.length
    predictedValues = new Array(gapLen - 1).fill(null) as (number | null)[]
    predictedValues.push(lastHistoryTotal)
    pred!.predictions.forEach(p => predictedValues.push(p.value))

    lowerBand = new Array(gapLen - 1).fill(null) as (number | null)[]
    lowerBand.push(lastHistoryTotal)
    pred!.predictions.forEach(p => lowerBand.push(p.lower))

    upperBand = new Array(gapLen - 1).fill(null) as (number | null)[]
    upperBand.push(lastHistoryTotal)
    pred!.predictions.forEach(p => upperBand.push(p.upper))
  }

  const legendData = ['活钱', '长期投资', '稳定债券', '总资产']
  if (hasPrediction) {
    legendData.push('预测趋势', '预测置信带')
  }

  const series: any[] = [
    {
      name: '活钱',
      type: 'line',
      smooth: true,
      data: cashData,
      itemStyle: { color: '#67c23a' },
      lineStyle: { width: 2, opacity: 0.7 },
      symbol: 'circle',
      symbolSize: 5,
    },
    {
      name: '长期投资',
      type: 'line',
      smooth: true,
      data: investData,
      itemStyle: { color: '#e6a23c' },
      lineStyle: { width: 2, opacity: 0.7 },
      symbol: 'circle',
      symbolSize: 5,
    },
    {
      name: '稳定债券',
      type: 'line',
      smooth: true,
      data: bondData,
      itemStyle: { color: '#409eff' },
      lineStyle: { width: 2, opacity: 0.7 },
      symbol: 'circle',
      symbolSize: 5,
    },
    {
      name: '总资产',
      type: 'line',
      smooth: true,
      data: totalData,
      itemStyle: { color: '#f56c6c' },
      lineStyle: { width: 4 },
      symbol: 'circle',
      symbolSize: 8,
      z: 10,
    },
  ]

  if (hasPrediction) {
    series.push({
      name: '预测置信带',
      type: 'line',
      data: upperBand,
      lineStyle: { opacity: 0 },
      stack: 'confidence-band-upper',
      symbol: 'none',
      silent: true,
    })
    series.push({
      name: '预测置信带',
      type: 'line',
      data: lowerBand.map((v, i) => {
        if (v === null || upperBand[i] === null) return null
        return Number((upperBand[i]! - v).toFixed(2))
      }),
      lineStyle: { opacity: 0 },
      areaStyle: {
        color: 'rgba(245, 108, 108, 0.15)',
      },
      stack: 'confidence-band-upper',
      symbol: 'none',
      silent: true,
      legendHoverLink: false,
    })
    series.push({
      name: '预测趋势',
      type: 'line',
      smooth: true,
      data: predictedValues,
      itemStyle: { color: '#909399' },
      lineStyle: {
        width: 3,
        type: 'dashed',
        color: '#f56c6c',
      },
      symbol: 'diamond',
      symbolSize: 8,
      connectNulls: false,
      z: 20,
    })
  }

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
      },
      formatter: (params: any[]) => {
        if (!params || params.length === 0) return ''
        const dateVal = params[0].axisValue
        let html = `<div style="font-weight:600;margin-bottom:8px;">${dateVal}</div>`

        const filtered = params.filter((p: any) => {
          if (p.value === null || p.value === undefined || p.value === '') return false
          if (p.seriesName === '预测置信带') return false
          return true
        })

        filtered.forEach((p: any) => {
          const value = typeof p.value === 'number' ? p.value.toLocaleString() : p.value
          html += `<div style="display:flex;align-items:center;gap:8px;margin:4px 0;">
            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color}"></span>
            <span style="flex:1;">${p.seriesName}</span>
            <span style="font-weight:600;">¥${value}</span>
          </div>`
        })

        if (hasPrediction && predictedDates.includes(dateVal)) {
          const predPoint = pred!.predictions.find(p => p.date === dateVal)
          if (predPoint) {
            html += `<div style="margin-top:8px;padding-top:8px;border-top:1px dashed #eee;color:#909399;font-size:12px;">
              <div>95% 置信区间:</div>
              <div style="margin-left:8px;">下限: ¥${predPoint.lower.toLocaleString()}</div>
              <div style="margin-left:8px;">上限: ¥${predPoint.upper.toLocaleString()}</div>
            </div>`
          }
        }

        return html
      },
    },
    legend: {
      data: legendData,
      bottom: 0,
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '18%',
      top: '8%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: allDates,
      axisLabel: {
        rotate: 45,
      },
      ...(hasPrediction ? {
        axisPointer: {},
      } : {}),
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (value: number) => {
          if (value >= 100000000) {
            return (value / 100000000).toFixed(1) + '亿'
          }
          if (value >= 10000) {
            return (value / 10000).toFixed(0) + '万'
          }
          return value
        },
      },
      min: 0,
    },
    dataZoom: [
      {
        type: 'inside',
        start: 0,
        end: 100,
      },
      {
        type: 'slider',
        height: 20,
        bottom: 35,
        start: 0,
        end: 100,
      },
    ],
    series,
  }
})
</script>

<style scoped>
.asset-chart {
  margin-bottom: 20px;
}

.chart-card {
  min-height: 450px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 16px;
  font-weight: 600;
}

.chart {
  height: 450px;
}

.empty-state {
  height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
