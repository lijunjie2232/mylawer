# 法律アシスタント (Law Assistant)

LangChain を基盤としたインテリジェントな法的コンサルティングアシスタントで、様々な法律問題に回答し、専門的な法的アドバイスを提供できます。

## 機能特徴

- 🤖 **インテリジェントQ&A**: 大規模言語モデルに基づく法的コンサルティングサービス
- 🔍 **ドキュメント検索**: 内蔵の法的ドキュメント検索機能
- 🌐 **ウェブ検索**: Google、百度、Bing などの主要検索エンジンをサポート
- ⚡ **複数モード**: シンプルなQ&Aと複雑なクエリの2つの処理モードをサポート
- 🛠️ **ツール統合**: 拡張可能なツールシステム
- 📝 **型安全性**: 完全な TypeScript 型定義
- 🎯 **専門プロンプト**: 法的分野に最適化されたプロンプト

## クイックスタート

### 1. 環境準備

```bash
# プロジェクトをクローン
git clone <repository-url>
cd law_assistant

# 依存関係をインストール
pnpm install
```

### 2. 環境変数の設定

```bash
# 環境変数テンプレートをコピー
cp .env.example .env

# .env ファイルを編集し、OpenAI API キーを入力
vim .env
```

設定が必要な環境変数：
- `LLM_API_KEY`: あなたの LLM API キー（所有提供商共用）
- `LLM_MODEL_PROVIDER`: モデルプロバイダー（ollama | openai | anthropic）

### 3. 実行方法

#### CLI モード
```bash
# 開発モードで CLI を起動
pnpm dev

# または直接 CLI を実行
pnpm cli

# 引数を直接渡して質問
pnpm cli "労働契約紛争の対応方法は？"

# インタラクティブモード
pnpm cli
```

#### サーバーモード (LINE Bot)
```bash
# 開発モードでサーバーを起動
pnpm dev:server

# 本番モードでサーバーを起動
pnpm server

# ビルド後にサーバーを起動
pnpm build
pnpm start:server
```

#### 本番モード (CLI)
```bash
# プロジェクトをビルド
pnpm build

# 本番バージョンを起動
pnpm start
```

## プロジェクト構造

```
law_assistant/
├── src/
│   ├── agents/          # インテリジェントエージェント
│   │   └── legalAgent.ts
│   ├── chains/          # 処理チェーン
│   │   └── legalChain.ts
│   ├── config/          # 設定ファイル
│   │   ├── environment.ts
│   │   └── llm.ts
│   ├── handlers/        # LINE Bot ハンドラー
│   │   └── lineBotHandler.ts
│   ├── middleware/      # Express ミドルウェア
│   │   ├── errorHandler.ts
│   │   ├── lineSignatureMiddleware.ts
│   │   └── rawBodyMiddleware.ts
│   ├── server.ts        # サーバークラス
│   ├── tools/           # ツールセット
│   │   └── documentSearchTool.ts
│   ├── types/           # 型定義
│   │   ├── index.ts
│   │   └── server.ts
│   ├── utils/           # ユーティリティ関数
│   │   └── logger.ts
│   └── index.ts         # メインエントリーファイル
├── tests/               # テストファイル
├── .env.example         # 環境変数サンプル
├── package.json         # プロジェクト設定
├── tsconfig.json        # TypeScript 設定
└── README.md           # プロジェクトドキュメント
```

## コアコンポーネント

### LegalChain（法的処理チェーン）
シンプルな法的コンサルティング問題を処理し、事前定義されたプロンプトテンプレートを使用して回答を生成します。

### LegalAgent（法的エージェント）
複雑な法的クエリを処理し、ドキュメント検索などの各種ツールを呼び出して回答能力を強化できます。

### DocumentSearchTool（ドキュメント検索ツール）
内蔵の法的ドキュメント検索機能で、キーワードに基づいて関連する法律条文や判例を検索できます。

### WebSearchTool（ウェブ検索ツール）
Playwright ベースのウェブ検索エンジンツールで以下の機能をサポート：
- Google 検索
- 百度検索
- Bing 検索
- 検索結果の自動取得とフォーマット処理
- インテリジェントなエラー処理と再試行メカニズム

## 使用例

### シンプルQ&Aモード
```typescript
import { LawAssistant } from './src';

const assistant = new LawAssistant();
const answer = await assistant.askLegalQuestion("労働契約満了後の更新なしには賠償が必要ですか？");
console.log(answer);
```

