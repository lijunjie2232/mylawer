import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Logger } from '../utils/logger.js';
import pg from 'pg';
import { config } from '../config/environment.js';

// シングルトンパターンで Prisma Client を管理
let prismaInstance: PrismaClient | null = null;

export class DatabaseService {
  /**
   * Prisma Client のシングルトンを取得
   */
  public static getInstance(): PrismaClient {
    if (!prismaInstance) {
      // PostgreSQL 接続プールを作成
      const pool = new pg.Pool({
        connectionString: config.database.url,
      });
      
      // Prisma アダプターを作成
      const adapter = new PrismaPg(pool);
      
      // アダプターを使用して Prisma Client を初期化
      prismaInstance = new PrismaClient({
        adapter,
        log: ['query', 'error', 'warn'],
      });
      
      Logger.info('Prisma Client の初期化が完了しました');
    }
    return prismaInstance;
  }

  /**
   * データベースに接続
   */
  public static async connect(): Promise<void> {
    const prisma = this.getInstance();
    
    try {
      await prisma.$connect();
      Logger.info('データベース接続成功');
    } catch (error) {
      Logger.error('データベース接続失敗', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * データベース接続を切断
   */
  public static async disconnect(): Promise<void> {
    if (prismaInstance) {
      await prismaInstance.$disconnect();
      prismaInstance = null;
      Logger.info('データベース接続を切断しました');
    }
  }
}
