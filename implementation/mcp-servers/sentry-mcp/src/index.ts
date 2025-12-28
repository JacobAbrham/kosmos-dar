/**
 * Sentry MCP Server - Error tracking and monitoring for KOSMOS agents
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";

const config = {
  endpoint: process.env.SENTRY_URL || "https://sentry.io",
  authToken: process.env.SENTRY_AUTH_TOKEN || "",
  organization: process.env.SENTRY_ORG || "",
};

async function sentryRequest(method: string, path: string, body?: any): Promise<any> {
  const res = await fetch(`${config.endpoint}/api/0${path}`, {
    method,
    headers: { "Authorization": `Bearer ${config.authToken}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || res.statusText);
  }
  return res.status === 204 ? {} : res.json();
}

const TOOLS: Tool[] = [
  // Issues
  { name: "list_issues", description: "List issues for a project.", inputSchema: { type: "object", properties: { project: { type: "string" }, query: { type: "string" }, statsPeriod: { type: "string" }, cursor: { type: "string" } }, required: ["project"] } },
  { name: "get_issue", description: "Get issue details.", inputSchema: { type: "object", properties: { issueId: { type: "string" } }, required: ["issueId"] } },
  { name: "update_issue", description: "Update an issue.", inputSchema: { type: "object", properties: { issueId: { type: "string" }, status: { type: "string", enum: ["resolved", "resolvedInNextRelease", "unresolved", "ignored"] }, assignedTo: { type: "string" }, hasSeen: { type: "boolean" }, isBookmarked: { type: "boolean" } }, required: ["issueId"] } },
  { name: "delete_issue", description: "Delete an issue.", inputSchema: { type: "object", properties: { issueId: { type: "string" } }, required: ["issueId"] } },
  { name: "list_issue_events", description: "List events for an issue.", inputSchema: { type: "object", properties: { issueId: { type: "string" }, full: { type: "boolean" } }, required: ["issueId"] } },
  { name: "get_latest_event", description: "Get latest event for an issue.", inputSchema: { type: "object", properties: { issueId: { type: "string" } }, required: ["issueId"] } },
  // Events
  { name: "list_events", description: "List events for a project.", inputSchema: { type: "object", properties: { project: { type: "string" }, query: { type: "string" }, statsPeriod: { type: "string" } }, required: ["project"] } },
  { name: "get_event", description: "Get event details.", inputSchema: { type: "object", properties: { project: { type: "string" }, eventId: { type: "string" } }, required: ["project", "eventId"] } },
  // Projects
  { name: "list_projects", description: "List all projects.", inputSchema: { type: "object", properties: {} } },
  { name: "get_project", description: "Get project details.", inputSchema: { type: "object", properties: { project: { type: "string" } }, required: ["project"] } },
  { name: "create_project", description: "Create a project.", inputSchema: { type: "object", properties: { name: { type: "string" }, slug: { type: "string" }, team: { type: "string" }, platform: { type: "string" } }, required: ["name", "team"] } },
  { name: "delete_project", description: "Delete a project.", inputSchema: { type: "object", properties: { project: { type: "string" } }, required: ["project"] } },
  { name: "get_project_stats", description: "Get project statistics.", inputSchema: { type: "object", properties: { project: { type: "string" }, stat: { type: "string", enum: ["received", "rejected", "blacklisted", "generated"] }, since: { type: "number" }, until: { type: "number" }, resolution: { type: "string" } }, required: ["project"] } },
  // Releases
  { name: "list_releases", description: "List releases.", inputSchema: { type: "object", properties: { project: { type: "string" } } } },
  { name: "get_release", description: "Get release details.", inputSchema: { type: "object", properties: { version: { type: "string" } }, required: ["version"] } },
  { name: "create_release", description: "Create a release.", inputSchema: { type: "object", properties: { version: { type: "string" }, projects: { type: "array", items: { type: "string" } }, ref: { type: "string" }, dateReleased: { type: "string" } }, required: ["version", "projects"] } },
  { name: "delete_release", description: "Delete a release.", inputSchema: { type: "object", properties: { version: { type: "string" } }, required: ["version"] } },
  // Deploys
  { name: "list_deploys", description: "List deploys for a release.", inputSchema: { type: "object", properties: { version: { type: "string" } }, required: ["version"] } },
  { name: "create_deploy", description: "Create a deploy.", inputSchema: { type: "object", properties: { version: { type: "string" }, environment: { type: "string" }, name: { type: "string" }, url: { type: "string" }, dateStarted: { type: "string" }, dateFinished: { type: "string" } }, required: ["version", "environment"] } },
  // Teams
  { name: "list_teams", description: "List teams.", inputSchema: { type: "object", properties: {} } },
  { name: "get_team", description: "Get team details.", inputSchema: { type: "object", properties: { team: { type: "string" } }, required: ["team"] } },
  { name: "create_team", description: "Create a team.", inputSchema: { type: "object", properties: { name: { type: "string" }, slug: { type: "string" } }, required: ["name"] } },
  // Users
  { name: "list_org_members", description: "List organization members.", inputSchema: { type: "object", properties: {} } },
  { name: "get_org_member", description: "Get organization member.", inputSchema: { type: "object", properties: { memberId: { type: "string" } }, required: ["memberId"] } },
  // Alerts
  { name: "list_alerts", description: "List alert rules.", inputSchema: { type: "object", properties: { project: { type: "string" } }, required: ["project"] } },
  // Performance
  { name: "get_transaction_stats", description: "Get transaction statistics.", inputSchema: { type: "object", properties: { project: { type: "string" }, transaction: { type: "string" }, statsPeriod: { type: "string" }, interval: { type: "string" } }, required: ["project"] } },
];

async function listIssues(params: { project: string; query?: string; statsPeriod?: string; cursor?: string }): Promise<any> {
  const query = new URLSearchParams();
  if (params.query) query.set("query", params.query);
  if (params.statsPeriod) query.set("statsPeriod", params.statsPeriod);
  if (params.cursor) query.set("cursor", params.cursor);
  const queryStr = query.toString() ? `?${query}` : "";
  return sentryRequest("GET", `/projects/${config.organization}/${params.project}/issues/${queryStr}`);
}

async function getIssue(params: { issueId: string }): Promise<any> {
  return sentryRequest("GET", `/issues/${params.issueId}/`);
}

async function updateIssue(params: { issueId: string; status?: string; assignedTo?: string; hasSeen?: boolean; isBookmarked?: boolean }): Promise<any> {
  const body: any = {};
  if (params.status) body.status = params.status;
  if (params.assignedTo) body.assignedTo = params.assignedTo;
  if (params.hasSeen !== undefined) body.hasSeen = params.hasSeen;
  if (params.isBookmarked !== undefined) body.isBookmarked = params.isBookmarked;
  return sentryRequest("PUT", `/issues/${params.issueId}/`, body);
}

async function deleteIssue(params: { issueId: string }): Promise<any> {
  await sentryRequest("DELETE", `/issues/${params.issueId}/`);
  return { issueId: params.issueId, deleted: true };
}

async function listIssueEvents(params: { issueId: string; full?: boolean }): Promise<any> {
  const query = params.full ? "?full=true" : "";
  return sentryRequest("GET", `/issues/${params.issueId}/events/${query}`);
}

async function getLatestEvent(params: { issueId: string }): Promise<any> {
  return sentryRequest("GET", `/issues/${params.issueId}/events/latest/`);
}

async function listEvents(params: { project: string; query?: string; statsPeriod?: string }): Promise<any> {
  const query = new URLSearchParams();
  if (params.query) query.set("query", params.query);
  if (params.statsPeriod) query.set("statsPeriod", params.statsPeriod);
  const queryStr = query.toString() ? `?${query}` : "";
  return sentryRequest("GET", `/projects/${config.organization}/${params.project}/events/${queryStr}`);
}

async function getEvent(params: { project: string; eventId: string }): Promise<any> {
  return sentryRequest("GET", `/projects/${config.organization}/${params.project}/events/${params.eventId}/`);
}

async function listProjects(): Promise<any> {
  return sentryRequest("GET", `/organizations/${config.organization}/projects/`);
}

async function getProject(params: { project: string }): Promise<any> {
  return sentryRequest("GET", `/projects/${config.organization}/${params.project}/`);
}

async function createProject(params: { name: string; slug?: string; team: string; platform?: string }): Promise<any> {
  return sentryRequest("POST", `/teams/${config.organization}/${params.team}/projects/`, {
    name: params.name,
    slug: params.slug,
    platform: params.platform,
  });
}

async function deleteProject(params: { project: string }): Promise<any> {
  await sentryRequest("DELETE", `/projects/${config.organization}/${params.project}/`);
  return { project: params.project, deleted: true };
}

async function getProjectStats(params: { project: string; stat?: string; since?: number; until?: number; resolution?: string }): Promise<any> {
  const query = new URLSearchParams();
  if (params.stat) query.set("stat", params.stat);
  if (params.since) query.set("since", params.since.toString());
  if (params.until) query.set("until", params.until.toString());
  if (params.resolution) query.set("resolution", params.resolution);
  return sentryRequest("GET", `/projects/${config.organization}/${params.project}/stats/?${query}`);
}

async function listReleases(params: { project?: string }): Promise<any> {
  const path = params.project ? `/projects/${config.organization}/${params.project}/releases/` : `/organizations/${config.organization}/releases/`;
  return sentryRequest("GET", path);
}

async function getRelease(params: { version: string }): Promise<any> {
  return sentryRequest("GET", `/organizations/${config.organization}/releases/${encodeURIComponent(params.version)}/`);
}

async function createRelease(params: { version: string; projects: string[]; ref?: string; dateReleased?: string }): Promise<any> {
  return sentryRequest("POST", `/organizations/${config.organization}/releases/`, {
    version: params.version,
    projects: params.projects,
    ref: params.ref,
    dateReleased: params.dateReleased,
  });
}

async function deleteRelease(params: { version: string }): Promise<any> {
  await sentryRequest("DELETE", `/organizations/${config.organization}/releases/${encodeURIComponent(params.version)}/`);
  return { version: params.version, deleted: true };
}

async function listDeploys(params: { version: string }): Promise<any> {
  return sentryRequest("GET", `/organizations/${config.organization}/releases/${encodeURIComponent(params.version)}/deploys/`);
}

async function createDeploy(params: { version: string; environment: string; name?: string; url?: string; dateStarted?: string; dateFinished?: string }): Promise<any> {
  return sentryRequest("POST", `/organizations/${config.organization}/releases/${encodeURIComponent(params.version)}/deploys/`, {
    environment: params.environment,
    name: params.name,
    url: params.url,
    dateStarted: params.dateStarted,
    dateFinished: params.dateFinished,
  });
}

async function listTeams(): Promise<any> {
  return sentryRequest("GET", `/organizations/${config.organization}/teams/`);
}

async function getTeam(params: { team: string }): Promise<any> {
  return sentryRequest("GET", `/teams/${config.organization}/${params.team}/`);
}

async function createTeam(params: { name: string; slug?: string }): Promise<any> {
  return sentryRequest("POST", `/organizations/${config.organization}/teams/`, { name: params.name, slug: params.slug });
}

async function listOrgMembers(): Promise<any> {
  return sentryRequest("GET", `/organizations/${config.organization}/members/`);
}

async function getOrgMember(params: { memberId: string }): Promise<any> {
  return sentryRequest("GET", `/organizations/${config.organization}/members/${params.memberId}/`);
}

async function listAlerts(params: { project: string }): Promise<any> {
  return sentryRequest("GET", `/projects/${config.organization}/${params.project}/rules/`);
}

async function getTransactionStats(params: { project: string; transaction?: string; statsPeriod?: string; interval?: string }): Promise<any> {
  const query = new URLSearchParams();
  if (params.transaction) query.set("transaction", params.transaction);
  if (params.statsPeriod) query.set("statsPeriod", params.statsPeriod);
  if (params.interval) query.set("interval", params.interval);
  query.set("field", "p50()");
  query.append("field", "p95()");
  query.append("field", "count()");
  return sentryRequest("GET", `/organizations/${config.organization}/events-stats/?project=${params.project}&${query}`);
}

const server = new Server({ name: "sentry-mcp", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result: any;
    switch (name) {
      case "list_issues": result = await listIssues(args as any); break;
      case "get_issue": result = await getIssue(args as any); break;
      case "update_issue": result = await updateIssue(args as any); break;
      case "delete_issue": result = await deleteIssue(args as any); break;
      case "list_issue_events": result = await listIssueEvents(args as any); break;
      case "get_latest_event": result = await getLatestEvent(args as any); break;
      case "list_events": result = await listEvents(args as any); break;
      case "get_event": result = await getEvent(args as any); break;
      case "list_projects": result = await listProjects(); break;
      case "get_project": result = await getProject(args as any); break;
      case "create_project": result = await createProject(args as any); break;
      case "delete_project": result = await deleteProject(args as any); break;
      case "get_project_stats": result = await getProjectStats(args as any); break;
      case "list_releases": result = await listReleases(args as any); break;
      case "get_release": result = await getRelease(args as any); break;
      case "create_release": result = await createRelease(args as any); break;
      case "delete_release": result = await deleteRelease(args as any); break;
      case "list_deploys": result = await listDeploys(args as any); break;
      case "create_deploy": result = await createDeploy(args as any); break;
      case "list_teams": result = await listTeams(); break;
      case "get_team": result = await getTeam(args as any); break;
      case "create_team": result = await createTeam(args as any); break;
      case "list_org_members": result = await listOrgMembers(); break;
      case "get_org_member": result = await getOrgMember(args as any); break;
      case "list_alerts": result = await listAlerts(args as any); break;
      case "get_transaction_stats": result = await getTransactionStats(args as any); break;
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
  console.error("Sentry MCP Server running on stdio");
}

main().catch(console.error);
