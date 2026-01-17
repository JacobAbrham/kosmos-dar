# KOSMOS DAR Deployment Guide

Quick-start guide for deploying KOSMOS to different environments.

## Deployment Options

| Platform | Backend | Frontend | Database | Best For |
|----------|---------|----------|----------|----------|
| **Render** | ✅ | ✅ | ✅ PostgreSQL | Production (Blueprint auto-deploy) |
| **Railway** | ✅ | ✅ | ✅ PostgreSQL + Redis | Development/Staging |
| **Fly.io** | ✅ | ❌ | ✅ PostgreSQL | Backend-only |
| **Vercel** | ❌ | ✅ | - | Frontend-only |
| **Docker Compose** | ✅ | ✅ | ✅ PostgreSQL | Self-hosted, Local Development |

## Quick Deploy

### Option 1: Render (Recommended for Production)

1. Fork this repository
2. Go to [Render Dashboard](https://dashboard.render.com)
3. Click "New" → "Blueprint"
4. Connect your GitHub repo
5. Render auto-detects `render.yaml` and creates all services
6. Set secrets in dashboard:
   - `ANTHROPIC_API_KEY`
   - `OPENAI_API_KEY` (optional)

**Services Created:**
- `kosmos-backend` - Python FastAPI (port 8000)
- `kosmos-frontend` - Next.js (port 3000)
- `kosmos-db` - PostgreSQL 15
- `kosmos-worker` - Celery background worker

### Option 2: Railway (Recommended for Staging)

**⚠️ Important:** Use GitHub integration instead of CLI for reliable deployments.

**Quick Setup:**
1. Go to [Railway Dashboard](https://railway.app)
2. Create new project → **Deploy from GitHub repo**
3. Select repository: `JacobAbrham/kosmos-dar`
4. Configure backend service:
   - **Root Directory**: `implementation/backend`
   - **Branch**: `staging`
5. Add PostgreSQL and Redis services
6. Set environment variables (see [Railway Guide](railway.md))

**Benefits:**
- ✅ Automatic deployments on push
- ✅ Faster builds (5-10 min vs 15+ min with CLI)
- ✅ More reliable than CLI uploads
- ✅ Easy rollback via dashboard

**See [Railway Deployment Guide](railway.md) for detailed instructions.**

**Alternative: Railway CLI** (less reliable)
```bash
npm install -g @railway/cli
railway login
cd implementation/backend
railway init
railway up
```

### Option 3: Docker Compose (Self-Hosted)

```bash
cd implementation

# Development
docker-compose up -d

# Production
docker-compose -f docker-compose.prod.yml up -d
```

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection | `postgresql://user:pass@host:5432/kosmos` |
| `REDIS_URL` | Redis connection | `redis://host:6379` |
| `JWT_SECRET` | JWT signing key | Auto-generated 32+ chars |
| `ANTHROPIC_API_KEY` | Claude API key | `sk-ant-...` |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key | - |
| `CORS_ORIGINS` | Allowed CORS origins | `http://localhost:3000` |
| `DEBUG` | Enable debug mode | `false` |
| `LOG_LEVEL` | Logging level | `INFO` |

### Frontend

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `https://api.kosmos.io` |
| `NEXT_PUBLIC_WS_URL` | WebSocket URL | `wss://api.kosmos.io/ws` |

## Staging Deployment

See [Staging Deployment Guide](staging.md) for detailed staging deployment instructions.

### GitHub Actions (K8s)

Push to `staging` branch triggers automatic deployment:

```bash
git checkout staging
git push origin staging
```

Requires GitHub Secrets:
- `KUBE_CONFIG_STAGING` - Base64 encoded kubeconfig
- `SLACK_WEBHOOK_URL` - (optional) For notifications

## Production Deployment

See [Production Deployment Guide](production.md) for detailed production setup instructions.

## Health Checks

| Endpoint | Method | Expected |
|----------|--------|----------|
| `/health` | GET | `{"status": "healthy"}` |
| `/ready` | GET | `{"ready": true, ...}` |
| `/api/v1/agents` | GET | List of agents |

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│    Frontend     │────▶│    Backend      │
│   (Next.js)     │     │   (FastAPI)     │
│   Port 3000     │     │   Port 8000     │
└─────────────────┘     └────────┬────────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
              ┌──────────┐ ┌──────────┐ ┌──────────┐
              │PostgreSQL│ │  Redis   │ │   NATS   │
              │  :5432   │ │  :6379   │ │  :4222   │
              └──────────┘ └──────────┘ └──────────┘
```

## Troubleshooting

### Backend won't start
- Check `DATABASE_URL` is valid
- Ensure PostgreSQL is accessible
- Run migrations: `alembic upgrade head`

### Frontend 404 errors
- Verify `NEXT_PUBLIC_API_URL` is correct
- Check CORS settings on backend
- Ensure backend is running

### WebSocket not connecting
- Check `NEXT_PUBLIC_WS_URL` matches backend
- Verify no proxy blocking WebSocket upgrade
- Check browser console for errors

## Related Documentation

- [Railway Deployment Guide](railway.md) - Complete Railway setup with GitHub integration
- [Production Setup](production.md) - Production server configuration
- [Staging Deployment](staging.md) - Staging environment setup
- [Database Migration Guide](../database/migration-guide.md) - Database setup and migrations

---

**Last Updated:** January 2026  
**Version:** 2.0
