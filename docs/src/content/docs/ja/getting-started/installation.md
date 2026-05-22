---
title: 手動インストール
description: 開発のための法律アシスタントの手動インストールガイド。
---

このガイドでは、ローカルマシンに法律アシスタントを手動でインストールする手順を説明します。これは、ソースコードを変更したり、プロジェクトに貢献したりしたい開発者に推奨されます。

## 前提条件

- **Node.js**: v20 以上 (v24 推奨)。
- **pnpm**: v9 以上。
- **PostgreSQL**: 稼働中のインスタンス (ローカルまたはリモート)。
- **Git**: リポジトリのクローン用。

## インストールステップ

### 1. リポジトリをクローンする

```bash
git clone https://github.com/lijunjie2232/mylawer.git
cd mylawer
```

### 2. 依存関係をインストールする

法律アシスタントは pnpm ワークスペースを使用して、バックエンド、フロントエンド、および MCP サーバーを管理しています。

```bash
pnpm install
```

### 3. 環境設定

環境変数のサンプルファイルをコピーして編集します：

```bash
cp .env.example .env
```

`DATABASE_URL` が PostgreSQL インスタンスを指していることを確認してください：

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/law_assistant"
```

### 4. データベースのセットアップ

Prisma クライアントを生成し、マイグレーションを実行してテーブルを作成します：

```bash
pnpm db:generate
pnpm db:migrate
```

### 5. プロジェクトのビルド

メインアプリケーションを実行する前に、フロントエンドと MCP サーバーをビルドする必要があります。

```bash
# フロントエンドのビルド
cd frontend && pnpm build && cd ..

# legal-mcp (js_legal) のビルド
cd third/legal-mcp/js_legal && pnpm install && pnpm build && cd ../../..

# メインアプリケーションのビルド
pnpm build
```

## アプリケーションの実行

### 開発モード

ホットリロードを有効にしてサーバーを実行します：

```bash
pnpm dev:server
```

### 本番モード

コンパイルされたサーバーをビルドして起動します：

```bash
pnpm build
pnpm start:server
```

## トラブルシューティング

### MCP サーバーが接続されない

`legal-mcp` または `webmcp` サーバーの起動に失敗した場合は、それぞれのディレクトリ (`third/legal-mcp/js_legal` および `third/webmcp`) でビルドコマンドを実行したことを確認してください。

### データベースの権限

`DATABASE_URL` のユーザーがテーブルを作成し、マイグレーションを実行する権限を持っていることを確認してください。

## 次のステップ

- [LLM プロバイダー](../../config/llm/) を設定する。
- [システム概要](../../concepts/overview/) について学ぶ。
