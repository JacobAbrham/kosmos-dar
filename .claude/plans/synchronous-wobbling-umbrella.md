# Plan: Deploy KOSMOS DAR to Railway

## Goal
Run KOSMOS DAR services on Railway cloud platform instead of local Docker Desktop.

## Services to Deploy

| Service | Railway Type | Priority |
|---------|--------------|----------|
| PostgreSQL | Managed Database | Required |
| Redis | Managed Database | Required |
| Backend (FastAPI) | Docker Container | Required |
| Frontend (Next.js) | Docker Container | Required |
| NATS | Docker Container | Required |
| Zitadel | Use Zitadel Cloud | Optional (can skip initially) |
| Langfuse | Use Langfuse Cloud | Optional (can skip initially) |

---

## Implementation Steps

### Step 1: Create Railway Account & Project
1. Sign up at https://railway.app
2. Create new project "kosmos-dar"
3. Install Railway CLI: `npm install -g @railway/cli`
4. Login: `railway login`

### Step 2: Deploy Managed Services (Database & Cache)
Deploy these as Railway services (not containers):

**PostgreSQL with pgvector:**
- Railway → Add Service → Database → PostgreSQL
- After creation, add pgvector extension via SQL console:
  ```sql
  CREATE EXTENSION IF NOT EXISTS vector;
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
  CREATE EXTENSION IF NOT EXISTS pgcrypto;
  ```
- Create additional databases:
  ```sql
  CREATE DATABASE zitadel;
  CREATE DATABASE langfuse;
  ```

**Redis:**
- Railway → Add Service → Database → Redis

### Step 3: Update Environment Variables
Create `.env.railway` with cloud URLs:

```env
# Database (from Railway dashboard)
DATABASE_URL=postgresql+asyncpg://<user>:<pass>@<host>:5432/railway

# Redis (from Railway dashboard)
REDIS_URL=redis://default:<pass>@<host>:6379

# NATS - use free NATS.io cloud or deploy as container
NATS_URL=nats://<nats-host>:4222

# Secrets (generate new ones)
JWT_SECRET=<generate-32-char-string>
KOSMOS_SECRET_KEY=<generate-32-char-string>

# LLM Keys
ANTHROPIC_API_KEY=<your-key>
OPENAI_API_KEY=<your-key>

# Frontend URLs (update after deployment)
NEXT_PUBLIC_API_URL=https://<backend-service>.railway.app
NEXT_PUBLIC_WS_URL=wss://<backend-service>.railway.app/ws
```

### Step 4: Deploy Backend Service
```bash
cd implementation/backend
railway link  # Select kosmos-dar project
railway up --dockerfile ../docker/Dockerfile.backend
```

### Step 5: Deploy Frontend Service
```bash
cd implementation/frontend
railway link
railway up --dockerfile ../../docker/Dockerfile.frontend
```

### Step 6: Run Database Migrations
```bash
# Connect to Railway's environment
railway run python -m alembic upgrade head
```

---

## Files to Create/Modify

| File | Change |
|------|--------|
| `railway.toml` | New - Railway deployment configuration |
| `.env.railway` | New - Cloud environment variables template |

---

## Verification

1. **Check backend health:**
   ```bash
   curl https://<backend>.up.railway.app/api/v1/health
   ```

2. **Run migrations via Railway CLI:**
   ```bash
   railway run -s backend alembic upgrade head
   ```

3. **Check frontend:**
   - Visit https://<frontend>.up.railway.app

---

## Cost Estimate

Railway Hobby Plan: $5/month (includes $5 credit)
- PostgreSQL: ~$5-10/month
- Redis: ~$3-5/month
- Backend + Frontend containers: ~$10-15/month
- **Total:** ~$20-30/month for development
