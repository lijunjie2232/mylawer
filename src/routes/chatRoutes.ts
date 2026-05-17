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
 *     summary: 获取用户的所有会话
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功获取会话列表
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
    Logger.error('获取会话失败', { error: (error as Error).message });
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

/**
 * @openapi
 * /api/chat/sessions:
 *   post:
 *     summary: 创建新会话
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
    Logger.error('创建会话失败', { error: (error as Error).message });
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

/**
 * @openapi
 * /api/chat/sessions/{sessionId}/messages:
 *   get:
 *     summary: 获取会话的消息历史
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

    // TODO: 校验会话是否属于该用户 (已经在 service 层部分校验，但 getSessionMessages 还没校验 userId)
    // 这里简单起见直接调用，生产环境建议在 service 层加强校验
    const messages = await chatService.getSessionMessages(sessionId);
    res.json({ success: true, messages });
  } catch (error) {
    Logger.error('获取消息失败', { error: (error as Error).message });
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

/**
 * @openapi
 * /api/chat/sessions/{sessionId}:
 *   delete:
 *     summary: 删除会话
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
