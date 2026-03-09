import { config } from '../config/environment.js';
import { Logger } from '../utils/logger.js';
import { MiddlewareFunction, ExtendedRequest } from '../types/server';
import { validateSignature } from '@line/bot-sdk';
import { Response } from 'express';

/**
 * LINE 署名検証ミドルウェア
 * LINEからのwebhookリクエストの真正性を検証
 */
export const lineSignatureMiddleware = async (
  req: ExtendedRequest,
  res: Response,
  next: () => void
) => {
  try {
    // channel secretが設定されているか確認
    if (!config.line.channelSecret) {
      Logger.warn('LINE_CHANNEL_SECRET が設定されていません。署名検証をスキップします');
      return next();
    }

    // 署名ヘッダーを取得
    const signature = req.headers['x-line-signature'] as string;
    if (!signature) {
      Logger.warn('x-line-signature ヘッダーが不足しています');
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing x-line-signature header'
      });
    }

    // 生リクエストボディを取得
    const rawBody = req.rawBody;
    if (!rawBody) {
      Logger.warn('生リクエストボディを取得できません');
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Unable to get raw request body'
      });
    }

    // 署名を検証
    const isValid = validateSignature(rawBody.toString(), config.line.channelSecret, signature);
    
    if (!isValid) {
      Logger.warn('LINE 署名検証に失敗しました');
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid signature'
      });
    }

    Logger.debug('LINE 署名検証に成功しました');
    next();
  } catch (error) {
    Logger.error('署名検証中にエラーが発生しました', { error });
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Signature validation failed'
    });
  }
};