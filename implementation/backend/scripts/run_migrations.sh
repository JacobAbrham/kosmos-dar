#!/bin/bash
# Run Alembic migrations for KOSMOS DAR

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$BACKEND_DIR"

echo "Running Alembic migrations..."

# Check if database is available
if [ -z "$DATABASE_URL" ]; then
    echo "Warning: DATABASE_URL not set, using default"
    export DATABASE_URL="postgresql+asyncpg://kosmos:kosmos_dev_password@localhost:5432/kosmos"
fi

# Run migrations
alembic upgrade head

echo "Migrations completed successfully!"

# Show current revision
echo ""
echo "Current database revision:"
alembic current
