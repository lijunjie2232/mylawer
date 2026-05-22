# 法律アシスタント (Law Assistant)
[![English Version](https://img.shields.io/badge/Readme-en-blue)](./README_en.md)

LangChain と Model Context Protocol (MCP) を基盤としたインテリジェントな法的コンサルティングアシスタントです。日本の法律に関する質問に回答し、専門的なアドバイスを提供します。

## 🚀 ライブデモ

**[🌐 オンラインデモを試す](https://l2533584225-las.hf.space)**

## 🌟 主な特徴

- 🤖 **インテリジェント Q&A**: 最新の LLM (GPT-4o, Claude 3.5 Sonnet 等) による高度な法的推論。
- 🔍 **法的ドキュメント検索**: `legal-mcp` を通じた、数千の日本の法令・判例に対する深層検索。
- 🌐 **リアルタイムウェブ検索**: `webmcp` を活用し、最新のニュースや法改正情報を取得。
- 📱 **マルチインターフェース**: モダンな **Web UI**、**CLI**、および **LINE Bot** に対応。
- 🛠️ **MCP アーキテクチャ**: Model Context Protocol により、ツールの拡張性が高く、セキュアな実行環境を実現。
- 🔐 **エンタープライズ対応**: JWT 認証、セッション管理、ロールベースのアクセス制御。

## 🚀 クイックスタート (Docker)

最も簡単な開始方法は、Docker Compose を使用することです。

```bash
git clone https://github.com/lijunjie2232/mylawer.git
cd mylawer
cp .env.example .env
# .env を編集して LLM_API_KEY を設定
docker-compose -f docker-compose-demo.yaml up -d --build
```

起動後、[http://localhost:3000](http://localhost:3000) にアクセスしてください。
- **初期設定メール**: `admin@example.com`
- **初期設定パスワード**: `Admin123!@#`

## 📚 ドキュメント

詳細なガイドについては、Starlight ベースのドキュメントサイトを参照してください：

- **日本語ドキュメント**: [./docs/src/content/docs/ja/index.mdx](./docs/src/content/docs/ja/index.mdx) (またはデプロイされたサイト)
- **スタートガイド**: [スタートガイド](/ja/getting-started/quickstart/)
- **システム概要**: [アーキテクチャ](/ja/concepts/overview/)
- **環境変数**: [設定リファレンス](/ja/config/environment/)

## 🛠️ 技術スタック

- **Backend**: Node.js, Express, TypeScript
- **AI Orchestration**: LangChain, LangGraph
- **Protocol**: Model Context Protocol (MCP)
- **Frontend**: React, Vite, Tailwind CSS
- **Database**: PostgreSQL, Prisma
- **Deployment**: Docker, supervisord

## 🤝 貢献

プルリクエストは大歓迎です。大きな変更を加える場合は、まず Issue を立てて、何を議論したいかをお知らせください。

## 📄 ライセンス

[LICENSE](./LICENSE) ファイルを参照してください。

---

⚠️ **免責事項**: このアシスタントが提供する情報は参考用であり、法的助言を構成するものではありません。重要な判断を下す前に、必ず資格を持つ弁護士に相談してください。
