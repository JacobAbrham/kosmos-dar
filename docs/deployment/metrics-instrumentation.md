# Metrics Instrumentation Guide

**Last Updated:** January 2026  
**Status:** ✅ Complete

---

## Overview

All major components of KOSMOS V2.0 are instrumented to emit Prometheus metrics. This enables real-time monitoring, alerting, and performance analysis.

---

## Instrumented Components

### 1. Agent Service ✅

**Location:** `services/agent_service.py`

**Metrics Emitted:**
- `kosmos_agent_executions_total` - On every agent execution (success/failed)
- `kosmos_agent_execution_duration_seconds` - Execution duration histogram
- `kosmos_agent_executions_failed_total` - Failed executions with error type

**Example:**
```python
# Automatically emitted in execute_agent()
agent_executions_total.labels(agent_id="athena", status="success").inc()
agent_execution_duration_seconds.labels(agent_id="athena").observe(2.5)
```

---

### 2. API Routes ✅

**Location:** `core/middleware.py` - `MetricsMiddleware`

**Metrics Emitted:**
- `kosmos_api_requests_total` - On every API request (method, endpoint, status_code)
- `kosmos_api_request_duration_seconds` - Request duration histogram

**Usage:**
Automatically applied to all routes via middleware. No code changes needed.

---

### 3. MCP Tool Registry ✅

**Location:** `core/tool_registry.py`

**Metrics Emitted:**
- `kosmos_mcp_tool_calls_total` - On every tool call (server, tool, status)
- `kosmos_mcp_tool_call_duration_seconds` - Tool call duration histogram
- `kosmos_mcp_server_health` - Server health status (1=healthy, 0=unhealthy)
- `kosmos_mcp_circuit_breaker_state` - Circuit breaker state (0=closed, 1=open, 2=half_open)

**Example:**
```python
# Automatically emitted in call_tool()
mcp_tool_calls_total.labels(server="github-mcp", tool="create_issue", status="success").inc()
mcp_tool_call_duration_seconds.labels(server="github-mcp", tool="create_issue").observe(0.5)
mcp_server_health.labels(server="github-mcp").set(1)
```

---

### 4. Workflow Engine ✅

**Location:** `core/workflow_automation.py`

**Metrics Emitted:**
- `kosmos_workflow_executions_total` - On workflow execution (workflow_id, status)
- `kosmos_workflow_execution_duration_seconds` - Execution duration histogram

**Example:**
```python
# Automatically emitted in execute_workflow()
workflow_executions_total.labels(workflow_id="wf-123", status="completed").inc()
workflow_execution_duration_seconds.labels(workflow_id="wf-123").observe(10.5)
```

---

### 5. Job Queue ✅

**Location:** `workers/jobs.py`, `workers/queue.py`

**Metrics Emitted:**
- `kosmos_job_executions_total` - On job execution (job_type, status)
- `kosmos_job_execution_duration_seconds` - Job execution duration histogram
- `kosmos_job_queue_size` - Current queue size (queue)

**Example:**
```python
# Automatically emitted in execute_agent_workflow()
job_executions_total.labels(job_type="agent_workflow", status="success").inc()
job_execution_duration_seconds.labels(job_type="agent_workflow").observe(5.2)
job_queue_size.labels(queue="default").set(42)
```

---

### 6. LLM Service ✅

**Location:** `services/llm_service.py`

**Metrics Emitted:**
- `kosmos_llm_cost_total` - On every LLM call (model, category, agent_id)
- `kosmos_llm_tokens_total` - Token usage (model, type: input/output)

**Langfuse Integration:**
- Automatically traces all LLM calls when Langfuse is configured
- Includes cost, tokens, and metadata

**Example:**
```python
# Automatically emitted in generate()
llm_cost_total.labels(model="claude-3-5-haiku", category="llm_inference", agent_id="athena").inc(0.001)
llm_tokens_total.labels(model="claude-3-5-haiku", type="input").inc(100)
llm_tokens_total.labels(model="claude-3-5-haiku", type="output").inc(50)
```

---

## Metrics Endpoint

All metrics are available at:

```
http://localhost:8000/metrics
```

Prometheus automatically scrapes this endpoint every 15 seconds.

---

## Viewing Metrics

### Prometheus UI

1. Access Prometheus: http://localhost:9090
2. Go to "Graph" tab
3. Enter PromQL query:
   ```promql
   rate(kosmos_agent_executions_total[5m])
   ```

### Grafana Dashboards

Pre-configured dashboards show all metrics:
- System Health - API metrics
- Agent Performance - Agent metrics
- MCP Server Health - MCP metrics
- Cost Tracking - Cost and token metrics

---

## Adding New Metrics

### 1. Define Metric

In `core/metrics.py`:

```python
my_custom_metric = Counter(
    'kosmos_my_custom_metric_total',
    'Description',
    ['label1', 'label2']
)
```

### 2. Emit Metric

In your code:

```python
from core.metrics import my_custom_metric

my_custom_metric.labels(label1='value1', label2='value2').inc()
```

### 3. Update Dashboard (Optional)

Add panel to Grafana dashboard JSON file.

---

## Best Practices

1. **Use Histograms for Durations** - Provides percentiles (p50, p95, p99)
2. **Use Counters for Totals** - Never decreases, use `rate()` in queries
3. **Use Gauges for Current Values** - Can increase or decrease
4. **Label Consistently** - Use same label names across related metrics
5. **Don't Over-Label** - Too many label combinations create cardinality explosion

---

## Metric Naming Convention

- Prefix: `kosmos_`
- Suffix: `_total` for counters, `_seconds` for durations, no suffix for gauges
- Labels: snake_case, lowercase
- Examples:
  - `kosmos_agent_executions_total`
  - `kosmos_agent_execution_duration_seconds`
  - `kosmos_mcp_server_health`

---

## Troubleshooting

### Metrics Not Appearing

1. **Check metrics endpoint:**
   ```bash
   curl http://localhost:8000/metrics | grep kosmos
   ```

2. **Verify Prometheus is scraping:**
   - Go to http://localhost:9090/targets
   - Check `kosmos-backend` target is UP

3. **Check code is executing:**
   - Verify the instrumented code path is being called
   - Check logs for errors

### High Cardinality

If you see too many unique label combinations:

1. Reduce number of labels
2. Use more specific label values
3. Consider using a different metric type

---

## Next Steps

- ✅ All major components instrumented
- ✅ Metrics available at `/metrics` endpoint
- ✅ Prometheus scraping configured
- ✅ Grafana dashboards created
- ⬜ Add more detailed metrics as needed
- ⬜ Set up alerting notifications
- ⬜ Create custom dashboards for specific use cases

---

**See Also:**
- [Observability Guide](docs/deployment/observability.md)
- [Custom Metrics](implementation/backend/core/metrics.py)
- [Prometheus Configuration](implementation/infrastructure/docker/prometheus.yml)
