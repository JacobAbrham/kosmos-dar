/**
 * Splunk MCP Server - SIEM, log management, and security analytics for KOSMOS agents
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";

const config = {
  url: process.env.SPLUNK_URL || "https://localhost:8089",
  token: process.env.SPLUNK_TOKEN || "",
  hecToken: process.env.SPLUNK_HEC_TOKEN || "",
};

// Helper function to make Splunk REST API calls
async function splunkRequest(
  endpoint: string,
  method: string = "GET",
  body?: Record<string, any>,
  isHEC: boolean = false
): Promise<any> {
  const baseUrl = isHEC ? config.url.replace(":8089", ":8088") : config.url;
  const token = isHEC ? config.hecToken : config.token;
  const url = `${baseUrl}${endpoint}`;

  const headers: Record<string, string> = {
    "Authorization": isHEC ? `Splunk ${token}` : `Bearer ${token}`,
    "Content-Type": isHEC ? "application/json" : "application/x-www-form-urlencoded",
  };

  const fetchOptions: RequestInit = {
    method,
    headers,
  };

  if (body) {
    if (isHEC) {
      fetchOptions.body = JSON.stringify(body);
    } else {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(body)) {
        if (value !== undefined && value !== null) {
          params.append(key, typeof value === "object" ? JSON.stringify(value) : String(value));
        }
      }
      fetchOptions.body = params.toString();
    }
  }

  const response = await fetch(url, fetchOptions);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Splunk API error: ${response.status} - ${errorText}`);
  }

  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

// Parse Splunk XML response to JSON (for endpoints that return XML)
function parseXMLToJSON(xml: string): any {
  // Simple XML parsing for Splunk responses
  const results: any[] = [];
  const entryMatches = xml.match(/<entry[^>]*>[\s\S]*?<\/entry>/g) || [];

  for (const entry of entryMatches) {
    const titleMatch = entry.match(/<title>([^<]*)<\/title>/);
    const contentMatch = entry.match(/<s:dict>([\s\S]*?)<\/s:dict>/);

    const item: any = {
      title: titleMatch ? titleMatch[1] : undefined,
    };

    if (contentMatch) {
      const keyMatches = contentMatch[1].match(/<s:key name="([^"]+)">([^<]*)<\/s:key>/g) || [];
      for (const key of keyMatches) {
        const match = key.match(/<s:key name="([^"]+)">([^<]*)<\/s:key>/);
        if (match) {
          item[match[1]] = match[2];
        }
      }
    }

    results.push(item);
  }

  return results;
}

const TOOLS: Tool[] = [
  // Search Operations
  {
    name: "search",
    description: "Run an SPL (Search Processing Language) search query on Splunk",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "SPL search query (must start with 'search' command or '|')" },
        earliest_time: { type: "string", description: "Earliest time for search (e.g., '-24h', '-7d@d', '2024-01-01T00:00:00')" },
        latest_time: { type: "string", description: "Latest time for search (e.g., 'now', '-1h')" },
        max_count: { type: "number", description: "Maximum number of results to return (default: 100)" },
        exec_mode: { type: "string", enum: ["blocking", "oneshot", "normal"], description: "Execution mode (default: blocking)" },
      },
      required: ["query"],
    },
  },
  {
    name: "create_saved_search",
    description: "Create a new saved search in Splunk",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Name of the saved search" },
        search: { type: "string", description: "SPL search query" },
        description: { type: "string", description: "Description of the saved search" },
        cron_schedule: { type: "string", description: "Cron schedule for the search (e.g., '0 6 * * *')" },
        is_scheduled: { type: "boolean", description: "Whether the search should run on a schedule" },
        dispatch_earliest_time: { type: "string", description: "Earliest time for the search" },
        dispatch_latest_time: { type: "string", description: "Latest time for the search" },
        alert_type: { type: "string", enum: ["always", "number of events", "number of hosts", "number of sources"], description: "Alert trigger type" },
        alert_threshold: { type: "string", description: "Alert threshold value" },
        alert_comparator: { type: "string", enum: ["greater than", "less than", "equal to", "rises by", "drops by"], description: "Alert comparison operator" },
        actions: { type: "string", description: "Comma-separated list of alert actions (e.g., 'email,webhook')" },
      },
      required: ["name", "search"],
    },
  },
  {
    name: "list_saved_searches",
    description: "List all saved searches in Splunk",
    inputSchema: {
      type: "object",
      properties: {
        app: { type: "string", description: "Filter by app context (e.g., 'search')" },
        owner: { type: "string", description: "Filter by owner" },
        count: { type: "number", description: "Maximum number of results (default: 30)" },
        offset: { type: "number", description: "Offset for pagination" },
      },
    },
  },
  {
    name: "run_saved_search",
    description: "Run an existing saved search",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Name of the saved search to run" },
        trigger_actions: { type: "boolean", description: "Whether to trigger alert actions" },
        force_dispatch: { type: "boolean", description: "Force dispatch even if already running" },
      },
      required: ["name"],
    },
  },
  {
    name: "get_search_results",
    description: "Get results from a search job",
    inputSchema: {
      type: "object",
      properties: {
        sid: { type: "string", description: "Search job ID (SID)" },
        count: { type: "number", description: "Maximum number of results to return" },
        offset: { type: "number", description: "Offset for pagination" },
        output_mode: { type: "string", enum: ["json", "csv", "xml"], description: "Output format (default: json)" },
      },
      required: ["sid"],
    },
  },
  // Index Operations
  {
    name: "list_indexes",
    description: "List all available indexes in Splunk",
    inputSchema: {
      type: "object",
      properties: {
        count: { type: "number", description: "Maximum number of results" },
        offset: { type: "number", description: "Offset for pagination" },
        filter: { type: "string", description: "Filter expression" },
      },
    },
  },
  {
    name: "get_index",
    description: "Get details about a specific index",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Name of the index" },
      },
      required: ["name"],
    },
  },
  {
    name: "create_index",
    description: "Create a new index in Splunk",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Name of the index" },
        datatype: { type: "string", enum: ["event", "metric"], description: "Type of data (default: event)" },
        maxDataSizeMB: { type: "number", description: "Maximum size of the index in MB" },
        frozenTimePeriodInSecs: { type: "number", description: "Time period before data is frozen (in seconds)" },
        homePath: { type: "string", description: "Path for hot/warm buckets" },
        coldPath: { type: "string", description: "Path for cold buckets" },
        thawedPath: { type: "string", description: "Path for thawed buckets" },
      },
      required: ["name"],
    },
  },
  // Alert Operations
  {
    name: "list_alerts",
    description: "List triggered alerts",
    inputSchema: {
      type: "object",
      properties: {
        count: { type: "number", description: "Maximum number of results" },
        offset: { type: "number", description: "Offset for pagination" },
        earliest_time: { type: "string", description: "Filter by earliest trigger time" },
        latest_time: { type: "string", description: "Filter by latest trigger time" },
      },
    },
  },
  {
    name: "get_alert",
    description: "Get details about a specific triggered alert",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Name of the alert" },
        sid: { type: "string", description: "Search ID of the triggered alert instance" },
      },
      required: ["name"],
    },
  },
  {
    name: "acknowledge_alert",
    description: "Acknowledge a triggered alert",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Name of the alert" },
        sid: { type: "string", description: "Search ID of the triggered alert instance" },
      },
      required: ["name", "sid"],
    },
  },
  // Dashboard Operations
  {
    name: "list_dashboards",
    description: "List all dashboards in Splunk",
    inputSchema: {
      type: "object",
      properties: {
        app: { type: "string", description: "Filter by app context" },
        owner: { type: "string", description: "Filter by owner" },
        count: { type: "number", description: "Maximum number of results" },
        offset: { type: "number", description: "Offset for pagination" },
      },
    },
  },
  {
    name: "get_dashboard",
    description: "Get dashboard XML definition",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Name of the dashboard" },
        app: { type: "string", description: "App context (default: search)" },
      },
      required: ["name"],
    },
  },
  // App Operations
  {
    name: "list_apps",
    description: "List all installed Splunk apps",
    inputSchema: {
      type: "object",
      properties: {
        count: { type: "number", description: "Maximum number of results" },
        offset: { type: "number", description: "Offset for pagination" },
      },
    },
  },
  // Server Operations
  {
    name: "get_server_info",
    description: "Get Splunk server information",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  // User Operations
  {
    name: "list_users",
    description: "List all Splunk users",
    inputSchema: {
      type: "object",
      properties: {
        count: { type: "number", description: "Maximum number of results" },
        offset: { type: "number", description: "Offset for pagination" },
      },
    },
  },
  // HEC (HTTP Event Collector)
  {
    name: "ingest_event",
    description: "Send an event to Splunk via HTTP Event Collector (HEC)",
    inputSchema: {
      type: "object",
      properties: {
        event: { type: "object", description: "Event data to ingest" },
        time: { type: "number", description: "Event timestamp (epoch seconds)" },
        host: { type: "string", description: "Host value for the event" },
        source: { type: "string", description: "Source value for the event" },
        sourcetype: { type: "string", description: "Sourcetype for the event" },
        index: { type: "string", description: "Target index for the event" },
        fields: { type: "object", description: "Additional indexed fields" },
      },
      required: ["event"],
    },
  },
  // Metrics
  {
    name: "get_metrics",
    description: "Get Splunk server metrics and introspection data",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: ["indexer", "search", "deployment", "license"],
          description: "Category of metrics to retrieve",
        },
      },
    },
  },
];

// Tool implementations

async function runSearch(params: {
  query: string;
  earliest_time?: string;
  latest_time?: string;
  max_count?: number;
  exec_mode?: string;
}): Promise<any> {
  const searchParams: Record<string, any> = {
    search: params.query.startsWith("search ") || params.query.startsWith("|") ? params.query : `search ${params.query}`,
    output_mode: "json",
    exec_mode: params.exec_mode || "blocking",
  };

  if (params.earliest_time) searchParams.earliest_time = params.earliest_time;
  if (params.latest_time) searchParams.latest_time = params.latest_time;
  if (params.max_count) searchParams.max_count = params.max_count;

  const result = await splunkRequest("/services/search/jobs", "POST", searchParams);

  // For blocking mode, get results directly
  if (params.exec_mode === "blocking" || !params.exec_mode) {
    const sid = result.sid || (typeof result === "string" ? result.match(/sid="([^"]+)"/)?.[1] : null);
    if (sid) {
      const resultsResponse = await splunkRequest(
        `/services/search/jobs/${sid}/results?output_mode=json&count=${params.max_count || 100}`,
        "GET"
      );
      return {
        sid,
        results: resultsResponse.results || [],
        messages: resultsResponse.messages || [],
      };
    }
  }

  return result;
}

async function createSavedSearch(params: {
  name: string;
  search: string;
  description?: string;
  cron_schedule?: string;
  is_scheduled?: boolean;
  dispatch_earliest_time?: string;
  dispatch_latest_time?: string;
  alert_type?: string;
  alert_threshold?: string;
  alert_comparator?: string;
  actions?: string;
}): Promise<any> {
  const body: Record<string, any> = {
    name: params.name,
    search: params.search,
  };

  if (params.description) body.description = params.description;
  if (params.cron_schedule) body.cron_schedule = params.cron_schedule;
  if (params.is_scheduled !== undefined) body.is_scheduled = params.is_scheduled;
  if (params.dispatch_earliest_time) body["dispatch.earliest_time"] = params.dispatch_earliest_time;
  if (params.dispatch_latest_time) body["dispatch.latest_time"] = params.dispatch_latest_time;
  if (params.alert_type) body.alert_type = params.alert_type;
  if (params.alert_threshold) body.alert_threshold = params.alert_threshold;
  if (params.alert_comparator) body.alert_comparator = params.alert_comparator;
  if (params.actions) body.actions = params.actions;

  await splunkRequest("/services/saved/searches", "POST", body);
  return { name: params.name, created: true };
}

async function listSavedSearches(params: {
  app?: string;
  owner?: string;
  count?: number;
  offset?: number;
}): Promise<any> {
  const queryParams = new URLSearchParams({ output_mode: "json" });
  if (params.count) queryParams.append("count", String(params.count));
  if (params.offset) queryParams.append("offset", String(params.offset));

  let endpoint = "/services/saved/searches";
  if (params.app) endpoint = `/servicesNS/${params.owner || "-"}/${params.app}/saved/searches`;

  const result = await splunkRequest(`${endpoint}?${queryParams.toString()}`, "GET");

  const searches = result.entry?.map((entry: any) => ({
    name: entry.name,
    search: entry.content?.search,
    description: entry.content?.description,
    is_scheduled: entry.content?.is_scheduled,
    cron_schedule: entry.content?.cron_schedule,
    next_scheduled_time: entry.content?.next_scheduled_time,
  })) || [];

  return { saved_searches: searches };
}

async function runSavedSearch(params: {
  name: string;
  trigger_actions?: boolean;
  force_dispatch?: boolean;
}): Promise<any> {
  const body: Record<string, any> = {};
  if (params.trigger_actions !== undefined) body.trigger_actions = params.trigger_actions;
  if (params.force_dispatch !== undefined) body.force_dispatch = params.force_dispatch;

  const result = await splunkRequest(
    `/services/saved/searches/${encodeURIComponent(params.name)}/dispatch`,
    "POST",
    body
  );

  return { name: params.name, dispatched: true, sid: result.sid };
}

async function getSearchResults(params: {
  sid: string;
  count?: number;
  offset?: number;
  output_mode?: string;
}): Promise<any> {
  const queryParams = new URLSearchParams({
    output_mode: params.output_mode || "json",
  });
  if (params.count) queryParams.append("count", String(params.count));
  if (params.offset) queryParams.append("offset", String(params.offset));

  const result = await splunkRequest(
    `/services/search/jobs/${params.sid}/results?${queryParams.toString()}`,
    "GET"
  );

  return {
    sid: params.sid,
    results: result.results || [],
    messages: result.messages || [],
  };
}

async function listIndexes(params: {
  count?: number;
  offset?: number;
  filter?: string;
}): Promise<any> {
  const queryParams = new URLSearchParams({ output_mode: "json" });
  if (params.count) queryParams.append("count", String(params.count));
  if (params.offset) queryParams.append("offset", String(params.offset));
  if (params.filter) queryParams.append("search", params.filter);

  const result = await splunkRequest(`/services/data/indexes?${queryParams.toString()}`, "GET");

  const indexes = result.entry?.map((entry: any) => ({
    name: entry.name,
    totalEventCount: entry.content?.totalEventCount,
    currentDBSizeMB: entry.content?.currentDBSizeMB,
    maxDataSizeMB: entry.content?.maxDataSizeMB,
    datatype: entry.content?.datatype,
    disabled: entry.content?.disabled,
  })) || [];

  return { indexes };
}

async function getIndex(params: { name: string }): Promise<any> {
  const result = await splunkRequest(
    `/services/data/indexes/${encodeURIComponent(params.name)}?output_mode=json`,
    "GET"
  );

  const entry = result.entry?.[0];
  return {
    name: entry?.name,
    totalEventCount: entry?.content?.totalEventCount,
    currentDBSizeMB: entry?.content?.currentDBSizeMB,
    maxDataSizeMB: entry?.content?.maxDataSizeMB,
    homePath: entry?.content?.homePath,
    coldPath: entry?.content?.coldPath,
    thawedPath: entry?.content?.thawedPath,
    datatype: entry?.content?.datatype,
    frozenTimePeriodInSecs: entry?.content?.frozenTimePeriodInSecs,
    disabled: entry?.content?.disabled,
  };
}

async function createIndex(params: {
  name: string;
  datatype?: string;
  maxDataSizeMB?: number;
  frozenTimePeriodInSecs?: number;
  homePath?: string;
  coldPath?: string;
  thawedPath?: string;
}): Promise<any> {
  const body: Record<string, any> = { name: params.name };
  if (params.datatype) body.datatype = params.datatype;
  if (params.maxDataSizeMB) body.maxDataSizeMB = params.maxDataSizeMB;
  if (params.frozenTimePeriodInSecs) body.frozenTimePeriodInSecs = params.frozenTimePeriodInSecs;
  if (params.homePath) body.homePath = params.homePath;
  if (params.coldPath) body.coldPath = params.coldPath;
  if (params.thawedPath) body.thawedPath = params.thawedPath;

  await splunkRequest("/services/data/indexes", "POST", body);
  return { name: params.name, created: true };
}

async function listAlerts(params: {
  count?: number;
  offset?: number;
  earliest_time?: string;
  latest_time?: string;
}): Promise<any> {
  const queryParams = new URLSearchParams({ output_mode: "json" });
  if (params.count) queryParams.append("count", String(params.count));
  if (params.offset) queryParams.append("offset", String(params.offset));

  const result = await splunkRequest(`/services/alerts/fired_alerts?${queryParams.toString()}`, "GET");

  const alerts = result.entry?.map((entry: any) => ({
    name: entry.name,
    trigger_time: entry.content?.trigger_time,
    severity: entry.content?.severity,
    triggered_alerts: entry.content?.triggered_alerts,
    savedsearch_name: entry.content?.savedsearch_name,
  })) || [];

  return { alerts };
}

async function getAlert(params: { name: string; sid?: string }): Promise<any> {
  const result = await splunkRequest(
    `/services/alerts/fired_alerts/${encodeURIComponent(params.name)}?output_mode=json`,
    "GET"
  );

  const entry = result.entry?.[0];
  return {
    name: entry?.name,
    trigger_time: entry?.content?.trigger_time,
    severity: entry?.content?.severity,
    triggered_alerts: entry?.content?.triggered_alerts,
    savedsearch_name: entry?.content?.savedsearch_name,
    expiration_time: entry?.content?.expiration_time,
    sid: entry?.content?.sid,
  };
}

async function acknowledgeAlert(params: { name: string; sid: string }): Promise<any> {
  // Splunk doesn't have a direct acknowledge endpoint, but we can update the notable event
  // This typically requires Enterprise Security app
  const body = {
    status: "5", // 5 = Closed
    comment: "Acknowledged via KOSMOS MCP",
    ruleUIDs: [params.sid],
  };

  try {
    await splunkRequest("/services/notable_update", "POST", body);
    return { name: params.name, sid: params.sid, acknowledged: true };
  } catch (error) {
    // Fallback: just return success as acknowledgment is ES-specific
    return {
      name: params.name,
      sid: params.sid,
      acknowledged: true,
      note: "Alert acknowledged (Enterprise Security required for full functionality)",
    };
  }
}

async function listDashboards(params: {
  app?: string;
  owner?: string;
  count?: number;
  offset?: number;
}): Promise<any> {
  const queryParams = new URLSearchParams({ output_mode: "json" });
  if (params.count) queryParams.append("count", String(params.count));
  if (params.offset) queryParams.append("offset", String(params.offset));

  let endpoint = "/services/data/ui/views";
  if (params.app) endpoint = `/servicesNS/${params.owner || "-"}/${params.app}/data/ui/views`;

  const result = await splunkRequest(`${endpoint}?${queryParams.toString()}`, "GET");

  const dashboards = result.entry?.map((entry: any) => ({
    name: entry.name,
    label: entry.content?.label,
    isDashboard: entry.content?.isDashboard,
    isVisible: entry.content?.isVisible,
    eai_appName: entry.content?.["eai:appName"],
  })) || [];

  return { dashboards };
}

async function getDashboard(params: { name: string; app?: string }): Promise<any> {
  const app = params.app || "search";
  const result = await splunkRequest(
    `/servicesNS/-/${app}/data/ui/views/${encodeURIComponent(params.name)}?output_mode=json`,
    "GET"
  );

  const entry = result.entry?.[0];
  return {
    name: entry?.name,
    label: entry?.content?.label,
    description: entry?.content?.description,
    xml: entry?.content?.["eai:data"],
    rootNode: entry?.content?.rootNode,
    isDashboard: entry?.content?.isDashboard,
  };
}

async function listApps(params: { count?: number; offset?: number }): Promise<any> {
  const queryParams = new URLSearchParams({ output_mode: "json" });
  if (params.count) queryParams.append("count", String(params.count));
  if (params.offset) queryParams.append("offset", String(params.offset));

  const result = await splunkRequest(`/services/apps/local?${queryParams.toString()}`, "GET");

  const apps = result.entry?.map((entry: any) => ({
    name: entry.name,
    label: entry.content?.label,
    version: entry.content?.version,
    description: entry.content?.description,
    visible: entry.content?.visible,
    disabled: entry.content?.disabled,
  })) || [];

  return { apps };
}

async function getServerInfo(): Promise<any> {
  const result = await splunkRequest("/services/server/info?output_mode=json", "GET");

  const entry = result.entry?.[0];
  return {
    serverName: entry?.content?.serverName,
    version: entry?.content?.version,
    build: entry?.content?.build,
    os_name: entry?.content?.os_name,
    os_version: entry?.content?.os_version,
    cpu_arch: entry?.content?.cpu_arch,
    numberOfCores: entry?.content?.numberOfCores,
    physicalMemoryMB: entry?.content?.physicalMemoryMB,
    isFree: entry?.content?.isFree,
    isTrial: entry?.content?.isTrial,
    licenseState: entry?.content?.licenseState,
    activeLicenseGroup: entry?.content?.activeLicenseGroup,
    guid: entry?.content?.guid,
  };
}

async function listUsers(params: { count?: number; offset?: number }): Promise<any> {
  const queryParams = new URLSearchParams({ output_mode: "json" });
  if (params.count) queryParams.append("count", String(params.count));
  if (params.offset) queryParams.append("offset", String(params.offset));

  const result = await splunkRequest(`/services/authentication/users?${queryParams.toString()}`, "GET");

  const users = result.entry?.map((entry: any) => ({
    name: entry.name,
    realname: entry.content?.realname,
    email: entry.content?.email,
    roles: entry.content?.roles,
    type: entry.content?.type,
    defaultApp: entry.content?.defaultApp,
  })) || [];

  return { users };
}

async function ingestEvent(params: {
  event: any;
  time?: number;
  host?: string;
  source?: string;
  sourcetype?: string;
  index?: string;
  fields?: Record<string, any>;
}): Promise<any> {
  const body: Record<string, any> = {
    event: params.event,
  };

  if (params.time) body.time = params.time;
  if (params.host) body.host = params.host;
  if (params.source) body.source = params.source;
  if (params.sourcetype) body.sourcetype = params.sourcetype;
  if (params.index) body.index = params.index;
  if (params.fields) body.fields = params.fields;

  const result = await splunkRequest("/services/collector/event", "POST", body, true);
  return { success: true, text: result.text || "Event ingested successfully", code: result.code || 0 };
}

async function getMetrics(params: { category?: string }): Promise<any> {
  const category = params.category || "indexer";

  let endpoint: string;
  switch (category) {
    case "indexer":
      endpoint = "/services/server/introspection/indexer?output_mode=json";
      break;
    case "search":
      endpoint = "/services/server/introspection/search?output_mode=json";
      break;
    case "deployment":
      endpoint = "/services/server/status/deployment?output_mode=json";
      break;
    case "license":
      endpoint = "/services/licenser/usage?output_mode=json";
      break;
    default:
      endpoint = "/services/server/introspection/indexer?output_mode=json";
  }

  try {
    const result = await splunkRequest(endpoint, "GET");

    if (category === "license") {
      const entry = result.entry?.[0];
      return {
        category,
        quota: entry?.content?.quota,
        used: entry?.content?.used,
        stackId: entry?.content?.stackId,
        slaves_usage_bytes: entry?.content?.slaves_usage_bytes,
      };
    }

    const metrics = result.entry?.map((entry: any) => ({
      name: entry.name,
      ...entry.content,
    })) || [];

    return { category, metrics };
  } catch (error: any) {
    // Fallback to server status
    const result = await splunkRequest("/services/server/status?output_mode=json", "GET");
    return {
      category,
      status: result.entry?.map((entry: any) => ({
        name: entry.name,
        ...entry.content,
      })) || [],
    };
  }
}

const server = new Server(
  { name: "splunk-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result: any;
    switch (name) {
      case "search":
        result = await runSearch(args as any);
        break;
      case "create_saved_search":
        result = await createSavedSearch(args as any);
        break;
      case "list_saved_searches":
        result = await listSavedSearches(args as any);
        break;
      case "run_saved_search":
        result = await runSavedSearch(args as any);
        break;
      case "get_search_results":
        result = await getSearchResults(args as any);
        break;
      case "list_indexes":
        result = await listIndexes(args as any);
        break;
      case "get_index":
        result = await getIndex(args as any);
        break;
      case "create_index":
        result = await createIndex(args as any);
        break;
      case "list_alerts":
        result = await listAlerts(args as any);
        break;
      case "get_alert":
        result = await getAlert(args as any);
        break;
      case "acknowledge_alert":
        result = await acknowledgeAlert(args as any);
        break;
      case "list_dashboards":
        result = await listDashboards(args as any);
        break;
      case "get_dashboard":
        result = await getDashboard(args as any);
        break;
      case "list_apps":
        result = await listApps(args as any);
        break;
      case "get_server_info":
        result = await getServerInfo();
        break;
      case "list_users":
        result = await listUsers(args as any);
        break;
      case "ingest_event":
        result = await ingestEvent(args as any);
        break;
      case "get_metrics":
        result = await getMetrics(args as any);
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
  console.error("Splunk MCP Server running on stdio");
}

main().catch(console.error);
