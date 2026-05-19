---
title: 環境変数
description: 法律アシスタントの設定オプションの包括的なリスト。
---

法律アシスタントは、主に環境変数を通じて設定されます。これらはプロジェクトのルートにある `.env` ファイルに設定するか、プロセスに直接渡すことができます。

## 一般設定

| 変数 | 説明 | デフォルト |
| :--- | :--- | :--- |
| `NODE_ENV` | アプリケーション環境 (`development`, `production`, `test`) | `development` |
| `PORT` | サーバーがリッスンするポート | `3000` |
| `LOG_LEVEL` | ログの冗長性 (`error`, `warn`, `info`, `debug`) | `info` |

## LLM 設定

| 変数 | 説明 | 必須 |
| :--- | :--- | :--- |
| `LLM_MODEL_PROVIDER` | AI プロバイダー (`openai`, `anthropic`) | はい |
| `LLM_API_KEY` | 選択したプロバイダーの API キー | はい |
| `LLM_MODEL_NAME` | 特定のモデル ID (例: `gpt-4o`) | はい |
| `LLM_TEMPERATURE` | サンプリング温度 (0.0 から 1.0) | `0.3` |
| `USE_FREE_MODEL` | OpenRouter/無料モデルモードを有効にする | `false` |
| `ALLOW_MODELS` | UI で利用可能なモデルのリスト (カンマ区切り) | すべて |

## データベース設定

| 変数 | 説明 | デフォルト |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL 接続文字列 | 必須 |
| `DB_TYPE` | データベースドライバー (現在は `postgresql`) | `postgresql` |

## 認証とセキュリティ

| 変数 | 説明 | 必須 |
| :--- | :--- | :--- |
| `JWT_SECRET` | セッショントークンの署名用シークレットキー | はい |
| `JWT_EXPIRES_IN` | トークンの有効期間 (秒) | `86400` (24h) |
| `DEFAULT_ADMIN_EMAIL` | 初期管理者アカウントのメールアドレス | `admin@example.com` |
| `DEFAULT_ADMIN_PASSWORD`| 初期管理者アカウントのパスワード | `Admin123!@#` |

## LINE Bot 設定

| 変数 | 説明 |
| :--- | :--- |
| `LINE_CHANNEL_SECRET` | LINE Developers コンソールから取得 |
| `LINE_ACCESS_TOKEN` | LINE Developers コンソールから取得 |

## MCP ツール管理

| 変数 | 説明 | デフォルト |
| :--- | :--- | :--- |
| `ALLOWED_MCP_TOOLS` | `server_tool` 名のホワイトリスト | すべて |

## 検索 API フォールバック

*注意: これらは MCP サーバーが利用できない場合、またはレガシーツールのサポートに使用されます。*

| 変数 | 説明 |
| :--- | :--- |
| `TAVILY_API_KEY` | Tavily 検索用キー |
| `JINA_API_KEY` | Jina Reader 用キー |

## `.env` ファイルの例

```bash
NODE_ENV=production
PORT=3000
LLM_MODEL_PROVIDER=openai
LLM_MODEL_NAME=gpt-4o-mini
LLM_API_KEY=sk-....
DATABASE_URL="postgresql://law_user:pass@localhost:5432/law_assistant"
JWT_SECRET="ここに長いランダムな文字列を生成して入力"
```
