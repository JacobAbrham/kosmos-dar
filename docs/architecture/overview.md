# KOSMOS Architecture Overview

> Version 2.0 | Last Updated: January 2026

## System Architecture

KOSMOS is an AI-native enterprise operating system built on a modern, scalable microservices architecture.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Web App   │  │  Mobile App │  │   CLI Tool  │  │   VS Code   │         │
│  │  (Next.js)  │  │   (Future)  │  │   (Future)  │  │  Extension  │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
└─────────┼────────────────┼────────────────┼────────────────┼────────────────┘
          │                │                │                │
          └────────────────┴────────┬───────┴────────────────┘
                                    │
                          ┌─────────▼─────────┐
                          │      NGINX        │
                          │   (Load Balancer) │
                          │    :80 / :443     │
                          └─────────┬─────────┘
                                    │
              ┌─────────────────────┴─────────────────────┐
              │                                           │
    ┌─────────▼─────────┐                     ┌───────────▼───────────┐
    │     Frontend      │                     │        Backend        │
    │     (Next.js)     │◄───── REST/WS ─────►│       (FastAPI)       │
    │      :3000        │                     │         :8000         │
    └───────────────────┘                     └───────────┬───────────┘
                                                          │
              ┌───────────────────────────────────────────┴───────────────────┐
              │                                                               │
    ┌─────────▼─────────┐  ┌─────────────────┐  ┌─────────────────────────────┤
    │    PostgreSQL     │  │      Redis      │  │          NATS               │
    │    (pgvector)     │  │    (Cache)      │  │     (Message Queue)         │
    │      :5432        │  │     :6379       │  │         :4222               │
    └───────────────────┘  └─────────────────┘  └─────────────────────────────┘
```

## Core Components

### Frontend (Next.js 14)
- **Location**: `implementation/frontend/`
- **Technology**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Features**:
  - Server-Driven UI (SDUI) rendering
  - Real-time WebSocket updates
  - Unified Intent Interface (UII)
  - Responsive design with Radix UI components

### Backend (FastAPI)
- **Location**: `implementation/backend/`
- **Technology**: Python 3.11+, FastAPI, SQLAlchemy, LangGraph
- **Features**:
  - Async-first architecture
  - Multi-tenant support
  - Agent orchestration via LangGraph
  - OpenTelemetry tracing

### AI Agents
- **Location**: `implementation/backend/agents/`
- **Framework**: LangGraph with checkpointing
- **Agent Types**:
  - **Zeus**: Master orchestrator
  - **Apollo**: Analytics & insights
  - **Athena**: Knowledge & documentation
  - **Hermes**: Communications & integrations
  - **Hephaestus**: Infrastructure & DevOps
  - **Aegis**: Security & compliance

### MCP Servers
- **Location**: `implementation/mcp-servers/`
- **Purpose**: Tool integration for agents
- **Servers**: 80+ connectors (GitHub, Slack, AWS, etc.)

## Data Flow

1. **User Input** → Frontend captures intent via UII
2. **Intent Routing** → Backend's semantic router classifies intent
3. **Agent Selection** → Zeus selects appropriate agent(s)
4. **Tool Execution** → Agent calls MCP servers for external actions
5. **Response Generation** → SDUI components rendered
6. **Real-time Updates** → WebSocket pushes state changes

## Database Schema

```
Schemas:
├── core/        # Tenants, users, conversations
├── agents/      # Agent definitions, sessions, checkpoints
├── governance/  # Policies, approvals, cost tracking
├── knowledge/   # Documents, embeddings, RAG
├── metrics/     # Analytics, usage, performance
└── audit/       # Comprehensive audit logs
```

## Security Architecture

- **Authentication**: Zitadel (OIDC/OAuth 2.0)
- **Authorization**: RBAC with row-level security
- **Encryption**: TLS 1.3 in transit, AES-256 at rest
- **Secrets**: Infisical for secrets management

## Deployment Environments

| Environment | Infrastructure | Trigger |
|-------------|----------------|---------|
| Development | Local Docker | Manual |
| Staging | GitHub Codespaces | Push to `staging` |
| Production | Alibaba Cloud | Push to `main` + approval |

## Related Documentation

- [Getting Started](../implementation/docs/GETTING_STARTED.md)
- [API Reference](API.md)
- [Frontend UII System](../implementation/frontend/docs/UII_ARCHITECTURE.md)
- [Agent Framework](../implementation/docs/ARCHITECTURE.md)
