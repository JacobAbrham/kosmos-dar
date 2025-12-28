/**
 * PagerDuty MCP Server
 *
 * Incident management and on-call scheduling integration for KOSMOS agents including:
 * - Incidents: list, create, update, resolve, merge
 * - Services: list, create, update
 * - Escalation policies: list, get
 * - Schedules: list, get, overrides
 * - Users: list, get, on-call
 * - Teams: list, members
 * - Alerts: list, get
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";

// Environment configuration
const PAGERDUTY_TOKEN = process.env.PAGERDUTY_TOKEN || "";
const PAGERDUTY_BASE_URL = "https://api.pagerduty.com";

// Helper function for PagerDuty API requests
async function pagerdutyRequest(method: string, path: string, body?: any, params?: Record<string, string>): Promise<any> {
  const url = new URL(`${PAGERDUTY_BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.append(key, value);
      }
    });
  }

  const res = await fetch(url.toString(), {
    method,
    headers: {
      "Authorization": `Token token=${PAGERDUTY_TOKEN}`,
      "Content-Type": "application/json",
      "Accept": "application/vnd.pagerduty+json;version=2",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(error.error?.message || error.message || res.statusText);
  }

  return res.status === 204 ? {} : res.json();
}

// Tool definitions
const TOOLS: Tool[] = [
  // ========== Incidents ==========
  {
    name: "list_incidents",
    description: "List incidents with optional filtering by status, urgency, service, or date range",
    inputSchema: {
      type: "object",
      properties: {
        statuses: { type: "array", items: { type: "string", enum: ["triggered", "acknowledged", "resolved"] }, description: "Filter by status(es)" },
        urgencies: { type: "array", items: { type: "string", enum: ["high", "low"] }, description: "Filter by urgency" },
        serviceIds: { type: "array", items: { type: "string" }, description: "Filter by service IDs" },
        teamIds: { type: "array", items: { type: "string" }, description: "Filter by team IDs" },
        userIds: { type: "array", items: { type: "string" }, description: "Filter by assigned user IDs" },
        since: { type: "string", description: "Start date (ISO 8601)" },
        until: { type: "string", description: "End date (ISO 8601)" },
        sortBy: { type: "string", enum: ["incident_number", "created_at", "resolved_at", "urgency"], description: "Sort field" },
        limit: { type: "number", description: "Max results (default 25, max 100)" },
        offset: { type: "number", description: "Pagination offset" },
      },
    },
  },
  {
    name: "get_incident",
    description: "Get detailed information about a specific incident",
    inputSchema: {
      type: "object",
      properties: {
        incidentId: { type: "string", description: "Incident ID" },
      },
      required: ["incidentId"],
    },
  },
  {
    name: "create_incident",
    description: "Create a new incident",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Incident title" },
        serviceId: { type: "string", description: "Service ID to create incident for" },
        urgency: { type: "string", enum: ["high", "low"], description: "Incident urgency" },
        body: { type: "string", description: "Incident body/details" },
        escalationPolicyId: { type: "string", description: "Escalation policy ID (optional, uses service default)" },
        assignmentIds: { type: "array", items: { type: "string" }, description: "User IDs to assign" },
        incidentKey: { type: "string", description: "Deduplication key" },
        priority: { type: "string", description: "Priority ID" },
      },
      required: ["title", "serviceId"],
    },
  },
  {
    name: "update_incident",
    description: "Update an incident (status, urgency, assignments, etc.)",
    inputSchema: {
      type: "object",
      properties: {
        incidentId: { type: "string", description: "Incident ID" },
        status: { type: "string", enum: ["acknowledged", "resolved"], description: "New status" },
        urgency: { type: "string", enum: ["high", "low"], description: "New urgency" },
        resolution: { type: "string", description: "Resolution note (when resolving)" },
        title: { type: "string", description: "New title" },
        escalationLevel: { type: "number", description: "Escalation level to set" },
        assignmentIds: { type: "array", items: { type: "string" }, description: "User IDs to reassign to" },
        escalationPolicyId: { type: "string", description: "New escalation policy ID" },
        priority: { type: "string", description: "Priority ID" },
      },
      required: ["incidentId"],
    },
  },
  {
    name: "resolve_incident",
    description: "Resolve an incident with optional resolution note",
    inputSchema: {
      type: "object",
      properties: {
        incidentId: { type: "string", description: "Incident ID" },
        resolution: { type: "string", description: "Resolution note" },
      },
      required: ["incidentId"],
    },
  },
  {
    name: "merge_incidents",
    description: "Merge multiple incidents into one",
    inputSchema: {
      type: "object",
      properties: {
        targetIncidentId: { type: "string", description: "Target incident ID (incidents will be merged into this)" },
        sourceIncidentIds: { type: "array", items: { type: "string" }, description: "Source incident IDs to merge" },
      },
      required: ["targetIncidentId", "sourceIncidentIds"],
    },
  },
  {
    name: "add_incident_note",
    description: "Add a note to an incident",
    inputSchema: {
      type: "object",
      properties: {
        incidentId: { type: "string", description: "Incident ID" },
        content: { type: "string", description: "Note content" },
      },
      required: ["incidentId", "content"],
    },
  },
  {
    name: "list_incident_notes",
    description: "List notes for an incident",
    inputSchema: {
      type: "object",
      properties: {
        incidentId: { type: "string", description: "Incident ID" },
      },
      required: ["incidentId"],
    },
  },

  // ========== Services ==========
  {
    name: "list_services",
    description: "List all services with optional filtering",
    inputSchema: {
      type: "object",
      properties: {
        teamIds: { type: "array", items: { type: "string" }, description: "Filter by team IDs" },
        query: { type: "string", description: "Search query for service name" },
        include: { type: "array", items: { type: "string", enum: ["escalation_policies", "teams", "integrations"] }, description: "Related objects to include" },
        limit: { type: "number", description: "Max results" },
        offset: { type: "number", description: "Pagination offset" },
      },
    },
  },
  {
    name: "get_service",
    description: "Get detailed information about a specific service",
    inputSchema: {
      type: "object",
      properties: {
        serviceId: { type: "string", description: "Service ID" },
        include: { type: "array", items: { type: "string", enum: ["escalation_policies", "teams", "integrations"] }, description: "Related objects to include" },
      },
      required: ["serviceId"],
    },
  },
  {
    name: "create_service",
    description: "Create a new service",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Service name" },
        description: { type: "string", description: "Service description" },
        escalationPolicyId: { type: "string", description: "Escalation policy ID" },
        alertCreation: { type: "string", enum: ["create_incidents", "create_alerts_and_incidents"], description: "Alert creation behavior" },
        alertGrouping: { type: "string", enum: ["time", "intelligent", "content_based"], description: "Alert grouping type" },
        alertGroupingTimeout: { type: "number", description: "Alert grouping timeout in minutes" },
        autoResolveTimeout: { type: "number", description: "Auto-resolve timeout in seconds (null to disable)" },
        acknowledgementTimeout: { type: "number", description: "Acknowledgement timeout in seconds (null to disable)" },
      },
      required: ["name", "escalationPolicyId"],
    },
  },
  {
    name: "update_service",
    description: "Update a service",
    inputSchema: {
      type: "object",
      properties: {
        serviceId: { type: "string", description: "Service ID" },
        name: { type: "string", description: "New service name" },
        description: { type: "string", description: "New description" },
        escalationPolicyId: { type: "string", description: "New escalation policy ID" },
        alertCreation: { type: "string", enum: ["create_incidents", "create_alerts_and_incidents"], description: "Alert creation behavior" },
        alertGrouping: { type: "string", enum: ["time", "intelligent", "content_based"], description: "Alert grouping type" },
        alertGroupingTimeout: { type: "number", description: "Alert grouping timeout in minutes" },
        status: { type: "string", enum: ["active", "warning", "critical", "maintenance", "disabled"], description: "Service status" },
      },
      required: ["serviceId"],
    },
  },

  // ========== Escalation Policies ==========
  {
    name: "list_escalation_policies",
    description: "List all escalation policies",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query for policy name" },
        teamIds: { type: "array", items: { type: "string" }, description: "Filter by team IDs" },
        userIds: { type: "array", items: { type: "string" }, description: "Filter by user IDs" },
        include: { type: "array", items: { type: "string", enum: ["services", "teams", "targets"] }, description: "Related objects to include" },
        limit: { type: "number", description: "Max results" },
        offset: { type: "number", description: "Pagination offset" },
      },
    },
  },
  {
    name: "get_escalation_policy",
    description: "Get detailed information about a specific escalation policy",
    inputSchema: {
      type: "object",
      properties: {
        escalationPolicyId: { type: "string", description: "Escalation policy ID" },
        include: { type: "array", items: { type: "string", enum: ["services", "teams", "targets"] }, description: "Related objects to include" },
      },
      required: ["escalationPolicyId"],
    },
  },

  // ========== Schedules ==========
  {
    name: "list_schedules",
    description: "List all on-call schedules",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query for schedule name" },
        include: { type: "array", items: { type: "string", enum: ["schedule_layers", "final_schedule", "overrides"] }, description: "Related objects to include" },
        limit: { type: "number", description: "Max results" },
        offset: { type: "number", description: "Pagination offset" },
      },
    },
  },
  {
    name: "get_schedule",
    description: "Get detailed information about a specific schedule",
    inputSchema: {
      type: "object",
      properties: {
        scheduleId: { type: "string", description: "Schedule ID" },
        since: { type: "string", description: "Start date for schedule rendering (ISO 8601)" },
        until: { type: "string", description: "End date for schedule rendering (ISO 8601)" },
        include: { type: "array", items: { type: "string", enum: ["schedule_layers", "final_schedule", "overrides"] }, description: "Related objects to include" },
      },
      required: ["scheduleId"],
    },
  },
  {
    name: "list_schedule_overrides",
    description: "List overrides for a schedule",
    inputSchema: {
      type: "object",
      properties: {
        scheduleId: { type: "string", description: "Schedule ID" },
        since: { type: "string", description: "Start date (ISO 8601)" },
        until: { type: "string", description: "End date (ISO 8601)" },
        editable: { type: "boolean", description: "Only show editable overrides" },
        overflow: { type: "boolean", description: "Include overrides that extend beyond the time range" },
      },
      required: ["scheduleId", "since", "until"],
    },
  },
  {
    name: "create_schedule_override",
    description: "Create an override for a schedule",
    inputSchema: {
      type: "object",
      properties: {
        scheduleId: { type: "string", description: "Schedule ID" },
        userId: { type: "string", description: "User ID to put on-call during override" },
        start: { type: "string", description: "Override start time (ISO 8601)" },
        end: { type: "string", description: "Override end time (ISO 8601)" },
      },
      required: ["scheduleId", "userId", "start", "end"],
    },
  },
  {
    name: "delete_schedule_override",
    description: "Delete a schedule override",
    inputSchema: {
      type: "object",
      properties: {
        scheduleId: { type: "string", description: "Schedule ID" },
        overrideId: { type: "string", description: "Override ID" },
      },
      required: ["scheduleId", "overrideId"],
    },
  },

  // ========== Users ==========
  {
    name: "list_users",
    description: "List all users",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query for user name or email" },
        teamIds: { type: "array", items: { type: "string" }, description: "Filter by team IDs" },
        include: { type: "array", items: { type: "string", enum: ["contact_methods", "notification_rules", "teams"] }, description: "Related objects to include" },
        limit: { type: "number", description: "Max results" },
        offset: { type: "number", description: "Pagination offset" },
      },
    },
  },
  {
    name: "get_user",
    description: "Get detailed information about a specific user",
    inputSchema: {
      type: "object",
      properties: {
        userId: { type: "string", description: "User ID" },
        include: { type: "array", items: { type: "string", enum: ["contact_methods", "notification_rules", "teams"] }, description: "Related objects to include" },
      },
      required: ["userId"],
    },
  },
  {
    name: "get_user_oncall",
    description: "Get on-call information for a user",
    inputSchema: {
      type: "object",
      properties: {
        userId: { type: "string", description: "User ID" },
        since: { type: "string", description: "Start date (ISO 8601)" },
        until: { type: "string", description: "End date (ISO 8601)" },
        earliest: { type: "boolean", description: "Return only the earliest on-call for each escalation policy" },
        include: { type: "array", items: { type: "string", enum: ["escalation_policies", "schedules"] }, description: "Related objects to include" },
      },
      required: ["userId"],
    },
  },
  {
    name: "list_oncalls",
    description: "List all current on-call entries across the account",
    inputSchema: {
      type: "object",
      properties: {
        since: { type: "string", description: "Start date (ISO 8601)" },
        until: { type: "string", description: "End date (ISO 8601)" },
        scheduleIds: { type: "array", items: { type: "string" }, description: "Filter by schedule IDs" },
        userIds: { type: "array", items: { type: "string" }, description: "Filter by user IDs" },
        escalationPolicyIds: { type: "array", items: { type: "string" }, description: "Filter by escalation policy IDs" },
        earliest: { type: "boolean", description: "Return only the earliest on-call" },
        include: { type: "array", items: { type: "string", enum: ["escalation_policies", "schedules", "users"] }, description: "Related objects to include" },
      },
    },
  },

  // ========== Teams ==========
  {
    name: "list_teams",
    description: "List all teams",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query for team name" },
        limit: { type: "number", description: "Max results" },
        offset: { type: "number", description: "Pagination offset" },
      },
    },
  },
  {
    name: "get_team",
    description: "Get detailed information about a specific team",
    inputSchema: {
      type: "object",
      properties: {
        teamId: { type: "string", description: "Team ID" },
        include: { type: "array", items: { type: "string", enum: ["members", "escalation_policies"] }, description: "Related objects to include" },
      },
      required: ["teamId"],
    },
  },
  {
    name: "list_team_members",
    description: "List members of a team",
    inputSchema: {
      type: "object",
      properties: {
        teamId: { type: "string", description: "Team ID" },
        limit: { type: "number", description: "Max results" },
        offset: { type: "number", description: "Pagination offset" },
      },
      required: ["teamId"],
    },
  },

  // ========== Alerts ==========
  {
    name: "list_alerts",
    description: "List alerts for an incident",
    inputSchema: {
      type: "object",
      properties: {
        incidentId: { type: "string", description: "Incident ID" },
        statuses: { type: "array", items: { type: "string", enum: ["triggered", "resolved"] }, description: "Filter by alert status" },
        sortBy: { type: "string", enum: ["created_at", "resolved_at"], description: "Sort field" },
        include: { type: "array", items: { type: "string", enum: ["services", "first_trigger_log_entries", "incidents"] }, description: "Related objects to include" },
        limit: { type: "number", description: "Max results" },
        offset: { type: "number", description: "Pagination offset" },
      },
      required: ["incidentId"],
    },
  },
  {
    name: "get_alert",
    description: "Get detailed information about a specific alert",
    inputSchema: {
      type: "object",
      properties: {
        incidentId: { type: "string", description: "Incident ID" },
        alertId: { type: "string", description: "Alert ID" },
      },
      required: ["incidentId", "alertId"],
    },
  },
  {
    name: "update_alert",
    description: "Update an alert (typically to resolve it)",
    inputSchema: {
      type: "object",
      properties: {
        incidentId: { type: "string", description: "Incident ID" },
        alertId: { type: "string", description: "Alert ID" },
        status: { type: "string", enum: ["resolved"], description: "New status (only resolved is valid)" },
      },
      required: ["incidentId", "alertId", "status"],
    },
  },

  // ========== Priorities ==========
  {
    name: "list_priorities",
    description: "List all incident priorities configured in the account",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

// ========== Implementation Functions ==========

// Incidents
async function listIncidents(params: {
  statuses?: string[];
  urgencies?: string[];
  serviceIds?: string[];
  teamIds?: string[];
  userIds?: string[];
  since?: string;
  until?: string;
  sortBy?: string;
  limit?: number;
  offset?: number;
}): Promise<any> {
  const queryParams: Record<string, string> = {};
  if (params.statuses?.length) queryParams["statuses[]"] = params.statuses.join(",");
  if (params.urgencies?.length) queryParams["urgencies[]"] = params.urgencies.join(",");
  if (params.serviceIds?.length) queryParams["service_ids[]"] = params.serviceIds.join(",");
  if (params.teamIds?.length) queryParams["team_ids[]"] = params.teamIds.join(",");
  if (params.userIds?.length) queryParams["user_ids[]"] = params.userIds.join(",");
  if (params.since) queryParams.since = params.since;
  if (params.until) queryParams.until = params.until;
  if (params.sortBy) queryParams.sort_by = params.sortBy;
  if (params.limit) queryParams.limit = String(params.limit);
  if (params.offset) queryParams.offset = String(params.offset);

  const res = await pagerdutyRequest("GET", "/incidents", undefined, queryParams);
  return {
    incidents: res.incidents?.map((i: any) => ({
      id: i.id,
      incidentNumber: i.incident_number,
      title: i.title,
      status: i.status,
      urgency: i.urgency,
      priority: i.priority?.summary,
      service: { id: i.service?.id, name: i.service?.summary },
      assignees: i.assignments?.map((a: any) => ({ id: a.assignee?.id, name: a.assignee?.summary })),
      createdAt: i.created_at,
      updatedAt: i.last_status_change_at,
      resolvedAt: i.resolved_at,
    })),
    total: res.total,
    more: res.more,
  };
}

async function getIncident(params: { incidentId: string }): Promise<any> {
  const res = await pagerdutyRequest("GET", `/incidents/${params.incidentId}`);
  const i = res.incident;
  return {
    id: i.id,
    incidentNumber: i.incident_number,
    title: i.title,
    description: i.description,
    status: i.status,
    urgency: i.urgency,
    priority: i.priority,
    service: { id: i.service?.id, name: i.service?.summary },
    escalationPolicy: { id: i.escalation_policy?.id, name: i.escalation_policy?.summary },
    assignees: i.assignments?.map((a: any) => ({ id: a.assignee?.id, name: a.assignee?.summary, at: a.at })),
    acknowledgedBy: i.acknowledgements?.map((a: any) => ({ id: a.acknowledger?.id, name: a.acknowledger?.summary, at: a.at })),
    resolvedBy: i.last_status_change_by,
    createdAt: i.created_at,
    updatedAt: i.last_status_change_at,
    resolvedAt: i.resolved_at,
    incidentKey: i.incident_key,
    alertCounts: i.alert_counts,
    body: i.body,
  };
}

async function createIncident(params: {
  title: string;
  serviceId: string;
  urgency?: string;
  body?: string;
  escalationPolicyId?: string;
  assignmentIds?: string[];
  incidentKey?: string;
  priority?: string;
}): Promise<any> {
  const incident: any = {
    type: "incident",
    title: params.title,
    service: { id: params.serviceId, type: "service_reference" },
  };
  if (params.urgency) incident.urgency = params.urgency;
  if (params.body) incident.body = { type: "incident_body", details: params.body };
  if (params.escalationPolicyId) incident.escalation_policy = { id: params.escalationPolicyId, type: "escalation_policy_reference" };
  if (params.assignmentIds?.length) incident.assignments = params.assignmentIds.map(id => ({ assignee: { id, type: "user_reference" } }));
  if (params.incidentKey) incident.incident_key = params.incidentKey;
  if (params.priority) incident.priority = { id: params.priority, type: "priority_reference" };

  const res = await pagerdutyRequest("POST", "/incidents", { incident });
  return { id: res.incident.id, incidentNumber: res.incident.incident_number, status: res.incident.status, htmlUrl: res.incident.html_url };
}

async function updateIncident(params: {
  incidentId: string;
  status?: string;
  urgency?: string;
  resolution?: string;
  title?: string;
  escalationLevel?: number;
  assignmentIds?: string[];
  escalationPolicyId?: string;
  priority?: string;
}): Promise<any> {
  const incident: any = { id: params.incidentId, type: "incident_reference" };
  if (params.status) incident.status = params.status;
  if (params.urgency) incident.urgency = params.urgency;
  if (params.resolution) incident.resolution = params.resolution;
  if (params.title) incident.title = params.title;
  if (params.escalationLevel !== undefined) incident.escalation_level = params.escalationLevel;
  if (params.assignmentIds?.length) incident.assignments = params.assignmentIds.map(id => ({ assignee: { id, type: "user_reference" } }));
  if (params.escalationPolicyId) incident.escalation_policy = { id: params.escalationPolicyId, type: "escalation_policy_reference" };
  if (params.priority) incident.priority = { id: params.priority, type: "priority_reference" };

  const res = await pagerdutyRequest("PUT", `/incidents/${params.incidentId}`, { incident });
  return { id: res.incident.id, status: res.incident.status, updated: true };
}

async function resolveIncident(params: { incidentId: string; resolution?: string }): Promise<any> {
  const incident: any = { id: params.incidentId, type: "incident_reference", status: "resolved" };
  if (params.resolution) incident.resolution = params.resolution;

  const res = await pagerdutyRequest("PUT", `/incidents/${params.incidentId}`, { incident });
  return { id: res.incident.id, status: res.incident.status, resolvedAt: res.incident.resolved_at };
}

async function mergeIncidents(params: { targetIncidentId: string; sourceIncidentIds: string[] }): Promise<any> {
  const sourceIncidents = params.sourceIncidentIds.map(id => ({ id, type: "incident_reference" }));
  const res = await pagerdutyRequest("PUT", `/incidents/${params.targetIncidentId}/merge`, { source_incidents: sourceIncidents });
  return { targetId: res.incident.id, mergedIncidents: params.sourceIncidentIds };
}

async function addIncidentNote(params: { incidentId: string; content: string }): Promise<any> {
  const res = await pagerdutyRequest("POST", `/incidents/${params.incidentId}/notes`, {
    note: { content: params.content },
  });
  return { id: res.note.id, content: res.note.content, createdAt: res.note.created_at };
}

async function listIncidentNotes(params: { incidentId: string }): Promise<any> {
  const res = await pagerdutyRequest("GET", `/incidents/${params.incidentId}/notes`);
  return {
    notes: res.notes?.map((n: any) => ({
      id: n.id,
      content: n.content,
      user: { id: n.user?.id, name: n.user?.summary },
      createdAt: n.created_at,
    })),
  };
}

// Services
async function listServices(params: {
  teamIds?: string[];
  query?: string;
  include?: string[];
  limit?: number;
  offset?: number;
}): Promise<any> {
  const queryParams: Record<string, string> = {};
  if (params.teamIds?.length) queryParams["team_ids[]"] = params.teamIds.join(",");
  if (params.query) queryParams.query = params.query;
  if (params.include?.length) queryParams["include[]"] = params.include.join(",");
  if (params.limit) queryParams.limit = String(params.limit);
  if (params.offset) queryParams.offset = String(params.offset);

  const res = await pagerdutyRequest("GET", "/services", undefined, queryParams);
  return {
    services: res.services?.map((s: any) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      status: s.status,
      escalationPolicy: { id: s.escalation_policy?.id, name: s.escalation_policy?.summary },
      teams: s.teams?.map((t: any) => ({ id: t.id, name: t.summary })),
      alertCreation: s.alert_creation,
      alertGrouping: s.alert_grouping_parameters?.type,
      createdAt: s.created_at,
    })),
    total: res.total,
    more: res.more,
  };
}

async function getService(params: { serviceId: string; include?: string[] }): Promise<any> {
  const queryParams: Record<string, string> = {};
  if (params.include?.length) queryParams["include[]"] = params.include.join(",");

  const res = await pagerdutyRequest("GET", `/services/${params.serviceId}`, undefined, queryParams);
  const s = res.service;
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    status: s.status,
    escalationPolicy: { id: s.escalation_policy?.id, name: s.escalation_policy?.summary },
    teams: s.teams?.map((t: any) => ({ id: t.id, name: t.summary })),
    integrations: s.integrations?.map((i: any) => ({ id: i.id, name: i.name, type: i.type })),
    alertCreation: s.alert_creation,
    alertGrouping: s.alert_grouping_parameters,
    autoResolveTimeout: s.auto_resolve_timeout,
    acknowledgementTimeout: s.acknowledgement_timeout,
    createdAt: s.created_at,
    htmlUrl: s.html_url,
  };
}

async function createService(params: {
  name: string;
  description?: string;
  escalationPolicyId: string;
  alertCreation?: string;
  alertGrouping?: string;
  alertGroupingTimeout?: number;
  autoResolveTimeout?: number;
  acknowledgementTimeout?: number;
}): Promise<any> {
  const service: any = {
    type: "service",
    name: params.name,
    escalation_policy: { id: params.escalationPolicyId, type: "escalation_policy_reference" },
  };
  if (params.description) service.description = params.description;
  if (params.alertCreation) service.alert_creation = params.alertCreation;
  if (params.alertGrouping) {
    service.alert_grouping_parameters = { type: params.alertGrouping };
    if (params.alertGroupingTimeout && params.alertGrouping === "time") {
      service.alert_grouping_parameters.config = { timeout: params.alertGroupingTimeout };
    }
  }
  if (params.autoResolveTimeout !== undefined) service.auto_resolve_timeout = params.autoResolveTimeout;
  if (params.acknowledgementTimeout !== undefined) service.acknowledgement_timeout = params.acknowledgementTimeout;

  const res = await pagerdutyRequest("POST", "/services", { service });
  return { id: res.service.id, name: res.service.name, status: res.service.status, htmlUrl: res.service.html_url };
}

async function updateService(params: {
  serviceId: string;
  name?: string;
  description?: string;
  escalationPolicyId?: string;
  alertCreation?: string;
  alertGrouping?: string;
  alertGroupingTimeout?: number;
  status?: string;
}): Promise<any> {
  const service: any = { type: "service" };
  if (params.name) service.name = params.name;
  if (params.description) service.description = params.description;
  if (params.escalationPolicyId) service.escalation_policy = { id: params.escalationPolicyId, type: "escalation_policy_reference" };
  if (params.alertCreation) service.alert_creation = params.alertCreation;
  if (params.alertGrouping) {
    service.alert_grouping_parameters = { type: params.alertGrouping };
    if (params.alertGroupingTimeout && params.alertGrouping === "time") {
      service.alert_grouping_parameters.config = { timeout: params.alertGroupingTimeout };
    }
  }
  if (params.status) service.status = params.status;

  const res = await pagerdutyRequest("PUT", `/services/${params.serviceId}`, { service });
  return { id: res.service.id, name: res.service.name, status: res.service.status, updated: true };
}

// Escalation Policies
async function listEscalationPolicies(params: {
  query?: string;
  teamIds?: string[];
  userIds?: string[];
  include?: string[];
  limit?: number;
  offset?: number;
}): Promise<any> {
  const queryParams: Record<string, string> = {};
  if (params.query) queryParams.query = params.query;
  if (params.teamIds?.length) queryParams["team_ids[]"] = params.teamIds.join(",");
  if (params.userIds?.length) queryParams["user_ids[]"] = params.userIds.join(",");
  if (params.include?.length) queryParams["include[]"] = params.include.join(",");
  if (params.limit) queryParams.limit = String(params.limit);
  if (params.offset) queryParams.offset = String(params.offset);

  const res = await pagerdutyRequest("GET", "/escalation_policies", undefined, queryParams);
  return {
    escalationPolicies: res.escalation_policies?.map((ep: any) => ({
      id: ep.id,
      name: ep.name,
      description: ep.description,
      numLoops: ep.num_loops,
      onCallHandoffNotifications: ep.on_call_handoff_notifications,
      escalationRules: ep.escalation_rules?.map((r: any) => ({
        id: r.id,
        escalationDelayInMinutes: r.escalation_delay_in_minutes,
        targets: r.targets?.map((t: any) => ({ id: t.id, type: t.type, name: t.summary })),
      })),
      teams: ep.teams?.map((t: any) => ({ id: t.id, name: t.summary })),
      services: ep.services?.map((s: any) => ({ id: s.id, name: s.summary })),
    })),
    total: res.total,
    more: res.more,
  };
}

async function getEscalationPolicy(params: { escalationPolicyId: string; include?: string[] }): Promise<any> {
  const queryParams: Record<string, string> = {};
  if (params.include?.length) queryParams["include[]"] = params.include.join(",");

  const res = await pagerdutyRequest("GET", `/escalation_policies/${params.escalationPolicyId}`, undefined, queryParams);
  const ep = res.escalation_policy;
  return {
    id: ep.id,
    name: ep.name,
    description: ep.description,
    numLoops: ep.num_loops,
    onCallHandoffNotifications: ep.on_call_handoff_notifications,
    escalationRules: ep.escalation_rules?.map((r: any) => ({
      id: r.id,
      escalationDelayInMinutes: r.escalation_delay_in_minutes,
      targets: r.targets?.map((t: any) => ({ id: t.id, type: t.type, name: t.summary })),
    })),
    teams: ep.teams?.map((t: any) => ({ id: t.id, name: t.summary })),
    services: ep.services?.map((s: any) => ({ id: s.id, name: s.summary })),
  };
}

// Schedules
async function listSchedules(params: {
  query?: string;
  include?: string[];
  limit?: number;
  offset?: number;
}): Promise<any> {
  const queryParams: Record<string, string> = {};
  if (params.query) queryParams.query = params.query;
  if (params.include?.length) queryParams["include[]"] = params.include.join(",");
  if (params.limit) queryParams.limit = String(params.limit);
  if (params.offset) queryParams.offset = String(params.offset);

  const res = await pagerdutyRequest("GET", "/schedules", undefined, queryParams);
  return {
    schedules: res.schedules?.map((s: any) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      timeZone: s.time_zone,
      users: s.users?.map((u: any) => ({ id: u.id, name: u.summary })),
      escalationPolicies: s.escalation_policies?.map((ep: any) => ({ id: ep.id, name: ep.summary })),
    })),
    total: res.total,
    more: res.more,
  };
}

async function getSchedule(params: {
  scheduleId: string;
  since?: string;
  until?: string;
  include?: string[];
}): Promise<any> {
  const queryParams: Record<string, string> = {};
  if (params.since) queryParams.since = params.since;
  if (params.until) queryParams.until = params.until;
  if (params.include?.length) queryParams["include[]"] = params.include.join(",");

  const res = await pagerdutyRequest("GET", `/schedules/${params.scheduleId}`, undefined, queryParams);
  const s = res.schedule;
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    timeZone: s.time_zone,
    users: s.users?.map((u: any) => ({ id: u.id, name: u.summary })),
    escalationPolicies: s.escalation_policies?.map((ep: any) => ({ id: ep.id, name: ep.summary })),
    scheduleLayers: s.schedule_layers?.map((l: any) => ({
      id: l.id,
      name: l.name,
      start: l.start,
      end: l.end,
      rotationVirtualStart: l.rotation_virtual_start,
      rotationTurnLengthSeconds: l.rotation_turn_length_seconds,
      users: l.users?.map((u: any) => ({ id: u.user?.id, name: u.user?.summary })),
    })),
    finalSchedule: s.final_schedule?.rendered_schedule_entries?.map((e: any) => ({
      start: e.start,
      end: e.end,
      user: { id: e.user?.id, name: e.user?.summary },
    })),
    overridesSubschedule: s.overrides_subschedule?.rendered_schedule_entries?.map((e: any) => ({
      start: e.start,
      end: e.end,
      user: { id: e.user?.id, name: e.user?.summary },
    })),
  };
}

async function listScheduleOverrides(params: {
  scheduleId: string;
  since: string;
  until: string;
  editable?: boolean;
  overflow?: boolean;
}): Promise<any> {
  const queryParams: Record<string, string> = {
    since: params.since,
    until: params.until,
  };
  if (params.editable !== undefined) queryParams.editable = String(params.editable);
  if (params.overflow !== undefined) queryParams.overflow = String(params.overflow);

  const res = await pagerdutyRequest("GET", `/schedules/${params.scheduleId}/overrides`, undefined, queryParams);
  return {
    overrides: res.overrides?.map((o: any) => ({
      id: o.id,
      start: o.start,
      end: o.end,
      user: { id: o.user?.id, name: o.user?.summary },
    })),
    total: res.total,
  };
}

async function createScheduleOverride(params: {
  scheduleId: string;
  userId: string;
  start: string;
  end: string;
}): Promise<any> {
  const override = {
    start: params.start,
    end: params.end,
    user: { id: params.userId, type: "user_reference" },
  };

  const res = await pagerdutyRequest("POST", `/schedules/${params.scheduleId}/overrides`, { override });
  return { id: res.override.id, start: res.override.start, end: res.override.end, user: res.override.user?.summary };
}

async function deleteScheduleOverride(params: { scheduleId: string; overrideId: string }): Promise<any> {
  await pagerdutyRequest("DELETE", `/schedules/${params.scheduleId}/overrides/${params.overrideId}`);
  return { deleted: true, overrideId: params.overrideId };
}

// Users
async function listUsers(params: {
  query?: string;
  teamIds?: string[];
  include?: string[];
  limit?: number;
  offset?: number;
}): Promise<any> {
  const queryParams: Record<string, string> = {};
  if (params.query) queryParams.query = params.query;
  if (params.teamIds?.length) queryParams["team_ids[]"] = params.teamIds.join(",");
  if (params.include?.length) queryParams["include[]"] = params.include.join(",");
  if (params.limit) queryParams.limit = String(params.limit);
  if (params.offset) queryParams.offset = String(params.offset);

  const res = await pagerdutyRequest("GET", "/users", undefined, queryParams);
  return {
    users: res.users?.map((u: any) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      jobTitle: u.job_title,
      timeZone: u.time_zone,
      teams: u.teams?.map((t: any) => ({ id: t.id, name: t.summary })),
      contactMethods: u.contact_methods?.map((c: any) => ({ id: c.id, type: c.type, address: c.address })),
    })),
    total: res.total,
    more: res.more,
  };
}

async function getUser(params: { userId: string; include?: string[] }): Promise<any> {
  const queryParams: Record<string, string> = {};
  if (params.include?.length) queryParams["include[]"] = params.include.join(",");

  const res = await pagerdutyRequest("GET", `/users/${params.userId}`, undefined, queryParams);
  const u = res.user;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    jobTitle: u.job_title,
    description: u.description,
    timeZone: u.time_zone,
    color: u.color,
    avatarUrl: u.avatar_url,
    teams: u.teams?.map((t: any) => ({ id: t.id, name: t.summary })),
    contactMethods: u.contact_methods?.map((c: any) => ({ id: c.id, type: c.type, address: c.address, label: c.label })),
    notificationRules: u.notification_rules?.map((n: any) => ({
      id: n.id,
      urgency: n.urgency,
      startDelayInMinutes: n.start_delay_in_minutes,
      contactMethod: { id: n.contact_method?.id, type: n.contact_method?.type },
    })),
  };
}

async function getUserOncall(params: {
  userId: string;
  since?: string;
  until?: string;
  earliest?: boolean;
  include?: string[];
}): Promise<any> {
  const queryParams: Record<string, string> = {};
  if (params.since) queryParams.since = params.since;
  if (params.until) queryParams.until = params.until;
  if (params.earliest !== undefined) queryParams.earliest = String(params.earliest);
  if (params.include?.length) queryParams["include[]"] = params.include.join(",");

  const res = await pagerdutyRequest("GET", `/users/${params.userId}/oncalls`, undefined, queryParams);
  return {
    oncalls: res.oncalls?.map((o: any) => ({
      escalationPolicy: { id: o.escalation_policy?.id, name: o.escalation_policy?.summary },
      schedule: o.schedule ? { id: o.schedule?.id, name: o.schedule?.summary } : null,
      escalationLevel: o.escalation_level,
      start: o.start,
      end: o.end,
    })),
  };
}

async function listOncalls(params: {
  since?: string;
  until?: string;
  scheduleIds?: string[];
  userIds?: string[];
  escalationPolicyIds?: string[];
  earliest?: boolean;
  include?: string[];
}): Promise<any> {
  const queryParams: Record<string, string> = {};
  if (params.since) queryParams.since = params.since;
  if (params.until) queryParams.until = params.until;
  if (params.scheduleIds?.length) queryParams["schedule_ids[]"] = params.scheduleIds.join(",");
  if (params.userIds?.length) queryParams["user_ids[]"] = params.userIds.join(",");
  if (params.escalationPolicyIds?.length) queryParams["escalation_policy_ids[]"] = params.escalationPolicyIds.join(",");
  if (params.earliest !== undefined) queryParams.earliest = String(params.earliest);
  if (params.include?.length) queryParams["include[]"] = params.include.join(",");

  const res = await pagerdutyRequest("GET", "/oncalls", undefined, queryParams);
  return {
    oncalls: res.oncalls?.map((o: any) => ({
      user: { id: o.user?.id, name: o.user?.summary },
      escalationPolicy: { id: o.escalation_policy?.id, name: o.escalation_policy?.summary },
      schedule: o.schedule ? { id: o.schedule?.id, name: o.schedule?.summary } : null,
      escalationLevel: o.escalation_level,
      start: o.start,
      end: o.end,
    })),
  };
}

// Teams
async function listTeams(params: {
  query?: string;
  limit?: number;
  offset?: number;
}): Promise<any> {
  const queryParams: Record<string, string> = {};
  if (params.query) queryParams.query = params.query;
  if (params.limit) queryParams.limit = String(params.limit);
  if (params.offset) queryParams.offset = String(params.offset);

  const res = await pagerdutyRequest("GET", "/teams", undefined, queryParams);
  return {
    teams: res.teams?.map((t: any) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      parent: t.parent ? { id: t.parent?.id, name: t.parent?.summary } : null,
    })),
    total: res.total,
    more: res.more,
  };
}

async function getTeam(params: { teamId: string; include?: string[] }): Promise<any> {
  const queryParams: Record<string, string> = {};
  if (params.include?.length) queryParams["include[]"] = params.include.join(",");

  const res = await pagerdutyRequest("GET", `/teams/${params.teamId}`, undefined, queryParams);
  const t = res.team;
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    parent: t.parent ? { id: t.parent?.id, name: t.parent?.summary } : null,
    defaultRole: t.default_role,
  };
}

async function listTeamMembers(params: {
  teamId: string;
  limit?: number;
  offset?: number;
}): Promise<any> {
  const queryParams: Record<string, string> = {};
  if (params.limit) queryParams.limit = String(params.limit);
  if (params.offset) queryParams.offset = String(params.offset);

  const res = await pagerdutyRequest("GET", `/teams/${params.teamId}/members`, undefined, queryParams);
  return {
    members: res.members?.map((m: any) => ({
      user: { id: m.user?.id, name: m.user?.summary, email: m.user?.email },
      role: m.role,
    })),
    total: res.total,
    more: res.more,
  };
}

// Alerts
async function listAlerts(params: {
  incidentId: string;
  statuses?: string[];
  sortBy?: string;
  include?: string[];
  limit?: number;
  offset?: number;
}): Promise<any> {
  const queryParams: Record<string, string> = {};
  if (params.statuses?.length) queryParams["statuses[]"] = params.statuses.join(",");
  if (params.sortBy) queryParams.sort_by = params.sortBy;
  if (params.include?.length) queryParams["include[]"] = params.include.join(",");
  if (params.limit) queryParams.limit = String(params.limit);
  if (params.offset) queryParams.offset = String(params.offset);

  const res = await pagerdutyRequest("GET", `/incidents/${params.incidentId}/alerts`, undefined, queryParams);
  return {
    alerts: res.alerts?.map((a: any) => ({
      id: a.id,
      alertKey: a.alert_key,
      status: a.status,
      severity: a.severity,
      summary: a.summary,
      service: { id: a.service?.id, name: a.service?.summary },
      createdAt: a.created_at,
      resolvedAt: a.resolved_at,
      body: a.body,
    })),
    total: res.total,
    more: res.more,
  };
}

async function getAlert(params: { incidentId: string; alertId: string }): Promise<any> {
  const res = await pagerdutyRequest("GET", `/incidents/${params.incidentId}/alerts/${params.alertId}`);
  const a = res.alert;
  return {
    id: a.id,
    alertKey: a.alert_key,
    status: a.status,
    severity: a.severity,
    summary: a.summary,
    service: { id: a.service?.id, name: a.service?.summary },
    createdAt: a.created_at,
    resolvedAt: a.resolved_at,
    body: a.body,
    integration: a.integration ? { id: a.integration?.id, name: a.integration?.summary } : null,
  };
}

async function updateAlert(params: { incidentId: string; alertId: string; status: string }): Promise<any> {
  const alert = { type: "alert", status: params.status };
  const res = await pagerdutyRequest("PUT", `/incidents/${params.incidentId}/alerts/${params.alertId}`, { alert });
  return { id: res.alert.id, status: res.alert.status, updated: true };
}

// Priorities
async function listPriorities(): Promise<any> {
  const res = await pagerdutyRequest("GET", "/priorities");
  return {
    priorities: res.priorities?.map((p: any) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      order: p.order,
      color: p.color,
    })),
  };
}

// Create server
const server = new Server(
  {
    name: "pagerduty-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

// Call tool
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: any;

    switch (name) {
      // Incidents
      case "list_incidents":
        result = await listIncidents(args as any);
        break;
      case "get_incident":
        result = await getIncident(args as any);
        break;
      case "create_incident":
        result = await createIncident(args as any);
        break;
      case "update_incident":
        result = await updateIncident(args as any);
        break;
      case "resolve_incident":
        result = await resolveIncident(args as any);
        break;
      case "merge_incidents":
        result = await mergeIncidents(args as any);
        break;
      case "add_incident_note":
        result = await addIncidentNote(args as any);
        break;
      case "list_incident_notes":
        result = await listIncidentNotes(args as any);
        break;

      // Services
      case "list_services":
        result = await listServices(args as any);
        break;
      case "get_service":
        result = await getService(args as any);
        break;
      case "create_service":
        result = await createService(args as any);
        break;
      case "update_service":
        result = await updateService(args as any);
        break;

      // Escalation Policies
      case "list_escalation_policies":
        result = await listEscalationPolicies(args as any);
        break;
      case "get_escalation_policy":
        result = await getEscalationPolicy(args as any);
        break;

      // Schedules
      case "list_schedules":
        result = await listSchedules(args as any);
        break;
      case "get_schedule":
        result = await getSchedule(args as any);
        break;
      case "list_schedule_overrides":
        result = await listScheduleOverrides(args as any);
        break;
      case "create_schedule_override":
        result = await createScheduleOverride(args as any);
        break;
      case "delete_schedule_override":
        result = await deleteScheduleOverride(args as any);
        break;

      // Users
      case "list_users":
        result = await listUsers(args as any);
        break;
      case "get_user":
        result = await getUser(args as any);
        break;
      case "get_user_oncall":
        result = await getUserOncall(args as any);
        break;
      case "list_oncalls":
        result = await listOncalls(args as any);
        break;

      // Teams
      case "list_teams":
        result = await listTeams(args as any);
        break;
      case "get_team":
        result = await getTeam(args as any);
        break;
      case "list_team_members":
        result = await listTeamMembers(args as any);
        break;

      // Alerts
      case "list_alerts":
        result = await listAlerts(args as any);
        break;
      case "get_alert":
        result = await getAlert(args as any);
        break;
      case "update_alert":
        result = await updateAlert(args as any);
        break;

      // Priorities
      case "list_priorities":
        result = await listPriorities();
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

// Start
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("PagerDuty MCP Server started");
}

main().catch(console.error);
