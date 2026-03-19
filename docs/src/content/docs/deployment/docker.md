---
title: Docker デプロイ
description: Docker を使用したデプロイガイド
lastUpdated: 2026-03-11
---

# Docker デプロイガイド

法律アシスタントを Docker コンテナで実行するための完全なガイドです。

## 概要

このプロジェクトでは、2 つの Docker デプロイ戦略を提供しています：

1. **単一コンテナデプロイ** - PostgreSQL とアプリケーションを一体化
2. **分割コンテナデプロイ** - データベースとアプリケーションを分離

## 前提条件

- Docker Desktop または Docker Engine (v20+)
- Docker Compose (v2.0+)
- 基本的な Docker の知識

## デプロイオプションの選択

### 単一コンテナ（推奨）

**メリット**:
- シンプルなセットアップ
- 少ないリソース消費
- ローカル開発に最適

**デメリット**:
- スケーリングが困難
- データベースのバックアップが複雑

### 分割コンテナ

**メリット**:
- 各サービスの独立性
- 容易なスケーリング
- 本番環境に適している

**デメリット**:
- 設定が複雑
- 多いリソース消費

## 方法 1: 単一コンテナデプロイ

### ステップ 1: 環境変数の設定

```bash
# 環境変数テンプレートをコピー
cp .env.example .env
```

### ステップ 2: 必須環境変数の編集

`.env` ファイルを編集：

```bash
# データベース設定
POSTGRES_PASSWORD=your_secure_password
POSTGRES_USER=postgres
POSTGRES_DB=law_assistant

# LLM 設定
LLM_API_KEY=your_api_key
LLM_MODEL_PROVIDER=openai

# アプリケーション設定
NODE_ENV=production
PORT=3000

# 管理者アカウント初期化
RUN_MIGRATIONS=true
INIT_ADMIN=true
DEFAULT_ADMIN_EMAIL=admin@example.com
DEFAULT_ADMIN_PASSWORD=YourSecurePassword123
```

### ステップ 3: Docker イメージのビルド

```bash
# Docker イメージをビルド
docker build -t law-assistant .
```

### ステップ 4: コンテナの実行

#### オプション A: docker run コマンド

```bash
docker run -d \
  --name law-assistant \
  -p 3000:3000 \
  -p 5432:5432 \
  -e POSTGRES_PASSWORD=your_secure_password \
  -e LLM_API_KEY=your_api_key \
  -e DEFAULT_ADMIN_EMAIL=admin@example.com \
  -e DEFAULT_ADMIN_PASSWORD=YourSecurePassword123 \
  -e RUN_MIGRATIONS=true \
  -e INIT_ADMIN=true \
  law-assistant
```

#### オプション B: Docker Compose（推奨）

```bash
# docker-compose.single.yml を使用
docker-compose -f docker-compose.single.yml up -d
```

### ステップ 5: デプロイの確認

```bash
# コンテナの状態を確認
docker ps

# ログを確認
docker logs law-assistant

# ヘルスチェック
curl http://localhost:3000/health
```

## 方法 2: 分割コンテナデプロイ

### ステップ 1: 環境変数の設定

```bash
# アプリケーション用
cp .env.example .env

# データベース用（任意）
cp .env.example postgresql-dev.yml
```

### ステップ 2: Docker Compose の編集

`docker-compose.split.yml` を確認：

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://user:password@db:5432/law_assistant
      - LLM_API_KEY=${LLM_API_KEY}
    depends_on:
      - db

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=law_assistant
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### ステップ 3: サービスの起動

```bash
# 分割コンテナを起動
docker-compose -f docker-compose.split.yml up -d
```

### ステップ 4: 接続の確認

```bash
# アプリケーションログ
docker-compose logs app

# データベースログ
docker-compose logs db

# データベース接続テスト
docker-compose exec db pg_isready -h localhost -U user
```

## 管理者アカウントの初期化

Docker コンテナは起動時に自動的に管理者アカウントを初期化します：

### 自動初期化プロセス

1. **環境変数の確認**: `INIT_ADMIN=true` が設定されているか
2. **マイグレーションの実行**: データベーススキーマの作成
3. **管理者アカウントの作成**: 指定されたクレデンシャルでアカウント作成

### 初期クレデンシャル

