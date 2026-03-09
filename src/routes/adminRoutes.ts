import { Router, Request, Response } from 'express';
import { Logger } from '../utils/logger.js';
import { AuthService } from '../services/authService.js';
import { AdminService } from '../services/adminService.js';
import { authenticateToken, authorizeRole } from '../middleware/authMiddleware.js';
import type { LoginRequest, UpdateUserRequest } from '../types/auth';

const router: Router = Router();
const authService = AuthService.getInstance();
const adminService = AdminService.getInstance();

/**
 * @openapi
 * /api/admin/login:
 *   post:
 *     summary: 管理员登录
 *     description: 管理员专用登录端点，仅允许 ADMIN 角色登录
 *     tags: [Admin]
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
 *                 example: admin@example.com
 *               password:
 *                 type: string
 *                 example: Admin123!@#
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
 *         description: 认证失败
 *       403:
 *         description: 权限不足（非管理员账户）
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

    // 检查是否为管理员角色
    if (result.user.role !== 'ADMIN') {
      res.status(403).json({
        success: false,
        message: 'Access denied: Admin privileges required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    Logger.info('管理员登录成功', { email, userId: result.user.id });

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
    Logger.error('管理员登录失败', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      message: `Login failed: ${(error as Error).message}`,
      timestamp: new Date().toISOString(),
    });
  }
});

// 所有管理端点都需要认证和管理员权限
router.use(authenticateToken);
router.use(authorizeRole('ADMIN'));

/**
 * @openapi
 * /api/admin/dashboard:
 *   get:
 *     summary: 获取管理员仪表板信息
 *     description: 获取服务器统计信息和用户统计数据
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功获取仪表板信息
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 serverInfo:
 *                   type: object
 *                 stats:
 *                   type: object
 *                 timestamp:
 *                   type: string
 *       401:
 *         description: 未授权
 *       403:
 *         description: 权限不足
 */
router.get('/dashboard', async (req: Request, res: Response): Promise<void> => {
  try {
    const dashboardInfo = await adminService.getDashboardInfo();

    Logger.info('管理员访问仪表板');

    res.json(dashboardInfo);
  } catch (error) {
    Logger.error('获取仪表板信息失败', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      message: `Failed to get dashboard info: ${(error as Error).message}`,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * @openapi
 * /api/admin/users:
 *   get:
 *     summary: 获取所有用户列表
 *     description: 获取系统中所有用户的列表（分页信息可在未来扩展）
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功获取用户列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 users:
 *                   type: array
 *                 total:
 *                   type: number
 *                 timestamp:
 *                   type: string
 *       401:
 *         description: 未授权
 *       403:
 *         description: 权限不足
 */
router.get('/users', async (req: Request, res: Response): Promise<void> => {
  try {
    const { users, total } = await adminService.getAllUsers();

    Logger.info('管理员获取用户列表', { total });

    res.json({
      success: true,
      users,
      total,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    Logger.error('获取用户列表失败', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      message: `Failed to get users: ${(error as Error).message}`,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * @openapi
 * /api/admin/users/{userId}:
 *   get:
 *     summary: 获取单个用户详情
 *     description: 通过用户 ID 获取用户详细信息
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: 用户 ID
 *     responses:
 *       200:
 *         description: 成功获取用户详情
 *       404:
 *         description: 用户不存在
 */
router.get('/users/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = Array.isArray(req.params.userId) 
      ? req.params.userId[0] 
      : req.params.userId;

    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID is required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const user = await adminService.getUserById(userId);

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
    Logger.error('获取用户详情失败', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      message: `Failed to get user: ${(error as Error).message}`,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * @openapi
 * /api/admin/users/{userId}:
 *   put:
 *     summary: 更新用户信息
 *     description: 管理员更新用户信息（邮箱、姓名、角色、激活状态）
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               name:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [USER, ADMIN]
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: 更新成功
 *       400:
 *         description: 请求参数错误
 *       404:
 *         description: 用户不存在
 */
router.put('/users/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = Array.isArray(req.params.userId) 
      ? req.params.userId[0] 
      : req.params.userId;

    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID is required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const updateData: UpdateUserRequest = req.body;

    // 如果要更新角色，需要获取角色 ID
    let dataToUpdate: any = {};
    
    if (updateData.role) {
      const { getOrCreateDefaultRoles } = authService;
      const roles = await getOrCreateDefaultRoles();
      const targetRole = updateData.role === 'ADMIN' ? roles.adminRole : roles.userRole;
      dataToUpdate.roleId = targetRole.id;
    }

    if (updateData.email) dataToUpdate.email = updateData.email;
    if (updateData.name) dataToUpdate.name = updateData.name;
    if (updateData.isActive !== undefined) dataToUpdate.isActive = updateData.isActive;

    const updatedUser = await adminService.updateUser(userId, dataToUpdate);

    Logger.info('用户信息更新成功', { userId });

    res.json({
      success: true,
      user: updatedUser,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    Logger.error('更新用户失败', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      message: `Failed to update user: ${(error as Error).message}`,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * @openapi
 * /api/admin/users/{userId}:
 *   delete:
 *     summary: 删除用户
 *     description: 管理员删除指定用户（不能删除最后一个管理员）
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 删除成功
 *       400:
 *         description: 无法删除最后一个管理员
 *       404:
 *         description: 用户不存在
 */
router.delete('/users/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = Array.isArray(req.params.userId) 
      ? req.params.userId[0] 
      : req.params.userId;

    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID is required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    await adminService.deleteUser(userId);

    Logger.info('用户删除成功', { userId });

    res.json({
      success: true,
      message: 'User deleted successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    Logger.error('删除用户失败', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      message: `Failed to delete user: ${(error as Error).message}`,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
