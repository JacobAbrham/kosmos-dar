---
sidebar_position: 9
title: Data & ETL
description: 6 MCP servers for data & etl operations
---

# Data & ETL MCP Servers

6 MCP servers in this domain (0 implemented).

:::info Auto-Generated
This documentation is automatically extracted from MCP server source code.
:::

## Server Registry

| Server | Status | Tools | Description |
|--------|--------|-------|-------------|
| `mcp-airbyte` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-prefect` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-dagster` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-dbt` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-fivetran` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-stitch` | [planned]Planned[/planned] | - | Not yet implemented |

## Example Usage

```python
# Using mcp-airbyte
result = await agent.call_mcp(
    server="mcp-airbyte",
    tool="example_tool",
    params={"key": "value"}
)
```

