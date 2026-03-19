---
title: クイックスタート
description: 法律アシスタントをセットアップして使い始めるまでのガイド
lastUpdated: 2026-03-11
---

# クイックスタートガイド

このガイドでは、法律アシスタントをセットアップして使い始めるまでの手順を説明します。

## 前提条件

- **Node.js** (v18 以上)
- **pnpm** (v8 以上)
- **Git**

## ステップ 1: プロジェクトのクローン

```bash
# リポジトリをクローン
git clone <repository-url>
cd law_assistant
```

## ステップ 2: 依存関係のインストール

```bash
# pnpm を使用して依存関係をインストール
pnpm install
```

## ステップ 3: 環境変数の設定

```bash
# 環境変数テンプレートをコピー
cp .env.example .env
```

`.env` ファイルを編集して、以下の環境変数を設定します：

```bash
# 必須設定
LLM_API_KEY=your_api_key_here
LLM_MODEL_PROVIDER=openai

# オプション設定
NODE_ENV=development
PORT=3000
LOG_LEVEL=info
```

### 主要な環境変数

| 変数名 | 説明 | デフォルト値 |
|--------|------|-------------|
| `LLM_API_KEY` | LLM プロバイダーの API キー | 必須 |
| `LLM_MODEL_PROVIDER` | モデルプロバイダー (ollama, openai, anthropic) | `ollama` |
| `LLM_MODEL_NAME` | 使用するモデル名 | `gpt-oss:20b` |
| `LLM_BASE_URL` | LLM API のベース URL | `http://localhost:11434/v1` |
| `PORT` | サーバーポート | `3000` |

## ステップ 4: 動作確認

### CLI モードでテスト

```bash
# 開発モードで CLI を起動
pnpm dev

# または直接 CLI を実行
pnpm cli

# 引数を直接渡して質問
pnpm cli "労働契約紛争の対応方法は？"
```

### サーバーモードでテスト

```bash
# 開発モードでサーバーを起動
pnpm dev:server

# ブラウザでアクセス
# http://localhost:3000
```

## 次のステップ

- [CLI モード](/guides/cli-mode/) - コマンドラインインターフェースの詳細
- [サーバーモード](/guides/server-mode/) - サーバー API の使用方法
- [LINE Bot 連携](/guides/line-bot/) - LINE Bot との統合

## トラブルシューティング

### よくある問題

#### 1. API キーのエラー

```bash
Error: Missing LLM_API_KEY
```

**解決方法**: `.env` ファイルに正しい API キーを設定してください。

#### 2. ポートが使用中

```bash
Error: Port 3000 is already in use
```

**解決方法**: 別のポートを使用するか、他のプロセスを終了してください。

```bash
# PORT 環境変数を変更
PORT=3001 pnpm dev:server
```

#### 3. 依存関係のインストール失敗

```bash
Error: ENOENT: no such file or directory
```

**解決方法**:

```bash
# pnpm を再インストール
npm install -g pnpm

# 依存関係をクリーンインストール
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

## ヘルプとサポート

問題が解決しない場合は、以下をご確認ください：

- 📖 [インストールガイド](/guides/installation/) - 詳細なインストール手順
- 🐛 [GitHub Issues](https://github.com/your-repo/law_assistant/issues) - 既知の問題
- 💬 [ディスカッション](https://github.com/your-repo/law_assistant/discussions) - コミュニティサポート
