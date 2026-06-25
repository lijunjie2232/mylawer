import { ChatService } from './chatService.js';
import { MemorySaverManager } from '../memory/memorySaverManager.js';
import { ModelManager } from '../models/modelManager.js';
import { LegalAgent } from '../agents/legalAgent.js';
import { SessionEventService } from './sessionEventService.js';
import { Logger } from '../utils/logger.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEFAULT_TITLES = new Set(['新会话', '新しいセッション']);

export interface PrepareChatInput {
  userId?: string;
  sessionId?: string;
  question: string;
  model?: string;
}

export interface PreparedChat {
  sessionId: string;
  agent: LegalAgent;
  /** DB に会話を保存するか（ログインユーザーのみ） */
  persistent: boolean;
  /** セッション内で単調増加するターン番号（1 始まり） */
  turn: number;
  /** ホットパス外で進めている DB 書き込み・イベント追記の完了を待つバリア */
  flush: () => Promise<void>;
}

export interface PrepareResumeInput {
  userId?: string;
  sessionId?: string;
  model?: string;
}

/**
 * チャット 1 ターンの準備（セッション解決・モデル選択・エージェント取得）を担う。
 * 同期/ストリーミング両 API で共通利用する。
 */
export class LegalChatService {
  private static instance: LegalChatService;
  private chatService = ChatService.getInstance();
  private memoryManager = MemorySaverManager.getInstance();
  private eventService = SessionEventService.getInstance();

  public static getInstance(): LegalChatService {
    if (!LegalChatService.instance) {
      LegalChatService.instance = new LegalChatService();
    }
    return LegalChatService.instance;
  }

  public async prepareChat(input: PrepareChatInput): Promise<PreparedChat> {
    const { userId, question, model } = input;
    let sessionId = input.sessionId;
    const modelConfig = ModelManager.getInstance().resolveModel(model);

    // エージェント取得（キャッシュ済みなら即完了）を DB セッション解決と並列に進める
    const agentPromise = this.memoryManager.getOrCreateAgent(modelConfig);

    if (userId) {
      const existing = sessionId && UUID_RE.test(sessionId)
        ? await this.chatService.getSessionWithUserMessageCount(sessionId, userId)
        : null;

      let turn: number;
      const backgroundWrites: Promise<unknown>[] = [];

      if (!existing) {
        const session = await this.chatService.createSession(userId, this.titleFrom(question));
        sessionId = session.id;
        turn = 1;
        Logger.info('Created new DB session', { userId, sessionId });
      } else {
        turn = existing.userMessageCount + 1;
        if (!existing.title || DEFAULT_TITLES.has(existing.title)) {
          backgroundWrites.push(
            this.chatService.updateSessionTitleDirect(sessionId!, this.titleFrom(question)).catch(error => {
              Logger.warn('バックグラウンドでのセッションタイトル更新に失敗しました', {
                sessionId,
                error: (error as Error).message,
              });
            })
          );
        }
      }

      // ユーザー発話の保存とイベント追記は LLM 呼び出し開始を止めずにバックグラウンドで進める
      const userMessageWrite = this.chatService.addMessage(sessionId!, { role: 'user', content: question }).catch(error => {
        Logger.error('ユーザーメッセージの非同期保存に失敗しました', {
          sessionId,
          error: (error as Error).message,
        });
      });
      backgroundWrites.push(userMessageWrite);

      this.eventService.enqueue(sessionId!, {
        type: 'user/message',
        data: { turn, text: question },
      });

      const agent = await agentPromise;
      const resolvedSessionId = sessionId!;

      return {
        sessionId: resolvedSessionId,
        agent,
        persistent: true,
        turn,
        flush: async () => {
          await Promise.all([
            ...backgroundWrites,
            this.eventService.flush(resolvedSessionId),
          ]);
        },
      };
    }

    if (!sessionId) {
      sessionId = this.memoryManager.createNewSession();
    }

    const agent = await agentPromise;
    return {
      sessionId,
      agent,
      persistent: false,
      turn: 1,
      flush: async () => {},
    };
  }

  /**
   * 中断・失敗したターンの再開準備。
   * ユーザー発話は保存済みなので追加せず、新しいターン番号だけ採番する。
   */
  public async prepareResume(input: PrepareResumeInput): Promise<PreparedChat> {
    const { userId, model } = input;
    let sessionId = input.sessionId;
    let persistent = false;
    const modelConfig = ModelManager.getInstance().resolveModel(model);
    const agentPromise = this.memoryManager.getOrCreateAgent(modelConfig);

    if (userId && sessionId && UUID_RE.test(sessionId) && await this.chatService.getSession(sessionId, userId)) {
      persistent = true;
    } else if (userId) {
      // 再開対象が見つからない場合は新規セッションにする（履歴なしの継続）
      const session = await this.chatService.createSession(userId, '再開したセッション');
      sessionId = session.id;
      persistent = true;
    }

    if (!sessionId) {
      sessionId = this.memoryManager.createNewSession();
    }

    const [turn, agent] = await Promise.all([
      persistent ? this.eventService.countTurns(sessionId).then(n => n + 1) : Promise.resolve(1),
      agentPromise,
    ]);

    const resolvedSessionId = sessionId;
    return {
      sessionId: resolvedSessionId,
      agent,
      persistent,
      turn,
      flush: async () => {
        if (persistent) {
          await this.eventService.flush(resolvedSessionId);
        }
      },
    };
  }

  /** アシスタントの回答を DB に保存（永続セッションのみ。先に未完了の書き込みをフラッシュする） */
  public async saveAssistantMessage(chat: PreparedChat, content: string): Promise<void> {
    if (!chat.persistent) return;
    await chat.flush();
    await this.chatService.addMessage(chat.sessionId, { role: 'assistant', content });
  }

  private titleFrom(question: string): string {
    return question.substring(0, 30) + (question.length > 30 ? '...' : '');
  }
}
