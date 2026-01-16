# KOSMOS DAR Agents Reference

**Purpose:** Agent capabilities and responsibilities reference  
**Last Updated:** January 2026  
**Version:** 2.0

---

## Agent Overview

KOSMOS DAR has 11 specialized AI agents, each handling a specific domain. All agents extend `LangGraphAgent` base class and use LangGraph for workflow orchestration.

---

## Agent Catalog

### 1. Zeus - Master Orchestrator
- **Agent ID:** `zeus`
- **Domain:** Orchestration
- **Responsibilities:**
  - Receive and analyze all user requests
  - Semantic intent routing via SemanticRouter
  - Determine task complexity and required agents
  - Parallel/sequential multi-agent coordination
  - Response synthesis with SDUI layout generation
  - Pentarchy governance for high-stakes decisions

- **Workflow:**
  1. analyze_intent → Semantic routing and complexity assessment
  2. plan_delegation → Determine which agents to involve
  3. check_governance → Governance check for critical tasks
  4. execute_parallel/sequential → Delegate to agents
  5. aggregate_responses → Combine agent outputs
  6. generate_sdui → Create SDUI response components
  7. synthesize → Final response synthesis

- **MCP Servers:** All (orchestrator has access to all tools)
- **Governance:** Pentarchy voter (can initiate votes)

---

### 2. Athena - Knowledge & RAG Agent
- **Agent ID:** `athena`
- **Domain:** Knowledge, Documentation, Analytics
- **Responsibilities:**
  - Answer questions from knowledge base
  - Document ingestion and processing
  - Vector search and RAG operations
  - Knowledge base management
  - External documentation integration (Context7 MCP)

- **MCP Servers:**
  - `qdrant-mcp`: Vector database operations
  - `context7-mcp`: External documentation
  - `sequential-thinking`: Complex reasoning

- **SDUI Components:**
  - GlassCard: Knowledge display
  - GlassDataTable: Search results
  - GlassChart: Analytics visualization

---

### 3. AEGIS - Security Agent
- **Agent ID:** `aegis`
- **Domain:** Security & Compliance
- **Responsibilities:**
  - Security scanning and threat detection
  - Security policy enforcement
  - Audit logging integration
  - Security veto for governance
  - Compliance checking

- **MCP Servers:**
  - `vault-mcp`: Secrets management
  - `snyk-mcp`: Vulnerability scanning
  - `trivy-mcp`: Container scanning

- **Governance:** Security veto power (can veto proposals)
- **SDUI Components:**
  - GlassSecurityCard: Security status
  - GlassAlert: Security alerts

---

### 4. Hermes - Communications Agent
- **Agent ID:** `hermes`
- **Domain:** Communications & Data Integration
- **Responsibilities:**
  - Multi-channel communication routing
  - Message aggregation and prioritization
  - Integration with Slack, Email, WhatsApp
  - Data integration and ETL operations

- **MCP Servers:**
  - `slack-mcp`: Slack integration
  - `gmail-mcp`: Email integration
  - `whatsapp-mcp`: WhatsApp integration

- **SDUI Components:**
  - GlassChatBubble: Message display
  - GlassTimeline: Communication timeline

---

### 5. Chronos - Scheduling Agent
- **Agent ID:** `chronos`
- **Domain:** Time & Scheduling
- **Responsibilities:**
  - Calendar management across providers
  - Schedule conflict detection and resolution
  - Reminders and notifications
  - Meeting scheduling coordination
  - Deadline tracking

- **MCP Servers:**
  - `gcal-mcp`: Google Calendar
  - `outlook-mcp`: Outlook Calendar

- **SDUI Components:**
  - GlassTimeline: Timeline visualization
  - GlassCalendar: Calendar grid view
  - GlassScheduleCard: Event cards

---

### 6. Hephaestus - DevOps Agent
- **Agent ID:** `hephaestus`
- **Domain:** Development & DevOps
- **Responsibilities:**
  - Code generation from specifications
  - Code review and quality checks
  - CI/CD pipeline management
  - Infrastructure management
  - Pull request operations

- **MCP Servers:**
  - `github-mcp`: GitHub operations
  - `docker-mcp`: Docker operations
  - `kubernetes-mcp`: Kubernetes operations
  - `filesystem-mcp`: File operations

- **SDUI Components:**
  - GlassCodeBlock: Code display
  - GlassDiffViewer: Diff visualization
  - GlassReviewCard: Review results

---

### 7. Nur PROMETHEUS - Analytics Agent
- **Agent ID:** `nur_prometheus`
- **Domain:** Finance & Analytics
- **Responsibilities:**
  - Cost tracking and analysis
  - Financial reporting
  - Budget management
  - Analytics and insights
  - Performance metrics

