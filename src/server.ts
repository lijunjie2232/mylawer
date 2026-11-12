import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import crypto from 'crypto';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';

// ESM モードでは __dirname と __filename を使用できないため、手動で定義
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { config } from './config/environment.js';
import { swaggerOptions } from './config/swagger.js';
import { LineBotHandler } from './handlers/lineBotHandler.js';
import { ModelManager } from './models/modelManager.js';
import { Logger } from './utils/logger.js';
import { MemorySaverManager } from './memory/memorySaverManager.js';
import { PostgresMemoryManager } from './memory/postgresMemoryManager.js';
import { initializeMCPServers, getMCPTools } from './mcp/mcpInitializer.js';
import { loadLegalSkills } from './agents/skills.js';
import { LegalChatService } from './services/legalChatService.js';
import { SessionEventService } from './services/sessionEventService.js';
import { isDurableEvent } from './types/agentEvents.js';
import type { AgentEvent } from './types/agentEvents.js';
import { lineSignatureMiddleware } from './middleware/lineSignatureMiddleware.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { LineWebhookBody } from './types/server.js';
import { LegalQueryRequest, LegalQueryResponse, ModelsApiResponse, LlmModelsResponse, LlmModel, ModelInfo } from './types/index.js';
import { DatabaseService } from './services/databaseService.js';
import userRoutes from './routes/userRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import attachmentRoutes from './routes/attachmentRoutes.js';
import { optionalAuth } from './middleware/authMiddleware.js';
import { FileUploadService } from './attachments/fileUploadService.js';
import { LocalAttachmentStore } from './attachments/attachmentStore.js';
import { buildModelInputWithAttachments } from './attachments/promptProjection.js';
import { isAttachmentError } from './attachments/types.js';
import type { FileAttachmentRef } from './attachments/types.js';

const DEFAULT_ATTACHMENT_PROMPT = '添付ファイルの内容を法的な観点から分析してください。';

export class Server {
  private app: Application;
  private lineBotHandler: LineBotHandler;
  private modelManager: ModelManager;
  private legalChatService: LegalChatService;
  private eventService: SessionEventService;
  private port: number;
  private swaggerSpec: ReturnType<typeof swaggerJsdoc>;
  private httpServer?: import('http').Server;

  constructor() {
    this.app = express();
    this.port = config.app.port;
    this.lineBotHandler = new LineBotHandler();
    this.modelManager = ModelManager.getInstance();
    this.legalChatService = LegalChatService.getInstance();
    this.eventService = SessionEventService.getInstance();
    this.swaggerSpec = swaggerJsdoc(swaggerOptions);
    this.setupMiddleware();
    this.setupDatabase();
    this.setupRoutes();
    this.setupSwagger();
    this.setupErrorHandling();
  }

  /**
   * ミドルウェアの設定
   */
  private setupMiddleware(): void {
    // CORS 設定（CORS_ORIGIN 未設定時はリクエスト Origin を反映）
    const corsOrigin = config.app.corsOrigin;
    this.app.use(cors(corsOrigin ? { origin: corsOrigin.split(',').map(o => o.trim()) } : {}));

    // JSON 解析ミドルウェア（LINE 署名検証用に生ボディも保持）
    this.app.use(express.json({
      verify: (req, _res, buf) => {
        (req as any).rawBody = buf;
      }
    }));

    // URL エンコード解析ミドルウェア
    this.app.use(express.urlencoded({ extended: true }));

    // ヘルスチェックミドルウェア
    /**
     * @openapi
     * /health:
     *   get:
     *     summary: サーバーヘルスチェック
     *     description: サーバーの動作状態と基本指標を確認
     *     tags: [Health]
     *     responses:
     *       200:
     *         description: サーバー正常動作中
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/HealthResponse'
     */
    this.app.use('/health', (req: Request, res: Response) => {
      res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });

    Logger.info('ミドルウェア設定完了');
  }

