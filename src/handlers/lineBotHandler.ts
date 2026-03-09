import { Client } from '@line/bot-sdk';
import { config } from '../config/environment.js';
import { LegalAgent } from '../agents/legalAgent.js';
import { Logger } from '../utils/logger.js';
import { 
  LineWebhookEvent, 
  LineMessage, 
  LineWebhookBody 
} from '../types/server';

export class LineBotHandler {
  private client: Client;
  private legalAgent: LegalAgent;

  constructor() {
    // 初始化 LINE Bot 客户端
    this.client = new Client({
      channelAccessToken: config.line.accessToken || '',
      channelSecret: config.line.channelSecret || ''
    });

    this.legalAgent = new LegalAgent();
    
    Logger.info('LINE Bot 处理器初始化完成', {
      hasChannelSecret: !!config.line.channelSecret,
      hasAccessToken: !!config.line.accessToken
    });
  }

  /**
   * 处理 LINE webhook 事件
   */
  async handleWebhook(body: LineWebhookBody): Promise<void> {
    if (!body.events || body.events.length === 0) {
      Logger.warn('收到空的 webhook 事件');
      return;
    }

    Logger.info('处理 LINE webhook 事件', { eventCount: body.events.length });

    // 并行处理所有事件
    const promises = body.events.map(event => this.handleEvent(event));
    await Promise.all(promises);
  }

  /**
   * 处理单个事件
   */
  private async handleEvent(event: LineWebhookEvent): Promise<void> {
    try {
      Logger.debug('处理事件', { 
        eventType: event.type,
        sourceType: event.source?.type,
        userId: event.source?.userId 
      });

      switch (event.type) {
        case 'message':
          await this.handleMessageEvent(event);
          break;
        case 'follow':
          await this.handleFollowEvent(event);
          break;
        case 'unfollow':
          await this.handleUnfollowEvent(event);
          break;
        case 'postback':
          await this.handlePostbackEvent(event);
          break;
        default:
          Logger.debug('未处理的事件类型', { eventType: event.type });
      }
    } catch (error) {
      Logger.error('处理事件时发生错误', { 
        error,
        eventType: event.type,
        userId: event.source?.userId
      });
    }
  }

  /**
   * 处理消息事件
   */
  private async handleMessageEvent(event: LineWebhookEvent): Promise<void> {
    if (!event.message || !event.replyToken) {
      Logger.warn('消息事件缺少必要字段');
      return;
    }

    const userId = event.source.userId;
    const message = event.message;
    
    Logger.info('处理用户消息', { 
      userId,
      messageType: message.type,
      messageText: message.text?.substring(0, 50) + '...'
    });

    try {
      let response: string;

      // 根据消息类型处理
      switch (message.type) {
        case 'text':
          response = await this.processLegalQuery(message.text || '', userId);
          break;
        default:
          response = '申し訳ありませんが、テキストメッセージのみ対応しています。';
      }

      // 发送回复
      await this.replyMessage(event.replyToken, response);
      
    } catch (error) {
      Logger.error('处理消息失败', { error, userId });
      await this.replyMessage(
        event.replyToken, 
        '申し訳ありませんが、現在サービスに問題が発生しています。しばらくしてから再度お試しください。'
      );
    }
  }

  private async handleFollowEvent(event: LineWebhookEvent): Promise<void> {
    const welcomeMessage = `法的アシスタントへようこそ！
    
法律に関するご質問をお気軽にどうぞ。契約、労働法、消費者保護など、さまざまな法的問題についてアドバイスいたします。

使い方：
・法律に関する質問をテキストで送信してください
・複雑な調査が必要な場合は少し時間がかかることがあります
・専門的な法的判断が必要な場合は弁護士への相談をお勧めします`;

    if (event.replyToken) {
      await this.replyMessage(event.replyToken, welcomeMessage);
    }
  }

  private async handleUnfollowEvent(event: LineWebhookEvent): Promise<void> {
    Logger.info('ユーザーのアンフォロー', { userId: event.source.userId });
  }

  private async handlePostbackEvent(event: LineWebhookEvent): Promise<void> {
    Logger.info('ポストバックイベントの処理', { 
      userId: event.source.userId,
      data: event.postback?.data 
    });
    
    // ここでは特定のポストバックデータを処理できます
    if (event.replyToken && event.postback?.data) {
      await this.replyMessage(event.replyToken, `選択されたオプション: ${event.postback.data}`);
    }
  }

  private async processLegalQuery(query: string, userId: string): Promise<string> {
    if (!query.trim()) {
      return '有効な質問を入力してください。';
    }
  
    Logger.info('法律クエリの処理', { 
      userId,
      query: query.substring(0, 100) + '...'
    });
  
    try {
      // セッション ID を生成（ユーザーごとに一意）
      const sessionId = `line_${userId}_${Date.now()}`;
        
      let response = '';
        
      // ストリーミングレスポンスを処理
      const stream = await this.legalAgent.getStream(query, sessionId);
      for await (const chunk of stream) {
        // getStream now yields string contents directly
        if (typeof chunk === 'string') {
          response += chunk;
        }
      }
  
      // レスポンスが長すぎないことを確認（LINE は 2000 文字に制限）
      if (response.length > 1900) {
        response = response.substring(0, 1900) + '\n\n（文字数制限のため、内容が省略されました）';
      }
  
      return response;
    } catch (error) {
      Logger.error('法律クエリの処理に失敗しました', { error, userId, query });
      return '申し訳ありませんが、質問の処理中にエラーが発生しました。もう一度お試しください。';
    }
  }

  private async replyMessage(replyToken: string, message: string): Promise<void> {
    try {
      await this.client.replyMessage(replyToken, {
        type: 'text',
        text: message
      });
      Logger.debug('メッセージの返信に成功しました');
    } catch (error) {
      Logger.error('メッセージの返信に失敗しました', { error, replyToken });
      throw error;
    }
  }

  /**
   * プッシュメッセージ（オプション機能）
   */
  async pushMessage(userId: string, message: string): Promise<void> {
    try {
      await this.client.pushMessage(userId, {
        type: 'text',
        text: message
      });
      Logger.debug('プッシュメッセージに成功しました', { userId });
    } catch (error) {
      Logger.error('プッシュメッセージに失敗しました', { error, userId });
      throw error;
    }
  }
}