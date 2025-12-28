/**
 * Fivetran MCP Server - ELT data integration for KOSMOS
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";

const config = {
  apiUrl: process.env.FIVETRAN_API_URL || "https://api.fivetran.com/v1",
  apiKey: process.env.FIVETRAN_API_KEY || "",
  apiSecret: process.env.FIVETRAN_API_SECRET || "",
};

async function fivetranRequest(method: string, path: string, body?: any): Promise<any> {
  const auth = Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString("base64");
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
    throw new Error(error.message || error.code || res.statusText);
  }

  return res.json();
}

const TOOLS: Tool[] = [
  // Connectors
  {
    name: "list_connectors",
    description: "List all connectors. Optionally filter by group_id.",
    inputSchema: {
      type: "object",
      properties: {
        group_id: { type: "string", description: "Filter by group ID" },
        cursor: { type: "string", description: "Pagination cursor" },
        limit: { type: "number", description: "Number of results to return" },
      },
    },
  },
  {
    name: "get_connector",
    description: "Get details for a specific connector.",
    inputSchema: {
      type: "object",
      properties: {
        connector_id: { type: "string", description: "The connector ID" },
      },
      required: ["connector_id"],
    },
  },
  {
    name: "create_connector",
    description: "Create a new connector.",
    inputSchema: {
      type: "object",
      properties: {
        group_id: { type: "string", description: "The group ID to create connector in" },
        service: { type: "string", description: "The connector service type (e.g., google_sheets, postgres)" },
        config: { type: "object", description: "Connector configuration object" },
        paused: { type: "boolean", description: "Whether connector should be paused initially" },
        trust_certificates: { type: "boolean", description: "Trust server certificates" },
        trust_fingerprints: { type: "boolean", description: "Trust server fingerprints" },
        run_setup_tests: { type: "boolean", description: "Run setup tests after creation" },
      },
      required: ["group_id", "service", "config"],
    },
  },
  {
    name: "update_connector",
    description: "Update an existing connector's configuration.",
    inputSchema: {
      type: "object",
      properties: {
        connector_id: { type: "string", description: "The connector ID" },
        config: { type: "object", description: "Updated connector configuration" },
        paused: { type: "boolean", description: "Whether to pause the connector" },
        sync_frequency: { type: "number", description: "Sync frequency in minutes" },
        schedule_type: { type: "string", description: "Schedule type (auto or manual)" },
      },
      required: ["connector_id"],
    },
  },
  {
    name: "delete_connector",
    description: "Delete a connector.",
    inputSchema: {
      type: "object",
      properties: {
        connector_id: { type: "string", description: "The connector ID to delete" },
      },
      required: ["connector_id"],
    },
  },
  {
    name: "sync_connector",
    description: "Trigger a manual sync for a connector.",
    inputSchema: {
      type: "object",
      properties: {
        connector_id: { type: "string", description: "The connector ID" },
        force: { type: "boolean", description: "Force sync even if not due" },
      },
      required: ["connector_id"],
    },
  },
  {
    name: "test_connector",
    description: "Run setup tests for a connector.",
    inputSchema: {
      type: "object",
      properties: {
        connector_id: { type: "string", description: "The connector ID" },
        trust_certificates: { type: "boolean", description: "Trust certificates during test" },
        trust_fingerprints: { type: "boolean", description: "Trust fingerprints during test" },
      },
      required: ["connector_id"],
    },
  },
  // Connector Schemas
  {
    name: "list_connector_schemas",
    description: "List schemas for a connector.",
    inputSchema: {
      type: "object",
      properties: {
        connector_id: { type: "string", description: "The connector ID" },
      },
      required: ["connector_id"],
    },
  },
  {
    name: "modify_connector_schema",
    description: "Modify schema configuration for a connector.",
    inputSchema: {
      type: "object",
      properties: {
        connector_id: { type: "string", description: "The connector ID" },
        schemas: { type: "object", description: "Schema configuration object with enabled/disabled tables and columns" },
        schema_change_handling: { type: "string", description: "How to handle schema changes (ALLOW_ALL, ALLOW_COLUMNS, BLOCK_ALL)" },
      },
      required: ["connector_id", "schemas"],
    },
  },
  // Destinations
  {
    name: "list_destinations",
    description: "List all destinations.",
    inputSchema: {
      type: "object",
      properties: {
        cursor: { type: "string", description: "Pagination cursor" },
        limit: { type: "number", description: "Number of results to return" },
      },
    },
  },
  {
    name: "get_destination",
    description: "Get details for a specific destination.",
    inputSchema: {
      type: "object",
      properties: {
        destination_id: { type: "string", description: "The destination ID" },
      },
      required: ["destination_id"],
    },
  },
  {
    name: "create_destination",
    description: "Create a new destination.",
    inputSchema: {
      type: "object",
      properties: {
        group_id: { type: "string", description: "The group ID for the destination" },
        service: { type: "string", description: "The destination service type (e.g., snowflake, bigquery)" },
        config: { type: "object", description: "Destination configuration object" },
        region: { type: "string", description: "Data processing region" },
        time_zone_offset: { type: "string", description: "Timezone offset for the destination" },
        run_setup_tests: { type: "boolean", description: "Run setup tests after creation" },
      },
      required: ["group_id", "service", "config"],
    },
  },
  // Groups
  {
    name: "list_groups",
    description: "List all groups.",
    inputSchema: {
      type: "object",
      properties: {
        cursor: { type: "string", description: "Pagination cursor" },
        limit: { type: "number", description: "Number of results to return" },
      },
    },
  },
  {
    name: "get_group",
    description: "Get details for a specific group.",
    inputSchema: {
      type: "object",
      properties: {
        group_id: { type: "string", description: "The group ID" },
      },
      required: ["group_id"],
    },
  },
  {
    name: "create_group",
    description: "Create a new group.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "The group name" },
      },
      required: ["name"],
    },
  },
  // Users
  {
    name: "list_users",
    description: "List all users in the account.",
    inputSchema: {
      type: "object",
      properties: {
        cursor: { type: "string", description: "Pagination cursor" },
        limit: { type: "number", description: "Number of results to return" },
      },
    },
  },
  {
    name: "get_user",
    description: "Get details for a specific user.",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string", description: "The user ID" },
      },
      required: ["user_id"],
    },
  },
  // Connector Types
  {
    name: "list_connector_types",
    description: "List all available connector types.",
    inputSchema: {
      type: "object",
      properties: {
        cursor: { type: "string", description: "Pagination cursor" },
        limit: { type: "number", description: "Number of results to return" },
      },
    },
  },
  // Logs and History
  {
    name: "get_connector_logs",
    description: "Get connector sync logs.",
    inputSchema: {
      type: "object",
      properties: {
        connector_id: { type: "string", description: "The connector ID" },
        cursor: { type: "string", description: "Pagination cursor" },
        limit: { type: "number", description: "Number of results to return" },
      },
      required: ["connector_id"],
    },
  },
  {
    name: "get_sync_history",
    description: "Get sync history for a connector.",
    inputSchema: {
      type: "object",
      properties: {
        connector_id: { type: "string", description: "The connector ID" },
        cursor: { type: "string", description: "Pagination cursor" },
        limit: { type: "number", description: "Number of results to return" },
      },
      required: ["connector_id"],
    },
  },
];

// Connector functions
async function listConnectors(params: { group_id?: string; cursor?: string; limit?: number }): Promise<any> {
  let path = "/connectors";
  const queryParams: string[] = [];
  if (params.group_id) queryParams.push(`group_id=${params.group_id}`);
  if (params.cursor) queryParams.push(`cursor=${params.cursor}`);
  if (params.limit) queryParams.push(`limit=${params.limit}`);
  if (queryParams.length > 0) path += `?${queryParams.join("&")}`;
  return fivetranRequest("GET", path);
}

async function getConnector(params: { connector_id: string }): Promise<any> {
  return fivetranRequest("GET", `/connectors/${params.connector_id}`);
}

async function createConnector(params: {
  group_id: string;
  service: string;
  config: any;
  paused?: boolean;
  trust_certificates?: boolean;
  trust_fingerprints?: boolean;
  run_setup_tests?: boolean;
}): Promise<any> {
  return fivetranRequest("POST", "/connectors", {
    group_id: params.group_id,
    service: params.service,
    config: params.config,
    paused: params.paused,
    trust_certificates: params.trust_certificates,
    trust_fingerprints: params.trust_fingerprints,
    run_setup_tests: params.run_setup_tests,
  });
}

async function updateConnector(params: {
  connector_id: string;
  config?: any;
  paused?: boolean;
  sync_frequency?: number;
  schedule_type?: string;
}): Promise<any> {
  const body: any = {};
  if (params.config) body.config = params.config;
  if (params.paused !== undefined) body.paused = params.paused;
  if (params.sync_frequency) body.sync_frequency = params.sync_frequency;
  if (params.schedule_type) body.schedule_type = params.schedule_type;
  return fivetranRequest("PATCH", `/connectors/${params.connector_id}`, body);
}

async function deleteConnector(params: { connector_id: string }): Promise<any> {
  return fivetranRequest("DELETE", `/connectors/${params.connector_id}`);
}

async function syncConnector(params: { connector_id: string; force?: boolean }): Promise<any> {
  const body: any = {};
  if (params.force) body.force = params.force;
  return fivetranRequest("POST", `/connectors/${params.connector_id}/sync`, body);
}

async function testConnector(params: {
  connector_id: string;
  trust_certificates?: boolean;
  trust_fingerprints?: boolean;
}): Promise<any> {
  const body: any = {};
  if (params.trust_certificates !== undefined) body.trust_certificates = params.trust_certificates;
  if (params.trust_fingerprints !== undefined) body.trust_fingerprints = params.trust_fingerprints;
  return fivetranRequest("POST", `/connectors/${params.connector_id}/test`, body);
}

// Schema functions
async function listConnectorSchemas(params: { connector_id: string }): Promise<any> {
  return fivetranRequest("GET", `/connectors/${params.connector_id}/schemas`);
}

async function modifyConnectorSchema(params: {
  connector_id: string;
  schemas: any;
  schema_change_handling?: string;
}): Promise<any> {
  const body: any = { schemas: params.schemas };
  if (params.schema_change_handling) body.schema_change_handling = params.schema_change_handling;
  return fivetranRequest("PATCH", `/connectors/${params.connector_id}/schemas`, body);
}

// Destination functions
async function listDestinations(params: { cursor?: string; limit?: number }): Promise<any> {
  let path = "/destinations";
  const queryParams: string[] = [];
  if (params.cursor) queryParams.push(`cursor=${params.cursor}`);
  if (params.limit) queryParams.push(`limit=${params.limit}`);
  if (queryParams.length > 0) path += `?${queryParams.join("&")}`;
  return fivetranRequest("GET", path);
}

async function getDestination(params: { destination_id: string }): Promise<any> {
  return fivetranRequest("GET", `/destinations/${params.destination_id}`);
}

async function createDestination(params: {
  group_id: string;
  service: string;
  config: any;
  region?: string;
  time_zone_offset?: string;
  run_setup_tests?: boolean;
}): Promise<any> {
  return fivetranRequest("POST", "/destinations", {
    group_id: params.group_id,
    service: params.service,
    config: params.config,
    region: params.region,
    time_zone_offset: params.time_zone_offset,
    run_setup_tests: params.run_setup_tests,
  });
}

// Group functions
async function listGroups(params: { cursor?: string; limit?: number }): Promise<any> {
  let path = "/groups";
  const queryParams: string[] = [];
  if (params.cursor) queryParams.push(`cursor=${params.cursor}`);
  if (params.limit) queryParams.push(`limit=${params.limit}`);
  if (queryParams.length > 0) path += `?${queryParams.join("&")}`;
  return fivetranRequest("GET", path);
}

async function getGroup(params: { group_id: string }): Promise<any> {
  return fivetranRequest("GET", `/groups/${params.group_id}`);
}

async function createGroup(params: { name: string }): Promise<any> {
  return fivetranRequest("POST", "/groups", { name: params.name });
}

// User functions
async function listUsers(params: { cursor?: string; limit?: number }): Promise<any> {
  let path = "/users";
  const queryParams: string[] = [];
  if (params.cursor) queryParams.push(`cursor=${params.cursor}`);
  if (params.limit) queryParams.push(`limit=${params.limit}`);
  if (queryParams.length > 0) path += `?${queryParams.join("&")}`;
  return fivetranRequest("GET", path);
}

async function getUser(params: { user_id: string }): Promise<any> {
  return fivetranRequest("GET", `/users/${params.user_id}`);
}

// Connector types function
async function listConnectorTypes(params: { cursor?: string; limit?: number }): Promise<any> {
  let path = "/metadata/connectors";
  const queryParams: string[] = [];
  if (params.cursor) queryParams.push(`cursor=${params.cursor}`);
  if (params.limit) queryParams.push(`limit=${params.limit}`);
  if (queryParams.length > 0) path += `?${queryParams.join("&")}`;
  return fivetranRequest("GET", path);
}

// Logs and history functions
async function getConnectorLogs(params: { connector_id: string; cursor?: string; limit?: number }): Promise<any> {
  let path = `/connectors/${params.connector_id}/logs`;
  const queryParams: string[] = [];
  if (params.cursor) queryParams.push(`cursor=${params.cursor}`);
  if (params.limit) queryParams.push(`limit=${params.limit}`);
  if (queryParams.length > 0) path += `?${queryParams.join("&")}`;
  return fivetranRequest("GET", path);
}

async function getSyncHistory(params: { connector_id: string; cursor?: string; limit?: number }): Promise<any> {
  let path = `/connectors/${params.connector_id}/sync-history`;
  const queryParams: string[] = [];
  if (params.cursor) queryParams.push(`cursor=${params.cursor}`);
  if (params.limit) queryParams.push(`limit=${params.limit}`);
  if (queryParams.length > 0) path += `?${queryParams.join("&")}`;
  return fivetranRequest("GET", path);
}

const server = new Server({ name: "fivetran-mcp", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result: any;
    switch (name) {
      // Connectors
      case "list_connectors": result = await listConnectors(args as any); break;
      case "get_connector": result = await getConnector(args as any); break;
      case "create_connector": result = await createConnector(args as any); break;
      case "update_connector": result = await updateConnector(args as any); break;
      case "delete_connector": result = await deleteConnector(args as any); break;
      case "sync_connector": result = await syncConnector(args as any); break;
      case "test_connector": result = await testConnector(args as any); break;
      // Schemas
      case "list_connector_schemas": result = await listConnectorSchemas(args as any); break;
      case "modify_connector_schema": result = await modifyConnectorSchema(args as any); break;
      // Destinations
      case "list_destinations": result = await listDestinations(args as any); break;
      case "get_destination": result = await getDestination(args as any); break;
      case "create_destination": result = await createDestination(args as any); break;
      // Groups
      case "list_groups": result = await listGroups(args as any); break;
      case "get_group": result = await getGroup(args as any); break;
      case "create_group": result = await createGroup(args as any); break;
      // Users
      case "list_users": result = await listUsers(args as any); break;
      case "get_user": result = await getUser(args as any); break;
      // Connector types
      case "list_connector_types": result = await listConnectorTypes(args as any); break;
      // Logs and history
      case "get_connector_logs": result = await getConnectorLogs(args as any); break;
      case "get_sync_history": result = await getSyncHistory(args as any); break;
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
  console.error("Fivetran MCP Server running on stdio");
}

main().catch(console.error);
