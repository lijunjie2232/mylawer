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
      description: '法律アシスタントサーバーAPIドキュメント',
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
        description: 'Development server'
      },
      {
        url: 'https://your-domain.com',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT authentication token'
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
              example: 'Law Assistant Server'
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
                  example: 'Server information'
                },
                'GET /health': {
                  type: 'string',
                  example: 'Health check'
                },
                'GET /models': {
                  type: 'string',
                  example: 'Available models list'
                },
                'POST /webhook': {
                  type: 'string',
                  example: 'LINE Bot webhook'
                },
                'POST /api/legal/query': {
                  type: 'string',
                  example: 'Legal consultation (synchronous)'
                },
                'POST /api/legal/query/stream': {
                  type: 'string',
                  example: 'Legal consultation (streaming)'
                },
                'POST /api/user/signup': {
                  type: 'string',
                  example: 'User registration'
                },
                'POST /api/user/login': {
                  type: 'string',
                  example: 'User login'
                },
                'GET /api/user/profile': {
                  type: 'string',
                  example: 'Get user profile'
                },
                'DELETE /api/user/delete': {
                  type: 'string',
                  example: 'Delete user account'
                },
                'POST /api/admin/login': {
                  type: 'string',
                  example: 'Admin login'
                },
                'GET /api/admin/dashboard': {
                  type: 'string',
                  example: 'Admin dashboard'
                },
                'GET /api/admin/users': {
                  type: 'string',
                  example: 'Get all users'
                },
                'GET /api/chat/sessions': {
                  type: 'string',
                  example: 'Get user sessions'
                }
              }
            },
            description: {
              type: 'string',
              example: 'Law Assistant LINE Bot Server API'
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
              example: 'Lightweight high-performance model'
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
              description: 'Legal-related question',
              example: 'Is theft defined in Japanese law?'
            },
            model: {
              type: 'string',
              description: 'Model name to use (optional)',
              example: 'gpt-4o-mini'
            },
            sessionId: {
              type: 'string',
              description: 'Session ID for maintaining conversation history (optional)',
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
              example: 'Is theft defined in Japanese law?'
            },
            answer: {
              type: 'string',
              example: 'Yes, theft is defined in Article 235 of the Japanese Penal Code.'
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
              example: 'Legal consultation about theft'
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
              example: 'What is the penalty for theft?'
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
        description: 'Server health check endpoints'
      },
      {
        name: 'Core',
        description: 'Core server information endpoints'
      },
      {
        name: 'Models',
        description: 'Model management endpoints'
      },
      {
        name: 'Legal',
        description: 'Legal consultation endpoints'
      },
      {
        name: 'Sessions',
        description: 'Chat session management endpoints'
      },
      {
        name: 'User',
        description: 'User authentication and profile management'
      },
      {
        name: 'Admin',
        description: 'Admin-only management endpoints'
      },
      {
        name: 'Chat',
        description: 'Chat history and session management'
      },
      {
        name: 'Webhook',
        description: 'LINE Bot webhook endpoints'
      },
      {
        name: 'Documentation',
        description: 'API documentation endpoints'
      }
    ]
  },
  apis: ['./src/server.ts', './src/routes/*.ts'] // 指定包含 JSDoc 注释的文件
};

export default swaggerOptions;