---
sidebar_position: 7
title: Finance & Analytics
description: 6 MCP servers for finance & analytics operations
---

# Finance & Analytics MCP Servers

6 MCP servers in this domain (0 implemented).

:::info Auto-Generated
This documentation is automatically extracted from MCP server source code.
:::

## Server Registry

| Server | Status | Tools | Description |
|--------|--------|-------|-------------|
| `mcp-quickbooks` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-xero` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-stripe` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-plaid` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-alpaca` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-polygon` | [planned]Planned[/planned] | - | Not yet implemented |

## Example Usage

```python
# Using mcp-quickbooks
result = await agent.call_mcp(
    server="mcp-quickbooks",
    tool="example_tool",
    params={"key": "value"}
)
```

