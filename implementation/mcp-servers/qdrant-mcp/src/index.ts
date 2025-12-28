/**
 * Qdrant MCP Server - Vector database operations for KOSMOS agents
 *
 * Provides comprehensive access to Qdrant vector database capabilities:
 * - Collection management (create, list, delete, info)
 * - Point operations (upsert, delete, retrieve, scroll)
 * - Vector search (similarity, filtered, hybrid)
 * - Payload operations (set, delete, clear)
 * - Snapshots management
 * - Cluster information
 *
 * Authentication: Uses QDRANT_URL and QDRANT_API_KEY environment variables.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

// =============================================================================
// Configuration
// =============================================================================

const config = {
  url: process.env.QDRANT_URL || "http://localhost:6333",
  apiKey: process.env.QDRANT_API_KEY || "",
};

// =============================================================================
// HTTP Client Helper
// =============================================================================

async function qdrantRequest(
  method: string,
  path: string,
  body?: any
): Promise<any> {
  const url = `${config.url}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (config.apiKey) {
    headers["api-key"] = config.apiKey;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Qdrant API error (${response.status}): ${errorText}`);
  }

  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return response.json();
  }

  return { success: true };
}

// =============================================================================
// Tool Definitions
// =============================================================================

const TOOLS: Tool[] = [
  // Collection Operations
  {
    name: "list_collections",
    description: "List all collections in the Qdrant database.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "create_collection",
    description: "Create a new collection with specified vector configuration.",
    inputSchema: {
      type: "object",
      properties: {
        collection_name: { type: "string", description: "Name of the collection" },
        vectors: {
          type: "object",
          description: "Vector configuration with size and distance metric",
          properties: {
            size: { type: "number", description: "Vector dimension size" },
            distance: {
              type: "string",
              enum: ["Cosine", "Euclid", "Dot"],
              description: "Distance metric for similarity",
            },
          },
          required: ["size", "distance"],
        },
        shard_number: { type: "number", description: "Number of shards (optional)" },
        replication_factor: { type: "number", description: "Replication factor (optional)" },
        on_disk_payload: { type: "boolean", description: "Store payload on disk (optional)" },
      },
      required: ["collection_name", "vectors"],
    },
  },
  {
    name: "delete_collection",
    description: "Delete a collection.",
    inputSchema: {
      type: "object",
      properties: {
        collection_name: { type: "string", description: "Name of the collection to delete" },
      },
      required: ["collection_name"],
    },
  },
  {
    name: "get_collection_info",
    description: "Get detailed information about a collection.",
    inputSchema: {
      type: "object",
      properties: {
        collection_name: { type: "string", description: "Name of the collection" },
      },
      required: ["collection_name"],
    },
  },
  {
    name: "update_collection",
    description: "Update collection parameters.",
    inputSchema: {
      type: "object",
      properties: {
        collection_name: { type: "string", description: "Name of the collection" },
        optimizers_config: {
          type: "object",
          description: "Optimizer configuration",
          properties: {
            indexing_threshold: { type: "number" },
            memmap_threshold: { type: "number" },
          },
        },
      },
      required: ["collection_name"],
    },
  },
  // Point Operations
  {
    name: "upsert_points",
    description: "Insert or update points in a collection.",
    inputSchema: {
      type: "object",
      properties: {
        collection_name: { type: "string", description: "Name of the collection" },
        points: {
          type: "array",
          description: "Array of points to upsert",
          items: {
            type: "object",
            properties: {
              id: { type: ["string", "number"], description: "Point ID" },
              vector: {
                type: "array",
                items: { type: "number" },
                description: "Vector values",
              },
              payload: { type: "object", description: "Payload data" },
            },
            required: ["id", "vector"],
          },
        },
        wait: { type: "boolean", description: "Wait for operation to complete" },
      },
      required: ["collection_name", "points"],
    },
  },
  {
    name: "delete_points",
    description: "Delete points from a collection.",
    inputSchema: {
      type: "object",
      properties: {
        collection_name: { type: "string", description: "Name of the collection" },
        points: {
          type: "array",
          items: { type: ["string", "number"] },
          description: "Array of point IDs to delete",
        },
        filter: { type: "object", description: "Filter to select points for deletion" },
        wait: { type: "boolean", description: "Wait for operation to complete" },
      },
      required: ["collection_name"],
    },
  },
  {
    name: "get_points",
    description: "Retrieve points by their IDs.",
    inputSchema: {
      type: "object",
      properties: {
        collection_name: { type: "string", description: "Name of the collection" },
        ids: {
          type: "array",
          items: { type: ["string", "number"] },
          description: "Array of point IDs to retrieve",
        },
        with_payload: { type: "boolean", description: "Include payload in response" },
        with_vector: { type: "boolean", description: "Include vector in response" },
      },
      required: ["collection_name", "ids"],
    },
  },
  {
    name: "scroll_points",
    description: "Scroll through points in a collection with optional filtering.",
    inputSchema: {
      type: "object",
      properties: {
        collection_name: { type: "string", description: "Name of the collection" },
        filter: { type: "object", description: "Filter conditions" },
        limit: { type: "number", description: "Maximum number of points to return" },
        offset: { type: ["string", "number"], description: "Offset point ID for pagination" },
        with_payload: { type: "boolean", description: "Include payload in response" },
        with_vector: { type: "boolean", description: "Include vector in response" },
      },
      required: ["collection_name"],
    },
  },
  {
    name: "count_points",
    description: "Count points in a collection with optional filtering.",
    inputSchema: {
      type: "object",
      properties: {
        collection_name: { type: "string", description: "Name of the collection" },
        filter: { type: "object", description: "Filter conditions" },
        exact: { type: "boolean", description: "Exact count (slower) vs approximate" },
      },
      required: ["collection_name"],
    },
  },
  // Search Operations
  {
    name: "search_points",
    description: "Perform vector similarity search.",
    inputSchema: {
      type: "object",
      properties: {
        collection_name: { type: "string", description: "Name of the collection" },
        vector: {
          type: "array",
          items: { type: "number" },
          description: "Query vector",
        },
        limit: { type: "number", description: "Maximum number of results" },
        filter: { type: "object", description: "Filter conditions" },
        with_payload: { type: "boolean", description: "Include payload in response" },
        with_vector: { type: "boolean", description: "Include vector in response" },
        score_threshold: { type: "number", description: "Minimum score threshold" },
        offset: { type: "number", description: "Offset for pagination" },
      },
      required: ["collection_name", "vector", "limit"],
    },
  },
  {
    name: "search_batch",
    description: "Perform multiple vector searches in a single request.",
    inputSchema: {
      type: "object",
      properties: {
        collection_name: { type: "string", description: "Name of the collection" },
        searches: {
          type: "array",
          description: "Array of search requests",
          items: {
            type: "object",
            properties: {
              vector: { type: "array", items: { type: "number" } },
              limit: { type: "number" },
              filter: { type: "object" },
              with_payload: { type: "boolean" },
            },
            required: ["vector", "limit"],
          },
        },
      },
      required: ["collection_name", "searches"],
    },
  },
  {
    name: "recommend_points",
    description: "Get point recommendations based on positive/negative examples.",
    inputSchema: {
      type: "object",
      properties: {
        collection_name: { type: "string", description: "Name of the collection" },
        positive: {
          type: "array",
          items: { type: ["string", "number"] },
          description: "Point IDs to use as positive examples",
        },
        negative: {
          type: "array",
          items: { type: ["string", "number"] },
          description: "Point IDs to use as negative examples",
        },
        limit: { type: "number", description: "Maximum number of results" },
        filter: { type: "object", description: "Filter conditions" },
        with_payload: { type: "boolean", description: "Include payload in response" },
        with_vector: { type: "boolean", description: "Include vector in response" },
      },
      required: ["collection_name", "positive", "limit"],
    },
  },
  {
    name: "search_groups",
    description: "Search with grouping by a payload field.",
    inputSchema: {
      type: "object",
      properties: {
        collection_name: { type: "string", description: "Name of the collection" },
        vector: {
          type: "array",
          items: { type: "number" },
          description: "Query vector",
        },
        group_by: { type: "string", description: "Payload field to group by" },
        limit: { type: "number", description: "Maximum groups to return" },
        group_size: { type: "number", description: "Maximum points per group" },
        filter: { type: "object", description: "Filter conditions" },
        with_payload: { type: "boolean", description: "Include payload in response" },
      },
      required: ["collection_name", "vector", "group_by", "limit"],
    },
  },
  // Payload Operations
  {
    name: "set_payload",
    description: "Set or update payload for points.",
    inputSchema: {
      type: "object",
      properties: {
        collection_name: { type: "string", description: "Name of the collection" },
        payload: { type: "object", description: "Payload data to set" },
        points: {
          type: "array",
          items: { type: ["string", "number"] },
          description: "Point IDs to update",
        },
        filter: { type: "object", description: "Filter to select points" },
        wait: { type: "boolean", description: "Wait for operation to complete" },
      },
      required: ["collection_name", "payload"],
    },
  },
  {
    name: "overwrite_payload",
    description: "Replace entire payload for points.",
    inputSchema: {
      type: "object",
      properties: {
        collection_name: { type: "string", description: "Name of the collection" },
        payload: { type: "object", description: "New payload data" },
        points: {
          type: "array",
          items: { type: ["string", "number"] },
          description: "Point IDs to update",
        },
        filter: { type: "object", description: "Filter to select points" },
        wait: { type: "boolean", description: "Wait for operation to complete" },
      },
      required: ["collection_name", "payload"],
    },
  },
  {
    name: "delete_payload",
    description: "Delete specific payload keys from points.",
    inputSchema: {
      type: "object",
      properties: {
        collection_name: { type: "string", description: "Name of the collection" },
        keys: {
          type: "array",
          items: { type: "string" },
          description: "Payload keys to delete",
        },
        points: {
          type: "array",
          items: { type: ["string", "number"] },
          description: "Point IDs to update",
        },
        filter: { type: "object", description: "Filter to select points" },
        wait: { type: "boolean", description: "Wait for operation to complete" },
      },
      required: ["collection_name", "keys"],
    },
  },
  {
    name: "clear_payload",
    description: "Clear all payload from points.",
    inputSchema: {
      type: "object",
      properties: {
        collection_name: { type: "string", description: "Name of the collection" },
        points: {
          type: "array",
          items: { type: ["string", "number"] },
          description: "Point IDs to clear",
        },
        filter: { type: "object", description: "Filter to select points" },
        wait: { type: "boolean", description: "Wait for operation to complete" },
      },
      required: ["collection_name"],
    },
  },
  // Index Operations
  {
    name: "create_payload_index",
    description: "Create an index on a payload field.",
    inputSchema: {
      type: "object",
      properties: {
        collection_name: { type: "string", description: "Name of the collection" },
        field_name: { type: "string", description: "Payload field to index" },
        field_schema: {
          type: "string",
          enum: ["keyword", "integer", "float", "bool", "geo", "text"],
          description: "Field schema type",
        },
        wait: { type: "boolean", description: "Wait for operation to complete" },
      },
      required: ["collection_name", "field_name", "field_schema"],
    },
  },
  {
    name: "delete_payload_index",
    description: "Delete a payload field index.",
    inputSchema: {
      type: "object",
      properties: {
        collection_name: { type: "string", description: "Name of the collection" },
        field_name: { type: "string", description: "Payload field name" },
        wait: { type: "boolean", description: "Wait for operation to complete" },
      },
      required: ["collection_name", "field_name"],
    },
  },
  // Snapshot Operations
  {
    name: "list_snapshots",
    description: "List all snapshots for a collection.",
    inputSchema: {
      type: "object",
      properties: {
        collection_name: { type: "string", description: "Name of the collection" },
      },
      required: ["collection_name"],
    },
  },
  {
    name: "create_snapshot",
    description: "Create a snapshot of a collection.",
    inputSchema: {
      type: "object",
      properties: {
        collection_name: { type: "string", description: "Name of the collection" },
        wait: { type: "boolean", description: "Wait for operation to complete" },
      },
      required: ["collection_name"],
    },
  },
  {
    name: "delete_snapshot",
    description: "Delete a collection snapshot.",
    inputSchema: {
      type: "object",
      properties: {
        collection_name: { type: "string", description: "Name of the collection" },
        snapshot_name: { type: "string", description: "Name of the snapshot" },
      },
      required: ["collection_name", "snapshot_name"],
    },
  },
  {
    name: "list_full_snapshots",
    description: "List all full storage snapshots.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "create_full_snapshot",
    description: "Create a full storage snapshot.",
    inputSchema: {
      type: "object",
      properties: {
        wait: { type: "boolean", description: "Wait for operation to complete" },
      },
    },
  },
  // Cluster Operations
  {
    name: "cluster_info",
    description: "Get cluster status and information.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_telemetry",
    description: "Get telemetry and metrics data.",
    inputSchema: {
      type: "object",
      properties: {
        anonymize: { type: "boolean", description: "Anonymize data" },
      },
    },
  },
  // Aliases
  {
    name: "list_aliases",
    description: "List all collection aliases.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "update_aliases",
    description: "Create, rename, or delete collection aliases.",
    inputSchema: {
      type: "object",
      properties: {
        actions: {
          type: "array",
          description: "Alias actions to perform",
          items: {
            type: "object",
            properties: {
              create_alias: {
                type: "object",
                properties: {
                  collection_name: { type: "string" },
                  alias_name: { type: "string" },
                },
              },
              delete_alias: {
                type: "object",
                properties: {
                  alias_name: { type: "string" },
                },
              },
              rename_alias: {
                type: "object",
                properties: {
                  old_alias_name: { type: "string" },
                  new_alias_name: { type: "string" },
                },
              },
            },
          },
        },
      },
      required: ["actions"],
    },
  },
];

// =============================================================================
// Tool Implementations
// =============================================================================

// Collection Operations
async function listCollections(): Promise<any> {
  const result = await qdrantRequest("GET", "/collections");
  return result;
}

async function createCollection(params: {
  collection_name: string;
  vectors: { size: number; distance: string };
  shard_number?: number;
  replication_factor?: number;
  on_disk_payload?: boolean;
}): Promise<any> {
  const body: any = {
    vectors: params.vectors,
  };

  if (params.shard_number !== undefined) {
    body.shard_number = params.shard_number;
  }
  if (params.replication_factor !== undefined) {
    body.replication_factor = params.replication_factor;
  }
  if (params.on_disk_payload !== undefined) {
    body.on_disk_payload = params.on_disk_payload;
  }

  await qdrantRequest("PUT", `/collections/${params.collection_name}`, body);
  return { collection_name: params.collection_name, created: true };
}

async function deleteCollection(params: { collection_name: string }): Promise<any> {
  await qdrantRequest("DELETE", `/collections/${params.collection_name}`);
  return { collection_name: params.collection_name, deleted: true };
}

async function getCollectionInfo(params: { collection_name: string }): Promise<any> {
  const result = await qdrantRequest("GET", `/collections/${params.collection_name}`);
  return result;
}

async function updateCollection(params: {
  collection_name: string;
  optimizers_config?: any;
}): Promise<any> {
  const body: any = {};
  if (params.optimizers_config) {
    body.optimizers_config = params.optimizers_config;
  }

  await qdrantRequest("PATCH", `/collections/${params.collection_name}`, body);
  return { collection_name: params.collection_name, updated: true };
}

// Point Operations
async function upsertPoints(params: {
  collection_name: string;
  points: Array<{ id: string | number; vector: number[]; payload?: any }>;
  wait?: boolean;
}): Promise<any> {
  const queryParams = params.wait ? "?wait=true" : "";
  const result = await qdrantRequest(
    "PUT",
    `/collections/${params.collection_name}/points${queryParams}`,
    { points: params.points }
  );
  return result;
}

async function deletePoints(params: {
  collection_name: string;
  points?: Array<string | number>;
  filter?: any;
  wait?: boolean;
}): Promise<any> {
  const queryParams = params.wait ? "?wait=true" : "";
  const body: any = {};

  if (params.points) {
    body.points = params.points;
  }
  if (params.filter) {
    body.filter = params.filter;
  }

  const result = await qdrantRequest(
    "POST",
    `/collections/${params.collection_name}/points/delete${queryParams}`,
    body
  );
  return result;
}

async function getPoints(params: {
  collection_name: string;
  ids: Array<string | number>;
  with_payload?: boolean;
  with_vector?: boolean;
}): Promise<any> {
  const body: any = {
    ids: params.ids,
    with_payload: params.with_payload ?? true,
    with_vector: params.with_vector ?? false,
  };

  const result = await qdrantRequest(
    "POST",
    `/collections/${params.collection_name}/points`,
    body
  );
  return result;
}

async function scrollPoints(params: {
  collection_name: string;
  filter?: any;
  limit?: number;
  offset?: string | number;
  with_payload?: boolean;
  with_vector?: boolean;
}): Promise<any> {
  const body: any = {
    limit: params.limit ?? 10,
    with_payload: params.with_payload ?? true,
    with_vector: params.with_vector ?? false,
  };

  if (params.filter) {
    body.filter = params.filter;
  }
  if (params.offset !== undefined) {
    body.offset = params.offset;
  }

  const result = await qdrantRequest(
    "POST",
    `/collections/${params.collection_name}/points/scroll`,
    body
  );
  return result;
}

async function countPoints(params: {
  collection_name: string;
  filter?: any;
  exact?: boolean;
}): Promise<any> {
  const body: any = {
    exact: params.exact ?? false,
  };

  if (params.filter) {
    body.filter = params.filter;
  }

  const result = await qdrantRequest(
    "POST",
    `/collections/${params.collection_name}/points/count`,
    body
  );
  return result;
}

// Search Operations
async function searchPoints(params: {
  collection_name: string;
  vector: number[];
  limit: number;
  filter?: any;
  with_payload?: boolean;
  with_vector?: boolean;
  score_threshold?: number;
  offset?: number;
}): Promise<any> {
  const body: any = {
    vector: params.vector,
    limit: params.limit,
    with_payload: params.with_payload ?? true,
    with_vector: params.with_vector ?? false,
  };

  if (params.filter) {
    body.filter = params.filter;
  }
  if (params.score_threshold !== undefined) {
    body.score_threshold = params.score_threshold;
  }
  if (params.offset !== undefined) {
    body.offset = params.offset;
  }

  const result = await qdrantRequest(
    "POST",
    `/collections/${params.collection_name}/points/search`,
    body
  );
  return result;
}

async function searchBatch(params: {
  collection_name: string;
  searches: Array<{
    vector: number[];
    limit: number;
    filter?: any;
    with_payload?: boolean;
  }>;
}): Promise<any> {
  const result = await qdrantRequest(
    "POST",
    `/collections/${params.collection_name}/points/search/batch`,
    { searches: params.searches }
  );
  return result;
}

async function recommendPoints(params: {
  collection_name: string;
  positive: Array<string | number>;
  negative?: Array<string | number>;
  limit: number;
  filter?: any;
  with_payload?: boolean;
  with_vector?: boolean;
}): Promise<any> {
  const body: any = {
    positive: params.positive,
    limit: params.limit,
    with_payload: params.with_payload ?? true,
    with_vector: params.with_vector ?? false,
  };

  if (params.negative) {
    body.negative = params.negative;
  }
  if (params.filter) {
    body.filter = params.filter;
  }

  const result = await qdrantRequest(
    "POST",
    `/collections/${params.collection_name}/points/recommend`,
    body
  );
  return result;
}

async function searchGroups(params: {
  collection_name: string;
  vector: number[];
  group_by: string;
  limit: number;
  group_size?: number;
  filter?: any;
  with_payload?: boolean;
}): Promise<any> {
  const body: any = {
    vector: params.vector,
    group_by: params.group_by,
    limit: params.limit,
    group_size: params.group_size ?? 1,
    with_payload: params.with_payload ?? true,
  };

  if (params.filter) {
    body.filter = params.filter;
  }

  const result = await qdrantRequest(
    "POST",
    `/collections/${params.collection_name}/points/search/groups`,
    body
  );
  return result;
}

// Payload Operations
async function setPayload(params: {
  collection_name: string;
  payload: any;
  points?: Array<string | number>;
  filter?: any;
  wait?: boolean;
}): Promise<any> {
  const queryParams = params.wait ? "?wait=true" : "";
  const body: any = {
    payload: params.payload,
  };

  if (params.points) {
    body.points = params.points;
  }
  if (params.filter) {
    body.filter = params.filter;
  }

  const result = await qdrantRequest(
    "POST",
    `/collections/${params.collection_name}/points/payload${queryParams}`,
    body
  );
  return result;
}

async function overwritePayload(params: {
  collection_name: string;
  payload: any;
  points?: Array<string | number>;
  filter?: any;
  wait?: boolean;
}): Promise<any> {
  const queryParams = params.wait ? "?wait=true" : "";
  const body: any = {
    payload: params.payload,
  };

  if (params.points) {
    body.points = params.points;
  }
  if (params.filter) {
    body.filter = params.filter;
  }

  const result = await qdrantRequest(
    "PUT",
    `/collections/${params.collection_name}/points/payload${queryParams}`,
    body
  );
  return result;
}

async function deletePayload(params: {
  collection_name: string;
  keys: string[];
  points?: Array<string | number>;
  filter?: any;
  wait?: boolean;
}): Promise<any> {
  const queryParams = params.wait ? "?wait=true" : "";
  const body: any = {
    keys: params.keys,
  };

  if (params.points) {
    body.points = params.points;
  }
  if (params.filter) {
    body.filter = params.filter;
  }

  const result = await qdrantRequest(
    "POST",
    `/collections/${params.collection_name}/points/payload/delete${queryParams}`,
    body
  );
  return result;
}

async function clearPayload(params: {
  collection_name: string;
  points?: Array<string | number>;
  filter?: any;
  wait?: boolean;
}): Promise<any> {
  const queryParams = params.wait ? "?wait=true" : "";
  const body: any = {};

  if (params.points) {
    body.points = params.points;
  }
  if (params.filter) {
    body.filter = params.filter;
  }

  const result = await qdrantRequest(
    "POST",
    `/collections/${params.collection_name}/points/payload/clear${queryParams}`,
    body
  );
  return result;
}

// Index Operations
async function createPayloadIndex(params: {
  collection_name: string;
  field_name: string;
  field_schema: string;
  wait?: boolean;
}): Promise<any> {
  const queryParams = params.wait ? "?wait=true" : "";
  const body = {
    field_name: params.field_name,
    field_schema: params.field_schema,
  };

  const result = await qdrantRequest(
    "PUT",
    `/collections/${params.collection_name}/index${queryParams}`,
    body
  );
  return result;
}

async function deletePayloadIndex(params: {
  collection_name: string;
  field_name: string;
  wait?: boolean;
}): Promise<any> {
  const queryParams = params.wait ? "?wait=true" : "";
  const result = await qdrantRequest(
    "DELETE",
    `/collections/${params.collection_name}/index/${params.field_name}${queryParams}`
  );
  return result;
}

// Snapshot Operations
async function listSnapshots(params: { collection_name: string }): Promise<any> {
  const result = await qdrantRequest(
    "GET",
    `/collections/${params.collection_name}/snapshots`
  );
  return result;
}

async function createSnapshot(params: {
  collection_name: string;
  wait?: boolean;
}): Promise<any> {
  const queryParams = params.wait ? "?wait=true" : "";
  const result = await qdrantRequest(
    "POST",
    `/collections/${params.collection_name}/snapshots${queryParams}`
  );
  return result;
}

async function deleteSnapshot(params: {
  collection_name: string;
  snapshot_name: string;
}): Promise<any> {
  await qdrantRequest(
    "DELETE",
    `/collections/${params.collection_name}/snapshots/${params.snapshot_name}`
  );
  return {
    collection_name: params.collection_name,
    snapshot_name: params.snapshot_name,
    deleted: true,
  };
}

async function listFullSnapshots(): Promise<any> {
  const result = await qdrantRequest("GET", "/snapshots");
  return result;
}

async function createFullSnapshot(params: { wait?: boolean }): Promise<any> {
  const queryParams = params?.wait ? "?wait=true" : "";
  const result = await qdrantRequest("POST", `/snapshots${queryParams}`);
  return result;
}

// Cluster Operations
async function clusterInfo(): Promise<any> {
  const result = await qdrantRequest("GET", "/cluster");
  return result;
}

async function getTelemetry(params: { anonymize?: boolean }): Promise<any> {
  const queryParams = params?.anonymize ? "?anonymize=true" : "";
  const result = await qdrantRequest("GET", `/telemetry${queryParams}`);
  return result;
}

// Alias Operations
async function listAliases(): Promise<any> {
  const result = await qdrantRequest("GET", "/aliases");
  return result;
}

async function updateAliases(params: { actions: any[] }): Promise<any> {
  const result = await qdrantRequest("POST", "/collections/aliases", {
    actions: params.actions,
  });
  return result;
}

// =============================================================================
// Server Setup
// =============================================================================

const server = new Server(
  {
    name: "qdrant-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: any;

    switch (name) {
      // Collection Operations
      case "list_collections":
        result = await listCollections();
        break;
      case "create_collection":
        result = await createCollection(args as any);
        break;
      case "delete_collection":
        result = await deleteCollection(args as any);
        break;
      case "get_collection_info":
        result = await getCollectionInfo(args as any);
        break;
      case "update_collection":
        result = await updateCollection(args as any);
        break;

      // Point Operations
      case "upsert_points":
        result = await upsertPoints(args as any);
        break;
      case "delete_points":
        result = await deletePoints(args as any);
        break;
      case "get_points":
        result = await getPoints(args as any);
        break;
      case "scroll_points":
        result = await scrollPoints(args as any);
        break;
      case "count_points":
        result = await countPoints(args as any);
        break;

      // Search Operations
      case "search_points":
        result = await searchPoints(args as any);
        break;
      case "search_batch":
        result = await searchBatch(args as any);
        break;
      case "recommend_points":
        result = await recommendPoints(args as any);
        break;
      case "search_groups":
        result = await searchGroups(args as any);
        break;

      // Payload Operations
      case "set_payload":
        result = await setPayload(args as any);
        break;
      case "overwrite_payload":
        result = await overwritePayload(args as any);
        break;
      case "delete_payload":
        result = await deletePayload(args as any);
        break;
      case "clear_payload":
        result = await clearPayload(args as any);
        break;

      // Index Operations
      case "create_payload_index":
        result = await createPayloadIndex(args as any);
        break;
      case "delete_payload_index":
        result = await deletePayloadIndex(args as any);
        break;

      // Snapshot Operations
      case "list_snapshots":
        result = await listSnapshots(args as any);
        break;
      case "create_snapshot":
        result = await createSnapshot(args as any);
        break;
      case "delete_snapshot":
        result = await deleteSnapshot(args as any);
        break;
      case "list_full_snapshots":
        result = await listFullSnapshots();
        break;
      case "create_full_snapshot":
        result = await createFullSnapshot(args as any);
        break;

      // Cluster Operations
      case "cluster_info":
        result = await clusterInfo();
        break;
      case "get_telemetry":
        result = await getTelemetry(args as any);
        break;

      // Alias Operations
      case "list_aliases":
        result = await listAliases();
        break;
      case "update_aliases":
        result = await updateAliases(args as any);
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

// =============================================================================
// Main
// =============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Qdrant MCP Server running on stdio");
  console.error(`Connected to: ${config.url}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
