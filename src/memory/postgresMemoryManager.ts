import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { config } from '../config/environment.js';
import { Logger } from '../utils/logger.js';

/**
 * PostgreSQLベースのセッションマネージャー
 * LangGraphのPostgresSaverを使用してセッション状態をデータベースに永続化
 */
export class PostgresMemoryManager {
  private static instance: PostgresMemoryManager;
  private checkpointer: PostgresSaver | null = null;
  private initPromise: Promise<PostgresSaver> | null = null;

  private constructor() {}

  public static getInstance(): PostgresMemoryManager {
    if (!PostgresMemoryManager.instance) {
      PostgresMemoryManager.instance = new PostgresMemoryManager();
    }
    return PostgresMemoryManager.instance;
  }

  /**
   * チェックポインターを取得（並行呼び出しでも setup() は 1 回だけ実行する）
   */
  public async getCheckpointer(): Promise<PostgresSaver> {
    if (this.checkpointer) {
      return this.checkpointer;
    }
    if (!this.initPromise) {
      this.initPromise = this.initializeCheckpointer().catch(error => {
        this.initPromise = null;
        this.checkpointer = null;
        throw error;
      });
    }
    return await this.initPromise;
  }

  private async initializeCheckpointer(): Promise<PostgresSaver> {
    Logger.info('Initializing PostgresSaver with DATABASE_URL...');
    try {
      const checkpointer = PostgresSaver.fromConnString(config.database.url);
      Logger.info('Setting up PostgresSaver schema...');
      await checkpointer.setup();
      this.checkpointer = checkpointer;
      Logger.info('PostgresSaver schema setup completed');
      return checkpointer;
    } catch (error) {
      Logger.error('Failed to initialize PostgresSaver', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * リソースを解放
   */
  public async close(): Promise<void> {
    // Note: PostgresSaver may not have an explicit close if it uses a shared pool, 
    // but we check for any cleanup needs
  }
}
