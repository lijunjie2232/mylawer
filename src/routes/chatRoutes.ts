import { Router, Response } from 'express';
import { Logger } from '../utils/logger.js';
import { ChatService } from '../services/chatService.js';
import { SessionEventService } from '../services/sessionEventService.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router: Router = Router();
const chatService = ChatService.getInstance();
const eventService = SessionEventService.getInstance();

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

    const session = await chatService.getSession(sessionId, userId);
    if (!session) {
      res.status(404).json({ success: false, message: 'Session not found' });
      return;
    }

    const messages = await chatService.getSessionMessages(sessionId);
    res.json({ success: true, messages });
  } catch (error) {
    Logger.error('メッセージ取得失敗', { error: (error as Error).message });
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

/**
 * @openapi
 * /api/chat/sessions/{sessionId}/events:
 *   get:
 *     summary: セッションのイベントログ（turn/step/tool）を取得
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 */
router.get('/sessions/:sessionId/events', authenticateToken, async (req: any, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { sessionId } = req.params;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const session = await chatService.getSession(sessionId, userId);
    if (!session) {
      res.status(404).json({ success: false, message: 'Session not found' });
      return;
    }

    const events = await eventService.getEvents(sessionId);
    res.json({ success: true, events });
  } catch (error) {
    Logger.error('セッションイベント取得失敗', { error: (error as Error).message });
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
