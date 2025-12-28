# KOSMOS V2.0 Staging Deployment Guide

> **Status**: Ready for staging deployment after Phase 1 & 2 critical fixes
> **Last Updated**: 2025-12-27
> **Version**: 2.0.0-alpha

---

## ✅ Pre-Deployment Verification

### Phase 1 & 2 Critical Fixes Completed

#### **P0 - Critical Fixes** ✅
- [x] Fixed agent initialization bug ([agents/base.py:189-191](backend/agents/base.py#L189-L191))
- [x] Added MCPTool.path property ([tool_registry.py:74-77](backend/core/tool_registry.py#L74-L77))
- [x] Created Grafana provisioning configs (infrastructure/docker/grafana/provisioning/)
- [x] Implemented workflow TODOs ([workflow_automation.py:664-741](backend/core/workflow_automation.py#L664-L741))
- [x] Added JWT authentication to chat endpoints ([api/routes/chat.py](backend/api/routes/chat.py))
- [x] Fixed duplicate code in routes/__init__.py
- [x] Externalized hardcoded secrets to .env

#### **P1 - High Priority Fixes** ✅
- [x] Fixed multi-tenancy RLS with PostgreSQL session variables
  - Enhanced TenantMiddleware ([middleware.py:17-55](backend/core/middleware.py#L17-L55))
  - Created get_db_with_tenant() dependency ([database.py:118-149](backend/core/database.py#L118-L149))
- [x] Implemented AgentBus.request_vote() for Pentarchy governance ([messaging.py:219-295](backend/core/messaging.py#L219-L295))
- [x] Setup Alembic for database migrations (backend/alembic/)
- [x] Verified all dependencies in requirements.txt (removed duplicate httpx)
- [x] Created comprehensive .env.example with 50+ documented variables

### AEOS Action Plan Alignment

All **Phases 0-5 deliverables** from AEOS-ACTION-PLAN.md are present:
- ✅ 88 MCP servers (definitions in tool_registry.py)
- ✅ Semantic router (semantic_router.py - 1312 lines)
- ✅ Intent router (intent_router.py - 561 lines)
- ✅ 11 LangGraph agents (langgraph_base.py + 11 agent files)
- ✅ SDUI framework (sdui/ directory - 5 files)
- ✅ Self-improvement (self_improvement.py)
- ✅ Workflow automation (workflow_automation.py - 908 lines)
- ✅ Multi-tenancy (multitenancy.py + middleware enhancements)
- ✅ Enterprise features (enterprise.py + auth enhancements)
- ✅ Test infrastructure (25+ test files)
- ✅ Docker configuration (6 files)
- ✅ CI/CD workflows (2+ workflows)
- ✅ Alembic migrations (NEW - Phase 2 addition)

---

## 🚀 Staging Deployment Steps

### 1. Environment Setup

#### 1.1 Copy Environment File
```bash
cd implementation
cp .env.example .env
```

#### 1.2 Configure Required Variables
Edit `.env` and set these **REQUIRED** values:

```bash
# Database (staging-specific)
POSTGRES_PASSWORD=<generate-strong-password>
DATABASE_URL=postgresql://kosmos:<password>@postgres:5432/kosmos

# Authentication
JWT_SECRET=<generate-min-32-char-random-string>
ZITADEL_MASTERKEY=<generate-32-char-string>
ZITADEL_DB_PASSWORD=<generate-strong-password>
ZITADEL_ADMIN_PASSWORD=<generate-strong-password>

# LLM Providers (at least one)
OPENAI_API_KEY=<your-openai-key>
# OR
ANTHROPIC_API_KEY=<your-anthropic-key>

# LiteLLM
LITELLM_MASTER_KEY=<generate-random-key>

# MinIO
MINIO_ROOT_PASSWORD=<generate-strong-password>
```

#### 1.3 Generate Secure Secrets
```bash
# Generate JWT secret (32+ characters)
python3 -c "import secrets; print(secrets.token_urlsafe(32))"

# Generate other secrets
python3 -c "import secrets; print(secrets.token_urlsafe(16))"
```

### 2. Infrastructure Deployment

#### 2.1 Start Core Services
```bash
# Start database, cache, message queue
docker-compose up -d postgres dragonfly nats

# Wait for services to be healthy
docker-compose ps
```

#### 2.2 Run Database Migrations
```bash
# Initialize Alembic (first time only)
cd backend
alembic stamp head

# Or create initial migration from schema
alembic revision --autogenerate -m "Initial schema"
alembic upgrade head
```

#### 2.3 Verify Database Setup
```bash
# Connect to PostgreSQL
docker exec -it kosmos-postgres psql -U kosmos -d kosmos

# Check tables and RLS policies
\dt
\d+ agents
\q
```

### 3. Application Deployment

#### 3.1 Build Application Images
```bash
# Build backend
docker-compose build backend

# Build frontend
docker-compose build frontend
```

#### 3.2 Start Application Stack
```bash
# Start all services
docker-compose up -d

# Monitor logs
docker-compose logs -f backend frontend
```

#### 3.3 Verify Services
```bash
# Check all services are running
docker-compose ps

# Expected services:
# - postgres (healthy)
# - dragonfly (healthy)
# - nats (healthy)
# - minio (healthy)
# - zitadel (running)
# - litellm (running)
# - backend (running)
# - frontend (running)
```

### 4. Health Checks

#### 4.1 Backend Health
```bash
# Check backend API
curl http://localhost:8000/health

# Expected response:
# {"status": "healthy", "version": "2.0.0-alpha"}

# Check API docs
curl http://localhost:8000/docs
# Should return OpenAPI schema
```

#### 4.2 Frontend Health
```bash
# Check frontend
curl http://localhost:3000

# Should return HTML
```

#### 4.3 Database Connectivity
```bash
# Test database connection
docker exec kosmos-backend python -c "
from core.database import check_db_connection
import asyncio
print('DB Connected:', asyncio.run(check_db_connection()))
"
```

#### 4.4 Authentication System
```bash
# Test JWT token generation
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "demo@kosmos.io", "password": "demo123"}'

# Expected: JWT tokens returned
```

#### 4.5 Intent Router
```bash
# Test semantic routing
curl -X POST http://localhost:8000/api/v1/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"message": "What is the system status?"}'

# Expected: Routed to appropriate agent
```

### 5. Functional Testing

#### 5.1 Run Backend Tests
```bash
cd backend

# Run unit tests
pytest tests/test_core/ -v

# Run API tests
pytest tests/test_api/ -v

# Run integration tests (requires services running)
pytest tests/test_integration/ -v
```

#### 5.2 Test Critical Paths

**Authentication Flow:**
```bash
# 1. Register new user
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@staging.kosmos.io",
    "password": "Test123!",
    "full_name": "Test User"
  }'

# 2. Login
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@staging.kosmos.io",
    "password": "Test123!"
  }'
# Save access_token for next requests
```

**Agent Interaction:**
```bash
# 3. Send message to KOSMOS
export TOKEN="<access_token_from_login>"

curl -X POST http://localhost:8000/api/v1/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "message": "Analyze system performance",
    "conversation_id": "test-conv-001"
  }'

# Expected: Intent routed to appropriate agent (Athena for analytics)
```

**Multi-tenancy:**
```bash
# 4. Test tenant isolation
curl -X GET http://localhost:8000/api/v1/agents \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: default"

# Should only return agents for default tenant
```

#### 5.3 Test MCP Tool Discovery
```bash
# Check tool registry
curl -X GET http://localhost:8000/api/v1/tools \
  -H "Authorization: Bearer $TOKEN"

# Expected: List of available MCP tools
```

### 6. Performance Verification

#### 6.1 Response Time Check
```bash
# Test semantic routing latency
time curl -X POST http://localhost:8000/api/v1/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"message": "hello"}'

# Target: < 200ms for simple routing
```

#### 6.2 Database Connection Pool
```bash
# Check active connections
docker exec kosmos-postgres psql -U kosmos -c "
SELECT count(*) as active_connections
FROM pg_stat_activity
WHERE datname = 'kosmos';
"

# Should be within pool limits (20 max)
```

#### 6.3 Memory Usage
```bash
# Check container memory
docker stats --no-stream kosmos-backend kosmos-frontend

# Backend should be < 1GB RAM
# Frontend should be < 512MB RAM
```

### 7. Security Verification

#### 7.1 Verify Authentication Required
```bash
# Test unauthenticated request (should fail)
curl -X POST http://localhost:8000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "test"}'

# Expected: 401 Unauthorized
```

#### 7.2 Verify RLS Enforcement
```bash
# Check PostgreSQL RLS policies are active
docker exec kosmos-postgres psql -U kosmos -d kosmos -c "
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public';
"

# Should show RLS policies on key tables
```

#### 7.3 Check for Exposed Secrets
```bash
# Verify no secrets in logs
docker-compose logs backend | grep -i "password\|secret\|key" || echo "No secrets found"

# Verify .env not in git
git ls-files | grep "\.env$" && echo "WARNING: .env in git!" || echo "OK"
```

### 8. Monitoring Setup

#### 8.1 Enable Prometheus Metrics
```bash
# Check metrics endpoint
curl http://localhost:8000/metrics

# Should return Prometheus format metrics
```

#### 8.2 Configure Grafana (if using)
```bash
# Access Grafana
open http://localhost:3001

# Default credentials: admin/admin
# Import KOSMOS dashboards from infrastructure/docker/grafana/
```

#### 8.3 Check Application Logs
```bash
# View structured logs
docker-compose logs backend | tail -50

# Look for:
# - INFO level logs
# - No ERROR/CRITICAL messages
# - Tenant context in logs
```

---

## 🔧 Troubleshooting

### Issue: Database Connection Fails
```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Check connection string
docker exec kosmos-backend python -c "from core.config import settings; print(settings.database_url)"

# Test direct connection
docker exec -it kosmos-postgres psql -U kosmos -d kosmos
```

### Issue: Authentication Fails
```bash
# Check JWT_SECRET is set
docker exec kosmos-backend python -c "import os; print('JWT_SECRET set:', bool(os.getenv('JWT_SECRET')))"

# Check auth service
docker exec kosmos-backend python -c "
from core.auth import auth_service
print('Demo user exists:', 'demo@kosmos.io' in auth_service._users)
"
```

### Issue: MCP Tools Not Available
```bash
# Check tool registry initialization
docker-compose logs backend | grep "Global Tool Registry"

# Manually trigger discovery
docker exec kosmos-backend python -c "
import asyncio
from core.tool_registry import GlobalToolRegistry
async def test():
    gtr = GlobalToolRegistry()
    await gtr.initialize()
    print('Tools discovered:', len(gtr.tools))
asyncio.run(test())
"
```

### Issue: High Memory Usage
```bash
# Restart services with resource limits
docker-compose down
docker-compose up -d --scale backend=1 --scale frontend=1

# Monitor
docker stats
```

---

## 📋 Staging Acceptance Criteria

### Must Pass Before Production:
- [ ] All health checks return 200 OK
- [ ] Authentication flow works (register → login → API call)
- [ ] Semantic routing correctly identifies intents
- [ ] Multi-tenancy RLS prevents cross-tenant data access
- [ ] No secrets exposed in logs or environment
- [ ] Database migrations run without errors
- [ ] Response times < 500ms for typical requests
- [ ] Memory usage stable over 24 hours
- [ ] No critical errors in application logs

### Performance Targets:
- [ ] Intent routing: < 100ms (95th percentile)
- [ ] API response: < 300ms (95th percentile)
- [ ] Database queries: < 50ms (95th percentile)
- [ ] WebSocket latency: < 100ms

### Security Checklist:
- [ ] All API endpoints require authentication
- [ ] JWT tokens expire correctly
- [ ] RLS policies active on all tenant-scoped tables
- [ ] CORS configured for staging frontend only
- [ ] No hardcoded secrets in codebase
- [ ] TLS/HTTPS enabled (if exposed externally)

---

## 🎯 Next Steps After Staging

1. **Monitor for 48 hours**
   - Check application logs
   - Monitor resource usage
   - Track error rates

2. **Load Testing**
   - Run k6 or Locust tests
   - Target: 100 concurrent users
   - Identify bottlenecks

3. **Security Audit**
   - Run OWASP ZAP scan
   - Check dependency vulnerabilities
   - Verify RBAC permissions

4. **User Acceptance Testing**
   - Test all major user flows
   - Verify SDUI rendering
   - Test agent responses

5. **Production Preparation**
   - Update DNS records
   - Configure CDN
   - Setup backup procedures
   - Create rollback plan

---

## 📞 Support

### Logs Location
- Backend: `docker-compose logs backend`
- Frontend: `docker-compose logs frontend`
- Database: `docker-compose logs postgres`

### Common Commands
```bash
# Restart all services
docker-compose restart

# View logs with timestamps
docker-compose logs -f --timestamps

# Check service health
docker-compose ps

# Scale services
docker-compose up -d --scale backend=2

# Clean restart
docker-compose down && docker-compose up -d
```

### Rollback Procedure
```bash
# Stop current deployment
docker-compose down

# Restore previous .env
cp .env.backup .env

# Rollback database
alembic downgrade -1

# Restart with previous version
git checkout <previous-tag>
docker-compose up -d
```

---

**Status**: ✅ Ready for staging deployment
**Blockers**: None
**Risk Level**: Low (all P0/P1 fixes completed)
