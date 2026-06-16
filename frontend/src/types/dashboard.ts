export type WidgetType =
  | 'summary'
  | 'trend-chart'
  | 'allocation-pie'
  | 'history-list'
  | 'health-score'
  | 'prediction'
  | 'inventory-status'
  | 'asset-form'

export interface WidgetConfig {
  id: string
  type: WidgetType
  x: number
  y: number
  w: number
  h: number
  minW?: number
  minH?: number
  maxW?: number
  maxH?: number
  visible: boolean
  title?: string
  settings?: Record<string, any>
}

export interface DashboardLayoutData {
  version: number
  columns: number
  rowHeight: number
  gap: number
  widgets: WidgetConfig[]
  createdAt: string
  updatedAt: string
}

export interface DashboardLayoutResponse {
  id: string
  userId: string
  version: number
  layout: DashboardLayoutData
  createdAt: string
  updatedAt: string
}

export interface WidgetMeta {
  type: WidgetType
  title: string
  description: string
  icon: string
  defaultW: number
  defaultH: number
  minW?: number
  minH?: number
  maxW?: number
  maxH?: number
  defaultVisible: boolean
  defaultX?: number
  defaultY?: number
}

export const WIDGET_METAS: Record<WidgetType, WidgetMeta> = {
  'inventory-status': {
    type: 'inventory-status',
    title: '盘点状态',
    description: '显示下次盘点时间和状态提醒',
    icon: 'Calendar',
    defaultW: 12,
    defaultH: 2,
    minW: 6,
    minH: 2,
    defaultVisible: true,
    defaultX: 0,
    defaultY: 0,
  },
  'health-score': {
    type: 'health-score',
    title: '健康评分',
    description: '资产健康度综合评分概览',
    icon: 'DataAnalysis',
    defaultW: 12,
    defaultH: 4,
    minW: 6,
    minH: 3,
    defaultVisible: true,
    defaultX: 0,
    defaultY: 2,
  },
  'summary': {
    type: 'summary',
    title: '资产汇总',
    description: '各类资产金额和占比汇总卡片',
    icon: 'Wallet',
    defaultW: 12,
    defaultH: 3,
    minW: 6,
    minH: 2,
    defaultVisible: true,
    defaultX: 0,
    defaultY: 6,
  },
  'trend-chart': {
    type: 'trend-chart',
    title: '资产趋势图',
    description: '历史资产增长趋势折线图',
    icon: 'TrendCharts',
    defaultW: 8,
    defaultH: 6,
    minW: 6,
    minH: 4,
    defaultVisible: true,
    defaultX: 0,
    defaultY: 9,
  },
  'allocation-pie': {
    type: 'allocation-pie',
    title: '资产配置饼图',
    description: '各类资产占比分布饼图',
    icon: 'PieChart',
    defaultW: 4,
    defaultH: 6,
    minW: 4,
    minH: 4,
    defaultVisible: true,
    defaultX: 8,
    defaultY: 9,
  },
  'prediction': {
    type: 'prediction',
    title: '预测面板',
    description: '资产增长预测和目标达成分析',
    icon: 'MagicStick',
    defaultW: 6,
    defaultH: 5,
    minW: 4,
    minH: 4,
    defaultVisible: true,
    defaultX: 0,
    defaultY: 15,
  },
  'history-list': {
    type: 'history-list',
    title: '历史记录',
    description: '最近资产记录列表',
    icon: 'List',
    defaultW: 6,
    defaultH: 5,
    minW: 4,
    minH: 4,
    defaultVisible: true,
    defaultX: 6,
    defaultY: 15,
  },
  'asset-form': {
    type: 'asset-form',
    title: '添加记录',
    description: '快速添加资产记录表单',
    icon: 'Plus',
    defaultW: 12,
    defaultH: 4,
    minW: 6,
    minH: 3,
    defaultVisible: false,
    defaultX: 0,
    defaultY: 20,
  },
}

export const CURRENT_LAYOUT_VERSION = 2

export function getDefaultLayout(): DashboardLayoutData {
  const now = new Date().toISOString()
  return {
    version: CURRENT_LAYOUT_VERSION,
    columns: 12,
    rowHeight: 60,
    gap: 16,
    widgets: Object.values(WIDGET_METAS).map(meta => ({
      id: `widget-${meta.type}`,
      type: meta.type,
      x: meta.defaultX ?? 0,
      y: meta.defaultY ?? 0,
      w: meta.defaultW,
      h: meta.defaultH,
      minW: meta.minW,
      minH: meta.minH,
      maxW: meta.maxW,
      maxH: meta.maxH,
      visible: meta.defaultVisible,
      title: meta.title,
    })),
    createdAt: now,
    updatedAt: now,
  }
}
