# KOSMOS - AI-Native Enterprise Operating System

> Unified agentic workspace for enterprise operations. Zero context switching, intent-aware interface.

**Version**: 2.0  
**Last Updated**: January 2026  
**Classification**: Internal Use Only

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Python 3.11+
- Docker Desktop (with WSL 2 backend on Windows)
- PostgreSQL 16+ with pgvector extension (or use Docker Compose)

### Local Development

```bash
# Clone the repository
git clone https://github.com/nuvanta-holding/kosmos-dar.git
cd kosmos-dar

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Start development environment
docker compose up -d

# Setup and run database migrations
cd implementation/backend
./scripts/setup_dev_db.sh
# Or: make db-migrate

# Install frontend dependencies
cd ../frontend
npm install --include=dev

# Start development server
npm run dev

# Open http://localhost:3000
```

### Database Setup

```bash
# Using Docker Compose (recommended)
docker compose up -d postgres

# Run migrations
make db-migrate

# Or manually
cd implementation/backend
alembic upgrade head
```

## 📋 Project Structure

```
kosmos-dar/
├── .github/workflows/         # CI/CD pipelines
├── docker/                    # Dockerfiles and configs
├── implementation/
│   ├── frontend/              # Next.js 14 application
│   ├── backend/               # FastAPI application
│   │   ├── alembic/           # Database migrations
│   │   ├── agents/            # AI agent implementations
│   │   ├── api/               # API routes
│   │   ├── core/              # Core services
│   │   ├── tests/             # Test suite
│   │   └── scripts/           # Helper scripts
│   └── mcp-servers/           # MCP server implementations
├── docs/                      # Comprehensive documentation
├── docker-compose.yml         # Local development stack
├── Makefile                   # Common commands
└── README.md                  # This file
```

## 🛠️ Available Commands

```bash
make help              # Show all commands
make install           # Install dependencies
make dev               # Start dev server
make build             # Production build
make test              # Run tests
make lint              # Run linter

# Database
make db-migrate        # Run database migrations
make db-current        # Show current migration revision
make db-rollback       # Rollback migrations (use REVISION=-1)
make db-test-migrations # Test migrations

# Docker
make docker-up         # Start Docker services
make docker-down       # Stop Docker services
make docker-logs       # View logs
```

## 🔐 Environment Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

### Required Environment Variables

```bash
# Core Configuration
NODE_ENV=development
NEXT_PUBLIC_API_URL=http://localhost:8000
DATABASE_URL=postgresql+asyncpg://kosmos:password@localhost:5432/kosmos

# Security
JWT_SECRET=your-secret-key-here
ZITADEL_DOMAIN=http://localhost:8080

# AI Services
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key

# MCP Servers
GITHUB_TOKEN=your-github-token
SLACK_BOT_TOKEN=your-slack-bot-token
```

## 🚀 Deployment

### Staging Deployment
```bash
git push origin staging
# Auto-deploys via GitHub Actions to staging environment
```

### Production Deployment
```bash
git push origin main
# Requires manual approval in GitHub Actions
# Deploys to Alibaba Cloud production environment
```

## 📚 Documentation

See [Documentation Index](docs/README.md) for complete documentation structure.

### Core Documentation
- [🏗️ Architecture Overview](docs/architecture/overview.md) - System architecture and design
- [🔌 API Reference](docs/api/reference.md) - Complete API documentation
- [🛡️ Security Implementation](docs/security/implementation-guide.md) - Security controls and STRIDE model
- [🏢 Enterprise Governance](docs/governance/enterprise.md) - Governance framework and compliance

### Setup and Operations
- [🗄️ Database Migration](docs/database/migration-guide.md) - Database setup and migration procedures
- [🚀 Deployment Guide](docs/deployment/README.md) - Deployment instructions for all environments
- [📊 Current Status](docs/status/current-status.md) - Project status and progress
- [📈 Implementation Summary](docs/status/implementation-summary-jan-2026.md) - Recent implementation details

### Development Resources
- [👨‍💻 Solo Developer Guide](docs/development/solo-developer.md) - Guide for solo developers
- [📋 Action Plan](docs/planning/action-plan.md) - 12-month implementation plan
- [📊 Gap Analysis](docs/assessment/gap-analysis.md) - Current implementation status

