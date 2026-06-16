import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index.js';
import jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

const transactionDirectionSchema = z.enum(['INCOME', 'EXPENSE', 'TRANSFER']);
const assetCategorySchema = z.enum(['CASH', 'LONG_TERM_INVEST', 'STABLE_BOND']);

const transactionCreateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式必须为 YYYY-MM-DD'),
  amount: z.number().positive('金额必须大于0'),
  direction: transactionDirectionSchema,
  category: assetCategorySchema,
  counterparty: z.string().min(1, '对手方/分类不能为空').max(100, '对手方/分类最多100字'),
  note: z.string().max(200, '备注最多200字').optional()
});

const transactionUpdateSchema = transactionCreateSchema.partial();

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

function normalizeAmount(amount: number, direction: string): Prisma.Decimal {
  const absAmount = Math.abs(amount);
  return new Prisma.Decimal(absAmount);
}

function formatTransaction(tx: any) {
  return {
    id: tx.id,
    date: tx.date.toISOString().split('T')[0],
    amount: Number(tx.amount),
    direction: tx.direction,
    category: tx.category,
    counterparty: tx.counterparty,
    note: tx.note,
    createdAt: tx.createdAt.toISOString(),
    updatedAt: tx.updatedAt.toISOString()
  };
}

router.get('/', authMiddleware, async (req: any, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
    const skip = (page - 1) * pageSize;

    const where: any = { userId: req.userId };

    if (req.query.direction) {
      const parsed = transactionDirectionSchema.safeParse(req.query.direction);
      if (parsed.success) {
        where.direction = parsed.data;
      }
    }

    if (req.query.category) {
      const parsed = assetCategorySchema.safeParse(req.query.category);
      if (parsed.success) {
        where.category = parsed.data;
      }
    }

    if (req.query.startDate) {
      where.date = where.date || {};
      where.date.gte = new Date(req.query.startDate as string);
    }

    if (req.query.endDate) {
      where.date = where.date || {};
      where.date.lte = new Date(req.query.endDate as string);
    }

    if (req.query.keyword) {
      const keyword = req.query.keyword as string;
      where.OR = [
        { counterparty: { contains: keyword, mode: 'insensitive' } },
        { note: { contains: keyword, mode: 'insensitive' } }
      ];
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: pageSize
      }),
      prisma.transaction.count({ where })
    ]);

    res.json({
      transactions: transactions.map(formatTransaction),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: '获取交易记录失败' });
  }
});

router.get('/:id', authMiddleware, async (req: any, res) => {
  try {
    const { id } = req.params;

    const transaction = await prisma.transaction.findFirst({
      where: { id, userId: req.userId }
    });

    if (!transaction) {
      return res.status(404).json({ error: '交易记录不存在' });
    }

    res.json({ transaction: formatTransaction(transaction) });
  } catch (error) {
    console.error('Get transaction error:', error);
    res.status(500).json({ error: '获取交易记录失败' });
  }
});

router.post('/', authMiddleware, async (req: any, res) => {
  try {
    const data = transactionCreateSchema.parse(req.body);
    const normalizedAmount = normalizeAmount(data.amount, data.direction);

    const transaction = await prisma.transaction.create({
      data: {
        userId: req.userId,
        date: new Date(data.date),
        amount: normalizedAmount,
        direction: data.direction,
        category: data.category,
        counterparty: data.counterparty,
        note: data.note
      }
    });

    res.status(201).json({
      message: '添加成功',
      transaction: formatTransaction(transaction)
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Create transaction error:', error);
    res.status(500).json({ error: '添加交易记录失败' });
  }
});

router.put('/:id', authMiddleware, async (req: any, res) => {
  try {
    const { id } = req.params;
    const data = transactionUpdateSchema.parse(req.body);

    const existing = await prisma.transaction.findFirst({
      where: { id, userId: req.userId }
    });

    if (!existing) {
      return res.status(404).json({ error: '交易记录不存在或无权限修改' });
    }

    const updateData: any = {};

    if (data.date !== undefined) updateData.date = new Date(data.date);
    if (data.amount !== undefined && data.direction !== undefined) {
      updateData.amount = normalizeAmount(data.amount, data.direction);
    } else if (data.amount !== undefined) {
      updateData.amount = normalizeAmount(data.amount, existing.direction);
    }
    if (data.direction !== undefined) updateData.direction = data.direction;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.counterparty !== undefined) updateData.counterparty = data.counterparty;
    if (data.note !== undefined) updateData.note = data.note;

    const transaction = await prisma.transaction.update({
      where: { id },
      data: updateData
    });

    res.json({
      message: '更新成功',
      transaction: formatTransaction(transaction)
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Update transaction error:', error);
    res.status(500).json({ error: '更新交易记录失败' });
  }
});

router.delete('/:id', authMiddleware, async (req: any, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.transaction.findFirst({
      where: { id, userId: req.userId }
    });

    if (!existing) {
      return res.status(404).json({ error: '交易记录不存在或无权限删除' });
    }

    await prisma.transaction.delete({ where: { id } });

    res.json({ message: '删除成功' });
  } catch (error) {
    console.error('Delete transaction error:', error);
    res.status(500).json({ error: '删除交易记录失败' });
  }
});

router.get('/stats/monthly', authMiddleware, async (req: any, res) => {
  try {
    const months = Math.min(24, Math.max(1, parseInt(req.query.months as string) || 12));

    const endDate = new Date();
    endDate.setDate(1);
    const startDate = new Date(endDate);
    startDate.setMonth(startDate.getMonth() - months + 1);

    const transactions = await prisma.transaction.findMany({
      where: {
        userId: req.userId,
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: { date: 'asc' }
    });

    const monthlyStats: Record<string, { income: number; expense: number; netFlow: number; transfer: number }> = {};

    for (let i = 0; i < months; i++) {
      const d = new Date(startDate);
      d.setMonth(d.getMonth() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyStats[key] = { income: 0, expense: 0, netFlow: 0, transfer: 0 };
    }

    for (const tx of transactions) {
      const d = new Date(tx.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const amount = Number(tx.amount);

      if (!monthlyStats[key]) continue;

      if (tx.direction === 'INCOME') {
        monthlyStats[key].income += amount;
        monthlyStats[key].netFlow += amount;
      } else if (tx.direction === 'EXPENSE') {
        monthlyStats[key].expense += amount;
        monthlyStats[key].netFlow -= amount;
      } else if (tx.direction === 'TRANSFER') {
        monthlyStats[key].transfer += amount;
      }
    }

    const result = Object.entries(monthlyStats).map(([month, stats]) => ({
      month,
      income: Number(stats.income.toFixed(2)),
      expense: Number(stats.expense.toFixed(2)),
      netFlow: Number(stats.netFlow.toFixed(2)),
      transfer: Number(stats.transfer.toFixed(2))
    }));

    res.json({ monthlyStats: result });
  } catch (error) {
    console.error('Get monthly stats error:', error);
    res.status(500).json({ error: '获取月度统计失败' });
  }
});

router.get('/stats/overview', authMiddleware, async (req: any, res) => {
  try {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const [thisMonthTxs, lastMonthTxs, allTxs] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId: req.userId, date: { gte: thisMonthStart } }
      }),
      prisma.transaction.findMany({
        where: {
          userId: req.userId,
          date: { gte: lastMonthStart, lte: lastMonthEnd }
        }
      }),
      prisma.transaction.findMany({ where: { userId: req.userId } })
    ]);

    function calcSummary(txs: any[]) {
      let income = 0, expense = 0, transfer = 0;
      for (const tx of txs) {
        const amount = Number(tx.amount);
        if (tx.direction === 'INCOME') income += amount;
        else if (tx.direction === 'EXPENSE') expense += amount;
        else if (tx.direction === 'TRANSFER') transfer += amount;
      }
      return {
        income: Number(income.toFixed(2)),
        expense: Number(expense.toFixed(2)),
        netFlow: Number((income - expense).toFixed(2)),
        transfer: Number(transfer.toFixed(2)),
        count: txs.length
      };
    }

    res.json({
      thisMonth: calcSummary(thisMonthTxs),
      lastMonth: calcSummary(lastMonthTxs),
      total: calcSummary(allTxs)
    });
  } catch (error) {
    console.error('Get overview stats error:', error);
    res.status(500).json({ error: '获取概览统计失败' });
  }
});

