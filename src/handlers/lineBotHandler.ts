import { LineBotClient } from '@line/bot-sdk';
import { config } from '../config/environment.js';
import { ModelManager } from '../models/modelManager.js';
import { MemorySaverManager } from '../memory/memorySaverManager.js';
import { Logger } from '../utils/logger.js';
import {
  LineWebhookEvent,
  LineWebhookBody
} from '../types/server.js';

const VERIFY_DUMMY_REPLY_TOKENS = new Set([
  '00000000000000000000000000000000',
  'ffffffffffffffffffffffffffffffff',
]);

export class LineBotHandler {
  private client: LineBotClient | null;
  private modelManager: ModelManager;
  private memoryManager: MemorySaverManager;

  constructor() {
    // アクセストークン未設定時はクライアントを作らない（起動は継続）
    this.client = config.line.accessToken
      ? LineBotClient.fromChannelAccessToken({ channelAccessToken: config.line.accessToken })
      : null;

    this.modelManager = ModelManager.getInstance();
    this.memoryManager = MemorySaverManager.getInstance();

    Logger.info('LINE Bot ハンドラーの初期化が完了しました', {
      hasChannelSecret: !!config.line.channelSecret,
      hasAccessToken: !!config.line.accessToken
    });
  }

  /**
   * LINE webhook イベントを処理
   */
  async handleWebhook(body: LineWebhookBody): Promise<void> {
    if (!body.events || body.events.length === 0) {
      Logger.debug('空の webhook イベントを受信しました（Webhook 検証等）');
      return;
    }

    Logger.info('LINE webhook イベントを処理中', { eventCount: body.events.length });

    // 同一ユーザーのイベント順序を保つため逐次処理
    for (const event of body.events) {
      await this.handleEvent(event);
    }
  }

