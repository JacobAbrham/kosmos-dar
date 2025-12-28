---
sidebar_position: 6
title: Security
description: 10 MCP servers for security operations
---

# Security MCP Servers

10 MCP servers in this domain (0 implemented).

:::info Auto-Generated
This documentation is automatically extracted from MCP server source code.
:::

## Server Registry

| Server | Status | Tools | Description |
|--------|--------|-------|-------------|
| `mcp-zitadel` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-infisical` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-falco` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-trivy` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-snyk` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-vault` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-kyverno` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-opa` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-crowdstrike` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-splunk` | [planned]Planned[/planned] | - | Not yet implemented |

## Example Usage

```python
# Using mcp-zitadel
result = await agent.call_mcp(
    server="mcp-zitadel",
    tool="example_tool",
    params={"key": "value"}
)
```

