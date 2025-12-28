---
sidebar_position: 3
title: Hermes
description: Messenger of the agents, handling data transformation, ETL operations, and cross-system integration.
---

# 📨 Hermes

**Data Integration Agent** | Domain: Data



Messenger of the agents, handling data transformation, ETL operations, and cross-system integration.


## Overview

KOSMOS V2.0 Hermes Agent - Data Integration Specialist

Hermes handles all data operations including fetching, transforming,
and integrating data from various sources via MCP servers.


:::info Auto-Generated
This documentation is automatically extracted from source code.
Source: `implementation/backend/agents/hermes.py` (218 lines)
:::

## Data Models

### HermesState

State for Hermes data workflow.

```python
@dataclass
class HermesState:
```

## HermesAgent

Hermes - Data Integration Agent

Responsibilities:
- Fetch data from external APIs and databases
- Transform and normalize data formats
- Handle data validation and cleaning
- Manage data caching strategies
- Coordinate with MCP servers for data access

**Inherits from:** `BaseAgent`

### Methods

#### `__init__()`

#### `async process(message: AgentMessage) → Dict[str, Any]`

Process data request.

