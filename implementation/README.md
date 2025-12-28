# KOSMOS V2.0 Implementation

**AI-Native Enterprise Operating System**

[![CI](https://github.com/your-org/kosmos/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/kosmos/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Proprietary-blue.svg)](LICENSE)

---

## Overview

KOSMOS is an AI-native, agentic enterprise platform featuring:

- **11 Specialized Agents** with Greek mythology theme
- **88 MCP Servers** across 9 domains
- **Pentarchy Governance** (3-agent voting system)
- **Multi-tenant Architecture** with Row-Level Security
- **Cost Governance** with automatic approval thresholds

---

## Quick Start

```bash
# 1. Clone and navigate
git clone https://github.com/your-org/kosmos.git
cd kosmos/implementation

# 2. Copy environment configuration
cp .env.example .env
# Edit .env with your API keys

# 3. Start infrastructure
docker-compose up -d

# 4. Run database migrations
cd database
psql -h localhost -U kosmos -d kosmos -f migrations/001_initial_schema.sql

# 5. Start backend
cd ../backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 6. Start frontend (new terminal)
cd ../frontend
npm install
npm run dev
```

**Access Points:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000/docs
- Grafana: http://localhost:3001

---

## The 11 Agents

| Agent | Domain | Role |
|-------|--------|------|
| **Zeus** | Orchestration | Master orchestrator |
| **Hermes** | Data Integration | Data fetching & transformation |
| **AEGIS** | Security | Auth, threats, security veto |
| **Athena** | Analytics | Insights & recommendations |
| **Chronos** | Scheduling | Calendar & time management |
| **Hephaestus** | Development | Code generation & CI/CD |
| **Nur PROMETHEUS** | Finance | Cost tracking & governance |
| **Iris** | Communication | Notifications & messaging |
| **MEMORIX** | Memory | Knowledge management |
| **Hestia** | Operations | System monitoring |
| **Morpheus** | Prediction | Forecasting & simulation |

---

## Project Structure

```
implementation/
├── backend/                # Python FastAPI backend
│   ├── agents/            # 11 agent implementations
│   │   ├── base.py        # BaseAgent abstract class
│   │   ├── zeus.py        # Master orchestrator
│   │   ├── governance.py  # Pentarchy system
│   │   └── ...            # Other agents
│   ├── core/              # Config, database, cache, messaging
│   └── main.py            # Application entry point
├── frontend/              # Next.js 14 frontend
│   ├── src/
│   │   ├── app/           # App router pages
│   │   ├── components/    # React components
│   │   └── stores/        # Zustand state
├── mcp-servers/           # MCP server implementations
│   ├── memory-server/     # Memory management (10 tools)
│   └── kosmos-tools/      # Core KOSMOS tools
├── database/
│   └── migrations/        # SQL migrations
├── infrastructure/
│   └── docker/            # Docker configurations
├── .github/workflows/     # CI/CD pipelines
└── docs/                  # Documentation
```

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | Next.js 14 | React UI framework |
| Backend | FastAPI | Python API framework |
| Agent Framework | LangGraph | Agent workflow orchestration |
| Database | PostgreSQL 16 | Primary data store |
| Extensions | pgvector, Apache AGE, TimescaleDB | Vector search, graph, time-series |
| Cache | Dragonfly | Redis-compatible high-performance cache |
| Message Bus | NATS | Inter-agent communication |
| Auth | Zitadel | OIDC authentication |
| LLM Router | LiteLLM | Multi-provider LLM gateway |
| Observability | Langfuse, Prometheus, Jaeger | Tracing & metrics |

---

## Development

### Prerequisites

- Python 3.11+
- Node.js 20+
- Docker Desktop 4.25+

### Running Tests

```bash
# Backend tests
cd backend && pytest -v

# Frontend tests
cd frontend && npm test

# All tests with coverage
cd backend && pytest --cov=. --cov-report=html
```

### Code Quality

```bash
# Backend linting
cd backend
ruff check .
ruff format .
mypy .

# Frontend linting
cd frontend
npm run lint
```

---

## Documentation

- [Getting Started Guide](docs/GETTING_STARTED.md)
- [Architecture Overview](docs/ARCHITECTURE.md)
- [Agent Development Guide](docs/AGENTS.md)
- [API Reference](http://localhost:8000/docs)

---

## Cost Governance

| Cost Range | Approval Process |
|------------|------------------|
| ≤ $50 | Auto-approved |
| $50-$100 | Pentarchy vote (Athena, Hephaestus, Nur PROMETHEUS) |
| > $100 | Denied (requires human approval) |

AEGIS has security veto power over any Pentarchy decision.

---

## Contributing

1. Create a feature branch from `develop`
2. Make your changes with tests
3. Run linting and tests
4. Submit a pull request

---

## License

Proprietary - Nuvanta Holding

---

**Version:** 2.0.0-alpha
**Last Updated:** 2025-12-25
