/**
 * Open Policy Agent MCP Server - Policy management and evaluation for KOSMOS agents
 *
 * Provides tools for managing policies, data, query evaluation, partial compilation,
 * health checks, bundles, and decision logs via the OPA REST API.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";

const config = {
  opaUrl: process.env.OPA_URL || "http://localhost:8181",
  authToken: process.env.OPA_AUTH_TOKEN || "",
};

async function opaRequest(method: string, path: string, body?: any): Promise<any> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.authToken) {
    headers["Authorization"] = `Bearer ${config.authToken}`;
  }

  const res = await fetch(`${config.opaUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || error.code || res.statusText);
  }

  if (res.status === 204) return {};
  const contentType = res.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    return res.json();
  }
  return { raw: await res.text() };
}

const TOOLS: Tool[] = [
  // Policy Management
  {
    name: "policy_list",
    description: "List all policies loaded in OPA.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "policy_get",
    description: "Get a specific policy by its ID/path.",
    inputSchema: {
      type: "object",
      properties: {
        policyId: { type: "string", description: "Policy ID (path without /v1/policies/ prefix)" },
      },
      required: ["policyId"],
    },
  },
  {
    name: "policy_create",
    description: "Create or update a policy with Rego code.",
    inputSchema: {
      type: "object",
      properties: {
        policyId: { type: "string", description: "Policy ID (path)" },
        rego: { type: "string", description: "Rego policy code" },
      },
      required: ["policyId", "rego"],
    },
  },
  {
    name: "policy_delete",
    description: "Delete a policy by its ID.",
    inputSchema: {
      type: "object",
      properties: {
        policyId: { type: "string", description: "Policy ID to delete" },
      },
      required: ["policyId"],
    },
  },

  // Data Management
  {
    name: "data_get",
    description: "Get data from OPA's data store at a specific path.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Data path (e.g., 'users', 'roles/admin')" },
      },
    },
  },
  {
    name: "data_put",
    description: "Create or overwrite data at a specific path.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Data path" },
        data: { type: "object", description: "Data to store" },
      },
      required: ["path", "data"],
    },
  },
  {
    name: "data_patch",
    description: "Patch data at a specific path using JSON Patch operations.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Data path" },
        operations: {
          type: "array",
          description: "JSON Patch operations (op, path, value)",
          items: {
            type: "object",
            properties: {
              op: { type: "string", enum: ["add", "remove", "replace", "move", "copy", "test"] },
              path: { type: "string" },
              value: {},
            },
            required: ["op", "path"],
          },
        },
      },
      required: ["path", "operations"],
    },
  },
  {
    name: "data_delete",
    description: "Delete data at a specific path.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Data path to delete" },
      },
      required: ["path"],
    },
  },

  // Query Evaluation
  {
    name: "query_evaluate",
    description: "Execute an ad-hoc Rego query against OPA.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Rego query to evaluate" },
        input: { type: "object", description: "Input document for the query" },
      },
      required: ["query"],
    },
  },
  {
    name: "policy_evaluate",
    description: "Evaluate a policy decision at a specific path with input.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Policy decision path (e.g., 'authz/allow')" },
        input: { type: "object", description: "Input document for evaluation" },
      },
      required: ["path"],
    },
  },
  {
    name: "batch_evaluate",
    description: "Evaluate multiple inputs against a policy in batch.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Policy decision path" },
        inputs: {
          type: "array",
          description: "Array of input documents to evaluate",
          items: { type: "object" },
        },
      },
      required: ["path", "inputs"],
    },
  },

  // Partial Evaluation / Compile
  {
    name: "compile",
    description: "Compile a query for partial evaluation (returns residual AST).",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Rego query to compile" },
        input: { type: "object", description: "Known input values" },
        unknowns: {
          type: "array",
          description: "Unknown data references (e.g., ['input.user', 'data.roles'])",
          items: { type: "string" },
        },
        options: {
          type: "object",
          description: "Compile options",
          properties: {
            disableInlining: { type: "array", items: { type: "string" } },
          },
        },
      },
      required: ["query"],
    },
  },

  // Health Checks
  {
    name: "health_check",
    description: "Check OPA server health status.",
    inputSchema: {
      type: "object",
      properties: {
        bundles: { type: "boolean", description: "Include bundle activation status" },
        plugins: { type: "boolean", description: "Include plugin status" },
      },
    },
  },
  {
    name: "health_live",
    description: "Simple liveness check for OPA.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "health_ready",
    description: "Readiness check for OPA (includes bundle status if configured).",
    inputSchema: { type: "object", properties: {} },
  },

  // Bundle Management
  {
    name: "bundle_status",
    description: "Get the status of all configured bundles.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "bundle_activate",
    description: "Activate a bundle from a tarball or directory.",
    inputSchema: {
      type: "object",
      properties: {
        bundleName: { type: "string", description: "Name for the bundle" },
        bundleData: { type: "string", description: "Base64-encoded bundle tarball" },
      },
      required: ["bundleName", "bundleData"],
    },
  },

  // Decision Logs
  {
    name: "decision_logs_status",
    description: "Get decision logging plugin status.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "decision_logs_trigger",
    description: "Trigger an immediate decision log upload (if plugin configured).",
    inputSchema: { type: "object", properties: {} },
  },

  // Status & Config
  {
    name: "status",
    description: "Get OPA status including plugins, bundles, and discovery.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "config_get",
    description: "Get the active OPA configuration.",
    inputSchema: { type: "object", properties: {} },
  },

  // Metrics
  {
    name: "metrics",
    description: "Get OPA metrics in Prometheus format.",
    inputSchema: { type: "object", properties: {} },
  },
];

// Policy Management Functions
async function policyList(): Promise<any> {
  const res = await opaRequest("GET", "/v1/policies");
  return {
    policies: res.result?.map((p: any) => ({
      id: p.id,
      raw: p.raw?.substring(0, 200) + (p.raw?.length > 200 ? "..." : ""),
      ast: p.ast ? "parsed" : "none",
    })) || [],
  };
}

async function policyGet(params: { policyId: string }): Promise<any> {
  const res = await opaRequest("GET", `/v1/policies/${params.policyId}`);
  return {
    id: res.result?.id,
    raw: res.result?.raw,
    ast: res.result?.ast,
  };
}

async function policyCreate(params: { policyId: string; rego: string }): Promise<any> {
  const res = await fetch(`${config.opaUrl}/v1/policies/${params.policyId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "text/plain",
      ...(config.authToken ? { Authorization: `Bearer ${config.authToken}` } : {}),
    },
    body: params.rego,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || error.errors?.join(", ") || res.statusText);
  }

  return { policyId: params.policyId, created: true };
}

async function policyDelete(params: { policyId: string }): Promise<any> {
  await opaRequest("DELETE", `/v1/policies/${params.policyId}`);
  return { policyId: params.policyId, deleted: true };
}

// Data Management Functions
async function dataGet(params: { path?: string }): Promise<any> {
  const path = params.path ? `/${params.path}` : "";
  const res = await opaRequest("GET", `/v1/data${path}`);
  return { path: params.path || "/", data: res.result };
}

async function dataPut(params: { path: string; data: any }): Promise<any> {
  await opaRequest("PUT", `/v1/data/${params.path}`, params.data);
  return { path: params.path, updated: true };
}

async function dataPatch(params: { path: string; operations: any[] }): Promise<any> {
  const res = await fetch(`${config.opaUrl}/v1/data/${params.path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json-patch+json",
      ...(config.authToken ? { Authorization: `Bearer ${config.authToken}` } : {}),
    },
    body: JSON.stringify(params.operations),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || res.statusText);
  }

  return { path: params.path, patched: true };
}

async function dataDelete(params: { path: string }): Promise<any> {
  await opaRequest("DELETE", `/v1/data/${params.path}`);
  return { path: params.path, deleted: true };
}

// Query Evaluation Functions
async function queryEvaluate(params: { query: string; input?: any }): Promise<any> {
  const body: any = { query: params.query };
  if (params.input) body.input = params.input;

  const res = await opaRequest("POST", "/v1/query", body);
  return { result: res.result };
}

async function policyEvaluate(params: { path: string; input?: any }): Promise<any> {
  const body = params.input ? { input: params.input } : undefined;
  const res = await opaRequest("POST", `/v1/data/${params.path}`, body);
  return { decision: res.result, decision_id: res.decision_id };
}

async function batchEvaluate(params: { path: string; inputs: any[] }): Promise<any> {
  const results = await Promise.all(
    params.inputs.map(async (input, index) => {
      try {
        const res = await opaRequest("POST", `/v1/data/${params.path}`, { input });
        return { index, decision: res.result, success: true };
      } catch (error: any) {
        return { index, error: error.message, success: false };
      }
    })
  );
  return { results };
}

// Compile (Partial Evaluation) Function
async function compile(params: { query: string; input?: any; unknowns?: string[]; options?: any }): Promise<any> {
  const body: any = { query: params.query };
  if (params.input) body.input = params.input;
  if (params.unknowns) body.unknowns = params.unknowns;
  if (params.options) body.options = params.options;

  const res = await opaRequest("POST", "/v1/compile", body);
  return {
    result: res.result,
    queries: res.result?.queries,
    support: res.result?.support,
  };
}

// Health Check Functions
async function healthCheck(params: { bundles?: boolean; plugins?: boolean }): Promise<any> {
  const queryParams: string[] = [];
  if (params.bundles) queryParams.push("bundles");
  if (params.plugins) queryParams.push("plugins");
  const query = queryParams.length ? `?${queryParams.join("&")}` : "";

  const res = await fetch(`${config.opaUrl}/health${query}`, {
    headers: config.authToken ? { Authorization: `Bearer ${config.authToken}` } : {},
  });

  if (!res.ok && res.status !== 500) {
    throw new Error(`Health check failed: ${res.statusText}`);
  }

  const data = await res.json().catch(() => ({}));
  return { status: res.ok ? "healthy" : "unhealthy", statusCode: res.status, ...data };
}

async function healthLive(): Promise<any> {
  const res = await fetch(`${config.opaUrl}/health?bundles=false&plugins=false`, {
    headers: config.authToken ? { Authorization: `Bearer ${config.authToken}` } : {},
  });
  return { live: res.ok, statusCode: res.status };
}

async function healthReady(): Promise<any> {
  const res = await fetch(`${config.opaUrl}/health?bundles=true`, {
    headers: config.authToken ? { Authorization: `Bearer ${config.authToken}` } : {},
  });
  return { ready: res.ok, statusCode: res.status };
}

// Bundle Management Functions
async function bundleStatus(): Promise<any> {
  const res = await opaRequest("GET", "/v1/status");
  return {
    bundles: res.result?.bundles || {},
    plugins: res.result?.plugins || {},
  };
}

async function bundleActivate(params: { bundleName: string; bundleData: string }): Promise<any> {
  const binaryData = Buffer.from(params.bundleData, "base64");
  const res = await fetch(`${config.opaUrl}/v1/bundles/${params.bundleName}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/gzip",
      ...(config.authToken ? { Authorization: `Bearer ${config.authToken}` } : {}),
    },
    body: binaryData,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || res.statusText);
  }

  return { bundleName: params.bundleName, activated: true };
}

// Decision Log Functions
async function decisionLogsStatus(): Promise<any> {
  const res = await opaRequest("GET", "/v1/status");
  return {
    decision_logs: res.result?.plugins?.decision_logs || { status: "not_configured" },
  };
}

async function decisionLogsTrigger(): Promise<any> {
  try {
    await opaRequest("POST", "/v1/decision_logs/trigger");
    return { triggered: true };
  } catch (error: any) {
    return { triggered: false, message: error.message };
  }
}

// Status & Config Functions
async function getStatus(): Promise<any> {
  const res = await opaRequest("GET", "/v1/status");
  return res.result;
}

async function configGet(): Promise<any> {
  const res = await opaRequest("GET", "/v1/config");
  return res.result;
}

// Metrics Function
async function getMetrics(): Promise<any> {
  const res = await fetch(`${config.opaUrl}/metrics`, {
    headers: config.authToken ? { Authorization: `Bearer ${config.authToken}` } : {},
  });

  if (!res.ok) {
    throw new Error(`Failed to get metrics: ${res.statusText}`);
  }

  return { metrics: await res.text() };
}

// Server Setup
const server = new Server({ name: "opa-mcp", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result: any;
    switch (name) {
      // Policy Management
      case "policy_list": result = await policyList(); break;
      case "policy_get": result = await policyGet(args as any); break;
      case "policy_create": result = await policyCreate(args as any); break;
      case "policy_delete": result = await policyDelete(args as any); break;

      // Data Management
      case "data_get": result = await dataGet(args as any); break;
      case "data_put": result = await dataPut(args as any); break;
      case "data_patch": result = await dataPatch(args as any); break;
      case "data_delete": result = await dataDelete(args as any); break;

      // Query Evaluation
      case "query_evaluate": result = await queryEvaluate(args as any); break;
      case "policy_evaluate": result = await policyEvaluate(args as any); break;
      case "batch_evaluate": result = await batchEvaluate(args as any); break;

      // Compile
      case "compile": result = await compile(args as any); break;

      // Health Checks
      case "health_check": result = await healthCheck(args as any); break;
      case "health_live": result = await healthLive(); break;
      case "health_ready": result = await healthReady(); break;

      // Bundle Management
      case "bundle_status": result = await bundleStatus(); break;
      case "bundle_activate": result = await bundleActivate(args as any); break;

      // Decision Logs
      case "decision_logs_status": result = await decisionLogsStatus(); break;
      case "decision_logs_trigger": result = await decisionLogsTrigger(); break;

      // Status & Config
      case "status": result = await getStatus(); break;
      case "config_get": result = await configGet(); break;

      // Metrics
      case "metrics": result = await getMetrics(); break;

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
  console.error("OPA MCP Server running on stdio");
}

main().catch(console.error);
