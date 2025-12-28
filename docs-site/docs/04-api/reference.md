---
sidebar_position: 1
title: API Reference
description: AI-Native Enterprise Operating System API
---

# API Reference

AI-Native Enterprise Operating System API

**Version:** 2.0.0
**Base URL:** `https://api.kosmos.nuvanta-holding.com`

:::info Auto-Generated
This documentation is automatically extracted from the OpenAPI schema.
:::

## Authentication

All API requests require authentication using JWT tokens from Zitadel:

```bash
curl -X GET "https://api.kosmos.nuvanta-holding.com/api/v1/agents" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Agents

### `GET /api/v1/agents`

**List agents**

Get status of all 11 KOSMOS agents.

**Responses:**

| Status | Description |
|--------|-------------|
| `200` | List of agent statuses |

### `GET /api/v1/agents/{id}`

**Get agent status**

Get detailed status of a specific agent.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|----|----------|-------------|
| `id` | path | `string` | Yes | Agent ID (e.g., zeus, athena) |

**Responses:**

| Status | Description |
|--------|-------------|
| `200` | Agent status |

### `GET /api/v1/agents/{id}/metrics`

**Get agent metrics**

Get performance metrics for an agent.

**Responses:**

| Status | Description |
|--------|-------------|
| `200` | Agent metrics |

## Chat

### `POST /api/v1/chat`

**Send a message to KOSMOS**

Sends a user message and receives AI responses from the agent network.

**Request Body:**

```json
{
  "message": <string>,
  "conversation_id": <string>,
  "context": <object>,
}
```

**Responses:**

| Status | Description |
|--------|-------------|
| `200` | Successful response |
| `401` | Unauthorized |
| `429` | Rate limited |

### `POST /api/v1/chat/stream`

**Stream chat response**

Stream AI responses using Server-Sent Events.

**Responses:**

| Status | Description |
|--------|-------------|
| `200` | SSE stream |

## Conversations

### `GET /api/v1/conversations`

**List conversations**

Get paginated list of user conversations.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|----|----------|-------------|
| `page` | query | `integer` | No | Page number |
| `limit` | query | `integer` | No | Items per page |

**Responses:**

| Status | Description |
|--------|-------------|
| `200` | List of conversations |

### `POST /api/v1/conversations`

**Create conversation**

Start a new conversation.

**Responses:**

| Status | Description |
|--------|-------------|
| `201` | Conversation created |

### `GET /api/v1/conversations/{id}`

**Get conversation**

Get conversation details and messages.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|----|----------|-------------|
| `id` | path | `string` | Yes | Conversation UUID |

**Responses:**

| Status | Description |
|--------|-------------|
| `200` | Conversation details |
| `404` | Not found |

### `DELETE /api/v1/conversations/{id}`

**Delete conversation**

Archive a conversation.

**Responses:**

| Status | Description |
|--------|-------------|
| `204` | Deleted |

## Costs

### `GET /api/v1/costs/usage`

**Get usage costs**

Get cost breakdown for current period.

**Responses:**

| Status | Description |
|--------|-------------|
| `200` | Cost breakdown |

### `GET /api/v1/costs/limits`

**Get cost limits**

Get configured cost limits.

**Responses:**

| Status | Description |
|--------|-------------|
| `200` | Cost limits |

## Governance

### `GET /api/v1/governance/proposals`

**List proposals**

Get list of governance proposals.

**Responses:**

| Status | Description |
|--------|-------------|
| `200` | List of proposals |

### `POST /api/v1/governance/proposals/{id}/vote`

**Cast vote**

Cast a Pentarchy vote on a proposal.

**Responses:**

| Status | Description |
|--------|-------------|
| `200` | Vote recorded |

## Knowledge

### `GET /api/v1/knowledge/documents`

**List documents**

Get indexed documents.

**Responses:**

| Status | Description |
|--------|-------------|
| `200` | Document list |

### `POST /api/v1/knowledge/documents`

**Upload document**

Upload and index a new document.

**Responses:**

| Status | Description |
|--------|-------------|
| `201` | Document indexed |

### `POST /api/v1/knowledge/search`

**Search knowledge base**

Semantic search across documents and memories.

**Request Body:**

```json
{
  "query": <string>,
  "limit": <integer>,
  "filters": <object>,
  "include_memories": <boolean>,
}
```

**Responses:**

| Status | Description |
|--------|-------------|
| `200` | Search results |

## MCP

### `GET /api/v1/mcp/servers`

**List MCP servers**

Get connected MCP servers.

**Responses:**

| Status | Description |
|--------|-------------|
| `200` | Server list |

### `GET /api/v1/mcp/{server}/tools`

**List MCP tools**

Get available tools from an MCP server.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|----|----------|-------------|
| `server` | path | `string` | Yes | MCP server name |

**Responses:**

| Status | Description |
|--------|-------------|
| `200` | List of tools |

### `POST /api/v1/mcp/{server}/call`

**Call MCP tool**

Execute a tool on an MCP server.

**Responses:**

| Status | Description |
|--------|-------------|
| `200` | Tool result |

## Memory

### `GET /api/v1/memory/entities`

**List memory entities**

Get entities from knowledge graph.

**Responses:**

| Status | Description |
|--------|-------------|
| `200` | Entity list |

### `GET /api/v1/memory/relations`

**List relations**

Get relations between entities.

**Responses:**

| Status | Description |
|--------|-------------|
| `200` | Relation list |

## System

### `GET /health`

**Health check**

Check API health status.

**Responses:**

| Status | Description |
|--------|-------------|
| `200` | Healthy |

### `GET /ready`

**Readiness check**

Check if API is ready to serve requests.

**Responses:**

| Status | Description |
|--------|-------------|
| `200` | Ready |

### `GET /metrics`

**Prometheus metrics**

Get Prometheus-formatted metrics.

**Responses:**

| Status | Description |
|--------|-------------|
| `200` | Metrics |

## Data Models

### ChatRequest

Request to send a chat message

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | `string` | Yes | User message content |
| `conversation_id` | `string` | No | Optional existing conversation ID |
| `context` | `object` | No | Additional context for the request |

### ChatResponse

Response from KOSMOS agents

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | No | Message ID |
| `conversation_id` | `string` | No | Conversation ID |
| `content` | `string` | No | Agent response |
| `agent_id` | `string` | No | Responding agent |
| `tool_calls` | `array` | No | Tools used |
| `cost_usd` | `number` | No | Request cost |

### SearchRequest

Semantic search request

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | `string` | Yes | Search query |
| `limit` | `integer` | No | Max results |
| `filters` | `object` | No | Optional filters |
| `include_memories` | `boolean` | No | Include memory entities |

### AgentStatus

Agent status information

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | No | Agent ID |
| `name` | `string` | No | Agent name |
| `domain` | `string` | No | Agent domain |
| `state` | `string` | No | Current state |
| `metrics` | `object` | No | Performance metrics |

### Proposal

Governance proposal

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | No | Proposal ID |
| `action` | `string` | No | Proposed action |
| `estimated_cost` | `number` | No | Estimated cost |
| `status` | `string` | No | Proposal status |
| `votes` | `array` | No | Votes cast |

## Rate Limiting

KOSMOS API implements rate limiting to ensure fair usage:

| Tier | Requests/min | Burst |
|------|-------------|-------|
| Free | 60 | 10 |
| Pro | 300 | 50 |
| Enterprise | 1000 | 200 |

Rate limit headers are included in all responses:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1640995200
```

## Error Handling

All errors follow a consistent format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "field": "message",
      "reason": "Required field missing"
    }
  }
}
```

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 422 | Invalid request data |
| `RATE_LIMITED` | 429 | Too many requests |
| `COST_EXCEEDED` | 402 | Cost limit exceeded |
| `INTERNAL_ERROR` | 500 | Server error |

## Webhooks

KOSMOS supports webhooks for async notifications:

```json
{
  "event": "conversation.completed",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "conversation_id": "uuid",
    "total_cost": 0.05
  }
}
```

## SDKs

Official SDKs are available:

- **Python:** `pip install kosmos-sdk`
- **TypeScript:** `npm install @kosmos/sdk`
- **Go:** `go get github.com/nuvanta/kosmos-go`

