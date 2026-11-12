/**
 * 添付ファイルアップロード用 HTTP ルート。
 *
 * third/ref-deepseek-harness の packages/client/file-upload/src/http-route.ts に倣い、
 * `POST /api/attachments/upload?sessionId=...&name=...` で
 * `application/octet-stream` の生バイト列をストリーミング受信する。
 */

import { Router, type Response } from 'express';
import { FileUploadService } from '../attachments/fileUploadService.js';
import { isAttachmentError } from '../attachments/types.js';
import { optionalAuth } from '../middleware/authMiddleware.js';
import { Logger } from '../utils/logger.js';

const router: Router = Router();
const fileUploadService = FileUploadService.getInstance();

/**
 * @openapi
 * /api/attachments/upload:
 *   post:
 *     summary: 分析対象ファイルのアップロード（テキスト系ファイル・埋め込みテキストPDF）
 *     tags: [Attachments]
 *     parameters:
 *       - in: query
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: name
 *         required: false
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/octet-stream:
 *           schema:
 *             type: string
 *             format: binary
 *     responses:
 *       200:
 *         description: アップロード成功（レシートとメタデータを返却）
 */
router.post('/upload', optionalAuth, async (req: any, res: Response): Promise<void> => {
  const contentType = String(req.headers['content-type'] ?? '').split(';', 1)[0].trim().toLowerCase();
  if (contentType !== 'application/octet-stream') {
    res.status(415).json({
      success: false,
      code: 'UNSUPPORTED_CONTENT_TYPE',
      error: 'Content-Type は application/octet-stream を指定してください。',
    });
    return;
  }

  const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId.trim() : '';
  if (!sessionId) {
    res.status(400).json({
      success: false,
      code: 'SESSION_ID_REQUIRED',
      error: 'sessionId は必須です。',
    });
    return;
  }

  const name = typeof req.query.name === 'string' ? req.query.name : undefined;
  const userId = req.user?.userId;

  const controller = new AbortController();
  req.on('aborted', () => controller.abort());

  try {
    const result = await fileUploadService.uploadStream({
      sessionId,
      userId,
      data: req,
      name,
      signal: controller.signal,
    });

    Logger.info('添付ファイルをアップロードしました', {
      sessionId,
      userId: userId || 'anonymous',
      name: result.file.name,
      bytes: result.file.bytes,
      mediaType: result.file.mediaType,
      pageCount: result.file.pageCount,
      charCount: result.file.charCount,
    });

    res.status(200).json({
      success: true,
      receiptId: result.receiptId,
      file: result.file,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      if (!res.headersSent) {
        res.status(499).json({ success: false, code: 'UPLOAD_ABORTED', error: 'アップロードが中断されました。' });
      }
      return;
    }

    if (isAttachmentError(error)) {
      Logger.warn('添付ファイルアップロード拒否', {
        sessionId,
        name,
        code: error.code,
        message: error.message,
      });
      res.status(error.statusCode).json({
        success: false,
        code: error.code,
        error: error.message,
      });
      return;
    }

    Logger.error('添付ファイルアップロード失敗', {
      sessionId,
      name,
      error: (error as Error).message,
    });
    res.status(500).json({
      success: false,
      code: 'UPLOAD_FAILED',
      error: 'ファイルのアップロード処理中にエラーが発生しました。',
    });
  }
});

export default router;
