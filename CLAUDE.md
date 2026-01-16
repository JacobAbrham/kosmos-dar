# KOSMOS DAR - AI Context Guide

**Purpose:** This file provides comprehensive context for AI assistants working on KOSMOS DAR, ensuring consistent understanding of architecture, patterns, and standards across all development sessions.

**Last Updated:** January 2026  
**Version:** 2.0

---

## Project Overview

KOSMOS DAR is an AI-native enterprise operating system that provides a unified agentic workspace for enterprise operations. It enables zero context switching through an intent-aware interface powered by 11 specialized AI agents and 88+ MCP servers.

**Key Characteristics:**
- **Architecture:** Microservices with FastAPI backend, Next.js 14 frontend
- **Agent Framework:** LangGraph with checkpointing and human-in-the-loop support
- **Tool Integration:** Model Context Protocol (MCP) for external service integration
- **State Management:** Zustand (global) + Jotai (real-time interdependent state)
- **Multi-tenancy:** PostgreSQL Row-Level Security (RLS) for tenant isolation
- **Observability:** Langfuse for LLM tracing, Prometheus/Grafana for metrics

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Next.js 14)                │
│  - App Router with Server Components                    │
│  - Zustand for global workspace state                   │
│  - Jotai for real-time agent execution state            │
│  - WebSocket for real-time updates                      │
│  - SDUI renderer for dynamic UI components             │
└───────────────────────┬─────────────────────────────────┘
                        │ REST/WebSocket
