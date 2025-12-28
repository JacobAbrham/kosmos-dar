---
sidebar_position: 8
title: Nur PROMETHEUS
description: Bearer of light for financial operations, cost analysis, budgeting, and economic insights.
---

# 💰 Nur PROMETHEUS

**Financial Intelligence Agent** | Domain: Finance

![Pentarchy Voter](https://img.shields.io/badge/Pentarchy-Voter-blue)

Bearer of light for financial operations, cost analysis, budgeting, and economic insights.


## Overview

KOSMOS V2.0 Nur PROMETHEUS Agent - Financial Intelligence

Nur PROMETHEUS handles all financial operations including budgeting,
cost tracking, financial analysis, and cost governance.


:::info Auto-Generated
This documentation is automatically extracted from source code.
Source: `implementation/backend/agents/nur_prometheus.py` (450 lines)
:::

## Enumerations

### CostCategory

Cost categories for tracking.

| Member | Value |
|--------|-------|

### BudgetPeriod

Budget period types.

| Member | Value |
|--------|-------|

### ApprovalDecision

Cost approval decisions.

| Member | Value |
|--------|-------|

## Data Models

### CostEstimate

Cost estimate for an operation.

```python
@dataclass
class CostEstimate:
```

### BudgetStatus

Current budget status.

```python
@dataclass
class BudgetStatus:
```

### NurPrometheusState

State for Nur PROMETHEUS financial workflow.

```python
@dataclass
class NurPrometheusState:
```

## NurPrometheusAgent

Nur PROMETHEUS - Financial Intelligence Agent

Responsibilities:
- Estimate costs before execution
- Track actual costs and usage
- Enforce budget limits
- Generate financial reports
- Cost-based governance decisions
- Participate in Pentarchy voting

**Inherits from:** `BaseAgent`

### Methods

#### `__init__()`

#### `async process(message: AgentMessage) → Dict[str, Any]`

Process financial request.

#### `estimate_llm_cost(model: str, input_tokens: int, output_tokens: int) → Decimal`

Estimate cost for LLM inference.

#### `async vote(proposal: Dict[str, Any]) → Dict[str, Any]`

Cast vote in Pentarchy governance.

Nur PROMETHEUS votes based on cost-benefit analysis.

