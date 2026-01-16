#!/bin/bash
# Rollback Alembic migrations for KOSMOS DAR

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$BACKEND_DIR"

if [ -z "$1" ]; then
    echo "Usage: $0 <revision>"
    echo "Example: $0 -1  (rollback one revision)"
    echo "Example: $0 base (rollback to base)"
    exit 1
fi

REVISION=$1

echo "Rolling back to revision: $REVISION"

# Check if database is available
if [ -z "$DATABASE_URL" ]; then
    echo "Warning: DATABASE_URL not set, using default"
    export DATABASE_URL="postgresql+asyncpg://kosmos:kosmos_dev_password@localhost:5432/kosmos"
fi

# Show current revision
echo ""
echo "Current revision before rollback:"
alembic current

# Rollback
alembic downgrade "$REVISION"

echo ""
echo "Rollback completed!"
echo ""
echo "Current revision after rollback:"
alembic current
