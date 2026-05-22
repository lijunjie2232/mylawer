---
title: LINE Bot 連携
description: 法律アシスタントを LINE Messaging API に接続する。
---

法律アシスタントを LINE と統合することで、ユーザーはモバイルデバイスから直接法的 AI に相談できるようになります。

## セットアップの概要

1.  **LINE Developers** アカウントと **Messaging API** チャネルを作成します。
2.  **Webhook URL** を法律アシスタントのインスタンスを指すように設定します。
3.  **Channel Secret** と **Access Token** を `.env` に追加します。

## 詳細な手順

### 1. LINE Developers コンソール
- [LINE Developers](https://developers.line.biz/) にアクセスします。
- プロバイダーを作成し、次に Messaging API チャネルを作成します。
- **Channel secret**: 「基本設定」タブにあります。
- **Channel access token**: 「Messaging API」タブで発行します。

### 2. 環境設定
`.env` ファイルに以下を追加します：

```bash
LINE_CHANNEL_SECRET=your_secret_here
LINE_ACCESS_TOKEN=your_token_here
```

### 3. Webhook URL
LINE Developers コンソールの「Messaging API」タブで：
- **Webhook URL**: `https://your-domain.com/webhook`
- **検証**: 「検証」ボタンをクリックして、サーバーに到達可能であることを確認します。
- **Webhook を利用**: このトグルを有効にします。

> **注意**: ローカル開発の場合は、**ngrok** などのツールを使用して、ローカルポート (デフォルト 3000) をインターネットに公開してください。

## LINE での AI 機能

ユーザーが LINE でメッセージを送信すると、法律アシスタントは以下の処理を行います：
1.  `X-Line-Signature` を検証します。
2.  その特定の LINE ユーザー ID の会話履歴を読み込みます。
3.  利用可能なすべての **MCP ツール** を使用してエージェントを実行します。
4.  一連のテキストメッセージで返信します (長い回答は必要に応じて分割されます)。

## コマンド

ユーザーは LINE チャットで特別なコマンドを使用できます：
- `/start` または `/help`: ウェルカムメッセージと手順を表示します。
- `/clear`: 現在のユーザーの会話履歴をリセットします。
- `/models`: 現在リクエストを処理している LLM を確認します。

## セキュリティに関する考慮事項

- **署名検証**: 法律アシスタントは、Webhook エンドポイントへの不正アクセスを防ぐために、LINE からのすべてのリクエストを自動的に検証します。
- **データプライバシー**: LINE のチャット履歴は、LINE ユーザー ID でリンクされた、ウェブ UI セッションとは別の PostgreSQL データベースに保存されます。

## 次のステップ

- [Docker デプロイ](../../deployment/docker/) について学ぶ。
- [MCP ツールシステム](../../concepts/mcp-tools/) を確認する。