router.get('/stats/asset-comparison', authMiddleware, async (req: any, res) => {
  try {
    const months = Math.min(24, Math.max(1, parseInt(req.query.months as string) || 12));

    const endDate = new Date();
    endDate.setDate(1);
    const startDate = new Date(endDate);
    startDate.setMonth(startDate.getMonth() - months + 1);

    const [transactions, assetRecords] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          userId: req.userId,
          date: { gte: startDate, lte: endDate }
        },
        orderBy: { date: 'asc' }
      }),
      prisma.assetRecord.findMany({
        where: {
          userId: req.userId,
          date: { gte: startDate, lte: new Date() }
        },
        orderBy: { date: 'asc' }
      })
    ]);

    const result: Record<string, {
      month: string;
      income: number;
      expense: number;
      netFlow: number;
      assetStart: number | null;
      assetEnd: number | null;
      assetGrowth: number | null;
    }> = {};

    for (let i = 0; i < months; i++) {
      const d = new Date(startDate);
      d.setMonth(d.getMonth() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      result[key] = {
        month: key,
        income: 0,
        expense: 0,
        netFlow: 0,
        assetStart: null,
        assetEnd: null,
        assetGrowth: null
      };
    }

    for (const tx of transactions) {
      const d = new Date(tx.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const amount = Number(tx.amount);
      if (!result[key]) continue;

      if (tx.direction === 'INCOME') {
        result[key].income += amount;
        result[key].netFlow += amount;
      } else if (tx.direction === 'EXPENSE') {
        result[key].expense += amount;
        result[key].netFlow -= amount;
      }
    }

    const monthlyAssets: Record<string, number[]> = {};
    for (const record of assetRecords) {
      const d = new Date(record.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyAssets[key]) monthlyAssets[key] = [];
      monthlyAssets[key].push(Number(record.total));
    }

    const sortedMonths = Object.keys(result).sort();
    let lastKnownAsset: number | null = null;

    for (let i = 0; i < sortedMonths.length; i++) {
      const key = sortedMonths[i];
      const assets = monthlyAssets[key] || [];

      if (assets.length > 0) {
        result[key].assetStart = lastKnownAsset !== null ? lastKnownAsset : assets[0];
        result[key].assetEnd = assets[assets.length - 1];
        lastKnownAsset = assets[assets.length - 1];
      } else {
        result[key].assetStart = lastKnownAsset;
        result[key].assetEnd = lastKnownAsset;
      }

      if (result[key].assetStart !== null && result[key].assetEnd !== null) {
        result[key].assetGrowth = Number((result[key].assetEnd! - result[key].assetStart!).toFixed(2));
      }

      result[key].income = Number(result[key].income.toFixed(2));
      result[key].expense = Number(result[key].expense.toFixed(2));
      result[key].netFlow = Number(result[key].netFlow.toFixed(2));
    }

    res.json({ comparison: Object.values(result) });
  } catch (error) {
    console.error('Get asset comparison error:', error);
    res.status(500).json({ error: '获取资产对照分析失败' });
  }
});

export default router;
