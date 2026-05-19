import { z } from 'zod';
import dotenv from 'dotenv';

// 環境変数を読み込む
dotenv.config();

// 環境変数検証スキーマ
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default(3000),
  
  // 統一された LLM 設定
  LLM_MODEL_PROVIDER: z.string().default('openai'),
  LLM_MODEL_NAME: z.string().default('gpt-4o-mini'),
  LLM_BASE_URL: z.string().default('https://api.openai.com/v1'),
  LLM_MAX_TOKENS: z.string().transform(Number).default(8192),
  LLM_TEMPERATURE: z.string().transform(Number).default(0.7),
  LLM_API_KEY: z.string().min(1, 'LLM_API_KEY is required and cannot be empty'),
  
  // Free Model 設定
  USE_FREE_MODEL: z.string().transform(v => v === 'true').default('false'),
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
});

// 検証および設定のエクスポート
const env = envSchema.parse(process.env);

// デバッグログ：環境変数の確認
console.log('=== 環境変数デバッグ ===');
console.log('LLM_MODEL_PROVIDER:', process.env.LLM_MODEL_PROVIDER);
console.log('USE_FREE_MODEL:', env.USE_FREE_MODEL);
console.log('FREE_MODEL_BASE_URL:', env.FREE_MODEL_BASE_URL);
// Mask LLM_BASE_URL - show only last 4 characters
const maskedBaseUrl = process.env.LLM_BASE_URL 
  ? '********' + process.env.LLM_BASE_URL.slice(-4)
  : '未設定';
console.log('LLM_BASE_URL:', maskedBaseUrl);
// Mask LLM_API_KEY - show only last 4 characters
const maskedApiKey = process.env.LLM_API_KEY 
  ? '********' + process.env.LLM_API_KEY.slice(-4)
  : '未設定';
console.log('LLM_API_KEY:', maskedApiKey);
console.log('=====================');

export const config = {
  app: {
    env: env.NODE_ENV,
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
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
};

export type Config = typeof config;