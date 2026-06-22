import { Prisma, PrismaClient } from '@prisma/client';
import { DatabaseService } from './databaseService.js';
import { Logger } from '../utils/logger.js';
import type { DurableEvent, StoredSessionEvent } from '../types/agentEvents.js';

/**
 * SessionEvent ログの追記・読み出し。
 * seq はセッション内で単調増加し、イベントの再生順序を保証する。
 */
export class SessionEventService {
  private static instance: SessionEventService;
  private prisma: PrismaClient;
  /**
   * セッションごとの直列書き込みキュー（deepseek-harness SessionHandle の append / flush モデル）。
   * ホットパス（LLM 呼び出し開始や SSE 送出）を DB トランザクションで止めず、
   * 同一セッション内の seq 順序を保ったままバックグラウンドで永続化し、flush() で完了を保証する。
   */
  private writeChains = new Map<string, Promise<void>>();

  private constructor() {
    this.prisma = DatabaseService.getInstance();
  }

  public static getInstance(): SessionEventService {
    if (!SessionEventService.instance) {
      SessionEventService.instance = new SessionEventService();
    }
    return SessionEventService.instance;
  }

  /** 1 イベントを追記し、採番済みのイベントを返す */
  public async append(sessionId: string, event: DurableEvent): Promise<StoredSessionEvent> {
    return await this.prisma.$transaction(async tx => {
      // セッション行のカウンタを原子的に進める。並行追記でも seq が重複しない。
      const counter = await tx.chatSession.update({
        where: { id: sessionId },
        data: { eventSeq: { increment: 1 } },
        select: { eventSeq: true },
      });
      const seq = counter.eventSeq;

      const row = await tx.sessionEvent.create({
        data: {
          sessionId,
          seq,
          type: event.type,
          // undefined を含む値を落として JSON として安全にする
          payload: JSON.parse(JSON.stringify(event.data)) as Prisma.InputJsonValue,
        },
      });

      return {
        seq: row.seq,
        type: row.type,
        data: row.payload,
        createdAt: row.createdAt.toISOString(),
      };
    });
  }

  /**
   * 1 イベントをセッション別キューに積み、ホットパスをブロックせずに順序通り永続化する。
   * 永続化完了を待つ必要がある箇所（ターン終了・読み出し前）では `flush(sessionId)` を呼ぶ。
   */
  public enqueue(sessionId: string, event: DurableEvent): void {
    const prev = this.writeChains.get(sessionId) ?? Promise.resolve();
    const next = prev
      .then(async () => {
        await this.append(sessionId, event);
      })
      .catch(error => {
        Logger.error('セッションイベントの非同期追記に失敗しました', {
          error: (error as Error).message,
          sessionId,
          eventType: event.type,
        });
      });

    this.writeChains.set(sessionId, next);
    void next.finally(() => {
      if (this.writeChains.get(sessionId) === next) {
        this.writeChains.delete(sessionId);
      }
    });
  }

  /** セッションに積まれたすべての未完了イベント書き込みの完了を待つ（durability barrier） */
  public async flush(sessionId: string): Promise<void> {
    const tail = this.writeChains.get(sessionId);
    if (tail) {
      await tail;
    }
  }

  /** セッションのターン数（継続生成時のターン番号算出に使用） */
  public async countTurns(sessionId: string): Promise<number> {
    await this.flush(sessionId);
    return await this.prisma.sessionEvent.count({
      where: { sessionId, type: 'turn/start' },
    });
  }

  /** セッションのイベントを seq 昇順で取得 */
  public async getEvents(sessionId: string): Promise<StoredSessionEvent[]> {
    try {
      await this.flush(sessionId);
      const rows = await this.prisma.sessionEvent.findMany({
        where: { sessionId },
        orderBy: { seq: 'asc' },
      });

      return rows.map(row => ({
        seq: row.seq,
        type: row.type,
        data: row.payload,
        createdAt: row.createdAt.toISOString(),
      }));
    } catch (error) {
      Logger.error('セッションイベントの取得に失敗しました', {
        error: (error as Error).message,
        sessionId,
      });
      throw error;
    }
  }
}
