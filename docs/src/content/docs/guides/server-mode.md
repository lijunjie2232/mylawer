---
title: サーバーモード
description: API サーバーとしての使用方法と設定
lastUpdated: 2026-03-11
---

# サーバーモード

法律アシスタントを HTTP API サーバーとして実行し、Web アプリケーションやモバイルアプリ、LINE Bot などから利用できます。

## クイックスタート

### 開発サーバーの起動

```bash
# 開発モードでサーバーを起動（ホットリロード対応）
pnpm dev:server
```

### 本番サーバーの起動

```bash
# プロジェクトをビルド
pnpm build

# 本番サーバーを起動
pnpm start:server
```

## API エンドポイント

### 基本情報

#### サーバー情報

```http
GET http://localhost:3000/
```

**レスポンス例**:
```json
{
  "name": "Law Assistant API",
  "version": "1.0.0",
  "status": "running"
}
```

#### ヘルスチェック

```http
GET http://localhost:3000/health
```

**レスポンス例**:
```json
{
  "status": "healthy",
  "timestamp": "2026-03-11T10:00:00.000Z",
  "uptime": 3600
}
```

### 法的 Q&A API

#### シンプルな質問

```http
POST http://localhost:3000/api/v1/legal/question
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY

{
  "question": "労働契約満了後の更新なしには賠償が必要ですか？",
  "mode": "simple"
}
```

**レスポンス例**:
```json
{
  "success": true,
  "data": {
    "answer": "労働契約満了後の更新拒否については...",
    "sources": [],
    "confidence": 0.95
  },
  "timestamp": "2026-03-11T10:00:00.000Z"
}
```

#### 複雑な質問（ツール使用）

```http
POST http://localhost:3000/api/v1/legal/query
Content-Type: application/json

{
  "query": "労働契約法における経済補償に関する条項を検索",
  "mode": "complex",
  "tools": ["documentSearch", "webSearch"]
}
```

### LINE Bot Webhook

```http
POST http://localhost:3000/webhook
Content-Type: application/json
X-Line-Signature: <signature>

{
  "events": [
    {
      "type": "message",
      "replyToken": "token",
      "source": {
        "userId": "user123",
        "type": "user"
      },
      "message": {
        "type": "text",
        "text": "労働契約について教えてください"
      }
    }
  ]
}
```

## API ドキュメント

### Swagger UI

ブラウザで Swagger UI にアクセスして、API を対話形式でテストできます：

```bash
# ブラウザでアクセス
http://localhost:3000/docs
```

### Swagger JSON

```bash
# Swagger/OpenAPI 仕様を取得
curl http://localhost:3000/docs-json
```

### Redoc

```bash
# 代替のドキュメント UI
http://localhost:3000/redoc
```

## 設定オプション

### ポートの変更

```bash
# 環境変数で変更
PORT=8080 pnpm dev:server
```

または `.env` ファイル：
```bash
PORT=8080
```

### CORS の設定

複数のオリジンからのリクエストを許可する場合：

```typescript
// src/server.ts
app.use(cors({
  origin: ['https://yourdomain.com', 'https://app.yourdomain.com'],
  credentials: true
}));
```

### レート制限

API の乱用を防ぐためのレート制限：

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分
  max: 100 // 各 IP につき 15 分で最大 100 リクエスト
});

app.use('/api/', limiter);
```

## 認証

### API キー認証

ミドルウェアで API キーを検証：

```typescript
// middleware/authMiddleware.ts
import { Request, Response, NextFunction } from 'express';

export const authenticateApiKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['authorization']?.replace('Bearer ', '');
  
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  next();
};
```

### 使用方法

```bash
curl -X POST http://localhost:3000/api/v1/legal/question \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"question": "質問内容"}'
```

## エラーハンドリング

### 標準エラーレスポンス

```json
{
  "success": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "質問内容が必要です",
    "details": {}
  },
  "timestamp": "2026-03-11T10:00:00.000Z"
}
```

### エラーコード一覧

| コード | HTTP ステータス | 説明 |
|--------|----------------|------|
| `INVALID_INPUT` | 400 | 入力パラメータが無効 |
| `UNAUTHORIZED` | 401 | 認証エラー |
| `FORBIDDEN` | 403 | 権限エラー |
| `NOT_FOUND` | 404 | リソースが見つからない |
| `RATE_LIMITED` | 429 | レート制限超過 |
| `INTERNAL_ERROR` | 500 | サーバー内部エラー |

## ロギング

### ログレベルの設定

```bash
# .env ファイル
LOG_LEVEL=info
```

利用可能なログレベル：
- `debug` - デバッグ情報
- `info` - 一般情報
- `warn` - 警告
- `error` - エラー

### ログ出力例

```json
{
  "level": "info",
  "timestamp": "2026-03-11T10:00:00.000Z",
  "message": "Request received",
  "method": "POST",
  "path": "/api/v1/legal/question",
  "requestId": "abc123"
}
```

## パフォーマンス最適化

### キャッシング

頻繁に質問されるクエリをキャッシュ：

```typescript
import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 3600 }); // 1 時間

// キャッシュの使用
const cachedAnswer = cache.get(questionHash);
if (cachedAnswer) {
  return res.json(cachedAnswer);
}
```

### タイムアウト設定

長時間実行されるリクエストのタイムアウト：

```typescript
import timeout from 'connect-timeout';

app.use(timeout('30s'));
```

## テスト

### API テスト

```bash
# Swagger UI 機能テスト
pnpm test:swagger

# カスタムテストスクリプト
pnpm test:api
```

### cURL でのテスト

```bash
# ヘルスケール
curl http://localhost:3000/health

# 質問 API
curl -X POST http://localhost:3000/api/v1/legal/question \
  -H "Content-Type: application/json" \
  -d '{"question": "労働契約について"}'
```

## デプロイ

### Docker でのデプロイ

詳細は [Docker デプロイガイド](/deployment/docker/) を参照してください。

### 環境変数の管理

本番環境では、`.env` ファイルではなく環境変数を使用：

```bash
# Docker Compose
environment:
  - NODE_ENV=production
  - PORT=3000
  - LLM_API_KEY=${LLM_API_KEY}
```

## セキュリティベストプラクティス

1. **HTTPS の使用**: 本番環境では必ず HTTPS を使用
2. **API キーの保護**: 環境変数で管理し、バージョン管理に含めない
3. **レート制限**: DoS 攻撃を防ぐ
4. **入力検証**: すべての入力をサニタイズ
5. **エラーメッセージ**: 機密情報を露出しない

## 次のステップ

- [LINE Bot 連携](/guides/line-bot/) - LINE Bot との統合
- [Docker デプロイ](/deployment/docker/) - コンテナ化とデプロイ
- [API リファレンス](/reference/api/) - API 仕様の詳細
