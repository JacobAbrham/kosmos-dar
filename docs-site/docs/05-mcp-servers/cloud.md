---
sidebar_position: 8
title: Cloud Providers
description: 6 MCP servers for cloud providers operations
---

# Cloud Providers MCP Servers

6 MCP servers in this domain (0 implemented).

:::info Auto-Generated
This documentation is automatically extracted from MCP server source code.
:::

## Server Registry

| Server | Status | Tools | Description |
|--------|--------|-------|-------------|
| `mcp-aws` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-azure` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-gcp` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-alicloud` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-cloudflare` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-vercel` | [planned]Planned[/planned] | - | Not yet implemented |

## Example Usage

```python
# Using mcp-aws
result = await agent.call_mcp(
    server="mcp-aws",
    tool="example_tool",
    params={"key": "value"}
)
```

