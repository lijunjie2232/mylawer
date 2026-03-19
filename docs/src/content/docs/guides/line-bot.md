---
title: LINE Bot 連携
description: LINE Bot との統合方法と設定
lastUpdated: 2026-03-11
---

# LINE Bot 連携

法律アシスタントを LINE Bot として動作させることで、LINE アプリから簡単に法的相談ができます。

## 概要

LINE Bot 統合機能により、以下のことが可能になります：

- 📱 LINE アプリから手軽に法的質問
- 💬 自然な会話形式での Q&A
- 🔍 自動で関連条文や判例を検索
- 🌐 ウェブ検索との連携
- 📝 会話履歴の保存（オプション）

## 前提条件

- LINE Developers アカウント
- LINE チャネル（Bot）
- 基本的な Node.js の知識

## セットアップ手順

### ステップ 1: LINE Developers コンソールの設定

#### 1.1 チャネルの作成

1. [LINE Developers コンソール](https://console.line.me/) にログイン
2. 「チャネルを追加」→「Messaging API」を選択
3. 基本情報を入力してチャネルを作成

#### 1.2 基本設定

```
チャネル名：法律アシスタント Bot
説明：AI を活用した法的コンサルティング Bot
カテゴリ：教育・学習
```

#### 1.3 トークンの発行

1. 「Messaging API」タブを開く
2. 「チャンネルアクセストークン」を発行
3. トークンをコピーして控える

#### 1.4 Webhook URL の設定

```
Webhook URL: https://your-domain.com/webhook
```

※ 開発中は ngrok などのトンネリングサービスを使用

```bash
# ngrok の場合
ngrok http 3000
```

### ステップ 2: 環境変数の設定

`.env` ファイルに LINE Bot の設定を追加：

```bash
# LINE Bot 設定
LINE_CHANNEL_SECRET=your_channel_secret
LINE_ACCESS_TOKEN=your_access_token

# サーバー設定
PORT=3000
NODE_ENV=development
```

#### 環境変数の取得場所

| 変数名 | 取得場所 |
|--------|----------|
| `LINE_CHANNEL_SECRET` | LINE Developers コンソール > 基本設定 |
| `LINE_ACCESS_TOKEN` | LINE Developers コンソール > Messaging API |

### ステップ 3: サーバーの起動

```bash
# 開発サーバーを起動
pnpm dev:server
```

### ステップ 4: テスト

LINE アプリで友達追加し、メッセージを送信：

```
労働契約について教えてください
```

## 機能

### サポートされているメッセージタイプ

#### テキストメッセージ

```
ユーザー：労働基準法の休憩時間について教えてください
Bot: 労働基準法第 34 条では...
```

#### スタンプ（将来的にサポート予定）

現在はまだテキストメッセージのみ対応しています。

### 応答フォーマット

#### テキスト応答

標準的なテキスト応答：

```typescript
{
  type: 'text',
  text: '回答内容...'
}
```

#### マルチパート応答

長い回答は分割して送信：

```typescript
[
  {
    type: 'text',
    text: '回答の前半部分...'
  },
  {
    type: 'text',
    text: '回答の後半部分...'
  }
]
```

### コマンド

以下のコマンドが使用可能です：

| コマンド | 説明 |
|---------|------|
| `/help` | ヘルプを表示 |
| `/start` | 初回挨拶 |
| `/menu` | メニューを表示 |
| `/clear` | 会話履歴をクリア |

## カスタマイズ

### プロンプトのカスタマイズ

`src/agents/legalAgent.ts` を編集して、Bot の応答スタイルを調整：

```typescript
const systemPrompt = `
あなたは専門的な法律アシスタントです。
LINE というプラットフォームの特性上、簡潔で分かりやすい回答を心がけてください。
専門用語を使う場合は、必ず説明を追加してください。
`;
```

### 応答の長さ

LINE では長いメッセージは読みにくいため、適切な長さで分割：

```typescript
// src/handlers/lineBotHandler.ts
const MAX_MESSAGE_LENGTH = 2000;

if (response.length > MAX_MESSAGE_LENGTH) {
  // 複数メッセージに分割
}
```

### リッチメニュー（計画中）

将来的にはリッチメニューを実装予定：

```json
{
  "size": {
    "width": 2500,
    "height": 1686
  },
  "selected": true,
  "name": "法律アシスタント メニュー",
  "chatBarText": "メニュー",
  "areas": [
    {
      "bounds": {
        "x": 0,
        "y": 0,
        "width": 833,
        "height": 843
      },
      "action": {
        "type": "message",
        "text": "労働問題について相談"
      }
    }
  ]
}
```

## 高度な機能

### 会話コンテキストの管理

複数のメッセージにわたる文脈を維持：

```typescript
// 会話履歴を保存
const conversationHistory = await memory.loadMemoryVariables({
  userId: event.source.userId
});

// 新しいメッセージを追加
await memory.saveContext({
  userId: event.source.userId,
  message: userMessage
});
```

### ツールの統合

#### ドキュメント検索

```
ユーザー：労働契約法 16 条を教えて
Bot: 労働契約法第 16 条（解雇の有効性）...
```

#### ウェブ検索

```
ユーザー：最新の労働基準法改正について
Bot: 2024 年の労働基準法改正では...
```

### エラーハンドリング

ネットワークエラーや API エラーへの対応：

```typescript
try {
  const response = await legalAgent.process(message);
  await replyMessage(replyToken, response);
} catch (error) {
  logger.error('Error processing message:', error);
  await replyMessage(replyToken, {
    type: 'text',
    text: '申し訳ございません。一時的なエラーが発生しました。しばらくしてから再度お試しください。'
  });
}
```

## テスト

### ローカルテスト

ngrok を使用してローカルサーバーを公開：

```bash
# ngrok を起動
ngrok http 3000

# 生成された URL を LINE Developers コンソールに設定
https://xxxxx.ngrok.io/webhook
```

### Webhook イベントの確認

LINE Developers コンソールで「ウェブフックイベントの確認」を有効にして、実際のイベントデータを確認できます。

### ログの確認

```bash
# サーバーログを確認
pnpm dev:server

# デバッグログを表示
LOG_LEVEL=debug pnpm dev:server
```

## 本番デプロイ

### HTTPS の必須化

LINE Bot は HTTPS エンドポイントを要求します：

1. SSL 証明書の取得（Let's Encrypt など）
2. リバースプロキシの設定（Nginx など）
3. または Vercel、Heroku などの PaaS を使用

### Docker デプロイ

```bash
# Docker Compose でデプロイ
docker-compose -f docker-compose.single.yml up -d
```

詳細は [Docker デプロイガイド](/deployment/docker/) を参照してください。

### 環境変数の管理

本番環境では機密情報を適切に管理：

```bash
# 環境変数ファイルの除外
echo ".env.production" >> .gitignore

# 暗号化して保存
git-crypt unlock
```

## 監視と分析

### メトリクスの収集

```typescript
// メッセージ数のカウント
await metrics.increment('line.messages.received');
await metrics.increment('line.messages.sent');

// レスポンスタイムの記録
await metrics.histogram('line.response_time', responseTime);
```

### エラーの追跡

```typescript
// エラー発生時に通知
if (errorCount > threshold) {
  await alerting.sendAlert('LINE Bot error rate exceeded');
}
```

## ベストプラクティス

### 1. 適切な応答時間

- 2-3 秒以内に応答
- 時間がかかる場合は「確認中」などのメッセージを送信

### 2. メッセージの長さ

- 1 つのメッセージは 2000 文字以内
- 長い内容は複数メッセージに分割

### 3. フォーマット

- 読みやすい改行
- 重要な部分は強調
- 必要に応じて箇条書き

### 4. エラーメッセージ

- 優しい表現
- 代替案の提示
- サポート連絡先の案内

## 制限事項

### LINE プラットフォームの制限

| 項目 | 制限値 |
|------|--------|
| 1 日の送信メッセージ数 | 制限なし（プッシュは月間 1,000 件まで無料） |
| メッセージサイズ | 2,000 文字 |
| リッチメニュー | 1000 個まで |
| ユーザー ID | 33 文字 |

### 法律的制限

⚠️ **重要**: LINE Bot での法的アドバイスは参考情報であり、専門家への相談を推奨する旨を明記してください。

## トラブルシューティング

### Webhook が動作しない

**確認事項**:
1. Webhook URL が正しいか
2. HTTPS か
3. サーバーが稼働しているか
4. ファイアウォールの設定

```bash
# ログを確認
tail -f logs/app.log

# Webhook の到達を確認
curl -X POST https://your-domain.com/webhook \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

### 認証エラー

```
Error: Invalid signature
```

**解決方法**:
1. `LINE_CHANNEL_SECRET` が正しいか確認
2. ミドルウェアの実装を確認
3. タイムゾーンの違いを確認

### メッセージが返信されない

**確認事項**:
1. `replyToken` の有効期限（2 分）
2. API レート制限
3. エラーログ

## 次のステップ

- [サーバーモード](/guides/server-mode/) - API サーバーの詳細
- [CLI モード](/guides/cli-mode/) - コマンドラインインターフェース
- [Docker デプロイ](/deployment/docker/) - 本番環境へのデプロイ

## 参考リンク

- [LINE Developers ドキュメント](https://developers.line.biz/)
- [Messaging API リファレンス](https://developers.line.biz/en/reference/messaging-api/)
- [LINE Bot SDK for Node.js](https://github.com/line/line-bot-sdk-nodejs)
