"""
Prometheus Metrics for KOSMOS V2.0

Custom metrics for agents, workflows, MCP servers, and cost tracking.
"""

from prometheus_client import Counter, Histogram, Gauge, Info
from typing import Optional

# ============================================================================
# Agent Metrics
# ============================================================================

agent_executions_total = Counter(
    'kosmos_agent_executions_total',
    'Total number of agent executions',
    ['agent_id', 'status']  # status: success, failed
)

agent_execution_duration_seconds = Histogram(
    'kosmos_agent_execution_duration_seconds',
    'Agent execution duration in seconds',
    ['agent_id'],
    buckets=[0.1, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0, 120.0]
)

agent_executions_failed_total = Counter(
    'kosmos_agent_executions_failed_total',
    'Total number of failed agent executions',
    ['agent_id', 'error_type']
)

# ============================================================================
# Workflow Metrics
# ============================================================================

workflow_executions_total = Counter(
    'kosmos_workflow_executions_total',
    'Total number of workflow executions',
    ['workflow_id', 'status']
)

workflow_execution_duration_seconds = Histogram(
    'kosmos_workflow_execution_duration_seconds',
    'Workflow execution duration in seconds',
    ['workflow_id'],
    buckets=[1.0, 5.0, 10.0, 30.0, 60.0, 300.0, 600.0]
)

# ============================================================================
# MCP Server Metrics
# ============================================================================

mcp_tool_calls_total = Counter(
    'kosmos_mcp_tool_calls_total',
    'Total number of MCP tool calls',
    ['server', 'tool', 'status']
)

mcp_tool_call_duration_seconds = Histogram(
    'kosmos_mcp_tool_call_duration_seconds',
    'MCP tool call duration in seconds',
    ['server', 'tool'],
    buckets=[0.01, 0.05, 0.1, 0.5, 1.0, 2.5, 5.0, 10.0]
)

mcp_server_health = Gauge(
    'kosmos_mcp_server_health',
    'MCP server health status (1=healthy, 0=unhealthy)',
    ['server']
)

mcp_circuit_breaker_state = Gauge(
    'kosmos_mcp_circuit_breaker_state',
    'Circuit breaker state (0=closed, 1=open, 2=half_open)',
    ['server']
)

# ============================================================================
# Cost Metrics
# ============================================================================

llm_cost_total = Counter(
    'kosmos_llm_cost_total',
    'Total LLM cost in USD',
    ['model', 'category', 'agent_id']
)

llm_tokens_total = Counter(
    'kosmos_llm_tokens_total',
    'Total LLM tokens used',
    ['model', 'type'],  # type: input, output
)

daily_cost_total = Gauge(
    'kosmos_daily_cost_total',
    'Daily cost total in USD',
    ['tenant_id', 'category']
)

# ============================================================================
# API Metrics
# ============================================================================

api_requests_total = Counter(
    'kosmos_api_requests_total',
    'Total API requests',
    ['method', 'endpoint', 'status_code']
)

api_request_duration_seconds = Histogram(
    'kosmos_api_request_duration_seconds',
    'API request duration in seconds',
    ['method', 'endpoint'],
    buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]
)

# ============================================================================
# Job Queue Metrics
# ============================================================================

job_queue_size = Gauge(
    'kosmos_job_queue_size',
    'Current job queue size',
    ['queue']
)

job_executions_total = Counter(
    'kosmos_job_executions_total',
    'Total job executions',
    ['job_type', 'status']
)

job_execution_duration_seconds = Histogram(
    'kosmos_job_execution_duration_seconds',
    'Job execution duration in seconds',
    ['job_type'],
    buckets=[1.0, 5.0, 10.0, 30.0, 60.0, 300.0, 600.0]
)

# ============================================================================
# System Info
# ============================================================================

system_info = Info(
    'kosmos_system_info',
    'KOSMOS system information'
)

system_info.info({
    'version': '2.0.0-alpha',
    'environment': 'development'
})
