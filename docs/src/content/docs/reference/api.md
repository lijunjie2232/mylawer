---
title: API リファレンス
description: 法律アシスタント API の完全なリファレンス
lastUpdated: 2026-03-11
---

# API リファレンス

法律アシスタントの HTTP API エンドポイントに関する完全なリファレンスです。

## 概要

### ベース URL

```
開発環境：http://localhost:3000
本番環境：https://your-domain.com
```

### バージョニング

API はバージョン管理されています：

```
/v1/ - 現在の API バージョン
```

### 認証

一部のエンドポイントでは API キー認証が必要です：

```http
Authorization: Bearer YOUR_API_KEY
```

### レスポンスフォーマット

すべてのレスポンスは JSON 形式です：

```json
{
  "success": true,
  "data": {},
  "timestamp": "2026-03-11T10:00:00.000Z"
}
```

## エンドポイント一覧

### 基本情報

#### サーバー情報の取得

```http
GET /
```

**レスポンス**:
```json
{
  "name": "Law Assistant API",
  "version": "1.0.0",
  "status": "running",
  "environment": "development"
}
```

#### ヘルスチェック

```http
GET /health
```

**レスポンス**:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "uptime": 3600,
    "timestamp": "2026-03-11T10:00:00.000Z",
    "services": {
      "database": "connected",
      "llm": "available"
    }
  }
}
```

### 法的 Q&A API

#### シンプルな質問（POST）

```http
POST /api/v1/legal/question
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY
```

**リクエストボディ**:
```json
{
  "question": "労働契約満了後の更新なしには賠償が必要ですか？",
  "mode": "simple"
}
```

**レスポンス**:
```json
{
  "success": true,
  "data": {
    "answer": "労働契約満了後の更新拒否については、使用者に合理的な理由が必要です...",
    "sources": [],
    "confidence": 0.95,
    "processingTime": 1.2
  },
  "timestamp": "2026-03-11T10:00:00.000Z"
}
```

**エラーレスポンス**:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "質問内容が必要です",
    "details": {
      "field": "question"
    }
  },
  "timestamp": "2026-03-11T10:00:00.000Z"
}
```

#### 複雑なクエリ（POST）

```http
POST /api/v1/legal/query
Content-Type: application/json
```

**リクエストボディ**:
```json
{
  "query": "労働契約法における経済補償に関する条項を検索",
  "mode": "complex",
  "tools": ["documentSearch", "webSearch"],
  "options": {
    "maxResults": 5,
    "includeSources": true
  }
}
```

**レスポンス**:
```json
{
  "success": true,
  "data": {
    "answer": "労働契約法における経済補償に関する主な条項は以下の通りです...",
    "sources": [
      {
        "title": "労働契約法第 16 条",
        "url": "https://example.com/law/16",
        "snippet": "解雇は、客観的に合理的な理由を欠き..."
      }
    ],
    "toolsUsed": ["documentSearch"],
    "processingTime": 3.5
  },
  "timestamp": "2026-03-11T10:00:00.000Z"
}
```

### ドキュメント検索 API

#### 法律条文の検索

```http
POST /api/v1/search/documents
Content-Type: application/json
```

**リクエストボディ**:
```json
{
  "query": "労働基準法 休憩時間",
  "filters": {
    "category": "labor",
    "type": "statute"
  },
  "limit": 10
}
```

**レスポンス**:
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "id": "doc_123",
        "title": "労働基準法第 34 条",
        "content": "使用者は、労働時間が 6 時間を超える場合には...",
        "category": "labor",
        "relevanceScore": 0.98
      }
    ],
    "total": 1,
    "query": "労働基準法 休憩時間"
  },
  "timestamp": "2026-03-11T10:00:00.000Z"
}
```

### ウェブ検索 API

#### ウェブ検索の実行

```http
POST /api/v1/search/web
Content-Type: application/json
```

**リクエストボディ**:
```json
{
  "query": "2024 年 労働基準法 改正",
  "engine": "google",
  "limit": 10
}
```

**レスポンス**:
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "title": "2024 年労働基準法改正のポイント",
        "url": "https://example.com/article",
        "snippet": "2024 年 4 月から適用される労働基準法の改正ポイントについて解説します...",
        "publishedDate": "2024-03-15"
      }
    ],
    "engine": "google",
    "total": 10
  },
  "timestamp": "2026-03-11T10:00:00.000Z"
}
```

### LINE Bot Webhook

#### Webhook イベントの処理

```http
POST /webhook
Content-Type: application/json
X-Line-Signature: <signature>
```

**リクエストボディ**:
```json
{
  "destination": "Uxxxxxxxxxxxxxx",
  "events": [
    {
      "replyToken": "nHuyWiB7yP5Zw52FIkcQobQuGDXCTA",
      "type": "message",
      "mode": "active",
      "timestamp": 1462629479859,
      "source": {
        "type": "user",
        "userId": "Uxxxxxxxxxxxxxx"
      },
      "message": {
        "id": "325708",
        "type": "text",
        "text": "労働契約について教えてください"
      }
    }
  ]
}
```

