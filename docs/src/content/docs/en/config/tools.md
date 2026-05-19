---
title: Tool Management
description: Configuring and whitelisting AI tools via MCP.
---

Law Assistant allows you to precisely control which tools are available to the AI agent. This is managed through tool whitelisting.

## The Whitelist Principle

By default, Law Assistant attempts to load all tools provided by the connected MCP servers. However, for security, performance, or UI clarity, you might want to restrict these.

### `ALLOWED_MCP_TOOLS`

Use this environment variable to specify exactly which tools are allowed. The format is `serverName_toolName`.

```bash
# Example: Allow only legal search and basic web search
ALLOWED_MCP_TOOLS=legal-mcp_search_laws,webmcp_search
```

## Available Tool Reference

### legal-mcp (Japanese Laws)

| Tool Identifier | Use Case |
| :--- | :--- |
| `legal-mcp_search_laws` | Semantic search across the legal database. |
| `legal-mcp_get_law_by_id` | Getting the full text of a specific article. |
| `legal-mcp_get_cluster_status`| Checking the health of the legal search index. |

### webmcp (Internet Context)

| Tool Identifier | Use Case |
| :--- | :--- |
| `webmcp_search` | Standard keyword search via search engines. |
| `webmcp_parse_url` | Extracting text from a specific website. |
| `webmcp_deep_search` | Multi-step research and report synthesis. |

## Why Filter Tools?

1.  **Cost Control**: Some tools (like `deep_search`) may consume more tokens as the agent analyzes multiple pages.
2.  **Accuracy**: Restricting the agent to specialized tools (like `legal-mcp`) ensures it stays focused on high-quality legal sources rather than general web blogs.
3.  **Security**: Prevent the agent from accessing tools that might expose sensitive metadata or allow unauthorized actions.

## Advanced: Adding Custom Tools

To add new tools:
1.  Place your new MCP server in the `third/` directory.
2.  Update `src/mcp/mcpInitializer.ts` to include the new server.
3.  Add the new tools to your `ALLOWED_MCP_TOOLS` whitelist.

## Troubleshooting

- **Tool Not Appearing**: Check your spelling in `ALLOWED_MCP_TOOLS`. Ensure you are using the correct server prefix (e.g., `webmcp_` or `legal-mcp_`).
- **Initialization Error**: Check the server logs. If an MCP server fails to connect, none of its tools will be available, regardless of the whitelist.
