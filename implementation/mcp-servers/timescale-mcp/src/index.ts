/**
 * TimescaleDB MCP Server
 *
 * Time-series database operations for KOSMOS agents including:
 * - Hypertable management
 * - Compression and retention policies
 * - Continuous aggregates
 * - Time bucket queries
 * - Chunk management
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { Pool } from "pg";

// Environment configuration
const TIMESCALE_HOST = process.env.TIMESCALE_HOST || "localhost";
const TIMESCALE_PORT = parseInt(process.env.TIMESCALE_PORT || "5432");
const TIMESCALE_USER = process.env.TIMESCALE_USER || "postgres";
const TIMESCALE_PASSWORD = process.env.TIMESCALE_PASSWORD || "postgres";
const TIMESCALE_DATABASE = process.env.TIMESCALE_DATABASE || "timescaledb";
const MAX_CONNECTIONS = parseInt(process.env.TIMESCALE_MAX_CONNECTIONS || "20");
const QUERY_TIMEOUT_MS = parseInt(process.env.TIMESCALE_QUERY_TIMEOUT || "30000");

// Create connection pool
const pool = new Pool({
  host: TIMESCALE_HOST,
  port: TIMESCALE_PORT,
  user: TIMESCALE_USER,
  password: TIMESCALE_PASSWORD,
  database: TIMESCALE_DATABASE,
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

const CreateHypertableSchema = z.object({
  table: z.string().describe("Table name to convert to hypertable"),
  timeColumn: z.string().describe("Name of the time column"),
  schema: z.string().default("public").describe("Schema name"),
  chunkTimeInterval: z.string().optional().describe("Chunk time interval (e.g., '1 day', '1 week')"),
  ifNotExists: z.boolean().default(true).describe("Don't error if hypertable already exists"),
  migrateData: z.boolean().default(true).describe("Migrate existing data"),
});

const ListHypertablesSchema = z.object({
  schema: z.string().optional().describe("Filter by schema name"),
});

const GetHypertableInfoSchema = z.object({
  table: z.string().describe("Hypertable name"),
  schema: z.string().default("public").describe("Schema name"),
});

const AddCompressionPolicySchema = z.object({
  table: z.string().describe("Hypertable name"),
  schema: z.string().default("public").describe("Schema name"),
  compressAfter: z.string().describe("Compress chunks older than interval (e.g., '7 days')"),
  scheduleInterval: z.string().optional().describe("How often to run compression (e.g., '1 day')"),
});

const AddRetentionPolicySchema = z.object({
  table: z.string().describe("Hypertable name"),
  schema: z.string().default("public").describe("Schema name"),
  dropAfter: z.string().describe("Drop chunks older than interval (e.g., '90 days')"),
  scheduleInterval: z.string().optional().describe("How often to run retention (e.g., '1 day')"),
});

const ListPoliciesSchema = z.object({
  table: z.string().optional().describe("Filter by hypertable name"),
  schema: z.string().optional().describe("Filter by schema name"),
  policyType: z.enum(["compression", "retention", "all"]).default("all").describe("Type of policies to list"),
});

const RemovePolicySchema = z.object({
  table: z.string().describe("Hypertable name"),
  schema: z.string().default("public").describe("Schema name"),
  policyType: z.enum(["compression", "retention"]).describe("Type of policy to remove"),
  ifExists: z.boolean().default(true).describe("Don't error if policy doesn't exist"),
});

const CreateContinuousAggregateSchema = z.object({
  name: z.string().describe("Name for the continuous aggregate view"),
  schema: z.string().default("public").describe("Schema name"),
  sourceTable: z.string().describe("Source hypertable"),
  sourceSchema: z.string().default("public").describe("Source schema"),
  timeBucket: z.string().describe("Time bucket interval (e.g., '1 hour', '1 day')"),
  timeColumn: z.string().describe("Time column name"),
  selectColumns: z.string().describe("SELECT clause (aggregations)"),
  groupByColumns: z.array(z.string()).optional().describe("Additional GROUP BY columns"),
  whereClause: z.string().optional().describe("Optional WHERE clause"),
  withNoData: z.boolean().default(false).describe("Create without computing data"),
  materializedOnly: z.boolean().default(false).describe("Only return materialized data"),
});

const RefreshContinuousAggregateSchema = z.object({
  name: z.string().describe("Continuous aggregate name"),
  schema: z.string().default("public").describe("Schema name"),
  startTime: z.string().optional().describe("Start time for refresh window"),
  endTime: z.string().optional().describe("End time for refresh window"),
});

const ListContinuousAggregatesSchema = z.object({
  schema: z.string().optional().describe("Filter by schema name"),
});

const TimeBucketQuerySchema = z.object({
  table: z.string().describe("Table/hypertable name"),
  schema: z.string().default("public").describe("Schema name"),
  timeColumn: z.string().describe("Time column name"),
  bucket: z.string().describe("Time bucket interval (e.g., '1 hour', '5 minutes')"),
  selectColumns: z.string().describe("SELECT clause with aggregations"),
  whereClause: z.string().optional().describe("Optional WHERE clause"),
  groupByColumns: z.array(z.string()).optional().describe("Additional GROUP BY columns"),
  orderBy: z.string().optional().describe("ORDER BY clause"),
  limit: z.number().optional().describe("LIMIT clause"),
});

const GetChunkInfoSchema = z.object({
  table: z.string().describe("Hypertable name"),
  schema: z.string().default("public").describe("Schema name"),
  showCompressed: z.boolean().default(true).describe("Show compression status"),
});

const CompressChunksSchema = z.object({
  table: z.string().describe("Hypertable name"),
  schema: z.string().default("public").describe("Schema name"),
  olderThan: z.string().optional().describe("Compress chunks older than interval"),
  chunkName: z.string().optional().describe("Specific chunk name to compress"),
});

const DecompressChunksSchema = z.object({
  table: z.string().describe("Hypertable name"),
  schema: z.string().default("public").describe("Schema name"),
  chunkName: z.string().optional().describe("Specific chunk name to decompress"),
});

const GetApproximateRowCountSchema = z.object({
  table: z.string().describe("Table name"),
  schema: z.string().default("public").describe("Schema name"),
});

const AddDimensionSchema = z.object({
  table: z.string().describe("Hypertable name"),
  schema: z.string().default("public").describe("Schema name"),
  columnName: z.string().describe("Column to add as dimension"),
  numberOfPartitions: z.number().optional().describe("Number of partitions for hash dimension"),
  chunkTimeInterval: z.string().optional().describe("Interval for time dimension"),
  ifNotExists: z.boolean().default(true).describe("Don't error if dimension exists"),
});

const GetTelemetrySchema = z.object({});

const HealthCheckSchema = z.object({});

// Tool definitions
const TOOLS: Tool[] = [
  {
    name: "query",
    description: "Execute a SQL query against the TimescaleDB database",
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
    name: "create_hypertable",
    description: "Convert a regular PostgreSQL table into a TimescaleDB hypertable for time-series data",
    inputSchema: {
      type: "object",
      properties: {
        table: {
          type: "string",
          description: "Table name to convert",
        },
        timeColumn: {
          type: "string",
          description: "Name of the time column (must be TIMESTAMP, TIMESTAMPTZ, DATE, or INTEGER)",
        },
        schema: {
          type: "string",
          default: "public",
          description: "Schema name",
        },
        chunkTimeInterval: {
          type: "string",
          description: "Chunk time interval (e.g., '1 day', '1 week')",
        },
        ifNotExists: {
          type: "boolean",
          default: true,
          description: "Don't error if hypertable already exists",
        },
        migrateData: {
          type: "boolean",
          default: true,
          description: "Migrate existing data to hypertable",
        },
      },
      required: ["table", "timeColumn"],
    },
  },
  {
    name: "list_hypertables",
    description: "List all hypertables in the database",
    inputSchema: {
      type: "object",
      properties: {
        schema: {
          type: "string",
          description: "Filter by schema name",
        },
      },
    },
  },
  {
    name: "get_hypertable_info",
    description: "Get detailed information about a specific hypertable",
    inputSchema: {
      type: "object",
      properties: {
        table: {
          type: "string",
          description: "Hypertable name",
        },
        schema: {
          type: "string",
          default: "public",
          description: "Schema name",
        },
      },
      required: ["table"],
    },
  },
  {
    name: "add_compression_policy",
    description: "Add an automatic compression policy to a hypertable",
    inputSchema: {
      type: "object",
      properties: {
        table: {
          type: "string",
          description: "Hypertable name",
        },
        schema: {
          type: "string",
          default: "public",
          description: "Schema name",
        },
        compressAfter: {
          type: "string",
          description: "Compress chunks older than interval (e.g., '7 days')",
        },
        scheduleInterval: {
          type: "string",
          description: "How often to run compression job",
        },
      },
      required: ["table", "compressAfter"],
    },
  },
  {
    name: "add_retention_policy",
    description: "Add a data retention policy to automatically drop old chunks",
    inputSchema: {
      type: "object",
      properties: {
        table: {
          type: "string",
          description: "Hypertable name",
        },
        schema: {
          type: "string",
          default: "public",
          description: "Schema name",
        },
        dropAfter: {
          type: "string",
          description: "Drop chunks older than interval (e.g., '90 days')",
        },
        scheduleInterval: {
          type: "string",
          description: "How often to run retention job",
        },
      },
      required: ["table", "dropAfter"],
    },
  },
  {
    name: "list_policies",
    description: "List compression and retention policies",
    inputSchema: {
      type: "object",
      properties: {
        table: {
          type: "string",
          description: "Filter by hypertable name",
        },
        schema: {
          type: "string",
          description: "Filter by schema name",
        },
        policyType: {
          type: "string",
          enum: ["compression", "retention", "all"],
          default: "all",
          description: "Type of policies to list",
        },
      },
    },
  },
  {
    name: "remove_policy",
    description: "Remove a compression or retention policy from a hypertable",
    inputSchema: {
      type: "object",
      properties: {
        table: {
          type: "string",
          description: "Hypertable name",
        },
        schema: {
          type: "string",
          default: "public",
          description: "Schema name",
        },
        policyType: {
          type: "string",
          enum: ["compression", "retention"],
          description: "Type of policy to remove",
        },
        ifExists: {
          type: "boolean",
          default: true,
          description: "Don't error if policy doesn't exist",
        },
      },
      required: ["table", "policyType"],
    },
  },
  {
    name: "create_continuous_aggregate",
    description: "Create a continuous aggregate view for automatic materialization of time-series aggregations",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Name for the continuous aggregate",
        },
        schema: {
          type: "string",
          default: "public",
          description: "Schema name",
        },
        sourceTable: {
          type: "string",
          description: "Source hypertable name",
        },
        sourceSchema: {
          type: "string",
          default: "public",
          description: "Source schema",
        },
        timeBucket: {
          type: "string",
          description: "Time bucket interval (e.g., '1 hour')",
        },
        timeColumn: {
          type: "string",
          description: "Time column name in source table",
        },
        selectColumns: {
          type: "string",
          description: "SELECT expressions with aggregations (e.g., 'avg(value) as avg_value, max(value) as max_value')",
        },
        groupByColumns: {
          type: "array",
          items: { type: "string" },
          description: "Additional GROUP BY columns",
        },
        whereClause: {
          type: "string",
          description: "Optional WHERE clause",
        },
        withNoData: {
          type: "boolean",
          default: false,
          description: "Create without computing initial data",
        },
        materializedOnly: {
          type: "boolean",
          default: false,
          description: "Only return materialized data (no real-time)",
        },
      },
      required: ["name", "sourceTable", "timeBucket", "timeColumn", "selectColumns"],
    },
  },
  {
    name: "refresh_continuous_aggregate",
    description: "Manually refresh a continuous aggregate for a time range",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Continuous aggregate name",
        },
        schema: {
          type: "string",
          default: "public",
          description: "Schema name",
        },
        startTime: {
          type: "string",
          description: "Start time for refresh (e.g., '2024-01-01' or 'now() - interval 7 days')",
        },
        endTime: {
          type: "string",
          description: "End time for refresh (e.g., 'now()')",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "list_continuous_aggregates",
    description: "List all continuous aggregates in the database",
    inputSchema: {
      type: "object",
      properties: {
        schema: {
          type: "string",
          description: "Filter by schema name",
        },
      },
    },
  },
  {
    name: "time_bucket_query",
    description: "Execute a time bucket query for time-series aggregation",
    inputSchema: {
      type: "object",
      properties: {
        table: {
          type: "string",
          description: "Table/hypertable name",
        },
        schema: {
          type: "string",
          default: "public",
          description: "Schema name",
        },
        timeColumn: {
          type: "string",
          description: "Time column name",
        },
        bucket: {
          type: "string",
          description: "Time bucket interval (e.g., '1 hour', '5 minutes')",
        },
        selectColumns: {
          type: "string",
          description: "SELECT expressions (e.g., 'avg(value), count(*)')",
        },
        whereClause: {
          type: "string",
          description: "Optional WHERE clause",
        },
        groupByColumns: {
          type: "array",
          items: { type: "string" },
          description: "Additional GROUP BY columns",
        },
        orderBy: {
          type: "string",
          description: "ORDER BY clause",
        },
        limit: {
          type: "number",
          description: "LIMIT clause",
        },
      },
      required: ["table", "timeColumn", "bucket", "selectColumns"],
    },
  },
  {
    name: "get_chunk_info",
    description: "Get information about chunks in a hypertable",
    inputSchema: {
      type: "object",
      properties: {
        table: {
          type: "string",
          description: "Hypertable name",
        },
        schema: {
          type: "string",
          default: "public",
          description: "Schema name",
        },
        showCompressed: {
          type: "boolean",
          default: true,
          description: "Include compression status",
        },
      },
      required: ["table"],
    },
  },
  {
    name: "compress_chunks",
    description: "Manually compress chunks in a hypertable",
    inputSchema: {
      type: "object",
      properties: {
        table: {
          type: "string",
          description: "Hypertable name",
        },
        schema: {
          type: "string",
          default: "public",
          description: "Schema name",
        },
        olderThan: {
          type: "string",
          description: "Compress chunks older than interval",
        },
        chunkName: {
          type: "string",
          description: "Specific chunk name to compress",
        },
      },
      required: ["table"],
    },
  },
  {
    name: "decompress_chunks",
    description: "Decompress chunks in a hypertable",
    inputSchema: {
      type: "object",
      properties: {
        table: {
          type: "string",
          description: "Hypertable name",
        },
        schema: {
          type: "string",
          default: "public",
          description: "Schema name",
        },
        chunkName: {
          type: "string",
          description: "Specific chunk name to decompress",
        },
      },
      required: ["table"],
    },
  },
  {
    name: "get_approximate_row_count",
    description: "Get fast approximate row count for a table using statistics",
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
          description: "Schema name",
        },
      },
      required: ["table"],
    },
  },
  {
    name: "add_dimension",
    description: "Add an additional partitioning dimension to a hypertable",
    inputSchema: {
      type: "object",
      properties: {
        table: {
          type: "string",
          description: "Hypertable name",
        },
        schema: {
          type: "string",
          default: "public",
          description: "Schema name",
        },
        columnName: {
          type: "string",
          description: "Column to add as dimension",
        },
        numberOfPartitions: {
          type: "number",
          description: "Number of partitions for hash dimension",
        },
        chunkTimeInterval: {
          type: "string",
          description: "Interval for time dimension",
        },
        ifNotExists: {
          type: "boolean",
          default: true,
          description: "Don't error if dimension exists",
        },
      },
      required: ["table", "columnName"],
    },
  },
  {
    name: "get_telemetry",
    description: "Get TimescaleDB telemetry and version information",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "health_check",
    description: "Check TimescaleDB database connection health and status",
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
    await client.query(`SET statement_timeout = ${QUERY_TIMEOUT_MS}`);

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

async function createHypertable(params: z.infer<typeof CreateHypertableSchema>): Promise<any> {
  const client = await pool.connect();
  try {
    const fullTableName = `${params.schema}.${params.table}`;

    let options: string[] = [];
    if (params.chunkTimeInterval) {
      options.push(`chunk_time_interval => INTERVAL '${params.chunkTimeInterval}'`);
    }
    if (params.ifNotExists) {
      options.push(`if_not_exists => TRUE`);
    }
    if (params.migrateData) {
      options.push(`migrate_data => TRUE`);
    }

    const optionsStr = options.length > 0 ? `, ${options.join(", ")}` : "";

    const sql = `SELECT create_hypertable('${fullTableName}', '${params.timeColumn}'${optionsStr})`;
    const result = await client.query(sql);

    return {
      success: true,
      table: fullTableName,
      timeColumn: params.timeColumn,
      result: result.rows[0],
    };
  } finally {
    client.release();
  }
}

async function listHypertables(params: z.infer<typeof ListHypertablesSchema>): Promise<any> {
  const client = await pool.connect();
  try {
    let sql = `
      SELECT
        hypertable_schema,
        hypertable_name,
        num_chunks,
        compression_enabled,
        tablespaces
      FROM timescaledb_information.hypertables
    `;

    const queryParams: string[] = [];
    if (params.schema) {
      sql += ` WHERE hypertable_schema = $1`;
      queryParams.push(params.schema);
    }

    sql += ` ORDER BY hypertable_schema, hypertable_name`;

    const result = await client.query(sql, queryParams);

    return {
      success: true,
      hypertables: result.rows,
      count: result.rowCount,
    };
  } finally {
    client.release();
  }
}

async function getHypertableInfo(params: z.infer<typeof GetHypertableInfoSchema>): Promise<any> {
  const client = await pool.connect();
  try {
    const fullTableName = `${params.schema}.${params.table}`;

    // Get hypertable details
    const hypertableResult = await client.query(`
      SELECT *
      FROM timescaledb_information.hypertables
      WHERE hypertable_schema = $1 AND hypertable_name = $2
    `, [params.schema, params.table]);

    // Get dimensions
    const dimensionsResult = await client.query(`
      SELECT *
      FROM timescaledb_information.dimensions
      WHERE hypertable_schema = $1 AND hypertable_name = $2
    `, [params.schema, params.table]);

    // Get chunk count and size
    const chunkStatsResult = await client.query(`
      SELECT
        count(*) as chunk_count,
        pg_size_pretty(sum(total_bytes)) as total_size,
        pg_size_pretty(sum(table_bytes)) as table_size,
        pg_size_pretty(sum(index_bytes)) as index_size
      FROM (
        SELECT
          pg_total_relation_size(format('%I.%I', chunk_schema, chunk_name)::regclass) as total_bytes,
          pg_relation_size(format('%I.%I', chunk_schema, chunk_name)::regclass) as table_bytes,
          pg_indexes_size(format('%I.%I', chunk_schema, chunk_name)::regclass) as index_bytes
        FROM timescaledb_information.chunks
        WHERE hypertable_schema = $1 AND hypertable_name = $2
      ) chunk_sizes
    `, [params.schema, params.table]);

    // Get compression settings if enabled
    const compressionResult = await client.query(`
      SELECT *
      FROM timescaledb_information.compression_settings
      WHERE hypertable_schema = $1 AND hypertable_name = $2
    `, [params.schema, params.table]);

    return {
      success: true,
      hypertable: hypertableResult.rows[0] || null,
      dimensions: dimensionsResult.rows,
      chunkStats: chunkStatsResult.rows[0],
      compressionSettings: compressionResult.rows,
    };
  } finally {
    client.release();
  }
}

async function addCompressionPolicy(params: z.infer<typeof AddCompressionPolicySchema>): Promise<any> {
  const client = await pool.connect();
  try {
    const fullTableName = `${params.schema}.${params.table}`;

    // First enable compression on the hypertable if not already enabled
    await client.query(`
      ALTER TABLE ${fullTableName} SET (
        timescaledb.compress
      )
    `);

    // Add the compression policy
    let sql = `SELECT add_compression_policy('${fullTableName}', INTERVAL '${params.compressAfter}'`;
    if (params.scheduleInterval) {
      sql += `, schedule_interval => INTERVAL '${params.scheduleInterval}'`;
    }
    sql += `)`;

    const result = await client.query(sql);

    return {
      success: true,
      table: fullTableName,
      compressAfter: params.compressAfter,
      policyId: result.rows[0]?.add_compression_policy,
    };
  } finally {
    client.release();
  }
}

async function addRetentionPolicy(params: z.infer<typeof AddRetentionPolicySchema>): Promise<any> {
  const client = await pool.connect();
  try {
    const fullTableName = `${params.schema}.${params.table}`;

    let sql = `SELECT add_retention_policy('${fullTableName}', INTERVAL '${params.dropAfter}'`;
    if (params.scheduleInterval) {
      sql += `, schedule_interval => INTERVAL '${params.scheduleInterval}'`;
    }
    sql += `)`;

    const result = await client.query(sql);

    return {
      success: true,
      table: fullTableName,
      dropAfter: params.dropAfter,
      policyId: result.rows[0]?.add_retention_policy,
    };
  } finally {
    client.release();
  }
}

async function listPolicies(params: z.infer<typeof ListPoliciesSchema>): Promise<any> {
  const client = await pool.connect();
  try {
    const results: any = { success: true };

    if (params.policyType === "all" || params.policyType === "compression") {
      let compressionSql = `
        SELECT
          hypertable_schema,
          hypertable_name,
          compress_after
        FROM timescaledb_information.jobs j
        JOIN timescaledb_information.job_stats js ON j.job_id = js.job_id
        WHERE j.proc_name = 'policy_compression'
      `;

      // Alternative query using compression settings
      compressionSql = `
        SELECT
          j.hypertable_schema,
          j.hypertable_name,
          j.schedule_interval,
          j.config
        FROM timescaledb_information.jobs j
        WHERE j.proc_name = 'policy_compression'
      `;

      const whereConditions: string[] = [];
      const queryParams: string[] = [];
      let paramIndex = 1;

      if (params.schema) {
        whereConditions.push(`j.hypertable_schema = $${paramIndex++}`);
        queryParams.push(params.schema);
      }
      if (params.table) {
        whereConditions.push(`j.hypertable_name = $${paramIndex++}`);
        queryParams.push(params.table);
      }

      if (whereConditions.length > 0) {
        compressionSql += ` AND ${whereConditions.join(" AND ")}`;
      }

      const compressionResult = await client.query(compressionSql, queryParams);
      results.compressionPolicies = compressionResult.rows;
    }

    if (params.policyType === "all" || params.policyType === "retention") {
      let retentionSql = `
        SELECT
          j.hypertable_schema,
          j.hypertable_name,
          j.schedule_interval,
          j.config
        FROM timescaledb_information.jobs j
        WHERE j.proc_name = 'policy_retention'
      `;

      const whereConditions: string[] = [];
      const queryParams: string[] = [];
      let paramIndex = 1;

      if (params.schema) {
        whereConditions.push(`j.hypertable_schema = $${paramIndex++}`);
        queryParams.push(params.schema);
      }
      if (params.table) {
        whereConditions.push(`j.hypertable_name = $${paramIndex++}`);
        queryParams.push(params.table);
      }

      if (whereConditions.length > 0) {
        retentionSql += ` AND ${whereConditions.join(" AND ")}`;
      }

      const retentionResult = await client.query(retentionSql, queryParams);
      results.retentionPolicies = retentionResult.rows;
    }

    return results;
  } finally {
    client.release();
  }
}

async function removePolicy(params: z.infer<typeof RemovePolicySchema>): Promise<any> {
  const client = await pool.connect();
  try {
    const fullTableName = `${params.schema}.${params.table}`;
    const ifExistsStr = params.ifExists ? ", if_exists => TRUE" : "";

    let sql: string;
    if (params.policyType === "compression") {
      sql = `SELECT remove_compression_policy('${fullTableName}'${ifExistsStr})`;
    } else {
      sql = `SELECT remove_retention_policy('${fullTableName}'${ifExistsStr})`;
    }

    await client.query(sql);

    return {
      success: true,
      table: fullTableName,
      policyType: params.policyType,
      removed: true,
    };
  } finally {
    client.release();
  }
}

async function createContinuousAggregate(params: z.infer<typeof CreateContinuousAggregateSchema>): Promise<any> {
  const client = await pool.connect();
  try {
    const fullViewName = `${params.schema}.${params.name}`;
    const fullSourceTable = `${params.sourceSchema}.${params.sourceTable}`;

    let groupByClause = `time_bucket('${params.timeBucket}', ${params.timeColumn})`;
    if (params.groupByColumns && params.groupByColumns.length > 0) {
      groupByClause += `, ${params.groupByColumns.join(", ")}`;
    }

    let selectClause = `time_bucket('${params.timeBucket}', ${params.timeColumn}) AS bucket`;
    if (params.groupByColumns && params.groupByColumns.length > 0) {
      selectClause += `, ${params.groupByColumns.join(", ")}`;
    }
    selectClause += `, ${params.selectColumns}`;

    let sql = `CREATE MATERIALIZED VIEW ${fullViewName}`;

    const withOptions: string[] = [];
    withOptions.push(`timescaledb.continuous`);
    if (params.materializedOnly) {
      withOptions.push(`timescaledb.materialized_only = true`);
    }

    sql += ` WITH (${withOptions.join(", ")}) AS`;
    sql += ` SELECT ${selectClause}`;
    sql += ` FROM ${fullSourceTable}`;

    if (params.whereClause) {
      sql += ` WHERE ${params.whereClause}`;
    }

    sql += ` GROUP BY ${groupByClause}`;

    if (params.withNoData) {
      sql += ` WITH NO DATA`;
    }

    await client.query(sql);

    return {
      success: true,
      viewName: fullViewName,
      sourceTable: fullSourceTable,
      timeBucket: params.timeBucket,
    };
  } finally {
    client.release();
  }
}

async function refreshContinuousAggregate(params: z.infer<typeof RefreshContinuousAggregateSchema>): Promise<any> {
  const client = await pool.connect();
  try {
    const fullViewName = `${params.schema}.${params.name}`;

    let sql: string;
    if (params.startTime && params.endTime) {
      sql = `CALL refresh_continuous_aggregate('${fullViewName}', ${params.startTime}, ${params.endTime})`;
    } else if (params.startTime) {
      sql = `CALL refresh_continuous_aggregate('${fullViewName}', ${params.startTime}, NULL)`;
    } else if (params.endTime) {
      sql = `CALL refresh_continuous_aggregate('${fullViewName}', NULL, ${params.endTime})`;
    } else {
      sql = `CALL refresh_continuous_aggregate('${fullViewName}', NULL, NULL)`;
    }

    await client.query(sql);

    return {
      success: true,
      viewName: fullViewName,
      refreshed: true,
      startTime: params.startTime || "beginning",
      endTime: params.endTime || "now",
    };
  } finally {
    client.release();
  }
}

async function listContinuousAggregates(params: z.infer<typeof ListContinuousAggregatesSchema>): Promise<any> {
  const client = await pool.connect();
  try {
    let sql = `
      SELECT
        view_schema,
        view_name,
        view_owner,
        materialization_hypertable_schema,
        materialization_hypertable_name,
        view_definition
      FROM timescaledb_information.continuous_aggregates
    `;

    const queryParams: string[] = [];
    if (params.schema) {
      sql += ` WHERE view_schema = $1`;
      queryParams.push(params.schema);
    }

    sql += ` ORDER BY view_schema, view_name`;

    const result = await client.query(sql, queryParams);

    return {
      success: true,
      continuousAggregates: result.rows,
      count: result.rowCount,
    };
  } finally {
    client.release();
  }
}

async function timeBucketQuery(params: z.infer<typeof TimeBucketQuerySchema>): Promise<any> {
  const client = await pool.connect();
  try {
    const fullTableName = `${params.schema}.${params.table}`;

    let groupByClause = `time_bucket('${params.bucket}', ${params.timeColumn})`;
    if (params.groupByColumns && params.groupByColumns.length > 0) {
      groupByClause += `, ${params.groupByColumns.join(", ")}`;
    }

    let selectClause = `time_bucket('${params.bucket}', ${params.timeColumn}) AS bucket`;
    if (params.groupByColumns && params.groupByColumns.length > 0) {
      selectClause += `, ${params.groupByColumns.join(", ")}`;
    }
    selectClause += `, ${params.selectColumns}`;

    let sql = `SELECT ${selectClause} FROM ${fullTableName}`;

    if (params.whereClause) {
      sql += ` WHERE ${params.whereClause}`;
    }

    sql += ` GROUP BY ${groupByClause}`;

    if (params.orderBy) {
      sql += ` ORDER BY ${params.orderBy}`;
    } else {
      sql += ` ORDER BY bucket`;
    }

    if (params.limit) {
      sql += ` LIMIT ${params.limit}`;
    }

    const result = await client.query(sql);

    return {
      success: true,
      rows: result.rows,
      rowCount: result.rowCount,
      bucket: params.bucket,
    };
  } finally {
    client.release();
  }
}

async function getChunkInfo(params: z.infer<typeof GetChunkInfoSchema>): Promise<any> {
  const client = await pool.connect();
  try {
    let sql = `
      SELECT
        chunk_schema,
        chunk_name,
        range_start,
        range_end,
        is_compressed,
        pg_size_pretty(pg_total_relation_size(format('%I.%I', chunk_schema, chunk_name)::regclass)) as chunk_size
      FROM timescaledb_information.chunks
      WHERE hypertable_schema = $1 AND hypertable_name = $2
      ORDER BY range_start DESC
    `;

    const result = await client.query(sql, [params.schema, params.table]);

    // Get compression stats if requested
    let compressionStats = null;
    if (params.showCompressed) {
      const compressionResult = await client.query(`
        SELECT
          count(*) FILTER (WHERE is_compressed) as compressed_chunks,
          count(*) FILTER (WHERE NOT is_compressed) as uncompressed_chunks,
          count(*) as total_chunks
        FROM timescaledb_information.chunks
        WHERE hypertable_schema = $1 AND hypertable_name = $2
      `, [params.schema, params.table]);
      compressionStats = compressionResult.rows[0];
    }

    return {
      success: true,
      chunks: result.rows,
      count: result.rowCount,
      compressionStats,
    };
  } finally {
    client.release();
  }
}

async function compressChunks(params: z.infer<typeof CompressChunksSchema>): Promise<any> {
  const client = await pool.connect();
  try {
    const fullTableName = `${params.schema}.${params.table}`;

    let result;
    if (params.chunkName) {
      // Compress specific chunk
      result = await client.query(`SELECT compress_chunk('${params.chunkName}')`);
      return {
        success: true,
        table: fullTableName,
        chunkCompressed: params.chunkName,
      };
    } else if (params.olderThan) {
      // Compress chunks older than interval
      result = await client.query(`
        SELECT compress_chunk(i, if_not_compressed => true)
        FROM show_chunks('${fullTableName}', older_than => INTERVAL '${params.olderThan}') i
      `);
      return {
        success: true,
        table: fullTableName,
        chunksCompressed: result.rowCount,
        olderThan: params.olderThan,
      };
    } else {
      // Compress all uncompressed chunks
      result = await client.query(`
        SELECT compress_chunk(chunk_schema || '.' || chunk_name, if_not_compressed => true)
        FROM timescaledb_information.chunks
        WHERE hypertable_schema = $1
          AND hypertable_name = $2
          AND NOT is_compressed
      `, [params.schema, params.table]);
      return {
        success: true,
        table: fullTableName,
        chunksCompressed: result.rowCount,
      };
    }
  } finally {
    client.release();
  }
}

async function decompressChunks(params: z.infer<typeof DecompressChunksSchema>): Promise<any> {
  const client = await pool.connect();
  try {
    const fullTableName = `${params.schema}.${params.table}`;

    let result;
    if (params.chunkName) {
      // Decompress specific chunk
      result = await client.query(`SELECT decompress_chunk('${params.chunkName}')`);
      return {
        success: true,
        table: fullTableName,
        chunkDecompressed: params.chunkName,
      };
    } else {
      // Decompress all compressed chunks
      result = await client.query(`
        SELECT decompress_chunk(chunk_schema || '.' || chunk_name)
        FROM timescaledb_information.chunks
        WHERE hypertable_schema = $1
          AND hypertable_name = $2
          AND is_compressed
      `, [params.schema, params.table]);
      return {
        success: true,
        table: fullTableName,
        chunksDecompressed: result.rowCount,
      };
    }
  } finally {
    client.release();
  }
}

async function getApproximateRowCount(params: z.infer<typeof GetApproximateRowCountSchema>): Promise<any> {
  const client = await pool.connect();
  try {
    const fullTableName = `${params.schema}.${params.table}`;

    // Use TimescaleDB's approximate_row_count for hypertables
    const result = await client.query(`
      SELECT approximate_row_count('${fullTableName}') as approximate_count
    `);

    return {
      success: true,
      table: fullTableName,
      approximateRowCount: result.rows[0]?.approximate_count,
    };
  } catch (error) {
    // Fallback to pg_class for non-hypertables
    const client2 = await pool.connect();
    try {
      const result = await client2.query(`
        SELECT reltuples::bigint as approximate_count
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = $1 AND c.relname = $2
      `, [params.schema, params.table]);

      return {
        success: true,
        table: `${params.schema}.${params.table}`,
        approximateRowCount: result.rows[0]?.approximate_count,
        note: "Used pg_class estimate (not a hypertable)",
      };
    } finally {
      client2.release();
    }
  } finally {
    client.release();
  }
}

async function addDimension(params: z.infer<typeof AddDimensionSchema>): Promise<any> {
  const client = await pool.connect();
  try {
    const fullTableName = `${params.schema}.${params.table}`;

    let options: string[] = [];
    if (params.numberOfPartitions) {
      options.push(`number_partitions => ${params.numberOfPartitions}`);
    }
    if (params.chunkTimeInterval) {
      options.push(`chunk_time_interval => INTERVAL '${params.chunkTimeInterval}'`);
    }
    if (params.ifNotExists) {
      options.push(`if_not_exists => TRUE`);
    }

    const optionsStr = options.length > 0 ? `, ${options.join(", ")}` : "";

    const sql = `SELECT add_dimension('${fullTableName}', '${params.columnName}'${optionsStr})`;
    const result = await client.query(sql);

    return {
      success: true,
      table: fullTableName,
      dimension: params.columnName,
      result: result.rows[0],
    };
  } finally {
    client.release();
  }
}

async function getTelemetry(): Promise<any> {
  const client = await pool.connect();
  try {
    // Get TimescaleDB version
    const versionResult = await client.query(`SELECT extversion FROM pg_extension WHERE extname = 'timescaledb'`);

    // Get PostgreSQL version
    const pgVersionResult = await client.query(`SELECT version()`);

    // Get hypertable count
    const hypertableCountResult = await client.query(`
      SELECT count(*) as count FROM timescaledb_information.hypertables
    `);

    // Get continuous aggregate count
    const caCountResult = await client.query(`
      SELECT count(*) as count FROM timescaledb_information.continuous_aggregates
    `);

    // Get total chunk count
    const chunkCountResult = await client.query(`
      SELECT
        count(*) as total_chunks,
        count(*) FILTER (WHERE is_compressed) as compressed_chunks
      FROM timescaledb_information.chunks
    `);

    // Get job count
    const jobCountResult = await client.query(`
      SELECT count(*) as count FROM timescaledb_information.jobs
    `);

    return {
      success: true,
      timescaleVersion: versionResult.rows[0]?.extversion,
      postgresVersion: pgVersionResult.rows[0]?.version,
      hypertableCount: parseInt(hypertableCountResult.rows[0]?.count || "0"),
      continuousAggregateCount: parseInt(caCountResult.rows[0]?.count || "0"),
      totalChunks: parseInt(chunkCountResult.rows[0]?.total_chunks || "0"),
      compressedChunks: parseInt(chunkCountResult.rows[0]?.compressed_chunks || "0"),
      jobCount: parseInt(jobCountResult.rows[0]?.count || "0"),
    };
  } finally {
    client.release();
  }
}

async function healthCheck(): Promise<any> {
  const client = await pool.connect();
  try {
    const start = Date.now();

    // Basic connectivity check
    await client.query("SELECT 1");
    const latency = Date.now() - start;

    // Check TimescaleDB extension
    const extensionResult = await client.query(`
      SELECT extversion FROM pg_extension WHERE extname = 'timescaledb'
    `);
    const timescaleInstalled = extensionResult.rowCount! > 0;

    // Get pool stats
    const poolStats = {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
    };

    // Check background jobs status
    let jobsHealthy = true;
    if (timescaleInstalled) {
      const jobsResult = await client.query(`
        SELECT count(*) as failed_jobs
        FROM timescaledb_information.job_stats
        WHERE last_run_status = 'Failed'
          AND last_run_started_at > NOW() - INTERVAL '1 day'
      `);
      jobsHealthy = parseInt(jobsResult.rows[0]?.failed_jobs || "0") === 0;
    }

    return {
      status: timescaleInstalled ? "healthy" : "degraded",
      latencyMs: latency,
      timescaleInstalled,
      timescaleVersion: extensionResult.rows[0]?.extversion || null,
      pool: poolStats,
      jobsHealthy,
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
    name: "timescale-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;

    switch (name) {
      case "query":
        result = await executeQuery(QuerySchema.parse(args));
        break;
      case "create_hypertable":
        result = await createHypertable(CreateHypertableSchema.parse(args));
        break;
      case "list_hypertables":
        result = await listHypertables(ListHypertablesSchema.parse(args || {}));
        break;
      case "get_hypertable_info":
        result = await getHypertableInfo(GetHypertableInfoSchema.parse(args));
        break;
      case "add_compression_policy":
        result = await addCompressionPolicy(AddCompressionPolicySchema.parse(args));
        break;
      case "add_retention_policy":
        result = await addRetentionPolicy(AddRetentionPolicySchema.parse(args));
        break;
      case "list_policies":
        result = await listPolicies(ListPoliciesSchema.parse(args || {}));
        break;
      case "remove_policy":
        result = await removePolicy(RemovePolicySchema.parse(args));
        break;
      case "create_continuous_aggregate":
        result = await createContinuousAggregate(CreateContinuousAggregateSchema.parse(args));
        break;
      case "refresh_continuous_aggregate":
        result = await refreshContinuousAggregate(RefreshContinuousAggregateSchema.parse(args));
        break;
      case "list_continuous_aggregates":
        result = await listContinuousAggregates(ListContinuousAggregatesSchema.parse(args || {}));
        break;
      case "time_bucket_query":
        result = await timeBucketQuery(TimeBucketQuerySchema.parse(args));
        break;
      case "get_chunk_info":
        result = await getChunkInfo(GetChunkInfoSchema.parse(args));
        break;
      case "compress_chunks":
        result = await compressChunks(CompressChunksSchema.parse(args));
        break;
      case "decompress_chunks":
        result = await decompressChunks(DecompressChunksSchema.parse(args));
        break;
      case "get_approximate_row_count":
        result = await getApproximateRowCount(GetApproximateRowCountSchema.parse(args));
        break;
      case "add_dimension":
        result = await addDimension(AddDimensionSchema.parse(args));
        break;
      case "get_telemetry":
        result = await getTelemetry();
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
  console.error("Shutting down TimescaleDB MCP Server...");
  await pool.end();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.error("Shutting down TimescaleDB MCP Server...");
  await pool.end();
  process.exit(0);
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("TimescaleDB MCP Server started");
  console.error(`Connecting to: ${TIMESCALE_HOST}:${TIMESCALE_PORT}/${TIMESCALE_DATABASE}`);
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
