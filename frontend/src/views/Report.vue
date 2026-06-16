<template>
  <div class="app-container">
    <header class="app-header">
      <div class="header-content">
        <div class="logo" @click="goHome" style="cursor: pointer">
          <WalletFilled style="font-size: 32px; color: #409eff;" />
          <div class="title">
            <h1>资产报告</h1>
            <p>个人资产报告生成与导出</p>
          </div>
        </div>
        <div class="header-actions">
          <el-button
            :icon="ArrowLeft"
            @click="goHome"
          >
            返回首页
          </el-button>
        </div>
      </div>
    </header>

    <main class="main-content">
      <div class="report-toolbar">
        <div class="period-selector">
          <el-radio-group v-model="selectedPeriod" size="large">
            <el-radio-button value="monthly">月报</el-radio-button>
            <el-radio-button value="yearly">年报</el-radio-button>
          </el-radio-group>

          <el-select
            v-model="selectedYear"
            placeholder="选择年份"
            size="large"
            style="width: 140px; margin-left: 16px"
            @change="handleYearChange"
          >
            <el-option
              v-for="year in availableYears"
              :key="year"
              :label="`${year}年`"
              :value="year"
            />
          </el-select>

          <el-select
            v-if="selectedPeriod === 'monthly'"
            v-model="selectedMonth"
            placeholder="选择月份"
            size="large"
            style="width: 120px; margin-left: 16px"
            @change="handleMonthChange"
          >
            <el-option
              v-for="month in 12"
              :key="month"
              :label="`${month}月`"
              :value="month"
            />
          </el-select>

          <el-button
            type="primary"
            size="large"
            :icon="DataLine"
            :loading="loading"
            @click="handleGenerate"
            style="margin-left: 16px"
          >
            生成报告
          </el-button>

          <el-button
            v-if="reportData && reportData.hasData"
            type="success"
            size="large"
            :icon="Download"
            :loading="exportingPdf"
            @click="handleExportPdf"
            style="margin-left: 12px"
          >
            导出 PDF
          </el-button>
        </div>
      </div>

      <div v-if="loading" class="loading-state">
        <el-skeleton :rows="15" animated />
      </div>

      <div v-else-if="error" class="error-state">
        <el-alert
          :title="error"
          type="error"
          :closable="false"
          show-icon
        >
          <template #default>
            <el-button @click="handleGenerate" style="margin-top: 16px">重试</el-button>
          </template>
        </el-alert>
      </div>

      <div v-else-if="!reportData" class="empty-state">
        <el-empty description="请选择周期并点击生成报告" />
      </div>

      <div v-else-if="!reportData.hasData" class="empty-state">
        <el-empty :description="reportData.message || '该周期暂无数据'" />
      </div>

      <div v-else id="report-content" class="report-content">
        <div class="report-title-section">
          <h1 class="report-title">资产{{ reportData.periodLabel }}报告</h1>
          <p class="report-subtitle">生成时间：{{ currentDateStr }}</p>
        </div>

        <div class="report-section">
          <h2 class="section-title">一、报告摘要</h2>
          <div class="summary-text">
            {{ reportData.summary?.text }}
          </div>
          <el-row :gutter="16" class="summary-cards">
            <el-col :xs="12" :sm="6">
              <div class="summary-card">
                <div class="summary-label">期初资产</div>
                <div class="summary-value">{{ formatMoney(reportData.summary?.startAsset || 0) }}</div>
              </div>
            </el-col>
            <el-col :xs="12" :sm="6">
              <div class="summary-card">
                <div class="summary-label">期末资产</div>
                <div class="summary-value">{{ formatMoney(reportData.summary?.endAsset || 0) }}</div>
              </div>
            </el-col>
            <el-col :xs="12" :sm="6">
              <div class="summary-card">
                <div class="summary-label">净增长</div>
                <div class="summary-value" :class="{ positive: (reportData.summary?.netGrowth || 0) >= 0, negative: (reportData.summary?.netGrowth || 0) < 0 }">
                  {{ (reportData.summary?.netGrowth || 0) >= 0 ? '+' : '' }}{{ formatMoney(reportData.summary?.netGrowth || 0) }}
                </div>
              </div>
            </el-col>
            <el-col :xs="12" :sm="6">
              <div class="summary-card">
                <div class="summary-label">收益率</div>
                <div class="summary-value" :class="{ positive: (reportData.summary?.returnRate || 0) >= 0, negative: (reportData.summary?.returnRate || 0) < 0 }">
                  {{ (reportData.summary?.returnRate || 0) >= 0 ? '+' : '' }}{{ formatPercent(reportData.summary?.returnRate || 0) }}
                </div>
              </div>
            </el-col>
          </el-row>
        </div>

        <div class="report-section page-break-before">
          <h2 class="section-title">二、各类别资产变化</h2>
          <el-table :data="reportData.categoryChanges" border style="width: 100%" size="default">
            <el-table-column prop="categoryName" label="资产类别" width="140" />
            <el-table-column label="期初金额">
              <template #default="{ row }">
                {{ formatMoney(row.start) }}
              </template>
            </el-table-column>
            <el-table-column label="期末金额">
              <template #default="{ row }">
                {{ formatMoney(row.end) }}
              </template>
            </el-table-column>
            <el-table-column label="变化金额">
              <template #default="{ row }">
                <span :class="{ positive: row.change >= 0, negative: row.change < 0 }">
                  {{ row.change >= 0 ? '+' : '' }}{{ formatMoney(row.change) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="变化率">
              <template #default="{ row }">
                <span :class="{ positive: row.changePercent >= 0, negative: row.changePercent < 0 }">
                  {{ row.changePercent >= 0 ? '+' : '' }}{{ formatPercent(row.changePercent) }}
                </span>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div class="report-section">
          <h2 class="section-title">三、期末资产配置</h2>
          <el-row :gutter="16">
            <el-col :xs="24" :md="12">
              <div class="chart-container" ref="allocationChartRef">
                <v-chart :option="allocationOption" autoresize style="height: 320px" />
              </div>
            </el-col>
            <el-col :xs="24" :md="12">
              <el-table :data="reportData.allocation" border style="width: 100%" size="default">
                <el-table-column prop="categoryName" label="资产类别" width="140" />
                <el-table-column label="金额">
                  <template #default="{ row }">
                    {{ formatMoney(row.value) }}
                  </template>
                </el-table-column>
                <el-table-column label="占比">
                  <template #default="{ row }">
                    {{ formatPercent(row.percent) }}
                  </template>
                </el-table-column>
              </el-table>
            </el-col>
          </el-row>
        </div>

        <div class="report-section page-break-before">
          <h2 class="section-title">四、资产走势</h2>
          <div class="chart-container" ref="trendChartRef">
            <v-chart :option="trendOption" autoresize style="height: 360px" />
          </div>
        </div>

        <div class="report-section" v-if="reportData.transactions">
          <h2 class="section-title">五、交易汇总</h2>
          <el-row :gutter="16" class="tx-summary-cards">
            <el-col :xs="12" :sm="6">
              <div class="summary-card tx-income">
                <div class="summary-label">收入</div>
                <div class="summary-value">{{ formatMoney(reportData.transactions.summary.income) }}</div>
              </div>
            </el-col>
            <el-col :xs="12" :sm="6">
              <div class="summary-card tx-expense">
                <div class="summary-label">支出</div>
                <div class="summary-value">{{ formatMoney(reportData.transactions.summary.expense) }}</div>
              </div>
            </el-col>
            <el-col :xs="12" :sm="6">
              <div class="summary-card">
                <div class="summary-label">净流入</div>
                <div class="summary-value" :class="{ positive: reportData.transactions.summary.netFlow >= 0, negative: reportData.transactions.summary.netFlow < 0 }">
                  {{ reportData.transactions.summary.netFlow >= 0 ? '+' : '' }}{{ formatMoney(reportData.transactions.summary.netFlow) }}
                </div>
              </div>
            </el-col>
            <el-col :xs="12" :sm="6">
              <div class="summary-card">
                <div class="summary-label">交易笔数</div>
                <div class="summary-value">{{ reportData.transactions.summary.count }} 笔</div>
              </div>
            </el-col>
          </el-row>

          <div v-if="reportData.transactions.recent.length > 0" style="margin-top: 20px">
            <h3 class="sub-title">最近交易明细</h3>
            <el-table :data="reportData.transactions.recent" border style="width: 100%" size="default">
              <el-table-column prop="date" label="日期" width="120" />
              <el-table-column label="类型" width="100">
                <template #default="{ row }">
                  <el-tag v-if="row.direction === 'INCOME'" type="success">收入</el-tag>
                  <el-tag v-else-if="row.direction === 'EXPENSE'" type="danger">支出</el-tag>
                  <el-tag v-else type="info">转账</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="类别" width="120">
                <template #default="{ row }">
                  {{ getCategoryName(row.category) }}
                </template>
              </el-table-column>
              <el-table-column prop="counterparty" label="对手方/分类" min-width="140" show-overflow-tooltip />
              <el-table-column label="金额" width="140" align="right">
                <template #default="{ row }">
                  <span :class="{ positive: row.direction === 'INCOME', negative: row.direction === 'EXPENSE' }">
                    {{ row.direction === 'INCOME' ? '+' : row.direction === 'EXPENSE' ? '-' : '' }}{{ formatMoney(row.amount) }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column prop="note" label="备注" min-width="160" show-overflow-tooltip />
            </el-table>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  WalletFilled,
  ArrowLeft,
  DataLine,
  Download
} from '@element-plus/icons-vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { PieChart, LineChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent
} from 'echarts/components'
import { useReports } from '../composables/useReports'
import type { ReportPeriod, AssetCategory } from '../types'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'

use([
  CanvasRenderer,
  PieChart,
  LineChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent
])

const router = useRouter()
const {
  reportData,
  availablePeriods,
  loading,
  error,
  exportingPdf,
  fetchAvailablePeriods,
  generateReport,
  formatMoney,
  formatPercent,
  getExportFileName
} = useReports()

const selectedPeriod = ref<ReportPeriod>('monthly')
const selectedYear = ref<number | null>(null)
const selectedMonth = ref<number | null>(null)
const trendChartRef = ref<any>(null)
const allocationChartRef = ref<any>(null)

const currentDateStr = computed(() => {
  return new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
})

const availableYears = computed(() => {
  if (availablePeriods.value?.years?.length) {
    return availablePeriods.value.years
  }
  const now = new Date()
  return [now.getFullYear(), now.getFullYear() - 1]
})

const allocationOption = computed(() => {
  if (!reportData.value?.allocation) return {}
  const data = reportData.value.allocation.map((item) => ({
    name: item.categoryName,
    value: item.value
  }))
  return {
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        return `${params.name}: ${formatMoney(params.value)} (${params.percent}%)`
      }
    },
    legend: {
      orient: 'vertical',
      left: 'left'
    },
    series: [
      {
        name: '资产配置',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 6,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: true,
          formatter: '{b}\n{d}%'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold'
          }
        },
        data,
        color: ['#67C23A', '#409EFF', '#E6A23C']
      }
    ]
  }
})