- **MCP Servers:**
  - `timescale-mcp`: Time-series analytics
  - `finance-mcp`: Financial APIs

- **Governance:** Cost governance (tracks and reports costs)
- **SDUI Components:**
  - GlassChart: Analytics charts
  - GlassMetric: Key metrics
  - GlassDataTable: Financial data

---

### 8. Iris - Notifications Agent
- **Agent ID:** `iris`
- **Domain:** Notifications & Alerts
- **Responsibilities:**
  - Notification delivery
  - Alert management
  - Notification preferences
  - Multi-channel notification routing

- **MCP Servers:**
  - `slack-mcp`: Slack notifications
  - `email-mcp`: Email notifications

- **SDUI Components:**
  - GlassAlert: Alert display
  - GlassNotification: Notification card

---

### 9. MEMORIX - Memory Agent
- **Agent ID:** `memorix`
- **Domain:** Memory & Context Management
- **Responsibilities:**
  - Context management
  - Memory persistence
  - Memory retrieval
  - Long-term memory storage

- **MCP Servers:**
  - `memory-server`: Memory operations
  - `qdrant-mcp`: Vector memory storage

- **SDUI Components:**
  - GlassCard: Memory display
  - GlassTimeline: Memory timeline

---

### 10. Hestia - Operations Agent
- **Agent ID:** `hestia`
- **Domain:** Operations & Infrastructure
- **Responsibilities:**
  - Infrastructure monitoring
  - Health checks
  - Resource management
  - Operational tasks

- **MCP Servers:**
  - `prometheus-mcp`: Metrics
  - `datadog-mcp`: Monitoring
  - `nats-mcp`: Messaging

- **SDUI Components:**
  - GlassMetric: System metrics
  - GlassStatusCard: Health status

---

### 11. Morpheus - Learning Agent
- **Agent ID:** `morpheus`
- **Domain:** Prediction & Forecasting
- **Responsibilities:**
  - Predictions and forecasts
  - What-if scenarios
  - Monte Carlo simulations
  - Anomaly detection
  - Probabilistic insights

- **MCP Servers:**
  - `sequential-thinking`: Complex reasoning

- **SDUI Components:**
  - GlassChart: Prediction visualization
  - GlassScenarioCard: Scenario display
  - GlassConfidenceMeter: Confidence levels

---

## Agent Patterns

### Agent Initialization
```python
class MyAgent(LangGraphAgent[MyState]):
    def __init__(self):
        super().__init__(
            agent_id="my_agent",
            name="My Agent",
            domain="domain_name",
            description="Agent description",
            tool_categories=[ToolCategory.RELEVANT],
            mcp_servers=["server-name"],
            pentarchy_voter=False,
            security_veto=False,
        )
```

### State Management
- All agents use LangGraph StateGraph
- State is checkpointed at each node
- State persists across restarts
- State can be rolled back for debugging

### Tool Calling
```python
# Agents call MCP tools via GlobalToolRegistry
result = await self.tool_registry.call_tool_with_circuit_breaker(
    server="server-name",
    tool="tool-name",
    params={"param": "value"}
)
```

### Error Handling
- Circuit breakers prevent cascade failures
- Exponential backoff for retries
- Fallback to cached responses
- Human escalation for critical failures

---

## Agent Coordination

### Zeus Orchestration
- Zeus receives all user requests
- Routes to appropriate agent(s)
- Coordinates parallel/sequential execution
- Aggregates responses
- Generates SDUI components

### Inter-Agent Communication
- Via NATS messaging
- Topic: `agent.{agent_id}.{event_type}`
- Agents can request help from other agents
- Zeus coordinates multi-agent workflows

---

## Governance Integration

### Pentarchy Voting
- Zeus, AEGIS, Hephaestus, Nur PROMETHEUS, and one rotating agent vote
- Required for high-cost operations (>$100)
- Required for security-sensitive operations
- Required for production deployments

### Cost Governance
- Nur PROMETHEUS tracks all costs
- Auto-approve: <$50
- Pentarchy vote: >$100
- Daily limit: $500
- Monthly limit: $10,000

### Security Veto
- AEGIS can veto any proposal
- Veto overrides Pentarchy vote
- Veto requires justification
- Veto logged in audit trail

---

## Related Documentation

- **Agent Framework:** `implementation/backend/agents/langgraph_base.py`
- **Agent Registry:** `implementation/backend/agents/registry.py`
- **Governance:** `implementation/backend/agents/governance.py`
- **Agent Docs:** `docs-site/docs/03-agents/`

---

**Remember:** All agents extend `LangGraphAgent` and follow the same patterns. Check `langgraph_base.py` for base implementation.
