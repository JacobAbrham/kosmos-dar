---
sidebar_position: 11
title: Hestia
description: Guardian of the hearth monitoring system health, infrastructure, and operational metrics.
---

# 🏠 Hestia

**Operations & Infrastructure Agent** | Domain: Operations



Guardian of the hearth monitoring system health, infrastructure, and operational metrics.


## Overview

KOSMOS V2.0 Hestia Agent - Operations & Infrastructure

Hestia handles all operational tasks including system monitoring,
infrastructure management, and operational workflows.


:::info Auto-Generated
This documentation is automatically extracted from source code.
Source: `implementation/backend/agents/hestia.py` (471 lines)
:::

## Enumerations

### ServiceStatus

Service health status.

| Member | Value |
|--------|-------|

### AlertSeverity

Alert severity levels.

| Member | Value |
|--------|-------|

### OperationType

Types of operations.

| Member | Value |
|--------|-------|

## Data Models

### ServiceHealth

Health status of a service.

```python
@dataclass
class ServiceHealth:
```

### Alert

An operational alert.

```python
@dataclass
class Alert:
```

### HestiaState

State for Hestia operations workflow.

```python
@dataclass
class HestiaState:
```

## HestiaAgent

Hestia - Operations & Infrastructure Agent

Responsibilities:
- Monitor system health and metrics
- Manage deployments and rollbacks
- Handle scaling operations
- Process and route alerts
- Manage backups and recovery
- Coordinate with infrastructure

**Inherits from:** `BaseAgent`

### Methods

#### `__init__()`

#### `async process(message: AgentMessage) → Dict[str, Any]`

Process operations request.

#### `async get_system_status() → Dict[str, Any]`

Get overall system status.

#### `async trigger_alert(severity: AlertSeverity, source: str, message: str) → None`

Trigger an operational alert.

