import { prisma } from '../index.js';
import { createNotification } from './notificationService.js';

export type InventoryCycleType = 'WEEKLY' | 'MONTHLY' | 'CUSTOM';

export interface InventoryPlanCreateInput {
  cycleType: InventoryCycleType;
  customIntervalDays?: number;
  weeklyDayOfWeek?: number;
  monthlyDayOfMonth?: number;
  reminderDaysBefore?: number;
  reminderEnabled?: boolean;
  skipHolidays?: boolean;
  lastInventoryDate?: Date | string;
}

export interface InventoryPlanUpdateInput {
  cycleType?: InventoryCycleType;
  customIntervalDays?: number | null;
  weeklyDayOfWeek?: number | null;
  monthlyDayOfMonth?: number | null;
  reminderDaysBefore?: number;
  reminderEnabled?: boolean;
  skipHolidays?: boolean;
  lastInventoryDate?: Date | string | null;
}

export interface NextInventoryResult {
  nextInventoryDate: Date | null;
  daysUntilNext: number | null;
  isOverdue: boolean;
  overdueDays: number | null;
  reminderDue: boolean;
  reminderDaysBefore: number;
  hasPlan: boolean;
  hasEverInventory: boolean;
  cycleType: InventoryCycleType | null;
  cycleDescription: string | null;
  adjustedForHoliday: boolean;
  originalDate: Date | null;
}

const HOLIDAYS_2024_2026: Set<string> = new Set([
  '2024-01-01', '2024-02-10', '2024-02-11', '2024-02-12', '2024-02-13',
  '2024-02-14', '2024-02-15', '2024-02-16', '2024-02-17', '2024-04-04',
  '2024-04-05', '2024-04-06', '2024-05-01', '2024-05-02', '2024-05-03',
  '2024-05-04', '2024-05-05', '2024-06-08', '2024-06-09', '2024-06-10',
  '2024-09-15', '2024-09-16', '2024-09-17', '2024-10-01', '2024-10-02',
  '2024-10-03', '2024-10-04', '2024-10-05', '2024-10-06', '2024-10-07',
  '2025-01-01', '2025-01-28', '2025-01-29', '2025-01-30', '2025-01-31',
  '2025-02-01', '2025-02-02', '2025-02-03', '2025-02-04', '2025-04-04',
  '2025-04-05', '2025-04-06', '2025-05-01', '2025-05-02', '2025-05-03',
  '2025-05-04', '2025-05-05', '2025-05-31', '2025-06-01', '2025-06-02',
  '2025-10-01', '2025-10-02', '2025-10-03', '2025-10-04', '2025-10-05',
  '2025-10-06', '2025-10-07', '2025-10-08',
  '2026-01-01', '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19',
  '2026-02-20', '2026-02-21', '2026-02-22', '2026-02-23', '2026-04-04',
  '2026-04-05', '2026-04-06', '2026-05-01', '2026-05-02', '2026-05-03',
  '2026-05-04', '2026-05-05', '2026-06-19', '2026-06-20', '2026-06-21',
  '2026-09-25', '2026-09-26', '2026-09-27', '2026-10-01', '2026-10-02',
  '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07',
]);