**レスポンス**:
```http
HTTP/1.1 200 OK
```

## エラーコード

### クライアントエラー（4xx）

| コード | 説明 | 解決方法 |
|--------|------|----------|
| `400` INVALID_INPUT | リクエストパラメータが無効 | 入力内容を確認 |
| `401` UNAUTHORIZED | 認証エラー | API キーを確認 |
| `403` FORBIDDEN | 権限エラー | 権限を確認 |
| `404` NOT_FOUND | リソースが見つからない | URL を確認 |
| `429` RATE_LIMITED | レート制限超過 | 時間を置いて再試行 |

### サーバーエラー（5xx）

| コード | 説明 | 解決方法 |
|--------|------|----------|
| `500` INTERNAL_ERROR | サーバー内部エラー | 管理者に連絡 |
| `502` BAD_GATEWAY | 上流サーバーのエラー | 時間を置いて再試行 |
| `503` SERVICE_UNAVAILABLE | サービス利用不可 | メンテナンス情報を確認 |

## レート制限

### デフォルト制限

```
- 100 リクエスト/分（IP アドレスごと）
- 1000 リクエスト/時間（API キーごと）
```

### レート制限ヘッダー

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1647000000
```

## ペジネーション

リストを返すエンドポイントではペジネーションがサポートされています：

### リクエストパラメータ

```http
GET /api/v1/search/documents?query=労働&page=1&limit=20
```

### レスポンス

```json
{
  "success": true,
  "data": {
    "results": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

## ソート

結果のソートを指定できます：

```http
GET /api/v1/search/documents?query=労働&sort=relevance&order=desc
```

使用可能なソートフィールド：
- `relevance` - 関連度（デフォルト）
- `date` - 日付
- `title` - タイトル

## フィルタリング

検索結果をフィルタリングできます：

```http
GET /api/v1/search/documents?query=労働&category=labor&type=statute
```

使用可能なフィルター：
- `category` - カテゴリ（labor, civil, criminal など）
- `type` - タイプ（statute, case, article など）
- `dateFrom` - 開始日
- `dateTo` - 終了日

## バッチ処理

複数の質問をバッチで送信：

```http
POST /api/v1/legal/batch
Content-Type: application/json
```

**リクエストボディ**:
```json
{
  "questions": [
    {
      "id": "q1",
      "question": "労働契約の更新義務は？"
    },
    {
      "id": "q2",
      "question": "解雇予告手当とは？"
    }
  ]
}
```

**レスポンス**:
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "id": "q1",
        "answer": "...",
        "status": "success"
      },
      {
        "id": "q2",
        "answer": "...",
        "status": "success"
      }
    ],
    "processed": 2,
    "failed": 0
  }
}
```

## ストリーミング

長時間実行されるクエリではストリーミングレスポンスを使用：

```http
POST /api/v1/legal/stream
Accept: text/event-stream
```

**サーバー送信イベント**:
```
data: {"type": "start", "message": "処理を開始します"}

data: {"type": "progress", "message": "ドキュメント検索中..."}

data: {"type": "result", "data": {"answer": "..."}}

data: {"type": "end", "message": "完了"}
```

## OpenAPI 仕様

### Swagger UI

インタラクティブな API ドキュメント：

```
http://localhost:3000/docs
```

### OpenAPI JSON

```
http://localhost:3000/docs-json
```

### Redoc

代替ドキュメント UI：

```
http://localhost:3000/redoc
```

## SDK とクライアント

### JavaScript/TypeScript

```typescript
import { LawAssistantClient } from 'law-assistant-client';

const client = new LawAssistantClient({
  apiKey: 'your-api-key',
  baseUrl: 'http://localhost:3000'
});

const answer = await client.askQuestion('労働契約について');
```

### Python（計画中）

```python
from law_assistant import Client

client = Client(api_key='your-api-key')
answer = client.ask_question('労働契約について')
```

## ベストプラクティス

### 1. エラーハンドリング

```typescript
try {
  const response = await fetch('/api/v1/legal/question', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({ question })
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const data = await response.json();
  return data;
} catch (error) {
  console.error('API request failed:', error);
  throw error;
}
```

### 2. リトライロジック

```typescript
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      
      if (response.status === 429) {
        // レート制限 - 待機して再試行
        await sleep(1000 * (i + 1));
        continue;
      }
      
      throw new Error(`Status: ${response.status}`);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(1000 * (i + 1));
    }
  }
}
```

### 3. キャッシング

```typescript
const cache = new Map();

async function getCachedQuestion(question) {
  const cacheKey = `q:${question}`;
  
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }
  
  const answer = await fetchAnswer(question);
  cache.set(cacheKey, answer);
  
  return answer;
}
```

## 次のステップ

- [サーバーモード](/guides/server-mode/) - API サーバーの運用ガイド
- [LINE Bot 連携](/guides/line-bot/) - LINE Bot との統合
- [環境設定](/deployment/environment/) - 環境変数の詳細
