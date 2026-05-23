---
title: クイックスタート
description: Docker を使用して数分で法律アシスタントを起動。
---

法律アシスタントを体験する最も速い方法は、事前設定済みの Docker デモセットアップを使用することです。これには、アプリケーションサーバー、ウェブフロントエンド、PostgreSQL データベース、および統合された MCP サーバーが含まれています。

## 前提条件

- **Docker** と **Docker Compose** がインストールされていること。
- **LLM API キー** (OpenAI または Anthropic)。

## 3 ステップセットアップ

### 1. クローンと準備

```bash
git clone https://github.com/lijunjie2232/mylawer.git
cd mylawer
git submodule update --init --recursive
cp .env.example .env
```

### 2. LLM の設定

`.env` ファイルを編集して API キーを追加します：

```bash
LLM_MODEL_PROVIDER=openai
LLM_API_KEY=sk-....
```

### 3. Docker Compose で実行

データベースの初期化を含め、すべてを処理する `docker-compose-demo.yaml` を提供しています。

```bash
docker-compose -f docker-compose-demo.yaml up -d --build
```

## 動作確認

コンテナが起動したら、以下からシステムにアクセスできます：

- **ウェブ UI**: [http://localhost:3000](http://localhost:3000)
- **API ドキュメント**: [http://localhost:3000/docs](http://localhost:3000/docs)
- **ヘルスチェック**: [http://localhost:3000/health](http://localhost:3000/health)

### デフォルトのクレデンシャル

- **メール**: `admin@example.com`
- **パスワード**: `Admin123!@#`

## 次のステップ

- [LLM プロバイダーの設定](../../config/llm/) について学ぶ。
- [ウェブ UI の機能](../../guides/web-ui/) を探索する。
- ローカルで開発したい場合は [手動インストールガイド](../../getting-started/installation/) を確認する。
