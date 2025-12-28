/**
 * Datadog MCP Server - Metrics, monitoring, logs, APM, and synthetics for KOSMOS agents
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";

const config = {
  apiKey: process.env.DD_API_KEY || "",
  appKey: process.env.DD_APP_KEY || "",
  site: process.env.DD_SITE || "datadoghq.com", // datadoghq.com, datadoghq.eu, us3.datadoghq.com, etc.
};

function getApiUrl(): string {
  return `https://api.${config.site}`;
}

async function datadogRequest(method: string, path: string, body?: any): Promise<any> {
  const res = await fetch(`${getApiUrl()}${path}`, {
    method,
    headers: {
      "DD-API-KEY": config.apiKey,
      "DD-APPLICATION-KEY": config.appKey,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ errors: [res.statusText] }));
    throw new Error(error.errors?.join(", ") || res.statusText);
  }
  return res.status === 204 ? {} : res.json();
}

// ============================================================================
// TOOLS DEFINITION
// ============================================================================

const TOOLS: Tool[] = [
  // ---- Metrics ----
  {
    name: "metrics_query",
    description: "Query time series metrics from Datadog.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Metrics query string (e.g., 'avg:system.cpu.user{*}')" },
        from: { type: "number", description: "Start time (Unix timestamp in seconds)" },
        to: { type: "number", description: "End time (Unix timestamp in seconds)" },
      },
      required: ["query", "from", "to"],
    },
  },
  {
    name: "metrics_submit",
    description: "Submit custom metrics to Datadog.",
    inputSchema: {
      type: "object",
      properties: {
        series: {
          type: "array",
          items: {
            type: "object",
            properties: {
              metric: { type: "string", description: "Metric name" },
              points: { type: "array", items: { type: "array" }, description: "Array of [timestamp, value] pairs" },
              type: { type: "string", enum: ["gauge", "rate", "count"], description: "Metric type" },
              tags: { type: "array", items: { type: "string" }, description: "Tags for the metric" },
              host: { type: "string", description: "Host name" },
            },
            required: ["metric", "points"],
          },
        },
      },
      required: ["series"],
    },
  },
  {
    name: "metrics_list",
    description: "List available metrics from a specific time.",
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "number", description: "Unix timestamp to list metrics from" },
        host: { type: "string", description: "Filter by host" },
        tags: { type: "string", description: "Filter by tags (comma-separated)" },
      },
      required: ["from"],
    },
  },
  {
    name: "metrics_search",
    description: "Search for metrics by name.",
    inputSchema: {
      type: "object",
      properties: {
        q: { type: "string", description: "Query string to search metrics" },
      },
      required: ["q"],
    },
  },
  {
    name: "metrics_metadata",
    description: "Get metadata for a metric.",
    inputSchema: {
      type: "object",
      properties: {
        metric: { type: "string", description: "Metric name" },
      },
      required: ["metric"],
    },
  },

  // ---- Events ----
  {
    name: "events_list",
    description: "List events from Datadog.",
    inputSchema: {
      type: "object",
      properties: {
        start: { type: "number", description: "Start time (Unix timestamp)" },
        end: { type: "number", description: "End time (Unix timestamp)" },
        priority: { type: "string", enum: ["normal", "low"], description: "Event priority" },
        sources: { type: "string", description: "Comma-separated list of sources" },
        tags: { type: "string", description: "Comma-separated list of tags" },
        unaggregated: { type: "boolean", description: "Return unaggregated events" },
      },
      required: ["start", "end"],
    },
  },
  {
    name: "events_create",
    description: "Create a new event in Datadog.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Event title" },
        text: { type: "string", description: "Event text (supports markdown)" },
        priority: { type: "string", enum: ["normal", "low"], description: "Event priority" },
        alertType: { type: "string", enum: ["error", "warning", "info", "success", "user_update", "recommendation", "snapshot"], description: "Alert type" },
        host: { type: "string", description: "Host name" },
        tags: { type: "array", items: { type: "string" }, description: "Tags for the event" },
        aggregationKey: { type: "string", description: "Aggregation key to group events" },
        sourceTypeName: { type: "string", description: "Source type name" },
      },
      required: ["title", "text"],
    },
  },
  {
    name: "events_get",
    description: "Get a specific event by ID.",
    inputSchema: {
      type: "object",
      properties: {
        eventId: { type: "number", description: "Event ID" },
      },
      required: ["eventId"],
    },
  },

  // ---- Monitors ----
  {
    name: "monitors_list",
    description: "List all monitors.",
    inputSchema: {
      type: "object",
      properties: {
        groupStates: { type: "string", description: "Comma-separated group states (alert, warn, no data, ok)" },
        name: { type: "string", description: "Filter by name" },
        tags: { type: "string", description: "Comma-separated tags to filter" },
        monitorTags: { type: "string", description: "Comma-separated monitor tags" },
        withDowntimes: { type: "boolean", description: "Include downtime information" },
        pageSize: { type: "number", description: "Number of monitors per page" },
        page: { type: "number", description: "Page number" },
      },
    },
  },
  {
    name: "monitors_get",
    description: "Get a specific monitor by ID.",
    inputSchema: {
      type: "object",
      properties: {
        monitorId: { type: "number", description: "Monitor ID" },
        groupStates: { type: "string", description: "Comma-separated group states" },
      },
      required: ["monitorId"],
    },
  },
  {
    name: "monitors_create",
    description: "Create a new monitor.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Monitor name" },
        type: { type: "string", enum: ["metric alert", "service check", "event alert", "query alert", "composite", "slo alert", "event-v2 alert", "audit alert", "ci-pipelines alert", "error-tracking alert", "database-monitoring alert"], description: "Monitor type" },
        query: { type: "string", description: "Monitor query" },
        message: { type: "string", description: "Notification message (supports @mentions)" },
        tags: { type: "array", items: { type: "string" }, description: "Monitor tags" },
        priority: { type: "number", description: "Priority (1-5)" },
        options: {
          type: "object",
          properties: {
            thresholds: { type: "object", properties: { critical: { type: "number" }, warning: { type: "number" }, ok: { type: "number" } } },
            notifyNoData: { type: "boolean" },
            noDataTimeframe: { type: "number" },
            renotifyInterval: { type: "number" },
            escalationMessage: { type: "string" },
            includeTags: { type: "boolean" },
            requireFullWindow: { type: "boolean" },
          },
        },
      },
      required: ["name", "type", "query"],
    },
  },
  {
    name: "monitors_update",
    description: "Update an existing monitor.",
    inputSchema: {
      type: "object",
      properties: {
        monitorId: { type: "number", description: "Monitor ID" },
        name: { type: "string", description: "Monitor name" },
        query: { type: "string", description: "Monitor query" },
        message: { type: "string", description: "Notification message" },
        tags: { type: "array", items: { type: "string" }, description: "Monitor tags" },
        priority: { type: "number", description: "Priority (1-5)" },
        options: { type: "object", description: "Monitor options" },
      },
      required: ["monitorId"],
    },
  },
  {
    name: "monitors_delete",
    description: "Delete a monitor.",
    inputSchema: {
      type: "object",
      properties: {
        monitorId: { type: "number", description: "Monitor ID" },
        force: { type: "boolean", description: "Force delete even if monitor is in use" },
      },
      required: ["monitorId"],
    },
  },
  {
    name: "monitors_mute",
    description: "Mute a monitor.",
    inputSchema: {
      type: "object",
      properties: {
        monitorId: { type: "number", description: "Monitor ID" },
        scope: { type: "string", description: "Scope to mute (e.g., 'host:myhost')" },
        end: { type: "number", description: "Unix timestamp when mute should end" },
      },
      required: ["monitorId"],
    },
  },
  {
    name: "monitors_unmute",
    description: "Unmute a monitor.",
    inputSchema: {
      type: "object",
      properties: {
        monitorId: { type: "number", description: "Monitor ID" },
        scope: { type: "string", description: "Scope to unmute" },
        allScopes: { type: "boolean", description: "Unmute all scopes" },
      },
      required: ["monitorId"],
    },
  },
  {
    name: "monitors_search",
    description: "Search monitors.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        page: { type: "number", description: "Page number" },
        perPage: { type: "number", description: "Results per page" },
        sort: { type: "string", description: "Sort field" },
      },
    },
  },

  // ---- Dashboards ----
  {
    name: "dashboards_list",
    description: "List all dashboards.",
    inputSchema: {
      type: "object",
      properties: {
        filterShared: { type: "boolean", description: "Filter shared dashboards" },
        filterDeleted: { type: "boolean", description: "Filter deleted dashboards" },
        count: { type: "number", description: "Number of dashboards to return" },
        start: { type: "number", description: "Starting position" },
      },
    },
  },
  {
    name: "dashboards_get",
    description: "Get a dashboard by ID.",
    inputSchema: {
      type: "object",
      properties: {
        dashboardId: { type: "string", description: "Dashboard ID" },
      },
      required: ["dashboardId"],
    },
  },
  {
    name: "dashboards_create",
    description: "Create a new dashboard.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Dashboard title" },
        description: { type: "string", description: "Dashboard description" },
        layoutType: { type: "string", enum: ["ordered", "free"], description: "Layout type" },
        widgets: {
          type: "array",
          items: {
            type: "object",
            properties: {
              definition: { type: "object", description: "Widget definition" },
              layout: { type: "object", properties: { x: { type: "number" }, y: { type: "number" }, width: { type: "number" }, height: { type: "number" } } },
            },
          },
          description: "Dashboard widgets",
        },
        templateVariables: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              prefix: { type: "string" },
              default: { type: "string" },
            },
          },
        },
        isReadOnly: { type: "boolean", description: "Read-only dashboard" },
        notifyList: { type: "array", items: { type: "string" }, description: "List of users to notify" },
        reflowType: { type: "string", enum: ["auto", "fixed"], description: "Reflow type for ordered layouts" },
      },
      required: ["title", "layoutType", "widgets"],
    },
  },
  {
    name: "dashboards_update",
    description: "Update a dashboard.",
    inputSchema: {
      type: "object",
      properties: {
        dashboardId: { type: "string", description: "Dashboard ID" },
        title: { type: "string", description: "Dashboard title" },
        description: { type: "string", description: "Dashboard description" },
        layoutType: { type: "string", enum: ["ordered", "free"] },
        widgets: { type: "array", items: { type: "object" } },
        templateVariables: { type: "array", items: { type: "object" } },
        isReadOnly: { type: "boolean" },
        notifyList: { type: "array", items: { type: "string" } },
      },
      required: ["dashboardId", "title", "layoutType", "widgets"],
    },
  },
  {
    name: "dashboards_delete",
    description: "Delete a dashboard.",
    inputSchema: {
      type: "object",
      properties: {
        dashboardId: { type: "string", description: "Dashboard ID" },
      },
      required: ["dashboardId"],
    },
  },

  // ---- Logs ----
  {
    name: "logs_query",
    description: "Search and query logs.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Log search query" },
        from: { type: "string", description: "Start time (ISO 8601 or relative like 'now-1h')" },
        to: { type: "string", description: "End time (ISO 8601 or relative like 'now')" },
        sort: { type: "string", enum: ["timestamp", "-timestamp"], description: "Sort order" },
        limit: { type: "number", description: "Maximum number of logs to return (max 1000)" },
        indexes: { type: "array", items: { type: "string" }, description: "Log indexes to search" },
      },
      required: ["query"],
    },
  },
  {
    name: "logs_list_indexes",
    description: "List all log indexes.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "logs_get_index",
    description: "Get a specific log index.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Index name" },
      },
      required: ["name"],
    },
  },
  {
    name: "logs_submit",
    description: "Submit logs to Datadog.",
    inputSchema: {
      type: "object",
      properties: {
        logs: {
          type: "array",
          items: {
            type: "object",
            properties: {
              message: { type: "string", description: "Log message" },
              ddsource: { type: "string", description: "Source of the log" },
              ddtags: { type: "string", description: "Comma-separated tags" },
              hostname: { type: "string", description: "Hostname" },
              service: { type: "string", description: "Service name" },
            },
            required: ["message"],
          },
        },
      },
      required: ["logs"],
    },
  },
  {
    name: "logs_aggregate",
    description: "Aggregate logs with compute operations.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Log search query" },
        from: { type: "string", description: "Start time" },
        to: { type: "string", description: "End time" },
        groupBy: { type: "array", items: { type: "string" }, description: "Fields to group by" },
        compute: {
          type: "array",
          items: {
            type: "object",
            properties: {
              aggregation: { type: "string", enum: ["count", "cardinality", "sum", "avg", "min", "max", "pc75", "pc90", "pc95", "pc99"] },
              metric: { type: "string" },
            },
          },
        },
      },
      required: ["query"],
    },
  },

  // ---- APM Traces ----
  {
    name: "apm_list_services",
    description: "List APM services.",
    inputSchema: {
      type: "object",
      properties: {
        env: { type: "string", description: "Environment filter" },
      },
    },
  },
  {
    name: "apm_get_service",
    description: "Get APM service details.",
    inputSchema: {
      type: "object",
      properties: {
        serviceName: { type: "string", description: "Service name" },
      },
      required: ["serviceName"],
    },
  },
  {
    name: "apm_search_traces",
    description: "Search APM traces.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Trace search query" },
        from: { type: "number", description: "Start time (Unix timestamp)" },
        to: { type: "number", description: "End time (Unix timestamp)" },
        limit: { type: "number", description: "Maximum number of traces to return" },
        sort: { type: "string", enum: ["timestamp", "-timestamp", "duration", "-duration"], description: "Sort order" },
      },
      required: ["query"],
    },
  },
  {
    name: "apm_get_trace",
    description: "Get a specific trace by ID.",
    inputSchema: {
      type: "object",
      properties: {
        traceId: { type: "string", description: "Trace ID" },
      },
      required: ["traceId"],
    },
  },
  {
    name: "apm_service_stats",
    description: "Get service statistics.",
    inputSchema: {
      type: "object",
      properties: {
        env: { type: "string", description: "Environment" },
        service: { type: "string", description: "Service name" },
        from: { type: "number", description: "Start time (Unix timestamp)" },
        to: { type: "number", description: "End time (Unix timestamp)" },
      },
      required: ["env", "service"],
    },
  },

  // ---- Synthetics ----
  {
    name: "synthetics_list_tests",
    description: "List all Synthetic tests.",
    inputSchema: {
      type: "object",
      properties: {
        pageSize: { type: "number", description: "Number of tests per page" },
        pageNumber: { type: "number", description: "Page number" },
      },
    },
  },
  {
    name: "synthetics_get_test",
    description: "Get a specific Synthetic test.",
    inputSchema: {
      type: "object",
      properties: {
        publicId: { type: "string", description: "Test public ID" },
      },
      required: ["publicId"],
    },
  },
  {
    name: "synthetics_get_results",
    description: "Get results for a Synthetic test.",
    inputSchema: {
      type: "object",
      properties: {
        publicId: { type: "string", description: "Test public ID" },
        fromTs: { type: "number", description: "Start timestamp" },
        toTs: { type: "number", description: "End timestamp" },
        probeDc: { type: "array", items: { type: "string" }, description: "Filter by probe locations" },
      },
      required: ["publicId"],
    },
  },
  {
    name: "synthetics_get_api_result",
    description: "Get a specific API test result.",
    inputSchema: {
      type: "object",
      properties: {
        publicId: { type: "string", description: "Test public ID" },
        resultId: { type: "string", description: "Result ID" },
      },
      required: ["publicId", "resultId"],
    },
  },
  {
    name: "synthetics_get_browser_result",
    description: "Get a specific browser test result.",
    inputSchema: {
      type: "object",
      properties: {
        publicId: { type: "string", description: "Test public ID" },
        resultId: { type: "string", description: "Result ID" },
      },
      required: ["publicId", "resultId"],
    },
  },
  {
    name: "synthetics_trigger_test",
    description: "Trigger a Synthetic test.",
    inputSchema: {
      type: "object",
      properties: {
        publicIds: { type: "array", items: { type: "string" }, description: "Test public IDs to trigger" },
      },
      required: ["publicIds"],
    },
  },
  {
    name: "synthetics_create_test",
    description: "Create a new Synthetic test.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Test name" },
        type: { type: "string", enum: ["api", "browser"], description: "Test type" },
        config: { type: "object", description: "Test configuration" },
        locations: { type: "array", items: { type: "string" }, description: "Test locations" },
        options: { type: "object", description: "Test options" },
        message: { type: "string", description: "Notification message" },
        tags: { type: "array", items: { type: "string" }, description: "Test tags" },
        status: { type: "string", enum: ["live", "paused"], description: "Test status" },
      },
      required: ["name", "type", "config", "locations"],
    },
  },
  {
    name: "synthetics_update_test",
    description: "Update a Synthetic test.",
    inputSchema: {
      type: "object",
      properties: {
        publicId: { type: "string", description: "Test public ID" },
        name: { type: "string" },
        config: { type: "object" },
        locations: { type: "array", items: { type: "string" } },
        options: { type: "object" },
        message: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        status: { type: "string", enum: ["live", "paused"] },
      },
      required: ["publicId"],
    },
  },
  {
    name: "synthetics_delete_tests",
    description: "Delete Synthetic tests.",
    inputSchema: {
      type: "object",
      properties: {
        publicIds: { type: "array", items: { type: "string" }, description: "Test public IDs to delete" },
      },
      required: ["publicIds"],
    },
  },
  {
    name: "synthetics_list_locations",
    description: "List available Synthetic test locations.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },

  // ---- Incidents ----
  {
    name: "incidents_list",
    description: "List incidents.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        pageSize: { type: "number", description: "Number of incidents per page" },
        pageOffset: { type: "number", description: "Page offset" },
        sort: { type: "string", description: "Sort field" },
      },
    },
  },
  {
    name: "incidents_get",
    description: "Get a specific incident.",
    inputSchema: {
      type: "object",
      properties: {
        incidentId: { type: "string", description: "Incident ID" },
        include: { type: "array", items: { type: "string" }, description: "Related resources to include" },
      },
      required: ["incidentId"],
    },
  },
  {
    name: "incidents_create",
    description: "Create a new incident.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Incident title" },
        customerImpacted: { type: "boolean", description: "Whether customers are impacted" },
        fields: {
          type: "object",
          properties: {
            severity: { type: "string", enum: ["SEV-1", "SEV-2", "SEV-3", "SEV-4", "SEV-5"] },
            state: { type: "string", enum: ["active", "stable", "resolved"] },
            detection_method: { type: "string" },
            root_cause: { type: "string" },
            summary: { type: "string" },
          },
        },
        notificationHandles: { type: "array", items: { type: "string" }, description: "Notification handles" },
      },
      required: ["title", "customerImpacted"],
    },
  },
  {
    name: "incidents_update",
    description: "Update an incident.",
    inputSchema: {
      type: "object",
      properties: {
        incidentId: { type: "string", description: "Incident ID" },
        title: { type: "string" },
        customerImpacted: { type: "boolean" },
        fields: { type: "object" },
        notificationHandles: { type: "array", items: { type: "string" } },
      },
      required: ["incidentId"],
    },
  },
  {
    name: "incidents_delete",
    description: "Delete an incident.",
    inputSchema: {
      type: "object",
      properties: {
        incidentId: { type: "string", description: "Incident ID" },
      },
      required: ["incidentId"],
    },
  },
  {
    name: "incidents_add_timeline",
    description: "Add a timeline entry to an incident.",
    inputSchema: {
      type: "object",
      properties: {
        incidentId: { type: "string", description: "Incident ID" },
        content: { type: "string", description: "Timeline content" },
        important: { type: "boolean", description: "Mark as important" },
      },
      required: ["incidentId", "content"],
    },
  },
  {
    name: "incidents_list_attachments",
    description: "List incident attachments.",
    inputSchema: {
      type: "object",
      properties: {
        incidentId: { type: "string", description: "Incident ID" },
      },
      required: ["incidentId"],
    },
  },

  // ---- Service Level Objectives (SLOs) ----
  {
    name: "slo_list",
    description: "List all SLOs.",
    inputSchema: {
      type: "object",
      properties: {
        ids: { type: "string", description: "Comma-separated SLO IDs" },
        query: { type: "string", description: "Search query" },
        tagsQuery: { type: "string", description: "Filter by tags" },
        metricsQuery: { type: "string", description: "Filter by metrics" },
        limit: { type: "number", description: "Maximum number to return" },
        offset: { type: "number", description: "Offset for pagination" },
      },
    },
  },
  {
    name: "slo_get",
    description: "Get a specific SLO.",
    inputSchema: {
      type: "object",
      properties: {
        sloId: { type: "string", description: "SLO ID" },
        withConfiguredAlertIds: { type: "boolean", description: "Include configured alert IDs" },
      },
      required: ["sloId"],
    },
  },
  {
    name: "slo_history",
    description: "Get SLO history.",
    inputSchema: {
      type: "object",
      properties: {
        sloId: { type: "string", description: "SLO ID" },
        fromTs: { type: "number", description: "Start timestamp" },
        toTs: { type: "number", description: "End timestamp" },
        target: { type: "number", description: "SLO target" },
      },
      required: ["sloId", "fromTs", "toTs"],
    },
  },

  // ---- Hosts ----
  {
    name: "hosts_list",
    description: "List all hosts.",
    inputSchema: {
      type: "object",
      properties: {
        filter: { type: "string", description: "Filter string for hosts" },
        sortField: { type: "string", description: "Sort field" },
        sortDir: { type: "string", enum: ["asc", "desc"], description: "Sort direction" },
        start: { type: "number", description: "Starting position" },
        count: { type: "number", description: "Number of hosts to return" },
        from: { type: "number", description: "Filter hosts from this Unix timestamp" },
        includeMutedHostsData: { type: "boolean", description: "Include muted hosts data" },
        includeHostsMetadata: { type: "boolean", description: "Include hosts metadata" },
      },
    },
  },
  {
    name: "hosts_mute",
    description: "Mute a host.",
    inputSchema: {
      type: "object",
      properties: {
        hostname: { type: "string", description: "Hostname" },
        end: { type: "number", description: "Unix timestamp when mute should end" },
        message: { type: "string", description: "Message to associate with mute" },
        override: { type: "boolean", description: "Override existing mute" },
      },
      required: ["hostname"],
    },
  },
  {
    name: "hosts_unmute",
    description: "Unmute a host.",
    inputSchema: {
      type: "object",
      properties: {
        hostname: { type: "string", description: "Hostname" },
      },
      required: ["hostname"],
    },
  },
  {
    name: "hosts_totals",
    description: "Get total number of active hosts.",
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "number", description: "Filter from this Unix timestamp" },
      },
    },
  },

  // ---- Downtimes ----
  {
    name: "downtimes_list",
    description: "List all downtimes.",
    inputSchema: {
      type: "object",
      properties: {
        currentOnly: { type: "boolean", description: "Only return current downtimes" },
        withCreator: { type: "boolean", description: "Include creator information" },
      },
    },
  },
  {
    name: "downtimes_create",
    description: "Create a downtime.",
    inputSchema: {
      type: "object",
      properties: {
        scope: { type: "array", items: { type: "string" }, description: "Scope tags (e.g., ['host:myhost'])" },
        start: { type: "number", description: "Start timestamp" },
        end: { type: "number", description: "End timestamp" },
        message: { type: "string", description: "Downtime message" },
        timezone: { type: "string", description: "Timezone" },
        monitorId: { type: "number", description: "Monitor ID to downtime" },
        monitorTags: { type: "array", items: { type: "string" }, description: "Monitor tags to match" },
        recurrence: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["days", "weeks", "months", "years"] },
            period: { type: "number" },
            weekDays: { type: "array", items: { type: "string" } },
            untilDate: { type: "number" },
            untilOccurrences: { type: "number" },
          },
        },
      },
      required: ["scope"],
    },
  },
  {
    name: "downtimes_cancel",
    description: "Cancel a downtime.",
    inputSchema: {
      type: "object",
      properties: {
        downtimeId: { type: "number", description: "Downtime ID" },
      },
      required: ["downtimeId"],
    },
  },
];

// ============================================================================
// HANDLER FUNCTIONS
// ============================================================================

// ---- Metrics ----
async function metricsQuery(params: { query: string; from: number; to: number }): Promise<any> {
  return datadogRequest("GET", `/api/v1/query?query=${encodeURIComponent(params.query)}&from=${params.from}&to=${params.to}`);
}

async function metricsSubmit(params: { series: Array<{ metric: string; points: number[][]; type?: string; tags?: string[]; host?: string }> }): Promise<any> {
  return datadogRequest("POST", "/api/v2/series", { series: params.series });
}

async function metricsList(params: { from: number; host?: string; tags?: string }): Promise<any> {
  const query = new URLSearchParams({ from: params.from.toString() });
  if (params.host) query.set("host", params.host);
  if (params.tags) query.set("tags", params.tags);
  return datadogRequest("GET", `/api/v1/metrics?${query}`);
}

async function metricsSearch(params: { q: string }): Promise<any> {
  return datadogRequest("GET", `/api/v1/search?q=metrics:${encodeURIComponent(params.q)}`);
}

async function metricsMetadata(params: { metric: string }): Promise<any> {
  return datadogRequest("GET", `/api/v1/metrics/${encodeURIComponent(params.metric)}`);
}

// ---- Events ----
async function eventsList(params: { start: number; end: number; priority?: string; sources?: string; tags?: string; unaggregated?: boolean }): Promise<any> {
  const query = new URLSearchParams({ start: params.start.toString(), end: params.end.toString() });
  if (params.priority) query.set("priority", params.priority);
  if (params.sources) query.set("sources", params.sources);
  if (params.tags) query.set("tags", params.tags);
  if (params.unaggregated) query.set("unaggregated", "true");
  return datadogRequest("GET", `/api/v1/events?${query}`);
}

async function eventsCreate(params: { title: string; text: string; priority?: string; alertType?: string; host?: string; tags?: string[]; aggregationKey?: string; sourceTypeName?: string }): Promise<any> {
  const body: any = { title: params.title, text: params.text };
  if (params.priority) body.priority = params.priority;
  if (params.alertType) body.alert_type = params.alertType;
  if (params.host) body.host = params.host;
  if (params.tags) body.tags = params.tags;
  if (params.aggregationKey) body.aggregation_key = params.aggregationKey;
  if (params.sourceTypeName) body.source_type_name = params.sourceTypeName;
  return datadogRequest("POST", "/api/v1/events", body);
}

async function eventsGet(params: { eventId: number }): Promise<any> {
  return datadogRequest("GET", `/api/v1/events/${params.eventId}`);
}

// ---- Monitors ----
async function monitorsList(params: { groupStates?: string; name?: string; tags?: string; monitorTags?: string; withDowntimes?: boolean; pageSize?: number; page?: number }): Promise<any> {
  const query = new URLSearchParams();
  if (params.groupStates) query.set("group_states", params.groupStates);
  if (params.name) query.set("name", params.name);
  if (params.tags) query.set("tags", params.tags);
  if (params.monitorTags) query.set("monitor_tags", params.monitorTags);
  if (params.withDowntimes) query.set("with_downtimes", "true");
  if (params.pageSize) query.set("page_size", params.pageSize.toString());
  if (params.page) query.set("page", params.page.toString());
  const queryStr = query.toString() ? `?${query}` : "";
  return datadogRequest("GET", `/api/v1/monitor${queryStr}`);
}

async function monitorsGet(params: { monitorId: number; groupStates?: string }): Promise<any> {
  const query = params.groupStates ? `?group_states=${params.groupStates}` : "";
  return datadogRequest("GET", `/api/v1/monitor/${params.monitorId}${query}`);
}

async function monitorsCreate(params: { name: string; type: string; query: string; message?: string; tags?: string[]; priority?: number; options?: any }): Promise<any> {
  const body: any = { name: params.name, type: params.type, query: params.query };
  if (params.message) body.message = params.message;
  if (params.tags) body.tags = params.tags;
  if (params.priority) body.priority = params.priority;
  if (params.options) body.options = params.options;
  return datadogRequest("POST", "/api/v1/monitor", body);
}

async function monitorsUpdate(params: { monitorId: number; name?: string; query?: string; message?: string; tags?: string[]; priority?: number; options?: any }): Promise<any> {
  const body: any = {};
  if (params.name) body.name = params.name;
  if (params.query) body.query = params.query;
  if (params.message) body.message = params.message;
  if (params.tags) body.tags = params.tags;
  if (params.priority) body.priority = params.priority;
  if (params.options) body.options = params.options;
  return datadogRequest("PUT", `/api/v1/monitor/${params.monitorId}`, body);
}

async function monitorsDelete(params: { monitorId: number; force?: boolean }): Promise<any> {
  const query = params.force ? "?force=true" : "";
  await datadogRequest("DELETE", `/api/v1/monitor/${params.monitorId}${query}`);
  return { monitorId: params.monitorId, deleted: true };
}

async function monitorsMute(params: { monitorId: number; scope?: string; end?: number }): Promise<any> {
  const body: any = {};
  if (params.scope) body.scope = params.scope;
  if (params.end) body.end = params.end;
  return datadogRequest("POST", `/api/v1/monitor/${params.monitorId}/mute`, body);
}

async function monitorsUnmute(params: { monitorId: number; scope?: string; allScopes?: boolean }): Promise<any> {
  const body: any = {};
  if (params.scope) body.scope = params.scope;
  if (params.allScopes) body.all_scopes = params.allScopes;
  return datadogRequest("POST", `/api/v1/monitor/${params.monitorId}/unmute`, body);
}

async function monitorsSearch(params: { query?: string; page?: number; perPage?: number; sort?: string }): Promise<any> {
  const query = new URLSearchParams();
  if (params.query) query.set("query", params.query);
  if (params.page) query.set("page", params.page.toString());
  if (params.perPage) query.set("per_page", params.perPage.toString());
  if (params.sort) query.set("sort", params.sort);
  return datadogRequest("GET", `/api/v1/monitor/search?${query}`);
}

// ---- Dashboards ----
async function dashboardsList(params: { filterShared?: boolean; filterDeleted?: boolean; count?: number; start?: number }): Promise<any> {
  const query = new URLSearchParams();
  if (params.filterShared !== undefined) query.set("filter[shared]", params.filterShared.toString());
  if (params.filterDeleted !== undefined) query.set("filter[deleted]", params.filterDeleted.toString());
  if (params.count) query.set("count", params.count.toString());
  if (params.start) query.set("start", params.start.toString());
  const queryStr = query.toString() ? `?${query}` : "";
  return datadogRequest("GET", `/api/v1/dashboard${queryStr}`);
}

async function dashboardsGet(params: { dashboardId: string }): Promise<any> {
  return datadogRequest("GET", `/api/v1/dashboard/${params.dashboardId}`);
}

async function dashboardsCreate(params: { title: string; layoutType: string; widgets: any[]; description?: string; templateVariables?: any[]; isReadOnly?: boolean; notifyList?: string[]; reflowType?: string }): Promise<any> {
  const body: any = { title: params.title, layout_type: params.layoutType, widgets: params.widgets };
  if (params.description) body.description = params.description;
  if (params.templateVariables) body.template_variables = params.templateVariables;
  if (params.isReadOnly !== undefined) body.is_read_only = params.isReadOnly;
  if (params.notifyList) body.notify_list = params.notifyList;
  if (params.reflowType) body.reflow_type = params.reflowType;
  return datadogRequest("POST", "/api/v1/dashboard", body);
}

async function dashboardsUpdate(params: { dashboardId: string; title: string; layoutType: string; widgets: any[]; description?: string; templateVariables?: any[]; isReadOnly?: boolean; notifyList?: string[] }): Promise<any> {
  const body: any = { title: params.title, layout_type: params.layoutType, widgets: params.widgets };
  if (params.description) body.description = params.description;
  if (params.templateVariables) body.template_variables = params.templateVariables;
  if (params.isReadOnly !== undefined) body.is_read_only = params.isReadOnly;
  if (params.notifyList) body.notify_list = params.notifyList;
  return datadogRequest("PUT", `/api/v1/dashboard/${params.dashboardId}`, body);
}

async function dashboardsDelete(params: { dashboardId: string }): Promise<any> {
  await datadogRequest("DELETE", `/api/v1/dashboard/${params.dashboardId}`);
  return { dashboardId: params.dashboardId, deleted: true };
}

// ---- Logs ----
async function logsQuery(params: { query: string; from?: string; to?: string; sort?: string; limit?: number; indexes?: string[] }): Promise<any> {
  const body: any = {
    filter: { query: params.query },
  };
  if (params.from || params.to) {
    body.filter.from = params.from || "now-15m";
    body.filter.to = params.to || "now";
  }
  if (params.sort) body.sort = params.sort;
  if (params.limit) body.page = { limit: params.limit };
  if (params.indexes) body.filter.indexes = params.indexes;
  return datadogRequest("POST", "/api/v2/logs/events/search", body);
}

async function logsListIndexes(): Promise<any> {
  return datadogRequest("GET", "/api/v1/logs/config/indexes");
}

async function logsGetIndex(params: { name: string }): Promise<any> {
  return datadogRequest("GET", `/api/v1/logs/config/indexes/${params.name}`);
}

async function logsSubmit(params: { logs: Array<{ message: string; ddsource?: string; ddtags?: string; hostname?: string; service?: string }> }): Promise<any> {
  return datadogRequest("POST", "/api/v2/logs", params.logs);
}

async function logsAggregate(params: { query: string; from?: string; to?: string; groupBy?: string[]; compute?: Array<{ aggregation: string; metric?: string }> }): Promise<any> {
  const body: any = {
    filter: { query: params.query, from: params.from || "now-15m", to: params.to || "now" },
  };
  if (params.groupBy) body.group_by = params.groupBy.map((g) => ({ facet: g, limit: 10, sort: { order: "desc" } }));
  if (params.compute) body.compute = params.compute;
  return datadogRequest("POST", "/api/v2/logs/analytics/aggregate", body);
}

// ---- APM Traces ----
async function apmListServices(params: { env?: string }): Promise<any> {
  const query = params.env ? `?env=${encodeURIComponent(params.env)}` : "";
  return datadogRequest("GET", `/api/v1/services${query}`);
}

async function apmGetService(params: { serviceName: string }): Promise<any> {
  return datadogRequest("GET", `/api/v2/services/${encodeURIComponent(params.serviceName)}/definition`);
}

async function apmSearchTraces(params: { query: string; from?: number; to?: number; limit?: number; sort?: string }): Promise<any> {
  const now = Math.floor(Date.now() / 1000);
  const body: any = {
    filter: {
      query: params.query,
      from: (params.from || now - 3600) * 1000000000, // Convert to nanoseconds
      to: (params.to || now) * 1000000000,
    },
    page: { limit: params.limit || 50 },
  };
  if (params.sort) body.sort = params.sort;
  return datadogRequest("POST", "/api/v2/spans/events/search", body);
}

async function apmGetTrace(params: { traceId: string }): Promise<any> {
  return datadogRequest("GET", `/api/v2/traces/${params.traceId}`);
}

async function apmServiceStats(params: { env: string; service: string; from?: number; to?: number }): Promise<any> {
  const now = Math.floor(Date.now() / 1000);
  const from = params.from || now - 3600;
  const to = params.to || now;
  return metricsQuery({ query: `avg:trace.${params.service}.hits{env:${params.env}}`, from, to });
}

// ---- Synthetics ----
async function syntheticsListTests(params: { pageSize?: number; pageNumber?: number }): Promise<any> {
  const query = new URLSearchParams();
  if (params.pageSize) query.set("page_size", params.pageSize.toString());
  if (params.pageNumber) query.set("page_number", params.pageNumber.toString());
  const queryStr = query.toString() ? `?${query}` : "";
  return datadogRequest("GET", `/api/v1/synthetics/tests${queryStr}`);
}

async function syntheticsGetTest(params: { publicId: string }): Promise<any> {
  return datadogRequest("GET", `/api/v1/synthetics/tests/${params.publicId}`);
}

async function syntheticsGetResults(params: { publicId: string; fromTs?: number; toTs?: number; probeDc?: string[] }): Promise<any> {
  const query = new URLSearchParams();
  if (params.fromTs) query.set("from_ts", params.fromTs.toString());
  if (params.toTs) query.set("to_ts", params.toTs.toString());
  if (params.probeDc) params.probeDc.forEach((dc) => query.append("probe_dc", dc));
  const queryStr = query.toString() ? `?${query}` : "";
  return datadogRequest("GET", `/api/v1/synthetics/tests/${params.publicId}/results${queryStr}`);
}

async function syntheticsGetApiResult(params: { publicId: string; resultId: string }): Promise<any> {
  return datadogRequest("GET", `/api/v1/synthetics/tests/${params.publicId}/results/${params.resultId}`);
}

async function syntheticsGetBrowserResult(params: { publicId: string; resultId: string }): Promise<any> {
  return datadogRequest("GET", `/api/v1/synthetics/tests/browser/${params.publicId}/results/${params.resultId}`);
}

async function syntheticsTriggerTest(params: { publicIds: string[] }): Promise<any> {
  return datadogRequest("POST", "/api/v1/synthetics/tests/trigger", { tests: params.publicIds.map((id) => ({ public_id: id })) });
}

async function syntheticsCreateTest(params: { name: string; type: string; config: any; locations: string[]; options?: any; message?: string; tags?: string[]; status?: string }): Promise<any> {
  const body: any = {
    name: params.name,
    type: params.type,
    config: params.config,
    locations: params.locations,
  };
  if (params.options) body.options = params.options;
  if (params.message) body.message = params.message;
  if (params.tags) body.tags = params.tags;
  if (params.status) body.status = params.status;
  return datadogRequest("POST", "/api/v1/synthetics/tests", body);
}

async function syntheticsUpdateTest(params: { publicId: string; name?: string; config?: any; locations?: string[]; options?: any; message?: string; tags?: string[]; status?: string }): Promise<any> {
  const body: any = {};
  if (params.name) body.name = params.name;
  if (params.config) body.config = params.config;
  if (params.locations) body.locations = params.locations;
  if (params.options) body.options = params.options;
  if (params.message) body.message = params.message;
  if (params.tags) body.tags = params.tags;
  if (params.status) body.status = params.status;
  return datadogRequest("PUT", `/api/v1/synthetics/tests/${params.publicId}`, body);
}

async function syntheticsDeleteTests(params: { publicIds: string[] }): Promise<any> {
  return datadogRequest("POST", "/api/v1/synthetics/tests/delete", { public_ids: params.publicIds });
}

async function syntheticsListLocations(): Promise<any> {
  return datadogRequest("GET", "/api/v1/synthetics/locations");
}

// ---- Incidents ----
async function incidentsList(params: { query?: string; pageSize?: number; pageOffset?: number; sort?: string }): Promise<any> {
  const query = new URLSearchParams();
  if (params.query) query.set("query", params.query);
  if (params.pageSize) query.set("page[size]", params.pageSize.toString());
  if (params.pageOffset) query.set("page[offset]", params.pageOffset.toString());
  if (params.sort) query.set("sort", params.sort);
  const queryStr = query.toString() ? `?${query}` : "";
  return datadogRequest("GET", `/api/v2/incidents${queryStr}`);
}

async function incidentsGet(params: { incidentId: string; include?: string[] }): Promise<any> {
  const query = params.include ? `?include=${params.include.join(",")}` : "";
  return datadogRequest("GET", `/api/v2/incidents/${params.incidentId}${query}`);
}

async function incidentsCreate(params: { title: string; customerImpacted: boolean; fields?: any; notificationHandles?: string[] }): Promise<any> {
  const body: any = {
    data: {
      type: "incidents",
      attributes: {
        title: params.title,
        customer_impacted: params.customerImpacted,
      },
    },
  };
  if (params.fields) body.data.attributes.fields = params.fields;
  if (params.notificationHandles) body.data.attributes.notification_handles = params.notificationHandles.map((h) => ({ handle: h }));
  return datadogRequest("POST", "/api/v2/incidents", body);
}

async function incidentsUpdate(params: { incidentId: string; title?: string; customerImpacted?: boolean; fields?: any; notificationHandles?: string[] }): Promise<any> {
  const body: any = {
    data: {
      type: "incidents",
      id: params.incidentId,
      attributes: {},
    },
  };
  if (params.title) body.data.attributes.title = params.title;
  if (params.customerImpacted !== undefined) body.data.attributes.customer_impacted = params.customerImpacted;
  if (params.fields) body.data.attributes.fields = params.fields;
  if (params.notificationHandles) body.data.attributes.notification_handles = params.notificationHandles.map((h) => ({ handle: h }));
  return datadogRequest("PATCH", `/api/v2/incidents/${params.incidentId}`, body);
}

async function incidentsDelete(params: { incidentId: string }): Promise<any> {
  await datadogRequest("DELETE", `/api/v2/incidents/${params.incidentId}`);
  return { incidentId: params.incidentId, deleted: true };
}

async function incidentsAddTimeline(params: { incidentId: string; content: string; important?: boolean }): Promise<any> {
  const body = {
    data: {
      type: "incident_timeline_cells",
      attributes: {
        cell_type: "markdown",
        content: { content: params.content },
        important: params.important || false,
      },
    },
  };
  return datadogRequest("POST", `/api/v2/incidents/${params.incidentId}/timeline`, body);
}

async function incidentsListAttachments(params: { incidentId: string }): Promise<any> {
  return datadogRequest("GET", `/api/v2/incidents/${params.incidentId}/attachments`);
}

// ---- SLOs ----
async function sloList(params: { ids?: string; query?: string; tagsQuery?: string; metricsQuery?: string; limit?: number; offset?: number }): Promise<any> {
  const query = new URLSearchParams();
  if (params.ids) query.set("ids", params.ids);
  if (params.query) query.set("query", params.query);
  if (params.tagsQuery) query.set("tags_query", params.tagsQuery);
  if (params.metricsQuery) query.set("metrics_query", params.metricsQuery);
  if (params.limit) query.set("limit", params.limit.toString());
  if (params.offset) query.set("offset", params.offset.toString());
  const queryStr = query.toString() ? `?${query}` : "";
  return datadogRequest("GET", `/api/v1/slo${queryStr}`);
}

async function sloGet(params: { sloId: string; withConfiguredAlertIds?: boolean }): Promise<any> {
  const query = params.withConfiguredAlertIds ? "?with_configured_alert_ids=true" : "";
  return datadogRequest("GET", `/api/v1/slo/${params.sloId}${query}`);
}

async function sloHistory(params: { sloId: string; fromTs: number; toTs: number; target?: number }): Promise<any> {
  const query = new URLSearchParams({ from_ts: params.fromTs.toString(), to_ts: params.toTs.toString() });
  if (params.target) query.set("target", params.target.toString());
  return datadogRequest("GET", `/api/v1/slo/${params.sloId}/history?${query}`);
}

// ---- Hosts ----
async function hostsList(params: { filter?: string; sortField?: string; sortDir?: string; start?: number; count?: number; from?: number; includeMutedHostsData?: boolean; includeHostsMetadata?: boolean }): Promise<any> {
  const query = new URLSearchParams();
  if (params.filter) query.set("filter", params.filter);
  if (params.sortField) query.set("sort_field", params.sortField);
  if (params.sortDir) query.set("sort_dir", params.sortDir);
  if (params.start) query.set("start", params.start.toString());
  if (params.count) query.set("count", params.count.toString());
  if (params.from) query.set("from", params.from.toString());
  if (params.includeMutedHostsData) query.set("include_muted_hosts_data", "true");
  if (params.includeHostsMetadata) query.set("include_hosts_metadata", "true");
  const queryStr = query.toString() ? `?${query}` : "";
  return datadogRequest("GET", `/api/v1/hosts${queryStr}`);
}

async function hostsMute(params: { hostname: string; end?: number; message?: string; override?: boolean }): Promise<any> {
  const body: any = {};
  if (params.end) body.end = params.end;
  if (params.message) body.message = params.message;
  if (params.override) body.override = params.override;
  return datadogRequest("POST", `/api/v1/host/${params.hostname}/mute`, body);
}

async function hostsUnmute(params: { hostname: string }): Promise<any> {
  return datadogRequest("POST", `/api/v1/host/${params.hostname}/unmute`);
}

async function hostsTotals(params: { from?: number }): Promise<any> {
  const query = params.from ? `?from=${params.from}` : "";
  return datadogRequest("GET", `/api/v1/hosts/totals${query}`);
}

// ---- Downtimes ----
async function downtimesList(params: { currentOnly?: boolean; withCreator?: boolean }): Promise<any> {
  const query = new URLSearchParams();
  if (params.currentOnly) query.set("current_only", "true");
  if (params.withCreator) query.set("with_creator", "true");
  const queryStr = query.toString() ? `?${query}` : "";
  return datadogRequest("GET", `/api/v1/downtime${queryStr}`);
}

async function downtimesCreate(params: { scope: string[]; start?: number; end?: number; message?: string; timezone?: string; monitorId?: number; monitorTags?: string[]; recurrence?: any }): Promise<any> {
  const body: any = { scope: params.scope };
  if (params.start) body.start = params.start;
  if (params.end) body.end = params.end;
  if (params.message) body.message = params.message;
  if (params.timezone) body.timezone = params.timezone;
  if (params.monitorId) body.monitor_id = params.monitorId;
  if (params.monitorTags) body.monitor_tags = params.monitorTags;
  if (params.recurrence) body.recurrence = params.recurrence;
  return datadogRequest("POST", "/api/v1/downtime", body);
}

async function downtimesCancel(params: { downtimeId: number }): Promise<any> {
  await datadogRequest("DELETE", `/api/v1/downtime/${params.downtimeId}`);
  return { downtimeId: params.downtimeId, cancelled: true };
}

// ============================================================================
// SERVER SETUP
// ============================================================================

const server = new Server({ name: "datadog-mcp", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result: any;
    switch (name) {
      // Metrics
      case "metrics_query": result = await metricsQuery(args as any); break;
      case "metrics_submit": result = await metricsSubmit(args as any); break;
      case "metrics_list": result = await metricsList(args as any); break;
      case "metrics_search": result = await metricsSearch(args as any); break;
      case "metrics_metadata": result = await metricsMetadata(args as any); break;
      // Events
      case "events_list": result = await eventsList(args as any); break;
      case "events_create": result = await eventsCreate(args as any); break;
      case "events_get": result = await eventsGet(args as any); break;
      // Monitors
      case "monitors_list": result = await monitorsList(args as any); break;
      case "monitors_get": result = await monitorsGet(args as any); break;
      case "monitors_create": result = await monitorsCreate(args as any); break;
      case "monitors_update": result = await monitorsUpdate(args as any); break;
      case "monitors_delete": result = await monitorsDelete(args as any); break;
      case "monitors_mute": result = await monitorsMute(args as any); break;
      case "monitors_unmute": result = await monitorsUnmute(args as any); break;
      case "monitors_search": result = await monitorsSearch(args as any); break;
      // Dashboards
      case "dashboards_list": result = await dashboardsList(args as any); break;
      case "dashboards_get": result = await dashboardsGet(args as any); break;
      case "dashboards_create": result = await dashboardsCreate(args as any); break;
      case "dashboards_update": result = await dashboardsUpdate(args as any); break;
      case "dashboards_delete": result = await dashboardsDelete(args as any); break;
      // Logs
      case "logs_query": result = await logsQuery(args as any); break;
      case "logs_list_indexes": result = await logsListIndexes(); break;
      case "logs_get_index": result = await logsGetIndex(args as any); break;
      case "logs_submit": result = await logsSubmit(args as any); break;
      case "logs_aggregate": result = await logsAggregate(args as any); break;
      // APM
      case "apm_list_services": result = await apmListServices(args as any); break;
      case "apm_get_service": result = await apmGetService(args as any); break;
      case "apm_search_traces": result = await apmSearchTraces(args as any); break;
      case "apm_get_trace": result = await apmGetTrace(args as any); break;
      case "apm_service_stats": result = await apmServiceStats(args as any); break;
      // Synthetics
      case "synthetics_list_tests": result = await syntheticsListTests(args as any); break;
      case "synthetics_get_test": result = await syntheticsGetTest(args as any); break;
      case "synthetics_get_results": result = await syntheticsGetResults(args as any); break;
      case "synthetics_get_api_result": result = await syntheticsGetApiResult(args as any); break;
      case "synthetics_get_browser_result": result = await syntheticsGetBrowserResult(args as any); break;
      case "synthetics_trigger_test": result = await syntheticsTriggerTest(args as any); break;
      case "synthetics_create_test": result = await syntheticsCreateTest(args as any); break;
      case "synthetics_update_test": result = await syntheticsUpdateTest(args as any); break;
      case "synthetics_delete_tests": result = await syntheticsDeleteTests(args as any); break;
      case "synthetics_list_locations": result = await syntheticsListLocations(); break;
      // Incidents
      case "incidents_list": result = await incidentsList(args as any); break;
      case "incidents_get": result = await incidentsGet(args as any); break;
      case "incidents_create": result = await incidentsCreate(args as any); break;
      case "incidents_update": result = await incidentsUpdate(args as any); break;
      case "incidents_delete": result = await incidentsDelete(args as any); break;
      case "incidents_add_timeline": result = await incidentsAddTimeline(args as any); break;
      case "incidents_list_attachments": result = await incidentsListAttachments(args as any); break;
      // SLOs
      case "slo_list": result = await sloList(args as any); break;
      case "slo_get": result = await sloGet(args as any); break;
      case "slo_history": result = await sloHistory(args as any); break;
      // Hosts
      case "hosts_list": result = await hostsList(args as any); break;
      case "hosts_mute": result = await hostsMute(args as any); break;
      case "hosts_unmute": result = await hostsUnmute(args as any); break;
      case "hosts_totals": result = await hostsTotals(args as any); break;
      // Downtimes
      case "downtimes_list": result = await downtimesList(args as any); break;
      case "downtimes_create": result = await downtimesCreate(args as any); break;
      case "downtimes_cancel": result = await downtimesCancel(args as any); break;
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
  console.error("Datadog MCP Server running on stdio");
}

main().catch(console.error);
