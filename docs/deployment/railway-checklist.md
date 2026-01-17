# Railway GitHub Integration Checklist

Quick checklist for connecting Railway to GitHub and resolving build issues.

## Pre-Deployment Verification

- [x] FastAPI dependency fixed (`fastapi==0.115.6` in `requirements.txt`)
- [x] httpx dependency fixed (`httpx>=0.27.2` in `requirements.txt`)
- [x] langfuse dependency fixed (`langfuse>=3.0.0` in `requirements.txt`)
- [x] Railway configuration files present (`railway.toml`, `Dockerfile`)
- [x] Backend code pushed to GitHub repository

## Railway GitHub Integration Steps

### Step 1: Connect Repository

- [ ] Go to [Railway Dashboard](https://railway.app)
- [ ] Click **New Project** (or select existing project)
- [ ] Select **Deploy from GitHub repo**
- [ ] Authorize Railway to access GitHub (if needed)
- [ ] Select repository: `JacobAbrham/kosmos-dar`
- [ ] Click **Deploy**

### Step 2: Configure Backend Service

- [ ] Click on the backend service in Railway dashboard
- [ ] Go to **Settings** tab
- [ ] Scroll to **Source** section
- [ ] Configure:
  - [ ] **Root Directory**: `implementation/backend`
  - [ ] **Branch**: `staging` (or `main` for production)
- [ ] Verify `railway.toml` is detected (shows Dockerfile builder)

### Step 3: Add Required Services

**PostgreSQL:**
- [ ] In Railway project, click **+ New**
- [ ] Select **Database** → **Add PostgreSQL**
- [ ] Verify `DATABASE_URL` is automatically set as environment variable

**Redis:**
- [ ] Click **+ New**
- [ ] Select **Database** → **Add Redis**
- [ ] Verify `REDIS_URL` is automatically set as environment variable

### Step 4: Configure Environment Variables

Go to Backend service → **Variables** tab:

**Required Variables:**
- [ ] `ANTHROPIC_API_KEY` - Set your Anthropic API key
- [ ] `JWT_SECRET` - Generate: `openssl rand -hex 32`
- [ ] `ENCRYPTION_KEY` - Generate: `openssl rand -hex 32`
- [ ] `DATABASE_URL` - Auto-set by PostgreSQL service (verify)
- [ ] `REDIS_URL` - Auto-set by Redis service (verify)

**Optional Variables:**
- [ ] `OPENAI_API_KEY` - If using OpenAI
- [ ] `ZITADEL_CLIENT_ID` - If using Zitadel auth
- [ ] `ZITADEL_CLIENT_SECRET` - If using Zitadel auth
- [ ] `ZITADEL_ISSUER_URL` - If using Zitadel auth
- [ ] `LOG_LEVEL` - Set to `INFO` (default)
- [ ] `DEBUG` - Set to `false` (default)

### Step 5: Monitor First Deployment

- [ ] Go to Railway dashboard → **Deployments** tab
- [ ] Verify build starts automatically after GitHub connection
- [ ] Monitor build logs for:
  - [ ] Dependency installation completes without errors
  - [ ] Docker build progresses successfully
  - [ ] Health check passes
- [ ] Expected build time: 5-10 minutes

### Step 6: Verify Deployment

- [ ] Check health endpoint: `curl https://your-app.railway.app/health`
- [ ] Expected response: `{"status": "healthy"}`
- [ ] Review application logs for any errors
- [ ] Test API endpoints if possible

## Troubleshooting

### Build Stalls or Fails

**If build takes >15 minutes:**
- [ ] Check build logs in Railway dashboard
- [ ] Verify `railway.toml` configuration is correct
- [ ] Ensure `Dockerfile` exists in `implementation/backend/`
- [ ] Check for dependency conflicts in logs

**If "Deployment does not have an associated build":**
- [ ] Verify GitHub repository is connected
- [ ] Check that code is pushed to the configured branch
- [ ] Try disconnecting and reconnecting GitHub repo
- [ ] Use GitHub integration instead of CLI

### Dependency Errors

**If FastAPI version conflict:**
- [ ] Verify `requirements.txt` has `fastapi==0.115.6`
- [ ] Check that `fastapi-zitadel-auth==0.3.0` is present
- [ ] Rebuild deployment after fixing requirements

**If httpx version conflict:**
- [ ] Verify `requirements.txt` has `httpx>=0.27.2` (required by fastapi-zitadel-auth 0.3.0)
- [ ] Check that `fastapi-zitadel-auth==0.3.0` is present
- [ ] Rebuild deployment after fixing requirements

**If langfuse version conflict:**
- [ ] Verify `requirements.txt` has `langfuse>=3.0.0` (langfuse 2.9.0 requires httpx<0.26.0 which conflicts with fastapi-zitadel-auth)
- [ ] Check that `httpx>=0.27.2` is present
- [ ] Rebuild deployment after fixing requirements

### Health Check Fails

- [ ] Verify `/health` endpoint exists in backend code
- [ ] Check health check timeout (default: 300s)
- [ ] Review application logs for startup errors
- [ ] Ensure port 8000 is exposed in Dockerfile

### Environment Variable Issues

- [ ] Verify all required variables are set
- [ ] Check variable names match code expectations
- [ ] Ensure PostgreSQL/Redis services are provisioned
- [ ] Review connection string formats

## Success Criteria

- [ ] Build completes in <10 minutes
- [ ] Health check passes
- [ ] Application logs show successful startup
- [ ] No dependency conflicts in build logs
- [ ] Environment variables are correctly set
- [ ] Database and Redis connections work

## Next Steps After Successful Deployment

- [ ] Configure custom domain (optional)
- [ ] Set up monitoring and alerts
- [ ] Run database migrations if needed
- [ ] Update frontend `NEXT_PUBLIC_API_URL` to Railway backend URL
- [ ] Test end-to-end functionality

## Reference

- [Full Railway Deployment Guide](railway.md) - Detailed documentation
- [Deployment Overview](README.md) - General deployment guide

---

**Last Updated:** January 2026
