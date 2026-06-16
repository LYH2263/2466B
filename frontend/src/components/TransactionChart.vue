<template>
  <div class="transaction-chart">
    <el-card class="chart-card">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <span>月度收支统计</span>
            <el-select v-model="chartType" style="margin-left: 12px; width: 140px" size="small">
              <el-option label="收支柱状图" value="bar" />
              <el-option label="净流入趋势图" value="line" />
              <el-option label="资产增长对照图" value="comparison" />
            </el-select>
          </div>
          <el-select v-model="monthCount" style="width: 120px" size="small" @change="handleMonthChange">
            <el-option label="近6个月" :value="6" />
            <el-option label="近12个月" :value="12" />
            <el-option label="近24个月" :value="24" />
          </el-select>
        </div>
      </template>

      <div v-if="loading" class="loading-state">
        <el-skeleton :rows="5" animated />
      </div>

      <div v-else-if="!hasData" class="empty-state">
        <el-empty description="暂无数据，请先添加交易记录或填充示例数据">
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
import { ref, computed, watch } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, LineChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DataZoomComponent
} from 'echarts/components'
import VChart from 'vue-echarts'
import type { MonthlyStat, AssetComparison } from '../types'

use([
  CanvasRenderer,
  BarChart,
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DataZoomComponent
])

interface Props {
  monthlyStats: MonthlyStat[]
  assetComparison: AssetComparison[]
  loading: boolean
}

const props = defineProps<Props>()

defineEmits<{
  'fill-demo': []
  'month-change': [months: number]
}>()

const chartType = ref<'bar' | 'line' | 'comparison'>('bar')
const monthCount = ref(12)

const hasData = computed(() => {
  if (chartType.value === 'comparison') {
    return props.assetComparison.some(item => item.income > 0 || item.expense > 0 || item.assetGrowth !== null)
  }
  return props.monthlyStats.some(item => item.income > 0 || item.expense > 0)
})

const handleMonthChange = (val: number) => {
  emit('month-change', val)
}

const formatMoney = (value: number): string => {
  return '¥' + value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const barChartOption = computed(() => {
  const months = props.monthlyStats.map(s => s.month)
  const incomeData = props.monthlyStats.map(s => s.income)
  const expenseData = props.monthlyStats.map(s => s.expense)
  const netFlowData = props.monthlyStats.map(s => s.netFlow)

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      formatter: (params: any[]) => {
        let html = `<div style="font-weight:600;margin-bottom:8px;">${params[0].axisValue}</div>`
        params.forEach(p => {
          html += `<div style="display:flex;align-items:center;gap:8px;margin:4px 0;">
            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color}"></span>
            <span>${p.seriesName}: ${formatMoney(p.value)}</span>
          </div>`
        })
        return html
      }
    },
    legend: {
      data: ['收入', '支出', '净流入'],
      bottom: 0
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: '8%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: months,
      axisLabel: { rotate: 45 }
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (value: number) => {
          if (Math.abs(value) >= 10000) {
            return (value / 10000).toFixed(1) + '万'
          }
          return value
        }
      }
    },
    dataZoom: [
      { type: 'inside', start: 0, end: 100 }
    ],
    series: [
      {
        name: '收入',
        type: 'bar',
        data: incomeData,
        itemStyle: { color: '#67c23a', borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 40
      },
      {
        name: '支出',
        type: 'bar',
        data: expenseData,
        itemStyle: { color: '#f56c6c', borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 40
      },
      {
        name: '净流入',
        type: 'line',
        data: netFlowData,
        smooth: true,
        itemStyle: { color: '#409eff' },
        lineStyle: { width: 3 },
        symbol: 'circle',
        symbolSize: 8,
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(64, 158, 255, 0.3)' },
              { offset: 1, color: 'rgba(64, 158, 255, 0.05)' }
            ]
          }
        }
      }
    ]
  }
})

const lineChartOption = computed(() => {
  const months = props.monthlyStats.map(s => s.month)
  const netFlowData = props.monthlyStats.map(s => s.netFlow)

  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any[]) => {
        const p = params[0]
        return `<div style="font-weight:600;margin-bottom:5px;">${p.axisValue}</div>
          <div>净流入: ${formatMoney(p.value)}</div>`
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '12%',
      top: '8%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: months,
      axisLabel: { rotate: 45 }
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (value: number) => {
          if (Math.abs(value) >= 10000) {
            return (value / 10000).toFixed(1) + '万'
          }
          return value
        }
      }
    },
    series: [
      {
        name: '净流入',
        type: 'line',
        data: netFlowData,
        smooth: true,
        itemStyle: { color: '#409eff' },
        lineStyle: { width: 3 },
        symbol: 'circle',
        symbolSize: 8,
        markLine: {
          silent: true,
          data: [{ yAxis: 0, lineStyle: { color: '#909399', type: 'dashed' } }]
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(64, 158, 255, 0.4)' },
              { offset: 0.5, color: 'rgba(64, 158, 255, 0.1)' },
              { offset: 1, color: 'rgba(245, 108, 108, 0.1)' },
              { offset: 1, color: 'rgba(245, 108, 108, 0.4)' }
            ]
          }
        }
      }
    ]
  }
})

const comparisonChartOption = computed(() => {
  const months = props.assetComparison.map(s => s.month)
  const netFlowData = props.assetComparison.map(s => s.netFlow)
  const assetGrowthData = props.assetComparison.map(s => s.assetGrowth)

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      formatter: (params: any[]) => {
        let html = `<div style="font-weight:600;margin-bottom:8px;">${params[0].axisValue}</div>`
        params.forEach(p => {
          if (p.value !== null && p.value !== undefined) {
            html += `<div style="display:flex;align-items:center;gap:8px;margin:4px 0;">
              <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color}"></span>
              <span>${p.seriesName}: ${formatMoney(p.value)}</span>
            </div>`
          }
        })
        return html
      }
    },
    legend: {
      data: ['交易净流入', '资产增长'],
      bottom: 0
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: '8%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: months,
      axisLabel: { rotate: 45 }
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (value: number) => {
          if (Math.abs(value) >= 10000) {
            return (value / 10000).toFixed(1) + '万'
          }
          return value
        }
      }
    },
    dataZoom: [{ type: 'inside', start: 0, end: 100 }],
    series: [
      {
        name: '交易净流入',
        type: 'bar',
        data: netFlowData,
        itemStyle: {
          color: (params: any) => params.value >= 0 ? '#67c23a' : '#f56c6c',
          borderRadius: [4, 4, 0, 0]
        },
        barMaxWidth: 30
      },
      {
        name: '资产增长',
        type: 'line',
        data: assetGrowthData,
        smooth: true,
        itemStyle: { color: '#722ed1' },
        lineStyle: { width: 3 },
        symbol: 'diamond',
        symbolSize: 10,
        connectNulls: true,
        markLine: {
          silent: true,
          data: [{ yAxis: 0, lineStyle: { color: '#909399', type: 'dashed' } }]
        }
      }
    ]
  }
})

const chartOption = computed(() => {
  if (chartType.value === 'bar') return barChartOption.value
  if (chartType.value === 'line') return lineChartOption.value
  return comparisonChartOption.value
})
</script>

<style scoped>
.transaction-chart {
  margin-bottom: 20px;
}

.chart-card {
  min-height: 440px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 16px;
  font-weight: 600;
}

.header-left {
  display: flex;
  align-items: center;
}

.chart {
  height: 400px;
}

.empty-state,
.loading-state {
  height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
