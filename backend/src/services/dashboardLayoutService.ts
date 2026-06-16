import { prisma } from '../index.js';
import { z } from 'zod';

const WidgetConfigSchema = z.object({
  id: z.string(),
  type: z.string(),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().min(1),
  h: z.number().int().min(1),
  minW: z.number().int().min(1).optional(),
  minH: z.number().int().min(1).optional(),
  maxW: z.number().int().min(1).optional(),
  maxH: z.number().int().min(1).optional(),
  visible: z.boolean(),
  title: z.string().optional(),
  settings: z.record(z.any()).optional(),
});

const DashboardLayoutDataSchema = z.object({
  version: z.number().int().min(1),
  columns: z.number().int().min(1).max(24),
  rowHeight: z.number().int().min(20).max(200),
  gap: z.number().int().min(0).max(48),
  widgets: z.array(WidgetConfigSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export interface WidgetConfig {
  id: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  visible: boolean;
  title?: string;
  settings?: Record<string, any>;
}

export interface DashboardLayoutData {
  version: number;
  columns: number;
  rowHeight: number;
  gap: number;
  widgets: WidgetConfig[];
  createdAt: string;
  updatedAt: string;
}

const CURRENT_LAYOUT_VERSION = 2;

const DEFAULT_WIDGET_METAS: Array<{
  type: string;
  title: string;
  defaultW: number;
  defaultH: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  defaultVisible: boolean;
  defaultX?: number;
  defaultY?: number;
}> = [
  {
    type: 'inventory-status',
    title: '盘点状态',
    defaultW: 12,
    defaultH: 2,
    minW: 6,
    minH: 2,
    defaultVisible: true,
    defaultX: 0,
    defaultY: 0,
  },
  {
    type: 'health-score',
    title: '健康评分',
    defaultW: 12,
    defaultH: 4,
    minW: 6,
    minH: 3,
    defaultVisible: true,
    defaultX: 0,
    defaultY: 2,
  },
  {
    type: 'summary',
    title: '资产汇总',
    defaultW: 12,
    defaultH: 3,
    minW: 6,
    minH: 2,
    defaultVisible: true,
    defaultX: 0,
    defaultY: 6,
  },
  {
    type: 'trend-chart',
    title: '资产趋势图',
    defaultW: 8,
    defaultH: 6,
    minW: 6,
    minH: 4,
    defaultVisible: true,
    defaultX: 0,
    defaultY: 9,
  },
  {
    type: 'allocation-pie',
    title: '资产配置饼图',
    defaultW: 4,
    defaultH: 6,
    minW: 4,
    minH: 4,
    defaultVisible: true,
    defaultX: 8,
    defaultY: 9,
  },
  {
    type: 'prediction',
    title: '预测面板',
    defaultW: 6,
    defaultH: 5,
    minW: 4,
    minH: 4,
    defaultVisible: true,
    defaultX: 0,
    defaultY: 15,
  },
  {
    type: 'history-list',
    title: '历史记录',
    defaultW: 6,
    defaultH: 5,
    minW: 4,
    minH: 4,
    defaultVisible: true,
    defaultX: 6,
    defaultY: 15,
  },
  {
    type: 'asset-form',
    title: '添加记录',
    defaultW: 12,
    defaultH: 4,
    minW: 6,
    minH: 3,
    defaultVisible: false,
    defaultX: 0,
    defaultY: 20,
  },
];

export function getDefaultLayout(): DashboardLayoutData {
  const now = new Date().toISOString();
  return {
    version: CURRENT_LAYOUT_VERSION,
    columns: 12,
    rowHeight: 60,
    gap: 16,
    widgets: DEFAULT_WIDGET_METAS.map(meta => ({
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
  };
}

export function mergeWithDefaultLayout(savedLayout: DashboardLayoutData): DashboardLayoutData {
  const defaultLayout = getDefaultLayout();

  if (savedLayout.version >= CURRENT_LAYOUT_VERSION) {
    return savedLayout;
  }

  const savedWidgetTypes = new Set(savedLayout.widgets.map(w => w.type));
  const newWidgets = [...savedLayout.widgets];

  for (const defaultWidget of defaultLayout.widgets) {
    if (!savedWidgetTypes.has(defaultWidget.type)) {
      newWidgets.push({ ...defaultWidget });
    }
  }

  const existingIds = new Set(savedLayout.widgets.map(w => w.id));
  newWidgets.forEach(widget => {
    if (!existingIds.has(widget.id)) {
      const maxY = Math.max(...savedLayout.widgets.map(w => w.y + w.h), 0);
      widget.y = maxY + 1;
      widget.x = 0;
    }
  });

  return {
    ...savedLayout,
    version: CURRENT_LAYOUT_VERSION,
    widgets: newWidgets,
    updatedAt: new Date().toISOString(),
  };
}

export function validateLayout(layout: unknown): DashboardLayoutData {
  const result = DashboardLayoutDataSchema.safeParse(layout);
  if (!result.success) {
    throw new Error(`布局数据验证失败: ${result.error.message}`);
  }

  const { widgets, columns } = result.data;
  for (const widget of widgets) {
    if (widget.x + widget.w > columns) {
      throw new Error(`小部件 ${widget.id} 超出栅格边界`);
    }
  }

  return result.data;
}

export async function getDashboardLayout(userId: string): Promise<DashboardLayoutData> {
  const record = await prisma.dashboardLayout.findUnique({
    where: { userId },
  });

  if (!record) {
    return getDefaultLayout();
  }

  try {
    let layout: DashboardLayoutData;
    if (typeof record.layout === 'string') {
      layout = JSON.parse(record.layout);
    } else {
      layout = record.layout as unknown as DashboardLayoutData;
    }

    const validated = validateLayout(layout);
    return mergeWithDefaultLayout(validated);
  } catch (error) {
    console.error('解析布局数据失败，使用默认布局:', error);
    return getDefaultLayout();
  }
}

export async function saveDashboardLayout(
  userId: string,
  layoutData: unknown
): Promise<DashboardLayoutData> {
  const validated = validateLayout(layoutData);
  const merged = mergeWithDefaultLayout(validated);
  merged.updatedAt = new Date().toISOString();

  const layoutString = JSON.stringify(merged);

  const saved = await prisma.dashboardLayout.upsert({
    where: { userId },
    create: {
      userId,
      version: merged.version,
      layout: layoutString,
    },
    update: {
      version: merged.version,
      layout: layoutString,
    },
  });

  return merged;
}

export async function resetDashboardLayout(userId: string): Promise<DashboardLayoutData> {
  const defaultLayout = getDefaultLayout();
  const layoutString = JSON.stringify(defaultLayout);

  await prisma.dashboardLayout.upsert({
    where: { userId },
    create: {
      userId,
      version: defaultLayout.version,
      layout: layoutString,
    },
    update: {
      version: defaultLayout.version,
      layout: layoutString,
    },
  });

  return defaultLayout;
}
