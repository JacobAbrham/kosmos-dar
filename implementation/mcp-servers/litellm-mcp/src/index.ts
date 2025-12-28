/**
 * LiteLLM MCP Server - Unified LLM routing for KOSMOS agents
 * Provides access to 100+ LLM providers through a single API
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";

const config = {
  baseUrl: process.env.LITELLM_BASE_URL || "http://localhost:4000",
  apiKey: process.env.LITELLM_API_KEY || "",
  defaultModel: process.env.LITELLM_DEFAULT_MODEL || "gpt-4-turbo-preview",
};

async function litellmRequest(method: string, path: string, body?: any): Promise<any> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.apiKey) headers["Authorization"] = `Bearer ${config.apiKey}`;

  const res = await fetch(`${config.baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error?.message || error.error || res.statusText);
  }

  return res.json();
}

const TOOLS: Tool[] = [
  // Chat Completions
  {
    name: "chat_completion",
    description: "Create a chat completion using any supported LLM provider.",
    inputSchema: {
      type: "object",
      properties: {
        model: { type: "string", description: "Model name (e.g., gpt-4, claude-3-opus, gemini-pro)" },
        messages: { type: "array", items: { type: "object", properties: { role: { type: "string" }, content: { type: "string" } } } },
        temperature: { type: "number", description: "Sampling temperature (0-2)" },
        maxTokens: { type: "number", description: "Maximum tokens to generate" },
        topP: { type: "number" },
        stream: { type: "boolean" },
        stop: { type: "array", items: { type: "string" } },
        user: { type: "string" },
      },
      required: ["messages"],
    },
  },
  {
    name: "chat_completion_with_tools",
    description: "Chat completion with function/tool calling support.",
    inputSchema: {
      type: "object",
      properties: {
        model: { type: "string" },
        messages: { type: "array" },
        tools: { type: "array", description: "Tool definitions for function calling" },
        toolChoice: { type: "string", enum: ["auto", "required", "none"] },
        temperature: { type: "number" },
        maxTokens: { type: "number" },
      },
      required: ["messages", "tools"],
    },
  },
  // Embeddings
  {
    name: "create_embedding",
    description: "Generate embeddings for text.",
    inputSchema: {
      type: "object",
      properties: {
        model: { type: "string", description: "Embedding model (e.g., text-embedding-3-small)" },
        input: { type: "string", description: "Text to embed" },
        dimensions: { type: "number" },
      },
      required: ["input"],
    },
  },
  {
    name: "create_embeddings_batch",
    description: "Generate embeddings for multiple texts.",
    inputSchema: {
      type: "object",
      properties: {
        model: { type: "string" },
        inputs: { type: "array", items: { type: "string" } },
      },
      required: ["inputs"],
    },
  },
  // Model Management
  {
    name: "list_models",
    description: "List all available models across providers.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_model_info",
    description: "Get detailed information about a specific model.",
    inputSchema: {
      type: "object",
      properties: {
        model: { type: "string" },
      },
      required: ["model"],
    },
  },
  {
    name: "get_model_cost",
    description: "Get pricing information for a model.",
    inputSchema: {
      type: "object",
      properties: {
        model: { type: "string" },
      },
      required: ["model"],
    },
  },
  // Routing & Load Balancing
  {
    name: "set_routing_strategy",
    description: "Configure model routing strategy.",
    inputSchema: {
      type: "object",
      properties: {
        strategy: { type: "string", enum: ["simple-shuffle", "least-busy", "usage-based-routing", "latency-based-routing", "cost-based-routing"] },
        fallbacks: { type: "array", items: { type: "string" }, description: "Fallback models in order" },
      },
      required: ["strategy"],
    },
  },
  {
    name: "set_rate_limits",
    description: "Configure rate limits for a model or user.",
    inputSchema: {
      type: "object",
      properties: {
        model: { type: "string" },
        user: { type: "string" },
        requestsPerMinute: { type: "number" },
        tokensPerMinute: { type: "number" },
      },
    },
  },
  // Health & Monitoring
  {
    name: "health_check",
    description: "Check LiteLLM server health.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_usage_stats",
    description: "Get usage statistics.",
    inputSchema: {
      type: "object",
      properties: {
        startDate: { type: "string", description: "ISO date string" },
        endDate: { type: "string" },
        model: { type: "string" },
        user: { type: "string" },
      },
    },
  },
  {
    name: "get_spend_report",
    description: "Get spending report by model/user.",
    inputSchema: {
      type: "object",
      properties: {
        startDate: { type: "string" },
        endDate: { type: "string" },
        groupBy: { type: "string", enum: ["model", "user", "api_key"] },
      },
    },
  },
  // Key Management
  {
    name: "create_api_key",
    description: "Create a virtual API key.",
    inputSchema: {
      type: "object",
      properties: {
        keyAlias: { type: "string" },
        duration: { type: "string", description: "e.g., 30d, 1y" },
        models: { type: "array", items: { type: "string" } },
        maxBudget: { type: "number" },
        metadata: { type: "object" },
      },
    },
  },
  {
    name: "list_api_keys",
    description: "List all virtual API keys.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "delete_api_key",
    description: "Delete a virtual API key.",
    inputSchema: {
      type: "object",
      properties: {
        keyId: { type: "string" },
      },
      required: ["keyId"],
    },
  },
  // Provider Configuration
  {
    name: "add_model",
    description: "Add a new model to the router.",
    inputSchema: {
      type: "object",
      properties: {
        modelName: { type: "string" },
        litellmParams: {
          type: "object",
          properties: {
            model: { type: "string" },
            apiKey: { type: "string" },
            apiBase: { type: "string" },
          },
        },
        modelInfo: {
          type: "object",
          properties: {
            maxTokens: { type: "number" },
            inputCostPerToken: { type: "number" },
            outputCostPerToken: { type: "number" },
          },
        },
      },
      required: ["modelName", "litellmParams"],
    },
  },
  {
    name: "delete_model",
    description: "Remove a model from the router.",
    inputSchema: {
      type: "object",
      properties: {
        modelId: { type: "string" },
      },
      required: ["modelId"],
    },
  },
  // Cache
  {
    name: "flush_cache",
    description: "Clear the response cache.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_cache_stats",
    description: "Get cache statistics.",
    inputSchema: { type: "object", properties: {} },
  },
];

async function chatCompletion(params: {
  model?: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
  stop?: string[];
  user?: string;
}): Promise<any> {
  const res = await litellmRequest("POST", "/chat/completions", {
    model: params.model || config.defaultModel,
    messages: params.messages,
    temperature: params.temperature,
    max_tokens: params.maxTokens,
    top_p: params.topP,
    stream: params.stream || false,
    stop: params.stop,
    user: params.user,
  });
  return {
    id: res.id,
    model: res.model,
    content: res.choices?.[0]?.message?.content,
    finishReason: res.choices?.[0]?.finish_reason,
    usage: res.usage,
  };
}

async function chatCompletionWithTools(params: {
  model?: string;
  messages: any[];
  tools: any[];
  toolChoice?: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<any> {
  const res = await litellmRequest("POST", "/chat/completions", {
    model: params.model || config.defaultModel,
    messages: params.messages,
    tools: params.tools,
    tool_choice: params.toolChoice || "auto",
    temperature: params.temperature,
    max_tokens: params.maxTokens,
  });
  return {
    id: res.id,
    model: res.model,
    message: res.choices?.[0]?.message,
    toolCalls: res.choices?.[0]?.message?.tool_calls,
    finishReason: res.choices?.[0]?.finish_reason,
    usage: res.usage,
  };
}

async function createEmbedding(params: { model?: string; input: string; dimensions?: number }): Promise<any> {
  const res = await litellmRequest("POST", "/embeddings", {
    model: params.model || "text-embedding-3-small",
    input: params.input,
    dimensions: params.dimensions,
  });
  return {
    embedding: res.data?.[0]?.embedding,
    model: res.model,
    usage: res.usage,
  };
}

async function createEmbeddingsBatch(params: { model?: string; inputs: string[] }): Promise<any> {
  const res = await litellmRequest("POST", "/embeddings", {
    model: params.model || "text-embedding-3-small",
    input: params.inputs,
  });
  return {
    embeddings: res.data?.map((d: any) => d.embedding),
    model: res.model,
    count: res.data?.length,
    usage: res.usage,
  };
}

async function listModels(): Promise<any> {
  const res = await litellmRequest("GET", "/models");
  return { models: res.data || res };
}

async function getModelInfo(params: { model: string }): Promise<any> {
  const res = await litellmRequest("GET", `/model/info?model=${params.model}`);
  return res;
}

async function getModelCost(params: { model: string }): Promise<any> {
  const res = await litellmRequest("GET", `/model/cost?model=${params.model}`);
  return res;
}

async function setRoutingStrategy(params: { strategy: string; fallbacks?: string[] }): Promise<any> {
  const res = await litellmRequest("POST", "/router/set_strategy", {
    strategy: params.strategy,
    fallbacks: params.fallbacks,
  });
  return res;
}

async function setRateLimits(params: { model?: string; user?: string; requestsPerMinute?: number; tokensPerMinute?: number }): Promise<any> {
  const res = await litellmRequest("POST", "/rate_limit/set", {
    model: params.model,
    user: params.user,
    rpm: params.requestsPerMinute,
    tpm: params.tokensPerMinute,
  });
  return res;
}

async function healthCheck(): Promise<any> {
  const res = await litellmRequest("GET", "/health");
  return res;
}

async function getUsageStats(params: { startDate?: string; endDate?: string; model?: string; user?: string }): Promise<any> {
  const query = new URLSearchParams();
  if (params.startDate) query.set("start_date", params.startDate);
  if (params.endDate) query.set("end_date", params.endDate);
  if (params.model) query.set("model", params.model);
  if (params.user) query.set("user", params.user);
  const res = await litellmRequest("GET", `/usage?${query.toString()}`);
  return res;
}

async function getSpendReport(params: { startDate?: string; endDate?: string; groupBy?: string }): Promise<any> {
  const query = new URLSearchParams();
  if (params.startDate) query.set("start_date", params.startDate);
  if (params.endDate) query.set("end_date", params.endDate);
  if (params.groupBy) query.set("group_by", params.groupBy);
  const res = await litellmRequest("GET", `/spend/report?${query.toString()}`);
  return res;
}

async function createApiKey(params: { keyAlias?: string; duration?: string; models?: string[]; maxBudget?: number; metadata?: any }): Promise<any> {
  const res = await litellmRequest("POST", "/key/generate", {
    key_alias: params.keyAlias,
    duration: params.duration,
    models: params.models,
    max_budget: params.maxBudget,
    metadata: params.metadata,
  });
  return res;
}

async function listApiKeys(): Promise<any> {
  const res = await litellmRequest("GET", "/key/list");
  return res;
}

async function deleteApiKey(params: { keyId: string }): Promise<any> {
  const res = await litellmRequest("POST", "/key/delete", { keys: [params.keyId] });
  return res;
}

async function addModel(params: { modelName: string; litellmParams: any; modelInfo?: any }): Promise<any> {
  const res = await litellmRequest("POST", "/model/new", {
    model_name: params.modelName,
    litellm_params: params.litellmParams,
    model_info: params.modelInfo,
  });
  return res;
}

async function deleteModel(params: { modelId: string }): Promise<any> {
  const res = await litellmRequest("POST", "/model/delete", { id: params.modelId });
  return res;
}

async function flushCache(): Promise<any> {
  const res = await litellmRequest("POST", "/cache/flush");
  return { flushed: true };
}

async function getCacheStats(): Promise<any> {
  const res = await litellmRequest("GET", "/cache/stats");
  return res;
}

const server = new Server({ name: "litellm-mcp", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result: any;
    switch (name) {
      case "chat_completion": result = await chatCompletion(args as any); break;
      case "chat_completion_with_tools": result = await chatCompletionWithTools(args as any); break;
      case "create_embedding": result = await createEmbedding(args as any); break;
      case "create_embeddings_batch": result = await createEmbeddingsBatch(args as any); break;
      case "list_models": result = await listModels(); break;
      case "get_model_info": result = await getModelInfo(args as any); break;
      case "get_model_cost": result = await getModelCost(args as any); break;
      case "set_routing_strategy": result = await setRoutingStrategy(args as any); break;
      case "set_rate_limits": result = await setRateLimits(args as any); break;
      case "health_check": result = await healthCheck(); break;
      case "get_usage_stats": result = await getUsageStats(args as any); break;
      case "get_spend_report": result = await getSpendReport(args as any); break;
      case "create_api_key": result = await createApiKey(args as any); break;
      case "list_api_keys": result = await listApiKeys(); break;
      case "delete_api_key": result = await deleteApiKey(args as any); break;
      case "add_model": result = await addModel(args as any); break;
      case "delete_model": result = await deleteModel(args as any); break;
      case "flush_cache": result = await flushCache(); break;
      case "get_cache_stats": result = await getCacheStats(); break;
      default: throw new Error(`Unknown tool: ${name}`);
    }
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (error: any) {
    return { content: [{ type: "text", text: JSON.stringify({ error: error.message }) }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("LiteLLM MCP Server running on stdio");
}

main().catch(console.error);
