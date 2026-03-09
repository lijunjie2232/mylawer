import { Logger } from '../utils/logger.js';
import { DatabaseService } from './databaseService.js';
import type { ServerStats, DashboardResponse } from '../types/auth';

export class AdminService {
  private static instance: AdminService;

  private constructor() {}

  /**
   * 获取单例实例
   */
  public static getInstance(): AdminService {
    if (!AdminService.instance) {
      AdminService.instance = new AdminService();
    }
    return AdminService.instance;
  }

  /**
   * 获取服务器统计信息
   */
  public getServerStats(): ServerStats {
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    
    return {
      uptime: Math.floor(uptime),
      memory: {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
        free: Math.round((memoryUsage.heapTotal - memoryUsage.heapUsed) / 1024 / 1024), // MB
      },
      platform: process.platform,
      nodeVersion: process.version,
      cpuCores: require('os').cpus().length,
    };
  }

  /**
   * 获取用户统计信息
   */
  public async getUserStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    adminUsers: number;
  }> {
    try {
      const prisma = DatabaseService.getInstance();

      const [totalUsers, activeUsers, adminUsers] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { isActive: true } }),
        prisma.user.count({
          where: {
            role: {
              name: 'ADMIN',
            },
          },
        }),
      ]);

      return {
        totalUsers,
        activeUsers,
        adminUsers,
      };
    } catch (error) {
      Logger.error('获取用户统计失败', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * 获取仪表板完整信息
   */
  public async getDashboardInfo(): Promise<DashboardResponse> {
    const serverInfo = this.getServerStats();
    const stats = await this.getUserStats();

    return {
      success: true,
      serverInfo,
      stats,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 获取所有用户列表
   */
  public async getAllUsers(): Promise<{
    users: any[];
    total: number;
  }> {
    try {
      const prisma = DatabaseService.getInstance();

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          include: {
            role: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        }),
        prisma.user.count(),
      ]);

      const formattedUsers = users.map(user => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role.name,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }));

      return {
        users: formattedUsers,
        total,
      };
    } catch (error) {
      Logger.error('获取用户列表失败', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * 获取单个用户详情
   */
  public async getUserById(userId: string): Promise<any | null> {
    try {
      const prisma = DatabaseService.getInstance();

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          role: true,
        },
      });

      if (!user) {
        return null;
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role.name,
        roleId: user.roleId,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    } catch (error) {
      Logger.error('获取用户详情失败', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * 更新用户信息
   */
  public async updateUser(
    userId: string,
    data: {
      email?: string;
      name?: string;
      roleId?: string;
      isActive?: boolean;
    }
  ): Promise<any> {
    try {
      const prisma = DatabaseService.getInstance();

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data,
        include: {
          role: true,
        },
      });

      Logger.info('用户信息更新成功', { userId });

      return {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role.name,
        isActive: updatedUser.isActive,
        lastLoginAt: updatedUser.lastLoginAt,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt,
      };
    } catch (error) {
      Logger.error('更新用户失败', { 
        userId, 
        error: (error as Error).message 
      });
      throw error;
    }
  }

  /**
   * 删除用户
   */
  public async deleteUser(userId: string): Promise<void> {
    try {
      const prisma = DatabaseService.getInstance();

      // 检查是否是最后一个管理员
      if (userId) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          include: { role: true },
        });

        if (user && user.role.name === 'ADMIN') {
          const adminCount = await prisma.user.count({
            where: {
              role: {
                name: 'ADMIN',
              },
            },
          });

          if (adminCount <= 1) {
            throw new Error('Cannot delete the last admin user');
          }
        }
      }

      await prisma.user.delete({
        where: { id: userId },
      });

      Logger.info('用户删除成功', { userId });
    } catch (error) {
      Logger.error('删除用户失败', { 
        userId, 
        error: (error as Error).message 
      });
      throw error;
    }
  }
}
