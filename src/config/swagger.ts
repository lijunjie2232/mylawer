import { Options } from 'swagger-jsdoc';

/**
 * Swagger 設定オプション
 */
export const swaggerOptions: Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '法律アシスタント API',
      version: '2.0.0',
      description: '法律アシスタントサーバーAPIドキュメント - AI搭載の法律相談アシスタント',
      contact: {
        name: 'lijunjie2232',
        url: 'https://blog.lijunjie.dpdns.org',
        email: 'li2533584225@gmail.com'
      },
      license: {
        name: 'GPL-3.0',
        url: 'https://www.gnu.org/licenses/gpl-3.0.html'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: '開発環境サーバー'
      },
      {
        url: 'https://your-domain.com',
        description: '本番環境サーバー'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT 認証トークン'
        }
      },
      schemas: {
        HealthResponse: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              example: 'ok'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2026-02-17T10:00:00.000Z'
            },
            uptime: {
              type: 'number',
              example: 1234.56
            }
          }
        },
        ServerInfoResponse: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example: '法律アシスタントサーバー'
            },
            version: {
              type: 'string',
              example: '1.0.0'
            },
            status: {
              type: 'string',
              example: 'running'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2026-02-17T10:00:00.000Z'
            }
          }
        },
        ApiDocsResponse: {
          type: 'object',
          properties: {
            endpoints: {
              type: 'object',
              properties: {
                'GET /': {
                  type: 'string',
                  example: 'サーバー情報'
                },
                'GET /health': {
                  type: 'string',
                  example: 'ヘルスチェック'
                },
                'GET /models': {
                  type: 'string',
                  example: '利用可能なモデル一覧'
                },
                'POST /webhook': {
                  type: 'string',
                  example: 'LINE Bot webhook'
                },
                'POST /api/legal/query': {
                  type: 'string',
                  example: '法律相談（同期レスポンス）'
                },
                'POST /api/legal/query/stream': {
                  type: 'string',
                  example: '法律相談（ストリーミングレスポンス）'
                },
                'POST /api/user/signup': {
                  type: 'string',
                  example: 'ユーザー登録'
                },
                'POST /api/user/login': {
                  type: 'string',
                  example: 'ユーザーログイン'
                },
                'GET /api/user/profile': {
                  type: 'string',
                  example: 'ユーザー情報取得'
                },
                'DELETE /api/user/delete': {
                  type: 'string',
                  example: 'ユーザーアカウント削除'
                },
                'POST /api/admin/login': {
                  type: 'string',
                  example: '管理者ログイン'
                },
                'GET /api/admin/dashboard': {
                  type: 'string',
                  example: '管理者ダッシュボード'
                },
                'GET /api/admin/users': {
                  type: 'string',
                  example: '全ユーザー取得'
                },
                'GET /api/chat/sessions': {
                  type: 'string',
                  example: 'ユーザーセッション取得'
                }
              }
            },
            description: {
              type: 'string',
              example: '法律アシスタント LINE Bot サーバー API'
            }
          }
        },
        WebhookErrorResponse: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              example: 'Internal Server Error'
            },
            message: {
              type: 'string',
              example: 'Failed to process webhook'
            }
          }
        },
        ModelInfo: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              example: 'gpt-4o-mini'
            },
            displayName: {
              type: 'string',
              example: 'OpenAI - GPT-4o Mini'
            },
            provider: {
              type: 'string',
              example: 'openai'
            },
            description: {
              type: 'string',
              example: '軽量高性能モデル'
            },
            isEnabled: {
              type: 'boolean',
              example: true
            },
            isHealthy: {
              type: 'boolean',
              example: true
            },
            responseTime: {
              type: 'number',
              example: 150
            }
          }
        },
        ModelsApiResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            models: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/ModelInfo'
              }
            },
            defaultModel: {
              type: 'string',
              example: 'gpt-oss:20b'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2026-02-17T10:00:00.000Z'
            },
            error: {
              type: 'string',
              example: 'Failed to retrieve models list'
            }
          }
        },
        LegalQueryRequest: {
          type: 'object',
          required: ['question'],
          properties: {
            question: {
              type: 'string',
              description: '法律関連の質問',
              example: '日本の法律に窃盗罪は定義されていますか？'
            },
            model: {
              type: 'string',
              description: '使用するモデル名（オプション）',
              example: 'gpt-4o-mini'
            },
            sessionId: {
              type: 'string',
              description: '会話履歴を維持するためのセッションID（オプション）',
              example: 'session_1234567890'
            }
          }
        },
        LegalQueryResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            question: {
              type: 'string',
              example: '日本の法律に窃盗罪は定義されていますか？'
            },
            answer: {
              type: 'string',
              example: 'はい、日本の刑法第235条に窃盗罪が定義されています。'
            },
            modelUsed: {
              type: 'string',
              example: 'gpt-4o-mini'
            },
            sessionId: {
              type: 'string',
              example: 'session_1234567890'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2026-02-17T10:00:00.000Z'
            },
            error: {
              type: 'string',
              example: 'Failed to process legal query'
            }
          }
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              example: '550e8400-e29b-41d4-a716-446655440000'
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'user@example.com'
            },
            name: {
              type: 'string',
              example: 'John Doe'
            },
            role: {
              type: 'string',
              enum: ['USER', 'ADMIN'],
              example: 'USER'
            },
            isActive: {
              type: 'boolean',
              example: true
            },
            lastLoginAt: {
              type: 'string',
              format: 'date-time',
              nullable: true
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'user@example.com'
            },
            password: {
              type: 'string',
              minLength: 8,
              example: 'Password123!'
            }
          }
        },
        SignupRequest: {
          type: 'object',
          required: ['email', 'password', 'name'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'user@example.com'
            },
            password: {
              type: 'string',
              minLength: 8,
              example: 'Password123!'
            },
            name: {
              type: 'string',
              example: 'John Doe'
            }
          }
        },
        LoginResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            token: {
              type: 'string',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
            },
            expiresIn: {
              type: 'number',
              example: 86400
            },
            user: {
              $ref: '#/components/schemas/User'
            },
            timestamp: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        SessionInfo: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              example: '550e8400-e29b-41d4-a716-446655440000'
            },
            userId: {
              type: 'string',
              format: 'uuid'
            },
            title: {
              type: 'string',
              example: '窃盗に関する法律相談'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        ChatMessage: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            sessionId: {
              type: 'string',
              format: 'uuid'
            },
            role: {
              type: 'string',
              enum: ['user', 'assistant'],
              example: 'user'
            },
            content: {
              type: 'string',
              example: '窃盗の罰則は何ですか？'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
      }
    },
    tags: [
      {
        name: 'Health',
        description: 'サーバーヘルスチェック関連エンドポイント'
      },
      {
        name: 'Core',
        description: 'コアサーバー情報エンドポイント'
      },
      {
        name: 'Models',
        description: 'モデル管理エンドポイント'
      },
      {
        name: 'Legal',
        description: '法律相談エンドポイント'
      },
      {
        name: 'Sessions',
        description: 'チャットセッション管理エンドポイント'
      },
      {
        name: 'User',
        description: 'ユーザー認証とプロフィール管理'
      },
      {
        name: 'Admin',
        description: '管理者専用管理エンドポイント'
      },
      {
        name: 'Chat',
        description: 'チャット履歴とセッション管理'
      },
      {
        name: 'Webhook',
        description: 'LINE Bot webhook エンドポイント'
      },
      {
        name: 'Documentation',
        description: 'API ドキュメントエンドポイント'
      }
    ]
  },
  apis: ['./src/server.ts', './src/routes/*.ts'] // 指定包含 JSDoc 注释的文件
};

export default swaggerOptions;