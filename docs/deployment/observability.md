# Observability Stack Guide

**Last Updated:** January 2026  
**Status:** ✅ Complete

---

## Overview

KOSMOS V2.0 includes a comprehensive observability stack:

- **Prometheus** - Metrics collection and alerting
- **Grafana** - Dashboards and visualization
- **Langfuse** - LLM observability and tracing
- **Custom Metrics** - Agent, workflow, MCP, and cost metrics

---

## Quick Start

### 1. Start Observability Services

```bash
docker compose up -d prometheus grafana langfuse
```

### 2. Access Dashboards

- **Grafana:** http://localhost:3001
  - Username: `admin`
  - Password: `admin`
- **Prometheus:** http://localhost:9090
- **Langfuse:** http://localhost:3003

---

## Prometheus

### Configuration

Prometheus is configured via `implementation/infrastructure/docker/prometheus.yml`:

**Scrape Targets:**
- `kosmos-backend` - Backend API metrics
- `nats` - NATS messaging metrics
- `redis` - Redis cache metrics
- `postgres` - PostgreSQL metrics (requires exporter)
- `minio` - MinIO object storage metrics

### Alerting Rules

Alert rules are defined in `implementation/infrastructure/docker/prometheus-rules/kosmos-alerts.yml`:

**Backend Alerts:**
- `BackendDown` - Backend service is down
- `HighRequestLatency` - 95th percentile latency > 1s
- `HighErrorRate` - Error rate > 10%

**Agent Alerts:**
- `AgentExecutionFailure` - High agent execution failures
- `AgentLatencyHigh` - Agent execution latency > 30s

**Infrastructure Alerts:**
- `DatabaseConnectionHigh` - DB connections > 80
- `NATSDown` - NATS service down
- `RedisDown` - Redis service down

**Cost Alerts:**
- `HighCostRate` - LLM cost rate > $10/min
- `DailyBudgetExceeded` - Daily cost > $1000

### Querying Metrics

**Example Queries:**

```promql
# Request rate
rate(kosmos_api_requests_total[5m])

# Agent execution duration (95th percentile)
histogram_quantile(0.95, rate(kosmos_agent_execution_duration_seconds_bucket[5m]))

# MCP tool call failures
rate(kosmos_mcp_tool_calls_total{status="failed"}[5m])

# Daily cost
sum(kosmos_daily_cost_total)
```

---

## Grafana Dashboards

### Pre-configured Dashboards

1. **System Health** (`system-health.json`)
   - Backend health status
   - Request rate and latency
   - Error rates
   - Database connections
   - Service health checks

2. **Agent Performance** (`agent-performance.json`)
   - Agent execution counts
   - Execution duration (95th percentile)
   - Failure rates
   - Top agents by execution count

3. **MCP Server Health** (`mcp-health.json`)
   - MCP server health status
   - Circuit breaker states
   - Tool call rates
   - Tool call latency
   - Tool call failures

4. **Cost Tracking** (`cost-tracking.json`)
   - Daily cost total
   - Cost rate per minute
   - Cost by category
   - Cost by agent
   - Token usage

### Dashboard Location

Dashboards are stored in:
```
implementation/infrastructure/docker/grafana/dashboards/
```

They are automatically provisioned by Grafana on startup.

### Creating Custom Dashboards

1. Create dashboard JSON file in `grafana/dashboards/`
2. Restart Grafana: `docker compose restart grafana`
3. Dashboard will appear in Grafana UI

---

## Langfuse Integration

### Setup

1. **Access Langfuse UI:**
   - Go to http://localhost:3003
   - Create an account (first user becomes admin)
   - Create a project
   - Get API keys (Public Key and Secret Key)

2. **Configure Environment Variables:**
   ```bash
   export LANGFUSE_PUBLIC_KEY="pk-..."
   export LANGFUSE_SECRET_KEY="sk-..."
   export LANGFUSE_HOST="http://langfuse:3000"  # Internal Docker network
   ```

3. **Restart Backend:**
   ```bash
   docker compose restart backend
   ```

### Usage

**Automatic Tracing:**

LLM calls are automatically traced when using `LLMService`:

```python
from services.llm_service import get_llm_service

llm_service = await get_llm_service()
response = await llm_service.complete(
    messages=[{"role": "user", "content": "Hello"}],
    model="claude-3-5-haiku-20241022"
)
# Automatically traced in Langfuse
```

**Manual Tracing:**

```python
from core.langfuse_integration import LangfuseTracer, trace_llm_call

# Using context manager
with LangfuseTracer("my_operation", user_id="user-1") as tracer:
    tracer.generation(
        name="analysis",
        model="claude-3-5-haiku",
        input="Analyze this document",
        output="Analysis result",
        usage={"prompt_tokens": 100, "completion_tokens": 50},
        cost=0.001
    )

# Or direct call
trace_llm_call(
    name="analysis",
    model="claude-3-5-haiku",
    input="Analyze this document",
    output="Analysis result",
    usage={"prompt_tokens": 100, "completion_tokens": 50},
    cost=0.001,
    user_id="user-1"
)
```

### Langfuse Features

- **Traces** - Full request traces with spans
- **Generations** - LLM call tracking
- **Scores** - Quality scoring
- **Cost Tracking** - Automatic cost calculation
- **Token Usage** - Input/output token tracking
- **Metadata** - Custom metadata per trace

