# KOSMOS DAR Security Patterns Reference

**Purpose:** Security patterns and requirements reference  
**Last Updated:** January 2026  
**Version:** 2.0

---

## Security Architecture

KOSMOS DAR implements a 6-layer defense-in-depth security architecture:

1. **Perimeter Layer:** Network security and access controls
2. **Application Layer:** Secure coding and input validation
3. **Data Layer:** Encryption and data protection
4. **Identity Layer:** Authentication and authorization
5. **Monitoring Layer:** Detection and response
6. **Governance Layer:** Policies and compliance

---

## STRIDE Threat Model

### Spoofing Threats

**S-001: User Identity Spoofing**
- **Control:** Multi-factor authentication (MFA)
- **Implementation:** Zitadel with TOTP/WebAuthn
- **Validation:** Penetration testing

**S-002: API Token Spoofing**
- **Control:** JWT validation with signature verification
- **Implementation:** RS256 algorithm with key rotation
- **Validation:** Token manipulation testing

**S-003: Service Impersonation**
- **Control:** mTLS for service-to-service communication
- **Implementation:** Certificate-based authentication
- **Validation:** Certificate validation testing

---

### Tampering Threats

**T-001: Data Tampering in Transit**
- **Control:** TLS 1.3 encryption
- **Implementation:** Enforced TLS with certificate pinning
- **Validation:** Traffic interception testing

**T-002: Database Record Tampering**
- **Control:** Row-level security (RLS) and audit logging
- **Implementation:** PostgreSQL RLS policies
- **Validation:** Database manipulation testing

**T-003: Configuration Tampering**
- **Control:** Configuration validation and integrity checking
- **Implementation:** Hash-based configuration verification
- **Validation:** Configuration modification testing

---

### Repudiation Threats

**R-001: Action Repudiation**
- **Control:** Comprehensive audit logging
- **Implementation:** All actions logged with user_id, timestamp, IP
- **Validation:** Audit log integrity testing

**R-002: Transaction Repudiation**
- **Control:** Transaction logging with digital signatures
- **Implementation:** Cryptographic signatures on transactions
- **Validation:** Signature verification testing

---

### Information Disclosure Threats

**I-001: Sensitive Data Exposure**
- **Control:** Encryption at rest and in transit
- **Implementation:** AES-256 at rest, TLS 1.3 in transit
- **Validation:** Data exposure testing

**I-002: Credential Exposure**
- **Control:** Secrets management
- **Implementation:** Infisical or environment variables
- **Validation:** Secret scanning

---

### Denial of Service Threats

**D-001: API Rate Limiting**
- **Control:** Rate limiting per user/IP
- **Implementation:** Redis-based rate limiting
- **Validation:** Load testing

**D-002: Resource Exhaustion**
- **Control:** Resource limits and quotas
- **Implementation:** Per-tenant resource limits
- **Validation:** Stress testing

---

### Elevation of Privilege Threats

**E-001: Privilege Escalation**
- **Control:** RBAC with least privilege
- **Implementation:** Role-based access control
- **Validation:** Privilege escalation testing

**E-002: Unauthorized Access**
- **Control:** Authorization checks on all endpoints
- **Implementation:** Middleware for authorization
- **Validation:** Authorization bypass testing

---

## Authentication Patterns

### Zitadel Integration
```python
# JWT token validation
from core.auth import verify_token

async def protected_route(token: str = Depends(get_token)):
    user = await verify_token(token)
    return user
```

### MFA Implementation
- **TOTP:** Time-based one-time passwords
- **WebAuthn:** Hardware security keys
- **Backup Codes:** Recovery codes for account access

### Session Management
- JWT tokens with expiration
- Refresh token rotation
- Token revocation on logout

---

## Authorization Patterns

### RBAC Model
```python
# Role-based access control
class Role(str, Enum):
    ADMIN = "admin"
    USER = "user"
    VIEWER = "viewer"

# Permission checks
@require_permission("agents:create")
async def create_agent(...):
    pass
```

### Row-Level Security (RLS)
```sql
-- PostgreSQL RLS policy
CREATE POLICY tenant_isolation ON documents
    USING (tenant_id = current_setting('app.current_tenant')::uuid);
```

### Multi-Tenant Isolation
- Database-level isolation via RLS
- Application-level tenant context
- Network-level isolation (future)

---

## Input Validation Patterns

### Pydantic Models
```python
from pydantic import BaseModel, Field, field_validator

class RequestModel(BaseModel):
    field1: str = Field(..., min_length=1, max_length=100)
    field2: int = Field(..., ge=0, le=100)
    
    @field_validator('field1')
    def validate_field1(cls, v):
        # Custom validation
        if not v.isalnum():
            raise ValueError("Must be alphanumeric")
        return v
```

