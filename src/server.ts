import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';

// ESM モードでは __dirname と __filename を使用できないため、手動で定義
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { config } from './config/environment.js';
import { swaggerOptions } from './config/swagger.js';
import { LineBotHandler } from './handlers/lineBotHandler.js';
import { LegalAgent } from './agents/legalAgent.js';
import { AgentManager } from './agents/agentManager.js';
import { ModelManager } from './models/modelManager.js';
import { Logger } from './utils/logger.js';
import { MemorySaverManager } from './memory/memorySaverManager.js';
import { lineSignatureMiddleware } from './middleware/lineSignatureMiddleware.js';
import { rawBodyMiddleware } from './middleware/rawBodyMiddleware.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { LineWebhookBody } from './types/server.js';
import { LegalQueryRequest, LegalQueryResponse, ModelsApiResponse, LlmModelsResponse, LlmModel, ModelInfo } from './types/index.js';
import { DatabaseService } from './services/databaseService.js';
import userRoutes from './routes/userRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

export class Server {
  private app: Application;
  private lineBotHandler: LineBotHandler;
  private legalAgent: LegalAgent;
  private agentManager: AgentManager;
  private modelManager: ModelManager;
  private port: number;
  private swaggerSpec: ReturnType<typeof swaggerJsdoc>;

  constructor() {
    this.app = express();
    this.port = config.app.port;
    this.lineBotHandler = new LineBotHandler();
    this.legalAgent = new LegalAgent();
    this.agentManager = AgentManager.getInstance();
    this.modelManager = ModelManager.getInstance();
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
    // 生リクエストボディミドルウェア（LINE 署名検証用）
    this.app.use((req, res, next) => rawBodyMiddleware(req as any, res as any, next));

    // CORS 設定
    if (config.app.env === 'development') {
      this.app.use(cors());
    }

    // JSON 解析ミドルウェア
    this.app.use(express.json());

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
      path.join(__dirname, 'dist/frontend'),
      path.join(process.cwd(), 'dist/frontend')
    ];
    
    const frontendDistPath = possiblePaths.find(p => {
      try {
        return require('fs').existsSync(p);
      } catch {
        return false;
      }
    }) || path.join(__dirname, '../frontend/dist');

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
    
        // ModelManager が初期化されていることを確認
        const modelManager = ModelManager.getInstance();
        await modelManager.initialize();
    
        // ModelManager からすべての有効なモデルを取得
        const models = modelManager.getEnabledModels().map(model => ({
          name: model.name,
          displayName: model.displayName,
          provider: model.provider,
          description: model.description,
          isEnabled: model.isEnabled,
          isHealthy: true
        }));
    
