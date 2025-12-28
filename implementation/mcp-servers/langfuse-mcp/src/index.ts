/**
 * Langfuse MCP Server - LLM observability and tracing for KOSMOS agents
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";
import Langfuse from "langfuse";

const config = {
  publicKey: process.env.LANGFUSE_PUBLIC_KEY || "",
  secretKey: process.env.LANGFUSE_SECRET_KEY || "",
  host: process.env.LANGFUSE_HOST || "https://cloud.langfuse.com",
};

const langfuse = new Langfuse({
  publicKey: config.publicKey,
  secretKey: config.secretKey,
  baseUrl: config.host,
});

// Active traces, spans, and generations for tracking
const activeTraces = new Map<string, any>();
const activeSpans = new Map<string, any>();
const activeGenerations = new Map<string, any>();

// API request helper for read operations
async function langfuseApiRequest(method: string, path: string, body?: any): Promise<any> {
  const auth = Buffer.from(`${config.publicKey}:${config.secretKey}`).toString("base64");
  const res = await fetch(`${config.host}/api/public${path}`, {
    method,
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || error.error || res.statusText);
  }
  return res.status === 204 ? {} : res.json();
}

const TOOLS: Tool[] = [
  // Trace Operations
  {
    name: "create_trace",
    description: "Create a new trace for tracking an LLM interaction or workflow.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Name of the trace" },
        userId: { type: "string", description: "User ID associated with the trace" },
        sessionId: { type: "string", description: "Session ID for grouping traces" },
        metadata: { type: "object", description: "Additional metadata" },
        tags: { type: "array", items: { type: "string" }, description: "Tags for filtering" },
        input: { type: "object", description: "Input data" },
        output: { type: "object", description: "Output data" },
        version: { type: "string", description: "Version identifier" },
        release: { type: "string", description: "Release identifier" },
        public: { type: "boolean", description: "Whether the trace is public" },
      },
      required: ["name"],
    },
  },
  {
    name: "update_trace",
    description: "Update an existing trace with new data.",
    inputSchema: {
      type: "object",
      properties: {
        traceId: { type: "string", description: "ID of the trace to update" },
        name: { type: "string", description: "Updated name" },
        userId: { type: "string", description: "Updated user ID" },
        sessionId: { type: "string", description: "Updated session ID" },
        metadata: { type: "object", description: "Updated metadata" },
        tags: { type: "array", items: { type: "string" }, description: "Updated tags" },
        input: { type: "object", description: "Updated input" },
        output: { type: "object", description: "Updated output" },
        public: { type: "boolean", description: "Updated public status" },
      },
      required: ["traceId"],
    },
  },
  {
    name: "get_trace",
    description: "Get details of a specific trace by ID.",
    inputSchema: {
      type: "object",
      properties: {
        traceId: { type: "string", description: "ID of the trace to retrieve" },
      },
      required: ["traceId"],
    },
  },
  {
    name: "list_traces",
    description: "List traces with optional filters.",
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "number", description: "Page number (1-indexed)" },
        limit: { type: "number", description: "Number of traces per page" },
        userId: { type: "string", description: "Filter by user ID" },
        sessionId: { type: "string", description: "Filter by session ID" },
        name: { type: "string", description: "Filter by trace name" },
        tags: { type: "array", items: { type: "string" }, description: "Filter by tags" },
        fromTimestamp: { type: "string", description: "Filter traces from this timestamp (ISO 8601)" },
        toTimestamp: { type: "string", description: "Filter traces to this timestamp (ISO 8601)" },
        orderBy: { type: "string", description: "Order by field" },
        version: { type: "string", description: "Filter by version" },
        release: { type: "string", description: "Filter by release" },
      },
    },
  },
  // Span Operations
  {
    name: "create_span",
    description: "Create a span within a trace to track a specific operation.",
    inputSchema: {
      type: "object",
      properties: {
        traceId: { type: "string", description: "ID of the parent trace" },
        name: { type: "string", description: "Name of the span" },
        startTime: { type: "string", description: "Start time (ISO 8601)" },
        endTime: { type: "string", description: "End time (ISO 8601)" },
        input: { type: "object", description: "Input data" },
        output: { type: "object", description: "Output data" },
        metadata: { type: "object", description: "Additional metadata" },
        level: { type: "string", enum: ["DEBUG", "DEFAULT", "WARNING", "ERROR"], description: "Log level" },
        statusMessage: { type: "string", description: "Status message" },
        parentObservationId: { type: "string", description: "Parent span/generation ID" },
        version: { type: "string", description: "Version identifier" },
      },
      required: ["traceId", "name"],
    },
  },
  {
    name: "update_span",
    description: "Update an existing span with new data.",
    inputSchema: {
      type: "object",
      properties: {
        spanId: { type: "string", description: "ID of the span to update" },
        name: { type: "string", description: "Updated name" },
        endTime: { type: "string", description: "End time (ISO 8601)" },
        input: { type: "object", description: "Updated input" },
        output: { type: "object", description: "Updated output" },
        metadata: { type: "object", description: "Updated metadata" },
        level: { type: "string", enum: ["DEBUG", "DEFAULT", "WARNING", "ERROR"], description: "Updated log level" },
        statusMessage: { type: "string", description: "Updated status message" },
        version: { type: "string", description: "Updated version" },
      },
      required: ["spanId"],
    },
  },
  // Generation Operations
  {
    name: "create_generation",
    description: "Log an LLM generation (model call) within a trace.",
    inputSchema: {
      type: "object",
      properties: {
        traceId: { type: "string", description: "ID of the parent trace" },
        name: { type: "string", description: "Name of the generation" },
        model: { type: "string", description: "Model name (e.g., gpt-4, claude-3)" },
        modelParameters: { type: "object", description: "Model parameters (temperature, max_tokens, etc.)" },
        input: { type: "object", description: "Input/prompt data" },
        output: { type: "object", description: "Output/completion data" },
        usage: {
          type: "object",
          description: "Token usage information",
          properties: {
            promptTokens: { type: "number" },
            completionTokens: { type: "number" },
            totalTokens: { type: "number" },
          },
        },
        metadata: { type: "object", description: "Additional metadata" },
        level: { type: "string", enum: ["DEBUG", "DEFAULT", "WARNING", "ERROR"], description: "Log level" },
        statusMessage: { type: "string", description: "Status message" },
        parentObservationId: { type: "string", description: "Parent span/generation ID" },
        version: { type: "string", description: "Version identifier" },
        startTime: { type: "string", description: "Start time (ISO 8601)" },
        endTime: { type: "string", description: "End time (ISO 8601)" },
        completionStartTime: { type: "string", description: "Time to first token (ISO 8601)" },
      },
      required: ["traceId", "name"],
    },
  },
  {
    name: "update_generation",
    description: "Update an existing generation with new data.",
    inputSchema: {
      type: "object",
      properties: {
        generationId: { type: "string", description: "ID of the generation to update" },
        name: { type: "string", description: "Updated name" },
        model: { type: "string", description: "Updated model name" },
        modelParameters: { type: "object", description: "Updated model parameters" },
        input: { type: "object", description: "Updated input" },
        output: { type: "object", description: "Updated output" },
        usage: {
          type: "object",
          description: "Updated token usage",
          properties: {
            promptTokens: { type: "number" },
            completionTokens: { type: "number" },
            totalTokens: { type: "number" },
          },
        },
        metadata: { type: "object", description: "Updated metadata" },
        level: { type: "string", enum: ["DEBUG", "DEFAULT", "WARNING", "ERROR"], description: "Updated log level" },
        statusMessage: { type: "string", description: "Updated status message" },
        endTime: { type: "string", description: "End time (ISO 8601)" },
        completionStartTime: { type: "string", description: "Time to first token (ISO 8601)" },
        version: { type: "string", description: "Updated version" },
      },
      required: ["generationId"],
    },
  },
  // Score Operations
  {
    name: "score_trace",
    description: "Add a score to a trace for quality evaluation.",
    inputSchema: {
      type: "object",
      properties: {
        traceId: { type: "string", description: "ID of the trace to score" },
        name: { type: "string", description: "Name of the score (e.g., accuracy, helpfulness)" },
        value: { type: "number", description: "Numeric score value" },
        comment: { type: "string", description: "Optional comment explaining the score" },
        dataType: { type: "string", enum: ["NUMERIC", "BOOLEAN", "CATEGORICAL"], description: "Data type of the score" },
        configId: { type: "string", description: "Score config ID" },
      },
      required: ["traceId", "name", "value"],
    },
  },
  {
    name: "score_generation",
    description: "Add a score to a specific generation (observation) within a trace.",
    inputSchema: {
      type: "object",
      properties: {
        traceId: { type: "string", description: "ID of the parent trace" },
        observationId: { type: "string", description: "ID of the generation/observation to score" },
        name: { type: "string", description: "Name of the score" },
        value: { type: "number", description: "Numeric score value" },
        comment: { type: "string", description: "Optional comment" },
        dataType: { type: "string", enum: ["NUMERIC", "BOOLEAN", "CATEGORICAL"], description: "Data type of the score" },
        configId: { type: "string", description: "Score config ID" },
      },
      required: ["traceId", "observationId", "name", "value"],
    },
  },
  {
    name: "list_scores",
    description: "List scores with optional filters.",
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "number", description: "Page number" },
        limit: { type: "number", description: "Results per page" },
        userId: { type: "string", description: "Filter by user ID" },
        name: { type: "string", description: "Filter by score name" },
        fromTimestamp: { type: "string", description: "Filter from timestamp" },
        toTimestamp: { type: "string", description: "Filter to timestamp" },
        source: { type: "string", enum: ["API", "EVAL", "ANNOTATION"], description: "Filter by source" },
        dataType: { type: "string", enum: ["NUMERIC", "BOOLEAN", "CATEGORICAL"], description: "Filter by data type" },
        configId: { type: "string", description: "Filter by config ID" },
      },
    },
  },
  // Event Operations
  {
    name: "create_event",
    description: "Create an event within a trace to log a specific occurrence.",
    inputSchema: {
      type: "object",
      properties: {
        traceId: { type: "string", description: "ID of the parent trace" },
        name: { type: "string", description: "Name of the event" },
        startTime: { type: "string", description: "Time of the event (ISO 8601)" },
        input: { type: "object", description: "Input data" },
        output: { type: "object", description: "Output data" },
        metadata: { type: "object", description: "Additional metadata" },
        level: { type: "string", enum: ["DEBUG", "DEFAULT", "WARNING", "ERROR"], description: "Log level" },
        statusMessage: { type: "string", description: "Status message" },
        parentObservationId: { type: "string", description: "Parent span/generation ID" },
        version: { type: "string", description: "Version identifier" },
      },
      required: ["traceId", "name"],
    },
  },
  // Session Operations
  {
    name: "list_sessions",
    description: "List sessions with optional filters.",
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "number", description: "Page number" },
        limit: { type: "number", description: "Results per page" },
        fromTimestamp: { type: "string", description: "Filter from timestamp" },
        toTimestamp: { type: "string", description: "Filter to timestamp" },
      },
    },
  },
  {
    name: "get_session",
    description: "Get details of a specific session.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string", description: "ID of the session to retrieve" },
      },
      required: ["sessionId"],
    },
  },
  // Prompt Operations
  {
    name: "get_prompt",
    description: "Get a prompt template by name.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Name of the prompt" },
        version: { type: "number", description: "Specific version number" },
        label: { type: "string", description: "Label (e.g., production, latest)" },
      },
      required: ["name"],
    },
  },
  {
    name: "list_prompts",
    description: "List all prompt templates.",
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "number", description: "Page number" },
        limit: { type: "number", description: "Results per page" },
        name: { type: "string", description: "Filter by name" },
        label: { type: "string", description: "Filter by label" },
        tag: { type: "string", description: "Filter by tag" },
      },
    },
  },
  {
    name: "create_prompt",
    description: "Create a new prompt template.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Name of the prompt" },
        prompt: { type: "string", description: "Prompt template text (for text prompts)" },
        type: { type: "string", enum: ["text", "chat"], description: "Prompt type" },
        config: { type: "object", description: "Prompt configuration" },
        labels: { type: "array", items: { type: "string" }, description: "Labels for the prompt" },
        tags: { type: "array", items: { type: "string" }, description: "Tags for filtering" },
      },
      required: ["name", "prompt"],
    },
  },
  // Dataset Operations
  {
    name: "get_dataset",
    description: "Get details of a specific evaluation dataset.",
    inputSchema: {
      type: "object",
      properties: {
        datasetName: { type: "string", description: "Name of the dataset" },
      },
      required: ["datasetName"],
    },
  },
  {
    name: "list_datasets",
    description: "List all evaluation datasets.",
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "number", description: "Page number" },
        limit: { type: "number", description: "Results per page" },
      },
    },
  },
  {
    name: "run_evaluation",
    description: "Run an evaluation against a dataset by creating dataset run items.",
    inputSchema: {
      type: "object",
      properties: {
        datasetName: { type: "string", description: "Name of the dataset to evaluate against" },
        runName: { type: "string", description: "Name for this evaluation run" },
        runDescription: { type: "string", description: "Description of the evaluation run" },
        metadata: { type: "object", description: "Additional metadata for the run" },
      },
      required: ["datasetName", "runName"],
    },
  },
];

// Tool implementations
async function createTrace(params: {
  name: string;
  userId?: string;
  sessionId?: string;
  metadata?: any;
  tags?: string[];
  input?: any;
  output?: any;
  version?: string;
  release?: string;
  public?: boolean;
}): Promise<any> {
  const trace = langfuse.trace({
    name: params.name,
    userId: params.userId,
    sessionId: params.sessionId,
    metadata: params.metadata,
    tags: params.tags,
    input: params.input,
    output: params.output,
    version: params.version,
    release: params.release,
    public: params.public,
  });
  const traceId = trace.id;
  activeTraces.set(traceId, trace);
  return { traceId, name: params.name, created: true };
}

async function updateTrace(params: {
  traceId: string;
  name?: string;
  userId?: string;
  sessionId?: string;
  metadata?: any;
  tags?: string[];
  input?: any;
  output?: any;
  public?: boolean;
}): Promise<any> {
  const trace = activeTraces.get(params.traceId);
  if (!trace) {
    // Create a trace reference for updating
    const traceRef = langfuse.trace({ id: params.traceId, name: params.name || "updated" });
    traceRef.update({
      name: params.name,
      userId: params.userId,
      sessionId: params.sessionId,
      metadata: params.metadata,
      tags: params.tags,
      input: params.input,
      output: params.output,
      public: params.public,
    });
    await langfuse.flushAsync();
    return { traceId: params.traceId, updated: true };
  }
  trace.update({
    name: params.name,
    userId: params.userId,
    sessionId: params.sessionId,
    metadata: params.metadata,
    tags: params.tags,
    input: params.input,
    output: params.output,
    public: params.public,
  });
  return { traceId: params.traceId, updated: true };
}

async function getTrace(params: { traceId: string }): Promise<any> {
  return langfuseApiRequest("GET", `/traces/${params.traceId}`);
}

async function listTraces(params: {
  page?: number;
  limit?: number;
  userId?: string;
  sessionId?: string;
  name?: string;
  tags?: string[];
  fromTimestamp?: string;
  toTimestamp?: string;
  orderBy?: string;
  version?: string;
  release?: string;
}): Promise<any> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", params.page.toString());
  if (params.limit) query.set("limit", params.limit.toString());
  if (params.userId) query.set("userId", params.userId);
  if (params.sessionId) query.set("sessionId", params.sessionId);
  if (params.name) query.set("name", params.name);
  if (params.tags) params.tags.forEach((tag) => query.append("tags", tag));
  if (params.fromTimestamp) query.set("fromTimestamp", params.fromTimestamp);
  if (params.toTimestamp) query.set("toTimestamp", params.toTimestamp);
  if (params.orderBy) query.set("orderBy", params.orderBy);
  if (params.version) query.set("version", params.version);
  if (params.release) query.set("release", params.release);
  const queryStr = query.toString() ? `?${query}` : "";
  return langfuseApiRequest("GET", `/traces${queryStr}`);
}

async function createSpan(params: {
  traceId: string;
  name: string;
  startTime?: string;
  endTime?: string;
  input?: any;
  output?: any;
  metadata?: any;
  level?: string;
  statusMessage?: string;
  parentObservationId?: string;
  version?: string;
}): Promise<any> {
  const trace = activeTraces.get(params.traceId);
  if (!trace) {
    // Create a trace reference to attach the span
    const traceRef = langfuse.trace({ id: params.traceId, name: "span-parent" });
    const span = traceRef.span({
      name: params.name,
      startTime: params.startTime ? new Date(params.startTime) : undefined,
      endTime: params.endTime ? new Date(params.endTime) : undefined,
      input: params.input,
      output: params.output,
      metadata: params.metadata,
      level: params.level as any,
      statusMessage: params.statusMessage,
      parentObservationId: params.parentObservationId,
      version: params.version,
    });
    activeSpans.set(span.id, span);
    return { spanId: span.id, traceId: params.traceId, name: params.name, created: true };
  }
  const span = trace.span({
    name: params.name,
    startTime: params.startTime ? new Date(params.startTime) : undefined,
    endTime: params.endTime ? new Date(params.endTime) : undefined,
    input: params.input,
    output: params.output,
    metadata: params.metadata,
    level: params.level as any,
    statusMessage: params.statusMessage,
    parentObservationId: params.parentObservationId,
    version: params.version,
  });
  activeSpans.set(span.id, span);
  return { spanId: span.id, traceId: params.traceId, name: params.name, created: true };
}

async function updateSpan(params: {
  spanId: string;
  name?: string;
  endTime?: string;
  input?: any;
  output?: any;
  metadata?: any;
  level?: string;
  statusMessage?: string;
  version?: string;
}): Promise<any> {
  const span = activeSpans.get(params.spanId);
  if (!span) {
    throw new Error(`Span not found in active spans: ${params.spanId}. Use create_span first or ensure span is active.`);
  }
  span.update({
    name: params.name,
    endTime: params.endTime ? new Date(params.endTime) : undefined,
    input: params.input,
    output: params.output,
    metadata: params.metadata,
    level: params.level as any,
    statusMessage: params.statusMessage,
    version: params.version,
  });
  return { spanId: params.spanId, updated: true };
}

async function createGeneration(params: {
  traceId: string;
  name: string;
  model?: string;
  modelParameters?: any;
  input?: any;
  output?: any;
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
  metadata?: any;
  level?: string;
  statusMessage?: string;
  parentObservationId?: string;
  version?: string;
  startTime?: string;
  endTime?: string;
  completionStartTime?: string;
}): Promise<any> {
  const trace = activeTraces.get(params.traceId);
  if (!trace) {
    // Create a trace reference to attach the generation
    const traceRef = langfuse.trace({ id: params.traceId, name: "generation-parent" });
    const generation = traceRef.generation({
      name: params.name,
      model: params.model,
      modelParameters: params.modelParameters,
      input: params.input,
      output: params.output,
      usage: params.usage,
      metadata: params.metadata,
      level: params.level as any,
      statusMessage: params.statusMessage,
      parentObservationId: params.parentObservationId,
      version: params.version,
      startTime: params.startTime ? new Date(params.startTime) : undefined,
      endTime: params.endTime ? new Date(params.endTime) : undefined,
      completionStartTime: params.completionStartTime ? new Date(params.completionStartTime) : undefined,
    });
    activeGenerations.set(generation.id, generation);
    return { generationId: generation.id, traceId: params.traceId, name: params.name, created: true };
  }
  const generation = trace.generation({
    name: params.name,
    model: params.model,
    modelParameters: params.modelParameters,
    input: params.input,
    output: params.output,
    usage: params.usage,
    metadata: params.metadata,
    level: params.level as any,
    statusMessage: params.statusMessage,
    parentObservationId: params.parentObservationId,
    version: params.version,
    startTime: params.startTime ? new Date(params.startTime) : undefined,
    endTime: params.endTime ? new Date(params.endTime) : undefined,
    completionStartTime: params.completionStartTime ? new Date(params.completionStartTime) : undefined,
  });
  activeGenerations.set(generation.id, generation);
  return { generationId: generation.id, traceId: params.traceId, name: params.name, created: true };
}

async function updateGeneration(params: {
  generationId: string;
  name?: string;
  model?: string;
  modelParameters?: any;
  input?: any;
  output?: any;
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
  metadata?: any;
  level?: string;
  statusMessage?: string;
  endTime?: string;
  completionStartTime?: string;
  version?: string;
}): Promise<any> {
  const generation = activeGenerations.get(params.generationId);
  if (!generation) {
    throw new Error(`Generation not found in active generations: ${params.generationId}. Use create_generation first or ensure generation is active.`);
  }
  generation.update({
    name: params.name,
    model: params.model,
    modelParameters: params.modelParameters,
    input: params.input,
    output: params.output,
    usage: params.usage,
    metadata: params.metadata,
    level: params.level as any,
    statusMessage: params.statusMessage,
    endTime: params.endTime ? new Date(params.endTime) : undefined,
    completionStartTime: params.completionStartTime ? new Date(params.completionStartTime) : undefined,
    version: params.version,
  });
  return { generationId: params.generationId, updated: true };
}

async function scoreTrace(params: {
  traceId: string;
  name: string;
  value: number;
  comment?: string;
  dataType?: string;
  configId?: string;
}): Promise<any> {
  langfuse.score({
    traceId: params.traceId,
    name: params.name,
    value: params.value,
    comment: params.comment,
    dataType: params.dataType as any,
    configId: params.configId,
  });
  await langfuse.flushAsync();
  return { traceId: params.traceId, name: params.name, value: params.value, scored: true };
}

async function scoreGeneration(params: {
  traceId: string;
  observationId: string;
  name: string;
  value: number;
  comment?: string;
  dataType?: string;
  configId?: string;
}): Promise<any> {
  langfuse.score({
    traceId: params.traceId,
    observationId: params.observationId,
    name: params.name,
    value: params.value,
    comment: params.comment,
    dataType: params.dataType as any,
    configId: params.configId,
  });
  await langfuse.flushAsync();
  return { traceId: params.traceId, observationId: params.observationId, name: params.name, value: params.value, scored: true };
}

async function listScores(params: {
  page?: number;
  limit?: number;
  userId?: string;
  name?: string;
  fromTimestamp?: string;
  toTimestamp?: string;
  source?: string;
  dataType?: string;
  configId?: string;
}): Promise<any> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", params.page.toString());
  if (params.limit) query.set("limit", params.limit.toString());
  if (params.userId) query.set("userId", params.userId);
  if (params.name) query.set("name", params.name);
  if (params.fromTimestamp) query.set("fromTimestamp", params.fromTimestamp);
  if (params.toTimestamp) query.set("toTimestamp", params.toTimestamp);
  if (params.source) query.set("source", params.source);
  if (params.dataType) query.set("dataType", params.dataType);
  if (params.configId) query.set("configId", params.configId);
  const queryStr = query.toString() ? `?${query}` : "";
  return langfuseApiRequest("GET", `/scores${queryStr}`);
}

async function createEvent(params: {
  traceId: string;
  name: string;
  startTime?: string;
  input?: any;
  output?: any;
  metadata?: any;
  level?: string;
  statusMessage?: string;
  parentObservationId?: string;
  version?: string;
}): Promise<any> {
  const trace = activeTraces.get(params.traceId);
  if (!trace) {
    // Create a trace reference to attach the event
    const traceRef = langfuse.trace({ id: params.traceId, name: "event-parent" });
    const event = traceRef.event({
      name: params.name,
      startTime: params.startTime ? new Date(params.startTime) : undefined,
      input: params.input,
      output: params.output,
      metadata: params.metadata,
      level: params.level as any,
      statusMessage: params.statusMessage,
      parentObservationId: params.parentObservationId,
      version: params.version,
    });
    return { eventId: event.id, traceId: params.traceId, name: params.name, created: true };
  }
  const event = trace.event({
    name: params.name,
    startTime: params.startTime ? new Date(params.startTime) : undefined,
    input: params.input,
    output: params.output,
    metadata: params.metadata,
    level: params.level as any,
    statusMessage: params.statusMessage,
    parentObservationId: params.parentObservationId,
    version: params.version,
  });
  return { eventId: event.id, traceId: params.traceId, name: params.name, created: true };
}

async function listSessions(params: {
  page?: number;
  limit?: number;
  fromTimestamp?: string;
  toTimestamp?: string;
}): Promise<any> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", params.page.toString());
  if (params.limit) query.set("limit", params.limit.toString());
  if (params.fromTimestamp) query.set("fromTimestamp", params.fromTimestamp);
  if (params.toTimestamp) query.set("toTimestamp", params.toTimestamp);
  const queryStr = query.toString() ? `?${query}` : "";
  return langfuseApiRequest("GET", `/sessions${queryStr}`);
}

async function getSession(params: { sessionId: string }): Promise<any> {
  return langfuseApiRequest("GET", `/sessions/${params.sessionId}`);
}

async function getPrompt(params: { name: string; version?: number; label?: string }): Promise<any> {
  const prompt = await langfuse.getPrompt(params.name, params.version, { label: params.label });
  return {
    name: params.name,
    prompt: prompt.prompt,
    version: prompt.version,
    config: prompt.config,
    labels: prompt.labels,
    tags: prompt.tags,
  };
}

async function listPrompts(params: {
  page?: number;
  limit?: number;
  name?: string;
  label?: string;
  tag?: string;
}): Promise<any> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", params.page.toString());
  if (params.limit) query.set("limit", params.limit.toString());
  if (params.name) query.set("name", params.name);
  if (params.label) query.set("label", params.label);
  if (params.tag) query.set("tag", params.tag);
  const queryStr = query.toString() ? `?${query}` : "";
  return langfuseApiRequest("GET", `/prompts${queryStr}`);
}

async function createPrompt(params: {
  name: string;
  prompt: string;
  type?: string;
  config?: any;
  labels?: string[];
  tags?: string[];
}): Promise<any> {
  const body: any = {
    name: params.name,
    prompt: params.prompt,
    type: params.type || "text",
  };
  if (params.config) body.config = params.config;
  if (params.labels) body.labels = params.labels;
  if (params.tags) body.tags = params.tags;
  return langfuseApiRequest("POST", "/prompts", body);
}

async function getDataset(params: { datasetName: string }): Promise<any> {
  return langfuseApiRequest("GET", `/datasets/${encodeURIComponent(params.datasetName)}`);
}

async function listDatasets(params: { page?: number; limit?: number }): Promise<any> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", params.page.toString());
  if (params.limit) query.set("limit", params.limit.toString());
  const queryStr = query.toString() ? `?${query}` : "";
  return langfuseApiRequest("GET", `/datasets${queryStr}`);
}

async function runEvaluation(params: {
  datasetName: string;
  runName: string;
  runDescription?: string;
  metadata?: any;
}): Promise<any> {
  // First, get the dataset to retrieve its items
  const dataset = await langfuseApiRequest("GET", `/datasets/${encodeURIComponent(params.datasetName)}`);

  // Create a dataset run
  const runBody: any = {
    name: params.runName,
    datasetName: params.datasetName,
  };
  if (params.runDescription) runBody.description = params.runDescription;
  if (params.metadata) runBody.metadata = params.metadata;

  const run = await langfuseApiRequest("POST", "/dataset-runs", runBody);

  return {
    runId: run.id,
    runName: params.runName,
    datasetName: params.datasetName,
    datasetId: dataset.id,
    created: true,
    message: "Evaluation run created. Use create_trace and create_generation for each dataset item, then link results back to this run.",
  };
}

const server = new Server(
  { name: "langfuse-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result: any;
    switch (name) {
      // Trace operations
      case "create_trace":
        result = await createTrace(args as any);
        break;
      case "update_trace":
        result = await updateTrace(args as any);
        break;
      case "get_trace":
        result = await getTrace(args as any);
        break;
      case "list_traces":
        result = await listTraces(args as any);
        break;
      // Span operations
      case "create_span":
        result = await createSpan(args as any);
        break;
      case "update_span":
        result = await updateSpan(args as any);
        break;
      // Generation operations
      case "create_generation":
        result = await createGeneration(args as any);
        break;
      case "update_generation":
        result = await updateGeneration(args as any);
        break;
      // Score operations
      case "score_trace":
        result = await scoreTrace(args as any);
        break;
      case "score_generation":
        result = await scoreGeneration(args as any);
        break;
      case "list_scores":
        result = await listScores(args as any);
        break;
      // Event operations
      case "create_event":
        result = await createEvent(args as any);
        break;
      // Session operations
      case "list_sessions":
        result = await listSessions(args as any);
        break;
      case "get_session":
        result = await getSession(args as any);
        break;
      // Prompt operations
      case "get_prompt":
        result = await getPrompt(args as any);
        break;
      case "list_prompts":
        result = await listPrompts(args as any);
        break;
      case "create_prompt":
        result = await createPrompt(args as any);
        break;
      // Dataset operations
      case "get_dataset":
        result = await getDataset(args as any);
        break;
      case "list_datasets":
        result = await listDatasets(args as any);
        break;
      case "run_evaluation":
        result = await runEvaluation(args as any);
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (error: any) {
    return { content: [{ type: "text", text: JSON.stringify({ error: error.message }) }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Langfuse MCP Server running on stdio");
}

main().catch(console.error);
