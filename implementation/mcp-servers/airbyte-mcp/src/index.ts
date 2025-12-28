/**
 * Airbyte MCP Server - Data integration for KOSMOS
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";

const config = {
  apiUrl: process.env.AIRBYTE_API_URL || "http://localhost:8000/api/v1",
  username: process.env.AIRBYTE_USERNAME || "airbyte",
  password: process.env.AIRBYTE_PASSWORD || "password",
};

async function airbyteRequest(method: string, path: string, body?: any): Promise<any> {
  const auth = Buffer.from(`${config.username}:${config.password}`).toString("base64");
  const res = await fetch(`${config.apiUrl}${path}`, {
    method,
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || res.statusText);
  }

  return res.json();
}

const TOOLS: Tool[] = [
  // Workspaces
  { name: "list_workspaces", description: "List all workspaces.", inputSchema: { type: "object", properties: {} } },
  { name: "get_workspace", description: "Get workspace details.", inputSchema: { type: "object", properties: { workspaceId: { type: "string" } }, required: ["workspaceId"] } },
  // Sources
  { name: "list_sources", description: "List sources in a workspace.", inputSchema: { type: "object", properties: { workspaceId: { type: "string" } }, required: ["workspaceId"] } },
  { name: "get_source", description: "Get source details.", inputSchema: { type: "object", properties: { sourceId: { type: "string" } }, required: ["sourceId"] } },
  { name: "create_source", description: "Create a source.", inputSchema: { type: "object", properties: { workspaceId: { type: "string" }, name: { type: "string" }, sourceDefinitionId: { type: "string" }, connectionConfiguration: { type: "object" } }, required: ["workspaceId", "name", "sourceDefinitionId", "connectionConfiguration"] } },
  { name: "delete_source", description: "Delete a source.", inputSchema: { type: "object", properties: { sourceId: { type: "string" } }, required: ["sourceId"] } },
  { name: "check_source", description: "Check source connection.", inputSchema: { type: "object", properties: { sourceId: { type: "string" } }, required: ["sourceId"] } },
  { name: "discover_schema", description: "Discover source schema.", inputSchema: { type: "object", properties: { sourceId: { type: "string" } }, required: ["sourceId"] } },
  // Destinations
  { name: "list_destinations", description: "List destinations in a workspace.", inputSchema: { type: "object", properties: { workspaceId: { type: "string" } }, required: ["workspaceId"] } },
  { name: "get_destination", description: "Get destination details.", inputSchema: { type: "object", properties: { destinationId: { type: "string" } }, required: ["destinationId"] } },
  { name: "create_destination", description: "Create a destination.", inputSchema: { type: "object", properties: { workspaceId: { type: "string" }, name: { type: "string" }, destinationDefinitionId: { type: "string" }, connectionConfiguration: { type: "object" } }, required: ["workspaceId", "name", "destinationDefinitionId", "connectionConfiguration"] } },
  { name: "delete_destination", description: "Delete a destination.", inputSchema: { type: "object", properties: { destinationId: { type: "string" } }, required: ["destinationId"] } },
  { name: "check_destination", description: "Check destination connection.", inputSchema: { type: "object", properties: { destinationId: { type: "string" } }, required: ["destinationId"] } },
  // Connections
  { name: "list_connections", description: "List connections in a workspace.", inputSchema: { type: "object", properties: { workspaceId: { type: "string" } }, required: ["workspaceId"] } },
  { name: "get_connection", description: "Get connection details.", inputSchema: { type: "object", properties: { connectionId: { type: "string" } }, required: ["connectionId"] } },
  { name: "create_connection", description: "Create a connection.", inputSchema: { type: "object", properties: { sourceId: { type: "string" }, destinationId: { type: "string" }, name: { type: "string" }, namespaceDefinition: { type: "string" }, scheduleType: { type: "string" } }, required: ["sourceId", "destinationId"] } },
  { name: "delete_connection", description: "Delete a connection.", inputSchema: { type: "object", properties: { connectionId: { type: "string" } }, required: ["connectionId"] } },
  { name: "sync_connection", description: "Trigger a sync.", inputSchema: { type: "object", properties: { connectionId: { type: "string" } }, required: ["connectionId"] } },
  { name: "reset_connection", description: "Reset connection data.", inputSchema: { type: "object", properties: { connectionId: { type: "string" } }, required: ["connectionId"] } },
  // Jobs
  { name: "list_jobs", description: "List jobs for a connection.", inputSchema: { type: "object", properties: { connectionId: { type: "string" }, status: { type: "string" } }, required: ["connectionId"] } },
  { name: "get_job", description: "Get job details.", inputSchema: { type: "object", properties: { jobId: { type: "number" } }, required: ["jobId"] } },
  { name: "cancel_job", description: "Cancel a running job.", inputSchema: { type: "object", properties: { jobId: { type: "number" } }, required: ["jobId"] } },
  // Definitions
  { name: "list_source_definitions", description: "List available source definitions.", inputSchema: { type: "object", properties: { workspaceId: { type: "string" } } } },
  { name: "list_destination_definitions", description: "List available destination definitions.", inputSchema: { type: "object", properties: { workspaceId: { type: "string" } } } },
];

async function listWorkspaces(): Promise<any> {
  return airbyteRequest("POST", "/workspaces/list", {});
}

async function getWorkspace(params: { workspaceId: string }): Promise<any> {
  return airbyteRequest("POST", "/workspaces/get", { workspaceId: params.workspaceId });
}

async function listSources(params: { workspaceId: string }): Promise<any> {
  return airbyteRequest("POST", "/sources/list", { workspaceId: params.workspaceId });
}

async function getSource(params: { sourceId: string }): Promise<any> {
  return airbyteRequest("POST", "/sources/get", { sourceId: params.sourceId });
}

async function createSource(params: { workspaceId: string; name: string; sourceDefinitionId: string; connectionConfiguration: any }): Promise<any> {
  return airbyteRequest("POST", "/sources/create", params);
}

async function deleteSource(params: { sourceId: string }): Promise<any> {
  return airbyteRequest("POST", "/sources/delete", { sourceId: params.sourceId });
}

async function checkSource(params: { sourceId: string }): Promise<any> {
  return airbyteRequest("POST", "/sources/check_connection", { sourceId: params.sourceId });
}

async function discoverSchema(params: { sourceId: string }): Promise<any> {
  return airbyteRequest("POST", "/sources/discover_schema", { sourceId: params.sourceId });
}

async function listDestinations(params: { workspaceId: string }): Promise<any> {
  return airbyteRequest("POST", "/destinations/list", { workspaceId: params.workspaceId });
}

async function getDestination(params: { destinationId: string }): Promise<any> {
  return airbyteRequest("POST", "/destinations/get", { destinationId: params.destinationId });
}

async function createDestination(params: { workspaceId: string; name: string; destinationDefinitionId: string; connectionConfiguration: any }): Promise<any> {
  return airbyteRequest("POST", "/destinations/create", params);
}

async function deleteDestination(params: { destinationId: string }): Promise<any> {
  return airbyteRequest("POST", "/destinations/delete", { destinationId: params.destinationId });
}

async function checkDestination(params: { destinationId: string }): Promise<any> {
  return airbyteRequest("POST", "/destinations/check_connection", { destinationId: params.destinationId });
}

async function listConnections(params: { workspaceId: string }): Promise<any> {
  return airbyteRequest("POST", "/connections/list", { workspaceId: params.workspaceId });
}

async function getConnection(params: { connectionId: string }): Promise<any> {
  return airbyteRequest("POST", "/connections/get", { connectionId: params.connectionId });
}

async function createConnection(params: { sourceId: string; destinationId: string; name?: string; namespaceDefinition?: string; scheduleType?: string }): Promise<any> {
  return airbyteRequest("POST", "/connections/create", {
    sourceId: params.sourceId,
    destinationId: params.destinationId,
    name: params.name,
    namespaceDefinition: params.namespaceDefinition || "source",
    scheduleType: params.scheduleType || "manual",
    status: "active",
  });
}

async function deleteConnection(params: { connectionId: string }): Promise<any> {
  return airbyteRequest("POST", "/connections/delete", { connectionId: params.connectionId });
}

async function syncConnection(params: { connectionId: string }): Promise<any> {
  return airbyteRequest("POST", "/connections/sync", { connectionId: params.connectionId });
}

async function resetConnection(params: { connectionId: string }): Promise<any> {
  return airbyteRequest("POST", "/connections/reset", { connectionId: params.connectionId });
}

async function listJobs(params: { connectionId: string; status?: string }): Promise<any> {
  const body: any = { configTypes: ["sync"], configId: params.connectionId };
  if (params.status) body.status = params.status;
  return airbyteRequest("POST", "/jobs/list", body);
}

async function getJob(params: { jobId: number }): Promise<any> {
  return airbyteRequest("POST", "/jobs/get", { id: params.jobId });
}

async function cancelJob(params: { jobId: number }): Promise<any> {
  return airbyteRequest("POST", "/jobs/cancel", { id: params.jobId });
}

async function listSourceDefinitions(params: { workspaceId?: string }): Promise<any> {
  if (params.workspaceId) {
    return airbyteRequest("POST", "/source_definitions/list_for_workspace", { workspaceId: params.workspaceId });
  }
  return airbyteRequest("POST", "/source_definitions/list", {});
}

async function listDestinationDefinitions(params: { workspaceId?: string }): Promise<any> {
  if (params.workspaceId) {
    return airbyteRequest("POST", "/destination_definitions/list_for_workspace", { workspaceId: params.workspaceId });
  }
  return airbyteRequest("POST", "/destination_definitions/list", {});
}

const server = new Server({ name: "airbyte-mcp", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result: any;
    switch (name) {
      case "list_workspaces": result = await listWorkspaces(); break;
      case "get_workspace": result = await getWorkspace(args as any); break;
      case "list_sources": result = await listSources(args as any); break;
      case "get_source": result = await getSource(args as any); break;
      case "create_source": result = await createSource(args as any); break;
      case "delete_source": result = await deleteSource(args as any); break;
      case "check_source": result = await checkSource(args as any); break;
      case "discover_schema": result = await discoverSchema(args as any); break;
      case "list_destinations": result = await listDestinations(args as any); break;
      case "get_destination": result = await getDestination(args as any); break;
      case "create_destination": result = await createDestination(args as any); break;
      case "delete_destination": result = await deleteDestination(args as any); break;
      case "check_destination": result = await checkDestination(args as any); break;
      case "list_connections": result = await listConnections(args as any); break;
      case "get_connection": result = await getConnection(args as any); break;
      case "create_connection": result = await createConnection(args as any); break;
      case "delete_connection": result = await deleteConnection(args as any); break;
      case "sync_connection": result = await syncConnection(args as any); break;
      case "reset_connection": result = await resetConnection(args as any); break;
      case "list_jobs": result = await listJobs(args as any); break;
      case "get_job": result = await getJob(args as any); break;
      case "cancel_job": result = await cancelJob(args as any); break;
      case "list_source_definitions": result = await listSourceDefinitions(args as any); break;
      case "list_destination_definitions": result = await listDestinationDefinitions(args as any); break;
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
  console.error("Airbyte MCP Server running on stdio");
}

main().catch(console.error);
