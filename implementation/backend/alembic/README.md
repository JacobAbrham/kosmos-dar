# KOSMOS V2.0 Database Migrations

This directory contains Alembic database migrations for KOSMOS V2.0.

## Prerequisites

Ensure the database is running:
```bash
docker-compose up -d postgres
```

## Common Commands

### Create a New Migration

Auto-generate migration from model changes:
```bash
cd implementation/backend
alembic revision --autogenerate -m "description of changes"
```

Create an empty migration:
```bash
alembic revision -m "description of changes"
```

### Apply Migrations

Upgrade to the latest version:
```bash
alembic upgrade head
```

Upgrade by one version:
```bash
alembic upgrade +1
```

Upgrade to a specific revision:
```bash
alembic upgrade <revision_id>
```

### Rollback Migrations

Downgrade by one version:
```bash
alembic downgrade -1
```

Downgrade to a specific revision:
```bash
alembic downgrade <revision_id>
```

Rollback all migrations:
```bash
alembic downgrade base
```

### View Migration History

Show current revision:
```bash
alembic current
```

Show migration history:
```bash
alembic history
```

Show pending migrations:
```bash
alembic history --verbose
```

## Migration Structure

- `env.py` - Alembic environment configuration
- `script.py.mako` - Template for generating migration files
- `versions/` - Directory containing migration scripts

## Notes

- Alembic is configured to use async SQLAlchemy engine
- Database URL is automatically loaded from `core.config.settings`
- All migrations run within transactions
- Type comparison and server default comparison are enabled
- For manual schema changes, edit the SQL files in `/database/init/` (for initial setup) or create Alembic migrations (for updates)

## Integration with Existing Schema

The KOSMOS database has an initial schema defined in `/database/init/001_initial_schema.sql`.

To sync Alembic with the existing schema:

1. **First time setup** (if database already exists with schema):
   ```bash
   alembic stamp head
   ```

2. **After schema changes**, create a migration:
   ```bash
   alembic revision --autogenerate -m "your changes"
   ```

3. **Apply the migration**:
   ```bash
   alembic upgrade head
   ```

## Troubleshooting

### Connection Issues
- Ensure PostgreSQL is running: `docker-compose ps postgres`
- Check connection string in `.env` file
- Verify `DATABASE_URL` environment variable

### Migration Conflicts
- If autogenerate detects unwanted changes, review and edit the migration file before applying
- Use `alembic downgrade` to rollback if needed

### Schema Out of Sync
- Compare database state: `alembic current`
- Review pending migrations: `alembic history`
- Stamp database if needed: `alembic stamp <revision>`