### 複雑クエリモード
```typescript
const complexAnswer = await assistant.processComplexQuery("労働契約法における経済補償に関する条項を検索");
console.log(complexAnswer);
```

### サーバーモード API 使用例
```bash
# サーバー情報取得
GET http://localhost:3000/

# ヘルスチェック
GET http://localhost:3000/health

# API ドキュメント
GET http://localhost:3000/api/docs

# LINE webhook (POST)
POST http://localhost:3000/webhook
Content-Type: application/json
X-Line-Signature: [signature]

{
  "events": [{
    "type": "message",
    "replyToken": "token",
    "source": {
      "userId": "user123",
      "type": "user"
    },
    "message": {
      "type": "text",
      "text": "労働契約について教えてください"
    }
  }]
}
```

## 設定オプション

`.env` ファイルで以下のパラメータを設定できます：

```env
# アプリケーション設定
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# 統一的 LLM 設定
LLM_MODEL_PROVIDER=ollama
LLM_MODEL_NAME=gpt-oss:20b
LLM_BASE_URL=http://localhost:11434/v1
LLM_MAX_TOKENS=8192
LLM_TEMPERATURE=0.7
LLM_API_KEY=your_api_key_here

# LINE Bot 設定
LINE_CHANNEL_SECRET=your_line_channel_secret
LINE_ACCESS_TOKEN=your_line_access_token
```

## 開発ガイド

### 新しいツールの追加
1. `src/tools/` ディレクトリに新しいツールクラスを作成
2. `DynamicTool` クラスを継承
3. `LegalAgent` に新規ツールを登録

### プロンプトのカスタマイズ
`src/chains/legalChain.ts` のプロンプトテンプレートを修正して回答スタイルを調整します。

### 機能拡張
- 法的分野の専門知識をさらに追加
- 実際の法的データベースとの統合
- 多言語サポートの追加
- Web API インターフェースの実装
- LINE Bot のリッチメッセージ対応
- ユーザーセッション管理
- メッセージ履歴保存機能

## サーバーテスト

```bash
# サーバー起動テスト
pnpm dev:server

# ヘルスチェック
curl http://localhost:3000/health

# API ドキュメント確認
curl http://localhost:3000/api/docs

# Swagger UI を開く (ブラウザでアクセス)
# http://localhost:3000/docs

# Swagger JSON を取得
curl http://localhost:3000/docs-json
```

## API 文档测试

```bash
# Swagger UI 機能テスト
pnpm test:swagger
```

## テスト

```bash
# テストを実行
pnpm test
```

## Docker デプロイ

### 単一コンテナデプロイ

プロジェクトは単一の Docker コンテナで実行するための Dockerfile を提供しており、PostgreSQL データベースとアプリケーションを一体化しています。

#### クイックスタート

```bash
# 環境変数を設定
cp .env.example .env

# .env ファイルを編集
vim .env
```

**重要な環境変数：**
- `POSTGRES_PASSWORD`: PostgreSQL ルートパスワード
- `LLM_API_KEY`: LLM API キー
- `DEFAULT_ADMIN_EMAIL`: 初期管理者メールアドレス（デフォルト：admin@example.com）
- `DEFAULT_ADMIN_PASSWORD`: 初期管理者パスワード（デフォルト：Admin@123）

#### ビルドと実行

```bash
# Docker イメージをビルド
docker build -t law-assistant .

# コンテナを実行
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

#### Docker Compose を使用

```bash
# docker-compose.single.yml を使用
docker-compose -f docker-compose.single.yml up -d
```

### 管理者アカウントの初期化

Docker コンテナは起動時に自動的に管理者アカウントを初期化します：

1. **自動初期化**: `INIT_ADMIN=true` 環境変数が設定されている場合、コンテナ起動時に自動的に管理者アカウントを作成
2. **初期クレデンシャル**:
   - メール：`admin@example.com`
   - パスワード：`DEFAULT_ADMIN_PASSWORD` 環境変数の値
3. **セキュリティ**: 初回ログイン後、直ちにパスワードを変更してください

### トラブルシューティング

```bash
# コンテナログを確認
docker logs law-assistant

# コンテナ内に進入
docker exec -it law-assistant /bin/bash

# データベース接続を確認
docker exec law-assistant pg_isready -h localhost -U postgres
```

## 许可证

ISC

## 注意事項

⚠️ **重要な注意**：
- このアシスタントが提供する法的アドバイスは参考のみであり、専門弁護士の相談に代わるものではありません
- 重要な法的事項については、必ず実務資格を持つ弁護士に相談してください
- 利用前に地域の法令を遵守していることを確認してください