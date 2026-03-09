import { Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/logger.js';
import { ServerErrorResponse } from '../types/server';

/**
 * エラーハンドリングミドルウェア
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  Logger.error('サーバーエラー', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method
  });

  const errorResponse: ServerErrorResponse = {
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' 
      ? 'サーバー内部エラー' 
      : err.message,
    timestamp: new Date().toISOString()
  };

  res.status(500).json(errorResponse);
};

/**
 * 404 ハンドリングミドルウェア
 */
export const notFoundHandler = (req: Request, res: Response) => {
  Logger.warn('404 Not Found', { url: req.url, method: req.method });
  
  res.status(404).json({
    error: 'Not Found',
    message: '要求されたリソースが存在しません',
    timestamp: new Date().toISOString()
  });
};