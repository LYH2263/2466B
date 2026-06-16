import { prisma } from '../index.js';
import { eventBus, EVENTS } from './eventBus.js';

const NOTIFICATION_RETENTION_DAYS = 30;

interface CreateNotificationParams {
  userId: string;
  type: string;
  title: string;
  content: string;
  data?: Record<string, any>;
  retentionDays?: number;
}

export async function createNotification(params: CreateNotificationParams) {
  const { userId, type, title, content, data, retentionDays = NOTIFICATION_RETENTION_DAYS } = params;

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + retentionDays);

  const notification = await prisma.notification.create({
    data: {
      userId,
      type: type as any,
      title,
      content,
      data: data ? JSON.stringify(data) : null,
      expiresAt,
    },
  });

  return notification;
}

export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: {
      userId,
      read: false,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
  });
}

export async function getNotifications(
  userId: string,
  page: number = 1,
  pageSize: number = 20,
  read?: boolean
) {
  const skip = (page - 1) * pageSize;

  const where: any = {
    userId,
    OR: [
      { expiresAt: null },
      { expiresAt: { gt: new Date() } },
    ],
  };

  if (read !== undefined) {
    where.read = read;
  }

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.notification.count({ where }),
  ]);

  return {
    notifications: notifications.map(n => ({
      ...n,
      data: n.data ? JSON.parse(n.data) : null,
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export async function markAsRead(userId: string, notificationId: string) {
  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      userId,
    },
  });

  if (!notification) {
    return null;
  }

  if (notification.read) {
    return notification;
  }

  return prisma.notification.update({
    where: { id: notificationId },
    data: {
      read: true,
      readAt: new Date(),
    },
  });
}

export async function markAllAsRead(userId: string) {
  const result = await prisma.notification.updateMany({
    where: {
      userId,
      read: false,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    data: {
      read: true,
      readAt: new Date(),
    },
  });

  return { count: result.count };
}

export async function deleteNotification(userId: string, notificationId: string) {
  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      userId,
    },
  });

  if (!notification) {
    return false;
  }

  await prisma.notification.delete({
    where: { id: notificationId },
  });

  return true;
}

export async function cleanExpiredNotifications(): Promise<number> {
  const result = await prisma.notification.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });

  return result.count;
}

function registerEventHandlers() {
  eventBus.on(EVENTS.ACCOUNT_LOCKED, async (data: { userId: string; reason: string; lockMinutes: number }) => {
    await createNotification({
      userId: data.userId,
      type: 'ACCOUNT_LOCKED',
      title: '账号已被锁定',
      content: `由于${data.reason}，您的账号已被锁定 ${data.lockMinutes} 分钟。请稍后重试或联系管理员。`,
      data,
      retentionDays: 7,
    });
  });

  eventBus.on(EVENTS.NEW_DEVICE_LOGIN, async (data: { userId: string; ip?: string; userAgent?: string; device?: string; loginTime: Date }) => {
    await createNotification({
      userId: data.userId,
      type: 'NEW_DEVICE_LOGIN',
      title: '新设备登录提醒',
      content: `检测到新设备登录。IP: ${data.ip || '未知'}，设备: ${data.device || data.userAgent || '未知'}。如果不是您本人操作，请及时修改密码。`,
      data,
      retentionDays: 14,
    });
  });

  eventBus.on(EVENTS.ADMIN_DISABLED_USER, async (data: { targetUserId: string; adminEmail: string; reason?: string }) => {
    await createNotification({
      userId: data.targetUserId,
      type: 'ADMIN_ACTION',
      title: '账号已被禁用',
      content: `管理员 ${data.adminEmail} 已禁用您的账号。如有疑问，请联系管理员。`,
      data,
      retentionDays: 30,
    });
  });

  eventBus.on(EVENTS.ADMIN_ENABLED_USER, async (data: { targetUserId: string; adminEmail: string }) => {
    await createNotification({
      userId: data.targetUserId,
      type: 'ADMIN_ACTION',
      title: '账号已恢复',
      content: `管理员 ${data.adminEmail} 已恢复您的账号。您现在可以正常登录了。`,
      data,
      retentionDays: 30,
    });
  });

  eventBus.on(EVENTS.ADMIN_UNLOCKED_USER, async (data: { targetUserId: string; adminEmail: string }) => {
    await createNotification({
      userId: data.targetUserId,
      type: 'ADMIN_ACTION',
      title: '账号已解锁',
      content: `管理员 ${data.adminEmail} 已解锁您的账号。您现在可以正常登录了。`,
      data,
      retentionDays: 7,
    });
  });

  eventBus.on(EVENTS.ADMIN_FORCE_LOGOUT, async (data: { targetUserId: string; adminEmail: string; revokedCount: number }) => {
    await createNotification({
      userId: data.targetUserId,
      type: 'ADMIN_ACTION',
      title: '账号已被强制下线',
      content: `管理员 ${data.adminEmail} 已强制下线您的账号，共吊销 ${data.revokedCount} 个活跃会话。`,
      data,
      retentionDays: 7,
    });
  });

  eventBus.on(EVENTS.ADMIN_CHANGED_ROLE, async (data: { targetUserId: string; adminEmail: string; oldRole: string; newRole: string }) => {
    await createNotification({
      userId: data.targetUserId,
      type: 'ADMIN_ACTION',
      title: '角色已变更',
      content: `管理员 ${data.adminEmail} 将您的角色从 ${data.oldRole} 变更为 ${data.newRole}。`,
      data,
      retentionDays: 30,
    });
  });

  eventBus.on(EVENTS.SYSTEM_NOTICE, async (data: { userId?: string; userIds?: string[]; title: string; content: string; data?: Record<string, any> }) => {
    const userIds = data.userIds || (data.userId ? [data.userId] : []);

    if (userIds.length === 0) {
      return;
    }

    const notifications = userIds.map(userId =>
      createNotification({
        userId,
        type: 'SYSTEM_NOTICE',
        title: data.title,
        content: data.content,
        data: data.data,
        retentionDays: 30,
      })
    );

    await Promise.all(notifications);
  });

  eventBus.on(EVENTS.ASSET_RECORD_CREATED, async (data: { userId: string; recordId: string; total: number; date: string }) => {
    await checkAssetMilestone(data.userId, data.total);
  });
}

