# ============================================================================
# KOSMOS Makefile - Common Development Commands
# ============================================================================

.PHONY: help install dev build test lint clean docker-up docker-down deploy-staging deploy-prod

# Default target
help:
	@echo "KOSMOS Development Commands"
	@echo "=========================="
	@echo ""
	@echo "Local Development:"
	@echo "  make install     - Install all dependencies"
	@echo "  make dev         - Start development server (native)"
	@echo "  make dev-docker  - Start development server (Docker)"
	@echo "  make build       - Build for production"
	@echo "  make test        - Run tests"
	@echo "  make lint        - Run linter"
	@echo ""
	@echo "Docker:"
	@echo "  make docker-up   - Start all services"
	@echo "  make docker-down - Stop all services"
	@echo "  make docker-logs - View logs"
	@echo "  make docker-clean- Remove containers and volumes"
	@echo ""
	@echo "Deployment:"
	@echo "  make deploy-staging - Deploy to staging"
	@echo "  make deploy-prod    - Deploy to production"
	@echo ""

# --------------------------------------------------------------------------
# Local Development
# --------------------------------------------------------------------------

install:
	cd implementation/frontend && npm ci --include=dev

dev:
	cd implementation/frontend && npm run dev

build:
	cd implementation/frontend && npm run build

test:
	cd implementation/frontend && npm run test

lint:
	cd implementation/frontend && npm run lint

type-check:
	cd implementation/frontend && npm run type-check

clean:
	rm -rf implementation/frontend/.next
	rm -rf implementation/frontend/node_modules

# --------------------------------------------------------------------------
# Docker Development
# --------------------------------------------------------------------------

docker-up:
	docker compose up -d

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f

docker-build:
	docker compose build --no-cache

docker-clean:
	docker compose down -v --remove-orphans
	docker system prune -f

dev-docker:
	docker compose up -d postgres redis
	cd implementation/frontend && npm run dev

# --------------------------------------------------------------------------
# Deployment
# --------------------------------------------------------------------------

deploy-staging:
	git push origin staging

deploy-prod:
	@echo "⚠️  Production deployment requires manual approval"
	@echo "Push to main branch or use: gh workflow run deploy-prod.yml"
	git push origin main

# --------------------------------------------------------------------------
# Database
# --------------------------------------------------------------------------

db-migrate:
	cd implementation/backend && alembic upgrade head

db-rollback:
	@echo "Usage: make db-rollback REVISION=-1"
	@echo "Or: make db-rollback REVISION=base"
	cd implementation/backend && alembic downgrade $(REVISION)

db-current:
	cd implementation/backend && alembic current

db-history:
	cd implementation/backend && alembic history

db-shell:
	docker compose exec postgres psql -U kosmos -d kosmos

db-test-migrations:
	cd implementation/backend && pytest tests/test_migrations.py -v -m migration

# --------------------------------------------------------------------------
# Utilities
# --------------------------------------------------------------------------

logs-frontend:
	docker compose logs -f frontend

logs-backend:
	docker compose logs -f backend

shell-frontend:
	docker compose exec frontend sh

shell-backend:
	docker compose exec backend sh
