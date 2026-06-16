import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index.js';
import jwt from 'jsonwebtoken';
import { runPrediction, type PredictionAlgorithm } from '../services/predictionService.js';

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

const predictionQuerySchema = z.object({
  algorithm: z.enum(['linear', 'movingAverage', 'exponentialSmoothing']).default('linear'),
  monthsAhead: z.coerce.number().int().min(1).max(120).default(12),
  targetAmount: z.coerce.number().min(0).optional(),
});

router.get('/forecast', authMiddleware, async (req: any, res) => {
  try {
    const query = predictionQuerySchema.safeParse(req.query);
    if (!query.success) {
      return res.status(400).json({ error: query.error.errors[0].message });
    }

    const { algorithm, monthsAhead, targetAmount } = query.data;

    const rawRecords = await prisma.assetRecord.findMany({
      where: { userId: req.userId },
      select: {
        date: true,
        total: true,
      },
      orderBy: { date: 'asc' },
    });

    const normalized = rawRecords.map(r => ({
      date: r.date.toISOString().split('T')[0],
      total: Number(r.total),
    }));

    const result = runPrediction(
      normalized,
      algorithm as PredictionAlgorithm,
      monthsAhead,
      targetAmount,
    );

    res.json(result);
  } catch (error) {
    console.error('Prediction error:', error);
    res.status(500).json({ error: '预测计算失败' });
  }
});

export default router;