  /**
   * 単一イベントを処理
   */
  private async handleEvent(event: LineWebhookEvent): Promise<void> {
    try {
      Logger.debug('イベントを処理中', {
        eventType: event.type,
        sourceType: event.source?.type,
        userId: event.source?.userId
      });

      if (event.replyToken && VERIFY_DUMMY_REPLY_TOKENS.has(event.replyToken)) {
        Logger.debug('LINE Webhook 検証用のダミーイベントをスキップしました', {
          eventType: event.type,
        });
        return;
      }

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
          Logger.debug('未処理のイベントタイプ', { eventType: event.type });
      }
    } catch (error) {
      Logger.error('イベント処理中にエラーが発生しました', {
        error,
        eventType: event.type,
        userId: event.source?.userId
      });
    }
  }

  /**
   * メッセージイベントを処理
   */
  private async handleMessageEvent(event: LineWebhookEvent): Promise<void> {
    if (!event.message) {
      Logger.warn('メッセージイベントに message フィールドがありません');
      return;
    }

    const userId = event.source?.userId;
    const targetId = this.getTargetId(event);
    const message = event.message;

    Logger.info('ユーザーメッセージを処理中', {
      userId,
      targetId,
      messageType: message.type,
      messageText: message.text?.substring(0, 50) + (message.text && message.text.length > 50 ? '...' : '')
    });

    try {
      let response: string;

      // メッセージタイプに応じて処理
      switch (message.type) {
        case 'text':
          if (event.source?.type === 'user' && userId) {
            void this.showLoadingIndicator(userId);
          }
          response = await this.processLegalQuery(message.text || '', targetId || 'anonymous');
          break;
        default:
          response = '申し訳ありませんが、テキストメッセージのみ対応しています。';
      }

      // 返信を送信（replyToken 失効時は pushMessage にフォールバック）
      await this.sendResponse(event.replyToken, targetId, response);

    } catch (error) {
      Logger.error('メッセージ処理に失敗しました', { error, userId, targetId });
      try {
        await this.sendResponse(
          event.replyToken,
          targetId,
          '申し訳ありませんが、現在サービスに問題が発生しています。しばらくしてから再度お試しください。'
        );
      } catch (notifyError) {
        Logger.error('エラー通知の送信にも失敗しました', { error: notifyError, targetId });
      }
    }
  }

  private async handleFollowEvent(event: LineWebhookEvent): Promise<void> {
    const welcomeMessage = `法的アシスタントへようこそ！

法律に関するご質問をお気軽にどうぞ。契約、労働法、消費者保護など、さまざまな法的問題についてアドバイスいたします。

使い方：
・法律に関する質問をテキストで送信してください
・複雑な調査が必要な場合は少し時間がかかることがあります
・専門的な法的判断が必要な場合は弁護士への相談をお勧めします`;

    await this.sendResponse(event.replyToken, this.getTargetId(event), welcomeMessage);
  }

  private async handleUnfollowEvent(event: LineWebhookEvent): Promise<void> {
    Logger.info('ユーザーのアンフォロー', { userId: event.source?.userId });
  }

  private async handlePostbackEvent(event: LineWebhookEvent): Promise<void> {
    Logger.info('ポストバックイベントの処理', {
      userId: event.source?.userId,
      data: event.postback?.data
    });

    // ここでは特定のポストバックデータを処理できます
    if (event.postback?.data) {
      await this.sendResponse(
        event.replyToken,
        this.getTargetId(event),
        `選択されたオプション: ${event.postback.data}`
      );
    }
  }

  private async processLegalQuery(query: string, targetId: string): Promise<string> {
    if (!query.trim()) {
      return '有効な質問を入力してください。';
    }

    Logger.info('法律クエリの処理', {
      targetId,
      query: query.substring(0, 100) + (query.length > 100 ? '...' : '')
    });

    try {
      // ユーザーごとにセッションを維持（会話の継続性）
      const sessionId = `line_${targetId}`;
      const modelConfig = this.modelManager.resolveModel();
      const legalAgent = await this.memoryManager.getOrCreateAgent(modelConfig);

      let response = '';
      let sawDeltaInStep = false;
      let streamError: string | null = null;

      const stream = await legalAgent.getStream(query, sessionId);
      for await (const event of stream) {
        if (event.type === 'step/start') {
          sawDeltaInStep = false;
        } else if (event.type === 'assistant/delta') {
          response += event.data.text;
          sawDeltaInStep = true;
        } else if (event.type === 'assistant/message' && !sawDeltaInStep) {
          response += event.data.text;
        } else if (event.type === 'error') {
          streamError = event.data.message;
        }
      }

      response = response.trim();
      if (!response) {
        if (streamError) {
          Logger.error('法律クエリ処理中にエージェントエラーが発生しました', {
            targetId,
            error: streamError,
          });
        }
        return '申し訳ありませんが、回答の生成に失敗しました。しばらくしてからもう一度お試しください。';
      }

      // LINE のテキスト上限は 5000 文字。余裕を持って切り詰める
      if (response.length > 4500) {
        response = response.substring(0, 4500) + '\n\n（文字数制限のため、内容が省略されました）';
      }

      return response;
    } catch (error) {
      Logger.error('法律クエリの処理に失敗しました', { error, targetId, query });
      return '申し訳ありませんが、質問の処理中にエラーが発生しました。もう一度お試しください。';
    }
  }

  private getTargetId(event: LineWebhookEvent): string | undefined {
    return event.source?.userId || event.source?.groupId || event.source?.roomId;
  }

  private async showLoadingIndicator(chatId: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.showLoadingAnimation({
        chatId,
        loadingSeconds: 60,
      });
    } catch (error) {
      Logger.debug('ローディングアニメーション表示に失敗しました（処理は継続）', {
        chatId,
        error: (error as Error).message,
      });
    }
  }

  /**
   * replyMessage で返信を試み、replyToken 失効等で失敗した場合は pushMessage へフォールバックする
   */
  private async sendResponse(
    replyToken: string | undefined,
    targetId: string | undefined,
    message: string
  ): Promise<void> {
    const text = message.trim();
    if (!text) {
      Logger.warn('空のメッセージ送信をスキップしました');
      return;
    }

    if (replyToken && !VERIFY_DUMMY_REPLY_TOKENS.has(replyToken)) {
      try {
        await this.replyMessage(replyToken, text);
        return;
      } catch (replyError) {
        if (!targetId) {
          throw replyError;
        }
        Logger.warn('replyMessage に失敗したため pushMessage にフォールバックします', {
          targetId,
          error: (replyError as Error).message,
        });
      }
    }

    if (targetId) {
      await this.pushMessage(targetId, text);
    } else {
      Logger.error('replyToken も送信先 ID もないためメッセージを送信できません');
    }
  }

  private async replyMessage(replyToken: string, message: string): Promise<void> {
    if (!this.client) {
      Logger.error('LINE アクセストークンが未設定のため返信できません');
      return;
    }
    try {
      await this.client.replyMessage({
        replyToken: replyToken,
        messages: [
          {
            type: 'text',
            text: message
          }
        ]
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
    if (!this.client) {
      Logger.error('LINE アクセストークンが未設定のためプッシュできません');
      return;
    }
    try {
      await this.client.pushMessage({
        to: userId,
        messages: [
          {
            type: 'text',
            text: message
          }
        ]
      });
      Logger.debug('プッシュメッセージに成功しました', { userId });
    } catch (error) {
      Logger.error('プッシュメッセージに失敗しました', { error, userId });
      throw error;
    }
  }
}