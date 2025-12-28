/**
 * MongoDB MCP Server
 *
 * Provides MongoDB document database operations for KOSMOS agents.
 * Features:
 * - Database and collection management
 * - CRUD operations (find, insert, update, delete)
 * - Aggregation pipelines
 * - Index management
 * - Database commands
 *
 * Authentication: Uses MONGODB_URI and MONGODB_DATABASE environment variables.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { MongoClient, Db, Document, IndexSpecification, CreateIndexesOptions } from "mongodb";

// =============================================================================
// Configuration
// =============================================================================

const config = {
  uri: process.env.MONGODB_URI || "mongodb://localhost:27017",
  database: process.env.MONGODB_DATABASE || "kosmos",
};

let client: MongoClient | null = null;

async function getClient(): Promise<MongoClient> {
  if (!client) {
    client = new MongoClient(config.uri);
    await client.connect();
  }
  return client;
}

function getDb(database?: string): Promise<Db> {
  return getClient().then((c) => c.db(database || config.database));
}

// =============================================================================
// Tool Definitions
// =============================================================================

const TOOLS: Tool[] = [
  // Database Operations
  {
    name: "list_databases",
    description: "List all databases on the MongoDB server.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "list_collections",
    description: "List all collections in a database.",
    inputSchema: {
      type: "object",
      properties: {
        database: {
          type: "string",
          description: "Database name (optional, uses default if not specified)",
        },
      },
    },
  },
  // Document Operations - Read
  {
    name: "find",
    description: "Find documents matching a query filter.",
    inputSchema: {
      type: "object",
      properties: {
        database: { type: "string", description: "Database name (optional)" },
        collection: { type: "string", description: "Collection name" },
        filter: { type: "object", description: "Query filter (MongoDB query syntax)" },
        projection: { type: "object", description: "Fields to include/exclude" },
        sort: { type: "object", description: "Sort specification (e.g., {field: 1} for ascending)" },
        limit: { type: "number", description: "Maximum documents to return" },
        skip: { type: "number", description: "Number of documents to skip" },
      },
      required: ["collection"],
    },
  },
  {
    name: "find_one",
    description: "Find a single document matching a query filter.",
    inputSchema: {
      type: "object",
      properties: {
        database: { type: "string", description: "Database name (optional)" },
        collection: { type: "string", description: "Collection name" },
        filter: { type: "object", description: "Query filter (MongoDB query syntax)" },
        projection: { type: "object", description: "Fields to include/exclude" },
      },
      required: ["collection"],
    },
  },
  // Document Operations - Write
  {
    name: "insert_one",
    description: "Insert a single document into a collection.",
    inputSchema: {
      type: "object",
      properties: {
        database: { type: "string", description: "Database name (optional)" },
        collection: { type: "string", description: "Collection name" },
        document: { type: "object", description: "Document to insert" },
      },
      required: ["collection", "document"],
    },
  },
  {
    name: "insert_many",
    description: "Insert multiple documents into a collection.",
    inputSchema: {
      type: "object",
      properties: {
        database: { type: "string", description: "Database name (optional)" },
        collection: { type: "string", description: "Collection name" },
        documents: {
          type: "array",
          items: { type: "object" },
          description: "Array of documents to insert",
        },
        ordered: {
          type: "boolean",
          description: "If true, stop on first error (default: true)",
        },
      },
      required: ["collection", "documents"],
    },
  },
  {
    name: "update_one",
    description: "Update a single document matching a filter.",
    inputSchema: {
      type: "object",
      properties: {
        database: { type: "string", description: "Database name (optional)" },
        collection: { type: "string", description: "Collection name" },
        filter: { type: "object", description: "Query filter to match document" },
        update: { type: "object", description: "Update operations (e.g., {$set: {...}})" },
        upsert: { type: "boolean", description: "Create document if not found" },
      },
      required: ["collection", "filter", "update"],
    },
  },
  {
    name: "update_many",
    description: "Update multiple documents matching a filter.",
    inputSchema: {
      type: "object",
      properties: {
        database: { type: "string", description: "Database name (optional)" },
        collection: { type: "string", description: "Collection name" },
        filter: { type: "object", description: "Query filter to match documents" },
        update: { type: "object", description: "Update operations (e.g., {$set: {...}})" },
        upsert: { type: "boolean", description: "Create document if not found" },
      },
      required: ["collection", "filter", "update"],
    },
  },
  {
    name: "delete_one",
    description: "Delete a single document matching a filter.",
    inputSchema: {
      type: "object",
      properties: {
        database: { type: "string", description: "Database name (optional)" },
        collection: { type: "string", description: "Collection name" },
        filter: { type: "object", description: "Query filter to match document" },
      },
      required: ["collection", "filter"],
    },
  },
  {
    name: "delete_many",
    description: "Delete multiple documents matching a filter.",
    inputSchema: {
      type: "object",
      properties: {
        database: { type: "string", description: "Database name (optional)" },
        collection: { type: "string", description: "Collection name" },
        filter: { type: "object", description: "Query filter to match documents" },
      },
      required: ["collection", "filter"],
    },
  },
  // Aggregation
  {
    name: "aggregate",
    description: "Run an aggregation pipeline on a collection.",
    inputSchema: {
      type: "object",
      properties: {
        database: { type: "string", description: "Database name (optional)" },
        collection: { type: "string", description: "Collection name" },
        pipeline: {
          type: "array",
          description: "Aggregation pipeline stages (e.g., [{$match: ...}, {$group: ...}])",
        },
        options: { type: "object", description: "Aggregation options" },
      },
      required: ["collection", "pipeline"],
    },
  },
  {
    name: "count_documents",
    description: "Count documents matching a filter.",
    inputSchema: {
      type: "object",
      properties: {
        database: { type: "string", description: "Database name (optional)" },
        collection: { type: "string", description: "Collection name" },
        filter: { type: "object", description: "Query filter (optional, counts all if empty)" },
      },
      required: ["collection"],
    },
  },
  {
    name: "distinct",
    description: "Get distinct values for a field across matching documents.",
    inputSchema: {
      type: "object",
      properties: {
        database: { type: "string", description: "Database name (optional)" },
        collection: { type: "string", description: "Collection name" },
        field: { type: "string", description: "Field to get distinct values for" },
        filter: { type: "object", description: "Query filter (optional)" },
      },
      required: ["collection", "field"],
    },
  },
  // Index Operations
  {
    name: "create_index",
    description: "Create an index on a collection.",
    inputSchema: {
      type: "object",
      properties: {
        database: { type: "string", description: "Database name (optional)" },
        collection: { type: "string", description: "Collection name" },
        keys: {
          type: "object",
          description: "Index keys specification (e.g., {field: 1} for ascending)",
        },
        options: {
          type: "object",
          description: "Index options (e.g., {unique: true, name: 'myIndex'})",
        },
      },
      required: ["collection", "keys"],
    },
  },
  {
    name: "list_indexes",
    description: "List all indexes on a collection.",
    inputSchema: {
      type: "object",
      properties: {
        database: { type: "string", description: "Database name (optional)" },
        collection: { type: "string", description: "Collection name" },
      },
      required: ["collection"],
    },
  },
  {
    name: "drop_index",
    description: "Drop an index from a collection.",
    inputSchema: {
      type: "object",
      properties: {
        database: { type: "string", description: "Database name (optional)" },
        collection: { type: "string", description: "Collection name" },
        indexName: { type: "string", description: "Name of the index to drop" },
      },
      required: ["collection", "indexName"],
    },
  },
  // Collection Operations
  {
    name: "create_collection",
    description: "Create a new collection.",
    inputSchema: {
      type: "object",
      properties: {
        database: { type: "string", description: "Database name (optional)" },
        collection: { type: "string", description: "Collection name to create" },
        options: {
          type: "object",
          description: "Collection options (e.g., {capped: true, size: 10000})",
        },
      },
      required: ["collection"],
    },
  },
  {
    name: "drop_collection",
    description: "Drop (delete) a collection and all its documents.",
    inputSchema: {
      type: "object",
      properties: {
        database: { type: "string", description: "Database name (optional)" },
        collection: { type: "string", description: "Collection name to drop" },
      },
      required: ["collection"],
    },
  },
  {
    name: "get_stats",
    description: "Get statistics for a collection (size, count, indexes, etc.).",
    inputSchema: {
      type: "object",
      properties: {
        database: { type: "string", description: "Database name (optional)" },
        collection: { type: "string", description: "Collection name" },
      },
      required: ["collection"],
    },
  },
  // Database Commands
  {
    name: "run_command",
    description: "Run a database command directly.",
    inputSchema: {
      type: "object",
      properties: {
        database: { type: "string", description: "Database name (optional)" },
        command: { type: "object", description: "Command document to execute" },
      },
      required: ["command"],
    },
  },
];

// =============================================================================
// Tool Implementations
// =============================================================================

async function listDatabases(): Promise<Document> {
  const c = await getClient();
  const result = await c.db().admin().listDatabases();
  return {
    databases: result.databases.map((db) => ({
      name: db.name,
      sizeOnDisk: db.sizeOnDisk,
      empty: db.empty,
    })),
    totalSize: result.totalSize,
  };
}

async function listCollections(params: { database?: string }): Promise<Document> {
  const db = await getDb(params.database);
  const collections = await db.listCollections().toArray();
  return {
    database: params.database || config.database,
    collections: collections.map((col) => ({
      name: col.name,
      type: col.type,
      options: col.options,
    })),
  };
}

async function find(params: {
  database?: string;
  collection: string;
  filter?: Document;
  projection?: Document;
  sort?: Document;
  limit?: number;
  skip?: number;
}): Promise<Document> {
  const db = await getDb(params.database);
  let cursor = db.collection(params.collection).find(params.filter || {}, {
    projection: params.projection,
  });
  if (params.sort) cursor = cursor.sort(params.sort);
  if (params.skip) cursor = cursor.skip(params.skip);
  if (params.limit) cursor = cursor.limit(params.limit);
  const documents = await cursor.toArray();
  return { documents, count: documents.length };
}

async function findOne(params: {
  database?: string;
  collection: string;
  filter?: Document;
  projection?: Document;
}): Promise<Document> {
  const db = await getDb(params.database);
  const document = await db
    .collection(params.collection)
    .findOne(params.filter || {}, { projection: params.projection });
  return { document };
}

async function insertOne(params: {
  database?: string;
  collection: string;
  document: Document;
}): Promise<Document> {
  const db = await getDb(params.database);
  const result = await db.collection(params.collection).insertOne(params.document);
  return {
    insertedId: result.insertedId.toString(),
    acknowledged: result.acknowledged,
  };
}

async function insertMany(params: {
  database?: string;
  collection: string;
  documents: Document[];
  ordered?: boolean;
}): Promise<Document> {
  const db = await getDb(params.database);
  const result = await db.collection(params.collection).insertMany(params.documents, {
    ordered: params.ordered !== false,
  });
  return {
    insertedCount: result.insertedCount,
    insertedIds: Object.values(result.insertedIds).map((id) => id.toString()),
    acknowledged: result.acknowledged,
  };
}

async function updateOne(params: {
  database?: string;
  collection: string;
  filter: Document;
  update: Document;
  upsert?: boolean;
}): Promise<Document> {
  const db = await getDb(params.database);
  const result = await db.collection(params.collection).updateOne(params.filter, params.update, {
    upsert: params.upsert,
  });
  return {
    matchedCount: result.matchedCount,
    modifiedCount: result.modifiedCount,
    upsertedId: result.upsertedId?.toString(),
    acknowledged: result.acknowledged,
  };
}

async function updateMany(params: {
  database?: string;
  collection: string;
  filter: Document;
  update: Document;
  upsert?: boolean;
}): Promise<Document> {
  const db = await getDb(params.database);
  const result = await db.collection(params.collection).updateMany(params.filter, params.update, {
    upsert: params.upsert,
  });
  return {
    matchedCount: result.matchedCount,
    modifiedCount: result.modifiedCount,
    upsertedCount: result.upsertedCount,
    acknowledged: result.acknowledged,
  };
}

async function deleteOne(params: {
  database?: string;
  collection: string;
  filter: Document;
}): Promise<Document> {
  const db = await getDb(params.database);
  const result = await db.collection(params.collection).deleteOne(params.filter);
  return {
    deletedCount: result.deletedCount,
    acknowledged: result.acknowledged,
  };
}

async function deleteMany(params: {
  database?: string;
  collection: string;
  filter: Document;
}): Promise<Document> {
  const db = await getDb(params.database);
  const result = await db.collection(params.collection).deleteMany(params.filter);
  return {
    deletedCount: result.deletedCount,
    acknowledged: result.acknowledged,
  };
}

async function aggregate(params: {
  database?: string;
  collection: string;
  pipeline: Document[];
  options?: Document;
}): Promise<Document> {
  const db = await getDb(params.database);
  const results = await db
    .collection(params.collection)
    .aggregate(params.pipeline, params.options)
    .toArray();
  return { results, count: results.length };
}

async function countDocuments(params: {
  database?: string;
  collection: string;
  filter?: Document;
}): Promise<Document> {
  const db = await getDb(params.database);
  const count = await db.collection(params.collection).countDocuments(params.filter || {});
  return { count };
}

async function distinct(params: {
  database?: string;
  collection: string;
  field: string;
  filter?: Document;
}): Promise<Document> {
  const db = await getDb(params.database);
  const values = await db.collection(params.collection).distinct(params.field, params.filter || {});
  return { field: params.field, values, count: values.length };
}

async function createIndex(params: {
  database?: string;
  collection: string;
  keys: IndexSpecification;
  options?: CreateIndexesOptions;
}): Promise<Document> {
  const db = await getDb(params.database);
  const indexName = await db.collection(params.collection).createIndex(params.keys, params.options);
  return { indexName, created: true };
}

async function listIndexes(params: {
  database?: string;
  collection: string;
}): Promise<Document> {
  const db = await getDb(params.database);
  const indexes = await db.collection(params.collection).indexes();
  return { collection: params.collection, indexes };
}

async function dropIndex(params: {
  database?: string;
  collection: string;
  indexName: string;
}): Promise<Document> {
  const db = await getDb(params.database);
  await db.collection(params.collection).dropIndex(params.indexName);
  return { indexName: params.indexName, dropped: true };
}

async function createCollection(params: {
  database?: string;
  collection: string;
  options?: Document;
}): Promise<Document> {
  const db = await getDb(params.database);
  await db.createCollection(params.collection, params.options);
  return { collection: params.collection, created: true };
}

async function dropCollection(params: {
  database?: string;
  collection: string;
}): Promise<Document> {
  const db = await getDb(params.database);
  const result = await db.collection(params.collection).drop();
  return { collection: params.collection, dropped: result };
}

async function getStats(params: {
  database?: string;
  collection: string;
}): Promise<Document> {
  const db = await getDb(params.database);
  const stats = await db.command({ collStats: params.collection });
  return {
    collection: params.collection,
    size: stats.size,
    count: stats.count,
    avgObjSize: stats.avgObjSize,
    storageSize: stats.storageSize,
    totalIndexSize: stats.totalIndexSize,
    indexCount: stats.nindexes,
    indexes: stats.indexSizes,
  };
}

async function runCommand(params: {
  database?: string;
  command: Document;
}): Promise<Document> {
  const db = await getDb(params.database);
  const result = await db.command(params.command);
  return result;
}

// =============================================================================
// Server Setup
// =============================================================================

const server = new Server(
  {
    name: "mongodb-mcp",
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
    let result: Document;

    switch (name) {
      case "list_databases":
        result = await listDatabases();
        break;
      case "list_collections":
        result = await listCollections(args as any);
        break;
      case "find":
        result = await find(args as any);
        break;
      case "find_one":
        result = await findOne(args as any);
        break;
      case "insert_one":
        result = await insertOne(args as any);
        break;
      case "insert_many":
        result = await insertMany(args as any);
        break;
      case "update_one":
        result = await updateOne(args as any);
        break;
      case "update_many":
        result = await updateMany(args as any);
        break;
      case "delete_one":
        result = await deleteOne(args as any);
        break;
      case "delete_many":
        result = await deleteMany(args as any);
        break;
      case "aggregate":
        result = await aggregate(args as any);
        break;
      case "count_documents":
        result = await countDocuments(args as any);
        break;
      case "distinct":
        result = await distinct(args as any);
        break;
      case "create_index":
        result = await createIndex(args as any);
        break;
      case "list_indexes":
        result = await listIndexes(args as any);
        break;
      case "drop_index":
        result = await dropIndex(args as any);
        break;
      case "create_collection":
        result = await createCollection(args as any);
        break;
      case "drop_collection":
        result = await dropCollection(args as any);
        break;
      case "get_stats":
        result = await getStats(args as any);
        break;
      case "run_command":
        result = await runCommand(args as any);
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
  console.error("MongoDB MCP Server running on stdio");
  console.error(`URI: ${config.uri}`);
  console.error(`Default database: ${config.database}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
