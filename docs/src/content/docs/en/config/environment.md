---
title: Environment Variables
description: Comprehensive list of configuration options for Law Assistant.
---

Law Assistant is configured primarily through environment variables. These can be set in a `.env` file at the project root or passed directly to the process.

## General Settings

| Variable | Description | Default |
| :--- | :--- | :--- |
| `NODE_ENV` | Application environment (`development`, `production`, `test`) | `development` |
| `PORT` | The port the server listens on | `3000` |
| `LOG_LEVEL` | Logging verbosity (`error`, `warn`, `info`, `debug`) | `info` |

## LLM Configuration

| Variable | Description | Required |
| :--- | :--- | :--- |
| `LLM_MODEL_PROVIDER` | AI Provider (`openai`, `anthropic`) | Yes |
| `LLM_API_KEY` | API Key for the chosen provider | Yes |
| `LLM_MODEL_NAME` | Specific model ID (e.g., `gpt-4o`) | Yes |
| `LLM_TEMPERATURE` | Sampling temperature (0.0 to 1.0) | `0.3` |
| `USE_FREE_MODEL` | Enable OpenRouter/Free model mode | `false` |
| `ALLOW_MODELS` | List of models available to the UI (comma-separated) | All |

## Database Configuration

| Variable | Description | Default |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `DB_TYPE` | Database driver (currently `postgresql`) | `postgresql` |

## Authentication & Security

| Variable | Description | Required |
| :--- | :--- | :--- |
| `JWT_SECRET` | Secret key for signing session tokens | Yes |
| `JWT_EXPIRES_IN` | Token validity period (seconds) | `86400` (24h) |
| `DEFAULT_ADMIN_EMAIL` | Email for the initial admin account | `admin@example.com` |
| `DEFAULT_ADMIN_PASSWORD`| Password for the initial admin account | `Admin123!@#` |

## LINE Bot Configuration

| Variable | Description |
| :--- | :--- |
| `LINE_CHANNEL_SECRET` | From LINE Developers Console |
| `LINE_ACCESS_TOKEN` | From LINE Developers Console |

## MCP Tool Management

| Variable | Description | Default |
| :--- | :--- | :--- |
| `ALLOWED_MCP_TOOLS` | Whitelist of `server_tool` names | All |

## Search API Fallbacks

*Note: These are used if MCP servers are unavailable or for legacy tool support.*

| Variable | Description |
| :--- | :--- |
| `TAVILY_API_KEY` | Key for Tavily Search |
| `JINA_API_KEY` | Key for Jina Reader |

## Example `.env` File

```bash
NODE_ENV=production
PORT=3000
LLM_MODEL_PROVIDER=openai
LLM_MODEL_NAME=gpt-4o-mini
LLM_API_KEY=sk-....
DATABASE_URL="postgresql://law_user:pass@localhost:5432/law_assistant"
JWT_SECRET="generate-a-long-random-string-here"
```
