import { Request, Response, NextFunction } from 'express';

// LINE Bot メッセージタイプ
export interface LineMessage {
  type: string;
  id: string;
  text?: string;
  // 必要に応じて他のメッセージタイプを拡張可能
}

// LINE Bot webhook イベント
export interface LineWebhookEvent {
  type: string;
  replyToken: string;
  source: {
    userId: string;
    type: string;
  };
  message?: LineMessage;
  postback?: {
    data: string;
  };
}

// LINE Bot リクエストボディ
export interface LineWebhookBody {
  events: LineWebhookEvent[];
  destination: string;
}

// サーバーエラーレスポンス
export interface ServerErrorResponse {
  error: string;
  message: string;
  timestamp: string;
}

// Express 拡張型
export interface ExtendedRequest extends Request {
  rawBody?: Buffer;
}

// ミドルウェア関数型
export type MiddlewareFunction = (
  req: ExtendedRequest,
  res: Response,
  next: NextFunction
) => void | Promise<void>;

// サーバー設定インターフェース
export interface ServerConfig {
  port: number;
  host: string;
  enableCors: boolean;
  basePath: string;
}