### SQL Injection Prevention
- Always use parameterized queries
- Never use string concatenation
- Validate input before database operations

### XSS Prevention
- Sanitize all user input
- Use React's built-in XSS protection
- Content Security Policy (CSP) headers

---

## Secrets Management

### Environment Variables
```bash
# Never commit secrets
KOSMOS_DATABASE_URL=postgresql://...
KOSMOS_SECRET_KEY=...
ANTHROPIC_API_KEY=...
```

### Secrets Manager (Infisical)
```python
from infisical import InfisicalClient

client = InfisicalClient()
secret = client.get_secret("DATABASE_URL")
```

### Secret Rotation
- Rotate secrets every 30-90 days
- Use secret versioning
- Audit secret access

---

## Encryption

### Encryption at Rest
- **Database:** PostgreSQL encryption
- **Files:** MinIO server-side encryption
- **Backups:** Encrypted backups

### Encryption in Transit
- **TLS 1.3:** All API communications
- **mTLS:** Service-to-service (future)
- **Certificate Pinning:** Mobile apps (future)

---

## Audit Logging

### Audit Events
- Authentication events (login, logout, MFA)
- Authorization events (permission checks)
- Data access events (read, write, delete)
- Configuration changes
- Security events (failed auth, rate limits)

### Audit Log Storage
```sql
CREATE TABLE audit.events (
    id UUID PRIMARY KEY,
    event_type VARCHAR(50),
    user_id UUID,
    tenant_id UUID,
    resource_type VARCHAR(50),
    resource_id UUID,
    action VARCHAR(50),
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);
```

### Log Retention
- **Active Logs:** 90 days
- **Archived Logs:** 7 years (compliance)
- **Security Events:** Indefinite

---

## Rate Limiting

### Implementation
```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@router.post("/api/endpoint")
@limiter.limit("10/minute")
async def endpoint(...):
    pass
```

### Rate Limits
- **API Endpoints:** 100 requests/minute per user
- **Authentication:** 5 attempts/minute per IP
- **Agent Execution:** 10 workflows/minute per user
- **Tool Calls:** 1000 calls/minute per tenant

---

## Security Headers

### Required Headers
```python
@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000"
    response.headers["Content-Security-Policy"] = "default-src 'self'"
    return response
```

---

## Prompt Injection Prevention

### Input Sanitization
```python
def sanitize_prompt(user_input: str) -> str:
    # Remove control characters
    sanitized = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', user_input)
    # Limit length
    sanitized = sanitized[:10000]
    # Separate user content from system instructions
    return f"<user_content>{sanitized}</user_content>"
```

### Boundary Markers
- Clear separation between user content and system instructions
- Use XML-like tags: `<user_content>` and `</user_content>`
- Validate prompt structure before sending to LLM

---

## MCP Security

### Server Authentication
- OAuth 2.1+ for MCP server authentication
- API keys stored securely
- Credential rotation

### Container Security
- All MCP servers run in Docker containers
- Resource limits applied
- Network isolation
- Read-only filesystems where possible

### Tool Poisoning Prevention
- Validate tool definitions before registration
- Monitor tool definition changes
- Alert on unexpected tool behavior

---

## Compliance

### GDPR
- Right to access
- Right to deletion (Amnesia protocol)
- Data portability
- Consent management

### CCPA
- Consumer data access
- Deletion requests
- Opt-out mechanisms

### UAE PDPL
- Data localization
- Consent requirements
- Breach notification

---

## Security Checklist

### Development
- [ ] No secrets in code
- [ ] Input validation on all endpoints
- [ ] Parameterized queries (no SQL injection)
- [ ] Output sanitization (prevent XSS)
- [ ] Rate limiting on public endpoints
- [ ] Audit logging for sensitive operations

### Deployment
- [ ] TLS 1.3 enabled
- [ ] Security headers configured
- [ ] Secrets in secrets manager
- [ ] Database encryption enabled
- [ ] Backup encryption enabled
- [ ] Monitoring and alerting active

---

## Related Documentation

- **Security Guide:** `docs/SECURITY-IMPLEMENTATION-GUIDE.md`
- **STRIDE Model:** `docs/SECURITY-IMPLEMENTATION-GUIDE.md`
- **Compliance:** `docs/ENTERPRISE-GOVERNANCE.md`

---

**Remember:** Security is everyone's responsibility. Always validate input, sanitize output, and log security events.
