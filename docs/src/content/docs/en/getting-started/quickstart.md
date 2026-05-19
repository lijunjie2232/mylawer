---
title: Quick Start
description: Get Law Assistant up and running in minutes using Docker.
---

The fastest way to experience Law Assistant is using our pre-configured Docker Demo setup. This includes the application server, the web frontend, a PostgreSQL database, and the integrated MCP servers.

## Prerequisites

- **Docker** and **Docker Compose** installed.
- An **LLM API Key** (OpenAI or Anthropic).

## 3-Step Setup

### 1. Clone and Prepare

```bash
git clone https://github.com/lijunjie2232/mylawer.git
cd mylawer
cp .env.example .env
```

### 2. Configure LLM

Edit the `.env` file and add your API key:

```bash
LLM_MODEL_PROVIDER=openai
LLM_API_KEY=sk-....
```

### 3. Run the app

#### 3.1 Run the postgresql container

```bash
docker-compose -f postgresql-dev.yml up -d --build
```

#### 3.2 Run the app

```bash
pnpm i
pnpm db:migrate:dev
pnpm db:init-admin
pnpm db:generate
pnpm run dev
```

## Verification

Once the containers are running, you can access the system:

- **Web UI**: [http://localhost:3000](http://localhost:3000)
- **API Docs**: [http://localhost:3000/docs](http://localhost:3000/docs)
- **Health Check**: [http://localhost:3000/health](http://localhost:3000/health)

### Default Credentials

- **Email**: `admin@example.com`
- **Password**: `Admin123!@#`

## Next Steps

- Learn how to [configure different LLM providers](../../config/llm/).
- Explore the [Web UI features](../../guides/web-ui/).
- Check the [Manual Installation guide](../../getting-started/installation/) if you want to develop locally.
