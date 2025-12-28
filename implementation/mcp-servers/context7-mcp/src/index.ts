/**
 * Context7 MCP Server
 *
 * Implements context window management and memory tools for KOSMOS agents.
 * Features:
 * - Context storage and retrieval
 * - Semantic search in context
 * - Session management with history
 * - Context compression and summarization
 * - Import/export capabilities
 * - Context window size management
 *
 * Tools implemented:
 * 1.  store_context - Store context/memory item
 * 2.  retrieve_context - Retrieve context by key
 * 3.  search_context - Semantic search in context
 * 4.  list_contexts - List all stored contexts
 * 5.  delete_context - Delete context item
 * 6.  create_session - Create conversation session
 * 7.  get_session - Get session with history
 * 8.  append_to_session - Add message to session
 * 9.  summarize_session - Summarize session history
 * 10. compress_context - Compress/summarize long context
 * 11. get_relevant_context - Get most relevant context for query
 * 12. merge_contexts - Merge multiple contexts
 * 13. export_context - Export context to file
 * 14. import_context - Import context from file
 * 15. clear_session - Clear session history
 * 16. get_context_stats - Get context usage stats
 * 17. set_context_window - Set max context size
 * 18. prune_context - Remove old/irrelevant context
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";

// =============================================================================
// Configuration
// =============================================================================

const config = {
  maxContextWindowTokens: parseInt(process.env.CONTEXT7_MAX_TOKENS || "128000"),
  persistPath: process.env.CONTEXT7_PERSIST_PATH || "",
  autoSave: process.env.CONTEXT7_AUTO_SAVE === "true",
};

// =============================================================================
// Type Definitions
// =============================================================================

interface ContextItem {
  id: string;
  key: string;
  content: string;
  embedding?: number[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  accessCount: number;
  lastAccessed: Date;
  tokenCount: number;
  tags: string[];
  priority: number;
}

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  tokenCount: number;
  metadata?: Record<string, unknown>;
}

interface Session {
  id: string;
  name: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown>;
  summary?: string;
  totalTokens: number;
}

interface ContextStats {
  totalContexts: number;
  totalTokens: number;
  maxWindowTokens: number;
  usagePercentage: number;
  totalSessions: number;
  averageContextSize: number;
  oldestContext: Date | null;
  newestContext: Date | null;
  topTags: Array<{ tag: string; count: number }>;
}

// =============================================================================
// In-Memory Storage
// =============================================================================

const contexts: Map<string, ContextItem> = new Map();
const sessions: Map<string, Session> = new Map();
let maxContextWindowTokens = config.maxContextWindowTokens;

// =============================================================================
// Zod Schemas
// =============================================================================

const StoreContextSchema = z.object({
  key: z.string().min(1),
  content: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
  priority: z.number().min(0).max(10).default(5),
});

const RetrieveContextSchema = z.object({
  key: z.string().min(1),
});

const SearchContextSchema = z.object({
  query: z.string().min(1),
  limit: z.number().min(1).max(100).default(10),
  tags: z.array(z.string()).optional(),
  minRelevance: z.number().min(0).max(1).default(0.3),
});

const ListContextsSchema = z.object({
  limit: z.number().min(1).max(1000).default(100),
  offset: z.number().min(0).default(0),
  tags: z.array(z.string()).optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "accessCount", "priority", "tokenCount"]).default("updatedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

const DeleteContextSchema = z.object({
  key: z.string().min(1),
});

const CreateSessionSchema = z.object({
  name: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
  systemPrompt: z.string().optional(),
});

const GetSessionSchema = z.object({
  sessionId: z.string().min(1),
  includeMessages: z.boolean().default(true),
  messageLimit: z.number().min(1).max(1000).optional(),
});

const AppendToSessionSchema = z.object({
  sessionId: z.string().min(1),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

const SummarizeSessionSchema = z.object({
  sessionId: z.string().min(1),
  maxLength: z.number().min(50).max(2000).default(500),
});

const CompressContextSchema = z.object({
  key: z.string().min(1),
  targetTokens: z.number().min(10).optional(),
  compressionRatio: z.number().min(0.1).max(0.9).default(0.5),
});

const GetRelevantContextSchema = z.object({
  query: z.string().min(1),
  maxTokens: z.number().min(100).default(4000),
  includeSessions: z.boolean().default(false),
});

const MergeContextsSchema = z.object({
  keys: z.array(z.string()).min(2),
  newKey: z.string().min(1),
  separator: z.string().default("\n\n---\n\n"),
  keepOriginals: z.boolean().default(false),
});

const ExportContextSchema = z.object({
  filePath: z.string().min(1),
  keys: z.array(z.string()).optional(),
  includeSessions: z.boolean().default(true),
  format: z.enum(["json", "jsonl"]).default("json"),
});

const ImportContextSchema = z.object({
  filePath: z.string().min(1),
  overwrite: z.boolean().default(false),
});

const ClearSessionSchema = z.object({
  sessionId: z.string().min(1),
  keepSystemPrompt: z.boolean().default(true),
});

const GetContextStatsSchema = z.object({
  includeTagStats: z.boolean().default(true),
});

const SetContextWindowSchema = z.object({
  maxTokens: z.number().min(1000).max(2000000),
});

const PruneContextSchema = z.object({
  strategy: z.enum(["oldest", "least_accessed", "lowest_priority", "largest"]).default("oldest"),
  targetTokens: z.number().min(0).optional(),
  maxAge: z.number().optional(), // Max age in hours
  minAccessCount: z.number().optional(),
  dryRun: z.boolean().default(false),
});

// =============================================================================
// Tool Definitions
// =============================================================================

const TOOLS: Tool[] = [
  {
    name: "store_context",
    description: "Store a context/memory item with optional metadata and tags",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Unique key for the context item" },
        content: { type: "string", description: "The context content to store" },
        metadata: { type: "object", description: "Additional metadata" },
        tags: { type: "array", items: { type: "string" }, description: "Tags for categorization" },
        priority: { type: "number", description: "Priority level (0-10)", default: 5 },
      },
      required: ["key", "content"],
    },
  },
  {
    name: "retrieve_context",
    description: "Retrieve a context item by its key",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Key of the context to retrieve" },
      },
      required: ["key"],
    },
  },
  {
    name: "search_context",
    description: "Perform semantic search across stored contexts",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        limit: { type: "number", description: "Maximum results to return", default: 10 },
        tags: { type: "array", items: { type: "string" }, description: "Filter by tags" },
        minRelevance: { type: "number", description: "Minimum relevance score (0-1)", default: 0.3 },
      },
      required: ["query"],
    },
  },
  {
    name: "list_contexts",
    description: "List all stored contexts with optional filtering and sorting",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Maximum items to return", default: 100 },
        offset: { type: "number", description: "Offset for pagination", default: 0 },
        tags: { type: "array", items: { type: "string" }, description: "Filter by tags" },
        sortBy: {
          type: "string",
          enum: ["createdAt", "updatedAt", "accessCount", "priority", "tokenCount"],
          description: "Sort field",
          default: "updatedAt",
        },
        sortOrder: { type: "string", enum: ["asc", "desc"], description: "Sort order", default: "desc" },
      },
    },
  },
  {
    name: "delete_context",
    description: "Delete a context item by its key",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Key of the context to delete" },
      },
      required: ["key"],
    },
  },
  {
    name: "create_session",
    description: "Create a new conversation session",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Session name" },
        metadata: { type: "object", description: "Session metadata" },
        systemPrompt: { type: "string", description: "Initial system prompt" },
      },
      required: ["name"],
    },
  },
  {
    name: "get_session",
    description: "Get a session with its message history",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string", description: "Session ID" },
        includeMessages: { type: "boolean", description: "Include message history", default: true },
        messageLimit: { type: "number", description: "Limit number of messages returned" },
      },
      required: ["sessionId"],
    },
  },
  {
    name: "append_to_session",
    description: "Add a message to a session's history",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string", description: "Session ID" },
        role: { type: "string", enum: ["user", "assistant", "system"], description: "Message role" },
        content: { type: "string", description: "Message content" },
        metadata: { type: "object", description: "Message metadata" },
      },
      required: ["sessionId", "role", "content"],
    },
  },
  {
    name: "summarize_session",
    description: "Generate a summary of a session's conversation history",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string", description: "Session ID" },
        maxLength: { type: "number", description: "Maximum summary length in characters", default: 500 },
      },
      required: ["sessionId"],
    },
  },
  {
    name: "compress_context",
    description: "Compress or summarize a long context item",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Key of the context to compress" },
        targetTokens: { type: "number", description: "Target token count" },
        compressionRatio: { type: "number", description: "Compression ratio (0.1-0.9)", default: 0.5 },
      },
      required: ["key"],
    },
  },
  {
    name: "get_relevant_context",
    description: "Get the most relevant context items for a given query within token budget",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Query to find relevant context for" },
        maxTokens: { type: "number", description: "Maximum tokens to return", default: 4000 },
        includeSessions: { type: "boolean", description: "Include session summaries", default: false },
      },
      required: ["query"],
    },
  },
  {
    name: "merge_contexts",
    description: "Merge multiple context items into one",
    inputSchema: {
      type: "object",
      properties: {
        keys: { type: "array", items: { type: "string" }, description: "Keys of contexts to merge" },
        newKey: { type: "string", description: "Key for the merged context" },
        separator: { type: "string", description: "Separator between merged contents", default: "\n\n---\n\n" },
        keepOriginals: { type: "boolean", description: "Keep original contexts", default: false },
      },
      required: ["keys", "newKey"],
    },
  },
  {
    name: "export_context",
    description: "Export contexts to a file",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Path to export file" },
        keys: { type: "array", items: { type: "string" }, description: "Specific keys to export (all if omitted)" },
        includeSessions: { type: "boolean", description: "Include sessions in export", default: true },
        format: { type: "string", enum: ["json", "jsonl"], description: "Export format", default: "json" },
      },
      required: ["filePath"],
    },
  },
  {
    name: "import_context",
    description: "Import contexts from a file",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Path to import file" },
        overwrite: { type: "boolean", description: "Overwrite existing contexts", default: false },
      },
      required: ["filePath"],
    },
  },
  {
    name: "clear_session",
    description: "Clear a session's message history",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string", description: "Session ID" },
        keepSystemPrompt: { type: "boolean", description: "Keep the system prompt message", default: true },
      },
      required: ["sessionId"],
    },
  },
  {
    name: "get_context_stats",
    description: "Get statistics about context usage",
    inputSchema: {
      type: "object",
      properties: {
        includeTagStats: { type: "boolean", description: "Include tag statistics", default: true },
      },
    },
  },
  {
    name: "set_context_window",
    description: "Set the maximum context window size in tokens",
    inputSchema: {
      type: "object",
      properties: {
        maxTokens: { type: "number", description: "Maximum tokens for context window" },
      },
      required: ["maxTokens"],
    },
  },
  {
    name: "prune_context",
    description: "Remove old or irrelevant context items based on strategy",
    inputSchema: {
      type: "object",
      properties: {
        strategy: {
          type: "string",
          enum: ["oldest", "least_accessed", "lowest_priority", "largest"],
          description: "Pruning strategy",
          default: "oldest",
        },
        targetTokens: { type: "number", description: "Target total tokens after pruning" },
        maxAge: { type: "number", description: "Maximum age in hours" },
        minAccessCount: { type: "number", description: "Minimum access count to keep" },
        dryRun: { type: "boolean", description: "Preview without deleting", default: false },
      },
    },
  },
];

// =============================================================================
// Helper Functions
// =============================================================================

function generateId(): string {
  return `ctx_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

function estimateTokenCount(text: string): number {
  // Rough approximation: ~4 characters per token for English text
  return Math.ceil(text.length / 4);
}

function generateSimpleEmbedding(text: string): number[] {
  // Simple text-based embedding for demo purposes
  // In production, use an embedding service like OpenAI or local model
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, "");
  const words = normalized.split(/\s+/).filter(Boolean);

  // Create a 128-dimensional embedding based on word characteristics
  const embedding = new Array(128).fill(0);

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    for (let j = 0; j < word.length && j < 128; j++) {
      embedding[(j + i) % 128] += word.charCodeAt(j) / 1000;
    }
  }

  // Normalize
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0)) || 1;
  return embedding.map(val => val / magnitude);
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
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

function calculateTotalTokens(): number {
  let total = 0;
  for (const context of contexts.values()) {
    total += context.tokenCount;
  }
  for (const session of sessions.values()) {
    total += session.totalTokens;
  }
  return total;
}

// =============================================================================
// Tool Implementations
// =============================================================================

async function storeContext(params: z.infer<typeof StoreContextSchema>): Promise<ContextItem> {
  const existing = Array.from(contexts.values()).find(c => c.key === params.key);
  const id = existing?.id || generateId();
  const now = new Date();
  const tokenCount = estimateTokenCount(params.content);
  const embedding = generateSimpleEmbedding(params.content);

  const context: ContextItem = {
    id,
    key: params.key,
    content: params.content,
    embedding,
    metadata: params.metadata || {},
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    accessCount: existing?.accessCount || 0,
    lastAccessed: now,
    tokenCount,
    tags: params.tags || [],
    priority: params.priority ?? 5,
  };

  contexts.set(params.key, context);
  return context;
}

async function retrieveContext(params: z.infer<typeof RetrieveContextSchema>): Promise<ContextItem | null> {
  const context = contexts.get(params.key);
  if (!context) return null;

  // Update access stats
  context.accessCount++;
  context.lastAccessed = new Date();

  return context;
}

async function searchContext(params: z.infer<typeof SearchContextSchema>) {
  const queryEmbedding = generateSimpleEmbedding(params.query);
  const results: Array<ContextItem & { relevance: number }> = [];

  for (const context of contexts.values()) {
    // Filter by tags if specified
    if (params.tags && params.tags.length > 0) {
      const hasTag = params.tags.some(tag => context.tags.includes(tag));
      if (!hasTag) continue;
    }

    if (!context.embedding) continue;

    const relevance = cosineSimilarity(queryEmbedding, context.embedding);
    if (relevance >= (params.minRelevance ?? 0.3)) {
      results.push({ ...context, relevance });
    }
  }

  results.sort((a, b) => b.relevance - a.relevance);
  return results.slice(0, params.limit ?? 10);
}

async function listContexts(params: z.infer<typeof ListContextsSchema>) {
  let items = Array.from(contexts.values());

  // Filter by tags
  if (params.tags && params.tags.length > 0) {
    items = items.filter(ctx => params.tags!.some(tag => ctx.tags.includes(tag)));
  }

  // Sort
  const sortBy = params.sortBy || "updatedAt";
  const sortOrder = params.sortOrder || "desc";

  items.sort((a, b) => {
    let aVal: number | Date;
    let bVal: number | Date;

    switch (sortBy) {
      case "createdAt":
        aVal = a.createdAt;
        bVal = b.createdAt;
        break;
      case "updatedAt":
        aVal = a.updatedAt;
        bVal = b.updatedAt;
        break;
      case "accessCount":
        aVal = a.accessCount;
        bVal = b.accessCount;
        break;
      case "priority":
        aVal = a.priority;
        bVal = b.priority;
        break;
      case "tokenCount":
        aVal = a.tokenCount;
        bVal = b.tokenCount;
        break;
      default:
        aVal = a.updatedAt;
        bVal = b.updatedAt;
    }

    if (aVal instanceof Date && bVal instanceof Date) {
      return sortOrder === "desc" ? bVal.getTime() - aVal.getTime() : aVal.getTime() - bVal.getTime();
    }
    return sortOrder === "desc" ? (bVal as number) - (aVal as number) : (aVal as number) - (bVal as number);
  });

  // Paginate
  const offset = params.offset || 0;
  const limit = params.limit || 100;
  const paged = items.slice(offset, offset + limit);

  return {
    items: paged.map(({ embedding, ...rest }) => rest), // Exclude embeddings from list
    total: items.length,
    offset,
    limit,
  };
}

async function deleteContext(params: z.infer<typeof DeleteContextSchema>) {
  const context = contexts.get(params.key);
  if (!context) {
    throw new Error(`Context not found: ${params.key}`);
  }
  contexts.delete(params.key);
  return { deleted: true, key: params.key, tokenCount: context.tokenCount };
}

async function createSession(params: z.infer<typeof CreateSessionSchema>): Promise<Session> {
  const id = generateSessionId();
  const now = new Date();

  const session: Session = {
    id,
    name: params.name,
    messages: [],
    createdAt: now,
    updatedAt: now,
    metadata: params.metadata || {},
    totalTokens: 0,
  };

  // Add system prompt if provided
  if (params.systemPrompt) {
    const message: Message = {
      id: generateMessageId(),
      role: "system",
      content: params.systemPrompt,
      timestamp: now,
      tokenCount: estimateTokenCount(params.systemPrompt),
    };
    session.messages.push(message);
    session.totalTokens += message.tokenCount;
  }

  sessions.set(id, session);
  return session;
}

async function getSession(params: z.infer<typeof GetSessionSchema>) {
  const session = sessions.get(params.sessionId);
  if (!session) {
    throw new Error(`Session not found: ${params.sessionId}`);
  }

  if (!params.includeMessages) {
    const { messages, ...rest } = session;
    return { ...rest, messageCount: messages.length };
  }

  if (params.messageLimit) {
    return {
      ...session,
      messages: session.messages.slice(-params.messageLimit),
    };
  }

  return session;
}

async function appendToSession(params: z.infer<typeof AppendToSessionSchema>) {
  const session = sessions.get(params.sessionId);
  if (!session) {
    throw new Error(`Session not found: ${params.sessionId}`);
  }

  const message: Message = {
    id: generateMessageId(),
    role: params.role,
    content: params.content,
    timestamp: new Date(),
    tokenCount: estimateTokenCount(params.content),
    metadata: params.metadata,
  };

  session.messages.push(message);
  session.totalTokens += message.tokenCount;
  session.updatedAt = new Date();

  return message;
}

async function summarizeSession(params: z.infer<typeof SummarizeSessionSchema>) {
  const session = sessions.get(params.sessionId);
  if (!session) {
    throw new Error(`Session not found: ${params.sessionId}`);
  }

  // Simple extractive summary - in production, use an LLM
  const nonSystemMessages = session.messages.filter(m => m.role !== "system");

  if (nonSystemMessages.length === 0) {
    return { sessionId: params.sessionId, summary: "Empty session with no messages." };
  }

  // Take key points from conversation
  const summaryParts: string[] = [];
  const maxLength = params.maxLength || 500;

  // Include first user message
  const firstUser = nonSystemMessages.find(m => m.role === "user");
  if (firstUser) {
    summaryParts.push(`Started with: "${firstUser.content.slice(0, 100)}..."`);
  }

  // Include last exchange
  const lastMessages = nonSystemMessages.slice(-2);
  if (lastMessages.length > 0) {
    const lastContent = lastMessages.map(m => `${m.role}: ${m.content.slice(0, 50)}...`).join("; ");
    summaryParts.push(`Recent: ${lastContent}`);
  }

  // Stats
  summaryParts.push(`Total: ${nonSystemMessages.length} messages, ${session.totalTokens} tokens`);

  const summary = summaryParts.join(" | ").slice(0, maxLength);
  session.summary = summary;

  return { sessionId: params.sessionId, summary, messageCount: session.messages.length };
}

async function compressContext(params: z.infer<typeof CompressContextSchema>) {
  const context = contexts.get(params.key);
  if (!context) {
    throw new Error(`Context not found: ${params.key}`);
  }

  const originalTokens = context.tokenCount;
  const targetTokens = params.targetTokens || Math.ceil(originalTokens * (params.compressionRatio || 0.5));
  const targetChars = targetTokens * 4; // Approximate

  // Simple compression - in production, use an LLM
  let compressed = context.content;

  if (compressed.length > targetChars) {
    // Keep beginning and end, truncate middle
    const keepEach = Math.floor(targetChars / 2);
    compressed = compressed.slice(0, keepEach) +
                 "\n\n[...content compressed...]\n\n" +
                 compressed.slice(-keepEach);
  }

  // Update context
  context.content = compressed;
  context.tokenCount = estimateTokenCount(compressed);
  context.embedding = generateSimpleEmbedding(compressed);
  context.updatedAt = new Date();
  context.metadata = { ...context.metadata, compressed: true, originalTokens };

  return {
    key: params.key,
    originalTokens,
    newTokens: context.tokenCount,
    compressionRatio: context.tokenCount / originalTokens,
  };
}

async function getRelevantContext(params: z.infer<typeof GetRelevantContextSchema>) {
  const queryEmbedding = generateSimpleEmbedding(params.query);
  const maxTokens = params.maxTokens || 4000;

  // Score all contexts
  const scored: Array<{ item: ContextItem | Session; relevance: number; type: "context" | "session" }> = [];

  for (const context of contexts.values()) {
    if (!context.embedding) continue;
    const relevance = cosineSimilarity(queryEmbedding, context.embedding);
    scored.push({ item: context, relevance, type: "context" });
  }

  if (params.includeSessions) {
    for (const session of sessions.values()) {
      if (session.summary) {
        const sessionEmbedding = generateSimpleEmbedding(session.summary);
        const relevance = cosineSimilarity(queryEmbedding, sessionEmbedding);
        scored.push({ item: session, relevance, type: "session" });
      }
    }
  }

  // Sort by relevance
  scored.sort((a, b) => b.relevance - a.relevance);

  // Select items within token budget
  const selected: Array<{ key: string; content: string; relevance: number; tokenCount: number; type: string }> = [];
  let totalTokens = 0;

  for (const { item, relevance, type } of scored) {
    const tokenCount = type === "context" ? (item as ContextItem).tokenCount : (item as Session).totalTokens;
    if (totalTokens + tokenCount > maxTokens) continue;

    if (type === "context") {
      const ctx = item as ContextItem;
      selected.push({
        key: ctx.key,
        content: ctx.content,
        relevance,
        tokenCount: ctx.tokenCount,
        type: "context",
      });
    } else {
      const sess = item as Session;
      selected.push({
        key: sess.id,
        content: sess.summary || "",
        relevance,
        tokenCount: sess.totalTokens,
        type: "session",
      });
    }
    totalTokens += tokenCount;
  }

  return {
    items: selected,
    totalTokens,
    maxTokens,
  };
}

async function mergeContexts(params: z.infer<typeof MergeContextsSchema>) {
  const toMerge: ContextItem[] = [];

  for (const key of params.keys) {
    const context = contexts.get(key);
    if (!context) {
      throw new Error(`Context not found: ${key}`);
    }
    toMerge.push(context);
  }

  const separator = params.separator || "\n\n---\n\n";
  const mergedContent = toMerge.map(c => c.content).join(separator);
  const mergedTags = [...new Set(toMerge.flatMap(c => c.tags))];
  const maxPriority = Math.max(...toMerge.map(c => c.priority));

  // Create merged context
  const merged = await storeContext({
    key: params.newKey,
    content: mergedContent,
    tags: mergedTags,
    priority: maxPriority,
    metadata: {
      mergedFrom: params.keys,
      mergedAt: new Date().toISOString(),
    },
  });

  // Delete originals if requested
  if (!params.keepOriginals) {
    for (const key of params.keys) {
      contexts.delete(key);
    }
  }

  return {
    mergedKey: params.newKey,
    sourceKeys: params.keys,
    tokenCount: merged.tokenCount,
    originalsDeleted: !params.keepOriginals,
  };
}

async function exportContext(params: z.infer<typeof ExportContextSchema>) {
  const exportData: {
    version: string;
    exportedAt: string;
    contexts: ContextItem[];
    sessions: Session[];
  } = {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    contexts: [],
    sessions: [],
  };

  // Export contexts
  if (params.keys && params.keys.length > 0) {
    for (const key of params.keys) {
      const context = contexts.get(key);
      if (context) {
        exportData.contexts.push(context);
      }
    }
  } else {
    exportData.contexts = Array.from(contexts.values());
  }

  // Export sessions
  if (params.includeSessions) {
    exportData.sessions = Array.from(sessions.values());
  }

  // Write to file
  let content: string;
  if (params.format === "jsonl") {
    const lines: string[] = [];
    for (const ctx of exportData.contexts) {
      lines.push(JSON.stringify({ type: "context", data: ctx }));
    }
    for (const sess of exportData.sessions) {
      lines.push(JSON.stringify({ type: "session", data: sess }));
    }
    content = lines.join("\n");
  } else {
    content = JSON.stringify(exportData, null, 2);
  }

  await fs.writeFile(params.filePath, content, "utf-8");

  return {
    filePath: params.filePath,
    contextsExported: exportData.contexts.length,
    sessionsExported: exportData.sessions.length,
    format: params.format,
  };
}

async function importContext(params: z.infer<typeof ImportContextSchema>) {
  const content = await fs.readFile(params.filePath, "utf-8");

  let imported = { contexts: 0, sessions: 0, skipped: 0 };

  // Try to parse as JSON first
  try {
    const data = JSON.parse(content);

    if (data.contexts) {
      for (const ctx of data.contexts) {
        if (!params.overwrite && contexts.has(ctx.key)) {
          imported.skipped++;
          continue;
        }
        // Restore dates
        ctx.createdAt = new Date(ctx.createdAt);
        ctx.updatedAt = new Date(ctx.updatedAt);
        ctx.lastAccessed = new Date(ctx.lastAccessed);
        contexts.set(ctx.key, ctx);
        imported.contexts++;
      }
    }

    if (data.sessions) {
      for (const sess of data.sessions) {
        if (!params.overwrite && sessions.has(sess.id)) {
          imported.skipped++;
          continue;
        }
        // Restore dates
        sess.createdAt = new Date(sess.createdAt);
        sess.updatedAt = new Date(sess.updatedAt);
        sess.messages = sess.messages.map((m: Message) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        }));
        sessions.set(sess.id, sess);
        imported.sessions++;
      }
    }
  } catch {
    // Try JSONL format
    const lines = content.split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const { type, data } = JSON.parse(line);
        if (type === "context") {
          if (!params.overwrite && contexts.has(data.key)) {
            imported.skipped++;
            continue;
          }
          data.createdAt = new Date(data.createdAt);
          data.updatedAt = new Date(data.updatedAt);
          data.lastAccessed = new Date(data.lastAccessed);
          contexts.set(data.key, data);
          imported.contexts++;
        } else if (type === "session") {
          if (!params.overwrite && sessions.has(data.id)) {
            imported.skipped++;
            continue;
          }
          data.createdAt = new Date(data.createdAt);
          data.updatedAt = new Date(data.updatedAt);
          data.messages = data.messages.map((m: Message) => ({
            ...m,
            timestamp: new Date(m.timestamp),
          }));
          sessions.set(data.id, data);
          imported.sessions++;
        }
      } catch {
        // Skip invalid lines
      }
    }
  }

  return {
    filePath: params.filePath,
    ...imported,
  };
}

async function clearSession(params: z.infer<typeof ClearSessionSchema>) {
  const session = sessions.get(params.sessionId);
  if (!session) {
    throw new Error(`Session not found: ${params.sessionId}`);
  }

  const clearedCount = session.messages.length;
  let keptSystemPrompt: Message | undefined;

  if (params.keepSystemPrompt) {
    keptSystemPrompt = session.messages.find(m => m.role === "system");
  }

  session.messages = keptSystemPrompt ? [keptSystemPrompt] : [];
  session.totalTokens = keptSystemPrompt ? keptSystemPrompt.tokenCount : 0;
  session.updatedAt = new Date();
  session.summary = undefined;

  return {
    sessionId: params.sessionId,
    messagesCleared: clearedCount - (keptSystemPrompt ? 1 : 0),
    keptSystemPrompt: !!keptSystemPrompt,
  };
}

async function getContextStats(params: z.infer<typeof GetContextStatsSchema>): Promise<ContextStats> {
  const allContexts = Array.from(contexts.values());
  const totalTokens = calculateTotalTokens();

  // Calculate tag stats
  const tagCounts: Map<string, number> = new Map();
  for (const ctx of allContexts) {
    for (const tag of ctx.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
  }

  const topTags = params.includeTagStats
    ? Array.from(tagCounts.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
    : [];

  // Find oldest and newest
  let oldestContext: Date | null = null;
  let newestContext: Date | null = null;

  for (const ctx of allContexts) {
    if (!oldestContext || ctx.createdAt < oldestContext) {
      oldestContext = ctx.createdAt;
    }
    if (!newestContext || ctx.createdAt > newestContext) {
      newestContext = ctx.createdAt;
    }
  }

  return {
    totalContexts: allContexts.length,
    totalTokens,
    maxWindowTokens: maxContextWindowTokens,
    usagePercentage: (totalTokens / maxContextWindowTokens) * 100,
    totalSessions: sessions.size,
    averageContextSize: allContexts.length > 0
      ? allContexts.reduce((sum, c) => sum + c.tokenCount, 0) / allContexts.length
      : 0,
    oldestContext,
    newestContext,
    topTags,
  };
}

async function setContextWindow(params: z.infer<typeof SetContextWindowSchema>) {
  const previousMax = maxContextWindowTokens;
  maxContextWindowTokens = params.maxTokens;

  return {
    previousMaxTokens: previousMax,
    newMaxTokens: maxContextWindowTokens,
    currentUsage: calculateTotalTokens(),
  };
}

async function pruneContext(params: z.infer<typeof PruneContextSchema>) {
  const strategy = params.strategy || "oldest";
  let allContexts = Array.from(contexts.values());

  // Filter based on criteria
  let toPrune: ContextItem[] = [];
  const now = new Date();

  // Apply filters
  if (params.maxAge !== undefined) {
    const maxAgeMs = params.maxAge * 60 * 60 * 1000; // hours to ms
    toPrune = allContexts.filter(c => now.getTime() - c.createdAt.getTime() > maxAgeMs);
  }

  if (params.minAccessCount !== undefined) {
    const filtered = allContexts.filter(c => c.accessCount < params.minAccessCount!);
    toPrune = toPrune.length > 0 ? toPrune.filter(c => filtered.includes(c)) : filtered;
  }

  // If no criteria matched, use strategy on all contexts
  if (toPrune.length === 0 && params.targetTokens !== undefined) {
    toPrune = [...allContexts];
  }

  // Sort by strategy
  switch (strategy) {
    case "oldest":
      toPrune.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      break;
    case "least_accessed":
      toPrune.sort((a, b) => a.accessCount - b.accessCount);
      break;
    case "lowest_priority":
      toPrune.sort((a, b) => a.priority - b.priority);
      break;
    case "largest":
      toPrune.sort((a, b) => b.tokenCount - a.tokenCount);
      break;
  }

  // Calculate how many to prune to reach target
  const currentTokens = calculateTotalTokens();
  let tokensToRemove = 0;

  if (params.targetTokens !== undefined && currentTokens > params.targetTokens) {
    tokensToRemove = currentTokens - params.targetTokens;
  }

  // Select items to prune
  const finalPrune: ContextItem[] = [];
  let removedTokens = 0;

  for (const ctx of toPrune) {
    if (tokensToRemove > 0 && removedTokens >= tokensToRemove) break;
    finalPrune.push(ctx);
    removedTokens += ctx.tokenCount;
  }

  // If not enough contexts match criteria but we need to prune more
  if (tokensToRemove > 0 && removedTokens < tokensToRemove && toPrune.length < allContexts.length) {
    const remaining = allContexts.filter(c => !finalPrune.includes(c));
    switch (strategy) {
      case "oldest":
        remaining.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        break;
      case "least_accessed":
        remaining.sort((a, b) => a.accessCount - b.accessCount);
        break;
      case "lowest_priority":
        remaining.sort((a, b) => a.priority - b.priority);
        break;
      case "largest":
        remaining.sort((a, b) => b.tokenCount - a.tokenCount);
        break;
    }

    for (const ctx of remaining) {
      if (removedTokens >= tokensToRemove) break;
      finalPrune.push(ctx);
      removedTokens += ctx.tokenCount;
    }
  }

  // Execute or preview
  const prunedKeys = finalPrune.map(c => c.key);

  if (!params.dryRun) {
    for (const key of prunedKeys) {
      contexts.delete(key);
    }
  }

  return {
    strategy,
    prunedCount: finalPrune.length,
    prunedKeys,
    tokensRemoved: removedTokens,
    newTotalTokens: params.dryRun ? currentTokens : calculateTotalTokens(),
    dryRun: params.dryRun || false,
  };
}

// =============================================================================
// Server Setup
// =============================================================================

const server = new Server(
  {
    name: "context7-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: unknown;

    switch (name) {
      case "store_context":
        result = await storeContext(StoreContextSchema.parse(args));
        break;
      case "retrieve_context":
        result = await retrieveContext(RetrieveContextSchema.parse(args));
        break;
      case "search_context":
        result = await searchContext(SearchContextSchema.parse(args));
        break;
      case "list_contexts":
        result = await listContexts(ListContextsSchema.parse(args || {}));
        break;
      case "delete_context":
        result = await deleteContext(DeleteContextSchema.parse(args));
        break;
      case "create_session":
        result = await createSession(CreateSessionSchema.parse(args));
        break;
      case "get_session":
        result = await getSession(GetSessionSchema.parse(args));
        break;
      case "append_to_session":
        result = await appendToSession(AppendToSessionSchema.parse(args));
        break;
      case "summarize_session":
        result = await summarizeSession(SummarizeSessionSchema.parse(args));
        break;
      case "compress_context":
        result = await compressContext(CompressContextSchema.parse(args));
        break;
      case "get_relevant_context":
        result = await getRelevantContext(GetRelevantContextSchema.parse(args));
        break;
      case "merge_contexts":
        result = await mergeContexts(MergeContextsSchema.parse(args));
        break;
      case "export_context":
        result = await exportContext(ExportContextSchema.parse(args));
        break;
      case "import_context":
        result = await importContext(ImportContextSchema.parse(args));
        break;
      case "clear_session":
        result = await clearSession(ClearSessionSchema.parse(args));
        break;
      case "get_context_stats":
        result = await getContextStats(GetContextStatsSchema.parse(args || {}));
        break;
      case "set_context_window":
        result = await setContextWindow(SetContextWindowSchema.parse(args));
        break;
      case "prune_context":
        result = await pruneContext(PruneContextSchema.parse(args || {}));
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

// =============================================================================
// Main
// =============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Context7 MCP Server running on stdio");
  console.error(`Max context window: ${maxContextWindowTokens} tokens`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
