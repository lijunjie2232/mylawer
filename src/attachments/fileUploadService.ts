/**
 * セッション紐づけ型ファイルアップロード＆レシート管理サービス。
 *
 * third/ref-deepseek-harness の packages/client/file-upload/src/index.ts に倣う:
 * - アップロードは即座に LocalAttachmentStore へ永続化し、不透明な receiptId を発行する
 * - レシートはアップロード時の sessionId（およびログイン時は userId）に紐づく
 * - プロンプト送信時に admitReceipts() でレシートを解決・失効させ、
 *   未アップロードや他セッションの attachmentId 詐称を防ぐ
 * - 承認済み添付ファイルはセッション単位で記録し、read_uploaded_file ツールから参照可能にする
 */

import { randomUUID } from 'node:crypto';
import { config } from '../config/environment.js';
import { SessionEventService } from '../services/sessionEventService.js';
import { LocalAttachmentStore } from './attachmentStore.js';
import { AttachmentError, type FileAttachmentRef, type FileUploadResult } from './types.js';

interface StagedEntry {
  readonly file: FileAttachmentRef;
  readonly userId?: string;
  readonly createdAt: number;
}

const STAGED_TTL_MS = 2 * 60 * 60 * 1000; // 2 時間
const MAX_TRACKED_SESSIONS = 1000;

export interface UploadStreamRequest {
  sessionId: string;
  userId?: string;
  data: AsyncIterable<Uint8Array>;
  name?: string;
  signal?: AbortSignal;
}

export class FileUploadService {
  private static instance: FileUploadService;
  private readonly store: LocalAttachmentStore;
  private readonly maxFilesPerMessage: number;

  /** sessionId -> (receiptId -> StagedEntry) */
  private readonly staged = new Map<string, Map<string, StagedEntry>>();
  /** sessionId -> (attachmentId -> FileAttachmentRef) */
  private readonly admitted = new Map<string, Map<string, FileAttachmentRef>>();

  constructor(options?: { store?: LocalAttachmentStore; maxFilesPerMessage?: number }) {
    this.store = options?.store ?? LocalAttachmentStore.getInstance();
    this.maxFilesPerMessage = options?.maxFilesPerMessage ?? config.attachments.maxFilesPerMessage;
  }

  public static getInstance(): FileUploadService {
    if (!FileUploadService.instance) {
      FileUploadService.instance = new FileUploadService();
    }
    return FileUploadService.instance;
  }

  /**
   * バイトストリームを永続化し、指定セッション向けのレシートを発行する。
   */
  public async uploadStream(request: UploadStreamRequest): Promise<FileUploadResult> {
    this.pruneExpired();

    const file = await this.store.saveFileStream({
      data: request.data,
      name: request.name,
      signal: request.signal,
    });

    const receiptId = randomUUID();
    let sessionMap = this.staged.get(request.sessionId);
    if (!sessionMap) {
      sessionMap = new Map();
      this.staged.set(request.sessionId, sessionMap);
    }
    sessionMap.set(receiptId, {
      file,
      userId: request.userId,
      createdAt: Date.now(),
    });

    return { receiptId, file };
  }

