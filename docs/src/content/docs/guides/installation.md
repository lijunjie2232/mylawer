---
title: インストールガイド
description: 法律アシスタントの詳細なインストール手順
lastUpdated: 2026-03-11
---

# インストールガイド

このガイドでは、法律アシスタントの詳細なインストール手順を説明します。

## システム要件

### 必須ソフトウェア

- **Node.js**: v18 以上
- **pnpm**: v8 以上
- **Git**: 最新版

### オプション（機能によって必要）

- **Docker**: Docker デプロイ用
- **PostgreSQL**: データベース保存用（v14 以上）
- **Playwright**: ウェブ検索機能用

## インストール方法

### 方法 1: 標準インストール（推奨）

#### ステップ 1: プロジェクトのクローン

```bash
# リポジトリをクローン
git clone <repository-url>
cd law_assistant
```

#### ステップ 2: pnpm のインストール（未インストールの場合）

```bash
# npm からインストール
npm install -g pnpm

# または Homebrew (macOS)
brew install pnpm
```

#### ステップ 3: 依存関係のインストール

```bash
# プロジェクトの依存関係をインストール
pnpm install
```

#### ステップ 4: Playwright のインストール（ウェブ検索機能を使用する場合）

```bash
# Playwright ブラウザーをインストール
pnpm exec playwright install

# システム依存関係もインストール（Linux の場合）
pnpm exec playwright install-deps
```

### 方法 2: Docker を使用したインストール

#### 前提条件

- Docker Desktop または Docker Engine
- Docker Compose

#### ステップ 1: Docker イメージのビルド

```bash
# Docker イメージをビルド
docker build -t law-assistant .
```

#### ステップ 2: Docker Compose で実行

```bash
# docker-compose を使用して起動
docker-compose -f docker-compose.single.yml up -d
```

詳細は [Docker デプロイガイド](/deployment/docker/) を参照してください。

## 環境設定

### 1. 環境変数のコピー

```bash
cp .env.example .env
```

### 2. 必須環境変数の設定

`.env` ファイルを編集して、以下の環境変数を設定します：

```bash
# LLM 設定（必須）
LLM_API_KEY=your_api_key_here
LLM_MODEL_PROVIDER=openai

# サーバー設定（オプション）
NODE_ENV=development
PORT=3000
LOG_LEVEL=info
```

### 3. LLM プロバイダー別の設定

#### OpenAI の場合

```bash
LLM_MODEL_PROVIDER=openai
LLM_MODEL_NAME=gpt-3.5-turbo
LLM_API_KEY=sk-your-openai-api-key
```

#### Ollama の場合（ローカルモデル）

```bash
LLM_MODEL_PROVIDER=ollama
LLM_MODEL_NAME=gpt-oss:20b
LLM_BASE_URL=http://localhost:11434/v1
LLM_API_KEY=ollama
```

#### Anthropic の場合

```bash
LLM_MODEL_PROVIDER=anthropic
LLM_MODEL_NAME=claude-3-sonnet-20240229
LLM_API_KEY=your-anthropic-api-key
```

### 4. LINE Bot 設定（LINE Bot を使用する場合）

```bash
LINE_CHANNEL_SECRET=your_line_channel_secret
LINE_ACCESS_TOKEN=your_line_access_token
```

## 検証

### CLI モードのテスト

```bash
# CLI を直接実行
pnpm cli "労働契約について教えてください"
```

### サーバーモードのテスト

```bash
# 開発サーバーを起動
pnpm dev:server

# 別のターミナルでヘルスチェック
curl http://localhost:3000/health
```

### API ドキュメントの確認

```bash
# ブラウザでアクセス
# http://localhost:3000/docs

# または Swagger JSON を取得
curl http://localhost:3000/docs-json
```

## 次のステップ

- [クイックスタート](/guides/quickstart/) - 基本的な使用方法
- [CLI モード](/guides/cli-mode/) - コマンドラインインターフェース
- [サーバーモード](/guides/server-mode/) - サーバー API の使用

## トラブルシューティング

### Node.js のバージョンエラー

```bash
Error: Unsupported Node.js version
```

**解決方法**: Node.js v18 以上にアップグレードしてください。

```bash
# nvm を使用している場合
nvm install 18
nvm use 18
```

### Playwright のインストールエラー

```bash
Error: Host system is missing dependencies
```

**解決方法** (Linux):

```bash
# システム依存関係をインストール
sudo apt-get update
sudo apt-get install -y \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libatspi2.0-0
```

### PostgreSQL 接続エラー

```bash
Error: connect ECONNREFUSED
```

**解決方法**:

1. PostgreSQL が実行されていることを確認
2. 接続情報を `.env` ファイルで確認
3. データベースが作成されていることを確認

```bash
# PostgreSQL の状態を確認
systemctl status postgresql

# または Docker Compose で確認
docker-compose ps
```

## サポート

問題が解決しない場合は、以下をご確認ください：

- 📖 [クイックスタート](/guides/quickstart/)
- 🐛 [GitHub Issues](https://github.com/your-repo/law_assistant/issues)
- 💬 [ディスカッション](https://github.com/your-repo/law_assistant/discussions)
