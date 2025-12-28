---
sidebar_position: 15
title: Agent Registry
description: Central registry managing agent lifecycle, health checks, and coordination.
---

# 📋 Agent Registry

**Lifecycle Management** | Domain: Core



Central registry managing agent lifecycle, health checks, and coordination.


## Overview

KOSMOS V2.0 Agent Registry

Central registry for managing all KOSMOS agents.


:::info Auto-Generated
This documentation is automatically extracted from source code.
Source: `implementation/backend/agents/registry.py` (237 lines)
:::

## AgentRegistry

Central registry for all KOSMOS agents.

Manages agent lifecycle, discovery, and coordination.

### Methods

#### `__init__()`

#### `async initialize() → None`

Initialize all agents.

#### `get_agent(agent_id: str) → Optional[BaseAgent]`

Get an agent by ID.

#### `get_all_agents() → List[BaseAgent]`

Get all registered agents.

#### `get_agents_by_domain(domain: str) → List[BaseAgent]`

Get agents by domain.

#### `get_pentarchy_voters() → List[BaseAgent]`

Get agents that can vote in Pentarchy.

#### `get_security_vetors() → List[BaseAgent]`

Get agents with security veto power.

#### `get_agent_status(agent_id: str) → Optional[Dict[str, Any]]`

Get status of a specific agent.

#### `get_all_status() → Dict[str, Dict[str, Any]]`

Get status of all agents.

#### `get_healthy_agents() → List[BaseAgent]`

Get agents that are in READY state.

#### `get_system_health() → Dict[str, Any]`

Get overall system health.

#### `async route_request(agent_id: str, payload: Dict[str, Any], context: Dict[str, Any]) → Dict[str, Any]`

Route a request to a specific agent.

#### `async shutdown() → None`

Shutdown all agents.

