import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import {
  getDashboardLayout,
  saveDashboardLayout,
  resetDashboardLayout,
  getDefaultLayout,
  validateLayout,
} from '../services/dashboardLayoutService.js';

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

router.get('/layout', authMiddleware, async (req: any, res) => {
  try {
    const layout = await getDashboardLayout(req.userId);
    res.json({ layout });
  } catch (error) {
    console.error('Get dashboard layout error:', error);
    res.status(500).json({ error: '获取仪表盘布局失败' });
  }
});

router.put('/layout', authMiddleware, async (req: any, res) => {
  try {
    const { layout } = req.body;

    if (!layout) {
      return res.status(400).json({ error: '布局数据不能为空' });
    }

    const savedLayout = await saveDashboardLayout(req.userId, layout);
    res.json({
      message: '布局保存成功',
      layout: savedLayout,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Save dashboard layout error:', error);
    res.status(500).json({ error: '保存仪表盘布局失败' });
  }
});

router.get('/layout/default', authMiddleware, (req, res) => {
  try {
    const defaultLayout = getDefaultLayout();
    res.json({ layout: defaultLayout });
  } catch (error) {
    console.error('Get default layout error:', error);
    res.status(500).json({ error: '获取默认布局失败' });
  }
});

router.post('/layout/reset', authMiddleware, async (req: any, res) => {
  try {
    const defaultLayout = await resetDashboardLayout(req.userId);
    res.json({
      message: '布局已恢复默认',
      layout: defaultLayout,
    });
  } catch (error) {
    console.error('Reset dashboard layout error:', error);
    res.status(500).json({ error: '恢复默认布局失败' });
  }
});

router.post('/layout/validate', authMiddleware, async (req: any, res) => {
  try {
    const { layout } = req.body;

    if (!layout) {
      return res.status(400).json({ error: '布局数据不能为空' });
    }

    const validated = validateLayout(layout);
    res.json({
      valid: true,
      layout: validated,
    });
  } catch (error) {
    if (error instanceof Error) {
      return res.json({
        valid: false,
        error: error.message,
      });
    }
    res.json({
      valid: false,
      error: '布局数据无效',
    });
  }
});

export default router;
