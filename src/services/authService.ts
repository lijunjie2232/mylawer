import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { config } from '../config/environment.js';
import { Logger } from '../utils/logger.js';
import { DatabaseService } from './databaseService.js';
import type { 
  LoginRequest, 
  SignupRequest, 
  JWTPayload, 
  User, 
  UserRole,
  UserWithPasswordHash 
} from '../types/auth';

export class AuthService {
  private prisma: PrismaClient;
  private static instance: AuthService;

  private constructor() {
    this.prisma = DatabaseService.getInstance();
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * 密码哈希
   */
  public async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * 验证密码
   */
  public async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * 生成 JWT Token
   */
  public generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    const tokenPayload: JWTPayload = {
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + config.auth.jwtExpiresIn,
    };

    return jwt.sign(tokenPayload, config.auth.jwtSecret, {
      algorithm: 'HS256',
    });
  }

  /**
   * 验证 JWT Token
   */
  public verifyToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, config.auth.jwtSecret, {
        algorithms: ['HS256'],
      }) as JWTPayload;
    } catch (error) {
      throw new Error(`Invalid token: ${(error as Error).message}`);
    }
  }

  /**
   * 通过邮箱查找用户
   */
  public async findUserByEmail(email: string): Promise<UserWithPasswordHash | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
        include: {
          role: true,
        },
      });

      if (!user) return null;

      // 型アサーション、Prisma の戻り値の型は定義と若干異なるため
      return user as UserWithPasswordHash;
    } catch (error) {
      Logger.error('ユーザー検索エラー', { error: (error as Error).message });
      return null;
    }
  }

  /**
   * ID でユーザーを検索
   */
  public async findUserById(userId: string): Promise<User | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          role: true,
        },
      });

      if (!user) return null;

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role.name as UserRole,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt || undefined,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    } catch (error) {
      Logger.error('ユーザー検索エラー', { error: (error as Error).message });
      return null;
    }
  }

  /**
   * 新しいユーザーを作成
   */
  public async createUser(data: SignupRequest & { roleId: string }): Promise<User> {
    try {
      const passwordHash = await this.hashPassword(data.password);

      const user = await this.prisma.user.create({
        data: {
          email: data.email,
          passwordHash,
          name: data.name,
          roleId: data.roleId,
          isActive: true,
        },
        include: {
          role: true,
        },
      });

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role.name as UserRole,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt || undefined,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    } catch (error) {
      Logger.error('ユーザーの作成に失敗しました', { error: (error as Error).message });
      throw new Error(`Failed to create user: ${(error as Error).message}`);
    }
  }

  /**
   * ユーザーログイン
   */
  public async login(credentials: LoginRequest): Promise<{
    token: string;
    user: User;
  } | null> {
    try {
      // ユーザーを検索
      const user = await this.findUserByEmail(credentials.email);

      if (!user) {
        Logger.warn('ユーザーが存在しません', { email: credentials.email });
        return null;
      }

      // 检查用户是否激活
      if (!user.isActive) {
        Logger.warn('用户已被禁用', { email: credentials.email });
        return null;
      }

      // 验证密码
      const isValidPassword = await this.verifyPassword(
        credentials.password,
        user.passwordHash
      );

      if (!isValidPassword) {
        Logger.warn('密码错误', { email: credentials.email });
        return null;
      }

      // 更新最后登录时间
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date(),
        },
      });

      // 生成 Token
      const token = this.generateToken({
        userId: user.id,
        email: user.email,
        role: user.role.name as UserRole,
      });

      const userData: User = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role.name as UserRole,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt || undefined,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };

      return {
        token,
        user: userData,
      };
    } catch (error) {
      Logger.error('登录失败', { error: (error as Error).message });
      return null;
    }
  }

  /**
   * 获取或创建默认角色
   */
  public async getOrCreateDefaultRoles(): Promise<{
    userRole: any;
    adminRole: any;
  }> {
    let userRole = await this.prisma.role.findUnique({
      where: { name: 'USER' },
    });

    if (!userRole) {
      userRole = await this.prisma.role.create({
        data: {
          name: 'USER',
          description: '普通用户',
          permissions: ['read:own_profile', 'update:own_profile'],
        },
      });
      Logger.info('创建 USER 角色成功');
    }

    let adminRole = await this.prisma.role.findUnique({
      where: { name: 'ADMIN' },
    });

    if (!adminRole) {
      adminRole = await this.prisma.role.create({
        data: {
          name: 'ADMIN',
          description: '管理员',
          permissions: [
            'read:all_users',
            'update:all_users',
            'delete:all_users',
            'read:server_stats',
            'manage:system',
          ],
        },
      });
      Logger.info('创建 ADMIN 角色成功');
    }

    return { userRole, adminRole };
  }

  /**
   * 初始化默认管理员账户
   */
  public async initializeDefaultAdmin(): Promise<void> {
    try {
      const { adminRole } = await this.getOrCreateDefaultRoles();

      // 检查是否已存在管理员
      const existingAdmin = await this.prisma.user.findFirst({
        where: {
          email: config.auth.defaultAdminEmail,
          role: {
            name: 'ADMIN',
          },
        },
      });

      if (existingAdmin) {
        Logger.info('默认管理员账户已存在', { email: config.auth.defaultAdminEmail });
        return;
      }

      // 创建默认管理员
      await this.createUser({
        email: config.auth.defaultAdminEmail,
        password: config.auth.defaultAdminPassword,
        name: 'System Administrator',
        roleId: adminRole.id,
      });

      Logger.info('默认管理员账户创建成功', { 
        email: config.auth.defaultAdminEmail,
        role: 'ADMIN' 
      });
    } catch (error) {
      Logger.error('初始化默认管理员失败', { error: (error as Error).message });
      throw error;
    }
  }
}
