import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../index.js';
import crypto from 'crypto';
import { eventBus, EVENTS } from '../services/eventBus.js';
import { checkInventoryReminder } from '../services/notificationService.js';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const ACCESS_TOKEN_EXPIRES = '15m';
const REFRESH_TOKEN_EXPIRES_DAYS = 7;

function parseUserAgent(userAgent: string): string {
  if (!userAgent) return '未知设备';
  
  const ua = userAgent.toLowerCase();
  
  let device = '';
  if (ua.includes('windows')) device = 'Windows';
  else if (ua.includes('mac os')) device = 'macOS';
  else if (ua.includes('android')) device = 'Android';
  else if (ua.includes('iphone') || ua.includes('ipad')) device = 'iOS';
  else if (ua.includes('linux')) device = 'Linux';
  else device = '未知系统';
  
  let browser = '';
  if (ua.includes('edg')) browser = 'Edge';
  else if (ua.includes('chrome')) browser = 'Chrome';
  else if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('safari')) browser = 'Safari';
  else browser = '未知浏览器';
  
  return `${device} · ${browser}`;
}

// Validation schemas
const loginSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(6, '密码至少需要6个字符')
});

const registerSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(6, '密码至少需要6个字符')
});

// Generate tokens
function generateAccessToken(userId: string) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES });
}

function generateRefreshToken() {
  return crypto.randomBytes(40).toString('hex');
}

// Hash token for storage
function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password } = registerSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ error: '该邮箱已被注册' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash
      },
      select: {
        id: true,
        email: true,
        createdAt: true
      }
    });

    res.status(201).json({
      message: '注册成功',
      user
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Register error:', error);
    res.status(500).json({ error: '注册失败' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }

    // Check if account is enabled
    if (!user.enabled) {
      return res.status(403).json({ error: '账号已被禁用，请联系管理员' });
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / (1000 * 60));
      return res.status(403).json({ 
        error: `账号已被锁定，请在 ${minutes} 分钟后重试` 
      });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
      // Increment failed login count
      const newCount = user.failedLoginCount + 1;
      
      if (newCount >= 5) {
        // Lock account for 15 minutes
        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginCount: newCount,
            lockedUntil: new Date(Date.now() + 15 * 60 * 1000)
          }
        });

        eventBus.emit(EVENTS.ACCOUNT_LOCKED, {
          userId: user.id,
          reason: '连续登录失败5次',
          lockMinutes: 15,
        }).catch(console.error);

        return res.status(403).json({ 
          error: '连续登录失败5次，账号已被锁定15分钟' 
        });
      } else {
        await prisma.user.update({
          where: { id: user.id },
          data: { failedLoginCount: newCount }
        });
      }

      return res.status(401).json({ error: '邮箱或密码错误' });
    }

    // Reset failed login count
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        failedLoginCount: 0,
        lockedUntil: null
      }
    });

    // Generate tokens
    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken();
    const refreshTokenHash = hashToken(refreshToken);

    const userAgent = req.headers['user-agent'] || '';
    const ip = (req.ip || req.headers['x-forwarded-for'] || '').toString();

    const recentLogins = await prisma.refreshToken.findMany({
      where: {
        userId: user.id,
        revokedAt: null,
        createdAt: {
          gt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
      take: 5,
      orderBy: { createdAt: 'desc' },
    });

    const isNewDevice = recentLogins.length === 0;

    // Store refresh token
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000)
      }
    });

    if (isNewDevice) {
      eventBus.emit(EVENTS.NEW_DEVICE_LOGIN, {
        userId: user.id,
        ip,
        userAgent,
        device: parseUserAgent(userAgent),
        loginTime: new Date(),
      }).catch(console.error);
    }

    checkInventoryReminder(user.id).catch(console.error);

    // Set refresh token cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === 'true',
      sameSite: 'lax',
      maxAge: REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000
    });

    res.json({
      message: '登录成功',
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Login error:', error);
    res.status(500).json({ error: '登录失败' });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ error: '未提供刷新令牌' });
    }

    const tokenHash = hashToken(refreshToken);

    const storedToken = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true }
    });

    if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
      return res.status(401).json({ error: '刷新令牌无效或已过期' });
    }

    // Generate new access token
    const accessToken = generateAccessToken(storedToken.userId);

    res.json({
      accessToken,
      user: {
        id: storedToken.user.id,
        email: storedToken.user.email,
        role: storedToken.user.role
      }
    });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ error: '刷新令牌失败' });
  }
});

// Logout
router.post('/logout', async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (refreshToken) {
      const tokenHash = hashToken(refreshToken);
      
      await prisma.refreshToken.updateMany({
        where: { tokenHash },
        data: { revokedAt: new Date() }
      });

      res.clearCookie('refreshToken');
    }

    res.json({ message: '退出登录成功' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: '退出登录失败' });
  }
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未提供访问令牌' });
    }

    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          role: true,
          enabled: true,
          createdAt: true
        }
      });

      if (!user) {
        return res.status(401).json({ error: '用户不存在' });
      }

      res.json({ user });
    } catch (jwtError) {
      return res.status(401).json({ error: '访问令牌无效或已过期' });
    }
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

export default router;
