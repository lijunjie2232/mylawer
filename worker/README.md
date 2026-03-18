# Cloudflare Worker - LLM API プロキシ

## 機能説明

この Worker は `https://api.suanli.cn`（OpenAI 互換 LLM API）にリクエストを転送します

### 特徴
- ✅ すべての HTTP メソッドをサポート（GET, POST, PUT, DELETE, PATCH, OPTIONS）
- ✅ 元のリクエストの headers、query parameters、body を完全に保持
- ✅ CORS クロスドメイン問題を自動処理
- ✅ LLM ストリーミングレスポンスをサポート（SSE - Server-Sent Events）
- ✅ バックエンドの実際のアドレスを隠蔽
- ✅ 完全なエラー処理とログ記録

## デプロイ手順

### 方法 1: Cloudflare Dashboard

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) にログイン
2. **Workers & Pages** → **Create Application** → **Create Worker** に移動
3. Worker に名前を付ける（例：`llm-proxy`）
4. **Edit Code** をクリックし、`cloudflared-worker.js` の全コードをコピーして貼り付け
5. **Deploy** をクリックして保存

### 方法 2: Wrangler CLI（推奨）

```bash
# Wrangler CLI をインストール
npm install -g wrangler

# Cloudflare にログイン
wrangler login

# プロジェクトを初期化
wrangler init llm-proxy
cd llm-proxy

# src/index.js の内容を cloudflared-worker.js のコードに置き換え

# デプロイ
wrangler deploy
```

## 使用方法

### 標準 OpenAI フォーマット

```bash
# 正しいエンドポイント：/v1/chat/completions (複数形に注意)
curl -X POST "https://your-worker.workers.dev/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "你好"}],
    "stream": true
  }'
```

### ⚠️ よくあるエラー

#### エラー 404: Invalid URL

**エラーメッセージ：**
```json
{
  "success": false,
  "error": "Backend returned 404",
  "message": "目标服务器返回错误",
  "details": "{\"error\":{\"message\":\"Invalid URL (POST /v1/chat/completion)\",...}}"
}
```

**原因：** 誤ったエンドポイントパス `/v1/chat/completion`（単数形）を使用

**解決方法：** 正しいエンドポイント `/v1/chat/completions`（**複数形**）を使用

❌ エラー：
```bash
curl -X POST "https://your-worker.workers.dev/v1/chat/completion" ...
```

✅ 正解：
```bash
curl -X POST "https://your-worker.workers.dev/v1/chat/completions" ...
```

## テスト

### テストスクリプトを使用

```bash
# test-worker.sh を編集し、WORKER_URL と API_KEY を置き換え
vim test-worker.sh

# テストを実行
chmod +x test-worker.sh
./test-worker.sh
```

### テストデータファイルを使用

```bash
# ストリーミングチャットテスト
curl -X POST "https://your-worker.workers.dev/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d @test-simple-chat.json
```

## サポートされている API エンドポイント

Worker はすべてのパスをそのまま転送するため、ターゲット API のすべてのエンドポイントをサポートしています：

- `POST /v1/chat/completions` - チャット補完
- `POST /v1/completions` - テキスト補完
- `GET /v1/models` - モデルリストの取得
- `POST /v1/embeddings` - 埋め込みベクトル
- など...

## ストリーミングレスポンス例

`stream: true` の場合、レスポンス形式は SSE です：

```
data: {"choices":[{"delta":{"role":"assistant"},"index":0}]}

data: {"choices":[{"delta":{"content":"你"},"index":0}]}

data: {"choices":[{"delta":{"content":"好"},"index":0}]}

data: [DONE]
```

## トラブルシューティング

### Worker ログの確認

1. Cloudflare Dashboard にログイン
2. あなたの Worker に移動
3. **Observability** → **Logs** をクリック
4. リアルタイムログ出力を表示

### よくあるエラーコード

| エラーコード | 意味 | 考えられる原因 |
|--------|------|----------|
| 404 | 無効な URL | エンドポイントパスの誤り（単数形を使用など） |
| 401 | 未認証 | API キーが無効または不足 |
| 502 | Bad Gateway | ターゲットサーバーが利用不可 |
| 503 | Service Unavailable | ターゲットサーバーが過負荷 |

### デバッグテクニック

Worker コードに詳細なログ出力を追加：

```javascript
console.error('Target API returned 404:', errorBody);
```

ログを確認することで、問題を迅速に特定できます。

## 注意事項

1. **API キー管理**: Worker は Authorization ヘッダーを変更しません、クライアントが正しい API キーを送信することを確認
2. **CORS**: Worker は自動的に CORS ヘッダーを追加します、ブラウザから直接呼び出し可能です
3. **タイムアウト**: Cloudflare Workers の最大実行時間は 10 分（バインディングなし）または 15 分（バインディングあり）です
4. **トラフィック制限**: 無料プランには 1 日あたり 100,000 リクエスト制限があります

## 関連リンク

- [Cloudflare Workers ドキュメント](https://developers.cloudflare.com/workers/)
- [OpenAI API ドキュメント](https://platform.openai.com/docs/api-reference)
- [SSE 仕様](https://html.spec.whatwg.org/multipage/server-sent-events.html)
