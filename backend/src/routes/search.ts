import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

const searchSchema = z.object({
  keyword: z.string().optional(),
  minAmount: z.number().min(0).optional(),
  maxAmount: z.number().min(0).optional(),
  type: z.enum(['asset', 'transaction', 'all']).default('all'),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

router.get('/', authMiddleware, async (req: any, res) => {
  try {
    const query = searchSchema.parse({
      keyword: req.query.keyword,
      minAmount: req.query.minAmount ? Number(req.query.minAmount) : undefined,
      maxAmount: req.query.maxAmount ? Number(req.query.maxAmount) : undefined,
      type: req.query.type || 'all',
      limit: req.query.limit ? Number(req.query.limit) : 20,
      offset: req.query.offset ? Number(req.query.offset) : 0,
    });

    const { keyword, minAmount, maxAmount, type, limit, offset } = query;
    const userId = req.userId;

    const keywordLower = keyword?.toLowerCase();
    const hasKeyword = keywordLower && keywordLower.trim().length > 0;
    const hasAmountFilter = minAmount !== undefined || maxAmount !== undefined;

    let assetResults: any[] = [];
    let transactionResults: any[] = [];

    if (type === 'all' || type === 'asset') {
      const assetWhere: any = { userId };

      if (hasKeyword) {
        assetWhere.OR = [
          { note: { contains: keywordLower, mode: 'insensitive' } },
        ];
      }

      if (hasAmountFilter) {
        assetWhere.AND = [];
        if (minAmount !== undefined) {
          assetWhere.AND.push({
            OR: [
              { total: { gte: minAmount } },
              { cash: { gte: minAmount } },
              { longTermInvest: { gte: minAmount } },
              { stableBond: { gte: minAmount } },
            ],
          });
        }
        if (maxAmount !== undefined) {
          assetWhere.AND.push({
            OR: [
              { total: { lte: maxAmount } },
              { cash: { lte: maxAmount } },
              { longTermInvest: { lte: maxAmount } },
              { stableBond: { lte: maxAmount } },
            ],
          });
        }
      }

      const assets = await prisma.assetRecord.findMany({
        where: assetWhere,
        orderBy: { date: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          date: true,
          cash: true,
          longTermInvest: true,
          stableBond: true,
          total: true,
          note: true,
          createdAt: true,
        },
      });

      assetResults = assets.map((asset) => ({
        ...asset,
        date: asset.date.toISOString().split('T')[0],
        cash: Number(asset.cash),
        longTermInvest: Number(asset.longTermInvest),
        stableBond: Number(asset.stableBond),
        total: Number(asset.total),
        createdAt: asset.createdAt.toISOString(),
      }));
    }

    if (type === 'all' || type === 'transaction') {
      const transactionWhere: any = { userId };

      if (hasKeyword) {
        transactionWhere.OR = [
          { note: { contains: keywordLower, mode: 'insensitive' } },
          { counterparty: { contains: keywordLower, mode: 'insensitive' } },
        ];
      }

      if (hasAmountFilter) {
        if (minAmount !== undefined) {
          transactionWhere.amount = { ...transactionWhere.amount, gte: minAmount };
        }
        if (maxAmount !== undefined) {
          transactionWhere.amount = { ...transactionWhere.amount, lte: maxAmount };
        }
      }

      const transactions = await prisma.transaction.findMany({
        where: transactionWhere,
        orderBy: { date: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          date: true,
          amount: true,
          direction: true,
          category: true,
          counterparty: true,
          note: true,
          createdAt: true,
        },
      });

      transactionResults = transactions.map((tx) => ({
        ...tx,
        date: tx.date.toISOString().split('T')[0],
        amount: Number(tx.amount),
        createdAt: tx.createdAt.toISOString(),
      }));
    }

    const allResults = [
      ...assetResults.map((r) => ({ ...r, resultType: 'asset' as const })),
      ...transactionResults.map((r) => ({ ...r, resultType: 'transaction' as const })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    res.json({
      assets: assetResults,
      transactions: transactionResults,
      combined: allResults,
      total: allResults.length,
      hasMore: allResults.length >= limit,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Search error:', error);
    res.status(500).json({ error: '搜索失败' });
  }
});

export default router;
