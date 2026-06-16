import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index.js';
import jwt from 'jsonwebtoken';
import type { AssetRecord, Transaction } from '@prisma/client';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

const periodSchema = z.enum(['monthly', 'yearly']);

const reportQuerySchema = z.object({
  period: periodSchema,
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12).optional()
}).refine((data) => {
  if (data.period === 'monthly' && !data.month) {
    return false;
  }
  return true;
}, {
  message: '月报必须指定月份'
});

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

function getPeriodRange(period: string, year: number, month?: number) {
  let startDate: Date;
  let endDate: Date;
  let periodLabel: string;

  if (period === 'monthly') {
    startDate = new Date(year, (month || 1) - 1, 1);
    endDate = new Date(year, month || 1, 0, 23, 59, 59, 999);
    periodLabel = `${year}年${month}月`;
  } else {
    startDate = new Date(year, 0, 1);
    endDate = new Date(year, 11, 31, 23, 59, 59, 999);
    periodLabel = `${year}年度`;
  }

  return { startDate, endDate, periodLabel };
}

function getPreviousPeriodStart(period: string, year: number, month?: number) {
  if (period === 'monthly') {
    const m = (month || 1) - 1;
    if (m === 0) {
      return new Date(year - 1, 11, 1);
    }
    return new Date(year, m - 1, 1);
  } else {
    return new Date(year - 1, 0, 1);
  }
}

function formatMoney(num: number | null): number {
  if (num === null || num === undefined) return 0;
  return Number(num.toFixed(2));
}

function formatPercent(num: number | null): number {
  if (num === null || num === undefined) return 0;
  return Number(num.toFixed(2));
}

router.get('/available-periods', authMiddleware, async (req: any, res) => {
  try {
    const records = await prisma.assetRecord.findMany({
      where: { userId: req.userId },
      select: { date: true },
      orderBy: { date: 'asc' }
    });

    if (records.length === 0) {
      return res.json({ periods: [], hasData: false });
    }

    const years = new Set<number>();
    const yearMonths = new Set<string>();

    for (const r of records) {
      const d = new Date(r.date);
      years.add(d.getFullYear());
      yearMonths.add(`${d.getFullYear()}-${d.getMonth() + 1}`);
    }

    const sortedYears = Array.from(years).sort((a, b) => b - a);
    const monthly: { year: number; month: number }[] = [];

    for (const ym of yearMonths) {
      const [y, m] = ym.split('-').map(Number);
      monthly.push({ year: y, month: m });
    }
    monthly.sort((a, b) => (b.year * 12 + b.month) - (a.year * 12 + a.month));

    res.json({
      hasData: true,
      years: sortedYears,
      monthly
    });
  } catch (error) {
    console.error('Get available periods error:', error);
    res.status(500).json({ error: '获取可用周期失败' });
  }
});

