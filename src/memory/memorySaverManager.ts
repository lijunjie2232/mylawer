import { Logger } from '../utils/logger.js';
import { BaseMessage } from '@langchain/core/messages';
import { LegalAgent } from '../agents/legalAgent.js';
import { PostgresMemoryManager } from './postgresMemoryManager.js';
import type { ModelConfig } from '../models/modelManager.js';

/**
 * MemorySaverベースのセッションマネージャー
 * LangChainのMemorySaverを使用してセッション状態を管理
 */
export class MemorySaverManager {
  private static instance: MemorySaverManager;
  private sessions: Map<string, SessionData>;
  /**
   * モデル設定ごとの LegalAgent キャッシュ。
   * LegalAgent はスレッド ID を呼び出しごとに受け取るステートレスな実行器のため、
   * セッションごとに initChatModel / createAgent を再実行せず再利用する。
   */
  private agentsByModel: Map<string, LegalAgent> = new Map();
  private readonly maxSessionAge: number = 30 * 60 * 1000; // 30分間
  private readonly maxMessagesPerSession: number = 20; // セッションあたりの最大メッセージ数
  private readonly cleanupInterval: number = 5 * 60 * 1000; // 5分間クリーンアップ間隔

  private constructor() {
    this.sessions = new Map();
    this.startCleanupTimer();
    Logger.info('MemorySaverManager initialized');
  }

  private modelKey(modelConfig: ModelConfig): string {
    return [
      modelConfig.provider,
      modelConfig.baseUrl,
      modelConfig.name,
      modelConfig.maxTokens,
      modelConfig.temperature,
    ].join('|');
  }

  /**
   * 指定モデル設定の LegalAgent をキャッシュから取得（なければ作成・初期化）。
   */
  public async getOrCreateAgent(modelConfig: ModelConfig): Promise<LegalAgent> {
    const key = this.modelKey(modelConfig);
    let agent = this.agentsByModel.get(key);
    if (!agent) {
      agent = new LegalAgent(modelConfig);
      this.agentsByModel.set(key, agent);
    }
    try {
      await agent.ensureReady();
      return agent;
    } catch (error) {
      if (this.agentsByModel.get(key) === agent && !agent.isReady()) {
        this.agentsByModel.delete(key);
      }
      throw error;
    }
  }

  /**
   * サーバー起動時に既定モデルのエージェントを事前ウォームアップする。
   */
  public async warmupModel(modelConfig: ModelConfig): Promise<void> {
    await this.getOrCreateAgent(modelConfig);
  }

  public static getInstance(): MemorySaverManager {
    if (!MemorySaverManager.instance) {
      MemorySaverManager.instance = new MemorySaverManager();
    }
    return MemorySaverManager.instance;
  }

  /**
   * 新しいセッションを作成（セッションIDのみを返し、エージェントは作成しない）
   */
  public createNewSession(): string {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.sessions.set(sessionId, {
      sessionId,
      messages: [],
      createdAt: new Date(),
      lastAccessed: new Date(),
      context: {},
      agent: null // エージェントを即座に作成しない
    });
    
    Logger.info('Created new session without agent', { sessionId });
    return sessionId;
  }

