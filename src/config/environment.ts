import { z } from 'zod';
import dotenv from 'dotenv';

// 環境変数を読み込む
dotenv.config();

// 環境変数検証スキーマ
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default(3000),
  // CORS 許可オリジン（カンマ区切り）。未設定の場合、リクエストの Origin を反映
  CORS_ORIGIN: z.string().optional(),
  
  // 統一された LLM 設定
  LLM_MODEL_PROVIDER: z.string().default('openai'),
  LLM_MODEL_NAME: z.string().default('gpt-4o-mini'),
  LLM_BASE_URL: z.string().default('https://api.openai.com/v1'),
  LLM_MAX_TOKENS: z.string().transform(Number).default(8192),
  LLM_TEMPERATURE: z.string().transform(Number).default(0.7),
  LLM_API_KEY: z.string().min(1, 'LLM_API_KEY is required and cannot be empty'),
  
  // Free Model 設定
  USE_FREE_MODEL: z.string().transform(v => v === 'true').default(false),
  FREE_MODEL_BASE_URL: z.string().default('https://openrouter.ai/api/v1'),
  DEFAULT_MODEL: z.string().optional(),
  
  // 使用可能なモデルリスト（カンマ区切り）、空の場合はすべてのモデルを許可
  ALLOW_MODELS: z.string().optional(),
  
  // 使用可能なMCPツールリスト（カンマまたはセミコロン区切り）、空の場合はすべてのツールを許可
  ALLOWED_MCP_TOOLS: z.string().optional(),
  
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  
  // LINE Bot 設定
  LINE_CHANNEL_SECRET: z.string().optional(),
  LINE_ACCESS_TOKEN: z.string().optional(),
  
  // 検索 API 設定
  TAVILY_API_KEY: z.string().optional(),
  JINA_API_KEY: z.string().optional(),
  
  // データベース設定
  DATABASE_URL: z.string().url(),
  DB_TYPE: z.string().default('postgresql'),
  
  // JWT & 認証設定
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.coerce.number().default(86400), // 24 hours
  SESSION_TOKEN_EXPIRES_IN: z.coerce.number().default(604800), // 7 days
  
  // デフォルト管理者アカウント
  DEFAULT_ADMIN_EMAIL: z.string().email().default('admin@example.com'),
  DEFAULT_ADMIN_PASSWORD: z.string().min(8).default('Admin123!@#'),

  // ファイル添付設定
  ATTACHMENT_DIR: z.string().optional(),
  ATTACHMENT_MAX_FILE_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024), // 10 MiB
  ATTACHMENT_MAX_FILES_PER_MESSAGE: z.coerce.number().int().positive().default(5),
});

// 検証および設定のエクスポート
const env = envSchema.parse(process.env);

// 本番環境で既定値のままになっている認証情報を警告（起動は継続）
if (env.NODE_ENV === 'production') {
  if (/your_jwt_secret|change_in_production/i.test(env.JWT_SECRET)) {
    console.warn('[SECURITY] JWT_SECRET が既定値のままです。本番環境では必ず変更してください。');
  }
  if (env.DEFAULT_ADMIN_PASSWORD === 'Admin123!@#') {
    console.warn('[SECURITY] DEFAULT_ADMIN_PASSWORD が既定値のままです。本番環境では必ず変更してください。');
  }
}

export const config = {
  app: {
    env: env.NODE_ENV,
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    corsOrigin: env.CORS_ORIGIN,
  },
  llm: {
    apiKey: env.LLM_API_KEY || '',
    baseUrl: env.LLM_BASE_URL,
    useFreeModel: env.USE_FREE_MODEL,
    freeModelBaseUrl: env.FREE_MODEL_BASE_URL,
    modelProvider: env.LLM_MODEL_PROVIDER,
    modelName: env.LLM_MODEL_NAME,
    defaultModel: env.DEFAULT_MODEL,
    maxTokens: env.LLM_MAX_TOKENS,
    temperature: env.LLM_TEMPERATURE,
    allowedModels: env.ALLOW_MODELS ? env.ALLOW_MODELS.split(/[,;]/).map(m => m.trim()).filter(m => m.length > 0) : undefined,
  },
  mcp: {
    allowedTools: env.ALLOWED_MCP_TOOLS ? env.ALLOWED_MCP_TOOLS.split(/[,;]/).map(t => t.trim()).filter(t => t.length > 0) : undefined,
  },
  line: {
    channelSecret: env.LINE_CHANNEL_SECRET,
    accessToken: env.LINE_ACCESS_TOKEN,
  },
  search: {
    tavilyApiKey: env.TAVILY_API_KEY,
    jinaApiKey: env.JINA_API_KEY,
  },
  database: {
    url: env.DATABASE_URL,
    type: env.DB_TYPE,
  },
  auth: {
    jwtSecret: env.JWT_SECRET,
    jwtExpiresIn: env.JWT_EXPIRES_IN,
    sessionTokenExpiresIn: env.SESSION_TOKEN_EXPIRES_IN,
    defaultAdminEmail: env.DEFAULT_ADMIN_EMAIL,
    defaultAdminPassword: env.DEFAULT_ADMIN_PASSWORD,
  },
  attachments: {
    dir: env.ATTACHMENT_DIR,
    maxFileBytes: env.ATTACHMENT_MAX_FILE_BYTES,
    maxFilesPerMessage: env.ATTACHMENT_MAX_FILES_PER_MESSAGE,
  },
};

export type Config = typeof config;