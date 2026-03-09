import { MiddlewareFunction, ExtendedRequest } from '../types/server';
import { Response } from 'express';

/**
 * 生リクエストボディミドルウェア
 * 署名検証用に生リクエストボディを保存
 */
export const rawBodyMiddleware: MiddlewareFunction = async (
  req: ExtendedRequest,
  res: Response,
  next
) => {
  // LINE webhookパスのみを処理
  if (req.path === '/webhook' && req.method === 'POST') {
    let data: Buffer[] = [];
    
    req.on('data', chunk => {
      data.push(chunk);
    });
    
    req.on('end', () => {
      req.rawBody = Buffer.concat(data);
      next();
    });
  } else {
    next();
  }
};