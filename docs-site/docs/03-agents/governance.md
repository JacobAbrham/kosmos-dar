---
sidebar_position: 14
title: Pentarchy Governance
description: The governance system implementing 3-agent voting for medium-stakes decisions.
---

# 🗳️ Pentarchy Governance

**Voting System** | Domain: Governance



The governance system implementing 3-agent voting for medium-stakes decisions.


## Overview

KOSMOS V2.0 Pentarchy Governance System

The Pentarchy is a 3-agent voting system for high-stakes decisions:
- Athena (Analytics): Votes based on strategic value
- Hephaestus (Development): Votes based on technical feasibility
- Nur PROMETHEUS (Finance): Votes based on cost-benefit

AEGIS has security veto power over any decision.


:::info Auto-Generated
This documentation is automatically extracted from source code.
Source: `implementation/backend/agents/governance.py` (400 lines)
:::

## Enumerations

### ProposalType

Types of governance proposals.

| Member | Value |
|--------|-------|

### ProposalStatus

Status of a proposal.

| Member | Value |
|--------|-------|

### VoteDecision

Vote decision.

| Member | Value |
|--------|-------|

## Data Models

### Vote

A vote from a Pentarchy member.

```python
@dataclass
class Vote:
```

### SecurityReview

Security review by AEGIS.

```python
@dataclass
class SecurityReview:
```

### Proposal

A governance proposal.

```python
@dataclass
class Proposal:
```

## PentarchyGovernor

Pentarchy Governance Controller

Manages the voting process for high-stakes decisions.

### Methods

#### `__init__()`

#### `async initialize() → None`

Initialize the governance system.

#### `async submit_proposal(proposal_type: ProposalType, title: str, description: str, payload: Dict[str, Any], requestor_id: str, tenant_id: str, estimated_cost: float) → Proposal`

Submit a new proposal for governance review.

#### `async request_vote(proposal_id: str, timeout: float) → Dict[str, Any]`

Request votes from Pentarchy members.

Returns the final decision after all votes are collected.

#### `get_proposal(proposal_id: str) → Optional[Proposal]`

Get a proposal by ID.

#### `get_active_proposals() → List[Proposal]`

Get all active proposals.

#### `async shutdown() → None`

Shutdown the governance system.

