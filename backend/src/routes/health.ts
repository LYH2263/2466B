import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index.js';
import jwt from 'jsonwebtoken';
import { Decimal } from '@prisma/client/runtime/library.js';
import {
  calculateHealthScore,
  saveHealthScore,
  recalculateAndSaveHealthScore,
  normalizeWeights,
} from '../services/healthScoreService.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

function authMiddleware(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未提供访问令牌' });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: '访问令牌无效或已过期' });
  }
}

const healthConfigSchema = z
  .object({
    monthlyExpense: z.number().min(0, '月支出不能为负数'),
    targetCashRatio: z.number().min(0).max(1, '现金占比必须在0-1之间'),
    targetLongTermInvestRatio: z.number().min(0).max(1, '长期投资占比必须在0-1之间'),
    targetStableBondRatio: z.number().min(0).max(1, '稳健债券占比必须在0-1之间'),
    emergencyReserveWeight: z.number().min(0, '权重不能为负数'),
    assetAllocationWeight: z.number().min(0, '权重不能为负数'),
    growthStabilityWeight: z.number().min(0, '权重不能为负数'),
    inventoryTimelinessWeight: z.number().min(0, '权重不能为负数'),
    volatilityWindowMonths: z.number().int().min(3).max(24, '波动率窗口必须在3-24个月之间'),
    minEmergencyReserveMonths: z.number().int().min(1).max(12, '最低应急储备月数必须在1-12之间'),
    idealEmergencyReserveMonths: z.number().int().min(1).max(24, '理想应急储备月数必须在1-24之间'),
  })
  .refine(
    (data) => {
      const totalRatio =
        data.targetCashRatio + data.targetLongTermInvestRatio + data.targetStableBondRatio;
      return Math.abs(totalRatio - 1) < 0.001;
    },
    {
      message: '目标资产配置比例之和必须等于1',
    }
  )
  .refine(
    (data) => {
      return data.idealEmergencyReserveMonths > data.minEmergencyReserveMonths;
    },
    {
      message: '理想应急储备月数必须大于最低应急储备月数',
    }
  );

router.get('/config', authMiddleware, async (req: any, res) => {
  try {
    const config = await prisma.healthConfig.findUnique({
      where: { userId: req.userId },
    });

    if (!config) {
      return res.json({
        config: null,
        defaultConfig: {
          monthlyExpense: 5000,
          targetCashRatio: 0.3,
          targetLongTermInvestRatio: 0.5,
          targetStableBondRatio: 0.2,
          emergencyReserveWeight: 0.3,
          assetAllocationWeight: 0.3,
          growthStabilityWeight: 0.25,
          inventoryTimelinessWeight: 0.15,
          volatilityWindowMonths: 6,
          minEmergencyReserveMonths: 3,
          idealEmergencyReserveMonths: 6,
        },
      });
    }

    res.json({ config });
  } catch (error) {
    console.error('Get health config error:', error);
    res.status(500).json({ error: '获取健康度配置失败' });
  }
});

