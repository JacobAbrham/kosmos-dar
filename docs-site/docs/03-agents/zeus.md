---
sidebar_position: 2
title: Zeus
description: The supreme orchestrator that coordinates all other agents, handles intent classification, and routes requests.
---

# ⚡ Zeus

**Master Orchestrator** | Domain: Orchestration



The supreme orchestrator that coordinates all other agents, handles intent classification, and routes requests.


## Overview

KOSMOS V2.0 Zeus Agent - Master Orchestrator

Zeus is the primary orchestrator that receives all user requests
and coordinates work across the other 10 agents.


:::info Auto-Generated
This documentation is automatically extracted from source code.
Source: `implementation/backend/agents/zeus.py` (375 lines)
:::

## Enumerations

### TaskComplexity

Task complexity levels for routing decisions.

| Member | Value |
|--------|-------|

## Data Models

### ZeusState

State for Zeus orchestration workflow.

```python
@dataclass
class ZeusState:
```

## ZeusAgent

Zeus - Master Orchestrator Agent

Responsibilities:
- Receive and analyze all user requests
- Determine task complexity and required agents
- Route tasks to appropriate domain agents
- Coordinate multi-agent workflows
- Aggregate responses and present unified output
- Escalate to Pentarchy for governance when needed

**Inherits from:** `BaseAgent`

### Methods

#### `__init__()`

#### `async process(message: AgentMessage) → Dict[str, Any]`

Process incoming request through Zeus workflow.

