import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import inventoryPlanService, {
  computeNextInventoryStatus,
  createPlan,
  getOrCreatePlan,
  getPlan,
  updateLastInventoryFromAssetRecord,
  updatePlan,
} from '../services/inventoryPlanService.js';
import type { InventoryCycleType } from '../services/inventoryPlanService.js';

const router = Router();

const createPlanSchema = z.object({
  cycleType: z.enum(['WEEKLY', 'MONTHLY', 'CUSTOM']),
  customIntervalDays: z.coerce.number().int().min(1).max(365).optional(),
  weeklyDayOfWeek: z.coerce.number().int().min(0).max(6).optional(),
  monthlyDayOfMonth: z.coerce.number().int().min(1).max(31).optional(),
  reminderDaysBefore: z.coerce.number().int().min(0).max(30).optional(),
  reminderEnabled: z.boolean().optional(),
  skipHolidays: z.boolean().optional(),
  lastInventoryDate: z.string().optional(),
});

const updatePlanSchema = z.object({
  cycleType: z.enum(['WEEKLY', 'MONTHLY', 'CUSTOM']).optional(),
  customIntervalDays: z.coerce.number().int().min(1).max(365).nullable().optional(),
  weeklyDayOfWeek: z.coerce.number().int().min(0).max(6).nullable().optional(),
  monthlyDayOfMonth: z.coerce.number().int().min(1).max(31).nullable().optional(),
  reminderDaysBefore: z.coerce.number().int().min(0).max(30).optional(),
  reminderEnabled: z.boolean().optional(),
  skipHolidays: z.boolean().optional(),
  lastInventoryDate: z.string().nullable().optional(),
});

const previewSchema = z.object({
  cycleType: z.enum(['WEEKLY', 'MONTHLY', 'CUSTOM']),
  customIntervalDays: z.coerce.number().int().min(1).max(365).optional(),
  weeklyDayOfWeek: z.coerce.number().int().min(0).max(6).optional(),
  monthlyDayOfMonth: z.coerce.number().int().min(1).max(31).optional(),
  skipHolidays: z.coerce.boolean().optional(),
  lastInventoryDate: z.string().optional(),
});

router.use(authMiddleware);

router.get('/', async (req: any, res) => {
  try {
    const plan = await getPlan(req.userId);
    const status = computeNextInventoryStatus(plan);

    res.json({
      plan,
      status: serializeStatus(status),
    });
  } catch (error) {
    console.error('Get inventory plan error:', error);
    res.status(500).json({ error: '获取盘点计划失败' });
  }
});

router.get('/or-create', async (req: any, res) => {
  try {
    const plan = await getOrCreatePlan(req.userId);
    const status = computeNextInventoryStatus(plan);

    res.json({
      plan,
      status: serializeStatus(status),
    });
  } catch (error) {
    console.error('Get or create inventory plan error:', error);
    res.status(500).json({ error: '获取盘点计划失败' });
  }
});

router.get('/status', async (req: any, res) => {
  try {
    const plan = await getPlan(req.userId);
    const status = computeNextInventoryStatus(plan);

    res.json(serializeStatus(status));
  } catch (error) {
    console.error('Get inventory status error:', error);
    res.status(500).json({ error: '获取盘点状态失败' });
  }
});

router.post('/', async (req: any, res) => {
  try {
    const parsed = createPlanSchema.parse(req.body);

    const input = {
      cycleType: parsed.cycleType as InventoryCycleType,
      customIntervalDays: parsed.customIntervalDays,
      weeklyDayOfWeek: parsed.weeklyDayOfWeek,
      monthlyDayOfMonth: parsed.monthlyDayOfMonth,
      reminderDaysBefore: parsed.reminderDaysBefore,
      reminderEnabled: parsed.reminderEnabled,
      skipHolidays: parsed.skipHolidays,
      lastInventoryDate: parsed.lastInventoryDate,
    };

    const plan = await createPlan(req.userId, input);
    const status = computeNextInventoryStatus(plan);

    res.json({
      message: '盘点计划已创建',
      plan,
      status: serializeStatus(status),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Create inventory plan error:', error);
    res.status(500).json({ error: '创建盘点计划失败' });
  }
});

router.put('/', async (req: any, res) => {
  try {
    const parsed = updatePlanSchema.parse(req.body);

    const input: any = {};
    if (parsed.cycleType !== undefined) input.cycleType = parsed.cycleType as InventoryCycleType;
    if (parsed.customIntervalDays !== undefined) input.customIntervalDays = parsed.customIntervalDays;
    if (parsed.weeklyDayOfWeek !== undefined) input.weeklyDayOfWeek = parsed.weeklyDayOfWeek;
    if (parsed.monthlyDayOfMonth !== undefined) input.monthlyDayOfMonth = parsed.monthlyDayOfMonth;
    if (parsed.reminderDaysBefore !== undefined) input.reminderDaysBefore = parsed.reminderDaysBefore;
    if (parsed.reminderEnabled !== undefined) input.reminderEnabled = parsed.reminderEnabled;
    if (parsed.skipHolidays !== undefined) input.skipHolidays = parsed.skipHolidays;
    if (parsed.lastInventoryDate !== undefined) input.lastInventoryDate = parsed.lastInventoryDate;

    const plan = await updatePlan(req.userId, input);
    const status = computeNextInventoryStatus(plan);

    res.json({
      message: '盘点计划已更新',
      plan,
      status: serializeStatus(status),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Update inventory plan error:', error);
    res.status(500).json({ error: '更新盘点计划失败' });
  }
});

router.patch('/sync-last-inventory', async (req: any, res) => {
  try {
    const updated = await updateLastInventoryFromAssetRecord(req.userId);
    if (!updated) {
      return res.status(404).json({ error: '盘点计划不存在' });
    }
    const status = computeNextInventoryStatus(updated);

    res.json({
      message: '已从资产记录同步最新盘点日期',
      plan: updated,
      status: serializeStatus(status),
    });
  } catch (error) {
    console.error('Sync last inventory error:', error);
    res.status(500).json({ error: '同步盘点日期失败' });
  }
});

router.post('/preview', async (req: any, res) => {
  try {
    const parsed = previewSchema.parse(req.body);

    const mockPlan = {
      cycleType: parsed.cycleType as InventoryCycleType,
      customIntervalDays: parsed.customIntervalDays ?? null,
      weeklyDayOfWeek: parsed.weeklyDayOfWeek ?? null,
      monthlyDayOfMonth: parsed.monthlyDayOfMonth ?? null,
      reminderDaysBefore: 3,
      reminderEnabled: true,
      skipHolidays: parsed.skipHolidays ?? false,
      lastInventoryDate: parsed.lastInventoryDate ? new Date(parsed.lastInventoryDate) : null,
    };

    const status = computeNextInventoryStatus(mockPlan);

    res.json(serializeStatus(status));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Preview inventory error:', error);
    res.status(500).json({ error: '预览盘点计划失败' });
  }
});

function serializeStatus(status: ReturnType<typeof computeNextInventoryStatus>) {
  return {
    ...status,
    nextInventoryDate: status.nextInventoryDate ? status.nextInventoryDate.toISOString() : null,
    originalDate: status.originalDate ? status.originalDate.toISOString() : null,
  };
}

export default router;
