import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Logger } from '../utils/logger.js';
import pg from 'pg';
import { config } from '../config/environment.js';

// 单例模式管理 Prisma Client
let prismaInstance: PrismaClient | null = null;

export class DatabaseService {
  /**
   * 获取 Prisma Client 单例
   */
  public static getInstance(): PrismaClient {
    if (!prismaInstance) {
      // 创建 PostgreSQL 连接池
      const pool = new pg.Pool({
        connectionString: config.database.url,
      });
      
      // 创建 Prisma 适配器
      const adapter = new PrismaPg(pool);
      
      // 使用适配器初始化Prisma Client
      prismaInstance = new PrismaClient({
        adapter,
        log: ['query', 'error', 'warn'],
      });
      
      Logger.info('Prisma Client 初始化成功');
    }
    return prismaInstance;
  }

  /**
   * 连接数据库
   */
  public static async connect(): Promise<void> {
    const prisma = this.getInstance();
    
    try {
      await prisma.$connect();
      Logger.info('数据库连接成功');
    } catch (error) {
      Logger.error('数据库连接失败', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * 断开数据库连接
   */
  public static async disconnect(): Promise<void> {
    if (prismaInstance) {
      await prismaInstance.$disconnect();
      prismaInstance = null;
      Logger.info('数据库连接已断开');
    }
  }
}
