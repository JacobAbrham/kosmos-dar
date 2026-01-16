# Database Migration Guide

**Last Updated:** January 2026  
**Status:** ✅ Alembic migrations ready

---

## Overview

KOSMOS DAR uses Alembic for database migrations. All SQL migrations have been converted to Alembic format and are ready to run.

## Quick Start

### 1. Setup Development Database

```bash
# Using the setup script
cd implementation/backend
./scripts/setup_dev_db.sh

# Or manually
make db-migrate
```

### 2. Run Migrations

```bash
# From project root
make db-migrate

# Or directly
cd implementation/backend
alembic upgrade head
```

### 3. Verify Migration

```bash
# Check current revision
make db-current

# Should show: 4f5bf96601b3 (head)
```

## Migration Contents

The initial migration (`4f5bf96601b3_initial_schema.py`) includes:

### Schemas Created
- `core` - Core tables (tenants, users, conversations, messages)
- `agents` - Agent registry, state, metrics
- `governance` - Proposals, votes, cost tracking
- `knowledge` - Documents, chunks, entities, relations
- `audit` - Audit logging
- `mcp` - MCP server registry and invocations
- `workflows` - Workflow definitions, runs, schedules
- `routing` - Intent categories, intents, routing decisions

### Key Features
- ✅ All tables with proper types (including pgvector)
- ✅ All indexes (including HNSW vector indexes)
- ✅ RLS policies for multi-tenancy
- ✅ Foreign key constraints
- ✅ Database functions (routing, workflow, audit)
- ✅ Views (active workflows, agent performance, tool popularity)
- ✅ Seed data (agent registry, MCP servers, intent categories)

## Testing Migrations

```bash
# Run migration tests
make db-test-migrations

# Or directly
cd implementation/backend
pytest tests/test_migrations.py -v -m migration
```

## Rollback

```bash
# Rollback one revision
make db-rollback REVISION=-1

# Rollback to base (removes all migrations)
make db-rollback REVISION=base
```

## Environment Variables

Set these before running migrations:

```bash
export DATABASE_URL="postgresql+asyncpg://kosmos:password@localhost:5432/kosmos"
export POSTGRES_USER="kosmos"
export POSTGRES_PASSWORD="kosmos_dev_password"
export POSTGRES_DB="kosmos"
```

## Docker Setup

If using Docker Compose:

```bash
# Start services
docker compose up -d postgres

# Wait for PostgreSQL to be ready
docker compose exec postgres pg_isready -U kosmos

# Run migrations
make db-migrate
```

## Troubleshooting

### Migration Already Applied

If you see "Target database is not up to date":

```bash
# Check current revision
alembic current

# If it shows a revision, you may need to stamp it
alembic stamp head
```

### Extensions Not Found

Ensure PostgreSQL has required extensions:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
```

The migration includes these, but they require superuser privileges.

### RLS Policies Not Working

Verify policies exist:

```sql
SELECT * FROM pg_policies WHERE schemaname = 'core';
```

Check RLS is enabled:

```sql
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'core';
```

## Next Steps

After running migrations:

1. ✅ Verify all tables exist
2. ✅ Test RLS policies work correctly
3. ✅ Verify seed data loaded (agent registry, etc.)
4. ✅ Test vector indexes work
5. ✅ Run migration tests

---

**See Also:**
- `implementation/backend/alembic/README.md` - Detailed Alembic usage
- `implementation/backend/tests/test_migrations.py` - Migration tests
- `docs/status/implementation-summary-jan-2026.md` - Implementation summary
