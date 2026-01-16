# MCP Server Integration Specification Template

**MCP Server Name:** [Server Name]  
**Created:** [Date]  
**Status:** Draft | Review | Approved | Implemented  
**Related ACTION_PLAN.md Tasks:** [Task references]

---

## Overview

### Server Information
- **Server ID:** `[server-id]`
- **Display Name:** [Display Name]
- **Category:** [Category name]
- **Description:** [Brief description of server's purpose]

### Source
- **Repository:** [GitHub repo URL]
- **Documentation:** [Documentation URL]
- **Version:** [Version number]

---

## Integration Details

### Transport
- **Type:** stdio | http | websocket
- **Command:** [Command to start server]
- **Args:** [Command arguments]
- **Environment Variables:** [List required env vars]

### Configuration
```python
MCPServerConfig(
    name="server-name",
    command="npx",
    args=["tsx", "src/index.ts"],
    cwd="../mcp-servers/server-name",
    category=ToolCategory.CATEGORY,
    description="Server description",
)
```

---

## Tools

### Tool List
| Tool Name | Description | Parameters | Returns |
|-----------|-------------|------------|---------|
| `tool1` | [Description] | `param1: type` | `result: type` |
| `tool2` | [Description] | `param1: type` | `result: type` |

### Tool Details

#### Tool 1: `tool1`
**Description:** [Detailed description]

**Parameters:**
```typescript
{
  param1: string;  // Parameter description
  param2?: number; // Optional parameter
}
```

**Returns:**
```typescript
{
  result: string;  // Result description
  metadata?: object;
}
```

**Example Usage:**
```python
result = await tool_registry.call_tool(
    server="server-name",
    tool="tool1",
    params={"param1": "value1"}
)
```

**Error Cases:**
- Error 1: [Description]
- Error 2: [Description]

---

## Resources

### Resource List
| Resource URI | Description | MIME Type |
|--------------|-------------|-----------|
| `resource://type/id` | [Description] | `application/json` |

### Resource Details

#### Resource 1: `resource://type/id`
**Description:** [Detailed description]

**Schema:**
```json
{
  "field1": "value",
  "field2": 123
}
```

---

## Prompts

### Prompt List
| Prompt Name | Description | Arguments |
|-------------|-------------|-----------|
| `prompt1` | [Description] | `arg1: type` |

### Prompt Details

#### Prompt 1: `prompt1`
**Description:** [Detailed description]

**Arguments:**
```typescript
{
  arg1: string;  // Argument description
}
```

**Template:**
```
[Prompt template with {{arg1}} placeholder]
```

---

## Authentication

### Required Credentials
- [ ] **API Key:** [Where to get it]
- [ ] **OAuth:** [OAuth flow description]
- [ ] **Other:** [Other auth method]

### Configuration
```bash
# Environment variables
SERVER_API_KEY=your-api-key
SERVER_CLIENT_ID=your-client-id
SERVER_CLIENT_SECRET=your-client-secret
```

---

## Error Handling

### Error Types
- **Connection Error:** [How to handle]
- **Authentication Error:** [How to handle]
- **Rate Limit Error:** [How to handle]
- **Timeout Error:** [How to handle]

### Circuit Breaker
- **Failure Threshold:** [X] failures
- **Recovery Timeout:** [X] seconds
- **Half-Open Max Calls:** [X] calls

---

## Rate Limiting

### Limits
- **Requests per minute:** [X]
- **Requests per hour:** [X]
- **Requests per day:** [X]

### Handling
- [ ] Exponential backoff
- [ ] Queue requests
- [ ] Return cached response

---

## Testing

### Unit Tests
```python
@pytest.mark.asyncio
async def test_tool1():
    """Test tool1 functionality."""
    result = await tool_registry.call_tool(
        server="server-name",
        tool="tool1",
        params={"param1": "value1"}
    )
    assert result is not None
```

### Integration Tests
- [ ] Test with real server
- [ ] Test error cases
- [ ] Test rate limiting
- [ ] Test circuit breaker

---

## Performance

### Latency Targets
- **Tool call:** < [X]ms (p95)
- **Resource fetch:** < [X]ms (p95)

### Caching
- [ ] Cacheable: Yes/No
- [ ] Cache key: [Pattern]
- [ ] TTL: [Seconds]

---

## Cost Impact

### API Costs
- **Cost per tool call:** $[Amount]
- **Cost per resource:** $[Amount]
- **Monthly estimate:** $[Amount]

### Infrastructure
- [ ] Additional compute: [Description]
- [ ] Additional storage: [Description]

---

## Security

### Input Validation
- [ ] Validate all parameters
- [ ] Sanitize user input
- [ ] Prevent injection attacks

### Output Sanitization
- [ ] Sanitize responses
- [ ] Filter sensitive data
- [ ] Validate response format

### Secrets Management
- [ ] Store credentials securely
- [ ] Rotate credentials: [Frequency]
- [ ] Audit credential access

---

## Monitoring

### Metrics
- [ ] Tool call count
- [ ] Success/failure rate
- [ ] Average latency
- [ ] Cost per call

### Logging
- [ ] Log all tool calls
- [ ] Log errors
- [ ] Log rate limit hits

### Alerts
- [ ] Failure rate > [X]%
- [ ] Latency > [X]ms
- [ ] Cost > [X] per hour

---

## Dependencies

### Internal
- [ ] Tool registry integration
- [ ] Circuit breaker integration
- [ ] Cost tracking integration

### External
- [ ] External service dependencies
- [ ] Network requirements

---

## Rollout Plan

### Phase 1: Development
- [ ] Server configuration added
- [ ] Tools discovered and registered
- [ ] Unit tests written

### Phase 2: Staging
- [ ] Deployed to staging
- [ ] Integration tests passing
- [ ] Performance validated

### Phase 3: Production
- [ ] Deployed to production
- [ ] Monitoring active
- [ ] Documentation updated

---

## Usage Examples

### Example 1: Basic Tool Call
```python
# Example code
result = await agent.call_mcp_tool(
    server="server-name",
    tool="tool1",
    params={"param1": "value1"}
)
```

### Example 2: Error Handling
```python
# Example code with error handling
try:
    result = await agent.call_mcp_tool(...)
except MCPError as e:
    logger.error("MCP call failed", error=str(e))
    # Handle error
```

---

## References

- [Server documentation]
- [Server repository]
- [Related ACTION_PLAN.md tasks]

---

**Last Updated:** [Date]  
**Updated By:** [Name]
