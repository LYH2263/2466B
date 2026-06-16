import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { eventBus, EVENTS } from '../services/eventBus.js';

const router = Router();

const roleSchema = z.enum(['user', 'admin']);

const listUsersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional()
});

router.use(authMiddleware);
router.use(adminMiddleware);

router.get('/users', async (req: any, res) => {
  try {
    const { page, pageSize, search } = listUsersSchema.parse(req.query);
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (search) {
      where.email = {
        contains: search,
        mode: 'insensitive'
      };
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          role: true,
          enabled: true,
          failedLoginCount: true,
          lockedUntil: true,
          createdAt: true,
          _count: {
            select: {
              assetRecords: true,
              transactions: true
            }
          }
        }
      }),
      prisma.user.count({ where })
    ]);

    res.json({
      users: users.map(u => ({
        id: u.id,
        email: u.email,
        role: u.role,
        enabled: u.enabled,
        failedLoginCount: u.failedLoginCount,
        lockedUntil: u.lockedUntil,
        isLocked: u.lockedUntil && u.lockedUntil > new Date(),
        createdAt: u.createdAt,
        assetRecordCount: u._count.assetRecords,
        transactionCount: u._count.transactions
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('List users error:', error);
    res.status(500).json({ error: '获取用户列表失败' });
  }
});

router.get('/users/:id', async (req: any, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
        enabled: true,
        failedLoginCount: true,
        lockedUntil: true,
        createdAt: true,
        _count: {
          select: {
            assetRecords: true,
            transactions: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        enabled: user.enabled,
        failedLoginCount: user.failedLoginCount,
        lockedUntil: user.lockedUntil,
        isLocked: user.lockedUntil && user.lockedUntil > new Date(),
        createdAt: user.createdAt,
        assetRecordCount: user._count.assetRecords,
        transactionCount: user._count.transactions
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

router.patch('/users/:id/enable', async (req: any, res) => {
  try {
    const { id } = req.params;

    if (id === req.userId) {
      return res.status(400).json({ error: '不能操作自己的账号状态' });
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const admin = await prisma.user.findUnique({ where: { id: req.userId! } });

    const user = await prisma.user.update({
      where: { id },
      data: { enabled: true },
      select: {
        id: true,
        email: true,
        role: true,
        enabled: true,
        failedLoginCount: true,
        lockedUntil: true,
        createdAt: true
      }
    });

    await prisma.auditLog.create({
      data: {
        adminId: admin!.id,
        adminEmail: admin!.email,
        targetUserId: targetUser.id,
        targetUserEmail: targetUser.email,
        action: 'ENABLE_USER',
        detail: `管理员启用了用户账号`
      }
    });

    eventBus.emit(EVENTS.ADMIN_ENABLED_USER, {
      targetUserId: targetUser.id,
      adminEmail: admin!.email,
    }).catch(console.error);

    res.json({ message: '用户已启用', user });
  } catch (error) {
    console.error('Enable user error:', error);
    res.status(500).json({ error: '启用用户失败' });
  }
});

router.patch('/users/:id/disable', async (req: any, res) => {
  try {
    const { id } = req.params;

    if (id === req.userId) {
      return res.status(400).json({ error: '不能禁用自己的账号' });
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return res.status(404).json({ error: '用户不存在' });
    }

    if (targetUser.role === 'admin') {
      const adminCount = await prisma.user.count({ where: { role: 'admin', enabled: true } });
      if (adminCount <= 1) {
        return res.status(400).json({ error: '系统至少需要保留一个可用管理员账号' });
      }
    }

    const admin = await prisma.user.findUnique({ where: { id: req.userId! } });

    const user = await prisma.user.update({
      where: { id },
      data: { enabled: false },
      select: {
        id: true,
        email: true,
        role: true,
        enabled: true,
        failedLoginCount: true,
        lockedUntil: true,
        createdAt: true
      }
    });

    await prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() }
    });

    await prisma.auditLog.create({
      data: {
        adminId: admin!.id,
        adminEmail: admin!.email,
        targetUserId: targetUser.id,
        targetUserEmail: targetUser.email,
        action: 'DISABLE_USER',
        detail: `管理员禁用了用户账号，并吊销了所有 Refresh Token`
      }
    });

    eventBus.emit(EVENTS.ADMIN_DISABLED_USER, {
      targetUserId: targetUser.id,
      adminEmail: admin!.email,
    }).catch(console.error);

    res.json({ message: '用户已禁用', user });
  } catch (error) {
    console.error('Disable user error:', error);
    res.status(500).json({ error: '禁用用户失败' });
  }
});

router.patch('/users/:id/unlock', async (req: any, res) => {
  try {
    const { id } = req.params;

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const admin = await prisma.user.findUnique({ where: { id: req.userId! } });

    const user = await prisma.user.update({
      where: { id },
      data: {
        failedLoginCount: 0,
        lockedUntil: null
      },
      select: {
        id: true,
        email: true,
        role: true,
        enabled: true,
        failedLoginCount: true,
        lockedUntil: true,
        createdAt: true
      }
    });

    await prisma.auditLog.create({
      data: {
        adminId: admin!.id,
        adminEmail: admin!.email,
        targetUserId: targetUser.id,
        targetUserEmail: targetUser.email,
        action: 'UNLOCK_USER',
        detail: `管理员重置了用户登录失败锁定状态`
      }
    });

    eventBus.emit(EVENTS.ADMIN_UNLOCKED_USER, {
      targetUserId: targetUser.id,
      adminEmail: admin!.email,
    }).catch(console.error);

    res.json({ message: '用户已解锁', user });
  } catch (error) {
    console.error('Unlock user error:', error);
    res.status(500).json({ error: '解锁用户失败' });
  }
});

router.patch('/users/:id/role', async (req: any, res) => {
  try {
    const { id } = req.params;
    const { role } = z.object({ role: roleSchema }).parse(req.body);

    if (id === req.userId) {
      return res.status(400).json({ error: '不能修改自己的角色' });
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return res.status(404).json({ error: '用户不存在' });
    }

    if (targetUser.role === 'admin' && role === 'user') {
      const adminCount = await prisma.user.count({ where: { role: 'admin', enabled: true } });
      if (adminCount <= 1) {
        return res.status(400).json({ error: '系统至少需要保留一个可用管理员账号' });
      }
    }

    const admin = await prisma.user.findUnique({ where: { id: req.userId! } });
    const oldRole = targetUser.role;

    const user = await prisma.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        email: true,
        role: true,
        enabled: true,
        failedLoginCount: true,
        lockedUntil: true,
        createdAt: true
      }
    });

    await prisma.auditLog.create({
      data: {
        adminId: admin!.id,
        adminEmail: admin!.email,
        targetUserId: targetUser.id,
        targetUserEmail: targetUser.email,
        action: 'CHANGE_ROLE',
        detail: `角色变更: ${oldRole} -> ${role}`
      }
    });

    eventBus.emit(EVENTS.ADMIN_CHANGED_ROLE, {
      targetUserId: targetUser.id,
      adminEmail: admin!.email,
      oldRole,
      newRole: role,
    }).catch(console.error);

    res.json({ message: '角色已更新', user });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Change role error:', error);
    res.status(500).json({ error: '更新角色失败' });
  }
});

router.post('/users/:id/force-logout', async (req: any, res) => {
  try {
    const { id } = req.params;

    if (id === req.userId) {
      return res.status(400).json({ error: '请使用退出登录功能而非强制下线' });
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const admin = await prisma.user.findUnique({ where: { id: req.userId! } });

    const result = await prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() }
    });

    await prisma.auditLog.create({
      data: {
        adminId: admin!.id,
        adminEmail: admin!.email,
        targetUserId: targetUser.id,
        targetUserEmail: targetUser.email,
        action: 'FORCE_LOGOUT',
        detail: `管理员强制下线用户，共吊销 ${result.count} 个 Refresh Token`
      }
    });

    eventBus.emit(EVENTS.ADMIN_FORCE_LOGOUT, {
      targetUserId: targetUser.id,
      adminEmail: admin!.email,
      revokedCount: result.count,
    }).catch(console.error);

    res.json({ message: `已强制下线，吊销 ${result.count} 个活跃会话` });
  } catch (error) {
    console.error('Force logout error:', error);
    res.status(500).json({ error: '强制下线失败' });
  }
});

router.get('/audit-logs', async (req: any, res) => {
  try {
    const { page = 1, pageSize = 20 } = z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(20)
    }).parse(req.query);

    const skip = (page - 1) * pageSize;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          adminEmail: true,
          targetUserEmail: true,
          action: true,
          detail: true,
          createdAt: true
        }
      }),
      prisma.auditLog.count()
    ]);

    res.json({
      logs,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Get audit logs error:', error);
    res.status(500).json({ error: '获取审计日志失败' });
  }
});

export default router;
