---
title: 環境設定
description: 環境変数と設定オプションの詳細ガイド
lastUpdated: 2026-03-11
---

# 環境設定ガイド

法律アシスタントの環境変数と設定オプションに関する詳細なガイドです。

## 環境変数の管理

### 基本原則

1. **機密情報**: API キー、パスワードなどは環境変数で管理
2. **バージョン管理**: `.env` ファイルは Git に含めない（`.gitignore` で除外）
3. **テンプレート**: `.env.example` を作成して必要な変数を文書化
4. **環境ごと**: 開発、テスト、本番で異なる設定を使用

## 必須環境変数

### LLM 設定

```bash
# 統一的 LLM 設定
LLM_MODEL_PROVIDER=ollama          # モデルプロバイダー
LLM_MODEL_NAME=gpt-oss:20b          # モデル名
LLM_BASE_URL=http://localhost:11434/v1  # API エンドポイント
LLM_MAX_TOKENS=8192                 # 最大トークン数
LLM_TEMPERATURE=0.7                 # 創造性（0.0-1.0）
LLM_API_KEY=your_api_key_here       # API キー
```

#### プロバイダー別設定

**Ollama（ローカルモデル）**:
```bash
LLM_MODEL_PROVIDER=ollama
LLM_MODEL_NAME=gpt-oss:20b
LLM_BASE_URL=http://localhost:11434/v1
LLM_API_KEY=ollama
```

**OpenAI**:
```bash
LLM_MODEL_PROVIDER=openai
LLM_MODEL_NAME=gpt-3.5-turbo
LLM_API_KEY=sk-your-openai-api-key
# BASE_URL はデフォルトで使用（https://api.openai.com/v1）
```

**Anthropic**:
```bash
LLM_MODEL_PROVIDER=anthropic
LLM_MODEL_NAME=claude-3-sonnet-20240229
LLM_API_KEY=your-anthropic-api-key
```

### データベース設定

```bash
# PostgreSQL 接続情報
DATABASE_URL=postgresql://user:password@localhost:5432/law_assistant

# または個別のパラメータ
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=law_assistant
```

### アプリケーション設定

```bash
# 基本設定
NODE_ENV=development    # 環境（development, test, production）
PORT=3000               # サーバーポート
LOG_LEVEL=info          # ログレベル（debug, info, warn, error）
HOST=0.0.0.0           # バインドアドレス
```

## オプション環境変数

### LINE Bot 設定

```bash
# LINE Messaging API
LINE_CHANNEL_SECRET=your_channel_secret
LINE_ACCESS_TOKEN=your_access_token
```

### 認証・セキュリティ

```bash
# API 認証
API_KEY=your-api-key-for-endpoints

# JWT 設定（将来的な機能）
JWT_SECRET=your-jwt-secret
JWT_EXPIRES_IN=7d
```

### 管理者アカウント初期化

```bash
# Docker 環境での管理者初期化
RUN_MIGRATIONS=true
INIT_ADMIN=true
DEFAULT_ADMIN_EMAIL=admin@example.com
DEFAULT_ADMIN_PASSWORD=SecurePassword123!
```

### キャッシュ設定

```bash
# Redis キャッシュ（オプション）
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=optional_password
CACHE_TTL=3600  # 有効期限（秒）
```

### ウェブ検索設定

```bash
# 検索エンジン設定
JINA_API_KEY=optional_key  # Jina AI 検索用
TAVILY_API_KEY=optional_key  # Tavily 検索用
```

## 環境別の設定

### 開発環境 (.env.development)

```bash
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug
DATABASE_URL=postgresql://localhost:5432/law_assistant_dev
LLM_MODEL_PROVIDER=ollama
LLM_BASE_URL=http://localhost:11434/v1
```

### テスト環境 (.env.test)

```bash
NODE_ENV=test
PORT=3001
LOG_LEVEL=error
DATABASE_URL=postgresql://localhost:5432/law_assistant_test
LLM_MODEL_PROVIDER=ollama
```

