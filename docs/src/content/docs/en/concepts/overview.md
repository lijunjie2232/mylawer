---
title: System Overview
description: Learn about the architecture and components of Law Assistant.
---

Law Assistant is a modern, modular application designed to provide intelligent legal consultation. It leverages the latest in AI orchestration and decentralized tool protocols.

## High-Level Architecture

The system is composed of four main layers:

1.  **Interface Layer**: The React Web UI, CLI, and LINE Bot integrations.
2.  **Server Layer**: A Node.js/Express server that handles authentication, session management, and routing.
3.  **Agent Layer**: Powered by **LangChain** and **LangGraph**, this layer manages the conversation flow and decides when to use tools.
4.  **Tool Layer (MCP)**: Independent **Model Context Protocol** servers that provide specialized capabilities like legal document search and web scraping.

## Key Technologies

### LangChain & LangGraph
The "brain" of the assistant is a LangChain agent. We use LangGraph to manage complex, stateful multi-turn conversations and tool-calling loops. This allows the agent to iteratively search for information, parse it, and refine its answer.

### Model Context Protocol (MCP)
Instead of hard-coding tools, Law Assistant uses MCP. This is an open standard that allows the assistant to connect to external "servers" that provide tools. This makes the system highly extensible—you can add new capabilities just by pointing to a new MCP server.

### Prisma & PostgreSQL
We use Prisma as our ORM to interact with PostgreSQL. This handles persistent storage for:
- User accounts and authentication.
- Detailed chat histories.
- Administrative configurations.

### React (Vite)
The modern web frontend is built with React and Vite, providing a fast, responsive chat interface that supports streaming responses and historical context.

## Data Flow

1.  **User Input**: A user sends a question via the Web UI, CLI, or LINE.
2.  **Authentication**: The Server Layer validates the JWT or LINE signature.
3.  **Agent Activation**: The Agent Layer receives the question and loads the session history from the database.
4.  **Tool Execution**: The Agent identifies that it needs legal context and calls a tool on the `legal-mcp` server.
5.  **LLM Processing**: The results from the tool are sent back to the LLM (GPT-4, Claude, etc.) to formulate a response.
6.  **Streaming Response**: The response is streamed back to the user in real-time.

## Next Steps

- Dive into the [MCP Tool System](../mcp-tools/).
- Explore the [API Reference](../../reference/api/).
