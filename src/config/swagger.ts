import { Options } from 'swagger-jsdoc';

/**
 * Swagger 設定オプション
 */
export const swaggerOptions: Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '法的アシスタント API',
      version: '1.0.0',
      description: '法律アシスタントLINE BotサーバーAPIドキュメント',
      contact: {
        name: 'Law Assistant Team',
        email: 'support@law-assistant.com'
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
              example: '法的アシスタントサーバー'
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
                  example: '服务器信息'
                },
                'GET /health': {
                  type: 'string',
                  example: '健康检查'
                },
                'POST /webhook': {
                  type: 'string',
                  example: 'LINE Bot webhook'
                },
                'GET /api/docs': {
                  type: 'string',
                  example: 'API 文档'
                }
              }
            },
            description: {
              type: 'string',
              example: '法的アシスタント LINE Bot サーバー API'
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
              example: '轻量级高性能模型'
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
              description: '法律相关问题',
              example: '日本の法律に窃盗罪が定義されていますか？'
            },
            model: {
              type: 'string',
              description: '使用的模型名称（可选）',
              example: 'gpt-4o-mini'
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
              example: '日本の法律に窃盗罪が定義されていますか？'
            },
            answer: {
              type: 'string',
              example: 'はい、日本の刑法第235条に窃盗罪が定義されています。'
            },
            modelUsed: {
              type: 'string',
              example: 'gpt-4o-mini'
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
        }
      }
    },
    tags: [
      {
        name: 'Health',
        description: '服务器健康检查相关接口'
      },
      {
        name: 'Core',
        description: '核心服务器信息接口'
      },
      {
        name: 'Models',
        description: '模型管理相关接口'
      },
      {
        name: 'Legal',
        description: '法律咨询相关接口'
      },
      {
        name: 'Webhook',
        description: 'LINE Bot Webhook 接口'
      },
      {
        name: 'Documentation',
        description: 'API 文档接口'
      }
    ]
  },
  apis: ['./src/server.ts', './src/routes/*.ts'] // 指定包含 JSDoc 注释的文件
};

export default swaggerOptions;