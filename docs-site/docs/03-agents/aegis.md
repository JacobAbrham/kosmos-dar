---
sidebar_position: 4
title: AEGIS
description: The protective shield with security veto power, handling authentication, authorization, and threat detection.
---

# 🛡️ AEGIS

**Security Guardian** | Domain: Security

![Security Veto](https://img.shields.io/badge/Security-Veto%20Power-red)

The protective shield with security veto power, handling authentication, authorization, and threat detection.


## Overview

KOSMOS V2.0 AEGIS Agent - Security Guardian

AEGIS (Automated Enterprise Guardian for Information Security) handles
all security-related operations including authentication, authorization,
threat detection, and security policy enforcement.


:::info Auto-Generated
This documentation is automatically extracted from source code.
Source: `implementation/backend/agents/aegis.py` (388 lines)
:::

## Enumerations

### ThreatLevel

Threat severity levels.

| Member | Value |
|--------|-------|

### SecurityAction

Security response actions.

| Member | Value |
|--------|-------|

## Data Models

### SecurityContext

Security context for a request.

```python
@dataclass
class SecurityContext:
```

### AegisState

State for AEGIS security workflow.

```python
@dataclass
class AegisState:
```

## AegisAgent

AEGIS - Security Guardian Agent

Responsibilities:
- Authenticate and authorize requests
- Detect and respond to security threats
- Enforce security policies (RBAC, ABAC)
- Manage secrets and credentials
- Audit security events
- Implement STRIDE threat model mitigations
- Security veto power in Pentarchy

**Inherits from:** `BaseAgent`

### Methods

#### `__init__()`

#### `async process(message: AgentMessage) → Dict[str, Any]`

Process security request.

#### `async security_veto(proposal: Dict[str, Any]) → Dict[str, Any]`

Exercise security veto power in Pentarchy.

AEGIS can veto any proposal that poses security risks.

