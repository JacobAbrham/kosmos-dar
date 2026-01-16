# Service Layer Architecture Guide

**Last Updated:** January 2026  
**Status:** ✅ Complete

---

## Overview

KOSMOS V2.0 uses a **Service Layer** pattern to separate business logic from API routes. This provides:

- ✅ **Testability** - Services can be easily mocked and tested
- ✅ **Reusability** - Services can be used across multiple API routes
- ✅ **Maintainability** - Business logic is centralized and organized
- ✅ **Dependency Injection** - Clean dependency management

---

## Architecture

```
┌─────────────────┐
│   API Routes    │  (FastAPI endpoints)
└────────┬────────┘
         │ Uses
         ▼
┌─────────────────┐
│  Service Layer   │  (Business logic)
└────────┬────────┘
         │ Uses
         ▼
┌─────────────────┐
│  Core Modules    │  (Agents, Tools, Database)
└─────────────────┘
```

---

## Base Service

All services extend `BaseService`:

```python
from services.base import BaseService, ServiceContext

class MyService(BaseService):
    def __init__(self):
        super().__init__("MyService")
    
    async def my_operation(self, ctx: ServiceContext, ...):
        # Track metrics automatically
        start_time = time.perf_counter()
        try:
            # Your logic here
            latency_ms = (time.perf_counter() - start_time) * 1000
            self._track_request(True, latency_ms)
            return result
        except Exception as e:
            latency_ms = (time.perf_counter() - start_time) * 1000
            self._track_request(False, latency_ms)
            raise
```

**Features:**
- Automatic metrics tracking
- Structured logging
- Error handling
- Health checks

---

## Service Context

`ServiceContext` provides tenant/user context:

```python
from services.base import ServiceContext

ctx = ServiceContext(
    tenant_id="tenant-1",
    user_id="user-1",
    session_id="session-123",
    trace_id="trace-456"
)
```

**From FastAPI Request:**
```python
from fastapi import Request
from services.base import ServiceContext

def get_context(request: Request) -> ServiceContext:
    return ServiceContext.from_request(request)
```

---

## Core Services

### 1. AgentService

**Purpose:** Agent operations and management

**Methods:**
- `list_agents(ctx, include_stats=False)` - List all agents
- `get_agent(ctx, agent_id)` - Get agent details
- `execute_agent(ctx, agent_id, task, context)` - Execute agent
- `get_agent_capabilities(ctx, agent_id)` - Get capabilities
- `route_intent(ctx, intent, context)` - Route intent to agent

**Usage:**
```python
from services.agent_service import get_agent_service

service = await get_agent_service()
agents = await service.list_agents(ctx, include_stats=True)
result = await service.execute_agent(ctx, "athena", "Analyze this document")
```

### 2. ChatService

**Purpose:** Chat/conversation operations

**Methods:**
- `process_message(ctx, message, conversation_id, context)` - Process chat message
- `execute_with_agent(ctx, message, agent_id, conversation_id, context)` - Execute with specific agent

**Usage:**
```python
from services.chat_service import get_chat_service

service = await get_chat_service()
result = await service.process_message(
    ctx=ctx,
    message="Hello, analyze this document",
    conversation_id="conv-123"
)
```

### 3. WorkflowService

**Purpose:** Workflow operations

**Methods:**
- `create_workflow(ctx, name, description, definition)` - Create workflow
- `execute_workflow(ctx, workflow_id, input_data)` - Execute workflow
- `get_workflow_status(ctx, execution_id)` - Get execution status

**Usage:**
```python
from services.workflow_service import get_workflow_service

service = await get_workflow_service()
workflow = await service.create_workflow(
    ctx=ctx,
    name="Document Processing",
    description="Process and analyze documents",
    definition={...}
)
```

---

## Dependency Injection

### FastAPI Dependencies

Use FastAPI's dependency injection system:

```python
from fastapi import Depends
from core.dependencies import (
    get_agent_service_dependency,
    get_chat_service_dependency,
    get_workflow_service_dependency
)
from services.agent_service import AgentService

@router.get("/agents")
async def list_agents(
    agent_service: AgentService = Depends(get_agent_service_dependency)
):
    ctx = ServiceContext.from_request(request)
    return await agent_service.list_agents(ctx)
```

### Service Context Dependency

```python
from core.dependencies import get_service_context_dep
from services.base import ServiceContext

@router.post("/chat")
async def chat(
    ctx: ServiceContext = Depends(get_service_context_dep)
):
    # Use ctx.tenant_id, ctx.user_id, etc.
    pass
```

---

## Refactoring API Routes

### Before (Direct Core Access)

