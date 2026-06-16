import { markRaw } from 'vue'
import type { WidgetType } from '../../types/dashboard'
import InventoryStatusCard from '../InventoryStatusCard.vue'
import AssetSummary from '../AssetSummary.vue'
import AssetChart from '../AssetChart.vue'
import AssetList from '../AssetList.vue'
import AssetForm from '../AssetForm.vue'
import PredictionPanel from '../PredictionPanel.vue'
import AllocationPieWidget from './AllocationPieWidget.vue'
import HealthScoreWidget from './HealthScoreWidget.vue'

export interface WidgetComponentProps {
  latestRecord?: any
  chartData?: any[]
  prediction?: any
  records?: any[]
  status?: any
  plan?: any
  loading?: boolean
  healthScore?: any
  healthScoreLoading?: boolean
  [key: string]: any
}

export interface WidgetComponentEntry {
  component: any
  getProps: (sharedProps: WidgetComponentProps) => Record<string, any>
  getEvents?: (sharedProps: WidgetComponentProps) => Record<string, any>
  hasCustomCard?: boolean
}

export const WIDGET_COMPONENTS: Record<WidgetType, WidgetComponentEntry> = {
  'inventory-status': {
    component: markRaw(InventoryStatusCard),
    getProps: (p) => ({
      status: p.status,
      plan: p.plan,
      loading: p.loading,
    }),
    getEvents: (p) => ({
      edit: p.goToInventoryPlan,
      refresh: p.fetchInventoryPlan,
      'sync-last': p.handleSyncLastInventory,
    }),
    hasCustomCard: true,
  },
  'health-score': {
    component: markRaw(HealthScoreWidget),
    getProps: (p) => ({
      healthScore: p.healthScore,
      healthScoreLoading: p.healthScoreLoading,
    }),
  },
  'summary': {
    component: markRaw(AssetSummary),
    getProps: (p) => ({
      latestRecord: p.latestRecord,
    }),
    hasCustomCard: true,
  },
  'trend-chart': {
    component: markRaw(AssetChart),
    getProps: (p) => ({
      chartData: p.chartData,
      prediction: p.prediction,
    }),
    hasCustomCard: true,
  },
  'allocation-pie': {
    component: markRaw(AllocationPieWidget),
    getProps: (p) => ({
      latestRecord: p.latestRecord,
    }),
  },
  'prediction': {
    component: markRaw(PredictionPanel),
    getProps: (p) => ({
      params: p.predictionParams,
      result: p.prediction,
      loading: p.predictionLoading,
      error: p.predictionError,
      chartData: p.chartData,
      refresh: p.refreshPrediction,
      onChangeAlgorithm: p.changeAlgorithm,
      onChangeMonths: p.changeMonths,
      onChangeTarget: p.changeTarget,
    }),
    hasCustomCard: true,
  },
  'history-list': {
    component: markRaw(AssetList),
    getProps: (p) => ({
      records: p.records,
    }),
    getEvents: (p) => ({
      delete: p.handleDelete,
      'fill-demo': p.fillDemo,
    }),
    hasCustomCard: true,
  },
  'asset-form': {
    component: markRaw(AssetForm),
    getProps: () => ({}),
    getEvents: (p) => ({
      submit: p.submitForm,
      'fill-demo': p.fillDemo,
    }),
    hasCustomCard: true,
  },
}
