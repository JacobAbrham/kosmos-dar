# KOSMOS DAR MCP Servers Reference

**Purpose:** MCP server catalog and usage reference  
**Last Updated:** January 2026  
**Version:** 2.0

---

## Overview

KOSMOS DAR integrates **88 MCP servers** across **9 domains** to provide comprehensive tool access for AI agents. MCP (Model Context Protocol) is standardized by Anthropic and the Linux Foundation.

---

## MCP Server Domains

### 1. Database & Storage (12 servers)
- `mcp-postgresql` - PostgreSQL operations
- `mcp-vector` - Vector operations
- `mcp-redis` - Redis operations
- `mcp-minio` - MinIO object storage
- `mcp-elasticsearch` - Elasticsearch
- `mcp-neo4j` - Neo4j graph database
- `mcp-timescale` - TimescaleDB time-series
- `mcp-duckdb` - DuckDB analytics
- `mcp-sqlite` - SQLite operations
- `mcp-mongodb` - MongoDB operations
- `mcp-qdrant` - Qdrant vector database ✅ Implemented
- `mcp-weaviate` - Weaviate vector database

**Status:** 1/12 implemented

---

### 2. AI & Reasoning (15 servers)
- `mcp-litellm` - LiteLLM proxy
- `mcp-langfuse` - Langfuse observability ✅ Implemented
- `sequential-thinking` - Step-by-step reasoning ✅ Implemented
- `memory-server` - Memory operations
- `context7-mcp` - External documentation
- `mcp-anthropic` - Anthropic Claude API ✅ Implemented
- `mcp-openai` - OpenAI API
- `mcp-huggingface` - Hugging Face models
- `mcp-ollama` - Ollama local models
- `mcp-embeddings` - Embedding generation
- `prompt-armor` - Prompt security
- `mcp-guardrails` - Output guardrails
- `mcp-haystack` - Haystack RAG
- `mcp-llama-index` - LlamaIndex RAG
- `mcp-ragas` - RAG evaluation

**Status:** 3/15 implemented

---

### 3. Productivity & Communication (15 servers)
- `mcp-gmail` - Gmail integration
- `mcp-outlook` - Outlook integration
- `mcp-slack` - Slack integration
- `mcp-teams` - Microsoft Teams
- `mcp-discord` - Discord integration
- `mcp-google-calendar` - Google Calendar ✅ Implemented
- `mcp-notion` - Notion integration
- `mcp-confluence` - Confluence integration
- `mcp-jira` - Jira integration
- `mcp-linear` - Linear issue tracking
- `mcp-asana` - Asana project management
- `mcp-zoom` - Zoom meetings
- `mcp-google-meet` - Google Meet
- `mcp-figma` - Figma design
- `mcp-miro` - Miro whiteboard

**Status:** 1/15 implemented

---

### 4. DevOps & Infrastructure (13 servers)
- `mcp-github` - GitHub operations ✅ Implemented
- `mcp-gitlab` - GitLab operations
- `mcp-docker` - Docker operations ✅ Implemented
- `mcp-kubernetes` - Kubernetes operations ✅ Implemented
- `mcp-terraform` - Terraform infrastructure
- `mcp-ansible` - Ansible automation
- `mcp-argocd` - ArgoCD GitOps
- `mcp-prometheus` - Prometheus metrics
- `mcp-grafana` - Grafana dashboards
- `mcp-datadog` - Datadog monitoring
- `mcp-pagerduty` - PagerDuty alerts
- `mcp-opsgenie` - Opsgenie alerts
- `mcp-nats` - NATS messaging ✅ Implemented

**Status:** 4/13 implemented

---

### 5. Security (10 servers)
- `mcp-zitadel` - Zitadel authentication
- `mcp-infisical` - Infisical secrets
- `mcp-falco` - Falco security
- `mcp-trivy` - Trivy scanning
- `mcp-snyk` - Snyk security
- `mcp-vault` - HashiCorp Vault ✅ Implemented
- `mcp-kyverno` - Kyverno policies
- `mcp-opa` - Open Policy Agent
- `mcp-crowdstrike` - CrowdStrike
- `mcp-splunk` - Splunk logging

**Status:** 1/10 implemented

---

