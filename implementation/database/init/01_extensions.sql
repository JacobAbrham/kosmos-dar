-- =============================================================================
-- KOSMOS V2.0 Database Initialization - Extensions
-- =============================================================================

-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";           -- pgvector for embeddings
CREATE EXTENSION IF NOT EXISTS "pg_trgm";          -- Trigram for fuzzy search
CREATE EXTENSION IF NOT EXISTS "btree_gin";        -- GIN index support

-- Create additional databases for services
CREATE DATABASE zitadel;
CREATE DATABASE langfuse;
CREATE DATABASE litellm;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE zitadel TO kosmos;
GRANT ALL PRIVILEGES ON DATABASE langfuse TO kosmos;
GRANT ALL PRIVILEGES ON DATABASE litellm TO kosmos;
