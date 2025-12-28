#!/bin/bash
# KOSMOS AEOS - Post-start script for Codespaces
# Runs every time the container starts

set -e

echo "🔄 KOSMOS AEOS - Starting development services..."

# Navigate to workspace
cd /workspaces/${LOCAL_WORKSPACE_FOLDER_BASENAME:-kosmos}

# Activate Python virtual environment
if [ -f "implementation/backend/.venv/bin/activate" ]; then
    source implementation/backend/.venv/bin/activate
fi

# Check database connection
echo "🔍 Checking database connection..."
until pg_isready -h db -p 5432 -U kosmos 2>/dev/null; do
    echo "  Waiting for PostgreSQL..."
    sleep 2
done
echo "✅ PostgreSQL connection verified"

# Check Redis connection
echo "🔍 Checking Redis connection..."
until redis-cli -h redis ping 2>/dev/null | grep -q PONG; do
    echo "  Waiting for Redis..."
    sleep 2
done
echo "✅ Redis connection verified"

# Update dependencies if needed
echo "📦 Checking for dependency updates..."

# Backend
cd implementation/backend
if [ -f "pyproject.toml" ]; then
    pip install -e ".[dev]" --quiet
elif [ -f "requirements.txt" ]; then
    pip install -r requirements.txt --quiet
fi
cd ../..

# Frontend
cd implementation/frontend
if [ -f "package.json" ]; then
    npm install --silent
fi
cd ../..

echo ""
echo "✅ KOSMOS AEOS is ready for development!"
echo ""
echo "Start commands:"
echo "  npm run dev:all    - Start all services"
echo "  npm run dev:backend  - Start backend only"
echo "  npm run dev:frontend - Start frontend only"
echo ""