- **メール**: `admin@example.com`（または `DEFAULT_ADMIN_EMAIL`）
- **パスワード**: `DEFAULT_ADMIN_PASSWORD` の値

### セキュリティ

⚠️ **重要**: 初回ログイン後、直ちにパスワードを変更してください。

## 永続化ボリューム

### データの永続化

データベースのデータを永続化するには：

```yaml
# docker-compose.yml
volumes:
  postgres_data:
    driver: local
```

### ボリュームの管理

```bash
# ボリュームの一覧
docker volume ls

# ボリュームの詳細
docker volume inspect law_assistant_postgres_data

# ボリュームのバックアップ
docker run --rm \
  -v law_assistant_postgres_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/postgres-backup.tar.gz -C /data .
```

## ネットワーク設定

### カスタムネットワークの使用

```yaml
networks:
  law-network:
    driver: bridge

services:
  app:
    networks:
      - law-network
  db:
    networks:
      - law-network
```

### ポートの公開

```yaml
ports:
  - "3000:3000"  # ホスト:コンテナ
```

## 本番環境の設定

### 環境変数のセキュリティ

```bash
# 機密情報を.env.production に保存
# .gitignore に追加
echo ".env.production" >> .gitignore

# Docker Compose で読み込み
environment:
  - LLM_API_KEY=${LLM_API_KEY}
```

### SSL/TLS の設定

Nginx リバースプロキシの設定例：

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Docker Swarm でのデプロイ

```yaml
version: '3.8'

services:
  app:
    image: law-assistant:latest
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '1'
          memory: 1G
```

## 監視とロギング

### コンテナログ

```bash
# リアルタイムログ
docker logs -f law-assistant

# 最後の 100 行
docker logs --tail 100 law-assistant

# タイムスタンプ付き
docker logs -t law-assistant
```

### メトリクスの収集

```bash
# コンテナのリソース使用量
docker stats law-assistant

# 詳細なメトリクス
docker inspect law-assistant
```

## トラブルシューティング

### コンテナが起動しない

```bash
# エラーログを確認
docker logs law-assistant

# コンテナ内に進入
docker exec -it law-assistant /bin/bash

# データベース接続を確認
docker exec law-assistant pg_isready -h localhost -U postgres
```

### データベース接続エラー

**問題**: `ECONNREFUSED`

**解決方法**:

```bash
# データベースが稼働しているか確認
docker-compose ps

# ネットワーク接続を確認
docker network inspect law_assistant_default

# 接続文字列を確認
docker-compose exec app env | grep DATABASE_URL
```

### マイグレーションエラー

```bash
# 手動でマイグレーションを実行
docker-compose exec app pnpm run-migrations

# ログを確認
docker-compose logs app | grep migration
```

### パフォーマンスの問題

```bash
# リソース使用量を確認
docker stats

# コンテナの制限を設定
docker update --memory 2g --cpus 1.0 law-assistant
```

## バックアップとリストア

### データベースのバックアップ

```bash
# バックアップを作成
docker-compose exec db pg_dump -U postgres law_assistant > backup.sql

# 圧縮して保存
docker-compose exec db pg_dump -U postgres law_assistant | gzip > backup.sql.gz
```

### データベースのリストア

```bash
# バックアップから復元
docker-compose exec -T db psql -U postgres law_assistant < backup.sql

# 圧縮ファイルの場合
gunzip < backup.sql.gz | docker-compose exec -T db psql -U postgres law_assistant
```

## アップデート

### 新しいバージョンへのアップデート

```bash
# 最新のイメージをプル
docker-compose pull

# コンテナを再起動
docker-compose down
docker-compose up -d

# マイグレーションを実行
docker-compose exec app pnpm run-migrations
```

### ロールバック

```bash
# 以前のバージョンを使用
docker-compose pull law-assistant:previous-tag
docker-compose down
docker-compose up -d
```

## 次のステップ

- [環境設定](/deployment/environment/) - 環境変数の詳細
- [サーバーモード](/guides/server-mode/) - API サーバーの運用
- [LINE Bot 連携](/guides/line-bot/) - LINE Bot との統合

## 参考資料

- [Docker 公式ドキュメント](https://docs.docker.com/)
- [Docker Compose リファレンス](https://docs.docker.com/compose/)
- [PostgreSQL Docker イメージ](https://hub.docker.com/_/postgres)