┌───────────────────────▼─────────────────────────────────┐
│                  Backend (FastAPI)                      │
│  - LangGraph agent orchestration                        │
│  - MCP tool registry and execution                      │
│  - NATS messaging for inter-agent communication         │
│  - PostgreSQL with pgvector for RAG                     │
│  - Redis/Dragonfly for caching                          │
└─────────────────────────────────────────────────────────┘
```

### Agent Architecture

All agents extend `LangGraphAgent` base class (`implementation/backend/agents/langgraph_base.py`):

- **Zeus:** Master orchestrator, intent routing, multi-agent coordination
- **Athena:** Knowledge & RAG, document ingestion, vector search
- **AEGIS:** Security scanning, threat detection, governance veto
- **Hermes:** Communications, multi-channel messaging
- **Hephaestus:** DevOps, code generation, CI/CD integration
- **Chronos:** Scheduling, calendar management, time management
- **Nur PROMETHEUS:** Analytics, cost tracking, reporting
- **Iris:** Notifications, alert management
- **MEMORIX:** Memory, context management, persistence
- **Hestia:** Wellness, break scheduling, ergonomics
- **Morpheus:** Learning, adaptation, improvement

### LangGraph Patterns

**State Management:**
- All agents use `AgentGraphState` or custom state extending it
- State is checkpointed at every super-step using `MemorySaver` or PostgreSQL checkpointers
- State includes: messages, current_task, phase, tool_results, cost_tracking, governance flags

**Workflow Nodes:**
- `plan` - Analyze intent and create execution plan
- `select_tools` - Choose appropriate MCP tools
- `execute_step` - Execute tool calls
- `check_human_input` - Determine if human approval needed
- `await_human_input` - Wait for human response
- `check_governance` - Check if Pentarchy vote required
- `synthesize` - Combine results and generate response
- `handle_error` - Error recovery and retry logic

**Human-in-the-Loop:**
- Approval gates for critical decisions
- Async human input handling via WebSocket
- Checkpoint persistence enables "time-travel" debugging

### MCP Server Integration

**Tool Registry:** `implementation/backend/core/tool_registry.py`
- Central registry for all MCP tools
- Dynamic discovery and registration
- Circuit breaker pattern for resilience
- Tool categorization by domain

**MCP Server Categories:**
- Database & Storage (PostgreSQL, Qdrant, Redis, MinIO)
- AI & Reasoning (Langfuse, Anthropic, OpenAI, Context7)
- Productivity (Slack, Gmail, Notion, Jira)
- DevOps (GitHub, Docker, Kubernetes, Terraform)
- Security (Zitadel, Infisical, Vault, Trivy)
- Finance & Analytics (Timescale, Finance APIs)
- Cloud Providers (AWS, GCP, Alibaba Cloud)

**Tool Execution:**
- Tools called via `GlobalToolRegistry.call_tool()`
- Results include success status, data, cost, latency
- Circuit breakers prevent cascade failures
- Retry logic with exponential backoff

---

## Coding Standards

### Python (Backend)

**Style:**
- Use Black for formatting (line length 100)
- Use Ruff for linting
- Use mypy for type checking
- Follow PEP 8 with exceptions for line length

**Patterns:**
- Async-first: Use `async/await` for all I/O operations
- Type hints: All functions must have type annotations
- Pydantic models: Use for data validation and serialization
- Structlog: Use structured logging, not print statements
- Error handling: Use custom exceptions, never bare except

**File Structure:**
```
implementation/backend/
├── agents/          # Agent implementations
├── api/            # FastAPI routes
├── core/           # Core services (auth, database, cache, etc.)
├── sdui/           # SDUI component definitions
└── tests/          # Test suites
```

**Naming Conventions:**
- Classes: PascalCase (`LangGraphAgent`)
- Functions/methods: snake_case (`execute_step`)
- Constants: UPPER_SNAKE_CASE (`MAX_ITERATIONS`)
- Private: Leading underscore (`_internal_method`)

### TypeScript (Frontend)

**Style:**
- Use ESLint with Next.js config
- Use Prettier for formatting
- Strict TypeScript mode enabled

**Patterns:**
- React Server Components for data fetching
- Client Components only when needed (interactivity, hooks)
- Zustand for global state (workspace, user preferences)
- Jotai for real-time interdependent state (agent execution)
- TanStack Query for server state caching

**File Structure:**
```
implementation/frontend/src/
├── app/            # Next.js App Router pages
├── components/     # React components
├── stores/         # Zustand stores
├── hooks/          # Custom React hooks
├── services/       # API service clients
└── lib/            # Utility functions
```

**Naming Conventions:**
- Components: PascalCase (`AgentStatus.tsx`)
- Hooks: camelCase with "use" prefix (`useAgent.ts`)
- Stores: camelCase (`workspace.ts`)
- Types/Interfaces: PascalCase (`AgentState`)

---

## Security & Compliance

### Authentication & Authorization
- **Provider:** Zitadel (OIDC/OAuth 2.0)
- **Tokens:** JWT with refresh mechanism
- **MFA:** TOTP/WebAuthn support required
- **Authorization:** RBAC with row-level security (RLS)

### Data Protection
- **Encryption:** TLS 1.3 in transit, AES-256 at rest
- **Secrets:** Infisical or environment variables (never hardcoded)
- **Multi-tenancy:** PostgreSQL RLS policies for tenant isolation
- **Audit Logging:** All actions logged to `audit` schema

### Compliance Requirements
- **GDPR:** Amnesia protocol for data deletion
- **CCPA:** Data export and deletion capabilities
- **UAE PDPL:** Data residency and privacy controls
- **ISO 27001:** Security controls and documentation

### Security Checklist
- [ ] No secrets in codebase (use environment variables)
- [ ] Input validation on all user inputs
- [ ] Rate limiting per user/IP
- [ ] Security headers (CSP, HSTS, X-Frame-Options)
- [ ] SQL injection protection (parameterized queries)
- [ ] XSS protection (input sanitization)
- [ ] Prompt injection detection for AI inputs
- [ ] Audit logging for all AI interactions

---

## Testing Requirements

### Backend Testing
- **Framework:** pytest with pytest-asyncio
- **Coverage Target:** >70% (Phase 1), >80% (Phase 2+)
- **Test Types:**
  - Unit tests for all core services
  - Integration tests for API endpoints
  - Agent workflow tests
  - MCP server integration tests

### Frontend Testing
- **Unit Tests:** Vitest for components
- **E2E Tests:** Playwright for critical flows
- **Coverage Target:** >60% (Phase 1), >70% (Phase 2+)
- **Critical Flows:**
  - Login/logout flow
  - Agent selection and chat
  - Workflow creation and execution

### Test Structure
```
tests/
├── unit/           # Unit tests
├── integration/    # Integration tests
├── e2e/            # End-to-end tests
└── fixtures/       # Test data and factories
```

---

## Development Workflow

### Spec-Driven Development
1. Create specification in `specs/` directory
2. AI validates and enhances specification
3. Human approves architecture
4. AI implements with validation gates
5. Human reviews at checkpoints
6. AI integrates feedback

### Director Model Pattern
- Human acts as strategic director
- AI agents handle execution
- Checkpoints for critical decisions:
  - Architecture decisions → Human approval
  - High-cost operations → Governance approval
  - Security-sensitive actions → AEGIS review
  - Production deployments → Pentarchy vote

### Daily Workflow
- **Morning (2h):** Review overnight outputs, plan day's tasks, create specs
- **Midday (4h):** Active development, delegate async tasks, iterate
- **Afternoon (2h):** Integration testing, documentation review, update context files

---

## Cost Optimization

### LLM Caching
- **Exact Cache:** Redis with prompt hash keys (30-60% savings)
- **Semantic Cache:** Qdrant vector similarity (15-30% savings)
- **Context Cache:** Anthropic 5-min TTL, OpenAI automatic (50-90% savings)

### Model Cascading
- **Simple:** Claude Haiku / GPT-4.1-nano (~$0.25/1M tokens)
- **Standard:** Claude Sonnet / GPT-4o-mini (~$3/1M tokens)
- **Complex:** Claude Opus / GPT-4 (~$15/1M tokens)

### Cost Monitoring
- Track token usage per request
- Daily/monthly budget enforcement
- Cost alerts and notifications
- Integration with Langfuse metrics

---

## Key Files Reference

### Documentation
- `docs/planning/action-plan.md` - Implementation roadmap (12 months)
- `docs/architecture/overview.md` - System architecture details
- `docs/api/reference.md` - API reference documentation
- `docs/development/solo-developer.md` - Solo development guide
- `docs/assessment/gap-analysis.md` - Current gap analysis
- `docs/status/current-status.md` - Project status

### Backend Core
- `implementation/backend/agents/langgraph_base.py` - LangGraph agent base class
- `implementation/backend/core/tool_registry.py` - MCP tool registry
- `implementation/backend/core/config.py` - Configuration management
- `implementation/backend/core/database.py` - Database connection handling

### Frontend Core
- `implementation/frontend/src/stores/workspace.ts` - Zustand workspace store
- `implementation/frontend/src/components/agents/` - Agent UI components
- `implementation/frontend/src/services/api.ts` - API client

---

## Common Patterns

### Agent Implementation
```python
class MyAgent(LangGraphAgent[MyState]):
    def create_state_class(self):
        return MyState
    
    def define_nodes(self):
        return {
            "custom_node": self._custom_node_handler
        }
    
    def define_edges(self):
        return [
            ("plan", "custom_node"),
            ("custom_node", "synthesize")
        ]
```

### MCP Tool Usage
```python
tool_result = await self.tool_registry.call_tool(
    server="github-mcp",
    tool="create_issue",
    params={"title": "Bug", "body": "Description"}
)
```

### Frontend State Management
```typescript
// Zustand for global state
const workspace = useWorkspaceStore();

// Jotai for real-time state
const agentStatus = useAtomValue(agentExecutionAtom);
```

---

## Important Notes

1. **Always check ACTION_PLAN.md** before starting new features to understand current phase priorities
2. **Update .memory.md** with learnings after each significant development session
3. **Follow spec-driven workflow** - create specs before implementation
4. **Use Director Model** - set checkpoints for critical decisions
5. **Maintain test coverage** - write tests alongside implementation
6. **Cost awareness** - use caching and model cascading to reduce LLM costs
7. **Security first** - never skip security layers, always validate inputs

---

**For questions or clarifications, refer to:**
- Architecture: `docs/architecture/overview.md`
- API: `docs/api/reference.md`
- Implementation Plan: `docs/planning/action-plan.md`
- Solo Development: `docs/development/solo-developer.md`
- Gap Analysis: `docs/assessment/gap-analysis.md`
- Current Status: `docs/status/current-status.md`
- Documentation Index: `docs/README.md`
