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
   * シングルトンインスタンスを取得
   */
  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * パスワードをハッシュ化
   */
  public async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * パスワードを検証
   */
  public async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * JWT トークンを生成
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
   * JWT トークンを検証
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
   * メールアドレスでユーザーを検索
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

      // ユーザーがアクティブか確認
      if (!user.isActive) {
        Logger.warn('ユーザーが無効化されています', { email: credentials.email });
        return null;
      }

      // パスワードを検証
      const isValidPassword = await this.verifyPassword(
        credentials.password,
        user.passwordHash
      );

      if (!isValidPassword) {
        Logger.warn('パスワードが間違っています', { email: credentials.email });
        return null;
      }

      // 最終ログイン時間を更新
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date(),
        },
      });

      // トークンを生成
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
      Logger.error('ログインに失敗しました', { error: (error as Error).message });
      return null;
    }
  }

  /**
   * デフォルトロールを取得または作成
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
          description: '一般ユーザー',
          permissions: ['read:own_profile', 'update:own_profile'],
        },
      });
      Logger.info('USER ロールの作成に成功しました');
    }

    let adminRole = await this.prisma.role.findUnique({
      where: { name: 'ADMIN' },
    });

    if (!adminRole) {
      adminRole = await this.prisma.role.create({
        data: {
          name: 'ADMIN',
          description: '管理者',
          permissions: [
            'read:all_users',
            'update:all_users',
            'delete:all_users',
            'read:server_stats',
            'manage:system',
          ],
        },
      });
      Logger.info('ADMIN ロールの作成に成功しました');
    }

    return { userRole, adminRole };
  }

  /**
   * デフォルト管理者アカウントを初期化
   */
  public async initializeDefaultAdmin(): Promise<void> {
    try {
      const { adminRole } = await this.getOrCreateDefaultRoles();

      // 管理者が既に存在するか確認
      const existingAdmin = await this.prisma.user.findFirst({
        where: {
          email: config.auth.defaultAdminEmail,
          role: {
            name: 'ADMIN',
          },
        },
      });

      if (existingAdmin) {
        Logger.info('デフォルト管理者アカウントは既に存在します', { email: config.auth.defaultAdminEmail });
        return;
      }

      // デフォルト管理者を作成
      await this.createUser({
        email: config.auth.defaultAdminEmail,
        password: config.auth.defaultAdminPassword,
        name: 'System Administrator',
        roleId: adminRole.id,
      });

      Logger.info('デフォルト管理者アカウントの作成に成功しました', { 
        email: config.auth.defaultAdminEmail,
        role: 'ADMIN' 
      });
    } catch (error) {
      Logger.error('デフォルト管理者の初期化に失敗しました', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * ユーザーアカウントとその関連データをすべて削除
   */
  public async deleteAccount(userId: string): Promise<boolean> {
    try {
      // Prisma スキーマで onDelete: Cascade が設定されているため、ユーザーを削除するとそのセッションとメッセージも同時に削除されます
      await this.prisma.user.delete({
        where: { id: userId },
      });
      Logger.info('ユーザーアカウントが削除されました', { userId });
      return true;
    } catch (error) {
      Logger.error('アカウント削除に失敗しました', { userId, error: (error as Error).message });
      throw new Error(`Failed to delete account: ${(error as Error).message}`);
    }
  }
}
