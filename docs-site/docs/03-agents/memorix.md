---
sidebar_position: 10
title: MEMORIX
description: Keeper of memories managing conversation context, knowledge graphs, and persistent memory.
---

# 🧠 MEMORIX

**Memory & Knowledge Agent** | Domain: Memory



Keeper of memories managing conversation context, knowledge graphs, and persistent memory.


## Overview

KOSMOS V2.0 MEMORIX Agent - Memory & Knowledge Management

MEMORIX handles all memory and knowledge operations including
episodic, semantic, procedural, and working memory management.


:::info Auto-Generated
This documentation is automatically extracted from source code.
Source: `implementation/backend/agents/memorix.py` (479 lines)
:::

## Enumerations

### MemoryType

Types of memory.

| Member | Value |
|--------|-------|

### DecayAlgorithm

Memory decay algorithms.

| Member | Value |
|--------|-------|

## Data Models

### MemoryEntry

A memory entry.

```python
@dataclass
class MemoryEntry:
```

### MemoryQuery

Query for memory retrieval.

```python
@dataclass
class MemoryQuery:
```

### MemorixState

State for MEMORIX memory workflow.

```python
@dataclass
class MemorixState:
```

## MemorixAgent

MEMORIX - Memory & Knowledge Management Agent

Responsibilities:
- Store and retrieve memories across 4 types
- Manage memory decay and consolidation
- Handle Amnesia Protocol (GDPR compliance)
- Create and maintain knowledge graphs
- Support RAG operations
- Manage conversation context

**Inherits from:** `BaseAgent`

### Methods

#### `__init__()`

#### `async process(message: AgentMessage) → Dict[str, Any]`

Process memory request.

