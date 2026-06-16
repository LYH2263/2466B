import jwt from 'jsonwebtoken';
import { prisma } from '../index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export function authMiddleware(req: any, res: any, next: any) {
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

export async function adminMiddleware(req: any, res: any, next: any) {
  if (!req.userId) {
    return res.status(401).json({ error: '未提供访问令牌' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { role: true, enabled: true }
    });

    if (!user) {
      return res.status(401).json({ error: '用户不存在' });
    }

    if (!user.enabled) {
      return res.status(403).json({ error: '账号已被禁用' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ error: '需要管理员权限' });
    }

    req.userRole = user.role;
    next();
  } catch (error) {
    console.error('Admin middleware error:', error);
    return res.status(500).json({ error: '服务器内部错误' });
  }
}
