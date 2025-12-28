# KOSMOS V2.0 Architecture Guide

## System Overview

KOSMOS (Knowledge-Oriented System for Managing Organizational Services) is an AI-native enterprise platform built on a multi-agent architecture. The system coordinates 11 specialized agents through a central orchestrator (Zeus), with governance provided by the Pentarchy voting system.

## Core Principles

1. **Agent Specialization**: Each agent has a specific domain of expertise
2. **Loose Coupling**: Agents communicate via message bus (NATS)
3. **Cost Governance**: All operations are cost-tracked with automatic approval thresholds
4. **Security First**: AEGIS provides security veto power
5. **Memory Persistence**: MEMORIX maintains episodic, semantic, procedural, and working memory

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Frontend (Next.js)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │  Dashboard  │  │ Conversation│  │   Agents    │  │  Analytics  │     │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘     │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ REST/WebSocket
┌───────────────────────────────▼─────────────────────────────────────────┐
│                           API Gateway (FastAPI)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │    Auth     │  │    CORS     │  │   Tracing   │  │Rate Limiting│     │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘     │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────────────┐
│                              Agent Layer                                 │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                          ZEUS (Orchestrator)                      │   │
│  │  • Receives all requests        • Routes to domain agents         │   │
│  │  • Coordinates multi-agent      • Aggregates responses            │   │
│  │  • Triggers Pentarchy votes     • Manages conversation flow       │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                    │                                     │
│       ┌────────────────────────────┼────────────────────────────┐       │
│       │                            │                            │       │
│  ┌────▼────┐ ┌────▼────┐ ┌────▼────┐ ┌────▼────┐ ┌────▼────┐   │       │
│  │ HERMES  │ │  AEGIS  │ │ ATHENA  │ │CHRONOS  │ │HEPHAESTUS│   │       │
│  │  Data   │ │Security │ │Analytics│ │Schedule │ │  DevOps  │   │       │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └──────────┘   │       │
│                                                                  │       │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │       │
│  │ NUR     │ │  IRIS   │ │ MEMORIX │ │ HESTIA  │ │MORPHEUS │   │       │
│  │PROMETHEUS│ │  Comms  │ │ Memory  │ │   Ops   │ │Prediction│   │       │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘   │       │
│                                                                          │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────────┐
│                           MCP Server Layer                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │ Memory   │ │ GitHub   │ │  Slack   │ │ Postgres │ │Filesystem│      │
│  │ Server   │ │  MCP     │ │   MCP    │ │   MCP    │ │   MCP    │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│                      (88 MCP Servers Total)                              │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────────┐
│                          Infrastructure Layer                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │PostgreSQL│ │Dragonfly │ │   NATS   │ │  MinIO   │ │ Zitadel  │      │
│  │(pgvector)│ │ (Cache)  │ │(Msg Bus) │ │(Storage) │ │  (Auth)  │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│                                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                    │
│  │ LiteLLM  │ │ Langfuse │ │Prometheus│ │  Jaeger  │                    │
│  │(LLM Gate)│ │(Tracing) │ │(Metrics) │ │(Distrib) │                    │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘                    │
└─────────────────────────────────────────────────────────────────────────┘
```

## Agent Details

### Zeus (Master Orchestrator)

**Role**: Central coordinator for all agent activities

**Workflow**:
1. Receive user request
2. Analyze request complexity
3. Estimate cost
4. Check if governance required
5. Route to domain agents
6. Collect and aggregate responses
7. Return unified response

**Key Features**:
- Task complexity classification (Simple, Moderate, Complex, Critical)
- Automatic agent routing based on keywords
- Pentarchy escalation for high-stakes decisions

### AEGIS (Security Guardian)

**Role**: Security enforcement and threat detection

**Capabilities**:
- STRIDE threat model implementation
- RBAC/ABAC authorization
- Security veto power in Pentarchy
- Audit logging

**Security Veto**: AEGIS can block any Pentarchy decision that poses security risks.

### Athena, Hephaestus, Nur PROMETHEUS (Pentarchy Voters)

These three agents vote on high-stakes decisions:

| Agent | Voting Criteria |
|-------|-----------------|
| Athena | Strategic value, data-driven insights, ROI |
| Hephaestus | Technical feasibility, code quality, breaking changes |
| Nur PROMETHEUS | Cost-benefit analysis, budget impact, ROI |

**Voting Rules**:
- Quorum: 2 votes required
- Approval: Simple majority (>50%)
- Security Veto: AEGIS can override any approval

## Data Flow

### Request Processing

```
User Request → Zeus → Analyze → Estimate Cost
                                    │
                     ┌──────────────┼──────────────┐
                     ▼              ▼              ▼
                ≤$50: Auto    $50-$100:      >$100: Deny
                  Approve     Pentarchy Vote
                     │              │
                     └──────┬───────┘
                            ▼
                    Route to Agents
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
           Agent 1      Agent 2       Agent N
              │             │             │
              └─────────────┼─────────────┘
                            ▼
                   Aggregate Responses
                            │
                            ▼
                    Return to User