const trendOption = computed(() => {
  if (!reportData.value?.timeline?.length) return {}
  const dates = reportData.value.timeline.map((t) => t.date)
  const cash = reportData.value.timeline.map((t) => t.cash)
  const longTerm = reportData.value.timeline.map((t) => t.longTermInvest)
  const bond = reportData.value.timeline.map((t) => t.stableBond)
  const total = reportData.value.timeline.map((t) => t.total)

  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any[]) => {
        let result = params[0].axisValue + '<br/>'
        for (const p of params) {
          result += `${p.marker} ${p.seriesName}: ${formatMoney(p.value)}<br/>`
        }
        return result
      }
    },
    legend: {
      data: ['总资产', '活钱', '长期投资', '稳定债券']
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: dates
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (value: number) => {
          if (value >= 10000) {
            return (value / 10000).toFixed(0) + '万'
          }
          return value.toString()
        }
      }
    },
    series: [
      {
        name: '总资产',
        type: 'line',
        smooth: true,
        data: total,
        lineStyle: { width: 3 },
        itemStyle: { color: '#667eea' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(102, 126, 234, 0.3)' },
              { offset: 1, color: 'rgba(102, 126, 234, 0.02)' }
            ]
          }
        }
      },
      {
        name: '活钱',
        type: 'line',
        smooth: true,
        data: cash,
        itemStyle: { color: '#67C23A' }
      },
      {
        name: '长期投资',
        type: 'line',
        smooth: true,
        data: longTerm,
        itemStyle: { color: '#409EFF' }
      },
      {
        name: '稳定债券',
        type: 'line',
        smooth: true,
        data: bond,
        itemStyle: { color: '#E6A23C' }
      }
    ]
  }
})

