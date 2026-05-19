---
title: LLM プロバイダー
description: OpenAI、Anthropic、およびその他の AI モデルの設定。
---

法律アシスタントは、幅広い Large Language Models (LLM) をサポートしています。プロバイダーを簡単に切り替えたり、OpenRouter を介して無料モデルを使用したりすることができます。

## 統一された設定

すべての LLM 設定は、`.env` 内の `LLM_MODEL_PROVIDER` および `LLM_API_KEY` 変数を通じて管理されます。

### 1. OpenAI

デフォルトのプロバイダーです。速度と法的推論のバランスが取れているため推奨されます。

```bash
LLM_MODEL_PROVIDER=openai
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL_NAME=gpt-4o-mini
LLM_API_KEY=sk-....
```

### 2. Anthropic

高品質な法的文書作成と長いコンテキストウィンドウで知られています。

```bash
LLM_MODEL_PROVIDER=anthropic
LLM_BASE_URL=https://api.anthropic.com/v1
LLM_MODEL_NAME=claude-3-5-sonnet-20240620
LLM_API_KEY=sk-ant-....
```

### 3. OpenRouter (無料および多様なモデル)

OpenRouterを用いると、Meta (Llama)、Google (Gemini)、または様々な無料モデルを体験できます。

```bash
USE_FREE_MODEL=true
FREE_MODEL_BASE_URL=https://openrouter.ai/api/v1
DEFAULT_MODEL=google/gemini-2.0-flash-001
LLM_API_KEY=sk-or-....
```

!!!注意!!!: `USE_FREE_MODEL` 変数を `true` に設定すると、`LLM_BASE_URL` が `https://openrouter.ai/api/v1` に上書きされます。

## モデルのフィルタリング

`ALLOW_MODELS` 変数を使用して、ウェブ UI で利用可能なモデルを制限できます。これにより、ユーザーが非常に高価なモデルを選択するのを防ぐことができます。

```bash
# これらの特定のモデルのみを許可
ALLOW_MODELS=gpt-4o-mini,claude-3-haiku
```

## 高度なパラメータ

モデルの動作を微調整できます：

- **`LLM_TEMPERATURE`**: 創造性を制御します。一貫した法的回答を得るために、デフォルトは `0.3` です。
- **`LLM_MAX_TOKENS`**: AI 回答の最大長を設定します。デフォルトは `8192` です。

## 実行時のモデル切り替え

複数のモデルが設定され、許可されている場合、ユーザーはウェブ UI の**設定**パネルでそれらを切り替えることができます。各セッションに独自のモデルを割り当てることができます。

## トラブルシューティング

- **401 Unauthorized**: API キーが正しく、残高があることを確認してください。
- **Model Not Found**: 選択した `LLM_MODEL_NAME` がプロバイダーによってサポートされていることを確認してください。
- **Quota Exceeded**: レート制限に達した可能性があります。ティアをアップグレードするか、プロバイダーの切り替えを検討してください。
