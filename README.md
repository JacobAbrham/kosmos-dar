# KOSMOS - AI-Native Enterprise Operating System

> Unified agentic workspace for enterprise operations. Zero context switching, intent-aware interface.

## Quick Start

### Prerequisites

- Node.js 20+
- Docker Desktop (with WSL 2 backend on Windows)
- Git

### Local Development

```bash
# Clone the repository
git clone https://github.com/nuvanta-holding/kosmos.git
cd kosmos

# Install dependencies
cd implementation/frontend
npm install --include=dev

# Start development server
npm run dev

# Open http://localhost:3000
```

### Docker Development

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down
```

## Project Structure

```
kosmos/
├── .github/workflows/     # CI/CD pipelines
├── .devcontainer/         # Codespaces/Dev container config
├── docker/                # Dockerfiles and configs
├── implementation/
│   ├── frontend/          # Next.js 14 application
│   └── backend/           # FastAPI application
├── docker-compose.yml     # Local development stack
├── docker-compose.prod.yml# Production stack
└── Makefile               # Common commands
```

## Branch Strategy

| Branch | Environment | Deployment |
|--------|-------------|------------|
| `develop` | Local | Manual |
| `staging` | Staging (Codespaces) | Auto on push |
| `main` | Production (Alibaba) | Auto with approval |

## Available Commands

```bash
make help          # Show all commands
make install       # Install dependencies
make dev           # Start dev server
make build         # Production build
make test          # Run tests
make lint          # Run linter
make docker-up     # Start Docker services
make docker-down   # Stop Docker services
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

See [.env.example](.env.example) for all available options.

## Deployment

### Staging
```bash
git push origin staging
# Auto-deploys via GitHub Actions
```

### Production
```bash
git push origin main
# Requires manual approval in GitHub Actions
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [API Reference](docs/API.md)
- [UII System](implementation/frontend/docs/UII_ARCHITECTURE.md)

## License

Proprietary - Nuvanta Holding