const getCategoryName = (category: AssetCategory): string => {
  const map: Record<AssetCategory, string> = {
    CASH: '活钱',
    LONG_TERM_INVEST: '长期投资',
    STABLE_BOND: '稳定债券'
  }
  return map[category] || category
}

const goHome = () => {
  router.push('/')
}

const handleYearChange = () => {
  if (selectedPeriod.value === 'monthly') {
    const available = availablePeriods.value?.monthly || []
    const monthAvailable = available.find((m) => m.year === selectedYear.value)
    if (!monthAvailable && available.length > 0) {
      const latest = available[0]
      selectedYear.value = latest.year
      selectedMonth.value = latest.month
    }
  }
}

const handleMonthChange = () => {
}

const handleGenerate = async () => {
  if (!selectedYear.value) {
    ElMessage.warning('请选择年份')
    return
  }
  if (selectedPeriod.value === 'monthly' && !selectedMonth.value) {
    ElMessage.warning('请选择月份')
    return
  }

  await generateReport({
    period: selectedPeriod.value,
    year: selectedYear.value,
    month: selectedPeriod.value === 'monthly' ? selectedMonth.value || undefined : undefined
  })
}

const waitForCharts = async (): Promise<void> => {
  return new Promise((resolve) => {
    const check = () => {
      const allocationEl = allocationChartRef.value?.$el?.querySelector('canvas')
      const trendEl = trendChartRef.value?.$el?.querySelector('canvas')
      if (allocationEl && trendEl) {
        setTimeout(resolve, 300)
      } else {
        setTimeout(check, 100)
      }
    }
    nextTick(() => {
      setTimeout(check, 200)
    })
  })
}

