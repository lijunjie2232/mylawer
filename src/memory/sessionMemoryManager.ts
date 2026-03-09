import { Logger } from '../utils/logger.js';
import { BaseMessage } from '@langchain/core/messages';

/**
 * セッションメモリマネージャー
 * 異なるユーザーの対話履歴とメモリ状態を管理
 */
export class SessionMemoryManager {
  private static instance: SessionMemoryManager;
  private sessions: Map<string, SessionData>;
  private readonly maxSessionAge: number = 30 * 60 * 1000; // 30分間
  private readonly maxMessagesPerSession: number = 20; // セッションあたりの最大メッセージ数
  private readonly cleanupInterval: number = 5 * 60 * 1000; // 5分間クリーンアップ間隔

  private constructor() {
    this.sessions = new Map();
    this.startCleanupTimer();
    Logger.info('SessionMemoryManager initialized');
  }

  public static getInstance(): SessionMemoryManager {
    if (!SessionMemoryManager.instance) {
      SessionMemoryManager.instance = new SessionMemoryManager();
    }
    return SessionMemoryManager.instance;
  }

  /**
   * セッションを取得または作成
   */
  public getSession(sessionId: string): SessionData {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        sessionId,
        messages: [],
        createdAt: new Date(),
        lastAccessed: new Date(),
        context: {}
      });
      Logger.info('Created new session', { sessionId });
    }

    const session = this.sessions.get(sessionId)!;
    session.lastAccessed = new Date();
    return session;
  }

  /**
   * メッセージをセッションに追加
   */
  public addMessage(sessionId: string, message: BaseMessage): void {
    const session = this.getSession(sessionId);
    session.messages.push(message);
    
    // メッセージ数が制限を超えた場合、最も古いメッセージを削除
    if (session.messages.length > this.maxMessagesPerSession) {
      session.messages.shift();
      Logger.debug('Trimmed old message from session', { 
        sessionId, 
        messageCount: session.messages.length 
      });
    }
    
    Logger.debug('Added message to session', { 
      sessionId, 
      messageType: message._getType(),
      messageCount: session.messages.length 
    });
  }

  /**
   * セッションのすべてのメッセージを取得
   */
  public getMessages(sessionId: string): BaseMessage[] {
    const session = this.getSession(sessionId);
    return [...session.messages]; // 外部変更を防ぐためにコピーを返す
  }

  /**
   * セッションメッセージをクリア
   */
  public clearSession(sessionId: string): void {
    if (this.sessions.has(sessionId)) {
      this.sessions.delete(sessionId);
      Logger.info('Cleared session', { sessionId });
    }
  }

  /**
   * 更新会话上下文
   */
  public updateContext(sessionId: string, context: Record<string, any>): void {
    const session = this.getSession(sessionId);
    session.context = { ...session.context, ...context };
    Logger.debug('Updated session context', { sessionId, contextKeys: Object.keys(context) });
  }

  /**
   * 获取会话上下文
   */
  public getContext(sessionId: string): Record<string, any> {
    const session = this.getSession(sessionId);
    return { ...session.context };
  }

  /**
   * 获取会话统计信息
   */
  public getSessionStats(): SessionStats {
    const now = new Date();
    const activeSessions = Array.from(this.sessions.values())
      .filter(session => 
        now.getTime() - session.lastAccessed.getTime() < this.maxSessionAge
      );

    return {
      totalSessions: this.sessions.size,
      activeSessions: activeSessions.length,
      averageMessagesPerSession: activeSessions.length > 0 
        ? activeSessions.reduce((sum, session) => sum + session.messages.length, 0) / activeSessions.length
        : 0,
      oldestSession: activeSessions.length > 0 
        ? Math.min(...activeSessions.map(s => s.createdAt.getTime()))
        : null
    };
  }

  /**
   * 启动定时清理任务
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