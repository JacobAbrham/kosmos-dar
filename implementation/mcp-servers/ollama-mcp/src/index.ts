/**
 * Ollama MCP Server - Local LLM inference for KOSMOS agents
 * Provides access to locally running Ollama models
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";

const config = {
  baseUrl: process.env.OLLAMA_HOST || "http://localhost:11434",
  defaultModel: process.env.OLLAMA_DEFAULT_MODEL || "llama3.2",
};

async function ollamaRequest(method: string, path: string, body?: any): Promise<any> {
  const res = await fetch(`${config.baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const error = await res.text().catch(() => res.statusText);
    throw new Error(error || res.statusText);
  }

  return res.json();
}

async function ollamaStreamRequest(path: string, body: any): Promise<any> {
  const res = await fetch(`${config.baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, stream: false }),
  });

  if (!res.ok) {
    const error = await res.text().catch(() => res.statusText);
    throw new Error(error || res.statusText);
  }

  return res.json();
}

const TOOLS: Tool[] = [
  // Generation
  {
    name: "generate",
    description: "Generate a completion from a prompt.",
    inputSchema: {
      type: "object",
      properties: {
        model: { type: "string", description: "Model name (e.g., llama3.2, mistral, codellama)" },
        prompt: { type: "string" },
        system: { type: "string", description: "System prompt" },
        template: { type: "string" },
        context: { type: "array", items: { type: "number" }, description: "Context from previous response" },
        options: {
          type: "object",
          properties: {
            temperature: { type: "number" },
            topK: { type: "number" },
            topP: { type: "number" },
            numPredict: { type: "number" },
            stop: { type: "array", items: { type: "string" } },
            seed: { type: "number" },
          },
        },
        format: { type: "string", enum: ["json"] },
        raw: { type: "boolean" },
      },
      required: ["prompt"],
    },
  },
  {
    name: "chat",
    description: "Generate a chat completion.",
    inputSchema: {
      type: "object",
      properties: {
        model: { type: "string" },
        messages: {
          type: "array",
          items: {
            type: "object",
            properties: {
              role: { type: "string", enum: ["system", "user", "assistant"] },
              content: { type: "string" },
              images: { type: "array", items: { type: "string" }, description: "Base64-encoded images" },
            },
          },
        },
        options: { type: "object" },
        format: { type: "string", enum: ["json"] },
      },
      required: ["messages"],
    },
  },
  // Embeddings
  {
    name: "embed",
    description: "Generate embeddings for text.",
    inputSchema: {
      type: "object",
      properties: {
        model: { type: "string" },
        input: { type: "string" },
      },
      required: ["input"],
    },
  },
  {
    name: "embed_batch",
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
    description: "List locally available models.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "show_model",
    description: "Show model information including modelfile, template, parameters, license.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "pull_model",
    description: "Download a model from the Ollama library.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Model name (e.g., llama3.2, mistral:7b)" },
        insecure: { type: "boolean" },
      },
      required: ["name"],
    },
  },
  {
    name: "push_model",
    description: "Push a model to Ollama registry.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        insecure: { type: "boolean" },
      },
      required: ["name"],
    },
  },
  {
    name: "copy_model",
    description: "Copy a model to a new name.",
    inputSchema: {
      type: "object",
      properties: {
        source: { type: "string" },
        destination: { type: "string" },
      },
      required: ["source", "destination"],
    },
  },
  {
    name: "delete_model",
    description: "Delete a model.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "create_model",
    description: "Create a model from a Modelfile.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        modelfile: { type: "string" },
        path: { type: "string" },
      },
      required: ["name"],
    },
  },
  // Running Models
  {
    name: "list_running",
    description: "List currently loaded/running models.",
    inputSchema: { type: "object", properties: {} },
  },
  // Blob Management
  {
    name: "check_blob",
    description: "Check if a blob exists.",
    inputSchema: {
      type: "object",
      properties: {
        digest: { type: "string" },
      },
      required: ["digest"],
    },
  },
  // Server Status
  {
    name: "server_status",
    description: "Check Ollama server status.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "version",
    description: "Get Ollama version.",
    inputSchema: { type: "object", properties: {} },
  },
];

async function generate(params: {
  model?: string;
  prompt: string;
  system?: string;
  template?: string;
  context?: number[];
  options?: any;
  format?: string;
  raw?: boolean;
}): Promise<any> {
  const res = await ollamaStreamRequest("/api/generate", {
    model: params.model || config.defaultModel,
    prompt: params.prompt,
    system: params.system,
    template: params.template,
    context: params.context,
    options: params.options,
    format: params.format,
    raw: params.raw,
  });
  return {
    model: res.model,
    response: res.response,
    context: res.context,
    totalDuration: res.total_duration,
    loadDuration: res.load_duration,
    promptEvalCount: res.prompt_eval_count,
    evalCount: res.eval_count,
    evalDuration: res.eval_duration,
  };
}

async function chat(params: {
  model?: string;
  messages: Array<{ role: string; content: string; images?: string[] }>;
  options?: any;
  format?: string;
}): Promise<any> {
  const res = await ollamaStreamRequest("/api/chat", {
    model: params.model || config.defaultModel,
    messages: params.messages,
    options: params.options,
    format: params.format,
  });
  return {
    model: res.model,
    message: res.message,
    totalDuration: res.total_duration,
    promptEvalCount: res.prompt_eval_count,
    evalCount: res.eval_count,
  };
}

async function embed(params: { model?: string; input: string }): Promise<any> {
  const res = await ollamaRequest("POST", "/api/embed", {
    model: params.model || config.defaultModel,
    input: params.input,
  });
  return {
    model: res.model,
    embeddings: res.embeddings,
    totalDuration: res.total_duration,
  };
}

async function embedBatch(params: { model?: string; inputs: string[] }): Promise<any> {
  const res = await ollamaRequest("POST", "/api/embed", {
    model: params.model || config.defaultModel,
    input: params.inputs,
  });
  return {
    model: res.model,
    embeddings: res.embeddings,
    count: res.embeddings?.length,
  };
}

async function listModels(): Promise<any> {
  const res = await ollamaRequest("GET", "/api/tags");
  return {
    models: res.models?.map((m: any) => ({
      name: m.name,
      modifiedAt: m.modified_at,
      size: m.size,
      digest: m.digest,
      details: m.details,
    })),
  };
}

async function showModel(params: { name: string }): Promise<any> {
  const res = await ollamaRequest("POST", "/api/show", { name: params.name });
  return res;
}

async function pullModel(params: { name: string; insecure?: boolean }): Promise<any> {
  const res = await ollamaStreamRequest("/api/pull", {
    name: params.name,
    insecure: params.insecure,
  });
  return { status: res.status, digest: res.digest };
}

async function pushModel(params: { name: string; insecure?: boolean }): Promise<any> {
  const res = await ollamaStreamRequest("/api/push", {
    name: params.name,
    insecure: params.insecure,
  });
  return { status: res.status };
}

async function copyModel(params: { source: string; destination: string }): Promise<any> {
  await ollamaRequest("POST", "/api/copy", params);
  return { copied: true, source: params.source, destination: params.destination };
}

async function deleteModel(params: { name: string }): Promise<any> {
  await ollamaRequest("DELETE", "/api/delete", { name: params.name });
  return { deleted: true, name: params.name };
}

async function createModel(params: { name: string; modelfile?: string; path?: string }): Promise<any> {
  const res = await ollamaStreamRequest("/api/create", params);
  return { status: res.status };
}

async function listRunning(): Promise<any> {
  const res = await ollamaRequest("GET", "/api/ps");
  return {
    models: res.models?.map((m: any) => ({
      name: m.name,
      model: m.model,
      size: m.size,
      digest: m.digest,
      expiresAt: m.expires_at,
      sizeVram: m.size_vram,
    })),
  };
}

async function checkBlob(params: { digest: string }): Promise<any> {
  try {
    await ollamaRequest("HEAD", `/api/blobs/${params.digest}`);
    return { exists: true, digest: params.digest };
  } catch {
    return { exists: false, digest: params.digest };
  }
}

async function serverStatus(): Promise<any> {
  try {
    await ollamaRequest("GET", "/");
    return { status: "running", url: config.baseUrl };
  } catch (error: any) {
    return { status: "unreachable", url: config.baseUrl, error: error.message };
  }
}

async function getVersion(): Promise<any> {
  const res = await ollamaRequest("GET", "/api/version");
  return res;
}

const server = new Server({ name: "ollama-mcp", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result: any;
    switch (name) {
      case "generate": result = await generate(args as any); break;
      case "chat": result = await chat(args as any); break;
      case "embed": result = await embed(args as any); break;
      case "embed_batch": result = await embedBatch(args as any); break;
      case "list_models": result = await listModels(); break;
      case "show_model": result = await showModel(args as any); break;
      case "pull_model": result = await pullModel(args as any); break;
      case "push_model": result = await pushModel(args as any); break;
      case "copy_model": result = await copyModel(args as any); break;
      case "delete_model": result = await deleteModel(args as any); break;
      case "create_model": result = await createModel(args as any); break;
      case "list_running": result = await listRunning(); break;
      case "check_blob": result = await checkBlob(args as any); break;
      case "server_status": result = await serverStatus(); break;
      case "version": result = await getVersion(); break;
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
  console.error("Ollama MCP Server running on stdio");
}

main().catch(console.error);