        const defaultModel = models.length > 0 ? models[0].name : '';
    
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
     *                 description: 法律関連問題
     *                 example: '日本の法律に窃盗罪が定義されていますか？'
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
    this.app.post('/api/legal/query/stream', async (req: Request, res: Response): Promise<void> => {
      try {
        const { question, model, sessionId }: LegalQueryRequest & { sessionId?: string } = req.body;

        if (!question || typeof question !== 'string') {
          res.status(400).json({
            success: false,
            error: 'Invalid request: question is required and must be a string'
          } as LegalQueryResponse);
          return;
        }

        Logger.info('法律相談流式リクエストを受信', {
          question: question.substring(0, 100) + '...',
          model: model || 'default',
          sessionId: sessionId || 'none'
        });

        // SSE レスポンスヘッダーの設定
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        });

        // 发送开始事件
        res.write(`data: ${JSON.stringify({ type: 'start', timestamp: new Date().toISOString() })}\n\n`);

        try {
          // MemorySaverManagerを使用してセッションを処理
          const memoryManager = MemorySaverManager.getInstance();
          let actualSessionId = sessionId || memoryManager.createNewSession();
          let session = memoryManager.getSession(actualSessionId);
          
          // セッションが存在しない場合、新しいセッションを作成
          if (!session) {
            actualSessionId = memoryManager.createNewSession();
            session = memoryManager.getSession(actualSessionId);
            Logger.info('Created new session for first chat', { sessionId: actualSessionId });
          }
          
          // モデル設定を取得
          const modelManager = ModelManager.getInstance();
          const enabledModels = modelManager.getEnabledModels();
          const targetModel = model || (enabledModels.length > 0 ? enabledModels[0].name : config.llm.modelName);
          const modelConfig = modelManager.getModel(targetModel);
          
          if (!modelConfig) {
            throw new Error(`Model '${targetModel}' not found`);
          }
          
          // セッション用のエージェントを作成（初回チャットの場合）
          let agent = session!.agent;
          if (!agent) {
            agent = await memoryManager.createAgentForSession(actualSessionId, modelConfig);
            Logger.info('Agent created for session on first chat', { 
              sessionId: actualSessionId, 
              model: targetModel 
            });
          }

          // ストリーミングレスポンスの取得
          const stream = await agent.getStream(question, actualSessionId);

          // リアルタイムでストリーミングデータを送信（LLM タイプのメッセージのみ送信）
          let fullResponse = '';
          for await (const chunk of stream) {
            // chunk に { type, content, messageType } が含まれる
            if (chunk && typeof chunk === 'object' && chunk.type === 'llm') {
              // LLM タイプのメッセージのみ処理、tool タイプをフィルタリング
              const content = chunk.content;
              if (typeof content === 'string') {
                fullResponse += content;

                // 内容更新イベントの送信
                res.write(`data: ${JSON.stringify({
                  type: 'content',
                  content: content,
                  accumulated: fullResponse.length,
                  messageType: 'llm'
                })}\n\n`);
              }
            }
          }

          // 完了イベントの送信
          res.write(`data: ${JSON.stringify({
            type: 'complete',
            finalResponse: fullResponse,
            modelUsed: agent.getModelName(),
            sessionId: actualSessionId,
            timestamp: new Date().toISOString()
          })}\n\n`);

        } catch (streamError) {
          // エラーイベントの送信
          res.write(`data: ${JSON.stringify({
            type: 'error',
            error: (streamError as Error).message,
            timestamp: new Date().toISOString()
          })}\n\n`);
          Logger.error('ストリーミング処理失敗', { error: (streamError as Error).message });
        }

        // 接続の終了
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
    this.app.post('/api/legal/query', async (req: Request, res: Response): Promise<void> => {
      try {
        const { question, model, sessionId }: LegalQueryRequest & { sessionId?: string } = req.body;

        if (!question || typeof question !== 'string') {
          res.status(400).json({
            success: false,
            error: 'Invalid request: question is required and must be a string'
          } as LegalQueryResponse);
          return;
        }

        Logger.info('法律相談リクエストを受信', {
          question: question.substring(0, 100) + '...',
          model: model || 'default',
          sessionId: sessionId || 'none'
        });

        // MemorySaverManagerを使用してセッションを処理
        const memoryManager = MemorySaverManager.getInstance();
        let actualSessionId = sessionId || memoryManager.createNewSession();
        let session = memoryManager.getSession(actualSessionId);
        
        // セッションが存在しない場合、新しいセッションを作成
        if (!session) {
          actualSessionId = memoryManager.createNewSession();
          session = memoryManager.getSession(actualSessionId);
          Logger.info('Created new session for first chat', { sessionId: actualSessionId });
        }
        
        // モデル設定を取得
        const modelManager = ModelManager.getInstance();
        const enabledModels = modelManager.getEnabledModels();
        const targetModel = model || (enabledModels.length > 0 ? enabledModels[0].name : config.llm.modelName);
        const modelConfig = modelManager.getModel(targetModel);
        
        if (!modelConfig) {
          throw new Error(`Model '${targetModel}' not found`);
        }
        
        // セッション用のエージェントを作成（初回チャットの場合）
        let agent = session!.agent;
        if (!agent) {
          agent = await memoryManager.createAgentForSession(actualSessionId, modelConfig);
          Logger.info('Agent created for session on first chat', { 
            sessionId: actualSessionId, 
            model: targetModel 
          });
        }
        
        const answer = await agent.processQuery(question, actualSessionId);

        const response: LegalQueryResponse = {
          success: true,
          question,
          answer,
          modelUsed: agent.getModelName(),
          sessionId: actualSessionId || undefined,
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
        const agent = await this.agentManager.getAgent();
        const stats = agent.getSessionStats();
        
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
    this.app.post('/api/sessions/new', async (req: Request, res: Response): Promise<void> => {
      try {
        // MemorySaverManager を使用して新しいセッションを作成（セッション ID のみを返す）
        const memoryManager = MemorySaverManager.getInstance();
        const newSessionId = memoryManager.createNewSession();
        
        Logger.info('New session created without agent', { sessionId: newSessionId });
        
        res.json({
          success: true,
          sessionId: newSessionId,
          timestamp: new Date().toISOString(),
          message: 'Session created successfully. Agent will be created on first chat.'
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
        memoryManager.clearSession(sessionId);
        
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
   * サーバーの起動
   */
  public async start(): Promise<void> {
    // 启动时初始化 ModelManager
    Logger.info('Initializing ModelManager...');
    const modelManager = ModelManager.getInstance();
    await modelManager.initialize();
    Logger.info('ModelManager initialized successfully');

    return new Promise((resolve, reject) => {
      const server = this.app.listen(this.port, () => {
        Logger.info(`法的アシスタントサーバー起動成功`, {
          port: this.port,
          environment: config.app.env,
          timestamp: new Date().toISOString()
        });

        console.log(`
╔══════════════════════════════════════╗
║    法的アシスタントサーバー起動完了    ║
╠══════════════════════════════════════╣
║ ポート：${this.port.toString().padEnd(28)} ║
║ 環境：${config.app.env.padEnd(30)} ║
║ LINE Bot: ${config.line.channelSecret && config.line.accessToken
            ? '有効'
            : '無効'
          }.padEnd(26)} ║
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
   * サーバーの停止
   */
  public async close(): Promise<void> {
    return new Promise((resolve) => {
      // Express アプリケーションには close メソッドがないため、ここではシミュレーションのみ
      Logger.info('サーバー停止完了');
      resolve();
    });
  }

  /**
   * Express アプリケーションインスタンスの取得
   */
  public getApp(): Application {
    return this.app;
  }
}