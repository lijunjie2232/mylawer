import { Router, Request, Response } from 'express';
import { Logger } from '../utils/logger.js';
import { AuthService } from '../services/authService.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import type { LoginRequest, SignupRequest } from '../types/auth';

const router: Router = Router();
const authService = AuthService.getInstance();

/**
 * @openapi
 * /api/user/signup:
 *   post:
 *     summary: 用户注册
 *     description: 创建新的普通用户账户
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: Password123!
 *               name:
 *                 type: string
 *                 example: 用户名
 *     responses:
 *       201:
 *         description: 用户创建成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 user:
 *                   type: object
 *                 timestamp:
 *                   type: string
 *       400:
 *         description: 请求参数错误
 *       409:
 *         description: 邮箱已被注册
 */
router.post('/signup', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name }: SignupRequest = req.body;

    // 验证必填字段
    if (!email || !password || !name) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: email, password, and name are required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({
        success: false,
        message: 'Invalid email format',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // 验证密码强度
    if (password.length < 8) {
      res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // 检查邮箱是否已存在
    const existingUser = await authService.findUserByEmail(email);
    if (existingUser) {
      res.status(409).json({
        success: false,
        message: 'Email already registered',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // 获取或创建 USER 角色
    const { userRole } = await authService.getOrCreateDefaultRoles();

    // 创建用户
    const user = await authService.createUser({
      email,
      password,
      name,
      roleId: userRole.id,
    });

    Logger.info('用户注册成功', { email, userId: user.id });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    Logger.error('用户注册失败', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      message: `Failed to create user: ${(error as Error).message}`,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * @openapi
 * /api/user/login:
 *   post:
 *     summary: 用户登录
 *     description: 用户登录并获取 JWT Token
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 example: Password123!
 *     responses:
 *       200:
 *         description: 登录成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 token:
 *                   type: string
 *                 expiresIn:
 *                   type: number
 *                 user:
 *                   type: object
 *                 timestamp:
 *                   type: string
 *       401:
 *         description: 认证失败（邮箱或密码错误）
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password }: LoginRequest = req.body;

    // 验证必填字段
    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Email and password are required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // 尝试登录
    const result = await authService.login({ email, password });

    if (!result) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    Logger.info('用户登录成功', { email, userId: result.user.id });

    res.json({
      success: true,
      token: result.token,
      expiresIn: parseInt(process.env.JWT_EXPIRES_IN || '86400'),
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    Logger.error('用户登录失败', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      message: `Login failed: ${(error as Error).message}`,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * @openapi
 * /api/user/profile:
 *   get:
 *     summary: 获取当前用户信息
 *     description: 需要认证的端点，返回当前登录用户的详细信息
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功获取用户信息
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 user:
 *                   type: object
 *                 timestamp:
 *                   type: string
 *       401:
 *         description: 未授权
 */
router.get('/profile', authenticateToken, async (req: any, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User ID not found in token',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const user = await authService.findUserById(userId);

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.json({
      success: true,
      user,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    Logger.error('获取用户信息失败', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      message: `Failed to get user profile: ${(error as Error).message}`,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
