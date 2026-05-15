# MCP Tool Filtering - Quick Reference

## Quick Start

Add to your `.env` file:

```bash
# Comma-separated list of allowed tools (empty = allow all)
ALLOWED_MCP_TOOLS=webmcp_search,legal-mcp_search_laws
```

## Format

```
serverName_toolName
```

**Separators**: `,` or `;` (both work)

## Available Tools

### webmcp
- `webmcp_search` - Single engine search
- `webmcp_search_multiple` - Multi-engine search  
- `webmcp_deep_search` - Deep search with parsing
- `webmcp_get_available_engines` - List engines
- `webmcp_set_language` - Set language
- `webmcp_parse_url` - Parse webpage

### legal-mcp
- `legal-mcp_search_laws` - Search laws
- `legal-mcp_get_law_by_id` - Get law by ID
- `legal-mcp_get_cluster_status` - Cluster status
- `legal-mcp_get_index_state` - Index stats
- `legal-mcp_get_raw_json_by_id` - Raw JSON data

## Common Configurations

### Basic Search Only
```bash
ALLOWED_MCP_TOOLS=webmcp_search,legal-mcp_search_laws
```

### Web Research
```bash
ALLOWED_MCP_TOOLS=webmcp_search,webmcp_parse_url,webmcp_deep_search
```

### Legal Research
```bash
ALLOWED_MCP_TOOLS=legal-mcp_search_laws,legal-mcp_get_law_by_id
```

### All Tools (Default)
```bash
# ALLOWED_MCP_TOOLS=
```

## Testing

```bash
npm run test:mcp-filtering
```

## Logs

Check logs to see filtering in action:
- INFO: Shows allowed tools list
- DEBUG: Shows skipped tools

## More Info

See `docs/MCP_TOOL_FILTERING.md` for complete documentation.
