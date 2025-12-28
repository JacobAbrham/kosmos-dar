/**
 * Prometheus MCP Server - Metrics querying, alerting, and management for KOSMOS agents
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";

// ============================================================================
// CONFIGURATION
// ============================================================================

const config = {
  url: process.env.PROMETHEUS_URL || "http://localhost:9090",
  user: process.env.PROMETHEUS_USER || "",
  password: process.env.PROMETHEUS_PASSWORD || "",
};

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.user && config.password) {
    const auth = Buffer.from(`${config.user}:${config.password}`).toString("base64");
    headers["Authorization"] = `Basic ${auth}`;
  }
  return headers;
}

async function promGet(path: string, params?: Record<string, string>): Promise<any> {
  const query = params ? `?${new URLSearchParams(params)}` : "";
  const res = await fetch(`${config.url}${path}${query}`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Prometheus error (${res.status}): ${text || res.statusText}`);
  }
  const data = await res.json();
  if (data.status && data.status !== "success") {
    throw new Error(data.error || data.errorType || "Query failed");
  }
  return data.data !== undefined ? data.data : data;
}

async function promPost(path: string, params?: Record<string, string>, body?: any): Promise<any> {
  const query = params ? `?${new URLSearchParams(params)}` : "";
  const res = await fetch(`${config.url}${path}${query}`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Prometheus error (${res.status}): ${text || res.statusText}`);
  }
  if (res.status === 204) return { success: true };
  const data = await res.json();
  if (data.status && data.status !== "success") {
    throw new Error(data.error || data.errorType || "Request failed");
  }
  return data.data !== undefined ? data.data : data;
}

async function promPut(path: string, body?: any): Promise<any> {
  const res = await fetch(`${config.url}${path}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Prometheus error (${res.status}): ${text || res.statusText}`);
  }
  if (res.status === 204) return { success: true };
  const data = await res.json();
  return data.data !== undefined ? data.data : data;
}

// ============================================================================
// TOOLS DEFINITION
// ============================================================================

const TOOLS: Tool[] = [
  // ---- Query Tools ----
  {
    name: "query",
    description: "Execute an instant PromQL query at a single point in time. Returns the current value of the expression.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "PromQL query expression (e.g., 'up', 'rate(http_requests_total[5m])')" },
        time: { type: "string", description: "Evaluation timestamp (RFC3339 or Unix timestamp). Defaults to current time." },
        timeout: { type: "string", description: "Evaluation timeout (e.g., '30s')" },
      },
      required: ["query"],
    },
  },
  {
    name: "query_range",
    description: "Execute a range PromQL query over a time range. Returns a matrix of time series data.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "PromQL query expression" },
        start: { type: "string", description: "Start timestamp (RFC3339 or Unix timestamp)" },
        end: { type: "string", description: "End timestamp (RFC3339 or Unix timestamp)" },
        step: { type: "string", description: "Query resolution step (e.g., '15s', '1m', '5m')" },
        timeout: { type: "string", description: "Evaluation timeout" },
      },
      required: ["query", "start", "end"],
    },
  },

  // ---- Series & Labels ----
  {
    name: "list_series",
    description: "List time series matching a set of label selectors. Returns metadata about matching series.",
    inputSchema: {
      type: "object",
      properties: {
        match: {
          type: "array",
          items: { type: "string" },
          description: "Series selector(s) to match (e.g., ['up', 'process_start_time_seconds{job=\"prometheus\"}'])"
        },
        start: { type: "string", description: "Start timestamp for the series lookup" },
        end: { type: "string", description: "End timestamp for the series lookup" },
        limit: { type: "number", description: "Maximum number of series to return" },
      },
      required: ["match"],
    },
  },
  {
    name: "get_labels",
    description: "Get all unique label names in the time series database.",
    inputSchema: {
      type: "object",
      properties: {
        match: {
          type: "array",
          items: { type: "string" },
          description: "Optional series selector(s) to filter labels"
        },
        start: { type: "string", description: "Start timestamp" },
        end: { type: "string", description: "End timestamp" },
      },
    },
  },
  {
    name: "get_label_values",
    description: "Get all unique values for a specific label name.",
    inputSchema: {
      type: "object",
      properties: {
        label: { type: "string", description: "Label name to get values for (e.g., 'job', 'instance', '__name__')" },
        match: {
          type: "array",
          items: { type: "string" },
          description: "Optional series selector(s) to filter values"
        },
        start: { type: "string", description: "Start timestamp" },
        end: { type: "string", description: "End timestamp" },
      },
      required: ["label"],
    },
  },

  // ---- Targets ----
  {
    name: "list_targets",
    description: "List all scrape targets and their current state (active, dropped, health status).",
    inputSchema: {
      type: "object",
      properties: {
        state: {
          type: "string",
          enum: ["active", "dropped", "any"],
          description: "Filter targets by state. 'any' returns all targets."
        },
        scrapePool: { type: "string", description: "Filter by scrape pool name" },
      },
    },
  },
  {
    name: "get_target_metadata",
    description: "Get metadata about metrics exposed by scrape targets.",
    inputSchema: {
      type: "object",
      properties: {
        match_target: { type: "string", description: "Label selector to match targets (e.g., '{job=\"prometheus\"}')" },
        metric: { type: "string", description: "Metric name to filter metadata" },
        limit: { type: "number", description: "Maximum number of targets to return" },
      },
    },
  },

  // ---- Rules ----
  {
    name: "list_rules",
    description: "List all alerting and recording rules, grouped by rule group.",
    inputSchema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["alert", "record"],
          description: "Filter rules by type (alerting or recording)"
        },
        rule_name: {
          type: "array",
          items: { type: "string" },
          description: "Filter by specific rule names"
        },
        rule_group: {
          type: "array",
          items: { type: "string" },
          description: "Filter by specific rule group names"
        },
        file: {
          type: "array",
          items: { type: "string" },
          description: "Filter by specific rule file names"
        },
      },
    },
  },

  // ---- Alerts ----
  {
    name: "list_alerts",
    description: "List all active alerts from Prometheus.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_alert",
    description: "Get details about a specific alert by name.",
    inputSchema: {
      type: "object",
      properties: {
        alert_name: { type: "string", description: "Name of the alert to get details for" },
      },
      required: ["alert_name"],
    },
  },

  // ---- Alertmanagers ----
  {
    name: "list_alertmanagers",
    description: "List all configured Alertmanager instances and their status.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },

  // ---- Status & Info ----
  {
    name: "get_config",
    description: "Get the current Prometheus configuration YAML.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_flags",
    description: "Get the runtime flags and their values that Prometheus was started with.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_runtime_info",
    description: "Get runtime information about Prometheus (memory, goroutines, storage retention, etc.).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_build_info",
    description: "Get build information about Prometheus (version, revision, build date, Go version).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_tsdb_status",
    description: "Get TSDB (Time Series Database) status including cardinality statistics, head block info, and label statistics.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Limit the number of returned label statistics" },
      },
    },
  },

  // ---- Admin Operations ----
  {
    name: "delete_series",
    description: "Delete time series data matching label selectors. Requires admin API enabled (--web.enable-admin-api flag).",
    inputSchema: {
      type: "object",
      properties: {
        match: {
          type: "array",
          items: { type: "string" },
          description: "Series selector(s) to match for deletion (e.g., ['up{job=\"test\"}'])"
        },
        start: { type: "string", description: "Start timestamp for deletion range (inclusive)" },
        end: { type: "string", description: "End timestamp for deletion range (inclusive)" },
      },
      required: ["match"],
    },
  },
  {
    name: "clean_tombstones",
    description: "Remove deleted data (tombstones) from disk. Requires admin API enabled. This is a maintenance operation.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "snapshot",
    description: "Create a snapshot of the TSDB data to the snapshots directory. Requires admin API enabled.",
    inputSchema: {
      type: "object",
      properties: {
        skip_head: { type: "boolean", description: "Skip data in the head block (in-memory data not yet persisted)" },
      },
    },
  },

  // ---- Health Check ----
  {
    name: "health_check",
    description: "Check Prometheus server health and readiness status.",
    inputSchema: {
      type: "object",
      properties: {
        check_type: {
          type: "string",
          enum: ["healthy", "ready"],
          description: "Type of health check: 'healthy' for liveness, 'ready' for readiness"
        },
      },
    },
  },
];

// ============================================================================
// HANDLER FUNCTIONS
// ============================================================================

// ---- Query Tools ----
async function query(params: { query: string; time?: string; timeout?: string }): Promise<any> {
  const queryParams: Record<string, string> = { query: params.query };
  if (params.time) queryParams.time = params.time;
  if (params.timeout) queryParams.timeout = params.timeout;
  const data = await promGet("/api/v1/query", queryParams);
  return { resultType: data.resultType, result: data.result };
}

async function queryRange(params: { query: string; start: string; end: string; step?: string; timeout?: string }): Promise<any> {
  const queryParams: Record<string, string> = {
    query: params.query,
    start: params.start,
    end: params.end,
    step: params.step || "15s",
  };
  if (params.timeout) queryParams.timeout = params.timeout;
  const data = await promGet("/api/v1/query_range", queryParams);
  return { resultType: data.resultType, result: data.result };
}

// ---- Series & Labels ----
async function listSeries(params: { match: string[]; start?: string; end?: string; limit?: number }): Promise<any> {
  const queryParams: Record<string, string> = {};
  if (params.start) queryParams.start = params.start;
  if (params.end) queryParams.end = params.end;
  if (params.limit) queryParams.limit = params.limit.toString();

  // Build query string with multiple match[] parameters
  const matchParams = params.match.map(m => `match[]=${encodeURIComponent(m)}`).join("&");
  const otherParams = new URLSearchParams(queryParams).toString();
  const fullQuery = [matchParams, otherParams].filter(Boolean).join("&");

  const res = await fetch(`${config.url}/api/v1/series?${fullQuery}`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Prometheus error (${res.status}): ${text || res.statusText}`);
  }
  const data = await res.json();
  if (data.status !== "success") {
    throw new Error(data.error || "Query failed");
  }
  return { series: data.data, count: data.data?.length || 0 };
}

async function getLabels(params: { match?: string[]; start?: string; end?: string }): Promise<any> {
  const queryParams: Record<string, string> = {};
  if (params.start) queryParams.start = params.start;
  if (params.end) queryParams.end = params.end;

  let data;
  if (params.match && params.match.length > 0) {
    const matchParams = params.match.map(m => `match[]=${encodeURIComponent(m)}`).join("&");
    const otherParams = new URLSearchParams(queryParams).toString();
    const fullQuery = [matchParams, otherParams].filter(Boolean).join("&");

    const res = await fetch(`${config.url}/api/v1/labels?${fullQuery}`, {
      method: "GET",
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Prometheus error (${res.status}): ${text || res.statusText}`);
    }
    const jsonData = await res.json();
    if (jsonData.status !== "success") {
      throw new Error(jsonData.error || "Query failed");
    }
    data = jsonData.data;
  } else {
    data = await promGet("/api/v1/labels", queryParams);
  }
  return { labels: data, count: data?.length || 0 };
}

async function getLabelValues(params: { label: string; match?: string[]; start?: string; end?: string }): Promise<any> {
  const queryParams: Record<string, string> = {};
  if (params.start) queryParams.start = params.start;
  if (params.end) queryParams.end = params.end;

  let data;
  if (params.match && params.match.length > 0) {
    const matchParams = params.match.map(m => `match[]=${encodeURIComponent(m)}`).join("&");
    const otherParams = new URLSearchParams(queryParams).toString();
    const fullQuery = [matchParams, otherParams].filter(Boolean).join("&");

    const res = await fetch(`${config.url}/api/v1/label/${encodeURIComponent(params.label)}/values?${fullQuery}`, {
      method: "GET",
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Prometheus error (${res.status}): ${text || res.statusText}`);
    }
    const jsonData = await res.json();
    if (jsonData.status !== "success") {
      throw new Error(jsonData.error || "Query failed");
    }
    data = jsonData.data;
  } else {
    data = await promGet(`/api/v1/label/${encodeURIComponent(params.label)}/values`, queryParams);
  }
  return { label: params.label, values: data, count: data?.length || 0 };
}

// ---- Targets ----
async function listTargets(params: { state?: string; scrapePool?: string }): Promise<any> {
  const queryParams: Record<string, string> = {};
  if (params.state && params.state !== "any") queryParams.state = params.state;
  if (params.scrapePool) queryParams.scrapePool = params.scrapePool;

  const data = await promGet("/api/v1/targets", queryParams);
  return {
    activeTargets: data.activeTargets?.map((t: any) => ({
      discoveredLabels: t.discoveredLabels,
      labels: t.labels,
      scrapePool: t.scrapePool,
      scrapeUrl: t.scrapeUrl,
      globalUrl: t.globalUrl,
      lastError: t.lastError,
      lastScrape: t.lastScrape,
      lastScrapeDuration: t.lastScrapeDuration,
      health: t.health,
      scrapeInterval: t.scrapeInterval,
      scrapeTimeout: t.scrapeTimeout,
    })),
    droppedTargets: data.droppedTargets?.map((t: any) => ({
      discoveredLabels: t.discoveredLabels,
    })),
    activeCount: data.activeTargets?.length || 0,
    droppedCount: data.droppedTargets?.length || 0,
  };
}

async function getTargetMetadata(params: { match_target?: string; metric?: string; limit?: number }): Promise<any> {
  const queryParams: Record<string, string> = {};
  if (params.match_target) queryParams.match_target = params.match_target;
  if (params.metric) queryParams.metric = params.metric;
  if (params.limit) queryParams.limit = params.limit.toString();

  const data = await promGet("/api/v1/targets/metadata", queryParams);
  return { metadata: data, count: data?.length || 0 };
}

// ---- Rules ----
async function listRules(params: { type?: string; rule_name?: string[]; rule_group?: string[]; file?: string[] }): Promise<any> {
  const queryParams: Record<string, string> = {};
  if (params.type) queryParams.type = params.type;

  // Build query with array parameters
  const arrayParams: string[] = [];
  if (params.rule_name) params.rule_name.forEach(n => arrayParams.push(`rule_name[]=${encodeURIComponent(n)}`));
  if (params.rule_group) params.rule_group.forEach(g => arrayParams.push(`rule_group[]=${encodeURIComponent(g)}`));
  if (params.file) params.file.forEach(f => arrayParams.push(`file[]=${encodeURIComponent(f)}`));

  const baseParams = new URLSearchParams(queryParams).toString();
  const fullQuery = [baseParams, ...arrayParams].filter(Boolean).join("&");

  const res = await fetch(`${config.url}/api/v1/rules${fullQuery ? `?${fullQuery}` : ""}`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Prometheus error (${res.status}): ${text || res.statusText}`);
  }
  const jsonData = await res.json();
  if (jsonData.status !== "success") {
    throw new Error(jsonData.error || "Query failed");
  }

  const data = jsonData.data;
  return {
    groups: data.groups?.map((g: any) => ({
      name: g.name,
      file: g.file,
      interval: g.interval,
      limit: g.limit,
      evaluationTime: g.evaluationTime,
      lastEvaluation: g.lastEvaluation,
      rules: g.rules?.map((r: any) => ({
        name: r.name,
        type: r.type,
        query: r.query,
        duration: r.duration,
        labels: r.labels,
        annotations: r.annotations,
        health: r.health,
        state: r.state,
        alerts: r.alerts,
        evaluationTime: r.evaluationTime,
        lastEvaluation: r.lastEvaluation,
        lastError: r.lastError,
      })),
    })),
    groupCount: data.groups?.length || 0,
  };
}

// ---- Alerts ----
async function listAlerts(): Promise<any> {
  const data = await promGet("/api/v1/alerts");
  return {
    alerts: data.alerts?.map((a: any) => ({
      labels: a.labels,
      annotations: a.annotations,
      state: a.state,
      activeAt: a.activeAt,
      value: a.value,
    })),
    count: data.alerts?.length || 0,
  };
}

async function getAlert(params: { alert_name: string }): Promise<any> {
  const data = await promGet("/api/v1/alerts");
  const matchingAlerts = data.alerts?.filter((a: any) => a.labels?.alertname === params.alert_name) || [];
  return {
    alertName: params.alert_name,
    alerts: matchingAlerts.map((a: any) => ({
      labels: a.labels,
      annotations: a.annotations,
      state: a.state,
      activeAt: a.activeAt,
      value: a.value,
    })),
    count: matchingAlerts.length,
  };
}

// ---- Alertmanagers ----
async function listAlertmanagers(): Promise<any> {
  const data = await promGet("/api/v1/alertmanagers");
  return {
    activeAlertmanagers: data.activeAlertmanagers?.map((am: any) => ({
      url: am.url,
    })),
    droppedAlertmanagers: data.droppedAlertmanagers?.map((am: any) => ({
      url: am.url,
    })),
    activeCount: data.activeAlertmanagers?.length || 0,
    droppedCount: data.droppedAlertmanagers?.length || 0,
  };
}

// ---- Status & Info ----
async function getConfig(): Promise<any> {
  const data = await promGet("/api/v1/status/config");
  return { yaml: data.yaml };
}

async function getFlags(): Promise<any> {
  const data = await promGet("/api/v1/status/flags");
  return { flags: data };
}

async function getRuntimeInfo(): Promise<any> {
  const data = await promGet("/api/v1/status/runtimeinfo");
  return {
    startTime: data.startTime,
    CWD: data.CWD,
    reloadConfigSuccess: data.reloadConfigSuccess,
    lastConfigTime: data.lastConfigTime,
    corruptionCount: data.corruptionCount,
    goroutineCount: data.goroutineCount,
    GOMAXPROCS: data.GOMAXPROCS,
    GOMEMLIMIT: data.GOMEMLIMIT,
    GOGC: data.GOGC,
    GODEBUG: data.GODEBUG,
    storageRetention: data.storageRetention,
  };
}

async function getBuildInfo(): Promise<any> {
  const data = await promGet("/api/v1/status/buildinfo");
  return {
    version: data.version,
    revision: data.revision,
    branch: data.branch,
    buildUser: data.buildUser,
    buildDate: data.buildDate,
    goVersion: data.goVersion,
  };
}

async function getTsdbStatus(params: { limit?: number }): Promise<any> {
  const queryParams: Record<string, string> = {};
  if (params.limit) queryParams.limit = params.limit.toString();

  const data = await promGet("/api/v1/status/tsdb", queryParams);
  return {
    headStats: data.headStats,
    seriesCountByMetricName: data.seriesCountByMetricName,
    labelValueCountByLabelName: data.labelValueCountByLabelName,
    memoryInBytesByLabelName: data.memoryInBytesByLabelName,
    seriesCountByLabelValuePair: data.seriesCountByLabelValuePair,
  };
}

// ---- Admin Operations ----
async function deleteSeries(params: { match: string[]; start?: string; end?: string }): Promise<any> {
  const queryParams: Record<string, string> = {};
  if (params.start) queryParams.start = params.start;
  if (params.end) queryParams.end = params.end;

  // Build query with multiple match[] parameters
  const matchParams = params.match.map(m => `match[]=${encodeURIComponent(m)}`).join("&");
  const otherParams = new URLSearchParams(queryParams).toString();
  const fullQuery = [matchParams, otherParams].filter(Boolean).join("&");

  await promPost(`/api/v1/admin/tsdb/delete_series?${fullQuery}`);
  return {
    success: true,
    message: "Series deletion initiated. Use clean_tombstones to remove data from disk.",
    match: params.match,
    start: params.start,
    end: params.end,
  };
}

async function cleanTombstones(): Promise<any> {
  await promPost("/api/v1/admin/tsdb/clean_tombstones");
  return {
    success: true,
    message: "Tombstone cleanup initiated."
  };
}

async function snapshot(params: { skip_head?: boolean }): Promise<any> {
  const queryParams: Record<string, string> = {};
  if (params.skip_head) queryParams.skip_head = "true";

  const data = await promPost("/api/v1/admin/tsdb/snapshot", queryParams);
  return {
    success: true,
    snapshotName: data.name,
    message: `Snapshot created: ${data.name}`
  };
}

// ---- Health Check ----
async function healthCheck(params: { check_type?: string }): Promise<any> {
  const checkType = params.check_type || "healthy";
  const endpoint = checkType === "ready" ? "/-/ready" : "/-/healthy";

  const res = await fetch(`${config.url}${endpoint}`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  const text = await res.text();
  return {
    checkType,
    status: res.ok ? "ok" : "error",
    statusCode: res.status,
    message: text.trim() || (res.ok ? "Prometheus is healthy" : "Prometheus is unhealthy"),
  };
}

// ============================================================================
// SERVER SETUP
// ============================================================================

const server = new Server(
  { name: "prometheus-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result: any;
    switch (name) {
      // Query
      case "query": result = await query(args as any); break;
      case "query_range": result = await queryRange(args as any); break;
      // Series & Labels
      case "list_series": result = await listSeries(args as any); break;
      case "get_labels": result = await getLabels(args as any); break;
      case "get_label_values": result = await getLabelValues(args as any); break;
      // Targets
      case "list_targets": result = await listTargets(args as any); break;
      case "get_target_metadata": result = await getTargetMetadata(args as any); break;
      // Rules
      case "list_rules": result = await listRules(args as any); break;
      // Alerts
      case "list_alerts": result = await listAlerts(); break;
      case "get_alert": result = await getAlert(args as any); break;
      // Alertmanagers
      case "list_alertmanagers": result = await listAlertmanagers(); break;
      // Status & Info
      case "get_config": result = await getConfig(); break;
      case "get_flags": result = await getFlags(); break;
      case "get_runtime_info": result = await getRuntimeInfo(); break;
      case "get_build_info": result = await getBuildInfo(); break;
      case "get_tsdb_status": result = await getTsdbStatus(args as any); break;
      // Admin Operations
      case "delete_series": result = await deleteSeries(args as any); break;
      case "clean_tombstones": result = await cleanTombstones(); break;
      case "snapshot": result = await snapshot(args as any); break;
      // Health Check
      case "health_check": result = await healthCheck(args as any); break;
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
  console.error("Prometheus MCP Server running on stdio");
}

main().catch(console.error);
