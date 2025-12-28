---
sidebar_position: 1
title: Environment Variables
description: Complete configuration reference for KOSMOS V2.0
---

# Environment Variables

Complete reference for all KOSMOS configuration options.

:::info Auto-Generated
This documentation is automatically extracted from the Pydantic settings classes.
:::

Application settings loaded from environment variables.

## Core

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `KOSMOS_ENV` | `str` | `"development"` | Configure env |
| `KOSMOS_DEBUG` | `bool` | `True` | Configure debug |
| `KOSMOS_SECRET_KEY` | `str` | `"change-me-in-production"` | Configure secret key |
| `KOSMOS_LOG_LEVEL` | `str` | `"INFO"` | Configure log level |

## Database

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `KOSMOS_DATABASE_URL` | `str` | `"postgresql+asyncpg://kosmos:kosmos_dev_password@localhost:5432/kosmos"` | Configure database url |

## Cache

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `KOSMOS_REDIS_URL` | `str` | `"redis://localhost:6379"` | Configure redis url |

## Messaging

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `KOSMOS_NATS_URL` | `str` | `"nats://localhost:4222"` | Configure nats url |

## Storage

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `KOSMOS_MINIO_HOST` | `str` | `"localhost"` | Configure minio host |
| `KOSMOS_MINIO_PORT` | `int` | `9000` | Configure minio port |
| `KOSMOS_MINIO_ACCESS_KEY` | `str` | `"minioadmin"` | Configure minio access key |
| `KOSMOS_MINIO_SECRET_KEY` | `str` | `"minioadmin"` | Configure minio secret key |
| `KOSMOS_MINIO_BUCKET` | `str` | `"kosmos"` | Configure minio bucket |

## Authentication

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `KOSMOS_ZITADEL_DOMAIN` | `str` | `"localhost:8080"` | Configure zitadel domain |
| `KOSMOS_ZITADEL_PROJECT_ID` | `Optional[str]` | `None` | Configure zitadel project id |
| `KOSMOS_ZITADEL_CLIENT_ID` | `Optional[str]` | `None` | Configure zitadel client id |
| `KOSMOS_ZITADEL_CLIENT_SECRET` | `Optional[str]` | `None` | Configure zitadel client secret |

## LLM Providers

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `KOSMOS_OPENAI_API_KEY` | `Optional[str]` | `None` | Configure openai api key |
| `KOSMOS_ANTHROPIC_API_KEY` | `Optional[str]` | `None` | Configure anthropic api key |
| `KOSMOS_HUGGINGFACE_API_KEY` | `Optional[str]` | `None` | Configure huggingface api key |
| `KOSMOS_LITELLM_URL` | `str` | `"http://localhost:4000"` | Configure litellm url |
| `KOSMOS_LITELLM_MASTER_KEY` | `Optional[str]` | `None` | Configure litellm master key |

## Observability

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `KOSMOS_LANGFUSE_PUBLIC_KEY` | `Optional[str]` | `None` | Configure langfuse public key |
| `KOSMOS_LANGFUSE_SECRET_KEY` | `Optional[str]` | `None` | Configure langfuse secret key |
| `KOSMOS_LANGFUSE_HOST` | `str` | `"http://localhost:3001"` | Configure langfuse host |
| `KOSMOS_JAEGER_AGENT_HOST` | `str` | `"localhost"` | Configure jaeger agent host |
| `KOSMOS_JAEGER_AGENT_PORT` | `int` | `6831` | Configure jaeger agent port |

## CORS

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `KOSMOS_CORS_ORIGINS` | `List[str]` | `["http://localhost:3000", "http://localhost:8000"]` | Configure cors origins |

## Agent Settings

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `KOSMOS_ZEUS_MAX_ITERATIONS` | `int` | `10` | Configure zeus max iterations |
| `KOSMOS_ZEUS_TIMEOUT_SECONDS` | `int` | `120` | Configure zeus timeout seconds |
| `KOSMOS_PENTARCHY_VOTE_TIMEOUT_SECONDS` | `int` | `30` | Configure pentarchy vote timeout seconds |

## Cost Governance

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `KOSMOS_COST_AUTO_APPROVE_MAX` | `float` | `50.0` | Configure cost auto approve max |
| `KOSMOS_COST_PENTARCHY_VOTE_MAX` | `float` | `100.0` | Configure cost pentarchy vote max |
| `KOSMOS_COST_DAILY_LIMIT` | `float` | `500.0` | Configure cost daily limit |
| `KOSMOS_COST_MONTHLY_LIMIT` | `float` | `10000.0` | Configure cost monthly limit |

## Example `.env` File

```bash
# Core Settings
KOSMOS_ENV=production
KOSMOS_DEBUG=false
KOSMOS_SECRET_KEY=your-secret-key-here
KOSMOS_LOG_LEVEL=INFO

# Database
KOSMOS_DATABASE_URL=postgresql+asyncpg://user:pass@db.example.com:5432/kosmos

# Cache & Messaging
KOSMOS_REDIS_URL=redis://redis.example.com:6379
KOSMOS_NATS_URL=nats://nats.example.com:4222

# Storage
KOSMOS_MINIO_HOST=minio.example.com
KOSMOS_MINIO_PORT=9000
KOSMOS_MINIO_ACCESS_KEY=your-access-key
KOSMOS_MINIO_SECRET_KEY=your-secret-key
KOSMOS_MINIO_BUCKET=kosmos

# Authentication (Zitadel)
KOSMOS_ZITADEL_DOMAIN=auth.example.com
KOSMOS_ZITADEL_PROJECT_ID=your-project-id
KOSMOS_ZITADEL_CLIENT_ID=your-client-id
KOSMOS_ZITADEL_CLIENT_SECRET=your-client-secret

# LLM Providers
KOSMOS_OPENAI_API_KEY=sk-...
KOSMOS_ANTHROPIC_API_KEY=sk-ant-...
KOSMOS_LITELLM_URL=http://litellm:4000
KOSMOS_LITELLM_MASTER_KEY=sk-...

# Observability
KOSMOS_LANGFUSE_PUBLIC_KEY=pk-...
KOSMOS_LANGFUSE_SECRET_KEY=sk-...
KOSMOS_LANGFUSE_HOST=http://langfuse:3001
KOSMOS_JAEGER_AGENT_HOST=jaeger
KOSMOS_JAEGER_AGENT_PORT=6831

# Cost Governance
KOSMOS_COST_AUTO_APPROVE_MAX=50.0
KOSMOS_COST_PENTARCHY_VOTE_MAX=100.0
KOSMOS_COST_DAILY_LIMIT=500.0
KOSMOS_COST_MONTHLY_LIMIT=10000.0
```

:::tip Secrets Management
In production, use a secrets manager like HashiCorp Vault or cloud provider secrets service.
Store sensitive values as Kubernetes secrets or similar.
:::
