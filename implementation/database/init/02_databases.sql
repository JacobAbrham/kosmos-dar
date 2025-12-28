-- Create additional databases needed by optional services.
--
-- This script runs only on a fresh Postgres volume (first container start).
-- It is safe to re-run manually (it uses conditional checks).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'langfuse') THEN
    CREATE DATABASE langfuse;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'litellm') THEN
    CREATE DATABASE litellm;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'zitadel') THEN
    CREATE DATABASE zitadel;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'zitadel_user') THEN
    CREATE ROLE zitadel_user WITH LOGIN PASSWORD 'ZitadelDbPass123!';
  END IF;

  GRANT ALL PRIVILEGES ON DATABASE zitadel TO zitadel_user;
END
$$;
