---
title: Docker デプロイ
description: Docker と Docker Compose を使用した法律アシスタントのデプロイ。
---

法律アシスタントを本番環境にデプロイするには、Docker を使用することをお勧めします。これにより、Node.js サーバー、PostgreSQL、および同梱されているすべての MCP サーバーに対して一貫した環境が保証されます。

## 単一コンテナ戦略

シンプルにするために、アプリケーションとデータベースを統一して実行する（コンテナ内で `supervisord` によって管理される）「オールインワン」の Docker セットアップを提供しています。

### `docker-compose-demo.yaml` の使用

これがほとんどのユーザーに推奨される方法です。

1.  **リポジトリをクローンする**:
    ```bash
    git clone https://github.com/lijunjie2232/mylawer.git
    cd mylawer
    ```

2.  **環境設定**:
    `docker-compose-demo.yaml` を開き、以下のプレースホルダーを記入します：
    - `LLM_API_KEY`: プロバイダーのキー。
    - `LLM_BASE_URL`: (任意) カスタムエンドポイント。
    - `POSTGRES_PASSWORD`: 内部データベース用の安全なパスワード。
    - `JWT_SECRET`: 長いランダムな文字列。

3.  **起動**:
    ```bash
    docker-compose -f docker-compose-demo.yaml up -d --build
    ```

## 永続化

デフォルトでは、デモの Compose ファイルは PostgreSQL 用のボリュームを作成します。これにより、コンテナを再起動してもチャット履歴やユーザーアカウントが保持されます。

```yaml
# docker-compose-demo.yaml 内
volumes:
  postgres_data:
    driver: local
```

## 高度なデプロイ

すでに PostgreSQL インスタンスがあり、アプリケーションのみを Docker で実行したい場合：

1.  `Dockerfile_demo` を変更して、PostgreSQL のインストール手順を削除します。
2.  `DATABASE_URL` を外部インスタンスに設定します。
3.  アプリケーションコンテナがデータベースにネットワーク経由で到達できることを確認します。

## トラブルシューティング

### ログ
コンテナ内のすべてのプロセス (App, Postgres, MCP サーバー) の状態を確認します：
```bash
docker logs -f las
```

### データベースの初期化
初回実行時、コンテナは `RUN_MIGRATIONS=true` および `INIT_ADMIN=true` を実行します。これらが失敗した場合は、`DATABASE_URL` を確認し、PostgreSQL プロセスが正常に開始されていることを確認してください。

## 次のステップ

- [セキュリティと認証チェックリスト](/ja/deployment/security/) を確認する。
- [API リファレンス](/ja/reference/api/) を探索する。
