/**
 * DuckDB MCP Server
 *
 * Analytical database operations for KOSMOS agents including:
 * - Query execution with parameterized queries
 * - Table operations (list, describe, create, drop)
 * - Data import (CSV, Parquet, JSON)
 * - Data export (CSV, Parquet)
 * - Database information
 * - Extension management
 * - In-memory and file-based database support
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { Database } from "duckdb-async";

// Environment configuration
const DATABASE_PATH = process.env.DUCKDB_PATH || ":memory:";
const READ_ONLY = process.env.DUCKDB_READ_ONLY === "true";
const QUERY_TIMEOUT_MS = parseInt(process.env.DUCKDB_QUERY_TIMEOUT || "60000");

// Database instance (lazy initialization)
let db: Database | null = null;

async function getDatabase(): Promise<Database> {
  if (!db) {
    db = await Database.create(DATABASE_PATH, {
      access_mode: READ_ONLY ? "READ_ONLY" : "READ_WRITE",
    });
    console.error(`Connected to DuckDB: ${DATABASE_PATH === ":memory:" ? "in-memory" : DATABASE_PATH}`);
  }
  return db;
}

// Tool schemas
const QuerySchema = z.object({
  sql: z.string().describe("SQL query to execute"),
  params: z.array(z.unknown()).optional().describe("Query parameters (use $1, $2, etc. or ?)"),
});

const ListTablesSchema = z.object({
  schema: z.string().default("main").describe("Schema name to list tables from"),
  include_views: z.boolean().default(true).describe("Include views in the list"),
});

const DescribeTableSchema = z.object({
  table: z.string().describe("Table name to describe"),
  schema: z.string().default("main").describe("Schema name"),
});

const CreateTableSchema = z.object({
  table: z.string().describe("Table name to create"),
  columns: z.array(z.object({
    name: z.string(),
    type: z.string(),
    nullable: z.boolean().default(true),
    primary_key: z.boolean().default(false),
  })).describe("Column definitions"),
  schema: z.string().default("main"),
  if_not_exists: z.boolean().default(false),
});

const DropTableSchema = z.object({
  table: z.string().describe("Table name to drop"),
  schema: z.string().default("main"),
  if_exists: z.boolean().default(true),
  cascade: z.boolean().default(false),
});

const ImportCSVSchema = z.object({
  file_path: z.string().describe("Path to CSV file"),
  table: z.string().describe("Target table name"),
  schema: z.string().default("main"),
  delimiter: z.string().default(","),
  header: z.boolean().default(true),
  auto_detect: z.boolean().default(true),
  columns: z.record(z.string()).optional().describe("Column name to type mapping"),
  skip_rows: z.number().default(0),
  null_string: z.string().optional(),
});

const ImportParquetSchema = z.object({
  file_path: z.string().describe("Path to Parquet file (local or S3/HTTP URL)"),
  table: z.string().describe("Target table name"),
  schema: z.string().default("main"),
  hive_partitioning: z.boolean().default(false),
});

const ImportJSONSchema = z.object({
  file_path: z.string().describe("Path to JSON or NDJSON file"),
  table: z.string().describe("Target table name"),
  schema: z.string().default("main"),
  format: z.enum(["auto", "array", "newline_delimited"]).default("auto"),
  columns: z.record(z.string()).optional(),
});

const ExportCSVSchema = z.object({
  query: z.string().describe("SQL query to export"),
  file_path: z.string().describe("Output CSV file path"),
  delimiter: z.string().default(","),
  header: z.boolean().default(true),
  force_quote: z.array(z.string()).optional(),
});

const ExportParquetSchema = z.object({
  query: z.string().describe("SQL query to export"),
  file_path: z.string().describe("Output Parquet file path"),
  compression: z.enum(["snappy", "gzip", "zstd", "uncompressed"]).default("snappy"),
  row_group_size: z.number().optional(),
});

const ExtensionSchema = z.object({
  name: z.string().describe("Extension name to load"),
  install: z.boolean().default(true).describe("Install if not present"),
});

const DatabaseInfoSchema = z.object({
  include_settings: z.boolean().default(false),
  include_functions: z.boolean().default(false),
});

// Tool definitions
const TOOLS: Tool[] = [
  {
    name: "query",
    description: "Execute a SQL query against DuckDB. Supports parameterized queries with $1, $2, etc. or ? placeholders. Returns results for SELECT queries or affected row count for mutations.",
    inputSchema: {
      type: "object",
      properties: {
        sql: {
          type: "string",
          description: "SQL query to execute",
        },
        params: {
          type: "array",
          description: "Query parameters (positional)",
        },
      },
      required: ["sql"],
    },
  },
  {
    name: "list_tables",
    description: "List all tables and optionally views in the database",
    inputSchema: {
      type: "object",
      properties: {
        schema: {
          type: "string",
          default: "main",
          description: "Schema name",
        },
        include_views: {
          type: "boolean",
          default: true,
          description: "Include views in results",
        },
      },
    },
  },
  {
    name: "describe_table",
    description: "Get detailed schema information for a table including columns, types, and constraints",
    inputSchema: {
      type: "object",
      properties: {
        table: {
          type: "string",
          description: "Table name",
        },
        schema: {
          type: "string",
          default: "main",
        },
      },
      required: ["table"],
    },
  },
  {
    name: "create_table",
    description: "Create a new table with specified columns",
    inputSchema: {
      type: "object",
      properties: {
        table: {
          type: "string",
          description: "Table name",
        },
        columns: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              type: { type: "string" },
              nullable: { type: "boolean", default: true },
              primary_key: { type: "boolean", default: false },
            },
            required: ["name", "type"],
          },
          description: "Column definitions",
        },
        schema: {
          type: "string",
          default: "main",
        },
        if_not_exists: {
          type: "boolean",
          default: false,
        },
      },
      required: ["table", "columns"],
    },
  },
  {
    name: "drop_table",
    description: "Drop an existing table",
    inputSchema: {
      type: "object",
      properties: {
        table: {
          type: "string",
          description: "Table name to drop",
        },
        schema: {
          type: "string",
          default: "main",
        },
        if_exists: {
          type: "boolean",
          default: true,
        },
        cascade: {
          type: "boolean",
          default: false,
        },
      },
      required: ["table"],
    },
  },
  {
    name: "import_csv",
    description: "Import a CSV file into a table. Supports auto-detection of schema and various CSV formats.",
    inputSchema: {
      type: "object",
      properties: {
        file_path: {
          type: "string",
          description: "Path to CSV file",
        },
        table: {
          type: "string",
          description: "Target table name",
        },
        schema: {
          type: "string",
          default: "main",
        },
        delimiter: {
          type: "string",
          default: ",",
        },
        header: {
          type: "boolean",
          default: true,
        },
        auto_detect: {
          type: "boolean",
          default: true,
        },
        columns: {
          type: "object",
          additionalProperties: { type: "string" },
          description: "Column name to type mapping",
        },
        skip_rows: {
          type: "number",
          default: 0,
        },
        null_string: {
          type: "string",
          description: "String to interpret as NULL",
        },
      },
      required: ["file_path", "table"],
    },
  },
  {
    name: "import_parquet",
    description: "Import a Parquet file into a table. Supports local files and remote URLs (S3, HTTP).",
    inputSchema: {
      type: "object",
      properties: {
        file_path: {
          type: "string",
          description: "Path to Parquet file (local or URL)",
        },
        table: {
          type: "string",
          description: "Target table name",
        },
        schema: {
          type: "string",
          default: "main",
        },
        hive_partitioning: {
          type: "boolean",
          default: false,
        },
      },
      required: ["file_path", "table"],
    },
  },
  {
    name: "import_json",
    description: "Import a JSON or newline-delimited JSON (NDJSON) file into a table",
    inputSchema: {
      type: "object",
      properties: {
        file_path: {
          type: "string",
          description: "Path to JSON file",
        },
        table: {
          type: "string",
          description: "Target table name",
        },
        schema: {
          type: "string",
          default: "main",
        },
        format: {
          type: "string",
          enum: ["auto", "array", "newline_delimited"],
          default: "auto",
        },
        columns: {
          type: "object",
          additionalProperties: { type: "string" },
        },
      },
      required: ["file_path", "table"],
    },
  },
  {
    name: "export_csv",
    description: "Export query results to a CSV file",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "SQL query to export",
        },
        file_path: {
          type: "string",
          description: "Output CSV file path",
        },
        delimiter: {
          type: "string",
          default: ",",
        },
        header: {
          type: "boolean",
          default: true,
        },
        force_quote: {
          type: "array",
          items: { type: "string" },
          description: "Columns to always quote",
        },
      },
      required: ["query", "file_path"],
    },
  },
  {
    name: "export_parquet",
    description: "Export query results to a Parquet file with optional compression",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "SQL query to export",
        },
        file_path: {
          type: "string",
          description: "Output Parquet file path",
        },
        compression: {
          type: "string",
          enum: ["snappy", "gzip", "zstd", "uncompressed"],
          default: "snappy",
        },
        row_group_size: {
          type: "number",
          description: "Number of rows per row group",
        },
      },
      required: ["query", "file_path"],
    },
  },
  {
    name: "database_info",
    description: "Get database information including version, settings, and loaded extensions",
    inputSchema: {
      type: "object",
      properties: {
        include_settings: {
          type: "boolean",
          default: false,
        },
        include_functions: {
          type: "boolean",
          default: false,
        },
      },
    },
  },
  {
    name: "load_extension",
    description: "Load a DuckDB extension (e.g., httpfs, parquet, json, spatial, fts)",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Extension name",
        },
        install: {
          type: "boolean",
          default: true,
          description: "Install if not already installed",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "list_extensions",
    description: "List all available and loaded extensions",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "open_database",
    description: "Open or switch to a different database file. Use ':memory:' for in-memory database.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Database file path or ':memory:' for in-memory",
        },
        read_only: {
          type: "boolean",
          default: false,
        },
      },
      required: ["path"],
    },
  },
  {
    name: "health_check",
    description: "Check database connection health and get basic stats",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

// Tool implementations
async function executeQuery(params: z.infer<typeof QuerySchema>): Promise<any> {
  const database = await getDatabase();

  const startTime = Date.now();
  let result;

  if (params.params && params.params.length > 0) {
    // Use prepared statement with parameters
    const stmt = await database.prepare(params.sql);
    result = await stmt.all(...params.params);
    await stmt.finalize();
  } else {
    result = await database.all(params.sql);
  }

  const duration = Date.now() - startTime;

  // Determine if it's a SELECT or mutation
  const isSelect = params.sql.trim().toUpperCase().startsWith("SELECT") ||
                   params.sql.trim().toUpperCase().startsWith("WITH") ||
                   params.sql.trim().toUpperCase().startsWith("SHOW") ||
                   params.sql.trim().toUpperCase().startsWith("DESCRIBE") ||
                   params.sql.trim().toUpperCase().startsWith("PRAGMA");

  return {
    success: true,
    rowCount: Array.isArray(result) ? result.length : 0,
    rows: result,
    durationMs: duration,
    queryType: isSelect ? "select" : "mutation",
  };
}

async function listTables(params: z.infer<typeof ListTablesSchema>): Promise<any> {
  const database = await getDatabase();

  let sql = `
    SELECT
      table_name,
      table_type,
      estimated_size
    FROM duckdb_tables()
    WHERE schema_name = ?
  `;

  if (!params.include_views) {
    sql += ` AND table_type = 'BASE TABLE'`;
  }

  sql += ` ORDER BY table_name`;

  const tables = await database.all(sql, params.schema);

  return {
    schema: params.schema,
    tables,
    count: tables.length,
  };
}

async function describeTable(params: z.infer<typeof DescribeTableSchema>): Promise<any> {
  const database = await getDatabase();

  // Get column information
  const columns = await database.all(`
    SELECT
      column_name,
      data_type,
      is_nullable,
      column_default,
      numeric_precision,
      numeric_scale
    FROM information_schema.columns
    WHERE table_schema = ? AND table_name = ?
    ORDER BY ordinal_position
  `, params.schema, params.table);

  // Get table statistics
  const stats = await database.all(`
    SELECT
      estimated_size,
      column_count,
      index_count
    FROM duckdb_tables()
    WHERE schema_name = ? AND table_name = ?
  `, params.schema, params.table);

  // Get constraints
  const constraints = await database.all(`
    SELECT
      constraint_name,
      constraint_type
    FROM information_schema.table_constraints
    WHERE table_schema = ? AND table_name = ?
  `, params.schema, params.table);

  return {
    table: params.table,
    schema: params.schema,
    columns,
    constraints,
    statistics: stats[0] || null,
  };
}

async function createTable(params: z.infer<typeof CreateTableSchema>): Promise<any> {
  const database = await getDatabase();

  const columnDefs = params.columns.map(col => {
    let def = `"${col.name}" ${col.type}`;
    if (!col.nullable) def += " NOT NULL";
    if (col.primary_key) def += " PRIMARY KEY";
    return def;
  }).join(", ");

  const ifNotExists = params.if_not_exists ? "IF NOT EXISTS" : "";
  const fullTableName = `"${params.schema}"."${params.table}"`;

  const sql = `CREATE TABLE ${ifNotExists} ${fullTableName} (${columnDefs})`;
  await database.run(sql);

  return {
    success: true,
    table: params.table,
    schema: params.schema,
    columns: params.columns.length,
    sql,
  };
}

async function dropTable(params: z.infer<typeof DropTableSchema>): Promise<any> {
  const database = await getDatabase();

  const ifExists = params.if_exists ? "IF EXISTS" : "";
  const cascade = params.cascade ? "CASCADE" : "";
  const fullTableName = `"${params.schema}"."${params.table}"`;

  const sql = `DROP TABLE ${ifExists} ${fullTableName} ${cascade}`.trim();
  await database.run(sql);

  return {
    success: true,
    table: params.table,
    schema: params.schema,
    sql,
  };
}

async function importCSV(params: z.infer<typeof ImportCSVSchema>): Promise<any> {
  const database = await getDatabase();

  const fullTableName = `"${params.schema}"."${params.table}"`;
  const options: string[] = [];

  options.push(`header = ${params.header}`);
  options.push(`delim = '${params.delimiter}'`);
  options.push(`auto_detect = ${params.auto_detect}`);

  if (params.skip_rows > 0) {
    options.push(`skip = ${params.skip_rows}`);
  }

  if (params.null_string) {
    options.push(`nullstr = '${params.null_string}'`);
  }

  if (params.columns && Object.keys(params.columns).length > 0) {
    const colDefs = Object.entries(params.columns)
      .map(([name, type]) => `"${name}": '${type}'`)
      .join(", ");
    options.push(`columns = {${colDefs}}`);
  }

  const sql = `CREATE OR REPLACE TABLE ${fullTableName} AS SELECT * FROM read_csv('${params.file_path}', ${options.join(", ")})`;
  await database.run(sql);

  // Get row count
  const countResult = await database.all(`SELECT COUNT(*) as count FROM ${fullTableName}`);
  const rowCount = countResult[0]?.count || 0;

  return {
    success: true,
    table: params.table,
    schema: params.schema,
    rowsImported: rowCount,
    filePath: params.file_path,
  };
}

async function importParquet(params: z.infer<typeof ImportParquetSchema>): Promise<any> {
  const database = await getDatabase();

  const fullTableName = `"${params.schema}"."${params.table}"`;
  const options: string[] = [];

  if (params.hive_partitioning) {
    options.push("hive_partitioning = true");
  }

  const optionsStr = options.length > 0 ? `, ${options.join(", ")}` : "";
  const sql = `CREATE OR REPLACE TABLE ${fullTableName} AS SELECT * FROM read_parquet('${params.file_path}'${optionsStr})`;

  await database.run(sql);

  // Get row count
  const countResult = await database.all(`SELECT COUNT(*) as count FROM ${fullTableName}`);
  const rowCount = countResult[0]?.count || 0;

  return {
    success: true,
    table: params.table,
    schema: params.schema,
    rowsImported: rowCount,
    filePath: params.file_path,
  };
}

async function importJSON(params: z.infer<typeof ImportJSONSchema>): Promise<any> {
  const database = await getDatabase();

  const fullTableName = `"${params.schema}"."${params.table}"`;
  const options: string[] = [];

  if (params.format !== "auto") {
    options.push(`format = '${params.format}'`);
  }

  if (params.columns && Object.keys(params.columns).length > 0) {
    const colDefs = Object.entries(params.columns)
      .map(([name, type]) => `"${name}": '${type}'`)
      .join(", ");
    options.push(`columns = {${colDefs}}`);
  }

  const optionsStr = options.length > 0 ? `, ${options.join(", ")}` : "";
  const sql = `CREATE OR REPLACE TABLE ${fullTableName} AS SELECT * FROM read_json('${params.file_path}'${optionsStr})`;

  await database.run(sql);

  // Get row count
  const countResult = await database.all(`SELECT COUNT(*) as count FROM ${fullTableName}`);
  const rowCount = countResult[0]?.count || 0;

  return {
    success: true,
    table: params.table,
    schema: params.schema,
    rowsImported: rowCount,
    filePath: params.file_path,
  };
}

async function exportCSV(params: z.infer<typeof ExportCSVSchema>): Promise<any> {
  const database = await getDatabase();

  const options: string[] = [];
  options.push(`header ${params.header}`);
  options.push(`delimiter '${params.delimiter}'`);

  if (params.force_quote && params.force_quote.length > 0) {
    const cols = params.force_quote.map(c => `"${c}"`).join(", ");
    options.push(`force_quote (${cols})`);
  }

  const sql = `COPY (${params.query}) TO '${params.file_path}' (FORMAT CSV, ${options.join(", ")})`;
  await database.run(sql);

  return {
    success: true,
    filePath: params.file_path,
    format: "csv",
  };
}

async function exportParquet(params: z.infer<typeof ExportParquetSchema>): Promise<any> {
  const database = await getDatabase();

  const options: string[] = [];
  options.push(`compression '${params.compression}'`);

  if (params.row_group_size) {
    options.push(`row_group_size ${params.row_group_size}`);
  }

  const sql = `COPY (${params.query}) TO '${params.file_path}' (FORMAT PARQUET, ${options.join(", ")})`;
  await database.run(sql);

  return {
    success: true,
    filePath: params.file_path,
    format: "parquet",
    compression: params.compression,
  };
}

async function getDatabaseInfo(params: z.infer<typeof DatabaseInfoSchema>): Promise<any> {
  const database = await getDatabase();

  // Get version
  const versionResult = await database.all("SELECT version() as version");
  const version = versionResult[0]?.version;

  // Get database size and info
  const dbInfo = await database.all(`
    SELECT
      database_name,
      path
    FROM duckdb_databases()
  `);

  // Get table count
  const tableCount = await database.all(`
    SELECT COUNT(*) as count FROM duckdb_tables()
  `);

  const info: any = {
    version,
    databases: dbInfo,
    tableCount: tableCount[0]?.count || 0,
    currentPath: DATABASE_PATH,
    readOnly: READ_ONLY,
  };

  if (params.include_settings) {
    const settings = await database.all(`
      SELECT name, value, description
      FROM duckdb_settings()
      WHERE name IN (
        'threads', 'memory_limit', 'temp_directory',
        'default_null_order', 'default_order', 'max_memory'
      )
    `);
    info.settings = settings;
  }

  if (params.include_functions) {
    const functions = await database.all(`
      SELECT DISTINCT function_name, function_type
      FROM duckdb_functions()
      WHERE internal = false
      ORDER BY function_name
      LIMIT 100
    `);
    info.functions = functions;
  }

  return info;
}

async function loadExtension(params: z.infer<typeof ExtensionSchema>): Promise<any> {
  const database = await getDatabase();

  if (params.install) {
    try {
      await database.run(`INSTALL ${params.name}`);
    } catch (e) {
      // Extension might already be installed, continue to load
    }
  }

  await database.run(`LOAD ${params.name}`);

  return {
    success: true,
    extension: params.name,
    status: "loaded",
  };
}

async function listExtensions(): Promise<any> {
  const database = await getDatabase();

  const extensions = await database.all(`
    SELECT
      extension_name,
      loaded,
      installed,
      description
    FROM duckdb_extensions()
    ORDER BY extension_name
  `);

  return {
    extensions,
    count: extensions.length,
  };
}

async function openDatabase(params: { path: string; read_only?: boolean }): Promise<any> {
  // Close existing connection if any
  if (db) {
    await db.close();
    db = null;
  }

  // Open new database
  db = await Database.create(params.path, {
    access_mode: params.read_only ? "READ_ONLY" : "READ_WRITE",
  });

  return {
    success: true,
    path: params.path,
    readOnly: params.read_only || false,
    type: params.path === ":memory:" ? "in-memory" : "file",
  };
}

async function healthCheck(): Promise<any> {
  try {
    const database = await getDatabase();
    const start = Date.now();
    await database.all("SELECT 1 as ping");
    const latency = Date.now() - start;

    const memoryResult = await database.all(`
      SELECT
        (SELECT value FROM duckdb_settings() WHERE name = 'memory_limit') as memory_limit,
        (SELECT value FROM duckdb_settings() WHERE name = 'threads') as threads
    `);

    return {
      status: "healthy",
      latencyMs: latency,
      databasePath: DATABASE_PATH,
      inMemory: DATABASE_PATH === ":memory:",
      readOnly: READ_ONLY,
      config: memoryResult[0] || {},
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: "unhealthy",
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    };
  }
}

// Create server
const server = new Server(
  {
    name: "duckdb-mcp-server",
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
      case "list_tables":
        result = await listTables(ListTablesSchema.parse(args || {}));
        break;
      case "describe_table":
        result = await describeTable(DescribeTableSchema.parse(args));
        break;
      case "create_table":
        result = await createTable(CreateTableSchema.parse(args));
        break;
      case "drop_table":
        result = await dropTable(DropTableSchema.parse(args));
        break;
      case "import_csv":
        result = await importCSV(ImportCSVSchema.parse(args));
        break;
      case "import_parquet":
        result = await importParquet(ImportParquetSchema.parse(args));
        break;
      case "import_json":
        result = await importJSON(ImportJSONSchema.parse(args));
        break;
      case "export_csv":
        result = await exportCSV(ExportCSVSchema.parse(args));
        break;
      case "export_parquet":
        result = await exportParquet(ExportParquetSchema.parse(args));
        break;
      case "database_info":
        result = await getDatabaseInfo(DatabaseInfoSchema.parse(args || {}));
        break;
      case "load_extension":
        result = await loadExtension(ExtensionSchema.parse(args));
        break;
      case "list_extensions":
        result = await listExtensions();
        break;
      case "open_database":
        result = await openDatabase(args as { path: string; read_only?: boolean });
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
  if (db) {
    await db.close();
  }
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.error("Shutting down...");
  if (db) {
    await db.close();
  }
  process.exit(0);
});

// Start
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("DuckDB MCP Server started");
  console.error(`Database: ${DATABASE_PATH === ":memory:" ? "in-memory" : DATABASE_PATH}`);
}

main().catch(console.error);
