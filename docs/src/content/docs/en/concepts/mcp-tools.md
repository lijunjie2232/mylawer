---
title: MCP Tool System
description: Understanding the Model Context Protocol integration in Law Assistant.
---

Law Assistant uses the **Model Context Protocol (MCP)** to provide the AI agent with external capabilities. By decoupling tools from the main application, we ensure the system remains lightweight and extensible.

## Current MCP Servers

We bundle two primary MCP servers by default:

### 1. legal-mcp (Japanese Law Search)

repo url: https://github.com/lijunjie2232/legal-mcp

This server is the core of our legal intelligence. It connects to a specialized search engine (Elasticsearch) containing thousands of Japanese laws and regulations.


### 2. webmcp (General Web Intelligence)

repo url: https://github.com/lijunjie2232/webmcp

When the legal database doesn't have the answer, or if the user asks about current events/recent news, the assistant uses `webmcp`, auto switched by the LLM.

## How Tools are Loaded

During startup, the `mcpInitializer.ts` service:
1.  Locates the configured MCP servers in the `third/` directory.
2.  Connects to them via standard I/O (Node.js child processes).
3.  Inspects their manifests to see what tools they offer.
4.  **Filters** these tools based on the `ALLOWED_MCP_TOOLS` environment variable.
5.  Adapts them into LangChain-compatible tools.

## Why MCP?

- **Security**: MCP servers run in their own processes. You can restrict their permissions (e.g., read-only filesystem).
- **Interoperability**: You can use any MCP server built by the community (e.g., GitHub, Slack, or Database connectors).
- **Scalability**: Heavy processing (like complex law parsing) happens in the MCP server process, not the main application event loop.

## Tool Management

You can control which tools are active using the `ALLOWED_MCP_TOOLS` variable in your `.env`:

```bash
# Allow only law search and web parsing
ALLOWED_MCP_TOOLS=legal-mcp_search_laws,webmcp_parse_url
```

See the [Tool Management guide](../../config/tools/) for more details on filtering.
