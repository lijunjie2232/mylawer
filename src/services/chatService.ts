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
   * 创建新的聊天会话
   */
  public async createSession(userId: string, title?: string) {
    try {
      return await this.prisma.chatSession.create({
        data: {
          userId,
          title: title || '新会话',
        },
      });
    } catch (error) {
      Logger.error('创建会话失败', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * 获取单个会话详情
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
      Logger.error('获取会话详情失败', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * 获取用户的所有会话
   */
  public async getUserSessions(userId: string) {
    try {
      return await this.prisma.chatSession.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
      });
    } catch (error) {
      Logger.error('获取用户会话失败', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * 获取会话的消息历史
   */
  public async getSessionMessages(sessionId: string) {
    try {
      return await this.prisma.message.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'asc' },
      });
    } catch (error) {
      Logger.error('获取会话消息失败', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * 添加消息到会话
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

      // 更新会话的最后活跃时间
      await this.prisma.chatSession.update({
        where: { id: sessionId },
        data: { updatedAt: new Date() },
      });

      return newMessage;
    } catch (error) {
      Logger.error('添加消息失败', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * 删除会话
   */
  public async deleteSession(sessionId: string, userId: string) {
    try {
      // 确保会话属于该用户
      const session = await this.prisma.chatSession.findUnique({
        where: { id: sessionId },
      });

      if (!session || session.userId !== userId) {
        throw new Error('会话不存在或无权访问');
      }

      await this.prisma.chatSession.delete({
        where: { id: sessionId },
      });

      return true;
    } catch (error) {
      Logger.error('删除会话失败', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * 更新会话标题
   */
  public async updateSessionTitle(sessionId: string, userId: string, title: string) {
    try {
      const session = await this.prisma.chatSession.findUnique({
        where: { id: sessionId },
      });

      if (!session || session.userId !== userId) {
        throw new Error('会话不存在或无权访问');
      }

      return await this.prisma.chatSession.update({
        where: { id: sessionId },
        data: { title },
      });
    } catch (error) {
      Logger.error('更新会话标题失败', { error: (error as Error).message });
      throw error;
    }
  }
}