```python
@router.get("/agents")
async def list_agents(
    intent_router: IntentRouter = Depends(get_intent_router)
):
    agents = intent_router.get_all_agents()
    return [agent.to_dict() for agent in agents]
```

### After (Service Layer)

```python
@router.get("/agents")
async def list_agents(
    request: Request,
    agent_service: AgentService = Depends(get_agent_service_dependency)
):
    ctx = ServiceContext.from_request(request)
    return await agent_service.list_agents(ctx)
```

**Benefits:**
- ✅ Business logic in service (testable)
- ✅ API route is thin (just HTTP concerns)
- ✅ Service can be reused elsewhere
- ✅ Easy to mock for testing

---

## Testing Services

### Unit Tests

```python
import pytest
from unittest.mock import AsyncMock, MagicMock
from services.agent_service import AgentService
from services.base import ServiceContext

@pytest.mark.asyncio
async def test_list_agents():
    # Mock dependencies
    service = AgentService()
    service._agent_registry = MagicMock()
    service._agent_registry.list_agents.return_value = ["athena", "zeus"]
    
    ctx = ServiceContext(tenant_id="test")
    agents = await service.list_agents(ctx)
    
    assert len(agents) == 2
    assert agents[0]["id"] == "athena"
```

### Integration Tests

```python
@pytest.mark.asyncio
async def test_agent_service_integration():
    service = await get_agent_service()
    ctx = ServiceContext(tenant_id="test")
    
    agents = await service.list_agents(ctx)
    assert len(agents) > 0
    
    agent = await service.get_agent(ctx, "athena")
    assert agent["id"] == "athena"
```

---

## Service Metrics

All services automatically track metrics:

```python
metrics = service.get_metrics()
# Returns:
# {
#     "requests_total": 100,
#     "requests_success": 95,
#     "requests_failed": 5,
#     "total_latency_ms": 5000.0,
#     "success_rate": 0.95,
#     "avg_latency_ms": 50.0
# }
```

---

## Health Checks

All services support health checks:

```python
health = await service.health_check()
# Returns:
# {
#     "service": "AgentService",
#     "status": "healthy",
#     "metrics": {...}
# }
```

---

## Best Practices

1. **Always use ServiceContext** - Pass tenant/user context through services
2. **Track metrics** - Use `_track_request()` for all operations
3. **Handle errors** - Catch exceptions and track failures
4. **Keep services focused** - One service per domain (agents, chat, workflows)
5. **Use dependency injection** - Don't create services directly in routes
6. **Write tests** - Services should be highly testable

---

## Adding a New Service

1. **Create service class:**
   ```python
   from services.base import BaseService, ServiceContext
   
   class MyService(BaseService):
       def __init__(self):
           super().__init__("MyService")
       
       async def initialize(self):
           # Initialize dependencies
           pass
       
       async def my_operation(self, ctx: ServiceContext, ...):
           # Implementation
           pass
   ```

2. **Create getter function:**
   ```python
   _my_service: Optional[MyService] = None
   
   async def get_my_service() -> MyService:
       global _my_service
       if _my_service is None:
           _my_service = MyService()
           await _my_service.initialize()
       return _my_service
   ```

3. **Add dependency:**
   ```python
   # In core/dependencies.py
   async def get_my_service_dependency() -> MyService:
       return await get_my_service()
   ```

4. **Use in routes:**
   ```python
   @router.get("/my-endpoint")
   async def my_endpoint(
       my_service: MyService = Depends(get_my_service_dependency)
   ):
       ctx = ServiceContext.from_request(request)
       return await my_service.my_operation(ctx, ...)
   ```

---

## Current Services

| Service | Purpose | Status |
|---------|---------|--------|
| `AgentService` | Agent operations | ✅ Complete |
| `ChatService` | Chat/conversation | ✅ Complete |
| `WorkflowService` | Workflow operations | ✅ Complete |
| `EmbeddingService` | Embedding generation | ✅ Existing |
| `LLMService` | LLM calls | ✅ Existing |

---

## Next Steps

- ✅ Service layer foundation created
- ✅ Core services implemented
- ✅ Dependency injection set up
- ✅ API routes refactored (examples)
- ⬜ Complete route refactoring (all routes)
- ⬜ Add service unit tests
- ⬜ Add service integration tests

---

**See Also:**
- [Service Base Class](implementation/backend/services/base.py)
- [Agent Service](implementation/backend/services/agent_service.py)
- [Chat Service](implementation/backend/services/chat_service.py)
- [Workflow Service](implementation/backend/services/workflow_service.py)
- [Dependencies](implementation/backend/core/dependencies.py)
