# 法律アシスタント ドキュメント

このディレクトリには、法律アシスタントの公式ドキュメントが含まれています。

## 🚀 クイックスタート

### 開発サーバーの起動

```bash
cd docs
pnpm install
pnpm dev
```

ブラウザで http://localhost:4321 にアクセスしてください。

### プロジェクト構造

```
docs/
├── public/              # 静的アセット
├── src/
│   ├── assets/          # 画像などのアセット
│   ├── content/         # ドキュメントコンテンツ
│   │   └── docs/        # Markdown/MDX ファイル
│   └── content.config.ts
├── astro.config.mjs     # Astro 設定
├── package.json         # 依存関係
└── tsconfig.json        # TypeScript 設定
```

## 📝 ドキュメントの追加

新しいドキュメントページを作成するには：

1. `src/content/docs/` ディレクトリに `.md` または `.mdx` ファイルを作成
2. ファイル名が URL パスになります
3. Frontmatter でメタデータを設定

例：

```markdown
---
title: 新しい機能
description: この機能の説明
lastUpdated: 2026-03-11
---

# 新しい機能

ここに内容を書きます...
```

## 🧞 コマンド

すべてのコマンドはプロジェクトのルートから実行します：

| コマンド | 説明 |
|---------|------|
| `pnpm --filter docs dev` | ローカル開発サーバーを起動（ホットリロード） |
| `pnpm --filter docs build` | 本番用サイトをビルド |
| `pnpm --filter docs preview` | ビルドしたサイトをローカルでプレビュー |
| `pnpm --filter docs astro ...` | Astro CLI コマンドを実行 |

## 🎨 カスタマイズ

### サイト設定

`astro.config.mjs` を編集してサイト情報を設定：

```javascript
starlight({
  title: '法律アシスタント',
  tagline: 'インテリジェントな法的コンサルティングアシスタント',
  social: {
    github: 'https://github.com/your-repo/law_assistant'
  }
})
```

### ナビゲーション

サイドバーナビゲーションは `astro.config.mjs` で設定：

```javascript
sidebar: [
  {
    label: 'セクション名',
    items: [
      { label: 'ページ名', slug: 'page-slug' }
    ]
  }
]
```

## 📦 デプロイ

### Vercel でのデプロイ

```bash
pnpm build
vercel deploy
```

### Netlify でのデプロイ

```bash
pnpm build
netlify deploy --prod
```

### Docker でのデプロイ

```bash
docker build -t law-assistant-docs .
docker run -p 80:80 law-assistant-docs
```

## 🛠 技術スタック

- **Astro** v6.x - ウェブフレームワーク
- **Starlight** v0.38.x - ドキュメントテーマ
- **TypeScript** - 型安全性
- **Markdown/MDX** - コンテンツ作成

## 📚 リソース

- [Starlight ドキュメント](https://starlight.astro.build/)
- [Astro ドキュメント](https://docs.astro.build/)
- [MDX ドキュメント](https://mdxjs.com/)

## 🤝 コントリビューション

ドキュメントの改善については、[メインのリポジトリ](https://github.com/your-repo/law_assistant) で Issue や PR をお送りください。
