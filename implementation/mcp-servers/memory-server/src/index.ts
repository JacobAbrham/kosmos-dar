/**
 * KOSMOS Memory MCP Server
 *
 * Implements the 10 memory tools specified in the KOSMOS architecture:
 * 1. store_memory - Store new memories
 * 2. retrieve_memory - Retrieve memories by query
 * 3. update_memory - Update existing memories
 * 4. delete_memory - Delete memories (Amnesia Protocol)
 * 5. search_similar - Semantic similarity search
 * 6. create_entity - Create knowledge graph entity
 * 7. create_relation - Create entity relationship
 * 8. get_entity_graph - Get entity neighborhood
 * 9. consolidate_memories - Episodic to semantic consolidation
 * 10. get_memory_stats - Memory statistics
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// Tool schemas
const StoreMemorySchema = z.object({
  type: z.enum(["episodic", "semantic", "procedural", "working"]),
  content: z.string(),
  importance: z.number().min(0).max(1).default(0.5),
  metadata: z.record(z.unknown()).optional(),
  associations: z.array(z.string()).optional(),
});

const RetrieveMemorySchema = z.object({
  query: z.string(),
  types: z.array(z.enum(["episodic", "semantic", "procedural", "working"])).optional(),
  limit: z.number().min(1).max(100).default(10),
  minRelevance: z.number().min(0).max(1).default(0.5),
});

const UpdateMemorySchema = z.object({
  id: z.string(),
  content: z.string().optional(),
  importance: z.number().min(0).max(1).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const DeleteMemorySchema = z.object({
  id: z.string(),
  reason: z.string().optional(),
});

const SearchSimilarSchema = z.object({
  embedding: z.array(z.number()),
  types: z.array(z.enum(["episodic", "semantic", "procedural", "working"])).optional(),
  limit: z.number().min(1).max(100).default(10),
  threshold: z.number().min(0).max(1).default(0.7),
});

const CreateEntitySchema = z.object({
  name: z.string(),
  type: z.string(),
  properties: z.record(z.unknown()).optional(),
});

const CreateRelationSchema = z.object({
  fromEntity: z.string(),
  toEntity: z.string(),
  relationType: z.string(),
  properties: z.record(z.unknown()).optional(),
});

const GetEntityGraphSchema = z.object({
  entityId: z.string(),
  depth: z.number().min(1).max(5).default(2),
});

const ConsolidateMemoriesSchema = z.object({
  memoryIds: z.array(z.string()).optional(),
  minClusterSize: z.number().min(2).default(3),
});

const GetMemoryStatsSchema = z.object({
  userId: z.string().optional(),
  tenantId: z.string().optional(),
});

// Tool definitions
const TOOLS: Tool[] = [
  {
    name: "store_memory",
    description: "Store a new memory with automatic embedding generation",
    inputSchema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["episodic", "semantic", "procedural", "working"],
          description: "Type of memory to store",
        },
        content: {
          type: "string",
          description: "The memory content to store",
        },
        importance: {
          type: "number",
          description: "Importance score from 0 to 1",
          default: 0.5,
        },
        metadata: {
          type: "object",
          description: "Additional metadata for the memory",
        },
        associations: {
          type: "array",
          items: { type: "string" },
          description: "IDs of related memories",
        },
      },
      required: ["type", "content"],
    },
  },
  {
    name: "retrieve_memory",
    description: "Retrieve memories using semantic search",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query",
        },
        types: {
          type: "array",
          items: {
            type: "string",
            enum: ["episodic", "semantic", "procedural", "working"],
          },
          description: "Filter by memory types",
        },
        limit: {
          type: "number",
          description: "Maximum results to return",
          default: 10,
        },
        minRelevance: {
          type: "number",
          description: "Minimum relevance score",
          default: 0.5,
        },
      },
      required: ["query"],
    },
  },
  {
    name: "update_memory",
    description: "Update an existing memory",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Memory ID to update",
        },
        content: {
          type: "string",
          description: "New content",
        },
        importance: {
          type: "number",
          description: "New importance score",
        },
        metadata: {
          type: "object",
          description: "Updated metadata",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_memory",
    description: "Delete a memory (Amnesia Protocol for GDPR compliance)",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Memory ID to delete",
        },
        reason: {
          type: "string",
          description: "Reason for deletion (for audit)",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "search_similar",
    description: "Search for similar memories using vector similarity",
    inputSchema: {
      type: "object",
      properties: {
        embedding: {
          type: "array",
          items: { type: "number" },
          description: "Embedding vector to search for",
        },
        types: {
          type: "array",
          items: {
            type: "string",
            enum: ["episodic", "semantic", "procedural", "working"],
          },
        },
        limit: {
          type: "number",
          default: 10,
        },
        threshold: {
          type: "number",
          default: 0.7,
        },
      },
      required: ["embedding"],
    },
  },
  {
    name: "create_entity",
    description: "Create a knowledge graph entity",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Entity name",
        },
        type: {
          type: "string",
          description: "Entity type (person, organization, concept, etc.)",
        },
        properties: {
          type: "object",
          description: "Entity properties",
        },
      },
      required: ["name", "type"],
    },
  },
  {
    name: "create_relation",
    description: "Create a relationship between entities",
    inputSchema: {
      type: "object",
      properties: {
        fromEntity: {
          type: "string",
          description: "Source entity ID",
        },
        toEntity: {
          type: "string",
          description: "Target entity ID",
        },
        relationType: {
          type: "string",
          description: "Type of relationship",
        },
        properties: {
          type: "object",
          description: "Relationship properties",
        },
      },
      required: ["fromEntity", "toEntity", "relationType"],
    },
  },
  {
    name: "get_entity_graph",
    description: "Get an entity and its neighborhood in the knowledge graph",
    inputSchema: {
      type: "object",
      properties: {
        entityId: {
          type: "string",
          description: "Entity ID to start from",
        },
        depth: {
          type: "number",
          description: "Traversal depth",
          default: 2,
        },
      },
      required: ["entityId"],
    },
  },
  {
    name: "consolidate_memories",
    description: "Consolidate episodic memories into semantic knowledge",
    inputSchema: {
      type: "object",
      properties: {
        memoryIds: {
          type: "array",
          items: { type: "string" },
          description: "Specific memory IDs to consolidate (optional)",
        },
        minClusterSize: {
          type: "number",
          description: "Minimum cluster size for consolidation",
          default: 3,
        },
      },
    },
  },
  {
    name: "get_memory_stats",
    description: "Get memory statistics",
    inputSchema: {
      type: "object",
      properties: {
        userId: {
          type: "string",
          description: "Filter by user ID",
        },
        tenantId: {
          type: "string",
          description: "Filter by tenant ID",
        },
      },
    },
  },
];

// Memory storage (in production, use PostgreSQL with pgvector)
interface Memory {
  id: string;
  type: "episodic" | "semantic" | "procedural" | "working";
  content: string;
  embedding?: number[];
  importance: number;
  accessCount: number;
  createdAt: Date;
  lastAccessed: Date;
  metadata: Record<string, unknown>;
  associations: string[];
}

interface Entity {
  id: string;
  name: string;
  type: string;
  properties: Record<string, unknown>;
}

interface Relation {
  id: string;
  fromEntity: string;
  toEntity: string;
  relationType: string;
  properties: Record<string, unknown>;
}

// In-memory storage for demo (use PostgreSQL in production)
const memories: Map<string, Memory> = new Map();
const entities: Map<string, Entity> = new Map();
const relations: Map<string, Relation> = new Map();

// Helper functions
function generateId(): string {
  return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

async function generateEmbedding(text: string): Promise<number[]> {
  // In production, call LiteLLM or embedding service
  // Placeholder: return random embedding
  return Array.from({ length: 1536 }, () => Math.random() - 0.5);
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Tool handlers
async function storeMemory(params: z.infer<typeof StoreMemorySchema>): Promise<Memory> {
  const id = generateId();
  const embedding = await generateEmbedding(params.content);

  const memory: Memory = {
    id,
    type: params.type,
    content: params.content,
    embedding,
    importance: params.importance ?? 0.5,
    accessCount: 0,
    createdAt: new Date(),
    lastAccessed: new Date(),
    metadata: params.metadata ?? {},
    associations: params.associations ?? [],
  };

  memories.set(id, memory);
  return memory;
}

async function retrieveMemory(params: z.infer<typeof RetrieveMemorySchema>) {
  const queryEmbedding = await generateEmbedding(params.query);
  const results: Array<Memory & { relevance: number }> = [];

  for (const memory of memories.values()) {
    if (params.types && !params.types.includes(memory.type)) continue;
    if (!memory.embedding) continue;

    const relevance = cosineSimilarity(queryEmbedding, memory.embedding);
    if (relevance >= (params.minRelevance ?? 0.5)) {
      results.push({ ...memory, relevance });
    }
  }

  results.sort((a, b) => b.relevance - a.relevance);
  return results.slice(0, params.limit ?? 10);
}

async function updateMemory(params: z.infer<typeof UpdateMemorySchema>) {
  const memory = memories.get(params.id);
  if (!memory) throw new Error(`Memory not found: ${params.id}`);

  if (params.content) {
    memory.content = params.content;
    memory.embedding = await generateEmbedding(params.content);
  }
  if (params.importance !== undefined) {
    memory.importance = params.importance;
  }
  if (params.metadata) {
    memory.metadata = { ...memory.metadata, ...params.metadata };
  }

  return memory;
}

async function deleteMemory(params: z.infer<typeof DeleteMemorySchema>) {
  const memory = memories.get(params.id);
  if (!memory) throw new Error(`Memory not found: ${params.id}`);

  memories.delete(params.id);

  return {
    deleted: true,
    id: params.id,
    reason: params.reason ?? "amnesia_protocol",
    timestamp: new Date().toISOString(),
  };
}

async function searchSimilar(params: z.infer<typeof SearchSimilarSchema>) {
  const results: Array<Memory & { similarity: number }> = [];

  for (const memory of memories.values()) {
    if (params.types && !params.types.includes(memory.type)) continue;
    if (!memory.embedding) continue;

    const similarity = cosineSimilarity(params.embedding, memory.embedding);
    if (similarity >= (params.threshold ?? 0.7)) {
      results.push({ ...memory, similarity });
    }
  }

  results.sort((a, b) => b.similarity - a.similarity);
  return results.slice(0, params.limit ?? 10);
}

async function createEntity(params: z.infer<typeof CreateEntitySchema>) {
  const id = `entity_${Date.now()}`;
  const entity: Entity = {
    id,
    name: params.name,
    type: params.type,
    properties: params.properties ?? {},
  };
  entities.set(id, entity);
  return entity;
}

async function createRelation(params: z.infer<typeof CreateRelationSchema>) {
  const id = `rel_${Date.now()}`;
  const relation: Relation = {
    id,
    fromEntity: params.fromEntity,
    toEntity: params.toEntity,
    relationType: params.relationType,
    properties: params.properties ?? {},
  };
  relations.set(id, relation);
  return relation;
}

async function getEntityGraph(params: z.infer<typeof GetEntityGraphSchema>) {
  const entity = entities.get(params.entityId);
  if (!entity) throw new Error(`Entity not found: ${params.entityId}`);

  const graph = {
    entity,
    relations: Array.from(relations.values()).filter(
      (r) => r.fromEntity === params.entityId || r.toEntity === params.entityId
    ),
    relatedEntities: [] as Entity[],
  };

  for (const rel of graph.relations) {
    const relatedId = rel.fromEntity === params.entityId ? rel.toEntity : rel.fromEntity;
    const related = entities.get(relatedId);
    if (related) graph.relatedEntities.push(related);
  }

  return graph;
}

async function consolidateMemories(params: z.infer<typeof ConsolidateMemoriesSchema>) {
  const episodicMemories = Array.from(memories.values()).filter(
    (m) => m.type === "episodic"
  );

  // Group by similarity (simplified clustering)
  const consolidated: Memory[] = [];

  if (episodicMemories.length >= (params.minClusterSize ?? 3)) {
    const syntheticContent = episodicMemories
      .slice(0, 5)
      .map((m) => m.content)
      .join(" | ");

    const semantic = await storeMemory({
      type: "semantic",
      content: `Synthesized: ${syntheticContent}`,
      importance: 0.7,
      metadata: {
        source: "consolidation",
        sourceCount: episodicMemories.length,
      },
    });

    consolidated.push(semantic);
  }

  return {
    consolidated: consolidated.length,
    newSemanticMemories: consolidated,
  };
}

async function getMemoryStats(params: z.infer<typeof GetMemoryStatsSchema>) {
  const allMemories = Array.from(memories.values());

  const stats = {
    total: allMemories.length,
    byType: {
      episodic: allMemories.filter((m) => m.type === "episodic").length,
      semantic: allMemories.filter((m) => m.type === "semantic").length,
      procedural: allMemories.filter((m) => m.type === "procedural").length,
      working: allMemories.filter((m) => m.type === "working").length,
    },
    avgImportance:
      allMemories.reduce((sum, m) => sum + m.importance, 0) / allMemories.length || 0,
    entities: entities.size,
    relations: relations.size,
  };

  return stats;
}

// Main server
const server = new Server(
  {
    name: "kosmos-memory-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;

    switch (name) {
      case "store_memory":
        result = await storeMemory(StoreMemorySchema.parse(args));
        break;
      case "retrieve_memory":
        result = await retrieveMemory(RetrieveMemorySchema.parse(args));
        break;
      case "update_memory":
        result = await updateMemory(UpdateMemorySchema.parse(args));
        break;
      case "delete_memory":
        result = await deleteMemory(DeleteMemorySchema.parse(args));
        break;
      case "search_similar":
        result = await searchSimilar(SearchSimilarSchema.parse(args));
        break;
      case "create_entity":
        result = await createEntity(CreateEntitySchema.parse(args));
        break;
      case "create_relation":
        result = await createRelation(CreateRelationSchema.parse(args));
        break;
      case "get_entity_graph":
        result = await getEntityGraph(GetEntityGraphSchema.parse(args));
        break;
      case "consolidate_memories":
        result = await consolidateMemories(ConsolidateMemoriesSchema.parse(args ?? {}));
        break;
      case "get_memory_stats":
        result = await getMemoryStats(GetMemoryStatsSchema.parse(args ?? {}));
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("KOSMOS Memory MCP Server started");
}

main().catch(console.error);
