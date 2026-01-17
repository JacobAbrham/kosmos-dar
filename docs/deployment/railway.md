# Railway Deployment Guide

Complete guide for deploying KOSMOS backend to Railway using GitHub integration (recommended) or CLI.

## Overview

Railway is a modern platform-as-a-service (PaaS) that simplifies deployment with automatic builds, environment management, and integrated PostgreSQL/Redis services.

**Recommended Approach:** Connect Railway to GitHub for automatic deployments on push. This is more reliable than CLI uploads.

## Prerequisites

- Railway account ([railway.app](https://railway.app))
- GitHub repository: `JacobAbrham/kosmos-dar`
- Backend code in `implementation/backend/` directory

## Deployment Methods

### Method 1: GitHub Integration (Recommended)

**Why GitHub Integration?**
- ✅ Automatic deployments on push
- ✅ More reliable than CLI uploads
- ✅ Build caching for faster deployments
- ✅ Easy rollback via Railway dashboard
- ✅ Build time: 5-10 minutes (vs 15+ minutes with CLI)

#### Step 1: Create Railway Project

1. Go to [Railway Dashboard](https://railway.app)
2. Click **New Project**
3. Select **Deploy from GitHub repo**
4. Authorize Railway to access your GitHub account (if needed)
5. Select repository: `JacobAbrham/kosmos-dar`

#### Step 2: Configure Backend Service

1. Railway will create a service automatically
2. Click on the service to open settings
3. Go to **Settings** tab
4. Scroll to **Source** section
5. Configure:
   - **Root Directory**: `implementation/backend`
   - **Branch**: `staging` (or `main` for production)
6. Railway will automatically detect `railway.toml` and `Dockerfile`

#### Step 3: Add Required Services

**PostgreSQL Database:**
1. In Railway project, click **+ New**
2. Select **Database** → **Add PostgreSQL**
3. Railway automatically provisions PostgreSQL
4. Note the `DATABASE_URL` connection string (auto-set as environment variable)

**Redis Cache:**
1. Click **+ New**
2. Select **Database** → **Add Redis**
3. Railway automatically provisions Redis
4. Note the `REDIS_URL` connection string (auto-set as environment variable)

#### Step 4: Configure Environment Variables

Go to Backend service → **Variables** tab and add:

**Required Variables:**

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection | Auto-set by Railway PostgreSQL service |
| `REDIS_URL` | Redis connection | Auto-set by Railway Redis service |
| `ANTHROPIC_API_KEY` | Anthropic API key | `sk-ant-...` |
| `JWT_SECRET` | JWT signing secret | Generate: `openssl rand -hex 32` |
| `ENCRYPTION_KEY` | Data encryption key | Generate: `openssl rand -hex 32` |

**Optional Variables:**

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key | - |
| `ZITADEL_CLIENT_ID` | Zitadel OAuth client ID | - |
| `ZITADEL_CLIENT_SECRET` | Zitadel OAuth client secret | - |
| `ZITADEL_ISSUER_URL` | Zitadel issuer URL | - |
| `LOG_LEVEL` | Logging level | `INFO` |
| `DEBUG` | Enable debug mode | `false` |
| `CORS_ORIGINS` | Allowed CORS origins | `*` |

**Generate Secrets:**

```bash
# Generate JWT secret
openssl rand -hex 32

# Generate encryption key
openssl rand -hex 32
```

#### Step 5: Deploy

1. Railway automatically detects the push to the connected branch
2. Build starts automatically
3. Monitor build progress in Railway dashboard → **Deployments** tab
4. Expected build time: 5-10 minutes

**Build Process:**
- Railway detects `Dockerfile` in `implementation/backend/`
- Builds Docker image using Python 3.11-slim base
- Installs dependencies from `requirements.txt`
- Copies application code
- Starts uvicorn server on port 8000

#### Step 6: Verify Deployment

**Check Health Endpoint:**
```bash
curl https://your-app.railway.app/health
```

Expected response:
```json
{"status": "healthy"}
```

**Monitor Logs:**
- Railway dashboard → Backend service → **Deployments** → Click deployment → **View Logs**

### Method 2: Railway CLI (Alternative)

**Note:** CLI uploads can be unreliable and slower. Use GitHub integration when possible.

#### Install Railway CLI

```bash
npm install -g @railway/cli
```

#### Login

```bash
railway login
```

#### Initialize Project

```bash
cd implementation/backend
railway init
```

#### Deploy

```bash
railway up
```

**Issues with CLI:**
- Builds may stall (15+ minutes)
- "Deployment does not have an associated build" errors
- Less reliable than GitHub integration

## Configuration Files

### `implementation/backend/railway.toml`

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

### `implementation/backend/Dockerfile`

The Dockerfile is configured for Railway:
- Python 3.11-slim base image
- Installs dependencies from `requirements.txt`
- Exposes port 8000
- Health check at `/health`
- Runs uvicorn server

## Dependencies

### Dependency Conflicts Fixed

**Issue 1:** `fastapi-zitadel-auth` requires `fastapi>=0.115.4`
- **Solution:** Updated `requirements.txt` to use `fastapi==0.115.6`
- **Status:** ✅ Fixed

**Issue 2:** `fastapi-zitadel-auth 0.3.0` requires `httpx>=0.27.2`
- **Solution:** Updated `requirements.txt` to use `httpx>=0.27.2` (was `httpx==0.25.2`)
- **Status:** ✅ Fixed

**Issue 3:** `langfuse 2.9.0` requires `httpx<0.26.0` (conflicts with `fastapi-zitadel-auth` requirement)
- **Solution:** Updated `requirements.txt` to use `langfuse>=3.0.0` (supports `httpx>=0.27.2`)
- **Status:** ✅ Fixed

**Current Configuration:**
- `fastapi==0.115.6` ✅
- `httpx>=0.27.2` ✅
- `langfuse>=3.0.0` ✅
- `fastapi-zitadel-auth==0.3.0` ✅

All dependency conflicts resolved in `implementation/backend/requirements.txt`

## Monitoring & Troubleshooting

### View Logs

**Via Dashboard:**
1. Railway dashboard → Backend service
2. Click **Deployments** tab
3. Select deployment
4. Click **View Logs**

**Via CLI:**
```bash
railway logs
```

### Common Issues

#### Build Stalls (>15 minutes)

**Symptoms:**
- Build starts but never completes
- "Deployment does not have an associated build" message

**Solutions:**
1. **Use GitHub Integration** - More reliable than CLI
2. Check build logs for errors
3. Verify `railway.toml` configuration
4. Ensure Dockerfile is valid

#### Dependency Conflicts

**Symptoms:**
```
ERROR: Cannot install -r requirements.txt and httpx==0.25.2 because these package versions have conflicting dependencies.
The conflict is caused by:
    The user requested httpx==0.25.2
    fastapi-zitadel-auth 0.3.0 depends on httpx>=0.27.2
```

**Or:**
```
ERROR: Cannot install -r requirements.txt (line 46), -r requirements.txt (line 56) and httpx>=0.27.2 because these package versions have conflicting dependencies.
The conflict is caused by:
    The user requested httpx>=0.27.2
    fastapi-zitadel-auth 0.3.0 depends on httpx>=0.27.2
    langfuse 2.9.0 depends on httpx<0.26.0 and >=0.15.4
```

**Or:**
```
ERROR: fastapi-zitadel-auth 0.3.0 depends on fastapi>=0.115.4
The user requested fastapi==0.109.2
```

**Solutions:**
1. **httpx conflict:** Update `requirements.txt` to use `httpx>=0.27.2` (currently fixed)
2. **langfuse conflict:** Update `requirements.txt` to use `langfuse>=3.0.0` (langfuse 2.9.0 requires httpx<0.26.0 which conflicts with fastapi-zitadel-auth)
3. **FastAPI conflict:** Update `requirements.txt` to use `fastapi>=0.115.4` (currently `0.115.6`)
4. Always check package requirements when adding new dependencies
5. Run `pip check` locally to verify dependency compatibility before deploying

#### Health Check Fails

**Symptoms:**
- Deployment completes but health check fails
- Service shows as unhealthy

**Solutions:**
1. Verify `/health` endpoint exists in backend
2. Check health check timeout (default: 300s)
3. Review application logs for errors
4. Ensure port 8000 is exposed

#### Environment Variables Missing

**Symptoms:**
- Application starts but fails with configuration errors
- Database connection errors

**Solutions:**
1. Verify all required variables are set in Railway dashboard
2. Check variable names match code expectations
3. Ensure PostgreSQL/Redis services are provisioned
4. Review connection strings format

### Performance Optimization

**Build Caching:**
- Railway caches Docker layers automatically
- Subsequent builds are faster (2-5 minutes)

**Resource Limits:**
- Default: 512MB RAM, 1 vCPU
- Upgrade in Railway dashboard → Settings → Resources

## Automatic Deployments

With GitHub integration enabled:

- **Every push** to connected branch triggers automatic build
- **Pull requests** can trigger preview deployments (if configured)
- **Rollback** available via Railway dashboard

**Disable Auto-Deploy:**
- Railway dashboard → Settings → Source
- Toggle "Auto Deploy" off

## Rollback

**Via Dashboard:**
1. Railway dashboard → Backend service
2. Go to **Deployments** tab
3. Find previous successful deployment
4. Click **⋯** → **Redeploy**

**Via CLI:**
```bash
railway rollback
```

## Cost Optimization

**Railway Pricing:**
- Free tier: $5 credit/month
- Usage-based pricing after free tier
- PostgreSQL: $5/month (1GB)
- Redis: $5/month (100MB)

**Tips:**
- Use Railway's free tier for development/staging
- Monitor usage in Railway dashboard
- Set up usage alerts

## Comparison: GitHub vs CLI

| Feature | GitHub Integration | CLI Upload |
|---------|-------------------|------------|
| **Reliability** | ✅ High | ⚠️ Variable |
| **Build Time** | 5-10 minutes | 15+ minutes |
| **Auto-Deploy** | ✅ Yes | ❌ Manual |
| **Build Caching** | ✅ Yes | ⚠️ Limited |
| **Rollback** | ✅ Easy | ⚠️ Manual |
| **Setup** | Simple | Requires CLI |

## Next Steps

After successful deployment:

1. **Configure Custom Domain** (optional)
   - Railway dashboard → Settings → Domains
   - Add custom domain
   - Configure DNS records

2. **Set Up Monitoring**
   - Configure alerts in Railway dashboard
   - Set up external monitoring (if needed)

3. **Database Migrations**
   - Run migrations: `alembic upgrade head`
   - Verify schema in Railway PostgreSQL

4. **Frontend Integration**
   - Update `NEXT_PUBLIC_API_URL` to Railway backend URL
   - Deploy frontend separately (Vercel, Railway, etc.)

## Related Documentation

- [Deployment Overview](../deployment/README.md) - General deployment guide
- [Staging Deployment](staging.md) - Staging environment setup
- [Production Deployment](production.md) - Production server setup

---

**Last Updated:** January 2026  
**Version:** 2.0
