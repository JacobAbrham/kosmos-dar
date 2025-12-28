---
sidebar_position: 10
title: KOSMOS Native
description: 5 MCP servers for kosmos native operations
---

# KOSMOS Native MCP Servers

5 MCP servers in this domain (1 implemented).

:::info Auto-Generated
This documentation is automatically extracted from MCP server source code.
:::

## Server Registry

| Server | Status | Tools | Description |
|--------|--------|-------|-------------|
| `kosmos-tools` | [check]Implemented[/check] | 6 | KOSMOS Tools MCP Server |
| `kosmos-governance` | [planned]Planned[/planned] | - | Not yet implemented |
| `kosmos-memory` | [planned]Planned[/planned] | - | Not yet implemented |
| `kosmos-analytics` | [planned]Planned[/planned] | - | Not yet implemented |
| `kosmos-scheduler` | [planned]Planned[/planned] | - | Not yet implemented |

## kosmos-tools-server

KOSMOS Tools MCP Server

**Version:** 1.0.0  
**Source:** `implementation\mcp-servers\kosmos-tools\src\index.ts`

### Tools

#### `estimate_cost`

Estimate the cost of an LLM operation

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `model` | `string` | No | Model name (e.g., gpt-4o, claude-3-5-sonnet) |

#### `check_budget`

Check if a cost is within budget limits

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `tenantId` | `string` | No | Tenant ID |

#### `route_agent`

Determine which agent should handle a request

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `query` | `string` | No | User query to route |

#### `audit_log`

Log an audit event

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `eventType` | `string` | No | Type of event |

#### `get_tenant_context`

Get tenant configuration and limits

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `tenantId` | `string` | No | Tenant ID |

#### `validate_permission`

Validate if a user has permission for an action

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `userId` | `string` | No | User ID |

## Example Usage

```python
# Using kosmos-tools
result = await agent.call_mcp(
    server="kosmos-tools",
    tool="example_tool",
    params={"key": "value"}
)
```

