<template>
  <div class="allocation-pie-widget">
    <el-card class="pie-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <el-icon :size="20" color="#9b59b6"><PieChart /></el-icon>
            <span>资产配置</span>
          </div>
        </div>
      </template>

      <div v-if="!latestRecord" class="empty-state">
        <el-empty description="暂无资产数据" :image-size="60" />
      </div>

      <v-chart
        v-else
        class="pie-chart"
        :option="chartOption"
        autoresize
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { PieChart } from '@element-plus/icons-vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { PieChart as EChartPie } from 'echarts/charts'
import {
  TooltipComponent,
  LegendComponent,
  TitleComponent,
} from 'echarts/components'
import VChart from 'vue-echarts'
import type { AssetRecord } from '../../types'

use([
  CanvasRenderer,
  EChartPie,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
])

interface Props {
  latestRecord: AssetRecord | null
}

const props = defineProps<Props>()

const chartOption = computed(() => {
  if (!props.latestRecord || props.latestRecord.total <= 0) {
    return {}
  }

  const data = [
    {
      name: '活钱',
      value: Number(props.latestRecord.cash),
      color: '#67c23a',
    },
    {
      name: '长期投资',
      value: Number(props.latestRecord.longTermInvest),
      color: '#e6a23c',
    },
    {
      name: '稳定债券',
      value: Number(props.latestRecord.stableBond),
      color: '#409eff',
    },
  ]

  return {
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        const percent = params.percent.toFixed(1)
        const value = Number(params.value).toLocaleString()
        return `<div style="padding: 4px 8px;">
          <div style="font-weight: 600; margin-bottom: 4px;">${params.name}</div>
          <div>金额: ¥${value}</div>
          <div>占比: ${percent}%</div>
        </div>`
      },
    },
    legend: {
      orient: 'vertical',
      right: '5%',
      top: 'center',
      itemGap: 16,
      textStyle: {
        fontSize: 13,
        color: '#606266',
      },
      formatter: (name: string) => {
        const item = data.find(d => d.name === name)
        if (!item) return name
        const percent = ((item.value / Number(props.latestRecord!.total)) * 100).toFixed(1)
        return `${name}  ${percent}%`
      },
    },
    series: [
      {
        name: '资产配置',
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 8,
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: {
          show: false,
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 16,
            fontWeight: 'bold',
          },
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.3)',
          },
        },
        labelLine: {
          show: false,
        },
        data: data.map(item => ({
          value: item.value,
          name: item.name,
          itemStyle: {
            color: item.color,
          },
        })),
      },
    ],
  }
})
</script>

<style scoped>
.allocation-pie-widget {
  height: 100%;
}

.pie-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.pie-card :deep(.el-card__body) {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 16px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 16px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pie-chart {
  flex: 1;
  min-height: 250px;
  width: 100%;
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