  /**
   * データベースの初期化
   */
  private async setupDatabase(): Promise<void> {
    try {
      await DatabaseService.connect();
      Logger.info('データベース接続完了');
    } catch (error) {
      Logger.error('データベース接続失敗', { error: (error as Error).message });
      // データベース接続の失敗はサーバー起動を妨げないが、エラーを記録する
    }
  }

  /**
   * ルートの設定
   */
  private setupRoutes(): void {
    // LINE webhook ルート
    /**
     * @openapi
     * /webhook:
     *   post:
     *     summary: LINE Bot Webhook の処理
     *     description: LINE プラットフォームからの webhook イベントを受信・処理
     *     tags: [Webhook]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               events:
     *                 type: array
     *                 items:
     *                   type: object
     *                   properties:
     *                     type:
     *                       type: string
     *                       example: 'message'
     *                     message:
     *                       type: object
     *                       properties:
     *                         text:
     *                           type: string
     *                           example: 'こんにちは'
     *     responses:
     *       200:
     *         description: Webhook 処理成功
     *         content:
     *           text/plain:
     *             schema:
     *               type: string
     *               example: 'OK'
     *       500:
     *         description: サーバー内部エラー
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/WebhookErrorResponse'
     */
    this.app.post('/webhook', (req, res, next) => lineSignatureMiddleware(req as any, res as any, next), async (req: Request, res: Response) => {
      try {
        const body: LineWebhookBody = req.body;


        Logger.info('LINE webhook リクエストを受信', {
          eventId: body.events?.[0]?.type,
          eventCount: body.events?.length
        });

        // webhook イベントの非同期処理
        this.lineBotHandler.handleWebhook(body).catch((error: unknown) => {
          Logger.error('webhook の非同期処理失敗', { error });
        });

        // 即座に 200 ステータスコードを返す
        res.status(200).send('OK');
      } catch (error) {
        Logger.error('webhook リクエストの処理失敗', { error });
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to process webhook'
        });
      }
    });

    // フロントエンド静的ファイルサービス
    // Try multiple paths for different deployment scenarios
    const possiblePaths = [
      path.join(__dirname, '../frontend/dist'),
      path.join(process.cwd(), './frontend/dist'),
      path.join(__dirname, 'dist/frontend'),
      path.join(process.cwd(), 'dist/frontend')
    ];
    
    const frontendDistPath = possiblePaths.find(p => existsSync(p)) || path.join(__dirname, '../frontend/dist');

    Logger.info(`Serving frontend from: ${frontendDistPath}`);

    // フロントエンド静的ファイルを提供する
    this.app.use(express.static(frontendDistPath));

    // API 情報ルート（後に移動）
    this.app.get('/api/info', (req: Request, res: Response) => {
      res.json({
        message: '法的アシスタントサーバー',
        version: '1.0.0',
        status: 'running',
        timestamp: new Date().toISOString()
      });
    });

    // モデルリスト API ルート
    /**
     * @openapi
     * /models:
     *   get:
     *     summary: 利用可能なモデルリストの取得
     *     description: LLM API にアクセスして実際に利用可能なモデルリストを取得
     *     tags: [Models]
     *     responses:
     *       200:
     *         description: モデルリストの取得成功
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ModelsApiResponse'
     *       500:
     *         description: サーバー内部エラー
     */
    this.app.get('/models', async (req: Request, res: Response): Promise<void> => {
      try {
        Logger.info('モデルリスト取得リクエスト');
    
        // ModelManager から最新のモデルリストを強制的に取得
        const modelManager = ModelManager.getInstance();
        await modelManager.initialize(true);

        const defaultModel = modelManager.getDefaultModelName();

        // ModelManager からすべての有効なモデルを取得（デフォルトを先頭に）
        const models = modelManager.getEnabledModels()
          .map(model => ({
            name: model.name,
            displayName: model.displayName,
            provider: model.provider,
            description: model.description,
            isEnabled: model.isEnabled,
            isHealthy: true
          }))
          .sort((a, b) => (a.name === defaultModel ? -1 : b.name === defaultModel ? 1 : 0));
    
        const apiResponse: ModelsApiResponse = {
          success: true,
          models,
          defaultModel,
          timestamp: new Date().toISOString()
        };
    
        Logger.info('モデルリスト取得成功', {
          modelCount: models.length,
          firstModel: defaultModel
        });
    
        res.json(apiResponse);
    
      } catch (error) {
        Logger.error('モデルリスト取得失敗', { error: (error as Error).message });
        res.status(500).json({
          success: false,
          models: [],
          defaultModel: '',
          timestamp: new Date().toISOString(),
          error: `Failed to retrieve models from LLM API: ${(error as Error).message}`
        } as ModelsApiResponse);
      }
    });

    // 法律相談 API ルート（ストリーミングバージョン）
    /**
     * @openapi
     * /api/legal/query/stream:
     *   post:
     *     summary: 法律問題相談（流式响应）
     *     description: AI Agent を使用して法律関連問題を処理し、リアルタイムでレスポンスをストリーミング
     *     tags: [Legal]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - question
     *             properties:
     *               question:
     *                 type: string
     *                 description: 法律関連問題（continue 指定時は不要）
     *                 example: '日本の法律に窃盗罪が定義されていますか？'
     *               sessionId:
     *                 type: string
     *                 description: 継続するセッション ID
     *               continue:
     *                 type: boolean
     *                 description: 中断した回答の続きを生成する
     *               retry:
     *                 type: boolean
     *                 description: 失敗したターンを再試行する（ユーザー発話は再保存しない）
     *               model:
     *                 type: string
     *                 description: 使用するモデル名（オプション）
     *                 example: 'gpt-4o-mini'
     *     responses:
     *       200:
     *         description: 流式响应
     *         content:
     *           text/event-stream:
     *             schema:
     *               type: string
     *       400:
     *         description: リクエストパラメータエラー
     *       500:
     *         description: サーバー内部エラー
     */
    this.app.post('/api/legal/query/stream', optionalAuth, async (req: any, res: Response): Promise<void> => {
      try {
        const { question, model, sessionId, continue: isContinue, retry, attachmentReceiptIds }: LegalQueryRequest & {
          sessionId?: string;
          continue?: boolean;
          retry?: boolean;
        } = req.body;
        const userId = req.user?.userId;
        const receiptIds = Array.isArray(attachmentReceiptIds)
          ? attachmentReceiptIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
          : [];
        const trimmedQuestion = typeof question === 'string' ? question.trim() : '';

        if (!isContinue && !trimmedQuestion && receiptIds.length === 0) {
          res.status(400).json({
            success: false,
            error: 'Invalid request: question or attachmentReceiptIds is required'
          } as LegalQueryResponse);
          return;
        }

        let admittedAttachments: FileAttachmentRef[] = [];
        if (!isContinue && !retry && receiptIds.length > 0) {
          if (!sessionId) {
            res.status(400).json({
              success: false,
              error: 'sessionId is required when sending attachments'
            } as LegalQueryResponse);
            return;
          }
          try {
            admittedAttachments = FileUploadService.getInstance().admitReceipts(sessionId, receiptIds, userId);
          } catch (attachErr) {
            if (isAttachmentError(attachErr)) {
              res.status(attachErr.statusCode).json({
                success: false,
                error: attachErr.message,
              } as LegalQueryResponse);
              return;
            }
            throw attachErr;
          }
        }

        const effectiveQuestion = trimmedQuestion || (admittedAttachments.length > 0 ? DEFAULT_ATTACHMENT_PROMPT : '');

        Logger.info('法律相談流式リクエストを受信', {
          question: effectiveQuestion ? effectiveQuestion.substring(0, 100) + '...' : '(continuation)',
          model: model || 'default',
          sessionId: sessionId || 'none',
          userId: userId || 'anonymous',
          attachmentCount: admittedAttachments.length,
          resume: isContinue ? 'continue' : retry ? 'retry' : undefined,
        });

        // SSE レスポンスヘッダーの設定（CORS は cors ミドルウェアが付与）
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        });

        res.write(`data: ${JSON.stringify({ type: 'start', timestamp: new Date().toISOString() })}\n\n`);

        // クライアント切断時は生成を打ち切る
        const controller = new AbortController();
        let aborted = false;
        res.on('close', () => {
          if (!res.writableEnded) {
            aborted = true;
            controller.abort();
          }
        });

        const send = (event: Record<string, any>) => {
          if (!aborted && !res.writableEnded) {
            res.write(`data: ${JSON.stringify(event)}\n\n`);
          }
        };

        try {
          const requestStartedAt = Date.now();
          // 継続・再試行ではユーザー発話を追加しない（保存済みの文脈から再開する）
          const chat = isContinue || retry
            ? await this.legalChatService.prepareResume({ userId, sessionId, model })
            : await this.legalChatService.prepareChat({
                userId,
                sessionId,
                question: effectiveQuestion,
                model,
                attachments: admittedAttachments,
              });
          const prepareMs = Date.now() - requestStartedAt;

          const input = isContinue
            ? null
            : retry
              ? `前回の回答が正常に完了しませんでした。改めて次の質問に回答してください。\n\n${effectiveQuestion}`
              : admittedAttachments.length > 0
                ? await buildModelInputWithAttachments(
                    effectiveQuestion,
                    admittedAttachments,
                    ref => LocalAttachmentStore.getInstance().readExtractedText(ref.attachmentId, ref.name)
                  )
                : effectiveQuestion;

          // 生成完了前に中断されても再開できるよう、セッション ID は最初に通知する
          send({ type: 'session', sessionId: chat.sessionId, turn: chat.turn, timestamp: new Date().toISOString() });

          const stream = await chat.agent.getStream(input, chat.sessionId, {
            turn: chat.turn,
            signal: controller.signal,
          });
          const streamReadyMs = Date.now() - requestStartedAt;
          let loggedFirstToken = false;

          let fullResponse = '';
          let sawDelta = false;
          let hadError = false;
          let sawTurnEnd = false;

          for await (const event of stream) {
            if (event.type === 'turn/end') sawTurnEnd = true;
            if (event.type === 'error') hadError = true;

            // 確定した事実だけをセッションログに非同期追記する（LLM 開始・SSE 送出を DB 書き込みで止めない）
            // 切断時のエラー文言は表示専用なので履歴には残さない
            if (isDurableEvent(event) && chat.persistent && !(aborted && event.type === 'error')) {
              this.eventService.enqueue(chat.sessionId, event);
            }

            if (event.type === 'assistant/delta') {
              if (!loggedFirstToken) {
                loggedFirstToken = true;
                Logger.info('ストリーム初回トークン到達', {
                  sessionId: chat.sessionId,
                  prepareMs,
                  streamReadyMs,
                  firstTokenMs: Date.now() - requestStartedAt,
                });
              }
              fullResponse += event.data.text;
              sawDelta = true;
            } else if (event.type === 'assistant/message' && !sawDelta) {
              // ストリーミング未対応のプロバイダ向けフォールバック
              fullResponse += event.data.text;
            }

            if (!aborted) {
              send({ type: event.type, ...event.data, timestamp: new Date().toISOString() });
            }
          }

          if (aborted) {
            Logger.info('クライアント切断によりストリームを中断', { sessionId: chat.sessionId });
            // 通常は translator が turn/end を発行済み。未発行の経路だけターンを閉じる。
            if (chat.persistent && !sawTurnEnd) {
              this.eventService.enqueue(chat.sessionId, {
                type: 'turn/end',
                data: { turn: chat.turn, status: 'aborted' },
              });
            }
            await chat.flush();
            res.end();
            return;
          }

          if (hadError) {
            Logger.error('エージェント実行中にエラーが発生', { sessionId: chat.sessionId });
            await chat.flush();
            res.end();
            return;
          }

          await this.legalChatService.saveAssistantMessage(chat, fullResponse);

          send({
            type: 'complete',
            finalResponse: fullResponse,
            modelUsed: chat.agent.getModelName(),
            sessionId: chat.sessionId,
            turn: chat.turn,
            timestamp: new Date().toISOString()
          });
        } catch (streamError) {
          send({ type: 'error', error: (streamError as Error).message, timestamp: new Date().toISOString() });
          Logger.error('ストリーミング処理失敗', { error: (streamError as Error).message });
        }

        res.end();

      } catch (error) {
        Logger.error('法律相談流式リクエストの処理失敗', { error: (error as Error).message });
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            question: req.body.question || '',
            answer: '',
            timestamp: new Date().toISOString(),
            error: (error as Error).message
          } as LegalQueryResponse);
        } else {
          res.end();
        }
      }
    });
    /**
     * @openapi
     * /api/legal/query:
     *   post:
     *     summary: 法律問題相談（セッションメモリ対応）
     *     description: AI Agent を使用して法律関連問題を処理し、検索およびウェブページ読み込みツールを自動呼び出し可能、セッション履歴メモリをサポート
     *     tags: [Legal]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - question
     *             properties:
     *               question:
     *                 type: string
     *                 description: 法律関連問題
     *                 example: '日本の法律に窃盗罪が定義されていますか？'
     *               model:
     *                 type: string
     *                 description: 使用するモデル名（オプション）
     *                 example: 'gpt-4o-mini'
     *               sessionId:
     *                 type: string
     *                 description: 会话ID，用于维护对话历史（可选）
     *                 example: 'session_1234567890'
     *     responses:
     *       200:
     *         description: 回答取得成功
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/LegalQueryResponse'
     *       400:
     *         description: リクエストパラメータエラー
     *       500:
     *         description: サーバー内部エラー
     */
    this.app.post('/api/legal/query', optionalAuth, async (req: any, res: Response): Promise<void> => {
      try {
        const { question, model, sessionId, attachmentReceiptIds }: LegalQueryRequest & { sessionId?: string } = req.body;
        const userId = req.user?.userId;
        const receiptIds = Array.isArray(attachmentReceiptIds)
          ? attachmentReceiptIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
          : [];
        const trimmedQuestion = typeof question === 'string' ? question.trim() : '';

        if (!trimmedQuestion && receiptIds.length === 0) {
          res.status(400).json({
            success: false,
            error: 'Invalid request: question or attachmentReceiptIds is required'
          } as LegalQueryResponse);
          return;
        }

        let admittedAttachments: FileAttachmentRef[] = [];
        if (receiptIds.length > 0) {
          if (!sessionId) {
            res.status(400).json({
              success: false,
              error: 'sessionId is required when sending attachments'
            } as LegalQueryResponse);
            return;
          }
          try {
            admittedAttachments = FileUploadService.getInstance().admitReceipts(sessionId, receiptIds, userId);
          } catch (attachErr) {
            if (isAttachmentError(attachErr)) {
              res.status(attachErr.statusCode).json({
                success: false,
                error: attachErr.message,
              } as LegalQueryResponse);
              return;
            }
            throw attachErr;
          }
        }

        const effectiveQuestion = trimmedQuestion || DEFAULT_ATTACHMENT_PROMPT;

        Logger.info('法律相談リクエストを受信', {
          question: effectiveQuestion.substring(0, 100) + '...',
          model: model || 'default',
          sessionId: sessionId || 'none',
          userId: userId || 'anonymous',
          attachmentCount: admittedAttachments.length,
        });

        const chat = await this.legalChatService.prepareChat({
          userId,
          sessionId,
          question: effectiveQuestion,
          model,
          attachments: admittedAttachments,
        });
        const modelInput = admittedAttachments.length > 0
          ? await buildModelInputWithAttachments(
              effectiveQuestion,
              admittedAttachments,
              ref => LocalAttachmentStore.getInstance().readExtractedText(ref.attachmentId, ref.name)
            )
          : effectiveQuestion;
        // 同期 API も同じイベント列を消費し、セッションログを残す
        const stream = await chat.agent.getStream(modelInput, chat.sessionId, { turn: chat.turn });
        let answer = '';
        let sawDelta = false;
        let errorMessage = '';

        for await (const event of stream) {
          if (isDurableEvent(event) && chat.persistent) {
            this.eventService.enqueue(chat.sessionId, event);
          }
          if (event.type === 'error') {
            errorMessage = event.data.message;
          } else if (event.type === 'assistant/delta') {
            answer += event.data.text;
            sawDelta = true;
          } else if (event.type === 'assistant/message' && !sawDelta) {
            answer += event.data.text;
          }
        }

        if (errorMessage) {
          await chat.flush();
          throw new Error(errorMessage);
        }

        await this.legalChatService.saveAssistantMessage(chat, answer);

        const response: LegalQueryResponse = {
          success: true,
          question: effectiveQuestion,
          answer,
          modelUsed: chat.agent.getModelName(),
          sessionId: chat.sessionId,
          timestamp: new Date().toISOString()
        };

        res.json(response);

      } catch (error) {
        Logger.error('法律相談リクエストの処理失敗', { error: (error as Error).message });
        res.status(500).json({
          success: false,
          question: req.body.question || '',
          answer: '',
          sessionId: req.body.sessionId || undefined,
          timestamp: new Date().toISOString(),
          error: (error as Error).message
        } as LegalQueryResponse);
      }
    });

    // セッション管理 API
    /**
     * @openapi
     * /api/sessions/stats:
     *   get:
     *     summary: セッション統計情報の取得
     *     description: すべてのセッションの統計情報を取得
     *     tags: [Sessions]
     *     responses:
     *       200:
     *         description: セッション統計情報の取得成功
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 totalSessions:
     *                   type: integer
     *                   description: 総セッション数
     *                 activeSessions:
     *                   type: integer
     *                   description: アクティブセッション数
     *                 averageMessagesPerSession:
     *                   type: number
     *                   description: 1 セッションあたりの平均メッセージ数
     *       500:
     *         description: サーバー内部エラー
     */
    this.app.get('/api/sessions/stats', async (req: Request, res: Response): Promise<void> => {
      try {
        const stats = MemorySaverManager.getInstance().getSessionStats();

        res.json({
          success: true,
          stats,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        Logger.error('セッション統計情報取得失敗', { error: (error as Error).message });
        res.status(500).json({
          success: false,
          error: (error as Error).message,
          timestamp: new Date().toISOString()
        });
      }
    });

    /**
     * @openapi
     * /api/sessions/new:
     *   post:
     *     summary: 新しいセッションの作成
     *     description: クライアント用に新しいセッション ID を作成
     *     tags: [Sessions]
     *     responses:
     *       200:
     *         description: 新しいセッションの作成に成功
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                   example: true
     *                 sessionId:
     *                   type: string
     *                   description: 新規作成されたセッション ID
     *                   example: "session_1234567890"
     *                 timestamp:
     *                   type: string
     *                   format: date-time
     *       500:
     *         description: サーバー内部エラー
     */
    this.app.post('/api/sessions/new', optionalAuth, async (req: any, res: Response): Promise<void> => {
      try {
        const userId = req.user?.userId;
        let newSessionId: string;

        if (userId) {
          // 为已登录用户生成一个临时的 UUID，但不立即保存到数据库
          // 只有当用户发送第一条消息时，query 接口才会真正创建数据库记录
          newSessionId = crypto.randomUUID();
          Logger.info('Generated temporary session ID for authenticated user', { userId, sessionId: newSessionId });
        } else {
          const memoryManager = MemorySaverManager.getInstance();
          newSessionId = memoryManager.createNewSession();
          Logger.info('Created new memory session via /new', { sessionId: newSessionId });
        }
        
        res.json({
          success: true,
          sessionId: newSessionId,
          timestamp: new Date().toISOString(),
          message: 'Session initialized. Database record will be created on first message.'
        });
      } catch (error) {
        Logger.error('新しいセッション作成失敗', { error: (error as Error).message });
        res.status(500).json({
          success: false,
          error: (error as Error).message,
          timestamp: new Date().toISOString()
        });
      }
    });

    /**
     * @openapi
     * /api/sessions/{sessionId}/clear:
     *   delete:
     *     summary: セッションのクリア
     *     description: 指定されたセッションのすべてのメッセージをクリア
     *     tags: [Sessions]
     *     parameters:
     *       - in: path
     *         name: sessionId
     *         required: true
     *         schema:
     *           type: string
     *         description: 会话ID
     *     responses:
     *       200:
     *         description: セッションのクリアに成功
     *       400:
     *         description: セッション ID パラメータが不足しています
     *       500:
     *         description: サーバー内部エラー
     */
    this.app.delete('/api/sessions/:sessionId/clear', async (req: Request, res: Response): Promise<void> => {
      try {
        const sessionId = Array.isArray(req.params.sessionId) 
          ? req.params.sessionId[0] 
          : req.params.sessionId;
        
        if (!sessionId || sessionId === 'undefined' || sessionId === 'null') {
          res.status(400).json({
            success: false,
            error: 'Invalid or missing sessionId parameter'
          });
          return;
        }
        
        // MemorySaverManager を使用してセッションをクリア
        const memoryManager = MemorySaverManager.getInstance();
        await memoryManager.clearSession(sessionId);
        FileUploadService.getInstance().clearSession(sessionId);
        
        Logger.info('セッションクリア成功', { sessionId });
        
        res.json({
          success: true,
          message: 'Session cleared successfully',
          sessionId,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        Logger.error('セッションクリア失敗', { 
          error: (error as Error).message,
          sessionId: req.params.sessionId
        });
        res.status(500).json({
          success: false,
          error: (error as Error).message,
          timestamp: new Date().toISOString()
        });
      }
    });

    // API ドキュメントルート
    /**
     * @openapi
     * /api/docs:
     *   get:
     *     summary: API エンドポイント一覧の取得
     *     description: 利用可能なすべての API エンドポイントとその説明を返す
     *     tags: [Documentation]
     *     responses:
     *       200:
     *         description: API ドキュメント取得成功
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ApiDocsResponse'
     */
    this.app.get('/api/docs', (req: Request, res: Response) => {
      res.json({
        endpoints: {
          'GET /': 'サーバー情報',
          'GET /health': 'ヘルスチェック',
          'GET /models': '利用可能なモデルリスト',
          'POST /webhook': 'LINE Bot webhook',
          'POST /api/legal/query': '法律問題相談（同期レスポンス）',
          'POST /api/legal/query/stream': '法律問題相談（ストリーミングレスポンス）',
          'POST /api/attachments/upload': '添付ファイルアップロード（テキスト系・埋め込みテキストPDF）',
          'GET /api/docs': 'API ドキュメント',
          // ユーザー管理関連エンドポイント
          'POST /api/user/signup': 'ユーザー登録',
          'POST /api/user/login': 'ユーザーログイン',
          'GET /api/user/profile': 'ユーザー情報取得',
          'POST /api/admin/login': '管理者ログイン',
          'GET /api/admin/dashboard': '管理者ダッシュボード',
          'GET /api/admin/users': 'ユーザーリスト取得',
          'GET /api/admin/users/:id': 'ユーザー詳細取得',
          'PUT /api/admin/users/:id': 'ユーザー情報更新',
          'DELETE /api/admin/users/:id': 'ユーザー削除',
        },
        description: '法的アシスタント LINE Bot サーバー API'
      });
    });
    
    // ユーザー管理ルート
    this.app.use('/api/user', userRoutes);
    this.app.use('/api/admin', adminRoutes);
    this.app.use('/api/chat', chatRoutes);
    this.app.use('/api/attachments', attachmentRoutes);
    
    Logger.info('ルート設定完了');
  }

  /**
   * Swagger UI の設定
   */
  private setupSwagger(): void {
    // Swagger UI ルート
    this.app.use('/docs', swaggerUi.serve, swaggerUi.setup(this.swaggerSpec, {
      explorer: true,
      swaggerOptions: {
        docExpansion: 'list',
        deepLinking: true,
        displayOperationId: false,
        defaultModelsExpandDepth: 1,
        defaultModelExpandDepth: 1
      },
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: '法的アシスタント API 文档'
    }));

    // OpenAPI JSON ドキュメント
    this.app.get('/docs-json', (req: Request, res: Response) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(this.swaggerSpec);
    });

    Logger.info('Swagger UI 設定完了');
  }

  /**
   * エラーハンドリングの設定
   */
  private setupErrorHandling(): void {
    // 404 処理
    this.app.use(notFoundHandler);

    // エラーハンドリング
    this.app.use(errorHandler);

    Logger.info('エラーハンドリング設定完了');
  }

  /**
   * サーバー起動時に MCP・チェックポインター・スキル・既定エージェントをバックグラウンドでウォームアップする。
   * deepseek-harness の起動時サービス初期化と同様、初回チャット入力時のコールドスタート待ちを解消する。
   */
  private startRuntimeWarmup(modelManager: ModelManager): void {
    const startedAt = Date.now();
    void (async () => {
      try {
        loadLegalSkills();
        await Promise.all([
          initializeMCPServers()
            .then(() => getMCPTools())
            .catch(error => {
              Logger.warn('バックグラウンド MCP ウォームアップ失敗（チャット時に再試行します）', {
                error: (error as Error).message,
              });
            }),
          PostgresMemoryManager.getInstance()
            .getCheckpointer()
            .catch(error => {
              Logger.warn('バックグラウンド PostgresSaver ウォームアップ失敗（チャット時に再試行します）', {
                error: (error as Error).message,
              });
            }),
        ]);

        const defaultModel = modelManager.resolveModel();
        await MemorySaverManager.getInstance().warmupModel(defaultModel);
        Logger.info('ランタイム事前ウォームアップ完了', {
          model: defaultModel.name,
          durationMs: Date.now() - startedAt,
        });
      } catch (error) {
        Logger.warn('ランタイム事前ウォームアップに失敗しました（初回チャット時に遅延初期化します）', {
          error: (error as Error).message,
        });
      }
    })();
  }

  /**
   * サーバーの起動
   */
  public async start(): Promise<void> {
    // MCP 接続・PostgresSaver・スキル読み込みはモデル一覧取得と並列に即座に開始する
    loadLegalSkills();
    void initializeMCPServers().then(() => getMCPTools()).catch(() => {});
    void PostgresMemoryManager.getInstance().getCheckpointer().catch(() => {});

    // 启动时初始化 ModelManager
    Logger.info('Initializing ModelManager...');
    const modelManager = ModelManager.getInstance();
    await modelManager.initialize();
    Logger.info('ModelManager initialized successfully');

    // モデル一覧が揃った段階で既定モデルの LegalAgent も事前ウォームアップする
    this.startRuntimeWarmup(modelManager);

    return new Promise((resolve, reject) => {
      const server = this.httpServer = this.app.listen(this.port, () => {
        Logger.info(`法的アシスタントサーバー起動成功`, {
          port: this.port,
          environment: config.app.env,
          timestamp: new Date().toISOString()
        });

        console.log(`
╔══════════════════════════════════════╗
║   法的アシスタントサーバー起動完了   ║
╠══════════════════════════════════════╣
║ ポート：${this.port.toString().padEnd(28)} ║
║ 環境：${config.app.env.padEnd(30)} ║
║ LINE Bot: ${(config.line.channelSecret && config.line.accessToken ? '有効' : '無効').padEnd(26)} ║
╚══════════════════════════════════════╝
        `);

        resolve();
      });

      server.on('error', (error: Error) => {
        Logger.error('サーバー起動失敗', { 
          error: error?.message || 'unknown error',
          stack: error?.stack,
          code: (error as any)?.code,
          errno: (error as any)?.errno
        });
        reject(error);
      });
    });
  }

  /**
   * サーバーの停止（新規接続を止め、既存接続の完了を待つ）
   */
  public async close(): Promise<void> {
    if (!this.httpServer) return;
    await new Promise<void>((resolve, reject) => {
      this.httpServer!.close(error => (error ? reject(error) : resolve()));
    });
    this.httpServer = undefined;
    Logger.info('サーバー停止完了');
  }

  /**
   * Express アプリケーションインスタンスの取得
   */
  public getApp(): Application {
    return this.app;
  }
}