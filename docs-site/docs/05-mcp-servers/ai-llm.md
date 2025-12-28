---
sidebar_position: 3
title: AI & Reasoning
description: 15 MCP servers for ai & reasoning operations
---

# AI & Reasoning MCP Servers

15 MCP servers in this domain (1 implemented).

:::info Auto-Generated
This documentation is automatically extracted from MCP server source code.
:::

## Server Registry

| Server | Status | Tools | Description |
|--------|--------|-------|-------------|
| `mcp-litellm` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-langfuse` | [planned]Planned[/planned] | - | Not yet implemented |
| `sequential-thinking` | [planned]Planned[/planned] | - | Not yet implemented |
| `memory-server` | [check]Implemented[/check] | 10 | KOSMOS Memory MCP Server |
| `context7-mcp` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-anthropic` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-openai` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-huggingface` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-ollama` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-embeddings` | [planned]Planned[/planned] | - | Not yet implemented |
| `prompt-armor` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-guardrails` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-haystack` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-llama-index` | [planned]Planned[/planned] | - | Not yet implemented |
| `mcp-ragas` | [planned]Planned[/planned] | - | Not yet implemented |

## kosmos-memory-server

KOSMOS Memory MCP Server

**Version:** 1.0.0  
**Source:** `implementation\mcp-servers\memory-server\src\index.ts`

### Tools

#### `store_memory`

Store a new memory with automatic embedding generation

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `type` | `string` | No |  |

#### `retrieve_memory`

Retrieve memories using semantic search

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `query` | `string` | No | Search query |

#### `update_memory`

Update an existing memory

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` | No | Memory ID to update |

#### `delete_memory`

Delete a memory (Amnesia Protocol for GDPR compliance)

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` | No | Memory ID to delete |

#### `search_similar`

Search for similar memories using vector similarity

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `embedding` | `array` | No |  |
| `items` | `number` | No |  |

#### `create_entity`

Create a knowledge graph entity

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string` | No | Entity name |

#### `create_relation`

Create a relationship between entities

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `fromEntity` | `string` | No | Source entity ID |

#### `get_entity_graph`

Get an entity and its neighborhood in the knowledge graph

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `entityId` | `string` | No | Entity ID to start from |

#### `consolidate_memories`

Consolidate episodic memories into semantic knowledge

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `memoryIds` | `array` | No |  |
| `items` | `string` | No |  |

#### `get_memory_stats`

Get memory statistics

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `userId` | `string` | No | Filter by user ID |

## Example Usage

```python
# Using mcp-litellm
result = await agent.call_mcp(
    server="mcp-litellm",
    tool="example_tool",
    params={"key": "value"}
)
```