```

### Memory Architecture

MEMORIX manages four types of memory:

| Type | Description | Decay Algorithm |
|------|-------------|-----------------|
| **Episodic** | Events, conversations | Exponential (7-day half-life) |
| **Semantic** | Facts, knowledge | Power-law (slow decay) |
| **Procedural** | How-to instructions | None (permanent) |
| **Working** | Active context | Fast decay (session-based) |

**Consolidation**: Episodic memories are periodically consolidated into semantic knowledge.

## Database Schema

### Core Tables

- `tenants`: Multi-tenant isolation
- `users`: User accounts
- `conversations`: Chat sessions
- `messages`: Chat messages

### Agent Tables

- `agents.registry`: Agent configurations
- `agents.state`: Agent state snapshots
- `agents.metrics`: Performance metrics

### Governance Tables

- `governance.proposals`: Pentarchy proposals
- `governance.votes`: Individual votes
- `governance.cost_tracking`: Cost ledger

### Knowledge Tables

- `knowledge.documents`: Source documents
- `knowledge.chunks`: Document chunks with embeddings
- `knowledge.entities`: Knowledge graph nodes
- `knowledge.relations`: Knowledge graph edges

## Security Model

### Authentication

- **Provider**: Zitadel (OIDC-compliant)
- **Tokens**: JWT with short expiration
- **Sessions**: Stored in Dragonfly cache

### Authorization

- **Model**: RBAC + ABAC hybrid
- **Row-Level Security**: PostgreSQL RLS for tenant isolation
- **Permission Format**: `resource:action` (e.g., `data:read`)

### Secrets Management

- **Provider**: Infisical (or Vault)
- **Encryption**: AES-256-GCM at rest
- **Rotation**: Automatic key rotation

## Observability

### Metrics (Prometheus)

- Request latency (p50, p95, p99)
- Agent success rates
- Cost per agent
- Token usage

### Tracing (Langfuse + Jaeger)

- Full LLM call traces
- Inter-agent communication
- Tool execution timing

### Logging (Structlog)

- JSON-formatted logs
- Correlation IDs (trace_id)
- Automatic context binding

## Scalability

### Horizontal Scaling

- Stateless API servers (scale horizontally)
- NATS for distributed messaging
- Dragonfly for distributed cache

### Database Scaling

- Read replicas for query load
- Connection pooling (50 connections/instance)
- TimescaleDB for time-series data

### Cost Optimization

- Semantic cache for repeated queries
- Model routing (expensive → cheap fallback)
- Prompt optimization

## Deployment

### Development

```bash
docker-compose up -d
```

### Staging/Production

- Kubernetes (k8s manifests in `/k8s`)
- GitHub Actions for CI/CD
- Blue-green deployments

## Extension Points

### Adding a New Agent

1. Create agent class extending `BaseAgent`
2. Implement `_build_graph()` and `process()`
3. Register in `AGENT_CLASSES` dict
4. Add to database seed data

### Adding MCP Servers

1. Create MCP server following SDK
2. Register in agent's `mcp_servers` config
3. Implement tool handlers

### Custom Tools

1. Define tool function
2. Register in agent's `_get_tool()`
3. Add to config's `tools` list

## Performance Targets

| Metric | Target |
|--------|--------|
| API Latency (p95) | < 200ms |
| Agent Response | < 5s |
| Pentarchy Vote | < 30s |
| Uptime | 99.9% |
