---
sidebar_position: 5
title: DevOps & Infrastructure
description: 13 MCP servers for devops & infrastructure operations
---

# DevOps & Infrastructure MCP Servers

13 MCP servers in this domain (0 implemented).

:::info Auto-Generated
This documentation is automatically extracted from MCP server source code.
:::

## Server Registry

| Server | Status | Tools | Description |
|--------|--------|-------|-------------|
| `mcp-github` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-gitlab` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-docker` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-kubernetes` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-terraform` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-ansible` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-argocd` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-prometheus` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-grafana` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-datadog` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-pagerduty` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-opsgenie` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-nats` | [planned]Planned[/planned] | - | Not yet implemented |

## Example Usage

```python
# Using mcp-github
result = await agent.call_mcp(
    server="mcp-github",
    tool="example_tool",
    params={"key": "value"}
)
```

