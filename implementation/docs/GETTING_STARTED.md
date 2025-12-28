# KOSMOS V2.0 - Getting Started Guide

## Overview

KOSMOS is an AI-native, agentic enterprise platform featuring 11 specialized agents, 88 MCP servers, and a Pentarchy governance system. This guide will help you set up your development environment and understand the core architecture.

## Prerequisites

- **Docker Desktop** 4.25+ with Docker Compose
- **Python** 3.11+
- **Node.js** 20+
- **Git**

## Quick Start

### 1. Clone and Setup

```bash
# Clone the repository
git clone https://github.com/your-org/kosmos.git
cd kosmos/implementation

# Copy environment configuration
cp .env.example .env

# Edit .env with your API keys (OpenAI, Anthropic, etc.)
```

### 2. Start Infrastructure

```bash
# Start all infrastructure services
docker-compose up -d

# Verify services are running
docker-compose ps
```

This starts:
- PostgreSQL 16 (with pgvector, Apache AGE, TimescaleDB)
- Dragonfly (Redis-compatible cache)
- NATS (message bus)
- MinIO (object storage)
- Zitadel (authentication)
- LiteLLM (LLM router)
- Langfuse (observability)
- Prometheus + Grafana (monitoring)
- Jaeger (tracing)

### 3. Initialize Database

```bash
# Run database migrations
cd database
psql -h localhost -U kosmos -d kosmos -f migrations/001_initial_schema.sql
```

### 4. Start Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows

# Install dependencies
pip install -r requirements.txt

# Start the API server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 5. Start Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

### 6. Access the Platform

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000/docs
- **Grafana**: http://localhost:3001 (admin/admin)
- **Langfuse**: http://localhost:3002
- **MinIO Console**: http://localhost:9001 (minioadmin/minioadmin)

## Architecture Overview

### The 11 Agents

| Agent | Domain | Role |
|-------|--------|------|
| **Zeus** | Orchestration | Master orchestrator, receives all requests |
| **Hermes** | Data Integration | Fetches and transforms data |
| **AEGIS** | Security | Authentication, authorization, threat detection |
| **Athena** | Analytics | Analysis, insights, reporting |
| **Chronos** | Scheduling | Calendar, reminders, time management |
| **Hephaestus** | Development | Code generation, review, CI/CD |
| **Nur PROMETHEUS** | Finance | Cost tracking, budget governance |
| **Iris** | Communication | Notifications, messaging |
| **MEMORIX** | Memory | Knowledge management, RAG |
| **Hestia** | Operations | System monitoring, infrastructure |
| **Morpheus** | Prediction | Forecasting, simulation |

### Pentarchy Governance

High-stakes decisions require approval from the Pentarchy (3-agent voting):
- **Athena** votes on strategic value
- **Hephaestus** votes on technical feasibility
- **Nur PROMETHEUS** votes on cost-benefit

**AEGIS** has security veto power over any decision.

### Cost Thresholds

| Cost Range | Approval |
|------------|----------|
| ≤ $50 | Auto-approved |
| $50-$100 | Pentarchy vote |
| > $100 | Denied (requires human approval) |

## Project Structure

```
implementation/
├── backend/               # Python FastAPI backend
│   ├── agents/           # 11 agent implementations
│   ├── core/             # Config, database, cache, messaging
│   └── main.py           # Application entry point
├── frontend/             # Next.js 14 frontend
│   ├── src/
│   │   ├── app/          # App router pages
│   │   ├── components/   # React components
│   │   ├── stores/       # Zustand state management
│   │   └── lib/          # Utilities
├── mcp-servers/          # MCP server implementations
│   ├── memory-server/    # Memory management (10 tools)
│   └── kosmos-tools/     # Core KOSMOS tools
├── database/
│   ├── init/             # Database initialization
│   └── migrations/       # SQL migrations
├── infrastructure/
│   └── docker/           # Docker configurations
└── .github/workflows/    # CI/CD pipelines
```

## Development Workflow

### Adding a New Agent Tool

1. Define the tool in the agent's `_get_tool` method:

```python
def _get_tool(self, tool_name: str) -> Optional[Callable]:
    tools = {
        "my_new_tool": self._my_new_tool,
    }
    return tools.get(tool_name)

async def _my_new_tool(self, param1: str, param2: int) -> dict:
    """Implement your tool logic here."""
    return {"result": "success"}
```

2. Register the tool in the agent's config:

```python
config = AgentConfig(
    tools=["existing_tool", "my_new_tool"],
    ...
)
```

### Adding a New MCP Server

1. Create the server directory:

```bash
mkdir mcp-servers/my-server
cd mcp-servers/my-server
npm init -y
```

2. Implement the MCP server following the template in `memory-server`.

3. Register in the agent's `mcp_servers` config.

### Running Tests

```bash
# Backend tests
cd backend
pytest -v

# Frontend tests
cd frontend
npm test

# MCP server tests
cd mcp-servers/memory-server
npm test
```

## Configuration

### Environment Variables

See `.env.example` for all available configuration options:

```env
# LLM Providers
KOSMOS_OPENAI_API_KEY=sk-...
KOSMOS_ANTHROPIC_API_KEY=sk-ant-...

# Cost Governance
KOSMOS_COST_AUTO_APPROVE_MAX=50.0
KOSMOS_COST_PENTARCHY_VOTE_MAX=100.0
KOSMOS_COST_DAILY_LIMIT=500.0
KOSMOS_COST_MONTHLY_LIMIT=10000.0
```

### LiteLLM Model Configuration

Edit `infrastructure/docker/litellm_config.yaml` to add models:

```yaml
model_list:
  - model_name: my-custom-model
    litellm_params:
      model: openai/gpt-4-turbo
      api_key: os.environ/OPENAI_API_KEY
```

## Troubleshooting

### Database Connection Issues

```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Check logs
docker-compose logs postgres
```

### Agent Not Responding

```bash
# Check agent logs
tail -f logs/agents.log

# Check NATS connection
docker-compose logs nats
```

### Memory Issues

```bash
# Increase Docker memory allocation
# Docker Desktop > Settings > Resources > Memory
```

## Next Steps

1. **Read the Architecture Guide**: `docs/ARCHITECTURE.md`
2. **Explore Agent Code**: `backend/agents/`
3. **Review API Documentation**: http://localhost:8000/docs
4. **Join the Community**: [Discord/Slack link]

## Support

- **Documentation**: `/docs`
- **Issues**: GitHub Issues
- **Email**: support@example.com
