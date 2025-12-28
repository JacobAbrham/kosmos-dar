---
sidebar_position: 2
title: System Topology
---

# System Topology

Complete KOSMOS V2.0 system architecture and technology stack.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         KOSMOS V2.0 ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    PRESENTATION LAYER                                │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐    │   │
│  │  │ Next.js  │  │ Mobile   │  │ Desktop  │  │ Ergonomic Engine │    │   │
│  │  │ 14 + TSX │  │ (React   │  │ (Tauri)  │  │ (Color/Breaks)   │    │   │
│  │  │          │  │ Native)  │  │          │  │                  │    │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│  ┌─────────────────────────────────▼───────────────────────────────────┐   │
│  │                      API GATEWAY LAYER                               │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │   │
│  │  │ Cloudflare  │  │ Kong/APISIX │  │ Rate Limit  │  │ WAF + DDoS │  │   │
│  │  │ CDN + Edge  │  │ Gateway     │  │ (Dragonfly) │  │ Protection │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│  ┌─────────────────────────────────▼───────────────────────────────────┐   │
│  │                    ORCHESTRATION LAYER                               │   │
│  │  ┌───────────────────────────────────────────────────────────────┐  │   │
│  │  │                    ZEUS (Master Orchestrator)                  │  │   │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌───────────────────────┐  │  │   │
│  │  │  │ Intent      │  │ Sequential  │  │ Pentarchy Governance  │  │  │   │
│  │  │  │ Classifier  │  │ Thinking    │  │ (3-Agent Voting)      │  │  │   │
│  │  │  └─────────────┘  └─────────────┘  └───────────────────────┘  │  │   │
│  │  └───────────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│  ┌─────────────────────────────────▼───────────────────────────────────┐   │
│  │                      AGENT ECOSYSTEM (11 Agents)                     │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │   │
│  │  │ Hermes  │ │ AEGIS   │ │ Chronos │ │ Athena  │ │Hephaestus│       │   │
│  │  │ Comms   │ │ Security│ │ Schedule│ │ RAG/KB  │ │ DevOps  │       │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘       │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │   │
│  │  │Nur PROM │ │  Iris   │ │ MEMORIX │ │ Hestia  │ │Morpheus │       │   │
│  │  │Analytics│ │ Notify  │ │ Memory  │ │Wellness │ │ Learn   │       │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│  ┌─────────────────────────────────▼───────────────────────────────────┐   │
│  │                       MCP INTEGRATION HUB (88 Servers)               │   │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐        │   │
│  │  │ Database   │ │ Messaging  │ │ AI/LLM     │ │ Security   │        │   │
│  │  │ (12 MCPs)  │ │ (8 MCPs)   │ │ (15 MCPs)  │ │ (10 MCPs)  │        │   │
│  │  └────────────┘ └────────────┘ └────────────┘ └────────────┘        │   │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐        │   │
│  │  │ Productiv. │ │ DevOps     │ │ Reasoning  │ │ External   │        │   │
│  │  │ (15 MCPs)  │ │ (13 MCPs)  │ │ (5 MCPs)   │ │ (10 MCPs)  │        │   │
│  │  └────────────┘ └────────────┘ └────────────┘ └────────────┘        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│  ┌─────────────────────────────────▼───────────────────────────────────┐   │
│  │                      DATA PERSISTENCE LAYER                          │   │
│  │  ┌─────────────────────────────────────────────────────────────┐    │   │
│  │  │               PostgreSQL 16 (Unified Data Store)             │    │   │
│  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────────┐ │    │   │
│  │  │  │pgvector │ │Apache   │ │Timescale│ │ pg_trgm │ │ JSONB  │ │    │   │
│  │  │  │ (RAG)   │ │ AGE     │ │ DB      │ │(Search) │ │        │ │    │   │
│  │  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └────────┘ │    │   │
│  │  └─────────────────────────────────────────────────────────────┘    │   │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐                       │   │
│  │  │ Dragonfly  │ │ MinIO      │ │ Memory     │                       │   │
│  │  │ (Cache)    │ │ (Objects)  │ │ Server     │                       │   │
│  │  └────────────┘ └────────────┘ └────────────┘                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│  ┌─────────────────────────────────▼───────────────────────────────────┐   │
│  │                    INFRASTRUCTURE LAYER                              │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────┐   │   │
│  │  │ K3s/K8s │ │ Argo CD │ │ NATS    │ │ Zitadel │ │ Infisical   │   │   │
│  │  │ Cluster │ │ GitOps  │ │ Events  │ │ Auth    │ │ Secrets     │   │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | Next.js 14, TypeScript, Tailwind CSS | Web interface |
| **Mobile** | React Native | Mobile applications |
| **Desktop** | Tauri | Cross-platform desktop app |
| **API Gateway** | Kong/APISIX + Cloudflare | Traffic management, security |
| **Backend** | FastAPI (Python 3.11+) | API services |
| **Agent Framework** | LangGraph | Multi-agent orchestration |
| **LLM Router** | LiteLLM | Model abstraction layer |
| **Database** | PostgreSQL 16 + extensions | Primary data store |
| **Cache** | Dragonfly | Redis-compatible caching |
| **Objects** | MinIO | S3-compatible storage |
| **Messaging** | NATS | Event streaming |
| **Auth** | Zitadel | OIDC/SAML identity |
| **Secrets** | Infisical | Secrets management |
| **Orchestration** | K3s/Kubernetes | Container orchestration |
| **GitOps** | Argo CD | Deployment automation |
| **Observability** | Prometheus, Grafana, Loki, Jaeger, Langfuse | Full-stack monitoring |

## Layer Descriptions

### Presentation Layer
- **Next.js 14** - Server-side rendering, React Server Components
- **React Native** - Mobile apps for iOS/Android
- **Tauri** - Lightweight desktop apps (Rust-based)
- **Ergonomic Engine** - User wellness and productivity optimization

### API Gateway Layer
- **Cloudflare CDN** - Edge caching, DDoS protection
- **Kong/APISIX** - API gateway, rate limiting
- **WAF** - Web Application Firewall

### Orchestration Layer
- **Zeus** - Master orchestrator agent
- **Intent Classifier** - Route requests to appropriate agents
- **Sequential Thinking** - Complex reasoning chains
- **Pentarchy Governance** - 3-agent voting for decisions

### Agent Ecosystem
11 specialized agents with distinct responsibilities (see [Agents](/docs/agents/) section)

### MCP Integration Hub
88 MCP servers across 9 domains (see [MCP Servers](/docs/05-mcp-servers/) section)

### Data Persistence Layer
- **PostgreSQL 16** with pgvector, Apache AGE, TimescaleDB
- **Dragonfly** - High-performance Redis-compatible cache
- **MinIO** - Object storage for files/media

### Infrastructure Layer
- **K3s** - Lightweight Kubernetes
- **Argo CD** - GitOps deployment
- **NATS** - Event messaging
- **Zitadel** - Identity and access management
- **Infisical** - Secrets management
