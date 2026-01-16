#!/bin/bash
# Setup development database with extensions and initial data

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$BACKEND_DIR"

# Database connection details
DB_USER="${POSTGRES_USER:-kosmos}"
DB_PASSWORD="${POSTGRES_PASSWORD:-kosmos_dev_password}"
DB_NAME="${POSTGRES_DB:-kosmos}"
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"

echo "Setting up development database..."
echo "Database: $DB_NAME on $DB_HOST:$DB_PORT"

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo "Error: psql not found. Please install PostgreSQL client tools."
    exit 1
fi

# Set password for psql
export PGPASSWORD="$DB_PASSWORD"

# Create database if it doesn't exist
echo "Creating database if it doesn't exist..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || \
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "CREATE DATABASE $DB_NAME"

# Enable extensions
echo "Enabling PostgreSQL extensions..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" <<EOF
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
EOF

echo "Database setup complete!"
echo ""
echo "Running migrations..."

# Run migrations
cd "$BACKEND_DIR"
alembic upgrade head

echo ""
echo "Development database is ready!"
echo ""
echo "You can connect with:"
echo "  psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME"