---

## Custom Metrics

### Available Metrics

**Agent Metrics:**
- `kosmos_agent_executions_total` - Total executions by agent and status
- `kosmos_agent_execution_duration_seconds` - Execution duration histogram
- `kosmos_agent_executions_failed_total` - Failed executions by error type

**Workflow Metrics:**
- `kosmos_workflow_executions_total` - Total workflow executions
- `kosmos_workflow_execution_duration_seconds` - Execution duration

**MCP Metrics:**
- `kosmos_mcp_tool_calls_total` - Tool calls by server, tool, status
- `kosmos_mcp_tool_call_duration_seconds` - Tool call duration
- `kosmos_mcp_server_health` - Server health (1=healthy, 0=unhealthy)
- `kosmos_mcp_circuit_breaker_state` - Circuit breaker state

**Cost Metrics:**
- `kosmos_llm_cost_total` - Total LLM cost by model, category, agent
- `kosmos_llm_tokens_total` - Token usage by model and type
- `kosmos_daily_cost_total` - Daily cost by tenant and category

**API Metrics:**
- `kosmos_api_requests_total` - API requests by method, endpoint, status
- `kosmos_api_request_duration_seconds` - Request duration histogram

**Job Queue Metrics:**
- `kosmos_job_queue_size` - Current queue size
- `kosmos_job_executions_total` - Job executions by type and status
- `kosmos_job_execution_duration_seconds` - Job execution duration

### Adding Custom Metrics

```python
from core.metrics import Counter, Histogram, Gauge

# Counter
my_counter = Counter(
    'my_custom_counter_total',
    'Description',
    ['label1', 'label2']
)
my_counter.labels(label1='value1', label2='value2').inc()

# Histogram
my_histogram = Histogram(
    'my_custom_duration_seconds',
    'Description',
    ['label1'],
    buckets=[0.1, 0.5, 1.0, 2.5, 5.0]
)
my_histogram.labels(label1='value1').observe(0.75)

# Gauge
my_gauge = Gauge(
    'my_custom_gauge',
    'Description',
    ['label1']
)
my_gauge.labels(label1='value1').set(42)
```

---

## Monitoring Best Practices

### 1. Set Up Alerts

Configure alerting rules in Prometheus for:
- Service downtime
- High error rates
- High latency
- Cost thresholds
- Resource exhaustion

### 2. Regular Dashboard Review

- **Daily:** Check system health and cost tracking
- **Weekly:** Review agent performance and MCP health
- **Monthly:** Analyze trends and optimize costs

### 3. Cost Monitoring

- Set daily/monthly budgets
- Monitor cost per agent
- Track token usage
- Identify expensive operations

### 4. Performance Optimization

- Monitor agent execution times
- Track MCP tool call latency
- Identify slow API endpoints
- Optimize based on metrics

---

## Troubleshooting

### Prometheus Not Scraping

1. **Check service health:**
   ```bash
   docker compose ps
   ```

2. **Check Prometheus targets:**
   - Go to http://localhost:9090/targets
   - Verify all targets are "UP"

3. **Check network connectivity:**
   ```bash
   docker compose exec prometheus wget -O- http://backend:8000/metrics
   ```

### Grafana Not Loading Dashboards

1. **Check provisioning:**
   ```bash
   docker compose logs grafana | grep provisioning
   ```

2. **Verify dashboard files exist:**
   ```bash
   ls -la implementation/infrastructure/docker/grafana/dashboards/
   ```

3. **Check Grafana logs:**
   ```bash
   docker compose logs grafana
   ```

### Langfuse Not Tracing

1. **Check Langfuse is running:**
   ```bash
   docker compose ps langfuse
   ```

2. **Verify API keys:**
   ```bash
   docker compose exec backend env | grep LANGFUSE
   ```

3. **Check Langfuse logs:**
   ```bash
   docker compose logs langfuse
   ```

4. **Test connection:**
   ```python
   from core.langfuse_integration import is_langfuse_enabled, get_langfuse
   print(f"Enabled: {is_langfuse_enabled()}")
   print(f"Client: {get_langfuse()}")
   ```

---

## Environment Variables

```bash
# Langfuse
LANGFUSE_PUBLIC_KEY=pk-...
LANGFUSE_SECRET_KEY=sk-...
LANGFUSE_HOST=http://langfuse:3000

# Prometheus (optional - uses defaults)
PROMETHEUS_RETENTION=30d

# Grafana (optional - uses defaults)
GF_SECURITY_ADMIN_USER=admin
GF_SECURITY_ADMIN_PASSWORD=admin
```

---

## Next Steps

- ✅ Observability stack deployed
- ✅ Prometheus configured
- ✅ Grafana dashboards created
- ✅ Langfuse integrated
- ⬜ Set up alerting notifications (email, Slack, etc.)
- ⬜ Add more custom metrics as needed
- ⬜ Create additional dashboards for specific use cases

---

**See Also:**
- [Prometheus Configuration](implementation/infrastructure/docker/prometheus.yml)
- [Alert Rules](implementation/infrastructure/docker/prometheus-rules/kosmos-alerts.yml)
- [Custom Metrics](implementation/backend/core/metrics.py)
- [Langfuse Integration](implementation/backend/core/langfuse_integration.py)
