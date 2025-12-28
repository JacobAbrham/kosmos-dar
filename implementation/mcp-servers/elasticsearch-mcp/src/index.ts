/**
 * Elasticsearch MCP Server
 *
 * Provides full-text search, document management, and analytics for KOSMOS agents.
 * Features:
 * - Document CRUD operations
 * - Full-text and aggregation search
 * - Index management with mappings and settings
 * - Bulk operations and scrolling
 * - Cluster health and stats monitoring
 * - Text analysis
 *
 * Authentication: ELASTICSEARCH_URL with ELASTICSEARCH_API_KEY or ELASTICSEARCH_USER/ELASTICSEARCH_PASSWORD
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { Client } from "@elastic/elasticsearch";

// =============================================================================
// Configuration
// =============================================================================

const config = {
  node: process.env.ELASTICSEARCH_URL || "http://localhost:9200",
  username: process.env.ELASTICSEARCH_USER || "",
  password: process.env.ELASTICSEARCH_PASSWORD || "",
  apiKey: process.env.ELASTICSEARCH_API_KEY || "",
};

const client = new Client({
  node: config.node,
  ...(config.apiKey
    ? { auth: { apiKey: config.apiKey } }
    : config.username
      ? { auth: { username: config.username, password: config.password } }
      : {}),
});

// Store scroll contexts
const scrollContexts: Map<string, string> = new Map();

// =============================================================================
// Tool Definitions
// =============================================================================

const TOOLS: Tool[] = [
  // Document Operations
  {
    name: "search",
    description: "Search documents using Elasticsearch Query DSL. Supports match, term, range, bool, and other query types.",
    inputSchema: {
      type: "object",
      properties: {
        index: { type: "string", description: "Index name or pattern (e.g., 'logs-*')" },
        query: { type: "object", description: "Elasticsearch query DSL (e.g., { match: { title: 'search term' } })" },
        size: { type: "number", description: "Number of results to return (default: 10)" },
        from: { type: "number", description: "Offset for pagination" },
        sort: { type: "array", description: "Sort criteria array" },
        _source: { type: "array", items: { type: "string" }, description: "Fields to include in response" },
        highlight: { type: "object", description: "Highlight configuration for search terms" },
      },
      required: ["index"],
    },
  },
  {
    name: "get_document",
    description: "Get a document by its ID from a specific index.",
    inputSchema: {
      type: "object",
      properties: {
        index: { type: "string", description: "Index name" },
        id: { type: "string", description: "Document ID" },
        _source: { type: "array", items: { type: "string" }, description: "Fields to include" },
      },
      required: ["index", "id"],
    },
  },
  {
    name: "index_document",
    description: "Index (create or update) a document. If ID is provided, updates existing or creates new; otherwise creates with auto-generated ID.",
    inputSchema: {
      type: "object",
      properties: {
        index: { type: "string", description: "Index name" },
        id: { type: "string", description: "Document ID (optional, auto-generated if not provided)" },
        document: { type: "object", description: "Document body to index" },
        refresh: { type: "boolean", description: "Refresh index after operation for immediate visibility" },
        pipeline: { type: "string", description: "Ingest pipeline to process document" },
      },
      required: ["index", "document"],
    },
  },
  {
    name: "update_document",
    description: "Partially update an existing document using doc or script.",
    inputSchema: {
      type: "object",
      properties: {
        index: { type: "string", description: "Index name" },
        id: { type: "string", description: "Document ID" },
        doc: { type: "object", description: "Partial document with fields to update" },
        script: { type: "object", description: "Script for programmatic updates (e.g., { source: 'ctx._source.count++' })" },
        upsert: { type: "object", description: "Document to insert if ID doesn't exist" },
        refresh: { type: "boolean", description: "Refresh index after operation" },
      },
      required: ["index", "id"],
    },
  },
  {
    name: "delete_document",
    description: "Delete a document by ID.",
    inputSchema: {
      type: "object",
      properties: {
        index: { type: "string", description: "Index name" },
        id: { type: "string", description: "Document ID" },
        refresh: { type: "boolean", description: "Refresh index after deletion" },
      },
      required: ["index", "id"],
    },
  },
  {
    name: "bulk",
    description: "Perform bulk operations (index, create, update, delete) in a single request for efficiency.",
    inputSchema: {
      type: "object",
      properties: {
        operations: {
          type: "array",
          description: "Array of bulk operations. Each operation is an object with action type (index, create, update, delete) and optional document.",
          items: {
            type: "object",
            properties: {
              action: { type: "string", enum: ["index", "create", "update", "delete"], description: "Operation type" },
              index: { type: "string", description: "Target index" },
              id: { type: "string", description: "Document ID" },
              document: { type: "object", description: "Document body (for index/create/update)" },
            },
            required: ["action", "index"],
          },
        },
        refresh: { type: "boolean", description: "Refresh indices after bulk operation" },
        pipeline: { type: "string", description: "Default ingest pipeline for index operations" },
      },
      required: ["operations"],
    },
  },
  // Index Operations
  {
    name: "list_indices",
    description: "List all indices matching a pattern with their health, status, and statistics.",
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Index pattern (e.g., 'logs-*'). Default: '*'" },
        health: { type: "string", enum: ["green", "yellow", "red"], description: "Filter by health status" },
      },
    },
  },
  {
    name: "create_index",
    description: "Create a new index with optional mappings and settings.",
    inputSchema: {
      type: "object",
      properties: {
        index: { type: "string", description: "Index name" },
        mappings: {
          type: "object",
          description: "Field mappings defining data types and analysis settings",
        },
        settings: {
          type: "object",
          description: "Index settings (shards, replicas, analysis, etc.)",
        },
        aliases: { type: "object", description: "Index aliases to create" },
      },
      required: ["index"],
    },
  },
  {
    name: "delete_index",
    description: "Delete an index. This permanently removes all data in the index.",
    inputSchema: {
      type: "object",
      properties: {
        index: { type: "string", description: "Index name or pattern" },
      },
      required: ["index"],
    },
  },
  {
    name: "get_mapping",
    description: "Get the mapping (schema) of an index showing field types and configurations.",
    inputSchema: {
      type: "object",
      properties: {
        index: { type: "string", description: "Index name" },
      },
      required: ["index"],
    },
  },
  {
    name: "put_mapping",
    description: "Update the mapping of an existing index. Can only add new fields or update certain field parameters.",
    inputSchema: {
      type: "object",
      properties: {
        index: { type: "string", description: "Index name" },
        properties: {
          type: "object",
          description: "Field mappings to add or update",
        },
      },
      required: ["index", "properties"],
    },
  },
  {
    name: "get_settings",
    description: "Get index settings including shards, replicas, and analysis configuration.",
    inputSchema: {
      type: "object",
      properties: {
        index: { type: "string", description: "Index name" },
        flat_settings: { type: "boolean", description: "Return settings in flat format" },
        include_defaults: { type: "boolean", description: "Include default settings" },
      },
      required: ["index"],
    },
  },
  {
    name: "refresh_index",
    description: "Refresh an index to make all operations performed since the last refresh available for search.",
    inputSchema: {
      type: "object",
      properties: {
        index: { type: "string", description: "Index name or pattern. Use '_all' for all indices." },
      },
      required: ["index"],
    },
  },
  {
    name: "reindex",
    description: "Copy documents from a source index to a destination index with optional query filter and transformations.",
    inputSchema: {
      type: "object",
      properties: {
        source: {
          type: "object",
          properties: {
            index: { type: "string", description: "Source index name" },
            query: { type: "object", description: "Query to filter source documents" },
            _source: { type: "array", items: { type: "string" }, description: "Fields to include" },
          },
          required: ["index"],
        },
        dest: {
          type: "object",
          properties: {
            index: { type: "string", description: "Destination index name" },
            pipeline: { type: "string", description: "Ingest pipeline to process documents" },
          },
          required: ["index"],
        },
        script: { type: "object", description: "Script to modify documents during reindex" },
        max_docs: { type: "number", description: "Maximum number of documents to reindex" },
        wait_for_completion: { type: "boolean", description: "Wait for reindex to complete (default: true)" },
      },
      required: ["source", "dest"],
    },
  },
  // Search Operations
  {
    name: "count",
    description: "Count documents matching a query.",
    inputSchema: {
      type: "object",
      properties: {
        index: { type: "string", description: "Index name or pattern" },
        query: { type: "object", description: "Query to filter documents (optional, counts all if omitted)" },
      },
      required: ["index"],
    },
  },
  {
    name: "aggregate",
    description: "Run aggregation queries for analytics (terms, histogram, date_histogram, avg, sum, etc.).",
    inputSchema: {
      type: "object",
      properties: {
        index: { type: "string", description: "Index name or pattern" },
        aggs: { type: "object", description: "Aggregation definitions" },
        query: { type: "object", description: "Query to filter documents before aggregation" },
        size: { type: "number", description: "Number of hits to return (0 for aggregations only)" },
      },
      required: ["index", "aggs"],
    },
  },
  {
    name: "scroll",
    description: "Scroll through large result sets. Use 'start' action to initiate, 'next' to continue, and 'clear' to close.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["start", "next", "clear"], description: "Scroll action" },
        index: { type: "string", description: "Index name (required for 'start')" },
        query: { type: "object", description: "Query for initial search (for 'start')" },
        scroll_id: { type: "string", description: "Scroll ID (required for 'next' and 'clear')" },
        scroll: { type: "string", description: "Scroll timeout (e.g., '5m'). Default: '1m'" },
        size: { type: "number", description: "Batch size per scroll (for 'start')" },
      },
      required: ["action"],
    },
  },
  // Cluster Operations
  {
    name: "get_cluster_health",
    description: "Get cluster health status including node count, shard status, and overall health color.",
    inputSchema: {
      type: "object",
      properties: {
        index: { type: "string", description: "Limit health check to specific index" },
        wait_for_status: { type: "string", enum: ["green", "yellow", "red"], description: "Wait for cluster to reach status" },
        timeout: { type: "string", description: "Timeout for wait_for_status (e.g., '30s')" },
      },
    },
  },
  {
    name: "get_cluster_stats",
    description: "Get comprehensive cluster statistics including nodes, indices, and resource usage.",
    inputSchema: {
      type: "object",
      properties: {
        node_id: { type: "string", description: "Limit stats to specific node" },
      },
    },
  },
  // Analysis
  {
    name: "analyze_text",
    description: "Analyze text using a specific analyzer to see how it would be tokenized and processed.",
    inputSchema: {
      type: "object",
      properties: {
        index: { type: "string", description: "Index to use for analysis (uses index's analyzers)" },
        analyzer: { type: "string", description: "Built-in or custom analyzer name (e.g., 'standard', 'english')" },
        text: { type: "string", description: "Text to analyze" },
        field: { type: "string", description: "Analyze using field's configured analyzer" },
        tokenizer: { type: "string", description: "Tokenizer to use (if not using analyzer)" },
        filter: { type: "array", items: { type: "string" }, description: "Token filters to apply" },
        char_filter: { type: "array", items: { type: "string" }, description: "Character filters to apply" },
      },
      required: ["text"],
    },
  },
];

// =============================================================================
// Tool Implementations
// =============================================================================

async function search(params: {
  index: string;
  query?: any;
  size?: number;
  from?: number;
  sort?: any[];
  _source?: string[];
  highlight?: any;
}): Promise<any> {
  const res = await client.search({
    index: params.index,
    query: params.query,
    size: params.size,
    from: params.from,
    sort: params.sort,
    _source: params._source,
    highlight: params.highlight,
  });

  return {
    total: typeof res.hits.total === "number" ? res.hits.total : res.hits.total?.value,
    max_score: res.hits.max_score,
    hits: res.hits.hits.map((h: any) => ({
      _id: h._id,
      _index: h._index,
      _score: h._score,
      _source: h._source,
      highlight: h.highlight,
    })),
    took: res.took,
  };
}

async function getDocument(params: {
  index: string;
  id: string;
  _source?: string[];
}): Promise<any> {
  try {
    const res = await client.get({
      index: params.index,
      id: params.id,
      _source: params._source,
    });
    return {
      _id: res._id,
      _index: res._index,
      _version: res._version,
      _source: res._source,
      found: res.found,
    };
  } catch (error: any) {
    if (error.meta?.statusCode === 404) {
      return { found: false, _id: params.id, _index: params.index };
    }
    throw error;
  }
}

async function indexDocument(params: {
  index: string;
  id?: string;
  document: any;
  refresh?: boolean;
  pipeline?: string;
}): Promise<any> {
  const res = await client.index({
    index: params.index,
    id: params.id,
    document: params.document,
    refresh: params.refresh,
    pipeline: params.pipeline,
  });
  return {
    _id: res._id,
    _index: res._index,
    _version: res._version,
    result: res.result,
  };
}

async function updateDocument(params: {
  index: string;
  id: string;
  doc?: any;
  script?: any;
  upsert?: any;
  refresh?: boolean;
}): Promise<any> {
  const body: any = {};
  if (params.doc) body.doc = params.doc;
  if (params.script) body.script = params.script;
  if (params.upsert) body.upsert = params.upsert;

  const res = await client.update({
    index: params.index,
    id: params.id,
    ...body,
    refresh: params.refresh,
  });
  return {
    _id: res._id,
    _index: res._index,
    _version: res._version,
    result: res.result,
  };
}

async function deleteDocument(params: {
  index: string;
  id: string;
  refresh?: boolean;
}): Promise<any> {
  try {
    const res = await client.delete({
      index: params.index,
      id: params.id,
      refresh: params.refresh,
    });
    return {
      _id: res._id,
      _index: res._index,
      result: res.result,
    };
  } catch (error: any) {
    if (error.meta?.statusCode === 404) {
      return { result: "not_found", _id: params.id, _index: params.index };
    }
    throw error;
  }
}

async function bulk(params: {
  operations: Array<{
    action: "index" | "create" | "update" | "delete";
    index: string;
    id?: string;
    document?: any;
  }>;
  refresh?: boolean;
  pipeline?: string;
}): Promise<any> {
  const operations: any[] = [];

  for (const op of params.operations) {
    const actionMeta: any = { _index: op.index };
    if (op.id) actionMeta._id = op.id;

    switch (op.action) {
      case "index":
        operations.push({ index: actionMeta });
        operations.push(op.document || {});
        break;
      case "create":
        operations.push({ create: actionMeta });
        operations.push(op.document || {});
        break;
      case "update":
        operations.push({ update: actionMeta });
        operations.push({ doc: op.document });
        break;
      case "delete":
        operations.push({ delete: actionMeta });
        break;
    }
  }

  const res = await client.bulk({
    operations,
    refresh: params.refresh,
    pipeline: params.pipeline,
  });

  return {
    took: res.took,
    errors: res.errors,
    items_processed: res.items?.length || 0,
    items: res.errors
      ? res.items?.filter((item: any) => {
          const action = Object.keys(item)[0];
          return item[action].error;
        })
      : undefined,
  };
}

async function listIndices(params: {
  pattern?: string;
  health?: "green" | "yellow" | "red";
}): Promise<any> {
  const res = await client.cat.indices({
    index: params.pattern || "*",
    format: "json",
    health: params.health,
  });

  return {
    indices: res.map((i: any) => ({
      index: i.index,
      health: i.health,
      status: i.status,
      uuid: i.uuid,
      pri: i.pri,
      rep: i.rep,
      docs_count: i["docs.count"],
      docs_deleted: i["docs.deleted"],
      store_size: i["store.size"],
      pri_store_size: i["pri.store.size"],
    })),
    count: res.length,
  };
}

async function createIndex(params: {
  index: string;
  mappings?: any;
  settings?: any;
  aliases?: any;
}): Promise<any> {
  const body: any = {};
  if (params.mappings) body.mappings = params.mappings;
  if (params.settings) body.settings = params.settings;
  if (params.aliases) body.aliases = params.aliases;

  await client.indices.create({
    index: params.index,
    ...body,
  });

  return {
    index: params.index,
    acknowledged: true,
    shards_acknowledged: true,
  };
}

async function deleteIndex(params: { index: string }): Promise<any> {
  await client.indices.delete({ index: params.index });
  return {
    index: params.index,
    acknowledged: true,
  };
}

async function getMapping(params: { index: string }): Promise<any> {
  const res = await client.indices.getMapping({ index: params.index });
  return {
    index: params.index,
    mappings: res[params.index]?.mappings || res,
  };
}

async function putMapping(params: {
  index: string;
  properties: any;
}): Promise<any> {
  await client.indices.putMapping({
    index: params.index,
    properties: params.properties,
  });
  return {
    index: params.index,
    acknowledged: true,
  };
}

async function getSettings(params: {
  index: string;
  flat_settings?: boolean;
  include_defaults?: boolean;
}): Promise<any> {
  const res = await client.indices.getSettings({
    index: params.index,
    flat_settings: params.flat_settings,
    include_defaults: params.include_defaults,
  });
  return {
    index: params.index,
    settings: res[params.index]?.settings || res,
  };
}

async function refreshIndex(params: { index: string }): Promise<any> {
  const res = await client.indices.refresh({ index: params.index });
  return {
    index: params.index,
    _shards: res._shards,
  };
}

async function reindex(params: {
  source: { index: string; query?: any; _source?: string[] };
  dest: { index: string; pipeline?: string };
  script?: any;
  max_docs?: number;
  wait_for_completion?: boolean;
}): Promise<any> {
  const res = await client.reindex({
    source: {
      index: params.source.index,
      query: params.source.query,
      _source: params.source._source,
    },
    dest: {
      index: params.dest.index,
      pipeline: params.dest.pipeline,
    },
    script: params.script,
    max_docs: params.max_docs,
    wait_for_completion: params.wait_for_completion !== false,
  });

  if (params.wait_for_completion === false) {
    return {
      task: res.task,
      message: "Reindex started in background",
    };
  }

  return {
    took: res.took,
    total: res.total,
    created: res.created,
    updated: res.updated,
    deleted: res.deleted,
    batches: res.batches,
    failures: res.failures?.length || 0,
  };
}

async function count(params: {
  index: string;
  query?: any;
}): Promise<any> {
  const res = await client.count({
    index: params.index,
    query: params.query,
  });
  return {
    count: res.count,
    _shards: res._shards,
  };
}

async function aggregate(params: {
  index: string;
  aggs: any;
  query?: any;
  size?: number;
}): Promise<any> {
  const res = await client.search({
    index: params.index,
    query: params.query,
    aggs: params.aggs,
    size: params.size ?? 0,
  });

  return {
    aggregations: res.aggregations,
    total: typeof res.hits.total === "number" ? res.hits.total : res.hits.total?.value,
    took: res.took,
  };
}

async function scroll(params: {
  action: "start" | "next" | "clear";
  index?: string;
  query?: any;
  scroll_id?: string;
  scroll?: string;
  size?: number;
}): Promise<any> {
  const scrollTimeout = params.scroll || "1m";

  switch (params.action) {
    case "start": {
      if (!params.index) {
        throw new Error("Index is required for scroll start");
      }
      const res = await client.search({
        index: params.index,
        query: params.query,
        scroll: scrollTimeout,
        size: params.size || 100,
      });

      return {
        scroll_id: res._scroll_id,
        total: typeof res.hits.total === "number" ? res.hits.total : res.hits.total?.value,
        hits: res.hits.hits.map((h: any) => ({
          _id: h._id,
          _index: h._index,
          _source: h._source,
        })),
        hits_count: res.hits.hits.length,
      };
    }

    case "next": {
      if (!params.scroll_id) {
        throw new Error("scroll_id is required for scroll next");
      }
      const res = await client.scroll({
        scroll_id: params.scroll_id,
        scroll: scrollTimeout,
      });

      return {
        scroll_id: res._scroll_id,
        hits: res.hits.hits.map((h: any) => ({
          _id: h._id,
          _index: h._index,
          _source: h._source,
        })),
        hits_count: res.hits.hits.length,
        done: res.hits.hits.length === 0,
      };
    }

    case "clear": {
      if (!params.scroll_id) {
        throw new Error("scroll_id is required for scroll clear");
      }
      await client.clearScroll({ scroll_id: params.scroll_id });
      return {
        cleared: true,
      };
    }

    default:
      throw new Error(`Unknown scroll action: ${params.action}`);
  }
}

async function getClusterHealth(params: {
  index?: string;
  wait_for_status?: "green" | "yellow" | "red";
  timeout?: string;
}): Promise<any> {
  const res = await client.cluster.health({
    index: params.index,
    wait_for_status: params.wait_for_status,
    timeout: params.timeout,
  });

  return {
    cluster_name: res.cluster_name,
    status: res.status,
    timed_out: res.timed_out,
    number_of_nodes: res.number_of_nodes,
    number_of_data_nodes: res.number_of_data_nodes,
    active_primary_shards: res.active_primary_shards,
    active_shards: res.active_shards,
    relocating_shards: res.relocating_shards,
    initializing_shards: res.initializing_shards,
    unassigned_shards: res.unassigned_shards,
    delayed_unassigned_shards: res.delayed_unassigned_shards,
    number_of_pending_tasks: res.number_of_pending_tasks,
    number_of_in_flight_fetch: res.number_of_in_flight_fetch,
    task_max_waiting_in_queue_millis: res.task_max_waiting_in_queue_millis,
    active_shards_percent_as_number: res.active_shards_percent_as_number,
  };
}

async function getClusterStats(params: {
  node_id?: string;
}): Promise<any> {
  const res = await client.cluster.stats({
    node_id: params.node_id,
  });

  return {
    cluster_name: res.cluster_name,
    cluster_uuid: res.cluster_uuid,
    status: res.status,
    timestamp: res.timestamp,
    indices: {
      count: res.indices?.count,
      shards: res.indices?.shards,
      docs: res.indices?.docs,
      store: res.indices?.store,
      fielddata: res.indices?.fielddata,
      query_cache: res.indices?.query_cache,
    },
    nodes: {
      count: res.nodes?.count,
      versions: res.nodes?.versions,
      os: {
        available_processors: res.nodes?.os?.available_processors,
        mem: res.nodes?.os?.mem,
      },
      jvm: {
        max_uptime_in_millis: res.nodes?.jvm?.max_uptime_in_millis,
        mem: res.nodes?.jvm?.mem,
      },
      fs: res.nodes?.fs,
    },
  };
}

async function analyzeText(params: {
  index?: string;
  analyzer?: string;
  text: string;
  field?: string;
  tokenizer?: string;
  filter?: string[];
  char_filter?: string[];
}): Promise<any> {
  const body: any = { text: params.text };

  if (params.analyzer) body.analyzer = params.analyzer;
  if (params.field) body.field = params.field;
  if (params.tokenizer) body.tokenizer = params.tokenizer;
  if (params.filter) body.filter = params.filter;
  if (params.char_filter) body.char_filter = params.char_filter;

  const res = await client.indices.analyze({
    index: params.index,
    ...body,
  });

  return {
    tokens: res.tokens?.map((t: any) => ({
      token: t.token,
      start_offset: t.start_offset,
      end_offset: t.end_offset,
      type: t.type,
      position: t.position,
    })),
    token_count: res.tokens?.length || 0,
  };
}

// =============================================================================
// Server Setup
// =============================================================================

const server = new Server(
  {
    name: "elasticsearch-mcp",
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
      // Document Operations
      case "search":
        result = await search(args as any);
        break;
      case "get_document":
        result = await getDocument(args as any);
        break;
      case "index_document":
        result = await indexDocument(args as any);
        break;
      case "update_document":
        result = await updateDocument(args as any);
        break;
      case "delete_document":
        result = await deleteDocument(args as any);
        break;
      case "bulk":
        result = await bulk(args as any);
        break;

      // Index Operations
      case "list_indices":
        result = await listIndices(args as any);
        break;
      case "create_index":
        result = await createIndex(args as any);
        break;
      case "delete_index":
        result = await deleteIndex(args as any);
        break;
      case "get_mapping":
        result = await getMapping(args as any);
        break;
      case "put_mapping":
        result = await putMapping(args as any);
        break;
      case "get_settings":
        result = await getSettings(args as any);
        break;
      case "refresh_index":
        result = await refreshIndex(args as any);
        break;
      case "reindex":
        result = await reindex(args as any);
        break;

      // Search Operations
      case "count":
        result = await count(args as any);
        break;
      case "aggregate":
        result = await aggregate(args as any);
        break;
      case "scroll":
        result = await scroll(args as any);
        break;

      // Cluster Operations
      case "get_cluster_health":
        result = await getClusterHealth(args as any);
        break;
      case "get_cluster_stats":
        result = await getClusterStats(args as any);
        break;

      // Analysis
      case "analyze_text":
        result = await analyzeText(args as any);
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (error: any) {
    const errorResponse: any = {
      error: error.message,
    };

    // Include Elasticsearch-specific error details if available
    if (error.meta?.body?.error) {
      errorResponse.elasticsearch_error = {
        type: error.meta.body.error.type,
        reason: error.meta.body.error.reason,
        status: error.meta.statusCode,
      };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(errorResponse, null, 2) }],
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
  console.error("Elasticsearch MCP Server running on stdio");
  console.error(`Connected to: ${config.node}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
