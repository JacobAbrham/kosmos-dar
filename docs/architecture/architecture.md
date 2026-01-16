# KOSMOS DAR Architecture Reference

**Purpose:** System architecture reference for AI assistants and developers  
**Last Updated:** January 2026  
**Version:** 2.0

---

## System Overview

KOSMOS DAR is an AI-native enterprise operating system built on a microservices architecture with FastAPI backend and Next.js 14 frontend.

### Core Principles
- **AI-First:** All interactions go through AI agents
- **Intent-Driven:** Users express intent, system handles execution
- **Multi-Tenant:** Complete tenant isolation via PostgreSQL RLS
- **Event-Driven:** NATS messaging for inter-service communication
- **Observable:** Comprehensive logging, metrics, and tracing

---

## Architecture Layers

### Frontend Layer (Next.js 14)
- **Location:** `implementation/frontend/`
- **Technology Stack:**
  - Next.js 14 App Router with Server Components
  - React 18 with TypeScript
  - Zustand for global workspace state
  - Jotai for real-time interdependent state
  - Tailwind CSS + Radix UI components
  - WebSocket for real-time updates

### Backend Layer (FastAPI)
- **Location:** `implementation/backend/`
- **Technology Stack:**
  - FastAPI with async/await
  - LangGraph for agent orchestration
  - SQLAlchemy (async) for database
  - NATS for messaging
  - Redis/Dragonfly for caching
  - Langfuse for LLM observability

### Data Layer
- **PostgreSQL 16:** Primary database with pgvector extension
- **Redis/Dragonfly:** Cache and session storage
- **Qdrant:** Vector database for semantic memory
- **MinIO:** Object storage for files

### Agent Layer
- **Framework:** LangGraph with checkpointing
- **Base Class:** `LangGraphAgent` in `langgraph_base.py`
- **State Management:** LangGraph StateGraph with persistence
- **Tool Integration:** MCP servers via GlobalToolRegistry

---

## Data Flow

```
User Input (Frontend)
    ↓
Intent Capture (UII)
    ↓
Intent Router (Backend)
    ↓
Zeus Agent (Orchestrator)
    ↓
Specialized Agent(s)
    ↓
MCP Tool Execution
    ↓
Response Synthesis
    ↓
SDUI Component Generation
    ↓
Real-time Update (WebSocket)
    ↓
Frontend Rendering
```

---

## Key Components

### Intent Router
- **Location:** `implementation/backend/core/intent_router.py`
- **Purpose:** Classify user intent and route to appropriate agent
- **Method:** Semantic similarity + rule-based classification

### Global Tool Registry
- **Location:** `implementation/backend/core/tool_registry.py`
- **Purpose:** Dynamic MCP tool discovery and management
- **Features:** Circuit breakers, health checks, tool categorization

### Semantic Router
- **Location:** `implementation/backend/core/semantic_router.py`
- **Purpose:** Route requests based on semantic similarity
- **Method:** Vector embeddings + similarity search

### Circuit Breaker
- **Location:** `implementation/backend/core/circuit_breaker.py`
- **Purpose:** Prevent cascade failures in MCP calls
- **Pattern:** Open/Closed/Half-Open states with exponential backoff

---

## Database Architecture

### Schemas
- **core:** Tenants, users, conversations
- **agents:** Agent definitions, sessions, checkpoints
- **governance:** Policies, approvals, cost tracking
- **knowledge:** Documents, embeddings, RAG
- **metrics:** Analytics, usage, performance
- **audit:** Comprehensive audit logs
- **mcp:** MCP server registry and tool invocations

### Multi-Tenancy
- **Row-Level Security (RLS):** Tenant isolation at database level
- **Policy Pattern:** `tenant_id = current_setting('app.current_tenant')::uuid`
- **Connection Pooling:** Per-tenant connection pools

---

## Messaging Architecture

### NATS
- **Purpose:** Inter-agent communication and event streaming
- **Patterns:** Pub/Sub, Request/Reply, JetStream for durability
- **Topics:** `agent.{agent_id}.{event_type}`

### WebSocket
- **Purpose:** Real-time updates to frontend
- **Pattern:** Room-based messaging for multi-tenant isolation
- **Events:** Agent status, tool execution, cost updates

---

## Security Architecture

### Authentication
- **Provider:** Zitadel (OIDC/OAuth 2.0)
- **Tokens:** JWT with RS256 algorithm
- **MFA:** TOTP and WebAuthn support

### Authorization
- **Model:** RBAC with row-level security
- **Enforcement:** Database RLS + application-level checks
- **Governance:** Pentarchy voting for high-stakes decisions

### Encryption
- **In Transit:** TLS 1.3
- **At Rest:** AES-256
- **Secrets:** Infisical or environment variables

---

## Deployment Architecture

### Environments
- **Development:** Local Docker Compose
- **Staging:** GitHub Codespaces
- **Production:** Alibaba Cloud (Kubernetes)

### Services
- **Frontend:** Next.js application (port 3000)
- **Backend:** FastAPI application (port 8000)
- **PostgreSQL:** Database (port 5432)
- **Redis/Dragonfly:** Cache (port 6379)
- **NATS:** Messaging (port 4222)
- **Langfuse:** Observability (port 3001)
- **Prometheus:** Metrics (port 9090)
- **Grafana:** Dashboards (port 3001)

---

## Performance Considerations

### Caching Strategy
- **Exact Cache:** Redis with prompt hash keys
- **Semantic Cache:** Qdrant vector similarity
- **Context Cache:** Anthropic 5-min TTL

### Database Optimization
- **Connection Pooling:** AsyncPG with pool size 20-50
- **Indexes:** pgvector indexes for similarity search
- **Query Optimization:** Avoid N+1 queries, use eager loading

### LLM Optimization
- **Model Cascading:** Simple → Standard → Complex
- **Token Reduction:** Skills pattern for tool loading
- **Cost Tracking:** Real-time cost monitoring

---

## Observability

### Logging
- **Framework:** structlog for structured logging
- **Levels:** DEBUG, INFO, WARNING, ERROR, CRITICAL
- **Fields:** agent_id, tenant_id, trace_id, user_id

### Metrics
- **Prometheus:** System metrics (CPU, memory, latency)
- **Langfuse:** LLM metrics (tokens, cost, latency)
- **Custom:** Agent execution metrics, tool call metrics

### Tracing
- **Framework:** OpenTelemetry with Jaeger
- **Spans:** Request spans, agent spans, tool call spans
- **Baggage:** tenant_id, user_id, agent_id

---

## Related Documentation

- **Full Architecture:** `docs/ARCHITECTURE.md`
- **API Reference:** `docs/API.md`
- **Security Guide:** `docs/SECURITY-IMPLEMENTATION-GUIDE.md`
- **Database Schema:** `docs-site/docs/07-database/schema.md`

---

**Remember:** Always check `CLAUDE.md` for latest architecture decisions and `ACTION_PLAN.md` for implementation status.
