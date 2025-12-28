---
sidebar_position: 1
title: API Reference
---

# KOSMOS V2.0 API Reference

Complete REST API documentation for KOSMOS V2.0.

## API Overview

```mermaid
graph LR
    Client[Client] --> Gateway[API Gateway]
    Gateway --> Auth[/auth/*]
    Gateway --> Agents[/agents/*]
    Gateway --> MCP[/mcp/*]
    Gateway --> Tasks[/tasks/*]
    Gateway --> WS[WebSocket]
```

## Base URL

```
Production: https://api.nuvanta-holding.com/v2
Development: http://localhost:8000/api/v2
```

## Authentication

All API endpoints require authentication via JWT tokens:

```bash
curl -X POST https://api.nuvanta-holding.com/v2/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "..."}'
```

Response:
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

Include the token in subsequent requests:
```bash
curl https://api.nuvanta-holding.com/v2/agents \
  -H "Authorization: Bearer eyJ..."
```

## API Categories

| Category | Endpoints | Description |
|----------|-----------|-------------|
| **Authentication** | `/auth/*` | Login, logout, token refresh |
| **Agents** | `/agents/*` | Agent invocation and status |
| **Tasks** | `/tasks/*` | Task management and history |
| **MCP** | `/mcp/*` | MCP server interactions |
| **Users** | `/users/*` | User management |
| **Tenants** | `/tenants/*` | Multi-tenant operations |

## WebSocket API

Real-time updates via WebSocket:

```javascript
const ws = new WebSocket('wss://api.nuvanta-holding.com/v2/ws');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Event:', data.type, data.payload);
};
```

## Rate Limiting

| Tier | Requests/min | Burst |
|------|-------------|-------|
| Free | 60 | 10 |
| Pro | 600 | 100 |
| Enterprise | Unlimited | 1000 |

## API Documentation

:::info Auto-Generated from FastAPI
This API documentation is **automatically generated** from FastAPI's OpenAPI specification. Endpoints, schemas, and examples are extracted directly from the codebase.
:::

Browse by category:
- [Authentication](./authentication)
- [Reference](./reference)
