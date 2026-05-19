---
title: LLM Providers
description: Configuring OpenAI, Anthropic, and other AI models.
---

Law Assistant supports a wide range of Large Language Models (LLMs). You can easily switch providers or even use free models via OpenRouter.

## Unified Configuration

All LLM settings are managed via the `LLM_MODEL_PROVIDER` and `LLM_API_KEY` variables in your `.env`.

### 1. OpenAI

The default provider. Recommended for its balance of speed and legal reasoning.

```bash
LLM_MODEL_PROVIDER=openai
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL_NAME=gpt-4o-mini # (optional)
LLM_API_KEY=sk-....
```

### 2. Anthropic

Known for high-quality legal writing and longer context windows.

```bash
LLM_MODEL_PROVIDER=anthropic
LLM_BASE_URL=https://api.anthropic.com/v1
LLM_MODEL_NAME=claude-3-5-sonnet-20240620 # (optional)
LLM_API_KEY=sk-ant-....
```

### 3. Use free model in openrouter

Use OpenRouter to access free models from Meta (Llama), Google (Gemini), and other providers.

```bash
USE_FREE_MODEL=true
FREE_MODEL_BASE_URL=https://openrouter.ai/api/v1
DEFAULT_MODEL=google/gemini-2.0-flash-001 # (optional)
LLM_API_KEY=....
```

!!!PAY ATTENTION!!!: `USE_FREE_MODEL` will override the `LLM_BASE_URL` settings and force the use of OpenRouter.

## Model Filtering

You can restrict which models are available to the Web UI using the `ALLOW_MODELS` variable. This prevents users from selecting overly expensive models.

```bash
# Allow only these specific models
ALLOW_MODELS=gpt-4o-mini,claude-3-haiku
```

## Advanced Parameters

You can fine-tune the model's behavior:

- **`LLM_TEMPERATURE`**: Controls creativity. Defaults to `0.3` for consistent legal answers.
- **`LLM_MAX_TOKENS`**: Sets the maximum length of the AI response. Defaults to `8192`.

## Switching Models at Runtime

If you have multiple models configured and allowed, users can switch between them in the **Web UI Settings** panel. Each session can have its own assigned model.

## Troubleshooting

- **401 Unauthorized**: Ensure your API key is correct and has a positive balance.
- **Model Not Found**: Verify that the `LLM_MODEL_NAME` you've chosen is supported by your provider.
- **Quota Exceeded**: You may have hit your rate limit. Consider upgrading your tier or switching providers.
