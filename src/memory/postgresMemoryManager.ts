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
  private isInitialized: boolean = false;

  private constructor() {}

  public static getInstance(): PostgresMemoryManager {
    if (!PostgresMemoryManager.instance) {
      PostgresMemoryManager.instance = new PostgresMemoryManager();
    }
    return PostgresMemoryManager.instance;
  }

  /**
   * チェックポインターを取得
   */
  public async getCheckpointer(): Promise<PostgresSaver> {
    if (!this.checkpointer) {
      Logger.info('Initializing PostgresSaver with DATABASE_URL...');
      
      try {
        // config.database.url を使用して PostgresSaver を作成
        // PostgresSaver.fromConnString は接続文字列を受け取る
        this.checkpointer = PostgresSaver.fromConnString(config.database.url);
        
        // 初回使用時は setup() を呼び出してテーブルを作成
        if (!this.isInitialized) {
          Logger.info('Setting up PostgresSaver schema...');
          await this.checkpointer.setup();
          this.isInitialized = true;
          Logger.info('PostgresSaver schema setup completed');
        }
      } catch (error) {
        Logger.error('Failed to initialize PostgresSaver', { error: (error as Error).message });
        throw error;
      }
    }
    return this.checkpointer;
  }

  /**
   * リソースを解放
   */
  public async close(): Promise<void> {
    // Note: PostgresSaver may not have an explicit close if it uses a shared pool, 
    // but we check for any cleanup needs
  }
}
