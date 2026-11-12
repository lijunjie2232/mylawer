/**
 * 添付ファイルの型定義・エラー定義
 *
 * third/ref-deepseek-harness の packages/attachment/attachment/src/types.ts を参考に、
 * セッションログやイベントには不変の参照（FileAttachmentRef）のみを保持し、
 * 実体バイト列はコンテンツアドレス型ストレージへ分離する。
 */

export interface FileAttachmentRef {
  /** 不透明なコンテンツアドレス識別子（例: sha256:<64hex>） */
  attachmentId: string;
  /** パス情報を除去・サニタイズ済みの表示用ファイル名 */
  name: string;
  /** 保存された元ファイルのバイト長 */
  bytes: number;
  /** 検証済みのメディアタイプ（例: text/plain, application/pdf） */
  mediaType: string;
  /** PDF の総ページ数（PDF の場合のみ） */
  pageCount?: number;
  /** 抽出されたテキストの総文字数 */
  charCount?: number;
}

export interface ExtractedFileText {
  text: string;
  mediaType: string;
  pageCount?: number;
  charCount: number;
}

export interface FileUploadResult {
  receiptId: string;
  file: FileAttachmentRef;
}

export type AttachmentErrorCode =
  | 'INVALID_ATTACHMENT_REF'
  | 'UNSUPPORTED_FILE_TYPE'
  | 'BINARY_FILE_UNSUPPORTED'
  | 'EMPTY_FILE'
  | 'FILE_TOO_LARGE'
  | 'TOO_MANY_FILES'
  | 'PDF_NO_EMBEDDED_TEXT'
  | 'PDF_PARSE_FAILED'
  | 'FILE_NOT_STAGED'
  | 'ATTACHMENT_NOT_FOUND'
  | 'ATTACHMENT_CORRUPT'
  | 'ATTACHMENT_WRITE_FAILED'
  | 'ATTACHMENT_READ_FAILED';

export class AttachmentError extends Error {
  public readonly code: AttachmentErrorCode;
  public readonly statusCode: number;
  public readonly cause?: unknown;

  constructor(
    message: string,
    code: AttachmentErrorCode,
    options?: { statusCode?: number; cause?: unknown }
  ) {
    super(message);
    this.name = 'AttachmentError';
    this.code = code;
    this.statusCode = options?.statusCode ?? defaultStatusForCode(code);
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

function defaultStatusForCode(code: AttachmentErrorCode): number {
  switch (code) {
    case 'FILE_TOO_LARGE':
      return 413;
    case 'UNSUPPORTED_FILE_TYPE':
    case 'BINARY_FILE_UNSUPPORTED':
    case 'PDF_NO_EMBEDDED_TEXT':
      return 415;
    case 'EMPTY_FILE':
    case 'TOO_MANY_FILES':
    case 'INVALID_ATTACHMENT_REF':
    case 'FILE_NOT_STAGED':
    case 'PDF_PARSE_FAILED':
      return 400;
    case 'ATTACHMENT_NOT_FOUND':
      return 404;
    case 'ATTACHMENT_CORRUPT':
    case 'ATTACHMENT_WRITE_FAILED':
    case 'ATTACHMENT_READ_FAILED':
    default:
      return 500;
  }
}

export function isAttachmentError(error: unknown): error is AttachmentError {
  return error instanceof AttachmentError;
}
