import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import notificationService from '../services/notificationService.js';

const router = Router();

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  read: z.enum(['true', 'false']).optional(),
});

const markReadSchema = z.object({
  id: z.string().uuid('无效的通知ID'),
});

const deleteSchema = z.object({
  id: z.string().uuid('无效的通知ID'),
});

router.use(authMiddleware);

router.get('/unread-count', async (req: any, res) => {
  try {
    const count = await notificationService.getUnreadCount(req.userId);
    res.json({ count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: '获取未读数量失败' });
  }
});

router.get('/', async (req: any, res) => {
  try {
    const { page, pageSize, read } = listSchema.parse(req.query);

    const result = await notificationService.getNotifications(
      req.userId,
      page,
      pageSize,
      read === 'true' ? true : read === 'false' ? false : undefined
    );

    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Get notifications error:', error);
    res.status(500).json({ error: '获取通知列表失败' });
  }
});

router.patch('/:id/read', async (req: any, res) => {
  try {
    const { id } = markReadSchema.parse(req.params);

    const notification = await notificationService.markAsRead(req.userId, id);

    if (!notification) {
      return res.status(404).json({ error: '通知不存在或无权限' });
    }

    res.json({ message: '已标记为已读', notification });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Mark as read error:', error);
    res.status(500).json({ error: '标记已读失败' });
  }
});

router.patch('/read-all', async (req: any, res) => {
  try {
    const result = await notificationService.markAllAsRead(req.userId);
    res.json({ message: `已将 ${result.count} 条通知标记为已读`, count: result.count });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({ error: '全部标为已读失败' });
  }
});

router.delete('/:id', async (req: any, res) => {
  try {
    const { id } = deleteSchema.parse(req.params);

    const success = await notificationService.deleteNotification(req.userId, id);

    if (!success) {
      return res.status(404).json({ error: '通知不存在或无权限' });
    }

    res.json({ message: '删除成功' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Delete notification error:', error);
    res.status(500).json({ error: '删除通知失败' });
  }
});

export default router;
