---
title: API リファレンス
description: 法律アシスタント REST API のドキュメント。
---

法律アシスタントは、他のアプリケーションと統合するための包括的な REST API を提供します。すべての API エンドポイント (Webhook およびパブリック情報を除く) には JWT 認証が必要です。

## 認証

すべてのリクエストの `Authorization` ヘッダーに JWT トークンを含めてください：

```http
Authorization: Bearer <your_jwt_token>
```

## 主要なエンドポイント

### 1. 法律クエリエンジン

#### `POST /api/legal/query`
非ストリーミングの法律に関する質問のための主要なエンドポイント。

- **ボディ**: `{ "question": "...", "model": "...", "sessionId": "..." }`
- **レスポンス**: `{ "success": true, "answer": "...", "sessionId": "..." }`

#### `POST /api/legal/query/stream`
クエリエンジンのストリーミングバージョン。`text/event-stream` を返します。

### 2. チャットセッション管理

#### `GET /api/chat/sessions`
認証されたユーザーのすべてのチャットセッションのリストを返します。

#### `POST /api/chat/sessions`
カスタムタイトルで新しいセッションを作成します。

#### `GET /api/chat/sessions/:sessionId/messages`
特定のセッションのメッセージ履歴を取得します。

### 3. システムとモデル

#### `GET /health` (公開)
サーバーとデータベースのステータスをチェックします。

#### `GET /models` (公開)
管理者によって現在設定および許可されている LLM モデルのリストを返します。

## Webhook

#### `POST /webhook` (公開)
LINE Messaging API 用のエンドポイント。このエンドポイントは独自の署名検証を実行します。

## ドキュメント (Swagger)

実行中のインスタンスから、インタラクティブな OpenAPI/Swagger 仕様を直接利用できます：

- **Swagger UI**: [http://localhost:3000/docs](http://localhost:3000/docs)
- **OpenAPI JSON**: [http://localhost:3000/docs-json](http://localhost:3000/docs-json)

## エラーハンドリング

API は標準的な HTTP ステータスコードを使用します：
- `200/201`: 成功。
- `400`: 不正なリクエスト (パラメータが無効)。
- `401`: 認証エラー (トークンがない、または無効)。
- `403`: 禁止 (権限不足)。
- `500`: サーバー内部エラー。

エラー時のレスポンスは通常、以下の形式に従います：
```json
{
  "success": false,
  "message": "詳細なエラーメッセージがここに入ります"
}
```