  /**
   * 送信時に指定された receiptIds を検証・解決して FileAttachmentRef 配列へ昇格させる。
   * 不正または別セッションのレシートが1つでも含まれる場合は全体を拒否する（部分的消費なし）。
   */
  public admitReceipts(
    sessionId: string,
    receiptIds: readonly string[],
    userId?: string
  ): FileAttachmentRef[] {
    this.pruneExpired();

    const uniqueIds = Array.from(new Set(receiptIds.filter(id => typeof id === 'string' && id.length > 0)));
    if (uniqueIds.length === 0) return [];

    if (uniqueIds.length > this.maxFilesPerMessage) {
      throw new AttachmentError(
        `1回のメッセージで添付できるファイルは最大 ${this.maxFilesPerMessage} 件までです。`,
        'TOO_MANY_FILES'
      );
    }

    const sessionMap = this.staged.get(sessionId);
    const resolved: FileAttachmentRef[] = [];

    for (const receiptId of uniqueIds) {
      const entry = sessionMap?.get(receiptId);
      if (!entry) {
        throw new AttachmentError(
          '添付ファイルの有効期限が切れているか、このセッションに紐づいていません。もう一度ファイルを添付してください。',
          'FILE_NOT_STAGED'
        );
      }
      if (entry.userId && userId && entry.userId !== userId) {
        throw new AttachmentError(
          'この添付ファイルにアクセスする権限がありません。',
          'FILE_NOT_STAGED',
          { statusCode: 403 }
        );
      }
      resolved.push(entry.file);
    }

    // すべて検証通過後にレシートを消費する
    for (const receiptId of uniqueIds) {
      sessionMap?.delete(receiptId);
    }
    if (sessionMap && sessionMap.size === 0) {
      this.staged.delete(sessionId);
    }

    this.registerAdmitted(sessionId, resolved);
    return resolved;
  }

  /**
   * 確定したセッション ID に承認済み添付ファイルを紐づける。
   * 初回送信で一時 sessionId から DB セッション ID に切り替わった場合もここで引き継ぐ。
   */
  public registerAdmitted(sessionId: string, files: readonly FileAttachmentRef[]): void {
    if (files.length === 0) return;
    let map = this.admitted.get(sessionId);
    if (!map) {
      map = new Map();
      this.admitted.set(sessionId, map);
    }
    for (const file of files) {
      map.set(file.attachmentId, file);
    }
    if (this.admitted.size > MAX_TRACKED_SESSIONS) {
      const oldest = this.admitted.keys().next().value;
      if (oldest !== undefined) this.admitted.delete(oldest);
    }
  }

  /**
   * 指定セッションが参照可能な添付ファイルメタデータを取得する。
   * メモリキャッシュに無い場合は永続化済み SessionEvent から復元する。
   */
  public async findAdmittedFile(
    sessionId: string,
    attachmentId: string
  ): Promise<FileAttachmentRef | undefined> {
    const cached = this.admitted.get(sessionId)?.get(attachmentId);
    if (cached) return cached;

    // サーバー再起動後や過去セッション再開時は DB の SessionEvent を確認
    try {
      const events = await SessionEventService.getInstance().getEvents(sessionId);
      const found: FileAttachmentRef[] = [];
      for (const ev of events) {
        if (ev.type !== 'user/message') continue;
        const attachments = (ev.data as any)?.attachments;
        if (!Array.isArray(attachments)) continue;
        for (const item of attachments) {
          if (
            item &&
            typeof item.attachmentId === 'string' &&
            typeof item.name === 'string' &&
            typeof item.bytes === 'number'
          ) {
            found.push(item as FileAttachmentRef);
          }
        }
      }
      if (found.length > 0) {
        this.registerAdmitted(sessionId, found);
        return found.find(f => f.attachmentId === attachmentId);
      }
    } catch {
      // 非 DB セッションや DB 未接続時は無視
    }
    return undefined;
  }

  /**
   * 指定セッションで承認済みの全ファイル一覧を返す（メモリキャッシュ分）。
   */
  public listAdmittedFiles(sessionId: string): FileAttachmentRef[] {
    return Array.from(this.admitted.get(sessionId)?.values() ?? []);
  }

  /**
   * セッションクリア時にステージ済み・承認済みキャッシュを削除する。
   */
  public clearSession(sessionId: string): void {
    this.staged.delete(sessionId);
    this.admitted.delete(sessionId);
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (const [sessionId, sessionMap] of this.staged) {
      for (const [receiptId, entry] of sessionMap) {
        if (now - entry.createdAt > STAGED_TTL_MS) {
          sessionMap.delete(receiptId);
        }
      }
      if (sessionMap.size === 0) {
        this.staged.delete(sessionId);
      }
    }
  }
}