router.post('/config', authMiddleware, async (req: any, res) => {
  try {
    const data = healthConfigSchema.parse(req.body);

    const normalizedWeights = normalizeWeights({
      emergencyReserveWeight: data.emergencyReserveWeight,
      assetAllocationWeight: data.assetAllocationWeight,
      growthStabilityWeight: data.growthStabilityWeight,
      inventoryTimelinessWeight: data.inventoryTimelinessWeight,
    });

    const config = await prisma.healthConfig.upsert({
      where: { userId: req.userId },
      update: {
        monthlyExpense: new Decimal(data.monthlyExpense),
        targetCashRatio: new Decimal(data.targetCashRatio),
        targetLongTermInvestRatio: new Decimal(data.targetLongTermInvestRatio),
        targetStableBondRatio: new Decimal(data.targetStableBondRatio),
        emergencyReserveWeight: new Decimal(normalizedWeights.emergencyReserveWeight),
        assetAllocationWeight: new Decimal(normalizedWeights.assetAllocationWeight),
        growthStabilityWeight: new Decimal(normalizedWeights.growthStabilityWeight),
        inventoryTimelinessWeight: new Decimal(normalizedWeights.inventoryTimelinessWeight),
        volatilityWindowMonths: data.volatilityWindowMonths,
        minEmergencyReserveMonths: data.minEmergencyReserveMonths,
        idealEmergencyReserveMonths: data.idealEmergencyReserveMonths,
      },
      create: {
        userId: req.userId,
        monthlyExpense: new Decimal(data.monthlyExpense),
        targetCashRatio: new Decimal(data.targetCashRatio),
        targetLongTermInvestRatio: new Decimal(data.targetLongTermInvestRatio),
        targetStableBondRatio: new Decimal(data.targetStableBondRatio),
        emergencyReserveWeight: new Decimal(normalizedWeights.emergencyReserveWeight),
        assetAllocationWeight: new Decimal(normalizedWeights.assetAllocationWeight),
        growthStabilityWeight: new Decimal(normalizedWeights.growthStabilityWeight),
        inventoryTimelinessWeight: new Decimal(normalizedWeights.inventoryTimelinessWeight),
        volatilityWindowMonths: data.volatilityWindowMonths,
        minEmergencyReserveMonths: data.minEmergencyReserveMonths,
        idealEmergencyReserveMonths: data.idealEmergencyReserveMonths,
      },
    });

    res.json({
      message: '配置保存成功',
      config,
      normalizedWeights,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Save health config error:', error);
    res.status(500).json({ error: '保存健康度配置失败' });
  }
});

router.delete('/config', authMiddleware, async (req: any, res) => {
  try {
    const existingConfig = await prisma.healthConfig.findUnique({
      where: { userId: req.userId },
    });

    if (!existingConfig) {
      return res.status(404).json({ error: '配置不存在' });
    }

    await prisma.healthConfig.delete({
      where: { userId: req.userId },
    });

    res.json({ message: '配置已重置为默认值' });
  } catch (error) {
    console.error('Delete health config error:', error);
    res.status(500).json({ error: '重置健康度配置失败' });
  }
});

router.get('/score', authMiddleware, async (req: any, res) => {
  try {
    const { recalculate } = req.query;

    let latestScore = null;
    if (recalculate !== 'true') {
      latestScore = await prisma.healthScore.findFirst({
        where: { userId: req.userId },
        orderBy: { calculatedAt: 'desc' },
      });
    }

    if (!latestScore || recalculate === 'true') {
      const result = await calculateHealthScore({ userId: req.userId });
      const savedScore = await saveHealthScore(req.userId, result);
      return res.json({
        score: result,
        savedScore,
      });
    }

    res.json({
      score: {
        totalScore: Number(latestScore.totalScore),
        emergencyReserve: {
          score: Number(latestScore.emergencyReserveScore),
          weight: Number(latestScore.emergencyReserveWeight),
          suggestion: latestScore.emergencyReserveSuggestion,
        },
        assetAllocation: {
          score: Number(latestScore.assetAllocationScore),
          weight: Number(latestScore.assetAllocationWeight),
          suggestion: latestScore.assetAllocationSuggestion,
        },
        growthStability: {
          score: Number(latestScore.growthStabilityScore),
          weight: Number(latestScore.growthStabilityWeight),
          suggestion: latestScore.growthStabilitySuggestion,
        },
        inventoryTimeliness: {
          score: Number(latestScore.inventoryTimelinessScore),
          weight: Number(latestScore.inventoryTimelinessWeight),
          suggestion: latestScore.inventoryTimelinessSuggestion,
        },
        dataQuality: latestScore.dataQuality as any,
        dataQualityNote: latestScore.dataQualityNote,
        calculatedAt: latestScore.calculatedAt,
      },
      savedScore: latestScore,
    });
  } catch (error) {
    console.error('Get health score error:', error);
    res.status(500).json({ error: '获取健康度评分失败' });
  }
});

router.post('/score/recalculate', authMiddleware, async (req: any, res) => {
  try {
    const savedScore = await recalculateAndSaveHealthScore(req.userId);
    const result = await calculateHealthScore({ userId: req.userId });

    res.json({
      message: '评分计算完成',
      score: result,
      savedScore,
    });
  } catch (error) {
    console.error('Recalculate health score error:', error);
    res.status(500).json({ error: '重新计算健康度评分失败' });
  }
});

router.get('/score/history', authMiddleware, async (req: any, res) => {
  try {
    const { limit = 30, offset = 0 } = req.query;
    const limitNum = Math.min(parseInt(limit as string) || 30, 100);
    const offsetNum = parseInt(offset as string) || 0;

    const [scores, total] = await Promise.all([
      prisma.healthScore.findMany({
        where: { userId: req.userId },
        orderBy: { calculatedAt: 'desc' },
        take: limitNum,
        skip: offsetNum,
      }),
      prisma.healthScore.count({
        where: { userId: req.userId },
      }),
    ]);

    res.json({
      scores: scores.map((s) => ({
        id: s.id,
        totalScore: Number(s.totalScore),
        emergencyReserveScore: Number(s.emergencyReserveScore),
        assetAllocationScore: Number(s.assetAllocationScore),
        growthStabilityScore: Number(s.growthStabilityScore),
        inventoryTimelinessScore: Number(s.inventoryTimelinessScore),
        calculatedAt: s.calculatedAt,
        dataQuality: s.dataQuality,
      })),
      total,
      hasMore: offsetNum + limitNum < total,
    });
  } catch (error) {
    console.error('Get health score history error:', error);
    res.status(500).json({ error: '获取评分历史失败' });
  }
});

router.get('/score/preview', authMiddleware, async (req: any, res) => {
  try {
    const result = await calculateHealthScore({ userId: req.userId });
    res.json({ score: result });
  } catch (error) {
    console.error('Preview health score error:', error);
    res.status(500).json({ error: '预览健康度评分失败' });
  }
});

export default router;