### 6. Finance & Analytics (6 servers)
- `finance-mcp` - Financial APIs ✅ Implemented
- `timescale-mcp` - TimescaleDB ✅ Implemented
- `mcp-stripe` - Stripe payments
- `mcp-paypal` - PayPal integration
- `mcp-quickbooks` - QuickBooks
- `mcp-xero` - Xero accounting

**Status:** 2/6 implemented

---

### 7. Cloud Providers (6 servers)
- `aws-mcp` - AWS services ✅ Implemented
- `gcp-mcp` - Google Cloud ✅ Implemented
- `alicloud-mcp` - Alibaba Cloud ✅ Implemented
- `azure-mcp` - Azure services
- `digitalocean-mcp` - DigitalOcean
- `cloudflare-mcp` - Cloudflare

**Status:** 3/6 implemented

---

### 8. Data & ETL (6 servers)
- `mcp-airbyte` - Airbyte ETL
- `mcp-fivetran` - Fivetran ETL
- `mcp-dbt` - dbt transformations
- `mcp-apache-airflow` - Airflow orchestration
- `mcp-prefect` - Prefect workflows
- `mcp-kafka` - Kafka streaming

**Status:** 0/6 implemented

---

### 9. KOSMOS Native (5 servers)
- `kosmos-tools` - KOSMOS-specific tools ✅ Implemented
- `kosmos-workspace` - Workspace operations
- `kosmos-agent` - Agent management
- `kosmos-governance` - Governance operations
- `kosmos-analytics` - Analytics tools

**Status:** 1/5 implemented

---

## MCP Server Usage

### Tool Discovery
```python
# Tools are discovered dynamically via GlobalToolRegistry
tool_registry = GlobalToolRegistry()
await tool_registry.discover_all_tools()

# Get tools by category
tools = tool_registry.get_tools_by_category(ToolCategory.DATABASE)

# Get tools by server
tools = tool_registry.get_tools_by_server("github-mcp")
```

### Tool Execution
```python
# Call tool with circuit breaker
result = await tool_registry.call_tool_with_circuit_breaker(
    server="github-mcp",
    tool="create_issue",
    params={
        "title": "Issue title",
        "body": "Issue description"
    }
)
```

### Error Handling
- Circuit breakers prevent cascade failures
- Exponential backoff for retries
- Health checks detect server issues
- Fallback to cached responses

---

## MCP Server Configuration

### Server Registration
```python
MCPServerConfig(
    name="server-name",
    command="npx",
    args=["tsx", "src/index.ts"],
    cwd="../mcp-servers/server-name",
    category=ToolCategory.CATEGORY,
    description="Server description",
    env_vars={"API_KEY": "value"},
)
```

### Transport Types
- **stdio:** Standard input/output (default)
- **http:** HTTP/HTTPS transport
- **websocket:** WebSocket transport

---

## Skills Pattern (Token Reduction)

Instead of loading all 50,000+ tokens of tool schemas upfront, use Skills pattern:

```python
# Load only tools needed for current task
tools = await tool_registry.get_tools_for_intent(
    intent="create_github_issue",
    context={"domain": "development"}
)
# Returns only GitHub MCP tools, not all 88 servers
```

**Token Savings:** 98.7% reduction in initial token overhead

---

## Security Considerations

### Authentication
- OAuth 2.1+ for MCP server authentication
- API keys stored in secrets manager
- Credentials rotated every 30-90 days

### Containerization
- All MCP servers run in Docker containers
- Resource limits applied
- Network isolation

### Least Privilege
- Agents only access needed tools
- Tool access filtered by category
- Permission checks at tool execution

---

## Monitoring

### Metrics
- Tool call count per server
- Success/failure rate
- Average latency
- Cost per tool call

### Health Checks
- Periodic health checks for all servers
- Automatic circuit breaker activation
- Alert on server failures

---

## Implementation Status

**Total Servers:** 88  
**Implemented:** ~15 (17%)  
**Priority:** Focus on critical servers first (GitHub, PostgreSQL, Slack, AWS)

---

## Related Documentation

- **MCP Overview:** `docs-site/docs/05-mcp-servers/index.md`
- **Tool Registry:** `implementation/backend/core/tool_registry.py`
- **Circuit Breaker:** `implementation/backend/core/circuit_breaker.py`
- **MCP Servers:** `implementation/mcp-servers/`

---

**Remember:** Use Skills pattern to reduce token overhead. Load only tools needed for current task context.
