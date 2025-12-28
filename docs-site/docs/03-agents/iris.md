---
sidebar_position: 9
title: Iris
description: Rainbow messenger handling notifications, alerts, cross-platform messaging, and escalations.
---

# 🌈 Iris

**Communication Agent** | Domain: Communication



Rainbow messenger handling notifications, alerts, cross-platform messaging, and escalations.


## Overview

KOSMOS V2.0 Iris Agent - Communication & Notification

Iris handles all communication operations including notifications,
messaging, email, and multi-channel delivery.


:::info Auto-Generated
This documentation is automatically extracted from source code.
Source: `implementation/backend/agents/iris.py` (464 lines)
:::

## Enumerations

### Channel

Communication channels.

| Member | Value |
|--------|-------|

### Priority

Message priority.

| Member | Value |
|--------|-------|

### MessageStatus

Message delivery status.

| Member | Value |
|--------|-------|

## Data Models

### Recipient

Message recipient.

```python
@dataclass
class Recipient:
```

### Message

A message to be sent.

```python
@dataclass
class Message:
```

### DeliveryResult

Result of message delivery.

```python
@dataclass
class DeliveryResult:
```

### IrisState

State for Iris communication workflow.

```python
@dataclass
class IrisState:
```

## IrisAgent

Iris - Communication & Notification Agent

Responsibilities:
- Send notifications across multiple channels
- Manage message templates
- Handle user communication preferences
- Schedule and batch messages
- Track delivery status
- Support multi-language messages

**Inherits from:** `BaseAgent`

### Methods

#### `__init__()`

#### `async process(message: AgentMessage) → Dict[str, Any]`

Process communication request.

#### `async send_notification(recipient_id: str, subject: str, body: str, channels: List[Channel], priority: Priority) → Dict[str, Any]`

Convenience method to send a notification.

#### `async broadcast(subject: str, body: str, channels: List[Channel], tenant_id: Optional[str]) → Dict[str, Any]`

Broadcast message to all users (optionally scoped to tenant).