### 本番環境 (.env.production)

```bash
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
DATABASE_URL=postgresql://prod-db:5432/law_assistant
LLM_MODEL_PROVIDER=openai
LLM_API_KEY=${PROD_LLM_API_KEY}
CORS_ORIGIN=https://yourdomain.com
```

## Docker 環境での設定

### Docker Compose での使用方法

```yaml
version: '3.8'

services:
  app:
    image: law-assistant:latest
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DATABASE_URL=postgresql://user:password@db:5432/law_assistant
      - LLM_API_KEY=${LLM_API_KEY}
    env_file:
      - .env.production
```

### 環境変数の受け渡し

```bash
# シェルから渡す
LLM_API_KEY=your_key docker-compose up

# .env ファイルから自動読み込み
docker-compose up
```

## 設定のカスタマイズ

### カスタムプロンプト

アプリケーションの設定ファイルでプロンプトをカスタマイズ：

```typescript
// src/config/environment.ts
export const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT || `
あなたは専門的な法律アシスタントです。
日本の法律に精通しており、正確で分かりやすいアドバイスを提供します。
`;
```

### タイムアウト設定

```bash
# リクエストタイムアウト（ミリ秒）
REQUEST_TIMEOUT=30000

# データベース接続タイムアウト
DB_CONNECTION_TIMEOUT=5000
```

## セキュリティベストプラクティス

### 1. 機密情報の管理

```bash
# .gitignore
.env
.env.production
.env.local

# 暗号化ツールの使用を検討
git-crypt
sops
```

### 2. 権限管理

```bash
# .env ファイルの権限を設定
chmod 600 .env.production

# 所有権を設定
chown root:root .env.production
```

### 3. 環境変数の検証

起動時に必要な環境変数が揃っているか確認：

```typescript
// src/config/environment.ts
const requiredEnvVars = ['LLM_API_KEY', 'DATABASE_URL'];

requiredEnvVars.forEach(envVar => {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
});
```

## トラブルシューティング

### 環境変数が読み込まれない

**確認事項**:

```bash
# 現在の環境変数を確認
env | grep YOUR_VAR

# Node.js から確認
node -e "console.log(process.env.YOUR_VAR)"
```

**解決方法**:

1. `.env` ファイルの形式を確認（`KEY=value`）
2. コードの再読み込み
3. ターミナルの再起動

### データベース接続エラー

```bash
# 接続文字列を確認
echo $DATABASE_URL

# 手動で接続テスト
psql postgresql://user:pass@host:5432/dbname
```

### API キーのエラー

```bash
# API キーが設定されているか確認
echo $LLM_API_KEY

# 空白や改行が含まれていないか確認
cat .env | grep LLM_API_KEY
```

## 監視とロギング

### 環境変数のログ出力

⚠️ **注意**: 機密情報をログに出力しない

```typescript
// 良い例
logger.info('Environment loaded', { 
  nodeEnv: process.env.NODE_ENV,
  port: process.env.PORT 
});

// 悪い例 - 機密情報が漏洩
logger.info('Config', { 
  apiKey: process.env.LLM_API_KEY // ❌
});
```

### 設定の検証スクリプト

```bash
#!/bin/bash
# scripts/verify-env.sh

echo "Checking required environment variables..."

required_vars=(
  "LLM_API_KEY"
  "DATABASE_URL"
  "NODE_ENV"
)

for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "❌ Missing: $var"
    exit 1
  else
    echo "✅ Found: $var"
  fi
done

echo "All environment variables are set!"
```

## 次のステップ

- [Docker デプロイ](/deployment/docker/) - コンテナ環境での設定
- [クイックスタート](/guides/quickstart/) - 基本的なセットアップ
- [サーバーモード](/guides/server-mode/) - API サーバーの運用

## 参考資料

- [Node.js 環境変数](https://nodejs.org/api/process.html#process_process_env)
- [Docker 環境変数](https://docs.docker.com/compose/environment-variables/)
- [12-Factor App の設定](https://12factor.net/config)
