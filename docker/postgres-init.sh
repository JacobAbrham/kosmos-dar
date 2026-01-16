#!/bin/bash
set -e

# Create additional databases for services
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Create Zitadel database
    CREATE DATABASE zitadel;
    GRANT ALL PRIVILEGES ON DATABASE zitadel TO $POSTGRES_USER;

    -- Create Langfuse database
    CREATE DATABASE langfuse;
    GRANT ALL PRIVILEGES ON DATABASE langfuse TO $POSTGRES_USER;

    -- Create LiteLLM database
    CREATE DATABASE litellm;
    GRANT ALL PRIVILEGES ON DATABASE litellm TO $POSTGRES_USER;
EOSQL

# Enable required extensions on main database (don't fail on missing extensions)
psql --username "$POSTGRES_USER" --dbname "kosmos" <<-EOSQL
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    CREATE EXTENSION IF NOT EXISTS "pg_trgm";
    -- vector extension requires pgvector image, skip if not available
    DO \$\$
    BEGIN
        CREATE EXTENSION IF NOT EXISTS "vector";
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'pgvector extension not available, skipping';
    END
    \$\$;
EOSQL

echo "Multiple databases created successfully"
