/**
 * PostgreSQL MCP Server
 *
 * Database operations for KOSMOS agents including:
 * - Query execution (read-only and write)
 * - Schema introspection
 * - Transaction management
 * - Connection pool management
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { Pool, PoolClient, QueryResult } from "pg";

// Environment configuration
const DATABASE_URL = process.env.DATABASE_URL || "postgresql://kosmos:kosmos@localhost:5432/kosmos";
const MAX_CONNECTIONS = parseInt(process.env.PG_MAX_CONNECTIONS || "20");
const QUERY_TIMEOUT_MS = parseInt(process.env.PG_QUERY_TIMEOUT || "30000");

// Create connection pool
const pool = new Pool({
  connectionString: DATABASE_URL,
  max: MAX_CONNECTIONS,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Tool schemas
const QuerySchema = z.object({
  sql: z.string().describe("SQL query to execute"),
  params: z.array(z.unknown()).optional().describe("Query parameters"),
  readonly: z.boolean().default(true).describe("Whether query is read-only"),
});

const TransactionSchema = z.object({
  queries: z.array(z.object({
    sql: z.string(),
    params: z.array(z.unknown()).optional(),
  })).describe("Queries to execute in transaction"),
  isolation: z.enum(["read_committed", "repeatable_read", "serializable"]).default("read_committed"),
});

const SchemaInspectSchema = z.object({
  schema: z.string().default("public").describe("Schema to inspect"),
  table: z.string().optional().describe("Specific table to inspect"),
});

const TableStatsSchema = z.object({
  table: z.string().describe("Table name"),
  schema: z.string().default("public"),
});

const VectorSearchSchema = z.object({
  table: z.string().describe("Table with vector column"),
  vectorColumn: z.string().default("embedding"),
  queryVector: z.array(z.number()).describe("Query embedding vector"),
  limit: z.number().default(10),
  threshold: z.number().default(0.7).describe("Similarity threshold"),
  selectColumns: z.array(z.string()).optional(),
});

const FullTextSearchSchema = z.object({
  table: z.string(),
  searchColumn: z.string(),
  query: z.string(),
  limit: z.number().default(20),
  rankColumn: z.string().optional(),
});

// Tool definitions
const TOOLS: Tool[] = [
  {
    name: "query",
    description: "Execute a SQL query against the PostgreSQL database",
    inputSchema: {
      type: "object",
      properties: {
        sql: {
          type: "string",
          description: "SQL query to execute",
        },
        params: {
          type: "array",
          description: "Query parameters (use $1, $2, etc. in SQL)",
        },
        readonly: {
          type: "boolean",
          default: true,
          description: "Set to false for INSERT/UPDATE/DELETE queries",
        },
      },
      required: ["sql"],
    },
  },
  {
    name: "transaction",
    description: "Execute multiple queries in a transaction",
    inputSchema: {
      type: "object",
      properties: {
        queries: {
          type: "array",
          items: {
            type: "object",
            properties: {
              sql: { type: "string" },
              params: { type: "array" },
            },
            required: ["sql"],
          },
          description: "Queries to execute in order",
        },
        isolation: {
          type: "string",
          enum: ["read_committed", "repeatable_read", "serializable"],
          default: "read_committed",
        },
      },
      required: ["queries"],
    },
  },
  {
    name: "inspect_schema",
    description: "Get schema information including tables, columns, and indexes",
    inputSchema: {
      type: "object",
      properties: {
        schema: {
          type: "string",
          default: "public",
          description: "Schema name to inspect",
        },
        table: {
          type: "string",
          description: "Specific table to inspect (optional)",
        },
      },
    },
  },
  {
    name: "table_stats",
    description: "Get statistics for a table (row count, size, index usage)",
    inputSchema: {
      type: "object",
      properties: {
        table: {
          type: "string",
          description: "Table name",
        },
        schema: {
          type: "string",
          default: "public",
        },
      },
      required: ["table"],
    },
  },
  {
    name: "vector_search",
    description: "Perform vector similarity search using pgvector",
    inputSchema: {
      type: "object",
      properties: {
        table: {
          type: "string",
          description: "Table containing embeddings",
        },
        vectorColumn: {
          type: "string",
          default: "embedding",
        },
        queryVector: {
          type: "array",
          items: { type: "number" },
          description: "Query embedding vector",
        },
        limit: {
          type: "number",
          default: 10,
        },
        threshold: {
          type: "number",
          default: 0.7,
          description: "Minimum similarity threshold (0-1)",
        },
        selectColumns: {
          type: "array",
          items: { type: "string" },
          description: "Columns to return",
        },
      },
      required: ["table", "queryVector"],
    },
  },
  {
    name: "full_text_search",
    description: "Perform full-text search using PostgreSQL FTS",
    inputSchema: {
      type: "object",
      properties: {
        table: {
          type: "string",
        },
        searchColumn: {
          type: "string",
          description: "Column with tsvector or text",
        },
        query: {
          type: "string",
          description: "Search query",
        },
        limit: {
          type: "number",
          default: 20,
        },
        rankColumn: {
          type: "string",
          description: "Column for relevance ranking",
        },
      },
      required: ["table", "searchColumn", "query"],
    },
  },
  {
    name: "health_check",
    description: "Check database connection health",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

// Tool implementations
async function executeQuery(params: z.infer<typeof QuerySchema>): Promise<any> {
  const client = await pool.connect();
  try {
    // Set query timeout
    await client.query(`SET statement_timeout = ${QUERY_TIMEOUT_MS}`);

    // For read-only queries, use read-only transaction
    if (params.readonly) {
      await client.query("BEGIN READ ONLY");
    }

    const result = await client.query(params.sql, params.params || []);

    if (params.readonly) {
      await client.query("COMMIT");
    }

    return {
      success: true,
      rowCount: result.rowCount,
      rows: result.rows,
      fields: result.fields.map(f => ({
        name: f.name,
        dataTypeID: f.dataTypeID,
      })),
    };
  } catch (error) {
    if (params.readonly) {
      await client.query("ROLLBACK").catch(() => {});
    }
    throw error;
  } finally {
    client.release();
  }
}

async function executeTransaction(params: z.infer<typeof TransactionSchema>): Promise<any> {
  const client = await pool.connect();
  const results: any[] = [];

  try {
    // Start transaction with isolation level
    const isolationLevel = params.isolation.replace("_", " ").toUpperCase();
    await client.query(`BEGIN ISOLATION LEVEL ${isolationLevel}`);

    for (const query of params.queries) {
      const result = await client.query(query.sql, query.params || []);
      results.push({
        rowCount: result.rowCount,
        rows: result.rows,
      });
    }

    await client.query("COMMIT");

    return {
      success: true,
      transactionId: `txn_${Date.now()}`,
      results,
      queriesExecuted: params.queries.length,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function inspectSchema(params: z.infer<typeof SchemaInspectSchema>): Promise<any> {
  const client = await pool.connect();
  try {
    if (params.table) {
      // Get specific table info
      const columnsResult = await client.query(`
        SELECT
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length
        FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
        ORDER BY ordinal_position
      `, [params.schema, params.table]);

      const indexesResult = await client.query(`
        SELECT
          indexname,
          indexdef
        FROM pg_indexes
        WHERE schemaname = $1 AND tablename = $2
      `, [params.schema, params.table]);

      const constraintsResult = await client.query(`
        SELECT
          conname AS constraint_name,
          contype AS constraint_type,
          pg_get_constraintdef(oid) AS definition
        FROM pg_constraint
        WHERE conrelid = ($1 || '.' || $2)::regclass
      `, [params.schema, params.table]);

      return {
        table: params.table,
        schema: params.schema,
        columns: columnsResult.rows,
        indexes: indexesResult.rows,
        constraints: constraintsResult.rows,
      };
    } else {
      // Get all tables in schema
      const tablesResult = await client.query(`
        SELECT
          table_name,
          table_type
        FROM information_schema.tables
        WHERE table_schema = $1
        ORDER BY table_name
      `, [params.schema]);

      return {
        schema: params.schema,
        tables: tablesResult.rows,
        tableCount: tablesResult.rowCount,
      };
    }
  } finally {
    client.release();
  }
}

async function getTableStats(params: z.infer<typeof TableStatsSchema>): Promise<any> {
  const client = await pool.connect();
  try {
    const fullTableName = `${params.schema}.${params.table}`;

    // Get table statistics
    const statsResult = await client.query(`
      SELECT
        pg_size_pretty(pg_total_relation_size($1)) AS total_size,
        pg_size_pretty(pg_relation_size($1)) AS table_size,
        pg_size_pretty(pg_indexes_size($1::regclass)) AS index_size,
        (SELECT reltuples::bigint FROM pg_class WHERE oid = $1::regclass) AS estimated_row_count
    `, [fullTableName]);

    // Get index usage
    const indexUsageResult = await client.query(`
      SELECT
        indexrelname AS index_name,
        idx_scan AS scans,
        idx_tup_read AS tuples_read,
        idx_tup_fetch AS tuples_fetched
      FROM pg_stat_user_indexes
      WHERE schemaname = $1 AND relname = $2
    `, [params.schema, params.table]);

    // Get sequential vs index scan ratio
    const scanStatsResult = await client.query(`
      SELECT
        seq_scan,
        seq_tup_read,
        idx_scan,
        idx_tup_fetch,
        n_tup_ins AS inserts,
        n_tup_upd AS updates,
        n_tup_del AS deletes,
        n_live_tup AS live_tuples,
        n_dead_tup AS dead_tuples
      FROM pg_stat_user_tables
      WHERE schemaname = $1 AND relname = $2
    `, [params.schema, params.table]);

    return {
      table: params.table,
      schema: params.schema,
      size: statsResult.rows[0],
      indexUsage: indexUsageResult.rows,
      scanStats: scanStatsResult.rows[0],
    };
  } finally {
    client.release();
  }
}

async function vectorSearch(params: z.infer<typeof VectorSearchSchema>): Promise<any> {
  const client = await pool.connect();
  try {
    const selectCols = params.selectColumns?.length
      ? params.selectColumns.join(", ")
      : "*";

    // Convert array to pgvector format
    const vectorStr = `[${params.queryVector.join(",")}]`;

    const result = await client.query(`
      SELECT
        ${selectCols},
        1 - (${params.vectorColumn} <=> $1::vector) AS similarity
      FROM ${params.table}
      WHERE 1 - (${params.vectorColumn} <=> $1::vector) >= $2
      ORDER BY ${params.vectorColumn} <=> $1::vector
      LIMIT $3
    `, [vectorStr, params.threshold, params.limit]);

    return {
      success: true,
      matches: result.rows,
      count: result.rowCount,
      threshold: params.threshold,
    };
  } finally {
    client.release();
  }
}

async function fullTextSearch(params: z.infer<typeof FullTextSearchSchema>): Promise<any> {
  const client = await pool.connect();
  try {
    const rankExpression = params.rankColumn
      ? `ts_rank(${params.rankColumn}, plainto_tsquery($1))`
      : `ts_rank(to_tsvector(${params.searchColumn}), plainto_tsquery($1))`;

    const result = await client.query(`
      SELECT
        *,
        ${rankExpression} AS rank
      FROM ${params.table}
      WHERE to_tsvector(${params.searchColumn}) @@ plainto_tsquery($1)
      ORDER BY rank DESC
      LIMIT $2
    `, [params.query, params.limit]);

    return {
      success: true,
      results: result.rows,
      count: result.rowCount,
      query: params.query,
    };
  } finally {
    client.release();
  }
}

async function healthCheck(): Promise<any> {
  const client = await pool.connect();
  try {
    const start = Date.now();
    await client.query("SELECT 1");
    const latency = Date.now() - start;

    const poolStats = {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
    };

    return {
      status: "healthy",
      latencyMs: latency,
      pool: poolStats,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: "unhealthy",
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    };
  } finally {
    client.release();
  }
}

// Create server
const server = new Server(
  {
    name: "postgres-mcp-server",
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
    let result;

    switch (name) {
      case "query":
        result = await executeQuery(QuerySchema.parse(args));
        break;
      case "transaction":
        result = await executeTransaction(TransactionSchema.parse(args));
        break;
      case "inspect_schema":
        result = await inspectSchema(SchemaInspectSchema.parse(args));
        break;
      case "table_stats":
        result = await getTableStats(TableStatsSchema.parse(args));
        break;
      case "vector_search":
        result = await vectorSearch(VectorSearchSchema.parse(args));
        break;
      case "full_text_search":
        result = await fullTextSearch(FullTextSearchSchema.parse(args));
        break;
      case "health_check":
        result = await healthCheck();
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

// Graceful shutdown
process.on("SIGINT", async () => {
  console.error("Shutting down...");
  await pool.end();
  process.exit(0);
});

// Start
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("PostgreSQL MCP Server started");
}

main().catch(console.error);
