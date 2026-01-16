# Alembic Migrations for KOSMOS DAR

This directory contains Alembic database migrations for KOSMOS DAR.

## Quick Start

### Run Migrations

```bash
# From project root
make db-migrate

# Or directly
cd implementation/backend
alembic upgrade head
```

### Check Current Revision

```bash
make db-current

# Or directly
cd implementation/backend
alembic current
```

### Rollback Migrations

```bash
# Rollback one revision
make db-rollback REVISION=-1

# Rollback to base (removes all migrations)
make db-rollback REVISION=base

# Or directly
cd implementation/backend
alembic downgrade -1
```

### View Migration History

```bash
make db-history

# Or directly
cd implementation/backend
alembic history
```

## Migration Structure

The initial migration (`4f5bf96601b3_initial_schema.py`) includes:

- **Schemas:** core, agents, governance, knowledge, audit, mcp, workflows, routing
- **Tables:** All tables from migrations 001, 002, 003, 010, 011
- **Indexes:** Including vector indexes (HNSW) for embeddings
- **RLS Policies:** Multi-tenant isolation policies
- **Functions:** Routing, workflow, and audit functions
- **Views:** Active workflows, agent performance, tool popularity
- **Seed Data:** Agent registry, MCP servers, intent categories

## Testing Migrations

Run migration tests:

```bash
make db-test-migrations

# Or directly
cd implementation/backend
pytest tests/test_migrations.py -v -m migration
```

## Creating New Migrations

```bash
cd implementation/backend

# Auto-generate migration from model changes
alembic revision --autogenerate -m "description"

# Create empty migration
alembic revision -m "description"
```

## Environment Variables

Set `DATABASE_URL` before running migrations:

```bash
export DATABASE_URL="postgresql+asyncpg://kosmos:password@localhost:5432/kosmos"
```

Or use `.env` file in `implementation/backend/` directory.

## Important Notes

1. **Always backup** before running migrations in production
2. **Test migrations** in development/staging first
3. **Review generated migrations** before applying (especially autogenerate)
4. **Vector indexes** require pgvector extension (already included in migration)
5. **RLS policies** are automatically enabled on tenant-scoped tables

## Troubleshooting

### Migration fails with "relation already exists"
- Database may have been partially migrated
- Check current revision: `alembic current`
- Manually fix or rollback and retry

### Vector extension not found
- Ensure PostgreSQL has pgvector extension installed
- Migration includes `CREATE EXTENSION IF NOT EXISTS "vector"`

### RLS policies not working
- Verify policies exist: `SELECT * FROM pg_policies WHERE schemaname = 'core'`
- Check RLS is enabled: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'core'`
