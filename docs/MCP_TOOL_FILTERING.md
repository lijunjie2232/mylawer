# MCP Tool Filtering Configuration

This document explains how to configure and use the MCP (Model Context Protocol) tool filtering feature.

## Overview

The `ALLOWED_MCP_TOOLS` environment variable allows you to restrict which MCP tools are available to the AI assistant. This is useful for:

- Limiting tool access for security reasons
- Reducing token usage by preventing unnecessary tool calls
- Customizing tool availability per deployment

## Configuration

### Environment Variable

Add the following to your `.env` file:

```bash
# Allow specific tools only (comma or semicolon separated)
ALLOWED_MCP_TOOLS=webmcp_search,legal-mcp_search_laws

# Or allow all tools (leave empty or comment out)
# ALLOWED_MCP_TOOLS=
```

### Format

Tools are specified using the format: `serverName_toolName`

**Separators**: You can use either commas (`,`) or semicolons (`;`) to separate multiple tools.

**Examples**:
```bash
# Using comma separator
ALLOWED_MCP_TOOLS=webmcp_search,webmcp_parse_url,legal-mcp_search_laws

# Using semicolon separator
ALLOWED_MCP_TOOLS=webmcp_search;webmcp_parse_url;legal-mcp_search_laws

# Mixed separators also work
ALLOWED_MCP_TOOLS=webmcp_search,webmcp_parse_url;legal-mcp_search_laws
```

## Available Tools

### webmcp Tools

| Tool Name | Description |
|-----------|-------------|
| `webmcp_search` | Search for a keyword on a specified search engine |
| `webmcp_search_multiple` | Search for a keyword on multiple search engines |
| `webmcp_deep_search` | Perform deep search by searching and parsing result pages |
| `webmcp_get_available_engines` | Get list of available search engines |
| `webmcp_set_language` | Set the language/locale for search results |
| `webmcp_parse_url` | Parse a web page URL and extract its content |

### legal-mcp Tools

| Tool Name | Description |
|-----------|-------------|
| `legal-mcp_search_laws` | Search for Japanese laws and regulations |
| `legal-mcp_get_law_by_id` | Retrieve full details of a specific law by ID |
| `legal-mcp_get_cluster_status` | Get Elasticsearch cluster status |
| `legal-mcp_get_index_state` | Get detailed statistics of the legal documents index |
| `legal-mcp_get_raw_json_by_id` | Retrieve complete raw JSON data for a law by ID |

## Usage Examples

### Example 1: Allow Only Search Tools

If you want to allow only basic search functionality:

```bash
ALLOWED_MCP_TOOLS=webmcp_search,legal-mcp_search_laws
```

### Example 2: Allow Web Search with URL Parsing

For web research capabilities:

```bash
ALLOWED_MCP_TOOLS=webmcp_search,webmcp_parse_url,webmcp_deep_search
```

### Example 3: Allow All Legal Tools

For legal research only:

```bash
ALLOWED_MCP_TOOLS=legal-mcp_search_laws,legal-mcp_get_law_by_id,legal-mcp_get_raw_json_by_id
```

### Example 4: Allow All Tools (Default)

To allow all available tools, simply leave the variable empty or commented out:

```bash
# ALLOWED_MCP_TOOLS=
```

## How It Works

1. When the application starts, it reads the `ALLOWED_MCP_TOOLS` environment variable
2. The value is parsed into an array of allowed tool names (splitting by `,` or `;`)
3. During MCP tool initialization, each tool is checked against the allowed list
4. Only tools that match the allowed list are converted to LangChain tools
5. Tools not in the allowed list are skipped and logged at debug level

## Testing

You can test the filtering configuration using the provided test script:

```bash
npm run test:mcp-filtering
```

Or run it directly:

```bash
npx tsx tests/test_mcp_tool_filtering.ts
```

## Logging

The application logs information about tool filtering:

- **Info level**: Shows when filtering is enabled and which tools are allowed
- **Debug level**: Shows individual tools that were skipped due to filtering

Example log output:
```
[INFO] Filtering MCP tools based on ALLOWED_MCP_TOOLS configuration
[INFO] Allowed tools: ["webmcp_search", "legal-mcp_search_laws"]
[DEBUG] Skipping MCP tool (not in allowed list): webmcp_deep_search
[INFO] Converted MCP tools to LangChain tools: { count: 2, filtered: true }
```

## Related Configuration

This feature works similarly to the `ALLOW_MODELS` configuration for LLM models. Both use the same separator pattern (`,` or `;`) for consistency.

See also:
- [ALLOW_MODELS Configuration](./README.md#model-filtering)

## Troubleshooting

### No tools are available

1. Check that the `ALLOWED_MCP_TOOLS` variable is set correctly in your `.env` file
2. Verify that the tool names match exactly (case-sensitive)
3. Ensure MCP servers are running and connected successfully
4. Check the logs for any connection errors

### Tools are being filtered unexpectedly

1. Review the debug logs to see which tools are being skipped
2. Verify the tool names in your configuration match the actual tool names
3. Remember that the format is `serverName_toolName` (with underscore)

### Need to see all available tools

Temporarily comment out or remove the `ALLOWED_MCP_TOOLS` variable to see all available tools in the logs.
