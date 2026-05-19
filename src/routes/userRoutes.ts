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
 *     summary: ユーザー登録
 *     description: 新しい一般ユーザーアカウントを作成
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
 *                 example: ユーザー名
 *     responses:
 *       201:
 *         description: ユーザー作成成功
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
 *         description: リクエストパラメータエラー
 *       409:
 *         description: メールアドレスは既に登録されています
 */
router.post('/signup', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name }: SignupRequest = req.body;

    // 必須フィールドを検証
    if (!email || !password || !name) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: email, password, and name are required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // メールアドレス形式を検証
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({
        success: false,
        message: 'Invalid email format',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // パスワード強度を検証
    if (password.length < 8) {
      res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // メールアドレスが既に存在するか確認
    const existingUser = await authService.findUserByEmail(email);
    if (existingUser) {
      res.status(409).json({
        success: false,
        message: 'Email already registered',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // USER ロールを取得または作成
    const { userRole } = await authService.getOrCreateDefaultRoles();

    // ユーザーを作成
    const user = await authService.createUser({
      email,
      password,
      name,
      roleId: userRole.id,
    });

    Logger.info('ユーザー登録成功', { email, userId: user.id });

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
    Logger.error('ユーザー登録失敗', { error: (error as Error).message });
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
 *     summary: ユーザーログイン
 *     description: ユーザーログインして JWT トークンを取得
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

/**
 * @openapi
 * /api/user/delete:
 *   delete:
 *     summary: 删除当前用户账户
 *     description: 彻底删除当前登录用户的账户及其所有聊天记录
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 账户删除成功
 *       401:
 *         description: 未授权
 */
router.delete('/delete', authenticateToken, async (req: any, res: Response): Promise<void> => {
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

    await authService.deleteAccount(userId);

    res.json({
      success: true,
      message: 'Account and all associated data deleted successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    Logger.error('删除账户失败', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      message: `Failed to delete account: ${(error as Error).message}`,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