## 🎯 Key Features

### AI Agent Ecosystem
- **Zeus**: Master orchestrator agent
- **Athena**: Knowledge and documentation agent
- **AEGIS**: Security and compliance agent
- **Hermes**: Communications and integrations agent
- **Chronos**: Scheduling and time management
- **Hephaestus**: DevOps and infrastructure
- **Nur PROMETHEUS**: Analytics and insights
- **Iris**: Notifications and alerts
- **MEMORIX**: Memory and context management
- **Hestia**: Wellness and ergonomics
- **Morpheus**: Learning and adaptation

### Enterprise Capabilities
- **Multi-tenant Architecture**: Enterprise-grade isolation with RLS
- **Role-Based Access Control**: Granular permission management
- **Audit Logging**: Comprehensive security audit trail
- **Compliance Framework**: GDPR, CCPA, UAE PDPL support
- **Pentarchy Governance**: Five-member governance council
- **STRIDE Security Model**: Comprehensive threat protection

### Integration Platform
- **88 MCP Servers**: Extensive tool integration (3 configured, framework ready)
- **Real-time Communication**: WebSocket-based updates
- **Vector Search**: pgvector-powered semantic search
- **Workflow Automation**: LangGraph-based agent orchestration
- **Multi-modal Support**: Text, voice, and visual interfaces

## 📊 Current Status

| Component | Status | Documentation | Implementation |
|-----------|--------|---------------|---------------|
| **Core Architecture** | ✅ Complete | 98% | 40% |
| **Database Schema** | ✅ Complete | 100% | 100% |
| **Database Migrations** | ✅ Complete | 100% | 100% (Ready to run) |
| **Authentication System** | ✅ Complete | 100% | 95% |
| **Security Framework** | ✅ Complete | 100% | 95% |
| **Agent Framework** | ✅ Complete | 100% | 55% |
| **MCP Servers** | 🟡 In Progress | 100% | 3% (3/88 configured) |
| **Frontend UII** | ✅ Complete | 100% | 95% |
| **Infrastructure** | ✅ Complete | 100% | 100% (Docker Compose) |
| **CI/CD Pipeline** | ✅ Complete | 100% | 100% |

**Overall Progress**: Documentation 98% | Implementation 40%

## 🚨 Known Issues and Limitations

### Current Limitations
- MCP server backend endpoints need environment variables
- Background job processing (Celery/ARQ) not yet implemented
- Observability stack (Prometheus, Grafana) not deployed
- Some agent functionality depends on MCP server integration

### Security Considerations
- ✅ Authentication system implemented (Zitadel OIDC/OAuth 2.0)
- ✅ Protected routes implemented (middleware + component)
- ✅ MFA UI ready (backend endpoints pending)
- ✅ Security headers and rate limiting active
- ✅ Audit logging operational

See [Gap Analysis](docs/assessment/gap-analysis.md) for complete risk assessment.

## 🔧 Development Status

### Recent Completions (January 2026)
- ✅ Database migrations converted to Alembic format
- ✅ Migration tests created
- ✅ Protected route handling implemented
- ✅ MFA setup UI created
- ✅ Infrastructure services configured (NATS, MinIO, Dragonfly, Zitadel)
- ✅ MCP servers verified (GitHub, PostgreSQL, Slack)

### Next Steps
1. Run database migrations: `make db-migrate`
2. Test infrastructure: `docker compose up -d`
3. Configure MCP server environment variables
4. Test protected routes and MFA setup

## 📞 Support

### Technical Support
- **Email**: support@nuvanta-holding.com
- **Documentation**: See docs/ directory
- **Issues**: GitHub Issues (for authorized users)

### Security Issues
- **Security Email**: security@nuvanta-holding.com
- **PGP Key**: Available upon request
- **Incident Response**: 24/7 security team availability

## 📄 License

**Proprietary - Nuvanta Holding**

This software is proprietary to Nuvanta Holding and is protected by copyright laws and international treaties. Unauthorized reproduction or distribution is prohibited.

## 🏢 Corporate Information

**Nuvanta Holding**  
Enterprise AI Solutions  
[www.nuvanta-holding.com](https://www.nuvanta-holding.com)

---

**Document Version**: 2.0  
**Last Updated**: January 2026  
**Next Review**: February 2026
