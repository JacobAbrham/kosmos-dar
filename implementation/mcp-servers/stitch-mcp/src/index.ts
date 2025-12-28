/**
 * Stitch MCP Server - Data pipeline integration for KOSMOS
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";

const config = {
  apiUrl: "https://api.stitchdata.com/v4",
  apiToken: process.env.STITCH_API_TOKEN || "",
  clientId: process.env.STITCH_CLIENT_ID || "",
};

async function stitchRequest(method: string, path: string, body?: any): Promise<any> {
  const res = await fetch(`${config.apiUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || error.error?.message || res.statusText);
  }

  // Handle 204 No Content
  if (res.status === 204) {
    return { success: true };
  }

  return res.json();
}

const TOOLS: Tool[] = [
  // Sources
  {
    name: "list_sources",
    description: "List all data sources configured in Stitch.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_source",
    description: "Get details of a specific data source.",
    inputSchema: {
      type: "object",
      properties: {
        sourceId: { type: "number", description: "The source ID" },
      },
      required: ["sourceId"],
    },
  },
  {
    name: "create_source",
    description: "Create a new data source.",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", description: "Source type (e.g., platform.mysql, platform.postgres)" },
        display_name: { type: "string", description: "Display name for the source" },
        properties: { type: "object", description: "Source-specific configuration properties" },
      },
      required: ["type", "display_name"],
    },
  },
  {
    name: "update_source",
    description: "Update an existing data source.",
    inputSchema: {
      type: "object",
      properties: {
        sourceId: { type: "number", description: "The source ID" },
        display_name: { type: "string", description: "New display name" },
        properties: { type: "object", description: "Updated configuration properties" },
      },
      required: ["sourceId"],
    },
  },
  {
    name: "delete_source",
    description: "Delete a data source.",
    inputSchema: {
      type: "object",
      properties: {
        sourceId: { type: "number", description: "The source ID to delete" },
      },
      required: ["sourceId"],
    },
  },
  {
    name: "pause_source",
    description: "Pause a data source to stop replication.",
    inputSchema: {
      type: "object",
      properties: {
        sourceId: { type: "number", description: "The source ID to pause" },
      },
      required: ["sourceId"],
    },
  },
  // Streams
  {
    name: "list_streams",
    description: "List all streams for a source.",
    inputSchema: {
      type: "object",
      properties: {
        sourceId: { type: "number", description: "The source ID" },
      },
      required: ["sourceId"],
    },
  },
  {
    name: "update_stream",
    description: "Update stream configuration (selection, replication method, etc.).",
    inputSchema: {
      type: "object",
      properties: {
        sourceId: { type: "number", description: "The source ID" },
        streamId: { type: "number", description: "The stream ID" },
        selected: { type: "boolean", description: "Whether the stream is selected for replication" },
        replication_method: { type: "string", description: "Replication method (INCREMENTAL or FULL_TABLE)" },
        replication_key: { type: "string", description: "Column to use as replication key for incremental" },
      },
      required: ["sourceId", "streamId"],
    },
  },
  // Destinations
  {
    name: "list_destinations",
    description: "List all destinations configured in the account.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_destination",
    description: "Get details of a specific destination.",
    inputSchema: {
      type: "object",
      properties: {
        destinationId: { type: "number", description: "The destination ID" },
      },
      required: ["destinationId"],
    },
  },
  {
    name: "update_destination",
    description: "Update destination configuration.",
    inputSchema: {
      type: "object",
      properties: {
        destinationId: { type: "number", description: "The destination ID" },
        properties: { type: "object", description: "Updated configuration properties" },
      },
      required: ["destinationId"],
    },
  },
  // Loads
  {
    name: "list_loads",
    description: "List recent data loads for a source.",
    inputSchema: {
      type: "object",
      properties: {
        sourceId: { type: "number", description: "The source ID" },
        limit: { type: "number", description: "Maximum number of loads to return (default 50)" },
      },
      required: ["sourceId"],
    },
  },
  {
    name: "get_load",
    description: "Get details of a specific load.",
    inputSchema: {
      type: "object",
      properties: {
        sourceId: { type: "number", description: "The source ID" },
        loadId: { type: "string", description: "The load ID" },
      },
      required: ["sourceId", "loadId"],
    },
  },
  // Replication
  {
    name: "start_replication",
    description: "Start a replication job for a source.",
    inputSchema: {
      type: "object",
      properties: {
        sourceId: { type: "number", description: "The source ID to start replication for" },
      },
      required: ["sourceId"],
    },
  },
  // Extraction Jobs
  {
    name: "list_extraction_jobs",
    description: "List extraction jobs for a source.",
    inputSchema: {
      type: "object",
      properties: {
        sourceId: { type: "number", description: "The source ID" },
        page: { type: "number", description: "Page number for pagination" },
      },
      required: ["sourceId"],
    },
  },
  {
    name: "get_extraction_job",
    description: "Get details of a specific extraction job.",
    inputSchema: {
      type: "object",
      properties: {
        sourceId: { type: "number", description: "The source ID" },
        jobId: { type: "string", description: "The extraction job ID" },
      },
      required: ["sourceId", "jobId"],
    },
  },
  // Accounts
  {
    name: "list_accounts",
    description: "List all accounts accessible with current credentials.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_account",
    description: "Get account information.",
    inputSchema: {
      type: "object",
      properties: {
        accountId: { type: "number", description: "The account ID (uses STITCH_CLIENT_ID if not provided)" },
      },
    },
  },
  // Source Types
  {
    name: "list_source_types",
    description: "List available source types (connectors) in Stitch.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  // Notifications
  {
    name: "get_notifications",
    description: "Get notification settings for the account.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

// Source functions
async function listSources(): Promise<any> {
  return stitchRequest("GET", `/sources`);
}

async function getSource(params: { sourceId: number }): Promise<any> {
  return stitchRequest("GET", `/sources/${params.sourceId}`);
}

async function createSource(params: { type: string; display_name: string; properties?: any }): Promise<any> {
  return stitchRequest("POST", `/sources`, {
    type: params.type,
    display_name: params.display_name,
    properties: params.properties || {},
  });
}

async function updateSource(params: { sourceId: number; display_name?: string; properties?: any }): Promise<any> {
  const body: any = {};
  if (params.display_name) body.display_name = params.display_name;
  if (params.properties) body.properties = params.properties;
  return stitchRequest("PUT", `/sources/${params.sourceId}`, body);
}

async function deleteSource(params: { sourceId: number }): Promise<any> {
  return stitchRequest("DELETE", `/sources/${params.sourceId}`);
}

async function pauseSource(params: { sourceId: number }): Promise<any> {
  return stitchRequest("PUT", `/sources/${params.sourceId}`, { paused_at: new Date().toISOString() });
}

// Stream functions
async function listStreams(params: { sourceId: number }): Promise<any> {
  return stitchRequest("GET", `/sources/${params.sourceId}/streams`);
}

async function updateStream(params: {
  sourceId: number;
  streamId: number;
  selected?: boolean;
  replication_method?: string;
  replication_key?: string;
}): Promise<any> {
  const body: any = {};
  if (params.selected !== undefined) body.selected = params.selected;
  if (params.replication_method) body.replication_method = params.replication_method;
  if (params.replication_key) body.replication_key = params.replication_key;
  return stitchRequest("PUT", `/sources/${params.sourceId}/streams/${params.streamId}`, body);
}

// Destination functions
async function listDestinations(): Promise<any> {
  return stitchRequest("GET", `/destinations`);
}

async function getDestination(params: { destinationId: number }): Promise<any> {
  return stitchRequest("GET", `/destinations/${params.destinationId}`);
}

async function updateDestination(params: { destinationId: number; properties?: any }): Promise<any> {
  return stitchRequest("PUT", `/destinations/${params.destinationId}`, { properties: params.properties || {} });
}

// Load functions
async function listLoads(params: { sourceId: number; limit?: number }): Promise<any> {
  const limit = params.limit || 50;
  return stitchRequest("GET", `/sources/${params.sourceId}/loads?limit=${limit}`);
}

async function getLoad(params: { sourceId: number; loadId: string }): Promise<any> {
  return stitchRequest("GET", `/sources/${params.sourceId}/loads/${params.loadId}`);
}

// Replication functions
async function startReplication(params: { sourceId: number }): Promise<any> {
  return stitchRequest("POST", `/sources/${params.sourceId}/sync`, {});
}

// Extraction job functions
async function listExtractionJobs(params: { sourceId: number; page?: number }): Promise<any> {
  const page = params.page || 1;
  return stitchRequest("GET", `/sources/${params.sourceId}/extractions?page=${page}`);
}

async function getExtractionJob(params: { sourceId: number; jobId: string }): Promise<any> {
  return stitchRequest("GET", `/sources/${params.sourceId}/extractions/${params.jobId}`);
}

// Account functions
async function listAccounts(): Promise<any> {
  return stitchRequest("GET", `/accounts`);
}

async function getAccount(params: { accountId?: number }): Promise<any> {
  const accountId = params.accountId || config.clientId;
  return stitchRequest("GET", `/accounts/${accountId}`);
}

// Source type functions
async function listSourceTypes(): Promise<any> {
  return stitchRequest("GET", `/source-types`);
}

// Notification functions
async function getNotifications(): Promise<any> {
  return stitchRequest("GET", `/notifications`);
}

const server = new Server(
  { name: "stitch-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result: any;
    switch (name) {
      // Sources
      case "list_sources":
        result = await listSources();
        break;
      case "get_source":
        result = await getSource(args as any);
        break;
      case "create_source":
        result = await createSource(args as any);
        break;
      case "update_source":
        result = await updateSource(args as any);
        break;
      case "delete_source":
        result = await deleteSource(args as any);
        break;
      case "pause_source":
        result = await pauseSource(args as any);
        break;
      // Streams
      case "list_streams":
        result = await listStreams(args as any);
        break;
      case "update_stream":
        result = await updateStream(args as any);
        break;
      // Destinations
      case "list_destinations":
        result = await listDestinations();
        break;
      case "get_destination":
        result = await getDestination(args as any);
        break;
      case "update_destination":
        result = await updateDestination(args as any);
        break;
      // Loads
      case "list_loads":
        result = await listLoads(args as any);
        break;
      case "get_load":
        result = await getLoad(args as any);
        break;
      // Replication
      case "start_replication":
        result = await startReplication(args as any);
        break;
      // Extraction jobs
      case "list_extraction_jobs":
        result = await listExtractionJobs(args as any);
        break;
      case "get_extraction_job":
        result = await getExtractionJob(args as any);
        break;
      // Accounts
      case "list_accounts":
        result = await listAccounts();
        break;
      case "get_account":
        result = await getAccount(args as any);
        break;
      // Source types
      case "list_source_types":
        result = await listSourceTypes();
        break;
      // Notifications
      case "get_notifications":
        result = await getNotifications();
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
  console.error("Stitch MCP Server running on stdio");
}

main().catch(console.error);