function isHoliday(date: Date): boolean {
  const dateStr = formatDateKey(date);
  return HOLIDAYS_2024_2026.has(dateStr);
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function diffDays(a: Date, b: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const aStart = startOfDay(a);
  const bStart = startOfDay(b);
  return Math.round((aStart.getTime() - bStart.getTime()) / msPerDay);
}

function adjustForHoliday(date: Date, skipHolidays: boolean): { date: Date; adjusted: boolean } {
  if (!skipHolidays) {
    return { date, adjusted: false };
  }

  let adjusted = false;
  let result = new Date(date);

  while (isHoliday(result) || isWeekend(result)) {
    result = addDays(result, 1);
    adjusted = true;
  }

  return { date: result, adjusted };
}

export function calculateNextInventoryDate(
  cycleType: InventoryCycleType,
  lastInventoryDate: Date | null,
  now: Date,
  opts: {
    customIntervalDays?: number;
    weeklyDayOfWeek?: number;
    monthlyDayOfMonth?: number;
    skipHolidays?: boolean;
  } = {}
): { nextDate: Date | null; originalDate: Date | null; adjusted: boolean } {
  const { customIntervalDays, weeklyDayOfWeek, monthlyDayOfMonth, skipHolidays = false } = opts;
  const nowStart = startOfDay(now);

  let baseDate: Date;
  if (lastInventoryDate) {
    baseDate = startOfDay(lastInventoryDate);
  } else {
    baseDate = nowStart;
  }

  let rawNext: Date | null = null;

  switch (cycleType) {
    case 'WEEKLY': {
      const targetDay = weeklyDayOfWeek ?? 0;
      let next = new Date(baseDate);
      const currentDay = next.getDay();
      let daysToAdd = targetDay - currentDay;
      if (daysToAdd <= 0) {
        daysToAdd += 7;
      }
      next = addDays(next, daysToAdd);

      if (lastInventoryDate && diffDays(next, nowStart) <= 0) {
        while (diffDays(next, nowStart) <= 0) {
          next = addDays(next, 7);
        }
      }

      rawNext = next;
      break;
    }

    case 'MONTHLY': {
      const targetDay = monthlyDayOfMonth ?? 1;
      let next = new Date(baseDate);
      next.setDate(1);
      next.setMonth(next.getMonth() + 1);
      const daysInMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      next.setDate(Math.min(targetDay, daysInMonth));

      if (lastInventoryDate && diffDays(next, nowStart) <= 0) {
        while (diffDays(next, nowStart) <= 0) {
          next.setMonth(next.getMonth() + 1);
          const dim = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
          next.setDate(Math.min(targetDay, dim));
        }
      }

      rawNext = next;
      break;
    }

    case 'CUSTOM': {
      const interval = customIntervalDays ?? 30;
      if (interval <= 0) {
        rawNext = null;
        break;
      }

      let next = addDays(baseDate, interval);

      if (lastInventoryDate && diffDays(next, nowStart) <= 0) {
        while (diffDays(next, nowStart) <= 0) {
          next = addDays(next, interval);
        }
      }

      rawNext = next;
      break;
    }
  }

  if (!rawNext) {
    return { nextDate: null, originalDate: null, adjusted: false };
  }

  const { date: adjustedDate, adjusted } = adjustForHoliday(rawNext, skipHolidays);
  return { nextDate: adjustedDate, originalDate: adjusted ? rawNext : null, adjusted };
}

export function getCycleDescription(cycleType: InventoryCycleType, opts: {
  customIntervalDays?: number;
  weeklyDayOfWeek?: number;
  monthlyDayOfMonth?: number;
}): string {
  const WEEKDAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

  switch (cycleType) {
    case 'WEEKLY': {
      const day = opts.weeklyDayOfWeek ?? 0;
      return `每周${WEEKDAY_NAMES[day]}`;
    }
    case 'MONTHLY': {
      const day = opts.monthlyDayOfMonth ?? 1;
      return `每月${day}日`;
    }
    case 'CUSTOM': {
      const interval = opts.customIntervalDays ?? 30;
      return `每${interval}天`;
    }
  }
}

export function computeNextInventoryStatus(
  plan: {
    cycleType: InventoryCycleType;
    customIntervalDays?: number | null;
    weeklyDayOfWeek?: number | null;
    monthlyDayOfMonth?: number | null;
    reminderDaysBefore: number;
    reminderEnabled: boolean;
    skipHolidays: boolean;
    lastInventoryDate?: Date | null;
  } | null,
  now: Date = new Date()
): NextInventoryResult {
  if (!plan) {
    return {
      nextInventoryDate: null,
      daysUntilNext: null,
      isOverdue: false,
      overdueDays: null,
      reminderDue: false,
      reminderDaysBefore: 3,
      hasPlan: false,
      hasEverInventory: false,
      cycleType: null,
      cycleDescription: null,
      adjustedForHoliday: false,
      originalDate: null,
    };
  }

  const { nextDate, originalDate, adjusted } = calculateNextInventoryDate(
    plan.cycleType,
    plan.lastInventoryDate ?? null,
    now,
    {
      customIntervalDays: plan.customIntervalDays ?? undefined,
      weeklyDayOfWeek: plan.weeklyDayOfWeek ?? undefined,
      monthlyDayOfMonth: plan.monthlyDayOfMonth ?? undefined,
      skipHolidays: plan.skipHolidays,
    }
  );

  const nowStart = startOfDay(now);
  let daysUntilNext: number | null = null;
  let isOverdue = false;
  let overdueDays: number | null = null;
  let reminderDue = false;

  if (nextDate) {
    daysUntilNext = diffDays(nextDate, nowStart);
    if (daysUntilNext < 0) {
      isOverdue = true;
      overdueDays = Math.abs(daysUntilNext);
    }
    if (plan.reminderEnabled && daysUntilNext !== null && daysUntilNext <= plan.reminderDaysBefore) {
      reminderDue = true;
    }
  }

  const cycleDescription = getCycleDescription(plan.cycleType, {
    customIntervalDays: plan.customIntervalDays ?? undefined,
    weeklyDayOfWeek: plan.weeklyDayOfWeek ?? undefined,
    monthlyDayOfMonth: plan.monthlyDayOfMonth ?? undefined,
  });

  return {
    nextInventoryDate: nextDate,
    daysUntilNext,
    isOverdue,
    overdueDays,
    reminderDue,
    reminderDaysBefore: plan.reminderDaysBefore,
    hasPlan: true,
    hasEverInventory: !!plan.lastInventoryDate,
    cycleType: plan.cycleType,
    cycleDescription,
    adjustedForHoliday: adjusted,
    originalDate,
  };
}

export function validatePlanInput(input: InventoryPlanCreateInput | InventoryPlanUpdateInput): string | null {
  if ('cycleType' in input && input.cycleType !== undefined) {
    if (!['WEEKLY', 'MONTHLY', 'CUSTOM'].includes(input.cycleType)) {
      return '无效的盘点周期类型';
    }
  }

  const cycleType = ('cycleType' in input ? input.cycleType : undefined) ?? 'MONTHLY';

  if (cycleType === 'WEEKLY') {
    const day = ('weeklyDayOfWeek' in input ? input.weeklyDayOfWeek : undefined);
    if (day !== undefined && day !== null) {
      if (day < 0 || day > 6) {
        return '每周盘点日必须在 0（周日）到 6（周六）之间';
      }
    }
  }

  if (cycleType === 'MONTHLY') {
    const day = ('monthlyDayOfMonth' in input ? input.monthlyDayOfMonth : undefined);
    if (day !== undefined && day !== null) {
      if (day < 1 || day > 31) {
        return '每月盘点日必须在 1 到 31 之间';
      }
    }
  }

  if (cycleType === 'CUSTOM') {
    const interval = ('customIntervalDays' in input ? input.customIntervalDays : undefined);
    if (interval !== undefined && interval !== null) {
      if (interval < 1 || interval > 365) {
        return '自定义间隔天数必须在 1 到 365 之间';
      }
    }
  }

  const reminderDays = ('reminderDaysBefore' in input ? input.reminderDaysBefore : undefined);
  if (reminderDays !== undefined) {
    if (reminderDays < 0 || reminderDays > 30) {
      return '提前提醒天数必须在 0 到 30 之间';
    }
  }

  return null;
}

export async function getPlan(userId: string) {
  const plan = await prisma.inventoryPlan.findUnique({
    where: { userId },
  });
  return plan;
}

export async function getOrCreatePlan(userId: string) {
  let plan = await prisma.inventoryPlan.findUnique({
    where: { userId },
  });

  if (!plan) {
    plan = await prisma.inventoryPlan.create({
      data: {
        userId,
        cycleType: 'MONTHLY',
        monthlyDayOfMonth: 1,
        reminderDaysBefore: 3,
        reminderEnabled: true,
        skipHolidays: false,
      },
    });
  }

  return plan;
}

export async function createPlan(userId: string, input: InventoryPlanCreateInput) {
  const error = validatePlanInput(input);
  if (error) {
    throw new Error(error);
  }

  if (input.cycleType === 'WEEKLY' && input.weeklyDayOfWeek === undefined) {
    input.weeklyDayOfWeek = 0;
  }
  if (input.cycleType === 'MONTHLY' && input.monthlyDayOfMonth === undefined) {
    input.monthlyDayOfMonth = 1;
  }
  if (input.cycleType === 'CUSTOM' && input.customIntervalDays === undefined) {
    input.customIntervalDays = 30;
  }

  const lastInventoryDate = input.lastInventoryDate
    ? (typeof input.lastInventoryDate === 'string' ? new Date(input.lastInventoryDate) : input.lastInventoryDate)
    : undefined;

  const data: any = {
    userId,
    cycleType: input.cycleType,
    customIntervalDays: input.customIntervalDays ?? null,
    weeklyDayOfWeek: input.weeklyDayOfWeek ?? null,
    monthlyDayOfMonth: input.monthlyDayOfMonth ?? null,
    reminderDaysBefore: input.reminderDaysBefore ?? 3,
    reminderEnabled: input.reminderEnabled ?? true,
    skipHolidays: input.skipHolidays ?? false,
  };

  if (lastInventoryDate) {
    data.lastInventoryDate = lastInventoryDate;
  }

  const plan = await prisma.inventoryPlan.upsert({
    where: { userId },
    update: data,
    create: data,
  });

  return plan;
}

export async function updatePlan(userId: string, input: InventoryPlanUpdateInput) {
  const existing = await prisma.inventoryPlan.findUnique({ where: { userId } });
  if (!existing) {
    throw new Error('盘点计划不存在，请先创建');
  }

  const effectiveCycleType = input.cycleType ?? existing.cycleType;
  const error = validatePlanInput({ ...input, cycleType: effectiveCycleType });
  if (error) {
    throw new Error(error);
  }

  const data: any = {};

  if (input.cycleType !== undefined) data.cycleType = input.cycleType;
  if (input.customIntervalDays !== undefined) data.customIntervalDays = input.customIntervalDays;
  if (input.weeklyDayOfWeek !== undefined) data.weeklyDayOfWeek = input.weeklyDayOfWeek;
  if (input.monthlyDayOfMonth !== undefined) data.monthlyDayOfMonth = input.monthlyDayOfMonth;
  if (input.reminderDaysBefore !== undefined) data.reminderDaysBefore = input.reminderDaysBefore;
  if (input.reminderEnabled !== undefined) data.reminderEnabled = input.reminderEnabled;
  if (input.skipHolidays !== undefined) data.skipHolidays = input.skipHolidays;

  if (input.lastInventoryDate !== undefined) {
    if (input.lastInventoryDate === null) {
      data.lastInventoryDate = null;
    } else {
      data.lastInventoryDate = typeof input.lastInventoryDate === 'string'
        ? new Date(input.lastInventoryDate)
        : input.lastInventoryDate;
    }
  }

  const plan = await prisma.inventoryPlan.update({
    where: { userId },
    data,
  });

  return plan;
}

export async function updateLastInventoryFromAssetRecord(userId: string) {
  const latestRecord = await prisma.assetRecord.findFirst({
    where: { userId },
    orderBy: { date: 'desc' },
  });

  const plan = await prisma.inventoryPlan.findUnique({ where: { userId } });
  if (!plan) {
    return null;
  }

  const lastDate = latestRecord ? latestRecord.date : null;
  const planLast = plan.lastInventoryDate;

  let shouldUpdate = false;
  if (lastDate && !planLast) {
    shouldUpdate = true;
  } else if (lastDate && planLast && lastDate.getTime() > planLast.getTime()) {
    shouldUpdate = true;
  }

  if (shouldUpdate && lastDate) {
    return prisma.inventoryPlan.update({
      where: { userId },
      data: { lastInventoryDate: lastDate },
    });
  }

  return plan;
}

export async function processInventoryReminders(): Promise<number> {
  const now = new Date();
  const plans = await prisma.inventoryPlan.findMany({
    where: { reminderEnabled: true },
    include: { user: { select: { id: true, email: true } } },
  });

  let sentCount = 0;

  for (const plan of plans) {
    try {
      const status = computeNextInventoryStatus(plan, now);

      if (!status.reminderDue && !status.isOverdue) {
        continue;
      }

      const todayStr = formatDateKey(now);
      const lastNotifiedStr = plan.lastNotifiedDate ? formatDateKey(plan.lastNotifiedDate) : null;
      if (lastNotifiedStr === todayStr) {
        continue;
      }

      let title: string;
      let content: string;

      if (status.isOverdue && status.overdueDays !== null) {
        title = '⚠️ 盘点已逾期';
        content = `您的资产盘点已逾期 ${status.overdueDays} 天。盘点周期：${status.cycleDescription}。请尽快完成盘点，保持财务数据的时效性！`;
      } else if (status.daysUntilNext === 0) {
        title = '📅 今日需要盘点';
        content = `今天是您的资产盘点日（${status.cycleDescription}）。请记得完成本月的资产盘点！${status.adjustedForHoliday ? '（已自动顺延至非节假日）' : ''}`;
      } else if (status.daysUntilNext !== null && status.daysUntilNext > 0) {
        title = '⏰ 盘点即将到期';
        content = `距离您的资产盘点日还有 ${status.daysUntilNext} 天（${status.cycleDescription}）。请提前准备好数据，按时完成盘点。${status.adjustedForHoliday ? '（已自动顺延至非节假日）' : ''}`;
      } else {
        continue;
      }

      await createNotification({
        userId: plan.userId,
        type: 'INVENTORY_REMINDER',
        title,
        content,
        data: {
          cycleType: status.cycleType,
          cycleDescription: status.cycleDescription,
          nextInventoryDate: status.nextInventoryDate?.toISOString(),
          daysUntilNext: status.daysUntilNext,
          isOverdue: status.isOverdue,
          overdueDays: status.overdueDays,
          adjustedForHoliday: status.adjustedForHoliday,
          originalDate: status.originalDate?.toISOString(),
        },
        retentionDays: 14,
      });

      await prisma.inventoryPlan.update({
        where: { id: plan.id },
        data: { lastNotifiedDate: now },
      });

      sentCount++;
    } catch (err) {
      console.error(`Error processing reminder for user ${plan.userId}:`, err);
    }
  }

  return sentCount;
}

export default {
  getPlan,
  getOrCreatePlan,
  createPlan,
  updatePlan,
  computeNextInventoryStatus,
  calculateNextInventoryDate,
  getCycleDescription,
  updateLastInventoryFromAssetRecord,
  processInventoryReminders,
  validatePlanInput,
};
