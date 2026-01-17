# Railway Deployment Guide

This guide covers deploying KOSMOS DAR to Railway using GitHub integration.

## Prerequisites

- GitHub repository with the KOSMOS DAR codebase
- Railway account with GitHub connection authorized
- Required environment variables ready

## GitHub Integration Setup

### 1. Connect Repository

1. Go to Railway Dashboard → Your Project
2. Click the backend service → Settings tab
3. In the "Source" section, click "Connect GitHub Repo"
4. Select your repository: `JacobAbrham/kosmos-dar`
5. Set **Root Directory**: `implementation/backend`
6. Set **Branch**: `staging` (or your preferred branch)

### 2. Automatic Deployments

Once connected, Railway will automatically:
- Build and deploy on every push to the configured branch
- Use the Dockerfile in the root directory for builds
- Apply settings from `railway.toml`

## Environment Variables

### Required Variables

| Variable | Description | Source |
|----------|-------------|--------|
| `DATABASE_URL` | PostgreSQL connection string | Railway PostgreSQL service |
| `REDIS_URL` | Redis connection string | Railway Redis service (optional) |
| `NATS_URL` | NATS connection string | External NATS service (optional) |
| `PORT` | Application port | Auto-injected by Railway |

### Setting Environment Variables

1. Go to your service → Variables tab
2. Click "New Variable"
3. For service references (like DATABASE_URL), use the reference syntax:
   - Click "Add Reference"
   - Select the PostgreSQL service
   - Choose `DATABASE_URL`

## Troubleshooting

### Dependency Conflicts

#### FastAPI Version Conflict

**Error:** `fastapi-zitadel-auth 0.3.0 requires fastapi>=0.115.4`

**Solution:** Update `requirements.txt`:
```
fastapi==0.115.6
```

#### httpx Version Conflict

**Error:** `fastapi-zitadel-auth 0.3.0 requires httpx>=0.27.2`

**Solution:** Update `requirements.txt`:
```
httpx>=0.27.2
```

#### langfuse Version Conflict

**Error:** `langfuse 2.9.0 requires httpx<0.26.0` (conflicts with httpx>=0.27.2)

**Solution:** Update `requirements.txt`:
```
langfuse>=3.0.0
```

#### OpenTelemetry Version Conflict

**Error:** `langfuse>=3.0.0 requires opentelemetry-api>=1.33.1`

**Solution:** Update `requirements.txt`:
```
opentelemetry-api>=1.33.1
opentelemetry-sdk>=1.33.1
opentelemetry-instrumentation-fastapi>=0.45b0
opentelemetry-exporter-otlp>=1.33.1
```

### Container Startup Errors

#### "The executable `cd` could not be found"

**Cause:** Custom Start Command in Railway dashboard uses `cd` directly.

**Solution:**
1. Go to Railway Dashboard → Backend Service → Settings
2. Clear the "Start Command" field
3. Let Railway use the Dockerfile's CMD instruction

### Healthcheck Failures

#### Healthcheck Timeout with PORT Mismatch

**Symptoms:**
- Build succeeds
- Application starts (logs show "Uvicorn running on http://0.0.0.0:8000")
- Healthcheck fails after ~5 minutes

**Cause:** Railway injects a `PORT` environment variable, but the app is hardcoded to port 8000.

**Solution:** Update Dockerfile to use the PORT variable:
```dockerfile
# Run application - MUST use PORT env var for Railway compatibility
CMD sh -c "exec python -m uvicorn main:app --host 0.0.0.0 --port \${PORT:-8000}"
```

#### Missing Database Connection

**Symptoms:**
- Application crashes during startup
- Logs show: `sqlalchemy.exc.ArgumentError: Could not parse SQLAlchemy URL from string ''`

**Solution:**
1. Ensure PostgreSQL service is provisioned in Railway
2. Link `DATABASE_URL` variable to the PostgreSQL service
3. Use the "Add Reference" button to properly link the variable

### Circular Import Errors

**Symptoms:**
- `ImportError: cannot import name 'X' from partially initialized module`

**Solution:** Use lazy imports and `TYPE_CHECKING` blocks for type hints. See `core/intent_router.py` for examples.

### Rate Limiting Errors

**Symptoms:**
- `AttributeError: 'NoneType' object has no attribute 'incr'`
- Occurs when Redis is not configured

**Solution:** The `RateLimitMiddleware` now gracefully handles missing cache. Ensure you're using the latest code that includes this fix.

## Configuration Files

### railway.toml

```toml
[build]
builder = "dockerfile"
dockerfilePath = "Dockerfile"

[deploy]
healthcheckPath = "/health"
healthcheckTimeout = 300
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3
```

### Dockerfile Key Points

- Uses Python 3.11-slim base image
- Sets `PYTHONPATH=/app` for proper module resolution
- Uses `PORT` environment variable for Railway compatibility
- Health check configured for `/health` endpoint

## Monitoring

### Viewing Logs

1. Go to your service → Deployments tab
2. Click on a deployment
3. Select "Deploy Logs" tab for runtime logs
4. Select "Build Logs" tab for build-time logs

### Checking Health

- Health endpoint: `GET /health`
- Returns: `{"status": "healthy", "version": "2.0.0-alpha", "service": "kosmos-backend"}`

## See Also

- [Railway Checklist](./railway-checklist.md) - Pre-deployment checklist
- [Architecture Overview](../architecture/overview.md)