  /**
   * セッションデータを取得
   */
  public getSession(sessionId: string): SessionData | null {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastAccessed = new Date();
    }
    return session || null;
  }

  /**
   * セッション用のエージェントを取得（モデル単位のキャッシュを再利用し、モデル切替にも対応）
   */
  public async createAgentForSession(sessionId: string, modelConfig: ModelConfig): Promise<LegalAgent> {
    let session = this.getSession(sessionId);

    // セッションが存在しない場合は自動作成
    if (!session) {
      this.sessions.set(sessionId, {
        sessionId,
        messages: [],
        createdAt: new Date(),
        lastAccessed: new Date(),
        context: {},
        agent: null
      });
      session = this.getSession(sessionId)!;
    }

    const agent = await this.getOrCreateAgent(modelConfig);
    session.agent = agent;
    return agent;
  }

  /**
   * 添加消息到会话（如果会话不存在则自动创建）
   */
  public addMessage(sessionId: string, message: BaseMessage): void {
    let session = this.getSession(sessionId);
    
    // セッションが存在しない場合は自動作成
    if (!session) {
      Logger.warn('セッションが見つからないため、新規作成します', { sessionId });
      this.sessions.set(sessionId, {
        sessionId,
        messages: [],
        createdAt: new Date(),
        lastAccessed: new Date(),
        context: {},
        agent: null
      });
      session = this.getSession(sessionId)!;
    }

    session.messages.push(message);
    
    // 修剪消息历史
    if (session.messages.length > this.maxMessagesPerSession) {
      session.messages = session.messages.slice(-this.maxMessagesPerSession);
    }

    Logger.debug('Message added to session', { 
      sessionId, 
      messageType: message._getType(),
      messageCount: session.messages.length 
    });
  }

  /**
   * 获取会话消息
   */
  public getMessages(sessionId: string): BaseMessage[] {
    const session = this.getSession(sessionId);
    return session ? session.messages : [];
  }

  /**
   * 清理会话
   * エージェントキャッシュに加え、LangGraph のチェックポイント（会話履歴）も削除する
   */
  public async clearSession(sessionId: string): Promise<void> {
    const session = this.getSession(sessionId);
    if (session) {
      session.messages = [];
      session.context = {};
      session.agent = null;
    }

    const checkpointer = await PostgresMemoryManager.getInstance().getCheckpointer();
    await checkpointer.deleteThread(sessionId);

    Logger.info('Session cleared', { sessionId });
  }

  /**
   * 获取会话上下文（如果会话不存在则返回空对象）
   */
  public getContext(sessionId: string): Record<string, any> {
    const session = this.getSession(sessionId);
    return session ? session.context : {};
  }

  /**
   * 更新会话上下文（如果会话不存在则自动创建）
   */
  public updateContext(sessionId: string, context: Record<string, any>): void {
    let session = this.getSession(sessionId);
    
    // セッションが存在しない場合は自動作成
    if (!session) {
      Logger.warn('セッションが見つからないため、新規作成してコンテキストを更新します', { sessionId });
      this.sessions.set(sessionId, {
        sessionId,
        messages: [],
        createdAt: new Date(),
        lastAccessed: new Date(),
        context: {},
        agent: null
      });
      session = this.getSession(sessionId)!;
    }
    
    session.context = { ...session.context, ...context };
  }

  /**
   * 获取会话统计信息
   */
  public getSessionStats(): SessionStats {
    const now = new Date();
    let totalMessages = 0;
    let oldestSession: number | null = null;

    for (const session of this.sessions.values()) {
      totalMessages += session.messages.length;
      const sessionAge = now.getTime() - session.createdAt.getTime();
      if (oldestSession === null || sessionAge > oldestSession) {
        oldestSession = sessionAge;
      }
    }

    return {
      totalSessions: this.sessions.size,
      activeSessions: this.sessions.size, // 简化处理
      averageMessagesPerSession: this.sessions.size > 0 ? totalMessages / this.sessions.size : 0,
      oldestSession
    };
  }

  /**
   * 启动定期清理定时器
   */
  private startCleanupTimer(): void {
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, this.cleanupInterval);
  }

  /**
   * 清理过期会话
   */
  private cleanupExpiredSessions(): void {
    const now = new Date();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now.getTime() - session.lastAccessed.getTime() > this.maxSessionAge) {
        this.sessions.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      Logger.info('Cleaned expired sessions', { cleanedCount, remainingSessions: this.sessions.size });
    }
  }
}

/**
 * 会话数据接口
 */
export interface SessionData {
  sessionId: string;
  messages: BaseMessage[];
  createdAt: Date;
  lastAccessed: Date;
  context: Record<string, any>;
  agent: LegalAgent | null; // LegalAgent实例，初始为null
}

/**
 * 会话统计信息接口
 */
export interface SessionStats {
  totalSessions: number;
  activeSessions: number;
  averageMessagesPerSession: number;
  oldestSession: number | null;
}