const MILESTONES = [10000, 50000, 100000, 500000, 1000000, 5000000, 10000000];

async function checkAssetMilestone(userId: string, currentTotal: number) {
  try {
    const previousRecord = await prisma.assetRecord.findFirst({
      where: {
        userId,
      },
      orderBy: { date: 'desc' },
      skip: 1,
    });

    const previousTotal = previousRecord ? Number(previousRecord.total) : 0;

    const passedMilestones = MILESTONES.filter(m => m <= currentTotal && m > previousTotal);

    for (const milestone of passedMilestones) {
      await createNotification({
        userId,
        type: 'ASSET_TARGET_REACHED',
        title: '🎉 资产里程碑达成',
        content: `恭喜！您的总资产已突破 ${formatAmount(milestone)} 元！继续保持良好的理财习惯！`,
        data: { milestone, currentTotal },
        retentionDays: 30,
      });
    }
  } catch (error) {
    console.error('Check asset milestone error:', error);
  }
}

function formatAmount(amount: number): string {
  if (amount >= 100000000) {
    return (amount / 100000000).toFixed(1) + '亿';
  }
  if (amount >= 10000) {
    return (amount / 10000).toFixed(1) + '万';
  }
  return amount.toFixed(2);
}

const INVENTORY_REMINDER_DAYS = 30;

export async function checkInventoryReminder(userId: string): Promise<void> {
  try {
    const latestRecord = await prisma.assetRecord.findFirst({
      where: { userId },
      orderBy: { date: 'desc' },
    });

    if (!latestRecord) {
      return;
    }

    const daysSinceLastRecord = Math.floor(
      (Date.now() - latestRecord.date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceLastRecord >= INVENTORY_REMINDER_DAYS) {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentReminder = await prisma.notification.findFirst({
        where: {
          userId,
          type: 'INVENTORY_REMINDER',
          createdAt: {
            gte: oneWeekAgo,
          },
        },
      });

      if (!recentReminder) {
        await createNotification({
          userId,
          type: 'INVENTORY_REMINDER',
          title: '⏰ 资产盘点提醒',
          content: `您已有 ${daysSinceLastRecord} 天未更新资产记录了。定期盘点有助于掌握财务状况，快去更新一下吧！`,
          data: { daysSinceLastRecord, lastRecordDate: latestRecord.date },
          retentionDays: 7,
        });
      }
    }
  } catch (error) {
    console.error('Check inventory reminder error:', error);
  }
}

registerEventHandlers();

export default {
  createNotification,
  getUnreadCount,
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  cleanExpiredNotifications,
};
