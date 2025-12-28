---
sidebar_position: 2
title: Database & Storage
description: 12 MCP servers for database & storage operations
---

# Database & Storage MCP Servers

12 MCP servers in this domain (0 implemented).

:::info Auto-Generated
This documentation is automatically extracted from MCP server source code.
:::

## Server Registry

| Server | Status | Tools | Description |
|--------|--------|-------|-------------|
| `mcp-postgresql` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-vector` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-redis` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-minio` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-elasticsearch` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-neo4j` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-timescale` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-duckdb` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-sqlite` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-mongodb` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-qdrant` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-weaviate` | [planned]Planned[/planned] | - | Not yet implemented |

## Example Usage

```python
# Using mcp-postgresql
result = await agent.call_mcp(
    server="mcp-postgresql",
    tool="example_tool",
    params={"key": "value"}
)
```