const handleExportPdf = async () => {
  if (!reportData.value || !reportData.value.hasData) {
    ElMessage.warning('暂无报告数据可导出')
    return
  }

  exportingPdf.value = true
  try {
    await waitForCharts()
    await nextTick()

    const element = document.getElementById('report-content')
    if (!element) {
      throw new Error('报告内容元素未找到')
    }

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false
    })

    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF('p', 'mm', 'a4')
    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = pdf.internal.pageSize.getHeight()
    const imgWidth = pdfWidth
    const imgHeight = (canvas.height * imgWidth) / canvas.width

    let heightLeft = imgHeight
    let position = 0

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
    heightLeft -= pdfHeight

    while (heightLeft > 0) {
      position = heightLeft - imgHeight
      pdf.addPage()
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pdfHeight
    }

    const fileName = getExportFileName(reportData.value)
    pdf.save(fileName)
    ElMessage.success('PDF 导出成功')
  } catch (err: any) {
    console.error('PDF export error:', err)
    ElMessage.error(err.message || 'PDF 导出失败')
  } finally {
    exportingPdf.value = false
  }
}

const initDefaultSelection = () => {
  if (availablePeriods.value?.monthly?.length) {
    const latest = availablePeriods.value.monthly[0]
    selectedYear.value = latest.year
    selectedMonth.value = latest.month
  } else if (availablePeriods.value?.years?.length) {
    selectedYear.value = availablePeriods.value.years[0]
    selectedMonth.value = 1
  } else {
    const now = new Date()
    selectedYear.value = now.getFullYear()
    selectedMonth.value = now.getMonth() + 1
  }
}

