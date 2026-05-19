import { PrismaClient } from '@prisma/client';
import { DatabaseService } from './databaseService.js';
import { Logger } from '../utils/logger.js';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export class ChatService {
  private prisma: PrismaClient;
  private static instance: ChatService;

  private constructor() {
    this.prisma = DatabaseService.getInstance();
  }

  public static getInstance(): ChatService {
    if (!ChatService.instance) {
      ChatService.instance = new ChatService();
    }
    return ChatService.instance;
  }

  /**
   * 新しいチャットセッションを作成
   */
  public async createSession(userId: string, title?: string) {
    try {
      return await this.prisma.chatSession.create({
        data: {
          userId,
          title: title || '新しいセッション',
        },
      });
    } catch (error) {
      Logger.error('セッション作成に失敗しました', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * 単一セッションの詳細を取得
   */
  public async getSession(sessionId: string, userId: string) {
    try {
      const session = await this.prisma.chatSession.findUnique({
        where: { id: sessionId },
      });

      if (!session || session.userId !== userId) {
        return null;
      }

      return session;
    } catch (error) {
      Logger.error('セッション詳細の取得に失敗しました', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * ユーザーのすべてのセッションを取得
   */
  public async getUserSessions(userId: string) {
    try {
      return await this.prisma.chatSession.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
      });
    } catch (error) {
      Logger.error('ユーザーセッションの取得に失敗しました', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * セッションのメッセージ履歴を取得
   */
  public async getSessionMessages(sessionId: string) {
    try {
      return await this.prisma.message.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'asc' },
      });
    } catch (error) {
      Logger.error('セッションメッセージの取得に失敗しました', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * セッションにメッセージを追加
   */
  public async addMessage(sessionId: string, message: ChatMessage) {
    try {
      const newMessage = await this.prisma.message.create({
        data: {
          sessionId,
          role: message.role,
          content: message.content,
        },
      });

      // セッションの最終アクティブ時間を更新
      await this.prisma.chatSession.update({
        where: { id: sessionId },
        data: { updatedAt: new Date() },
      });

      return newMessage;
    } catch (error) {
      Logger.error('メッセージ追加に失敗しました', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * セッションを削除
   */
  public async deleteSession(sessionId: string, userId: string) {
    try {
      // セッションがこのユーザーに属していることを確認
      const session = await this.prisma.chatSession.findUnique({
        where: { id: sessionId },
      });

      if (!session || session.userId !== userId) {
        throw new Error('セッションが存在しないか、アクセス権限がありません');
      }

      await this.prisma.chatSession.delete({
        where: { id: sessionId },
      });

      return true;
    } catch (error) {
      Logger.error('セッション削除に失敗しました', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * セッションタイトルを更新
   */
  public async updateSessionTitle(sessionId: string, userId: string, title: string) {
    try {
      const session = await this.prisma.chatSession.findUnique({
        where: { id: sessionId },
      });

      if (!session || session.userId !== userId) {
        throw new Error('セッションが存在しないか、アクセス権限がありません');
      }

      return await this.prisma.chatSession.update({
        where: { id: sessionId },
        data: { title },
      });
    } catch (error) {
      Logger.error('セッションタイトルの更新に失敗しました', { error: (error as Error).message });
      throw error;
    }
  }
}
