import { z } from 'zod';
import dotenv from 'dotenv';

// 環境変数を読み込む
dotenv.config();

// 环境变数検証スキーマ
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
  
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  
  // LINE Bot 配置
  LINE_CHANNEL_SECRET: z.string().optional(),
  LINE_ACCESS_TOKEN: z.string().optional(),
  
  // 搜索 API 配置
  TAVILY_API_KEY: z.string().optional(),
  JINA_API_KEY: z.string().optional(),
  
  // データベース配置
  DATABASE_URL: z.string().url(),
  
  // JWT & 認証配置
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
console.log('LLM_BASE_URL:', process.env.LLM_BASE_URL);
console.log('LLM_API_KEY:', process.env.LLM_API_KEY ? '***' + process.env.LLM_API_KEY.slice(-4) : '未設定');
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
    modelProvider: env.LLM_MODEL_PROVIDER,
    modelName: env.LLM_MODEL_NAME,
    maxTokens: env.LLM_MAX_TOKENS,
    temperature: env.LLM_TEMPERATURE,
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