watch(selectedPeriod, (newPeriod) => {
  if (newPeriod === 'yearly') {
    selectedMonth.value = null
  } else if (newPeriod === 'monthly' && !selectedMonth.value) {
    const available = availablePeriods.value?.monthly || []
    const monthInYear = available.find((m) => m.year === selectedYear.value)
    if (monthInYear) {
      selectedMonth.value = monthInYear.month
    } else {
      selectedMonth.value = 1
    }
  }
})

onMounted(async () => {
  await fetchAvailablePeriods()
  initDefaultSelection()
})
</script>

<style scoped>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
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

.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.main-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px 20px;
}

.report-toolbar {
  background: #fff;
  padding: 20px;
  border-radius: 12px;
  margin-bottom: 24px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.period-selector {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.loading-state,
.error-state,
.empty-state {
  padding: 60px 0;
}

.report-content {
  background: #fff;
  padding: 40px 48px;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.report-title-section {
  text-align: center;
  padding-bottom: 24px;
  border-bottom: 2px solid #667eea;
  margin-bottom: 32px;
}

.report-title {
  font-size: 28px;
  font-weight: 700;
  color: #303133;
  margin-bottom: 8px;
}

.report-subtitle {
  font-size: 14px;
  color: #909399;
}

.report-section {
  margin-bottom: 36px;
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 16px;
  padding-left: 12px;
  border-left: 4px solid #667eea;
}

.sub-title {
  font-size: 15px;
  font-weight: 600;
  color: #606266;
  margin-bottom: 12px;
}

.summary-text {
  background: linear-gradient(135deg, #f0f4ff 0%, #faf5ff 100%);
  padding: 16px 20px;
  border-radius: 8px;
  font-size: 15px;
  line-height: 1.8;
  color: #606266;
  margin-bottom: 20px;
  border-left: 3px solid #667eea;
}

.summary-cards {
  margin-top: 8px;
}

.summary-card {
  background: #fafbfc;
  padding: 16px;
  border-radius: 8px;
  text-align: center;
  border: 1px solid #ebeef5;
  margin-bottom: 16px;
}

.summary-label {
  font-size: 13px;
  color: #909399;
  margin-bottom: 6px;
}

.summary-value {
  font-size: 20px;
  font-weight: 700;
  color: #303133;
  font-family: 'Helvetica Neue', Arial, sans-serif;
}

.summary-value.positive {
  color: #67C23A;
}

.summary-value.negative {
  color: #F56C6C;
}

.tx-income .summary-value {
  color: #67C23A;
}

.tx-expense .summary-value {
  color: #F56C6C;
}

.chart-container {
  background: #fafbfc;
  border-radius: 8px;
  padding: 16px;
  border: 1px solid #ebeef5;
}

.tx-summary-cards {
  margin-top: 8px;
}

.positive {
  color: #67C23A;
  font-weight: 600;
}

.negative {
  color: #F56C6C;
  font-weight: 600;
}

@media print {
  .app-header,
  .report-toolbar {
    display: none !important;
  }
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

  .main-content {
    padding: 16px 12px;
  }

  .report-content {
    padding: 20px 16px;
  }

  .report-title {
    font-size: 22px;
  }

  .period-selector {
    justify-content: center;
  }
}

@media (max-width: 768px) {
  :deep(.page-break-before) {
    page-break-before: auto;
  }
}

:deep(.page-break-before) {
  page-break-before: always;
}
</style>
