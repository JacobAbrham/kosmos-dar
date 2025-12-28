/**
 * Falco MCP Server - Runtime security monitoring for KOSMOS
 * Provides Falco rule management, alert handling, and security monitoring
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";

const config = {
  falcoUrl: process.env.FALCO_URL || "http://localhost:8765",
  apiKey: process.env.FALCO_API_KEY || "",
};

const TOOLS: Tool[] = [
  // Rule Management
  {
    name: "list_rules",
    description: "List all Falco rules configured in the system.",
    inputSchema: {
      type: "object",
      properties: {
        source: { type: "string", description: "Filter by rule source (e.g., syscall, k8s_audit)" },
        priority: { type: "string", description: "Filter by priority (emergency, alert, critical, error, warning, notice, info, debug)" },
        enabled: { type: "boolean", description: "Filter by enabled status" },
        tag: { type: "string", description: "Filter by tag" },
      },
    },
  },
  {
    name: "get_rule",
    description: "Get detailed information about a specific Falco rule.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "The name of the rule" },
      },
      required: ["name"],
    },
  },
  {
    name: "enable_rule",
    description: "Enable a Falco rule.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "The name of the rule to enable" },
      },
      required: ["name"],
    },
  },
  {
    name: "disable_rule",
    description: "Disable a Falco rule.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "The name of the rule to disable" },
      },
      required: ["name"],
    },
  },
  // Alert Management
  {
    name: "list_alerts",
    description: "List recent security alerts from Falco.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Maximum number of alerts to return (default: 100)" },
        since: { type: "string", description: "ISO timestamp to filter alerts from" },
        until: { type: "string", description: "ISO timestamp to filter alerts until" },
        priority: { type: "string", description: "Filter by priority level" },
        rule: { type: "string", description: "Filter by rule name" },
        hostname: { type: "string", description: "Filter by hostname" },
        container_id: { type: "string", description: "Filter by container ID" },
        acknowledged: { type: "boolean", description: "Filter by acknowledged status" },
      },
    },
  },
  {
    name: "get_alert",
    description: "Get detailed information about a specific alert.",
    inputSchema: {
      type: "object",
      properties: {
        alert_id: { type: "string", description: "The unique identifier of the alert" },
      },
      required: ["alert_id"],
    },
  },
  {
    name: "acknowledge_alert",
    description: "Acknowledge a security alert.",
    inputSchema: {
      type: "object",
      properties: {
        alert_id: { type: "string", description: "The unique identifier of the alert" },
        comment: { type: "string", description: "Optional comment about the acknowledgment" },
        user: { type: "string", description: "User acknowledging the alert" },
      },
      required: ["alert_id"],
    },
  },
  // Output Management
  {
    name: "list_outputs",
    description: "List configured output destinations for Falco alerts.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "add_output",
    description: "Add a new output destination for Falco alerts.",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", description: "Output type (stdout, file, syslog, http, grpc, program)" },
        url: { type: "string", description: "URL for http output type" },
        path: { type: "string", description: "File path for file output type" },
        enabled: { type: "boolean", description: "Whether the output is enabled (default: true)" },
        format: { type: "string", description: "Output format (json, text)" },
        options: { type: "object", description: "Additional output-specific options" },
      },
      required: ["type"],
    },
  },
  {
    name: "remove_output",
    description: "Remove an output destination.",
    inputSchema: {
      type: "object",
      properties: {
        output_id: { type: "string", description: "The identifier of the output to remove" },
      },
      required: ["output_id"],
    },
  },
  // Statistics and Metrics
  {
    name: "get_stats",
    description: "Get Falco runtime statistics.",
    inputSchema: {
      type: "object",
      properties: {
        include_rules: { type: "boolean", description: "Include per-rule statistics" },
        include_outputs: { type: "boolean", description: "Include per-output statistics" },
      },
    },
  },
  {
    name: "get_version",
    description: "Get Falco version information.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "health_check",
    description: "Check Falco health status.",
    inputSchema: {
      type: "object",
      properties: {
        detailed: { type: "boolean", description: "Include detailed health information" },
      },
    },
  },
  {
    name: "list_syscalls",
    description: "List monitored system calls.",
    inputSchema: {
      type: "object",
      properties: {
        category: { type: "string", description: "Filter by syscall category (file, network, process, etc.)" },
        enabled: { type: "boolean", description: "Filter by enabled status" },
      },
    },
  },
  {
    name: "get_metrics",
    description: "Get Falco metrics in Prometheus format.",
    inputSchema: {
      type: "object",
      properties: {
        format: { type: "string", description: "Output format (prometheus, json)" },
      },
    },
  },
];

async function falcoRequest(
  method: string,
  endpoint: string,
  body?: any
): Promise<any> {
  const url = `${config.falcoUrl}${endpoint}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }

  const options: RequestInit = {
    method,
    headers,
  };

  if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Falco API error (${response.status}): ${errorText}`);
  }

  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

// Rule Management Functions
async function listRules(params: {
  source?: string;
  priority?: string;
  enabled?: boolean;
  tag?: string;
}): Promise<any> {
  const queryParams = new URLSearchParams();
  if (params.source) queryParams.append("source", params.source);
  if (params.priority) queryParams.append("priority", params.priority);
  if (params.enabled !== undefined) queryParams.append("enabled", String(params.enabled));
  if (params.tag) queryParams.append("tag", params.tag);

  const query = queryParams.toString();
  const endpoint = `/api/v1/rules${query ? `?${query}` : ""}`;
  return falcoRequest("GET", endpoint);
}

async function getRule(params: { name: string }): Promise<any> {
  return falcoRequest("GET", `/api/v1/rules/${encodeURIComponent(params.name)}`);
}

async function enableRule(params: { name: string }): Promise<any> {
  return falcoRequest("PUT", `/api/v1/rules/${encodeURIComponent(params.name)}/enable`);
}

async function disableRule(params: { name: string }): Promise<any> {
  return falcoRequest("PUT", `/api/v1/rules/${encodeURIComponent(params.name)}/disable`);
}

// Alert Management Functions
async function listAlerts(params: {
  limit?: number;
  since?: string;
  until?: string;
  priority?: string;
  rule?: string;
  hostname?: string;
  container_id?: string;
  acknowledged?: boolean;
}): Promise<any> {
  const queryParams = new URLSearchParams();
  if (params.limit) queryParams.append("limit", String(params.limit));
  if (params.since) queryParams.append("since", params.since);
  if (params.until) queryParams.append("until", params.until);
  if (params.priority) queryParams.append("priority", params.priority);
  if (params.rule) queryParams.append("rule", params.rule);
  if (params.hostname) queryParams.append("hostname", params.hostname);
  if (params.container_id) queryParams.append("container_id", params.container_id);
  if (params.acknowledged !== undefined) queryParams.append("acknowledged", String(params.acknowledged));

  const query = queryParams.toString();
  const endpoint = `/api/v1/alerts${query ? `?${query}` : ""}`;
  return falcoRequest("GET", endpoint);
}

async function getAlert(params: { alert_id: string }): Promise<any> {
  return falcoRequest("GET", `/api/v1/alerts/${encodeURIComponent(params.alert_id)}`);
}

async function acknowledgeAlert(params: {
  alert_id: string;
  comment?: string;
  user?: string;
}): Promise<any> {
  return falcoRequest("POST", `/api/v1/alerts/${encodeURIComponent(params.alert_id)}/acknowledge`, {
    comment: params.comment,
    user: params.user,
  });
}

// Output Management Functions
async function listOutputs(): Promise<any> {
  return falcoRequest("GET", "/api/v1/outputs");
}

async function addOutput(params: {
  type: string;
  url?: string;
  path?: string;
  enabled?: boolean;
  format?: string;
  options?: Record<string, any>;
}): Promise<any> {
  return falcoRequest("POST", "/api/v1/outputs", {
    type: params.type,
    url: params.url,
    path: params.path,
    enabled: params.enabled ?? true,
    format: params.format,
    options: params.options,
  });
}

async function removeOutput(params: { output_id: string }): Promise<any> {
  return falcoRequest("DELETE", `/api/v1/outputs/${encodeURIComponent(params.output_id)}`);
}

// Statistics and Metrics Functions
async function getStats(params: {
  include_rules?: boolean;
  include_outputs?: boolean;
}): Promise<any> {
  const queryParams = new URLSearchParams();
  if (params.include_rules) queryParams.append("include_rules", "true");
  if (params.include_outputs) queryParams.append("include_outputs", "true");

  const query = queryParams.toString();
  const endpoint = `/api/v1/stats${query ? `?${query}` : ""}`;
  return falcoRequest("GET", endpoint);
}

async function getVersion(): Promise<any> {
  return falcoRequest("GET", "/api/v1/version");
}

async function healthCheck(params: { detailed?: boolean }): Promise<any> {
  const endpoint = params.detailed ? "/api/v1/health?detailed=true" : "/api/v1/health";
  return falcoRequest("GET", endpoint);
}

async function listSyscalls(params: {
  category?: string;
  enabled?: boolean;
}): Promise<any> {
  const queryParams = new URLSearchParams();
  if (params.category) queryParams.append("category", params.category);
  if (params.enabled !== undefined) queryParams.append("enabled", String(params.enabled));

  const query = queryParams.toString();
  const endpoint = `/api/v1/syscalls${query ? `?${query}` : ""}`;
  return falcoRequest("GET", endpoint);
}

async function getMetrics(params: { format?: string }): Promise<any> {
  const format = params.format || "json";
  return falcoRequest("GET", `/api/v1/metrics?format=${format}`);
}

const server = new Server(
  { name: "falco-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result: any;
    switch (name) {
      // Rule Management
      case "list_rules":
        result = await listRules(args as any);
        break;
      case "get_rule":
        result = await getRule(args as any);
        break;
      case "enable_rule":
        result = await enableRule(args as any);
        break;
      case "disable_rule":
        result = await disableRule(args as any);
        break;
      // Alert Management
      case "list_alerts":
        result = await listAlerts(args as any);
        break;
      case "get_alert":
        result = await getAlert(args as any);
        break;
      case "acknowledge_alert":
        result = await acknowledgeAlert(args as any);
        break;
      // Output Management
      case "list_outputs":
        result = await listOutputs();
        break;
      case "add_output":
        result = await addOutput(args as any);
        break;
      case "remove_output":
        result = await removeOutput(args as any);
        break;
      // Statistics and Metrics
      case "get_stats":
        result = await getStats(args as any);
        break;
      case "get_version":
        result = await getVersion();
        break;
      case "health_check":
        result = await healthCheck(args as any);
        break;
      case "list_syscalls":
        result = await listSyscalls(args as any);
        break;
      case "get_metrics":
        result = await getMetrics(args as any);
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (error: any) {
    return {
      content: [{ type: "text", text: JSON.stringify({ error: error.message }) }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Falco MCP Server running on stdio");
}

main().catch(console.error);
