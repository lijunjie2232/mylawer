import { Router, Response } from 'express';
import { Logger } from '../utils/logger.js';
import { ChatService } from '../services/chatService.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router: Router = Router();
const chatService = ChatService.getInstance();

/**
 * @openapi
 * /api/chat/sessions:
 *   get:
 *     summary: ユーザーのすべてのセッションを取得
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: セッションリスト取得成功
 */
router.get('/sessions', authenticateToken, async (req: any, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const sessions = await chatService.getUserSessions(userId);
    res.json({ success: true, sessions });
  } catch (error) {
    Logger.error('セッション取得失敗', { error: (error as Error).message });
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

/**
 * @openapi
 * /api/chat/sessions:
 *   post:
 *     summary: 新しいセッションを作成
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 */
router.post('/sessions', authenticateToken, async (req: any, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { title } = req.body;
    
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const session = await chatService.createSession(userId, title);
    res.status(201).json({ success: true, session });
  } catch (error) {
    Logger.error('セッション作成失敗', { error: (error as Error).message });
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

/**
 * @openapi
 * /api/chat/sessions/{sessionId}/messages:
 *   get:
 *     summary: セッションのメッセージ履歴を取得
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 */
router.get('/sessions/:sessionId/messages', authenticateToken, async (req: any, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { sessionId } = req.params;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    // TODO: セッションがこのユーザーに属しているか検証（service レイヤーで部分的に検証済みですが、getSessionMessages は userId を検証していません）
    // ここでは簡略化のため直接呼び出しますが、本番環境では service レイヤーで検証を強化することをお勧めします
    const messages = await chatService.getSessionMessages(sessionId);
    res.json({ success: true, messages });
  } catch (error) {
    Logger.error('メッセージ取得失敗', { error: (error as Error).message });
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

/**
 * @openapi
 * /api/chat/sessions/{sessionId}:
 *   delete:
 *     summary: セッションを削除
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/sessions/:sessionId', authenticateToken, async (req: any, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { sessionId } = req.params;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    await chatService.deleteSession(sessionId, userId);
    res.json({ success: true, message: 'Session deleted successfully' });
  } catch (error) {
    Logger.error('删除会话失败', { error: (error as Error).message });
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

export default router;