router.get('/generate', authMiddleware, async (req: any, res) => {
  try {
    const query = reportQuerySchema.parse(req.query);
    const { period, year, month } = query;
    const { startDate, endDate, periodLabel } = getPeriodRange(period, year, month);
    const prevPeriodStart = getPreviousPeriodStart(period, year, month);

    const [assetRecords, transactions] = await Promise.all([
      prisma.assetRecord.findMany({
        where: {
          userId: req.userId,
          date: {
            gte: prevPeriodStart,
            lte: endDate
          }
        },
        orderBy: { date: 'asc' }
      }),
      prisma.transaction.findMany({
        where: {
          userId: req.userId,
          date: {
            gte: startDate,
            lte: endDate
          }
        },
        orderBy: { date: 'asc' }
      })
    ]);

    const periodAssetRecords = assetRecords.filter((r: AssetRecord) => {
      const d = new Date(r.date);
      return d >= startDate && d <= endDate;
    });

    const hasData = periodAssetRecords.length > 0 || transactions.length > 0;

    if (!hasData) {
      return res.json({
        period,
        year,
        month,
        periodLabel,
        hasData: false,
        summary: null,
        categoryChanges: null,
        allocation: null,
        transactions: null,
        timeline: [],
        message: `${periodLabel}暂无资产数据`
      });
    }

    let startAsset = null;
    let endAsset = null;
    let prevAsset = null;

    for (const r of assetRecords) {
      const d = new Date(r.date);
      if (d < startDate) {
        prevAsset = r;
      } else if (!startAsset) {
        startAsset = r;
      }
      endAsset = r;
    }

    if (!startAsset && prevAsset) {
      startAsset = prevAsset;
    }

    const startTotal = startAsset ? Number(startAsset.total) : 0;
    const endTotal = endAsset ? Number(endAsset.total) : 0;
    const netGrowth = endTotal - startTotal;
    const returnRate = startTotal > 0 ? (netGrowth / startTotal) * 100 : 0;

    const startCash = startAsset ? Number(startAsset.cash) : 0;
    const startLongTerm = startAsset ? Number(startAsset.longTermInvest) : 0;
    const startBond = startAsset ? Number(startAsset.stableBond) : 0;

    const endCash = endAsset ? Number(endAsset.cash) : 0;
    const endLongTerm = endAsset ? Number(endAsset.longTermInvest) : 0;
    const endBond = endAsset ? Number(endAsset.stableBond) : 0;

    const categoryChanges = [
      {
        category: 'CASH',
        categoryName: '活钱',
        start: formatMoney(startCash),
        end: formatMoney(endCash),
        change: formatMoney(endCash - startCash),
        changePercent: formatPercent(startCash > 0 ? ((endCash - startCash) / startCash) * 100 : 0)
      },
      {
        category: 'LONG_TERM_INVEST',
        categoryName: '长期投资',
        start: formatMoney(startLongTerm),
        end: formatMoney(endLongTerm),
        change: formatMoney(endLongTerm - startLongTerm),
        changePercent: formatPercent(startLongTerm > 0 ? ((endLongTerm - startLongTerm) / startLongTerm) * 100 : 0)
      },
      {
        category: 'STABLE_BOND',
        categoryName: '稳定债券',
        start: formatMoney(startBond),
        end: formatMoney(endBond),
        change: formatMoney(endBond - startBond),
        changePercent: formatPercent(startBond > 0 ? ((endBond - startBond) / startBond) * 100 : 0)
      }
    ];

    const allocation = endTotal > 0 ? [
      {
        category: 'CASH',
        categoryName: '活钱',
        value: formatMoney(endCash),
        percent: formatPercent((endCash / endTotal) * 100)
      },
      {
        category: 'LONG_TERM_INVEST',
        categoryName: '长期投资',
        value: formatMoney(endLongTerm),
        percent: formatPercent((endLongTerm / endTotal) * 100)
      },
      {
        category: 'STABLE_BOND',
        categoryName: '稳定债券',
        value: formatMoney(endBond),
        percent: formatPercent((endBond / endTotal) * 100)
      }
    ] : categoryChanges.map(c => ({
      category: c.category,
      categoryName: c.categoryName,
      value: 0,
      percent: 0
    }));

    let totalIncome = 0;
    let totalExpense = 0;
    let totalTransfer = 0;

    for (const tx of transactions) {
      const amount = Number(tx.amount);
      if (tx.direction === 'INCOME') totalIncome += amount;
      else if (tx.direction === 'EXPENSE') totalExpense += amount;
      else if (tx.direction === 'TRANSFER') totalTransfer += amount;
    }

    const txSummary = {
      income: formatMoney(totalIncome),
      expense: formatMoney(totalExpense),
      netFlow: formatMoney(totalIncome - totalExpense),
      transfer: formatMoney(totalTransfer),
      count: transactions.length
    };

    const recentTransactions = transactions
      .slice(-10)
      .reverse()
      .map((tx: Transaction) => ({
        id: tx.id,
        date: new Date(tx.date).toISOString().split('T')[0],
        amount: Number(tx.amount),
        direction: tx.direction,
        category: tx.category,
        counterparty: tx.counterparty,
        note: tx.note || ''
      }));

    const timeline = periodAssetRecords.map((r: AssetRecord) => ({
      date: new Date(r.date).toISOString().split('T')[0],
      cash: Number(r.cash),
      longTermInvest: Number(r.longTermInvest),
      stableBond: Number(r.stableBond),
      total: Number(r.total)
    }));

    let summaryText = '';
    if (startTotal === 0 && endTotal > 0) {
      summaryText = `${periodLabel}新增资产记录，期末总资产 ¥${formatMoney(endTotal).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}。`;
    } else if (startTotal > 0) {
      const growthText = netGrowth >= 0 ? '增长' : '减少';
      summaryText = `${periodLabel}期初资产 ¥${formatMoney(startTotal).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}，` +
        `期末资产 ¥${formatMoney(endTotal).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}，` +
        `资产${growthText} ¥${formatMoney(Math.abs(netGrowth)).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}，` +
        `收益率 ${formatPercent(returnRate)}%。`;
    } else {
      summaryText = `${periodLabel}期末资产 ¥${formatMoney(endTotal).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}。`;
    }

    if (totalIncome > 0 || totalExpense > 0) {
      summaryText += ` 期间收入 ¥${formatMoney(totalIncome).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}，` +
        `支出 ¥${formatMoney(totalExpense).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}，` +
        `净流入 ¥${formatMoney(totalIncome - totalExpense).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}。`;
    }

    res.json({
      period,
      year,
      month,
      periodLabel,
      hasData: true,
      summary: {
        startAsset: formatMoney(startTotal),
        endAsset: formatMoney(endTotal),
        netGrowth: formatMoney(netGrowth),
        returnRate: formatPercent(returnRate),
        text: summaryText
      },
      categoryChanges,
      allocation,
      transactions: {
        summary: txSummary,
        recent: recentTransactions
      },
      timeline
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Generate report error:', error);
    res.status(500).json({ error: '生成报表失败' });
  }
});

export default router;
