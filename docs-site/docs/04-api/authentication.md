---
sidebar_position: 2
title: Authentication
description: API authentication and authorization guide for KOSMOS V2.0
---

# API Authentication

KOSMOS V2.0 uses **Zitadel** for identity management with JWT-based authentication.

## Authentication Flow

```mermaid
sequenceDiagram
    participant Client
    participant Zitadel
    participant API
    participant AEGIS

    Client->>Zitadel: Login (username/password or SSO)
    Zitadel-->>Client: Access Token + Refresh Token

    Client->>API: Request + Bearer Token
    API->>Zitadel: Validate Token
    Zitadel-->>API: Token Valid + Claims

    API->>AEGIS: Authorize Request
    AEGIS-->>API: Authorized

    API-->>Client: Response
```

## Authentication Methods

### 1. OAuth 2.0 / OIDC (Recommended)

For web and mobile applications:

```typescript
// Frontend: Initiate OAuth flow
const authUrl = `${ZITADEL_URL}/oauth/v2/authorize?` +
  `client_id=${CLIENT_ID}&` +
  `redirect_uri=${REDIRECT_URI}&` +
  `response_type=code&` +
  `scope=openid profile email&` +
  `code_challenge=${codeChallenge}&` +
  `code_challenge_method=S256`;

window.location.href = authUrl;
```

```typescript
// Exchange code for tokens
const response = await fetch(`${ZITADEL_URL}/oauth/v2/token`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    code: authCode,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    code_verifier: codeVerifier,
  }),
});

const { access_token, refresh_token, expires_in } = await response.json();
```

### 2. API Keys (Machine-to-Machine)

For service accounts and integrations:

```bash
# Generate API key in Zitadel console or via API
curl -X POST "${ZITADEL_URL}/management/v1/users/${USER_ID}/machine_keys" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "KEY_TYPE_JSON",
    "expirationDate": "2025-12-31T23:59:59Z"
  }'
```

```python
# Use API key to get access token
import jwt
import time
import requests

# Create JWT assertion
now = int(time.time())
payload = {
    "iss": SERVICE_USER_ID,
    "sub": SERVICE_USER_ID,
    "aud": ZITADEL_URL,
    "iat": now,
    "exp": now + 3600,
}
assertion = jwt.encode(payload, PRIVATE_KEY, algorithm="RS256")

# Exchange for access token
response = requests.post(
    f"{ZITADEL_URL}/oauth/v2/token",
    data={
        "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
        "assertion": assertion,
        "scope": "openid profile",
    }
)
access_token = response.json()["access_token"]
```

### 3. Personal Access Tokens (Development)

For local development and testing:

```bash
# Create PAT in Zitadel user settings
# Then use directly as Bearer token

curl -X GET "https://api.nuvanta-holding.com/api/v1/conversations" \
  -H "Authorization: Bearer ${PERSONAL_ACCESS_TOKEN}"
```

## Making Authenticated Requests

### Headers

```http
GET /api/v1/conversations HTTP/1.1
Host: api.nuvanta-holding.com
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
X-Request-ID: uuid-for-tracing
```

### Python SDK

```python
from kosmos import KosmosClient

client = KosmosClient(
    base_url="https://api.nuvanta-holding.com",
    access_token=os.environ["KOSMOS_ACCESS_TOKEN"],
)

# All requests are automatically authenticated
conversations = client.conversations.list()
```

### JavaScript/TypeScript

```typescript
import { KosmosClient } from '@kosmos/sdk';

const client = new KosmosClient({
  baseUrl: 'https://api.nuvanta-holding.com',
  accessToken: process.env.KOSMOS_ACCESS_TOKEN,
});

const conversations = await client.conversations.list();
```

## Token Management

### Token Refresh

Access tokens expire after 1 hour. Use refresh tokens to get new access tokens:

```typescript
async function refreshAccessToken(refreshToken: string): Promise<string> {
  const response = await fetch(`${ZITADEL_URL}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
    }),
  });

  const { access_token, refresh_token: newRefreshToken } = await response.json();

  // Store new refresh token
  await storeRefreshToken(newRefreshToken);

  return access_token;
}
```

### Token Introspection

Validate tokens server-side:

```python
def validate_token(token: str) -> dict:
    response = requests.post(
        f"{ZITADEL_URL}/oauth/v2/introspect",
        auth=(CLIENT_ID, CLIENT_SECRET),
        data={"token": token},
    )

    result = response.json()
    if not result.get("active"):
        raise AuthenticationError("Token is invalid or expired")

    return result
```

## Role-Based Access Control (RBAC)

### Roles

| Role | Permissions |
|------|-------------|
| `admin` | Full system access |
| `operator` | Manage agents, view all data |
| `analyst` | View analytics, run reports |
| `user` | Standard user access |
| `readonly` | Read-only access |

### Checking Permissions

```python
from fastapi import Depends, HTTPException
from kosmos.auth import get_current_user, require_role

@app.get("/api/v1/admin/users")
async def list_users(user = Depends(require_role("admin"))):
    return await user_service.list_all()

@app.get("/api/v1/conversations")
async def list_conversations(user = Depends(get_current_user)):
    # User can only see their own conversations
    return await conversation_service.list_for_user(user.id)
```

### JWT Claims

```json
{
  "sub": "user-id-123",
  "email": "user@company.com",
  "name": "John Doe",
  "roles": ["user", "analyst"],
  "org_id": "org-456",
  "permissions": [
    "conversations:read",
    "conversations:write",
    "analytics:read"
  ],
  "iat": 1703520000,
  "exp": 1703523600
}
```

## Security Best Practices

### Do

- Store tokens securely (HttpOnly cookies, secure storage)
- Use HTTPS for all requests
- Implement token refresh before expiration
- Include `X-Request-ID` for tracing
- Validate tokens on every request

### Don't

- Store tokens in localStorage (XSS vulnerable)
- Include tokens in URLs
- Log tokens or sensitive data
- Share tokens between users
- Use long-lived access tokens

## Error Responses

| Status | Error | Description |
|--------|-------|-------------|
| `401` | `unauthorized` | Missing or invalid token |
| `403` | `forbidden` | Valid token but insufficient permissions |
| `429` | `rate_limited` | Too many requests |

```json
{
  "error": "unauthorized",
  "message": "Token has expired",
  "code": "TOKEN_EXPIRED",
  "request_id": "req-123-456"
}
```

## Configuration

### Environment Variables

```bash
# Zitadel Configuration
ZITADEL_URL=https://auth.nuvanta-holding.com
ZITADEL_CLIENT_ID=kosmos-api
ZITADEL_CLIENT_SECRET=${secret}

# Token Settings
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=30

# API Keys
API_KEY_PREFIX=kos_
```
