# Agent Workflow Implementation Guide

**Last Updated:** January 2026  
**Status:** ✅ Complete

---

## Overview

KOSMOS V2.0 includes a comprehensive agent workflow system that enables:
- Multi-agent coordination
- MCP tool integration
- Human-in-the-loop checkpoints
- Progress tracking and state management

---

## Architecture

### Components

1. **AgentWorkflowExecutor** - Main workflow execution engine
2. **Agent Registry** - Manages available agents
3. **Tool Registry** - Manages MCP tools
4. **Agent Bus** - NATS-based inter-agent communication

### Workflow Execution Flow

```
User Message
    ↓
Intent Routing (Zeus)
    ↓
Primary Agent Execution
    ↓
MCP Tool Calls (if needed)
    ↓
Human Input Checkpoint? (if required)
    ↓
Additional Agents? (if needed)
    ↓
Result Synthesis
    ↓
Final Response
```

---

## Usage

### Basic Workflow Execution

```python
from agents.workflows.agent_workflow_executor import get_workflow_executor

executor = await get_workflow_executor()

result = await executor.execute_workflow(
    workflow_id="wf-123",
    initial_message="What is the weather in San Francisco?",
    tenant_id="tenant-123",
    user_id="user-123",
    context={"location": "San Francisco"}
)

print(result["result"])
```

### Workflow with MCP Tools

```python
result = await executor.execute_with_mcp_tools(
    agent_id="athena",
    tool_calls=[
        {
            "tool_path": "github-mcp.create_issue",
            "params": {
                "title": "Bug Report",
                "body": "Description of bug"
            }
        }
    ],
    tenant_id="tenant-123",
    user_id="user-123"
)
```

### Human-in-the-Loop Checkpoint

```python
# Request human input
request_result = await executor.request_human_input(
    workflow_id="wf-123",
    prompt="Approve deployment to production?",
    options=["Yes", "No", "Cancel"]
)

# Wait for human response (in real implementation, via WebSocket)
# ...

# Submit human input
response_result = await executor.submit_human_input(
    workflow_id="wf-123",
    response="Yes"
)
```

---

## Agent-to-Agent Communication

Agents communicate via NATS messaging:

```python
from core.messaging import get_agent_bus

bus = await get_agent_bus()

# Publish message
message = AgentMessage(
    id=str(uuid4()),
    from_agent="athena",
    to_agent="hermes",
    payload={"task": "Send email notification"}
)

await bus.publish("hermes", message)

# Subscribe to messages
async def handle_message(message: AgentMessage):
    print(f"Received: {message.payload}")

await bus.subscribe("athena", handle_message)
```

---

## Testing

### Unit Tests

```python
from agents.workflows.agent_workflow_executor import AgentWorkflowExecutor

@pytest.mark.asyncio
async def test_workflow_execution():
    executor = AgentWorkflowExecutor()
    # ... test implementation
```

### Integration Tests

See `tests/integration/test_agent_communication.py` for examples.

---

## Best Practices

1. **Always set tenant context** - Ensures RLS policies are applied
2. **Handle errors gracefully** - Workflows should handle failures
3. **Use checkpoints** - Save state for recovery
4. **Monitor progress** - Emit progress events for UI updates
5. **Validate inputs** - Check tool parameters before execution

---

## Next Steps

- ✅ Agent workflow executor implemented
- ✅ MCP tool integration complete
- ✅ Human-in-the-loop checkpoints implemented
- ✅ Agent-to-agent communication via NATS
- ⬜ WebSocket integration for real-time updates
- ⬜ Workflow visualization UI
- ⬜ Workflow templates and presets

---

**See Also:**
- [Agent Base Class](implementation/backend/agents/base.py)
- [LangGraph Base](implementation/backend/agents/langgraph_base.py)
- [MCP Tool Registry](implementation/backend/core/tool_registry.py)
- [Agent Messaging](implementation/backend/core/messaging.py)
