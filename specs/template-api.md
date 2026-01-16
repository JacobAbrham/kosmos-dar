# API Endpoint Specification Template

**Endpoint Name:** [Endpoint Name]  
**Created:** [Date]  
**Status:** Draft | Review | Approved | Implemented  
**Related ACTION_PLAN.md Tasks:** [Task references]

---

## Overview

### Endpoint
```
[HTTP Method] /api/[path]
```

### Description
[Brief description of what this endpoint does]

### Use Cases
- Use case 1: [Description]
- Use case 2: [Description]

---

## Request

### Headers
```
Authorization: Bearer <token>
Content-Type: application/json
```

### Path Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Resource identifier |

### Query Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | integer | No | 1 | Page number |
| `limit` | integer | No | 20 | Items per page |

### Request Body
```json
{
  "field1": "value1",
  "field2": 123
}
```

### Request Schema
```python
class RequestModel(BaseModel):
    field1: str = Field(..., description="Field description")
    field2: int = Field(default=0, ge=0, description="Field description")
```

---

## Response

### Success Response (200 OK)
```json
{
  "data": {
    "id": "uuid",
    "field1": "value1",
    "field2": 123
  },
  "meta": {
    "timestamp": "2026-01-01T00:00:00Z"
  }
}
```

### Error Responses

#### 400 Bad Request
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": {
      "field1": ["Field is required"]
    }
  }
}
```

#### 401 Unauthorized
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

#### 404 Not Found
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Resource not found"
  }
}
```

#### 429 Too Many Requests
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded",
    "retry_after": 60
  }
}
```

---

## Implementation Details

### Route Handler
```python
@router.post("/api/endpoint")
async def endpoint_handler(
    request: RequestModel,
    current_user: User = Depends(get_current_user)
) -> ResponseModel:
    """Endpoint handler implementation."""
    # Implementation
    return ResponseModel(...)
```

### Service Layer
```python
class EndpointService:
    async def process_request(self, request: RequestModel) -> ResponseModel:
        """Process request logic."""
        # Implementation
        pass
```

### Database Queries
```sql
-- Example query
SELECT * FROM table WHERE id = :id;
```

---

## Security

### Authentication
- [ ] Required: Yes/No
- [ ] Token type: JWT
- [ ] Scopes: [List scopes]

### Authorization
- [ ] Permission required: [Permission name]
- [ ] Role required: [Role name]
- [ ] Tenant isolation: Yes/No

### Input Validation
- [ ] Pydantic model validation
- [ ] Custom validators: [List]
- [ ] Sanitization: [Description]

### Rate Limiting
- [ ] Enabled: Yes/No
- [ ] Limit: [X] requests per [time period]
- [ ] Per user/IP: [Which]

---

## Performance

### Caching
- [ ] Cacheable: Yes/No
- [ ] Cache key: [Pattern]
- [ ] TTL: [Seconds]
- [ ] Cache invalidation: [Strategy]

### Database Optimization
- [ ] Indexes: [List indexes]
- [ ] Query optimization: [Notes]
- [ ] Connection pooling: Yes/No

### Response Time Target
- **P50:** < [X]ms
- **P95:** < [X]ms
- **P99:** < [X]ms

---

## Testing

### Unit Tests
```python
@pytest.mark.asyncio
async def test_endpoint_success():
    """Test successful request."""
    # Test implementation
    pass
```

### Integration Tests
- [ ] Test with database
- [ ] Test with authentication
- [ ] Test error cases

### Load Tests
- [ ] Target: [X] requests/second
- [ ] Duration: [X] minutes
- [ ] Expected latency: < [X]ms

---

## Monitoring

### Metrics
- [ ] Request count
- [ ] Error rate
- [ ] Latency (p50, p95, p99)
- [ ] Cost per request

### Logging
- [ ] Log level: INFO/DEBUG
- [ ] Log fields: [List]
- [ ] Audit log: Yes/No

### Alerts
- [ ] Error rate > [X]%
- [ ] Latency > [X]ms
- [ ] Cost > [X] per hour

---

## Cost Impact

### LLM Usage
- **Tokens per request:** [Estimate]
- **Cost per request:** $[Estimate]
- **Model used:** [Model name]

### Infrastructure
- **Database queries:** [Count]
- **Cache hits:** [Percentage]
- **External API calls:** [Count]

---

## Documentation

### OpenAPI Schema
- [ ] Schema defined
- [ ] Examples included
- [ ] Error responses documented

### User Documentation
- [ ] Usage examples
- [ ] Common use cases
- [ ] Troubleshooting guide

---

## Dependencies

### Internal
- [ ] Service dependency 1
- [ ] Service dependency 2

### External
- [ ] MCP server: [Server name]
- [ ] External API: [API name]

---

## Rollout Plan

### Phase 1: Development
- [ ] Implementation complete
- [ ] Unit tests passing
- [ ] Integration tests passing

### Phase 2: Staging
- [ ] Deployed to staging
- [ ] Load testing complete
- [ ] Documentation reviewed

### Phase 3: Production
- [ ] Deployed to production
- [ ] Monitoring active
- [ ] Documentation published

---

## References

- [Related API documentation]
- [Related endpoints]
- [Related ACTION_PLAN.md tasks]

---

**Last Updated:** [Date]  
**Updated By:** [Name]
