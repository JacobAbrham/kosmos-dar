# KOSMOS API Reference

> Version 2.0 | Last Updated: January 2026

## Base URL

| Environment | URL |
|-------------|-----|
| Development | `http://localhost:8000` |
| Staging | `https://staging-api.kosmos.nuvanta-holding.com` |
| Production | `https://api.kosmos.nuvanta-holding.com` |

## Authentication

All API endpoints (except health checks) require authentication via JWT Bearer token.

```http
Authorization: Bearer <access_token>
```

### Obtain Access Token

```http
POST /api/v1/auth/token
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "your-password"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

## API Endpoints

### Health & Status

#### Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "version": "2.0.0-alpha",
  "service": "kosmos-backend"
}
```

#### Readiness Check
```http
GET /ready
```

**Response:**
```json
{
  "ready": true,
  "checks": {
    "database": true,
    "cache": true,
    "messaging": true
  }
}
```

---

### Conversations

#### Create Conversation
```http
POST /api/v1/conversations
Content-Type: application/json

{
  "title": "New Conversation",
  "metadata": {}
}
```

#### List Conversations
```http
GET /api/v1/conversations?limit=20&offset=0
```

#### Get Conversation
```http
GET /api/v1/conversations/{conversation_id}
```

#### Send Message
```http
POST /api/v1/conversations/{conversation_id}/messages
Content-Type: application/json

{
  "content": "Your message here",
  "attachments": []
}
```

---

### Agents

#### List Available Agents
```http
GET /api/v1/agents
```

**Response:**
```json
{
  "agents": [
    {
      "id": "zeus",
      "name": "Zeus",
      "description": "Master orchestrator agent",
      "status": "active"
    },
    {
      "id": "apollo",
      "name": "Apollo",
      "description": "Analytics and insights agent",
      "status": "active"
    }
  ]
}
```

#### Get Agent Status
```http
GET /api/v1/agents/{agent_id}/status
```

---

### Tools (MCP)

#### List Available Tools
```http
GET /api/v1/tools
```

#### Execute Tool
```http
POST /api/v1/tools/{tool_id}/execute
Content-Type: application/json

{
  "parameters": {
    "key": "value"
  }
}
```

---

## WebSocket API

### Connect
```
ws://localhost:8000/ws?token=<access_token>
```

### Message Types

#### Client → Server
```json
{
  "type": "message",
  "conversation_id": "uuid",
  "content": "User message"
}
```

#### Server → Client
```json
{
  "type": "agent_response",
  "conversation_id": "uuid",
  "agent_id": "zeus",
  "content": "Agent response",
  "sdui_components": []
}
```

---

## Error Responses

All errors follow a standard format:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": [
      {
        "field": "email",
        "issue": "Invalid format"
      }
    ]
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request parameters |
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Rate Limiting

- **Default**: 60 requests per minute
- **Burst**: Up to 10 requests per second
- Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

---

## Pagination

List endpoints support pagination:

```http
GET /api/v1/conversations?limit=20&offset=0
```

**Response includes:**
```json
{
  "items": [...],
  "total": 100,
  "limit": 20,
  "offset": 0,
  "has_more": true
}
```
