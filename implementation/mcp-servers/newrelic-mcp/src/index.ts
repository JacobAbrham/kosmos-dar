/**
 * New Relic MCP Server - APM, infrastructure, alerts, synthetics, and observability for KOSMOS agents
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";

const config = {
  apiKey: process.env.NEWRELIC_API_KEY || "",
  accountId: process.env.NEWRELIC_ACCOUNT_ID || "",
  region: process.env.NEWRELIC_REGION || "US", // US or EU
};

function getApiUrl(): string {
  return config.region === "EU" ? "https://api.eu.newrelic.com" : "https://api.newrelic.com";
}

function getGraphqlUrl(): string {
  return config.region === "EU" ? "https://api.eu.newrelic.com/graphql" : "https://api.newrelic.com/graphql";
}

function getInfraUrl(): string {
  return config.region === "EU" ? "https://infra-api.eu.newrelic.com" : "https://infra-api.newrelic.com";
}

async function newrelicRequest(method: string, path: string, body?: any): Promise<any> {
  const res = await fetch(`${getApiUrl()}${path}`, {
    method,
    headers: {
      "Api-Key": config.apiKey,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: { title: res.statusText } }));
    throw new Error(error.error?.title || error.errors?.[0]?.message || res.statusText);
  }
  return res.status === 204 ? {} : res.json();
}

async function graphqlRequest(query: string, variables?: Record<string, any>): Promise<any> {
  const res = await fetch(getGraphqlUrl(), {
    method: "POST",
    headers: {
      "Api-Key": config.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ errors: [{ message: res.statusText }] }));
    throw new Error(error.errors?.[0]?.message || res.statusText);
  }
  const data = await res.json();
  if (data.errors && data.errors.length > 0) {
    throw new Error(data.errors[0].message);
  }
  return data.data;
}

async function infraRequest(method: string, path: string, body?: any): Promise<any> {
  const res = await fetch(`${getInfraUrl()}${path}`, {
    method,
    headers: {
      "Api-Key": config.apiKey,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || res.statusText);
  }
  return res.status === 204 ? {} : res.json();
}

// ============================================================================
// TOOLS DEFINITION
// ============================================================================

const TOOLS: Tool[] = [
  // ---- NRQL Query ----
  {
    name: "nrql_query",
    description: "Execute a NRQL (New Relic Query Language) query to retrieve data from New Relic.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "NRQL query string (e.g., 'SELECT count(*) FROM Transaction SINCE 1 hour ago')" },
        accountId: { type: "string", description: "Account ID (uses default if not specified)" },
      },
      required: ["query"],
    },
  },

  // ---- Accounts ----
  {
    name: "list_accounts",
    description: "List all New Relic accounts accessible with the current API key.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },

  // ---- APM Applications ----
  {
    name: "list_applications",
    description: "List all APM applications.",
    inputSchema: {
      type: "object",
      properties: {
        filter: { type: "string", description: "Filter by application name" },
        language: { type: "string", description: "Filter by language (e.g., 'java', 'python', 'nodejs')" },
        healthStatus: { type: "string", enum: ["green", "orange", "red", "gray"], description: "Filter by health status" },
        page: { type: "number", description: "Page number" },
      },
    },
  },
  {
    name: "get_application",
    description: "Get detailed information about a specific APM application.",
    inputSchema: {
      type: "object",
      properties: {
        applicationId: { type: "number", description: "Application ID" },
      },
      required: ["applicationId"],
    },
  },

  // ---- Infrastructure Hosts ----
  {
    name: "list_hosts",
    description: "List infrastructure hosts.",
    inputSchema: {
      type: "object",
      properties: {
        filter: { type: "string", description: "Filter hosts by name or tag" },
        limit: { type: "number", description: "Maximum number of hosts to return" },
      },
    },
  },
  {
    name: "get_host",
    description: "Get detailed information about a specific infrastructure host.",
    inputSchema: {
      type: "object",
      properties: {
        hostId: { type: "string", description: "Host ID" },
      },
      required: ["hostId"],
    },
  },

  // ---- Alert Policies ----
  {
    name: "list_alert_policies",
    description: "List all alert policies.",
    inputSchema: {
      type: "object",
      properties: {
        filter: { type: "string", description: "Filter by policy name" },
        page: { type: "number", description: "Page number" },
      },
    },
  },
  {
    name: "get_alert_policy",
    description: "Get details of a specific alert policy.",
    inputSchema: {
      type: "object",
      properties: {
        policyId: { type: "number", description: "Policy ID" },
      },
      required: ["policyId"],
    },
  },
  {
    name: "create_alert_policy",
    description: "Create a new alert policy.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Policy name" },
        incidentPreference: {
          type: "string",
          enum: ["PER_POLICY", "PER_CONDITION", "PER_CONDITION_AND_TARGET"],
          description: "Incident preference for the policy"
        },
      },
      required: ["name"],
    },
  },

  // ---- Alert Conditions ----
  {
    name: "list_alert_conditions",
    description: "List alert conditions for a policy.",
    inputSchema: {
      type: "object",
      properties: {
        policyId: { type: "number", description: "Policy ID" },
        page: { type: "number", description: "Page number" },
      },
      required: ["policyId"],
    },
  },

  // ---- Incidents ----
  {
    name: "list_incidents",
    description: "List open incidents.",
    inputSchema: {
      type: "object",
      properties: {
        onlyOpen: { type: "boolean", description: "Only return open incidents (default: true)" },
        page: { type: "number", description: "Page number" },
      },
    },
  },
  {
    name: "get_incident",
    description: "Get details of a specific incident.",
    inputSchema: {
      type: "object",
      properties: {
        incidentId: { type: "number", description: "Incident ID" },
      },
      required: ["incidentId"],
    },
  },
  {
    name: "acknowledge_incident",
    description: "Acknowledge an open incident.",
    inputSchema: {
      type: "object",
      properties: {
        incidentId: { type: "number", description: "Incident ID" },
      },
      required: ["incidentId"],
    },
  },
  {
    name: "close_incident",
    description: "Close an incident.",
    inputSchema: {
      type: "object",
      properties: {
        incidentId: { type: "number", description: "Incident ID" },
      },
      required: ["incidentId"],
    },
  },

  // ---- Dashboards ----
  {
    name: "list_dashboards",
    description: "List all dashboards.",
    inputSchema: {
      type: "object",
      properties: {
        filter: { type: "string", description: "Filter by dashboard name" },
        page: { type: "number", description: "Page number" },
      },
    },
  },
  {
    name: "get_dashboard",
    description: "Get details of a specific dashboard.",
    inputSchema: {
      type: "object",
      properties: {
        dashboardGuid: { type: "string", description: "Dashboard GUID (entity GUID)" },
      },
      required: ["dashboardGuid"],
    },
  },
  {
    name: "create_dashboard",
    description: "Create a new dashboard.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Dashboard name" },
        description: { type: "string", description: "Dashboard description" },
        permissions: { type: "string", enum: ["PUBLIC_READ_ONLY", "PUBLIC_READ_WRITE", "PRIVATE"], description: "Dashboard permissions" },
        pages: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Page name" },
              description: { type: "string", description: "Page description" },
              widgets: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string", description: "Widget title" },
                    visualization: { type: "string", description: "Visualization type (e.g., viz.line, viz.bar, viz.table)" },
                    rawConfiguration: { type: "object", description: "Widget raw configuration including NRQL queries" },
                    layout: {
                      type: "object",
                      properties: {
                        column: { type: "number" },
                        row: { type: "number" },
                        width: { type: "number" },
                        height: { type: "number" }
                      }
                    },
                  },
                },
              },
            },
          },
          description: "Dashboard pages with widgets",
        },
      },
      required: ["name", "pages"],
    },
  },

  // ---- Synthetic Monitors ----
  {
    name: "list_synthetic_monitors",
    description: "List all synthetic monitors.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Maximum number of monitors to return" },
        offset: { type: "number", description: "Offset for pagination" },
      },
    },
  },
  {
    name: "get_monitor_results",
    description: "Get results for a specific synthetic monitor.",
    inputSchema: {
      type: "object",
      properties: {
        monitorId: { type: "string", description: "Monitor ID" },
        from: { type: "string", description: "Start time (ISO 8601)" },
        to: { type: "string", description: "End time (ISO 8601)" },
      },
      required: ["monitorId"],
    },
  },

  // ---- Deployments ----
  {
    name: "list_deployments",
    description: "List deployments for an application.",
    inputSchema: {
      type: "object",
      properties: {
        applicationId: { type: "number", description: "Application ID" },
        page: { type: "number", description: "Page number" },
      },
      required: ["applicationId"],
    },
  },
];

// ============================================================================
// HANDLER FUNCTIONS
// ============================================================================

// ---- NRQL Query ----
async function nrqlQuery(params: { query: string; accountId?: string }): Promise<any> {
  const accountId = params.accountId || config.accountId;
  const query = `
    {
      actor {
        account(id: ${accountId}) {
          nrql(query: "${params.query.replace(/"/g, '\\"')}") {
            results
            metadata {
              eventTypes
              facets
              messages
              timeWindow {
                begin
                end
              }
            }
          }
        }
      }
    }
  `;
  const result = await graphqlRequest(query);
  return result.actor.account.nrql;
}

// ---- Accounts ----
async function listAccounts(): Promise<any> {
  const query = `
    {
      actor {
        accounts {
          id
          name
          reportingEventTypes
        }
      }
    }
  `;
  const result = await graphqlRequest(query);
  return result.actor.accounts;
}

// ---- APM Applications ----
async function listApplications(params: { filter?: string; language?: string; healthStatus?: string; page?: number }): Promise<any> {
  const queryParams = new URLSearchParams();
  if (params.filter) queryParams.set("filter[name]", params.filter);
  if (params.language) queryParams.set("filter[language]", params.language);
  if (params.healthStatus) queryParams.set("filter[health_status]", params.healthStatus);
  if (params.page) queryParams.set("page", params.page.toString());
  const queryStr = queryParams.toString() ? `?${queryParams}` : "";
  return newrelicRequest("GET", `/v2/applications.json${queryStr}`);
}

async function getApplication(params: { applicationId: number }): Promise<any> {
  return newrelicRequest("GET", `/v2/applications/${params.applicationId}.json`);
}

// ---- Infrastructure Hosts ----
async function listHosts(params: { filter?: string; limit?: number }): Promise<any> {
  const accountId = config.accountId;
  let nrqlQuery = "SELECT * FROM SystemSample LIMIT ";
  nrqlQuery += params.limit || 100;
  if (params.filter) {
    nrqlQuery += ` WHERE hostname LIKE '%${params.filter}%'`;
  }
  nrqlQuery += " SINCE 1 hour ago";

  const query = `
    {
      actor {
        account(id: ${accountId}) {
          nrql(query: "${nrqlQuery}") {
            results
          }
        }
      }
    }
  `;
  const result = await graphqlRequest(query);
  return result.actor.account.nrql.results;
}

async function getHost(params: { hostId: string }): Promise<any> {
  const accountId = config.accountId;
  const query = `
    {
      actor {
        entity(guid: "${params.hostId}") {
          ... on InfrastructureHostEntityOutline {
            name
            guid
            reporting
            tags {
              key
              values
            }
            hostSummary {
              cpuUtilizationPercent
              diskUsedPercent
              memoryUsedPercent
              networkReceiveRate
              networkTransmitRate
              servicesCount
            }
          }
        }
      }
    }
  `;
  const result = await graphqlRequest(query);
  return result.actor.entity;
}

// ---- Alert Policies ----
async function listAlertPolicies(params: { filter?: string; page?: number }): Promise<any> {
  const queryParams = new URLSearchParams();
  if (params.filter) queryParams.set("filter[name]", params.filter);
  if (params.page) queryParams.set("page", params.page.toString());
  const queryStr = queryParams.toString() ? `?${queryParams}` : "";
  return newrelicRequest("GET", `/v2/alerts_policies.json${queryStr}`);
}

async function getAlertPolicy(params: { policyId: number }): Promise<any> {
  // New Relic v2 API doesn't have a direct get by ID, so we filter
  const result = await newrelicRequest("GET", `/v2/alerts_policies.json?filter[id]=${params.policyId}`);
  const policy = result.policies?.find((p: any) => p.id === params.policyId);
  if (!policy) {
    throw new Error(`Policy with ID ${params.policyId} not found`);
  }
  return { policy };
}

async function createAlertPolicy(params: { name: string; incidentPreference?: string }): Promise<any> {
  const body = {
    policy: {
      name: params.name,
      incident_preference: params.incidentPreference || "PER_POLICY",
    },
  };
  return newrelicRequest("POST", "/v2/alerts_policies.json", body);
}

// ---- Alert Conditions ----
async function listAlertConditions(params: { policyId: number; page?: number }): Promise<any> {
  const queryParams = new URLSearchParams();
  queryParams.set("policy_id", params.policyId.toString());
  if (params.page) queryParams.set("page", params.page.toString());
  return newrelicRequest("GET", `/v2/alerts_conditions.json?${queryParams}`);
}

// ---- Incidents ----
async function listIncidents(params: { onlyOpen?: boolean; page?: number }): Promise<any> {
  const queryParams = new URLSearchParams();
  if (params.onlyOpen !== false) queryParams.set("only_open", "true");
  if (params.page) queryParams.set("page", params.page.toString());
  const queryStr = queryParams.toString() ? `?${queryParams}` : "";
  return newrelicRequest("GET", `/v2/alerts_incidents.json${queryStr}`);
}

async function getIncident(params: { incidentId: number }): Promise<any> {
  const result = await newrelicRequest("GET", `/v2/alerts_incidents.json`);
  const incident = result.incidents?.find((i: any) => i.id === params.incidentId);
  if (!incident) {
    throw new Error(`Incident with ID ${params.incidentId} not found`);
  }
  return { incident };
}

async function acknowledgeIncident(params: { incidentId: number }): Promise<any> {
  return newrelicRequest("PUT", `/v2/alerts_incidents/${params.incidentId}/acknowledge.json`);
}

async function closeIncident(params: { incidentId: number }): Promise<any> {
  return newrelicRequest("PUT", `/v2/alerts_incidents/${params.incidentId}/close.json`);
}

// ---- Dashboards ----
async function listDashboards(params: { filter?: string; page?: number }): Promise<any> {
  const accountId = config.accountId;
  let searchClause = "";
  if (params.filter) {
    searchClause = `, filter: {name: "${params.filter}"}`;
  }
  const query = `
    {
      actor {
        entitySearch(query: "type = 'DASHBOARD' AND accountId = '${accountId}'") {
          results {
            entities {
              guid
              name
              ... on DashboardEntityOutline {
                owner {
                  email
                  userId
                }
                permissions
                createdAt
                updatedAt
              }
            }
            nextCursor
          }
        }
      }
    }
  `;
  const result = await graphqlRequest(query);
  return result.actor.entitySearch.results;
}

async function getDashboard(params: { dashboardGuid: string }): Promise<any> {
  const query = `
    {
      actor {
        entity(guid: "${params.dashboardGuid}") {
          ... on DashboardEntity {
            guid
            name
            description
            permissions
            createdAt
            updatedAt
            owner {
              email
              userId
            }
            pages {
              guid
              name
              description
              widgets {
                id
                title
                visualization {
                  id
                }
                layout {
                  column
                  row
                  width
                  height
                }
                rawConfiguration
              }
            }
          }
        }
      }
    }
  `;
  const result = await graphqlRequest(query);
  return result.actor.entity;
}

async function createDashboard(params: {
  name: string;
  description?: string;
  permissions?: string;
  pages: Array<{
    name: string;
    description?: string;
    widgets?: Array<{
      title: string;
      visualization: string;
      rawConfiguration: any;
      layout?: { column: number; row: number; width: number; height: number };
    }>;
  }>;
}): Promise<any> {
  const accountId = parseInt(config.accountId);

  const pagesInput = params.pages.map(page => ({
    name: page.name,
    description: page.description || "",
    widgets: (page.widgets || []).map(widget => ({
      title: widget.title,
      visualization: { id: widget.visualization },
      rawConfiguration: widget.rawConfiguration,
      layout: widget.layout || { column: 1, row: 1, width: 4, height: 3 },
    })),
  }));

  const mutation = `
    mutation CreateDashboard($accountId: Int!, $dashboard: DashboardInput!) {
      dashboardCreate(accountId: $accountId, dashboard: $dashboard) {
        entityResult {
          guid
          name
        }
        errors {
          description
          type
        }
      }
    }
  `;

  const variables = {
    accountId,
    dashboard: {
      name: params.name,
      description: params.description || "",
      permissions: params.permissions || "PUBLIC_READ_ONLY",
      pages: pagesInput,
    },
  };

  const result = await graphqlRequest(mutation, variables);

  if (result.dashboardCreate.errors && result.dashboardCreate.errors.length > 0) {
    throw new Error(result.dashboardCreate.errors.map((e: any) => e.description).join(", "));
  }

  return result.dashboardCreate.entityResult;
}

// ---- Synthetic Monitors ----
async function listSyntheticMonitors(params: { limit?: number; offset?: number }): Promise<any> {
  const accountId = config.accountId;
  const query = `
    {
      actor {
        entitySearch(query: "type = 'MONITOR' AND accountId = '${accountId}'") {
          results {
            entities {
              guid
              name
              ... on SyntheticMonitorEntityOutline {
                monitorType
                monitoredUrl
                period
                monitorSummary {
                  status
                  successRate
                  locationsFailing
                  locationsRunning
                }
              }
            }
            nextCursor
          }
        }
      }
    }
  `;
  const result = await graphqlRequest(query);
  return result.actor.entitySearch.results;
}

async function getMonitorResults(params: { monitorId: string; from?: string; to?: string }): Promise<any> {
  const accountId = config.accountId;
  const fromTime = params.from ? `'${params.from}'` : "'1 day ago'";
  const toTime = params.to ? `'${params.to}'` : "'now'";

  const nrqlQuery = `SELECT * FROM SyntheticCheck WHERE monitorId = '${params.monitorId}' SINCE ${fromTime} UNTIL ${toTime} LIMIT 100`;

  const query = `
    {
      actor {
        account(id: ${accountId}) {
          nrql(query: "${nrqlQuery}") {
            results
          }
        }
      }
    }
  `;
  const result = await graphqlRequest(query);
  return result.actor.account.nrql.results;
}

// ---- Deployments ----
async function listDeployments(params: { applicationId: number; page?: number }): Promise<any> {
  const queryParams = new URLSearchParams();
  if (params.page) queryParams.set("page", params.page.toString());
  const queryStr = queryParams.toString() ? `?${queryParams}` : "";
  return newrelicRequest("GET", `/v2/applications/${params.applicationId}/deployments.json${queryStr}`);
}

// ============================================================================
// SERVER SETUP
// ============================================================================

const server = new Server({ name: "newrelic-mcp", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result: any;
    switch (name) {
      // NRQL
      case "nrql_query": result = await nrqlQuery(args as any); break;
      // Accounts
      case "list_accounts": result = await listAccounts(); break;
      // Applications
      case "list_applications": result = await listApplications(args as any); break;
      case "get_application": result = await getApplication(args as any); break;
      // Hosts
      case "list_hosts": result = await listHosts(args as any); break;
      case "get_host": result = await getHost(args as any); break;
      // Alert Policies
      case "list_alert_policies": result = await listAlertPolicies(args as any); break;
      case "get_alert_policy": result = await getAlertPolicy(args as any); break;
      case "create_alert_policy": result = await createAlertPolicy(args as any); break;
      // Alert Conditions
      case "list_alert_conditions": result = await listAlertConditions(args as any); break;
      // Incidents
      case "list_incidents": result = await listIncidents(args as any); break;
      case "get_incident": result = await getIncident(args as any); break;
      case "acknowledge_incident": result = await acknowledgeIncident(args as any); break;
      case "close_incident": result = await closeIncident(args as any); break;
      // Dashboards
      case "list_dashboards": result = await listDashboards(args as any); break;
      case "get_dashboard": result = await getDashboard(args as any); break;
      case "create_dashboard": result = await createDashboard(args as any); break;
      // Synthetic Monitors
      case "list_synthetic_monitors": result = await listSyntheticMonitors(args as any); break;
      case "get_monitor_results": result = await getMonitorResults(args as any); break;
      // Deployments
      case "list_deployments": result = await listDeployments(args as any); break;
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
  console.error("New Relic MCP Server running on stdio");
}

main().catch(console.error);
