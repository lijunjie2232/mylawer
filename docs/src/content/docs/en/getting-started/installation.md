---
title: Manual Installation
description: Step-by-step guide to installing Law Assistant for development.
---

This guide covers the manual installation of Law Assistant on your local machine. This is recommended for developers who want to modify the source code or contribute to the project.

## Prerequisites

- **Node.js**: v20 or higher (v24 recommended).
- **pnpm**: v9 or higher.
- **PostgreSQL**: A running instance (local or remote).
- **Git**: To clone the repository.

## Installation Steps

### 1. Clone the Repository

```bash
git clone https://github.com/lijunjie2232/mylawer.git
cd mylawer
git submodule update --init --recursive
```

### 2. Install Dependencies

Law Assistant uses a pnpm workspace to manage the backend, frontend, and MCP servers.

```bash
pnpm install
```

### 3. Environment Configuration

Copy the example environment file and edit it:

```bash
cp .env.example .env
```

Ensure `DATABASE_URL` points to your PostgreSQL instance:

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/law_assistant"
```

### 4. Database Setup

Generate the Prisma client and run the migrations to create the tables:

```bash
pnpm db:generate
pnpm db:migrate:dev
```

### 5. Build the Project

You need to build the frontend and the MCP servers before running the main application.

```bash
# Build frontend
cd frontend && pnpm build && cd ..

# Build legal-mcp (js_legal)
cd third/legal-mcp/js_legal && pnpm install && pnpm build && cd ../../..

# Build main application
pnpm build
```

## Running the Application

### Development Mode

Run the server with hot-reload:

```bash
pnpm dev:server
```

### Production Mode

Build and start the compiled server:

```bash
node dist/server.js --server
```

## Troubleshooting

### MCP Server Not Connecting

If the `legal-mcp` or `webmcp` servers fail to start, ensure you have run the build commands in their respective directories (`third/legal-mcp/js_legal` and `third/webmcp`).

### Database Permissions

Ensure the user in `DATABASE_URL` has permissions to create tables and run migrations.

## Next Steps

- Configure your [LLM Providers](../../config/llm/).
- Learn about the [System Overview](../../concepts/overview/).
