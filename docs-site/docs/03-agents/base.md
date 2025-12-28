---
sidebar_position: 13
title: BaseAgent
description: Abstract base class that all KOSMOS agents inherit from, defining the common interface and lifecycle.
---

# 🏗️ BaseAgent

**Abstract Base Class** | Domain: Core



Abstract base class that all KOSMOS agents inherit from, defining the common interface and lifecycle.


## Overview

KOSMOS V2.0 Base Agent

Abstract base class that all KOSMOS agents inherit from.


:::info Auto-Generated
This documentation is automatically extracted from source code.
Source: `implementation/backend/agents/base.py` (289 lines)
:::

## Enumerations

### AgentState

Agent lifecycle states.

| Member | Value |
|--------|-------|

## Data Models

### AgentConfig

Configuration for an agent.

```python
@dataclass
class AgentConfig:
```

### AgentMessage

Message format for inter-agent communication.

```python
@dataclass
class AgentMessage:
```

### AgentMetrics

Metrics for agent performance tracking.

```python
@dataclass
class AgentMetrics:
```

## BaseAgent

Abstract base class for all KOSMOS agents.

All 11 KOSMOS agents inherit from this class and implement
the required abstract methods.

**Inherits from:** `ABC`

### Methods

#### `__init__(config: AgentConfig)`

#### `async initialize() → None`

Initialize the agent and its dependencies.

#### `async process(message: AgentMessage) → Dict[str, Any]` *(abstract)*

Process an incoming message.

This is the main entry point for agent logic.
Must be implemented by each agent.

#### `async call_tool(tool_name: str, params: Dict[str, Any]) → Any`

Execute a tool with automatic metrics tracking.

#### `async call_mcp(server: str, tool: str, params: Dict[str, Any]) → Any`

Call an MCP server tool.

#### `async delegate_to(agent_id: str, payload: Dict[str, Any], timeout: float) → Optional[Dict[str, Any]]`

Delegate a task to another agent.

#### `async emit_event(event_type: str, payload: Dict[str, Any]) → None`

Emit an event to the event stream.

#### `async shutdown() → None`

Gracefully shutdown the agent.

#### `get_status() → Dict[str, Any]`

Get agent status information.

