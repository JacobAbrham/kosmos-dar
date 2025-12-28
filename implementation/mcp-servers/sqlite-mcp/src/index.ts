/**
 * SQLite MCP Server
 *
 * Synchronous database operations for KOSMOS agents using better-sqlite3:
 * - Query execution (SELECT, INSERT, UPDATE, DELETE)
 * - Table operations (list, describe, create, drop)
 * - Database management (open, close, backup)
 * - Transactions (begin, commit, rollback)
 * - Indexes and triggers
 * - Pragma settings
 * - Import/export (CSV, JSON, SQL dump)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import Database, { Database as DatabaseType, Statement } from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";

// Environment configuration
const DEFAULT_DB_PATH = process.env.SQLITE_DB_PATH || ":memory:";
const BACKUP_DIR = process.env.SQLITE_BACKUP_DIR || "./backups";
const MAX_ROWS_EXPORT = parseInt(process.env.SQLITE_MAX_EXPORT_ROWS || "100000");

// Database connection management
interface DatabaseConnection {
  db: DatabaseType;
  path: string;
  openedAt: Date;
  inTransaction: boolean;
}

const connections: Map<string, DatabaseConnection> = new Map();
let defaultConnection: string | null = null;

// Helper to get or create connection
function getConnection(dbPath?: string): DatabaseConnection {
  const targetPath = dbPath || defaultConnection || DEFAULT_DB_PATH;

  if (!connections.has(targetPath)) {
    const db = new Database(targetPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    connections.set(targetPath, {
      db,
      path: targetPath,
      openedAt: new Date(),
      inTransaction: false,
    });
    if (!defaultConnection) {
      defaultConnection = targetPath;
    }
  }

  return connections.get(targetPath)!;
}

// Tool schemas
const QuerySchema = z.object({
  sql: z.string().describe("SQL query to execute"),
  params: z.union([
    z.array(z.unknown()),
    z.record(z.unknown()),
  ]).optional().describe("Query parameters (array for positional, object for named)"),
  dbPath: z.string().optional().describe("Database file path (uses default if not specified)"),
});

const ExecuteSchema = z.object({
  sql: z.string().describe("SQL statement to execute (INSERT, UPDATE, DELETE, CREATE, etc.)"),
  params: z.union([
    z.array(z.unknown()),
    z.record(z.unknown()),
  ]).optional().describe("Statement parameters"),
  dbPath: z.string().optional(),
});

const ExecuteManySchema = z.object({
  sql: z.string().describe("SQL statement to execute multiple times"),
  paramsList: z.array(z.union([
    z.array(z.unknown()),
    z.record(z.unknown()),
  ])).describe("Array of parameter sets"),
  dbPath: z.string().optional(),
});

const ListTablesSchema = z.object({
  dbPath: z.string().optional(),
  includeViews: z.boolean().default(true).describe("Include views in results"),
});

const DescribeTableSchema = z.object({
  table: z.string().describe("Table name to describe"),
  dbPath: z.string().optional(),
});

const CreateTableSchema = z.object({
  table: z.string().describe("Table name"),
  columns: z.array(z.object({
    name: z.string(),
    type: z.string().describe("SQLite type: TEXT, INTEGER, REAL, BLOB, NULL"),
    primaryKey: z.boolean().optional(),
    autoIncrement: z.boolean().optional(),
    notNull: z.boolean().optional(),
    unique: z.boolean().optional(),
    default: z.unknown().optional(),
    foreignKey: z.object({
      table: z.string(),
      column: z.string(),
      onDelete: z.enum(["CASCADE", "SET NULL", "RESTRICT", "NO ACTION"]).optional(),
      onUpdate: z.enum(["CASCADE", "SET NULL", "RESTRICT", "NO ACTION"]).optional(),
    }).optional(),
  })).describe("Column definitions"),
  ifNotExists: z.boolean().default(false),
  dbPath: z.string().optional(),
});

const DropTableSchema = z.object({
  table: z.string().describe("Table name to drop"),
  ifExists: z.boolean().default(true),
  dbPath: z.string().optional(),
});

const DatabaseOpenSchema = z.object({
  dbPath: z.string().describe("Path to SQLite database file"),
  readonly: z.boolean().default(false),
  create: z.boolean().default(true).describe("Create if doesn't exist"),
  setAsDefault: z.boolean().default(true),
});

const DatabaseCloseSchema = z.object({
  dbPath: z.string().optional().describe("Path to database to close (closes default if not specified)"),
});

const BackupSchema = z.object({
  dbPath: z.string().optional(),
  backupPath: z.string().optional().describe("Backup file path (auto-generated if not specified)"),
});

const TransactionBeginSchema = z.object({
  dbPath: z.string().optional(),
  type: z.enum(["DEFERRED", "IMMEDIATE", "EXCLUSIVE"]).default("DEFERRED"),
});

const TransactionEndSchema = z.object({
  dbPath: z.string().optional(),
});

const CreateIndexSchema = z.object({
  name: z.string().describe("Index name"),
  table: z.string().describe("Table name"),
  columns: z.array(z.string()).describe("Columns to index"),
  unique: z.boolean().default(false),
  ifNotExists: z.boolean().default(false),
  where: z.string().optional().describe("Partial index WHERE clause"),
  dbPath: z.string().optional(),
});

const DropIndexSchema = z.object({
  name: z.string().describe("Index name to drop"),
  ifExists: z.boolean().default(true),
  dbPath: z.string().optional(),
});

const ListIndexesSchema = z.object({
  table: z.string().optional().describe("Filter by table name"),
  dbPath: z.string().optional(),
});

const CreateTriggerSchema = z.object({
  name: z.string().describe("Trigger name"),
  table: z.string().describe("Table name"),
  timing: z.enum(["BEFORE", "AFTER", "INSTEAD OF"]),
  event: z.enum(["INSERT", "UPDATE", "DELETE"]),
  body: z.string().describe("Trigger body SQL"),
  when: z.string().optional().describe("Optional WHEN clause"),
  columns: z.array(z.string()).optional().describe("Columns for UPDATE trigger"),
  ifNotExists: z.boolean().default(false),
  dbPath: z.string().optional(),
});

const DropTriggerSchema = z.object({
  name: z.string().describe("Trigger name to drop"),
  ifExists: z.boolean().default(true),
  dbPath: z.string().optional(),
});

const ListTriggersSchema = z.object({
  table: z.string().optional().describe("Filter by table name"),
  dbPath: z.string().optional(),
});

const PragmaSchema = z.object({
  pragma: z.string().describe("Pragma name"),
  value: z.unknown().optional().describe("New value (omit to read current)"),
  dbPath: z.string().optional(),
});

const ExportCsvSchema = z.object({
  query: z.string().describe("SELECT query or table name"),
  filePath: z.string().describe("Output CSV file path"),
  delimiter: z.string().default(","),
  headers: z.boolean().default(true),
  dbPath: z.string().optional(),
});

const ImportCsvSchema = z.object({
  table: z.string().describe("Target table name"),
  filePath: z.string().describe("Input CSV file path"),
  delimiter: z.string().default(","),
  headers: z.boolean().default(true).describe("First row contains headers"),
  createTable: z.boolean().default(false).describe("Create table if not exists"),
  dbPath: z.string().optional(),
});

const ExportJsonSchema = z.object({
  query: z.string().describe("SELECT query or table name"),
  filePath: z.string().describe("Output JSON file path"),
  pretty: z.boolean().default(true),
  dbPath: z.string().optional(),
});

const ImportJsonSchema = z.object({
  table: z.string().describe("Target table name"),
  filePath: z.string().describe("Input JSON file path"),
  createTable: z.boolean().default(false),
  dbPath: z.string().optional(),
});

const DumpSchema = z.object({
  filePath: z.string().describe("Output SQL file path"),
  tables: z.array(z.string()).optional().describe("Specific tables to dump (all if omitted)"),
  dataOnly: z.boolean().default(false),
  schemaOnly: z.boolean().default(false),
  dbPath: z.string().optional(),
});

const VacuumSchema = z.object({
  dbPath: z.string().optional(),
  into: z.string().optional().describe("VACUUM INTO target file"),
});

const AnalyzeSchema = z.object({
  table: z.string().optional().describe("Specific table to analyze"),
  dbPath: z.string().optional(),
});

const IntegrityCheckSchema = z.object({
  maxErrors: z.number().default(100),
  dbPath: z.string().optional(),
});

// Tool definitions
const TOOLS: Tool[] = [
  // Query execution
  {
    name: "query",
    description: "Execute a SELECT query and return results",
    inputSchema: {
      type: "object",
      properties: {
        sql: { type: "string", description: "SELECT query to execute" },
        params: {
          description: "Query parameters (array for ?, object for :name or $name)",
          oneOf: [{ type: "array" }, { type: "object" }],
        },
        dbPath: { type: "string", description: "Database path (optional)" },
      },
      required: ["sql"],
    },
  },
  {
    name: "execute",
    description: "Execute a single SQL statement (INSERT, UPDATE, DELETE, CREATE, etc.)",
    inputSchema: {
      type: "object",
      properties: {
        sql: { type: "string", description: "SQL statement to execute" },
        params: {
          description: "Statement parameters",
          oneOf: [{ type: "array" }, { type: "object" }],
        },
        dbPath: { type: "string" },
      },
      required: ["sql"],
    },
  },
  {
    name: "execute_many",
    description: "Execute a statement multiple times with different parameters (batch insert)",
    inputSchema: {
      type: "object",
      properties: {
        sql: { type: "string", description: "SQL statement" },
        paramsList: {
          type: "array",
          description: "Array of parameter sets",
          items: { oneOf: [{ type: "array" }, { type: "object" }] },
        },
        dbPath: { type: "string" },
      },
      required: ["sql", "paramsList"],
    },
  },

  // Table operations
  {
    name: "list_tables",
    description: "List all tables and optionally views in the database",
    inputSchema: {
      type: "object",
      properties: {
        dbPath: { type: "string" },
        includeViews: { type: "boolean", default: true },
      },
    },
  },
  {
    name: "describe_table",
    description: "Get table schema including columns, types, and constraints",
    inputSchema: {
      type: "object",
      properties: {
        table: { type: "string", description: "Table name" },
        dbPath: { type: "string" },
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
        table: { type: "string", description: "Table name" },
        columns: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              type: { type: "string" },
              primaryKey: { type: "boolean" },
              autoIncrement: { type: "boolean" },
              notNull: { type: "boolean" },
              unique: { type: "boolean" },
              default: {},
              foreignKey: {
                type: "object",
                properties: {
                  table: { type: "string" },
                  column: { type: "string" },
                  onDelete: { type: "string" },
                  onUpdate: { type: "string" },
                },
              },
            },
            required: ["name", "type"],
          },
        },
        ifNotExists: { type: "boolean", default: false },
        dbPath: { type: "string" },
      },
      required: ["table", "columns"],
    },
  },
  {
    name: "drop_table",
    description: "Drop a table from the database",
    inputSchema: {
      type: "object",
      properties: {
        table: { type: "string", description: "Table name to drop" },
        ifExists: { type: "boolean", default: true },
        dbPath: { type: "string" },
      },
      required: ["table"],
    },
  },

  // Database management
  {
    name: "database_open",
    description: "Open a SQLite database file",
    inputSchema: {
      type: "object",
      properties: {
        dbPath: { type: "string", description: "Path to database file" },
        readonly: { type: "boolean", default: false },
        create: { type: "boolean", default: true },
        setAsDefault: { type: "boolean", default: true },
      },
      required: ["dbPath"],
    },
  },
  {
    name: "database_close",
    description: "Close a database connection",
    inputSchema: {
      type: "object",
      properties: {
        dbPath: { type: "string", description: "Database to close (default if omitted)" },
      },
    },
  },
  {
    name: "database_backup",
    description: "Create a backup of the database",
    inputSchema: {
      type: "object",
      properties: {
        dbPath: { type: "string" },
        backupPath: { type: "string", description: "Backup destination path" },
      },
    },
  },
  {
    name: "database_info",
    description: "Get database file information and statistics",
    inputSchema: {
      type: "object",
      properties: {
        dbPath: { type: "string" },
      },
    },
  },

  // Transactions
  {
    name: "transaction_begin",
    description: "Begin a new transaction",
    inputSchema: {
      type: "object",
      properties: {
        dbPath: { type: "string" },
        type: {
          type: "string",
          enum: ["DEFERRED", "IMMEDIATE", "EXCLUSIVE"],
          default: "DEFERRED",
        },
      },
    },
  },
  {
    name: "transaction_commit",
    description: "Commit the current transaction",
    inputSchema: {
      type: "object",
      properties: {
        dbPath: { type: "string" },
      },
    },
  },
  {
    name: "transaction_rollback",
    description: "Rollback the current transaction",
    inputSchema: {
      type: "object",
      properties: {
        dbPath: { type: "string" },
      },
    },
  },

  // Indexes
  {
    name: "create_index",
    description: "Create an index on a table",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Index name" },
        table: { type: "string", description: "Table name" },
        columns: { type: "array", items: { type: "string" }, description: "Columns" },
        unique: { type: "boolean", default: false },
        ifNotExists: { type: "boolean", default: false },
        where: { type: "string", description: "Partial index condition" },
        dbPath: { type: "string" },
      },
      required: ["name", "table", "columns"],
    },
  },
  {
    name: "drop_index",
    description: "Drop an index",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Index name" },
        ifExists: { type: "boolean", default: true },
        dbPath: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "list_indexes",
    description: "List all indexes, optionally filtered by table",
    inputSchema: {
      type: "object",
      properties: {
        table: { type: "string", description: "Filter by table" },
        dbPath: { type: "string" },
      },
    },
  },

  // Triggers
  {
    name: "create_trigger",
    description: "Create a trigger on a table",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Trigger name" },
        table: { type: "string", description: "Table name" },
        timing: { type: "string", enum: ["BEFORE", "AFTER", "INSTEAD OF"] },
        event: { type: "string", enum: ["INSERT", "UPDATE", "DELETE"] },
        body: { type: "string", description: "Trigger body SQL" },
        when: { type: "string", description: "WHEN condition" },
        columns: { type: "array", items: { type: "string" }, description: "UPDATE columns" },
        ifNotExists: { type: "boolean", default: false },
        dbPath: { type: "string" },
      },
      required: ["name", "table", "timing", "event", "body"],
    },
  },
  {
    name: "drop_trigger",
    description: "Drop a trigger",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Trigger name" },
        ifExists: { type: "boolean", default: true },
        dbPath: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "list_triggers",
    description: "List all triggers, optionally filtered by table",
    inputSchema: {
      type: "object",
      properties: {
        table: { type: "string", description: "Filter by table" },
        dbPath: { type: "string" },
      },
    },
  },

  // Pragma settings
  {
    name: "pragma",
    description: "Get or set SQLite pragma values",
    inputSchema: {
      type: "object",
      properties: {
        pragma: { type: "string", description: "Pragma name (e.g., journal_mode, foreign_keys)" },
        value: { description: "New value (omit to read current)" },
        dbPath: { type: "string" },
      },
      required: ["pragma"],
    },
  },

  // Import/Export
  {
    name: "export_csv",
    description: "Export query results or table to CSV file",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "SELECT query or table name" },
        filePath: { type: "string", description: "Output CSV file path" },
        delimiter: { type: "string", default: "," },
        headers: { type: "boolean", default: true },
        dbPath: { type: "string" },
      },
      required: ["query", "filePath"],
    },
  },
  {
    name: "import_csv",
    description: "Import CSV file into a table",
    inputSchema: {
      type: "object",
      properties: {
        table: { type: "string", description: "Target table" },
        filePath: { type: "string", description: "Input CSV file path" },
        delimiter: { type: "string", default: "," },
        headers: { type: "boolean", default: true },
        createTable: { type: "boolean", default: false },
        dbPath: { type: "string" },
      },
      required: ["table", "filePath"],
    },
  },
  {
    name: "export_json",
    description: "Export query results or table to JSON file",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "SELECT query or table name" },
        filePath: { type: "string", description: "Output JSON file path" },
        pretty: { type: "boolean", default: true },
        dbPath: { type: "string" },
      },
      required: ["query", "filePath"],
    },
  },
  {
    name: "import_json",
    description: "Import JSON array file into a table",
    inputSchema: {
      type: "object",
      properties: {
        table: { type: "string", description: "Target table" },
        filePath: { type: "string", description: "Input JSON file path" },
        createTable: { type: "boolean", default: false },
        dbPath: { type: "string" },
      },
      required: ["table", "filePath"],
    },
  },
  {
    name: "dump",
    description: "Export database schema and/or data as SQL statements",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Output SQL file path" },
        tables: { type: "array", items: { type: "string" }, description: "Specific tables" },
        dataOnly: { type: "boolean", default: false },
        schemaOnly: { type: "boolean", default: false },
        dbPath: { type: "string" },
      },
      required: ["filePath"],
    },
  },

  // Maintenance
  {
    name: "vacuum",
    description: "Rebuild the database file to reclaim space",
    inputSchema: {
      type: "object",
      properties: {
        dbPath: { type: "string" },
        into: { type: "string", description: "VACUUM INTO target file" },
      },
    },
  },
  {
    name: "analyze",
    description: "Update query planner statistics",
    inputSchema: {
      type: "object",
      properties: {
        table: { type: "string", description: "Specific table to analyze" },
        dbPath: { type: "string" },
      },
    },
  },
  {
    name: "integrity_check",
    description: "Check database integrity",
    inputSchema: {
      type: "object",
      properties: {
        maxErrors: { type: "number", default: 100 },
        dbPath: { type: "string" },
      },
    },
  },
];

// Tool implementations

function executeQuery(params: z.infer<typeof QuerySchema>): any {
  const conn = getConnection(params.dbPath);
  const stmt = conn.db.prepare(params.sql);
  const rows = params.params ? stmt.all(params.params) : stmt.all();

  return {
    success: true,
    rowCount: rows.length,
    rows,
    columns: stmt.columns().map((c) => ({
      name: c.name,
      type: c.type,
      table: c.table,
    })),
  };
}

function executeStatement(params: z.infer<typeof ExecuteSchema>): any {
  const conn = getConnection(params.dbPath);
  const stmt = conn.db.prepare(params.sql);
  const result = params.params ? stmt.run(params.params) : stmt.run();

  return {
    success: true,
    changes: result.changes,
    lastInsertRowid: result.lastInsertRowid,
  };
}

function executeMany(params: z.infer<typeof ExecuteManySchema>): any {
  const conn = getConnection(params.dbPath);
  const stmt = conn.db.prepare(params.sql);

  let totalChanges = 0;
  const insertMany = conn.db.transaction((items: any[]) => {
    for (const item of items) {
      const result = stmt.run(item);
      totalChanges += result.changes;
    }
  });

  insertMany(params.paramsList);

  return {
    success: true,
    totalChanges,
    rowsProcessed: params.paramsList.length,
  };
}

function listTables(params: z.infer<typeof ListTablesSchema>): any {
  const conn = getConnection(params.dbPath);

  let sql = `
    SELECT name, type, sql
    FROM sqlite_master
    WHERE type = 'table'
  `;

  if (params.includeViews) {
    sql = `
      SELECT name, type, sql
      FROM sqlite_master
      WHERE type IN ('table', 'view')
    `;
  }

  sql += ` AND name NOT LIKE 'sqlite_%' ORDER BY type, name`;

  const rows = conn.db.prepare(sql).all();

  return {
    success: true,
    tables: rows,
    count: rows.length,
  };
}

function describeTable(params: z.infer<typeof DescribeTableSchema>): any {
  const conn = getConnection(params.dbPath);

  // Get column info
  const columns = conn.db.prepare(`PRAGMA table_info("${params.table}")`).all();

  // Get foreign keys
  const foreignKeys = conn.db.prepare(`PRAGMA foreign_key_list("${params.table}")`).all();

  // Get indexes
  const indexes = conn.db.prepare(`PRAGMA index_list("${params.table}")`).all();

  // Get table SQL
  const tableSql = conn.db
    .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`)
    .get(params.table) as { sql: string } | undefined;

  return {
    success: true,
    table: params.table,
    columns,
    foreignKeys,
    indexes,
    sql: tableSql?.sql,
  };
}

function createTable(params: z.infer<typeof CreateTableSchema>): any {
  const conn = getConnection(params.dbPath);

  const columnDefs = params.columns.map((col) => {
    let def = `"${col.name}" ${col.type}`;

    if (col.primaryKey) {
      def += " PRIMARY KEY";
      if (col.autoIncrement) {
        def += " AUTOINCREMENT";
      }
    }
    if (col.notNull) {
      def += " NOT NULL";
    }
    if (col.unique && !col.primaryKey) {
      def += " UNIQUE";
    }
    if (col.default !== undefined) {
      const defaultVal =
        typeof col.default === "string" ? `'${col.default}'` : col.default;
      def += ` DEFAULT ${defaultVal}`;
    }
    if (col.foreignKey) {
      def += ` REFERENCES "${col.foreignKey.table}"("${col.foreignKey.column}")`;
      if (col.foreignKey.onDelete) {
        def += ` ON DELETE ${col.foreignKey.onDelete}`;
      }
      if (col.foreignKey.onUpdate) {
        def += ` ON UPDATE ${col.foreignKey.onUpdate}`;
      }
    }

    return def;
  });

  const ifNotExists = params.ifNotExists ? "IF NOT EXISTS " : "";
  const sql = `CREATE TABLE ${ifNotExists}"${params.table}" (${columnDefs.join(", ")})`;

  conn.db.exec(sql);

  return {
    success: true,
    table: params.table,
    sql,
  };
}

function dropTable(params: z.infer<typeof DropTableSchema>): any {
  const conn = getConnection(params.dbPath);
  const ifExists = params.ifExists ? "IF EXISTS " : "";
  const sql = `DROP TABLE ${ifExists}"${params.table}"`;

  conn.db.exec(sql);

  return {
    success: true,
    table: params.table,
    dropped: true,
  };
}

function databaseOpen(params: z.infer<typeof DatabaseOpenSchema>): any {
  const options: any = {};
  if (params.readonly) options.readonly = true;
  if (!params.create) options.fileMustExist = true;

  const db = new Database(params.dbPath, options);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  connections.set(params.dbPath, {
    db,
    path: params.dbPath,
    openedAt: new Date(),
    inTransaction: false,
  });

  if (params.setAsDefault) {
    defaultConnection = params.dbPath;
  }

  return {
    success: true,
    path: params.dbPath,
    readonly: params.readonly,
    isDefault: params.setAsDefault,
  };
}

function databaseClose(params: z.infer<typeof DatabaseCloseSchema>): any {
  const targetPath = params.dbPath || defaultConnection;

  if (!targetPath) {
    throw new Error("No database to close");
  }

  const conn = connections.get(targetPath);
  if (!conn) {
    throw new Error(`Database not open: ${targetPath}`);
  }

  conn.db.close();
  connections.delete(targetPath);

  if (defaultConnection === targetPath) {
    defaultConnection = connections.size > 0 ? connections.keys().next().value : null;
  }

  return {
    success: true,
    path: targetPath,
    closed: true,
  };
}

function databaseBackup(params: z.infer<typeof BackupSchema>): any {
  const conn = getConnection(params.dbPath);

  // Ensure backup directory exists
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const baseName = path.basename(conn.path, ".db");
  const backupPath =
    params.backupPath || path.join(BACKUP_DIR, `${baseName}_${timestamp}.db`);

  conn.db.backup(backupPath);

  return {
    success: true,
    sourcePath: conn.path,
    backupPath,
    timestamp: new Date().toISOString(),
  };
}

function databaseInfo(params: { dbPath?: string }): any {
  const conn = getConnection(params.dbPath);

  // Get page count and size
  const pageCount = conn.db.pragma("page_count", { simple: true }) as number;
  const pageSize = conn.db.pragma("page_size", { simple: true }) as number;
  const freelistCount = conn.db.pragma("freelist_count", { simple: true }) as number;

  // Get table count
  const tableCount = conn.db
    .prepare(
      `SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`
    )
    .get() as { count: number };

  // Get journal mode
  const journalMode = conn.db.pragma("journal_mode", { simple: true });

  return {
    success: true,
    path: conn.path,
    openedAt: conn.openedAt.toISOString(),
    inTransaction: conn.inTransaction,
    stats: {
      pageCount,
      pageSize,
      totalSize: pageCount * pageSize,
      freelistPages: freelistCount,
      tableCount: tableCount.count,
      journalMode,
    },
  };
}

function transactionBegin(params: z.infer<typeof TransactionBeginSchema>): any {
  const conn = getConnection(params.dbPath);

  if (conn.inTransaction) {
    throw new Error("Transaction already in progress");
  }

  conn.db.exec(`BEGIN ${params.type} TRANSACTION`);
  conn.inTransaction = true;

  return {
    success: true,
    type: params.type,
    message: "Transaction started",
  };
}

function transactionCommit(params: z.infer<typeof TransactionEndSchema>): any {
  const conn = getConnection(params.dbPath);

  if (!conn.inTransaction) {
    throw new Error("No transaction in progress");
  }

  conn.db.exec("COMMIT");
  conn.inTransaction = false;

  return {
    success: true,
    message: "Transaction committed",
  };
}

function transactionRollback(params: z.infer<typeof TransactionEndSchema>): any {
  const conn = getConnection(params.dbPath);

  if (!conn.inTransaction) {
    throw new Error("No transaction in progress");
  }

  conn.db.exec("ROLLBACK");
  conn.inTransaction = false;

  return {
    success: true,
    message: "Transaction rolled back",
  };
}

function createIndex(params: z.infer<typeof CreateIndexSchema>): any {
  const conn = getConnection(params.dbPath);

  const unique = params.unique ? "UNIQUE " : "";
  const ifNotExists = params.ifNotExists ? "IF NOT EXISTS " : "";
  const columns = params.columns.map((c) => `"${c}"`).join(", ");

  let sql = `CREATE ${unique}INDEX ${ifNotExists}"${params.name}" ON "${params.table}" (${columns})`;

  if (params.where) {
    sql += ` WHERE ${params.where}`;
  }

  conn.db.exec(sql);

  return {
    success: true,
    name: params.name,
    table: params.table,
    sql,
  };
}

function dropIndex(params: z.infer<typeof DropIndexSchema>): any {
  const conn = getConnection(params.dbPath);
  const ifExists = params.ifExists ? "IF EXISTS " : "";
  const sql = `DROP INDEX ${ifExists}"${params.name}"`;

  conn.db.exec(sql);

  return {
    success: true,
    name: params.name,
    dropped: true,
  };
}

function listIndexes(params: z.infer<typeof ListIndexesSchema>): any {
  const conn = getConnection(params.dbPath);

  let sql = `
    SELECT name, tbl_name as table_name, sql
    FROM sqlite_master
    WHERE type = 'index' AND sql IS NOT NULL
  `;

  if (params.table) {
    sql += ` AND tbl_name = '${params.table}'`;
  }

  sql += " ORDER BY tbl_name, name";

  const rows = conn.db.prepare(sql).all();

  return {
    success: true,
    indexes: rows,
    count: rows.length,
  };
}

function createTrigger(params: z.infer<typeof CreateTriggerSchema>): any {
  const conn = getConnection(params.dbPath);

  const ifNotExists = params.ifNotExists ? "IF NOT EXISTS " : "";
  let event = params.event;

  if (params.event === "UPDATE" && params.columns?.length) {
    event = `UPDATE OF ${params.columns.map((c) => `"${c}"`).join(", ")}`;
  }

  let sql = `CREATE TRIGGER ${ifNotExists}"${params.name}" ${params.timing} ${event} ON "${params.table}"`;

  if (params.when) {
    sql += ` WHEN ${params.when}`;
  }

  sql += ` BEGIN ${params.body} END`;

  conn.db.exec(sql);

  return {
    success: true,
    name: params.name,
    table: params.table,
    sql,
  };
}

function dropTrigger(params: z.infer<typeof DropTriggerSchema>): any {
  const conn = getConnection(params.dbPath);
  const ifExists = params.ifExists ? "IF EXISTS " : "";
  const sql = `DROP TRIGGER ${ifExists}"${params.name}"`;

  conn.db.exec(sql);

  return {
    success: true,
    name: params.name,
    dropped: true,
  };
}

function listTriggers(params: z.infer<typeof ListTriggersSchema>): any {
  const conn = getConnection(params.dbPath);

  let sql = `
    SELECT name, tbl_name as table_name, sql
    FROM sqlite_master
    WHERE type = 'trigger'
  `;

  if (params.table) {
    sql += ` AND tbl_name = '${params.table}'`;
  }

  sql += " ORDER BY tbl_name, name";

  const rows = conn.db.prepare(sql).all();

  return {
    success: true,
    triggers: rows,
    count: rows.length,
  };
}

function handlePragma(params: z.infer<typeof PragmaSchema>): any {
  const conn = getConnection(params.dbPath);

  if (params.value !== undefined) {
    conn.db.pragma(`${params.pragma} = ${params.value}`);
    return {
      success: true,
      pragma: params.pragma,
      value: params.value,
      action: "set",
    };
  } else {
    const value = conn.db.pragma(params.pragma, { simple: true });
    return {
      success: true,
      pragma: params.pragma,
      value,
      action: "get",
    };
  }
}

function exportCsv(params: z.infer<typeof ExportCsvSchema>): any {
  const conn = getConnection(params.dbPath);

  // Determine if query is table name or SQL
  const sql = params.query.trim().toLowerCase().startsWith("select")
    ? params.query
    : `SELECT * FROM "${params.query}"`;

  const stmt = conn.db.prepare(sql);
  const rows = stmt.all() as Record<string, any>[];

  if (rows.length === 0) {
    fs.writeFileSync(params.filePath, "");
    return {
      success: true,
      filePath: params.filePath,
      rowsExported: 0,
    };
  }

  const columns = Object.keys(rows[0]);
  const lines: string[] = [];

  if (params.headers) {
    lines.push(columns.join(params.delimiter));
  }

  for (const row of rows.slice(0, MAX_ROWS_EXPORT)) {
    const values = columns.map((col) => {
      const val = row[col];
      if (val === null || val === undefined) return "";
      const str = String(val);
      // Escape if contains delimiter, quote, or newline
      if (str.includes(params.delimiter) || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
    lines.push(values.join(params.delimiter));
  }

  fs.writeFileSync(params.filePath, lines.join("\n"));

  return {
    success: true,
    filePath: params.filePath,
    rowsExported: Math.min(rows.length, MAX_ROWS_EXPORT),
    truncated: rows.length > MAX_ROWS_EXPORT,
  };
}

function importCsv(params: z.infer<typeof ImportCsvSchema>): any {
  const conn = getConnection(params.dbPath);

  const content = fs.readFileSync(params.filePath, "utf-8");
  const lines = content.split("\n").filter((line) => line.trim());

  if (lines.length === 0) {
    return { success: true, rowsImported: 0 };
  }

  // Parse CSV (simple parser, handles quoted fields)
  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === params.delimiter && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  };

  const headerRow = parseRow(lines[0]);
  const dataStartIndex = params.headers ? 1 : 0;
  const columns = params.headers ? headerRow : headerRow.map((_, i) => `column${i + 1}`);

  // Create table if requested
  if (params.createTable) {
    const columnDefs = columns.map((col) => `"${col}" TEXT`).join(", ");
    conn.db.exec(`CREATE TABLE IF NOT EXISTS "${params.table}" (${columnDefs})`);
  }

  // Insert data
  const placeholders = columns.map(() => "?").join(", ");
  const insertSql = `INSERT INTO "${params.table}" (${columns.map((c) => `"${c}"`).join(", ")}) VALUES (${placeholders})`;
  const stmt = conn.db.prepare(insertSql);

  const insertMany = conn.db.transaction((rows: string[][]) => {
    for (const row of rows) {
      stmt.run(row);
    }
  });

  const dataRows = lines.slice(dataStartIndex).map(parseRow);
  insertMany(dataRows);

  return {
    success: true,
    filePath: params.filePath,
    rowsImported: dataRows.length,
    columns,
  };
}

function exportJson(params: z.infer<typeof ExportJsonSchema>): any {
  const conn = getConnection(params.dbPath);

  const sql = params.query.trim().toLowerCase().startsWith("select")
    ? params.query
    : `SELECT * FROM "${params.query}"`;

  const stmt = conn.db.prepare(sql);
  const rows = stmt.all();

  const limitedRows = rows.slice(0, MAX_ROWS_EXPORT);
  const json = params.pretty
    ? JSON.stringify(limitedRows, null, 2)
    : JSON.stringify(limitedRows);

  fs.writeFileSync(params.filePath, json);

  return {
    success: true,
    filePath: params.filePath,
    rowsExported: limitedRows.length,
    truncated: rows.length > MAX_ROWS_EXPORT,
  };
}

function importJson(params: z.infer<typeof ImportJsonSchema>): any {
  const conn = getConnection(params.dbPath);

  const content = fs.readFileSync(params.filePath, "utf-8");
  const data = JSON.parse(content);

  if (!Array.isArray(data) || data.length === 0) {
    return { success: true, rowsImported: 0 };
  }

  const columns = Object.keys(data[0]);

  // Create table if requested
  if (params.createTable) {
    const columnDefs = columns
      .map((col) => {
        const sample = data[0][col];
        let type = "TEXT";
        if (typeof sample === "number") {
          type = Number.isInteger(sample) ? "INTEGER" : "REAL";
        }
        return `"${col}" ${type}`;
      })
      .join(", ");
    conn.db.exec(`CREATE TABLE IF NOT EXISTS "${params.table}" (${columnDefs})`);
  }

  // Insert data
  const placeholders = columns.map(() => "?").join(", ");
  const insertSql = `INSERT INTO "${params.table}" (${columns.map((c) => `"${c}"`).join(", ")}) VALUES (${placeholders})`;
  const stmt = conn.db.prepare(insertSql);

  const insertMany = conn.db.transaction((rows: any[]) => {
    for (const row of rows) {
      const values = columns.map((col) => row[col]);
      stmt.run(values);
    }
  });

  insertMany(data);

  return {
    success: true,
    filePath: params.filePath,
    rowsImported: data.length,
    columns,
  };
}

function dumpDatabase(params: z.infer<typeof DumpSchema>): any {
  const conn = getConnection(params.dbPath);
  const lines: string[] = [];

  // Get tables to dump
  let tables: any[];
  if (params.tables?.length) {
    tables = params.tables.map((name) => ({ name }));
  } else {
    tables = conn.db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
      )
      .all() as { name: string }[];
  }

  lines.push("-- SQLite Database Dump");
  lines.push(`-- Generated: ${new Date().toISOString()}`);
  lines.push("BEGIN TRANSACTION;\n");

  for (const { name } of tables) {
    // Schema
    if (!params.dataOnly) {
      const schema = conn.db
        .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`)
        .get(name) as { sql: string };
      if (schema?.sql) {
        lines.push(`-- Table: ${name}`);
        lines.push(`${schema.sql};`);
        lines.push("");
      }
    }

    // Data
    if (!params.schemaOnly) {
      const rows = conn.db.prepare(`SELECT * FROM "${name}"`).all() as Record<string, any>[];
      if (rows.length > 0) {
        const columns = Object.keys(rows[0]);
        for (const row of rows) {
          const values = columns
            .map((col) => {
              const val = row[col];
              if (val === null) return "NULL";
              if (typeof val === "number") return String(val);
              return `'${String(val).replace(/'/g, "''")}'`;
            })
            .join(", ");
          lines.push(
            `INSERT INTO "${name}" (${columns.map((c) => `"${c}"`).join(", ")}) VALUES (${values});`
          );
        }
        lines.push("");
      }
    }
  }

  // Indexes
  if (!params.dataOnly) {
    const indexes = conn.db
      .prepare(
        `SELECT sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL ORDER BY name`
      )
      .all() as { sql: string }[];
    if (indexes.length > 0) {
      lines.push("-- Indexes");
      for (const { sql } of indexes) {
        lines.push(`${sql};`);
      }
      lines.push("");
    }

    // Triggers
    const triggers = conn.db
      .prepare(`SELECT sql FROM sqlite_master WHERE type='trigger' ORDER BY name`)
      .all() as { sql: string }[];
    if (triggers.length > 0) {
      lines.push("-- Triggers");
      for (const { sql } of triggers) {
        lines.push(`${sql};`);
      }
      lines.push("");
    }
  }

  lines.push("COMMIT;");

  fs.writeFileSync(params.filePath, lines.join("\n"));

  return {
    success: true,
    filePath: params.filePath,
    tablesExported: tables.length,
    schemaOnly: params.schemaOnly,
    dataOnly: params.dataOnly,
  };
}

function vacuum(params: z.infer<typeof VacuumSchema>): any {
  const conn = getConnection(params.dbPath);

  if (params.into) {
    conn.db.exec(`VACUUM INTO '${params.into}'`);
    return {
      success: true,
      action: "vacuum_into",
      targetPath: params.into,
    };
  } else {
    conn.db.exec("VACUUM");
    return {
      success: true,
      action: "vacuum",
    };
  }
}

function analyze(params: z.infer<typeof AnalyzeSchema>): any {
  const conn = getConnection(params.dbPath);

  if (params.table) {
    conn.db.exec(`ANALYZE "${params.table}"`);
  } else {
    conn.db.exec("ANALYZE");
  }

  return {
    success: true,
    table: params.table || "all",
    message: "Statistics updated",
  };
}

function integrityCheck(params: z.infer<typeof IntegrityCheckSchema>): any {
  const conn = getConnection(params.dbPath);

  const results = conn.db
    .prepare(`PRAGMA integrity_check(${params.maxErrors})`)
    .all() as { integrity_check: string }[];

  const ok = results.length === 1 && results[0].integrity_check === "ok";

  return {
    success: true,
    ok,
    issues: ok ? [] : results.map((r) => r.integrity_check),
    checkedAt: new Date().toISOString(),
  };
}

// Create server
const server = new Server(
  {
    name: "sqlite-mcp-server",
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
      // Query execution
      case "query":
        result = executeQuery(QuerySchema.parse(args));
        break;
      case "execute":
        result = executeStatement(ExecuteSchema.parse(args));
        break;
      case "execute_many":
        result = executeMany(ExecuteManySchema.parse(args));
        break;

      // Table operations
      case "list_tables":
        result = listTables(ListTablesSchema.parse(args));
        break;
      case "describe_table":
        result = describeTable(DescribeTableSchema.parse(args));
        break;
      case "create_table":
        result = createTable(CreateTableSchema.parse(args));
        break;
      case "drop_table":
        result = dropTable(DropTableSchema.parse(args));
        break;

      // Database management
      case "database_open":
        result = databaseOpen(DatabaseOpenSchema.parse(args));
        break;
      case "database_close":
        result = databaseClose(DatabaseCloseSchema.parse(args));
        break;
      case "database_backup":
        result = databaseBackup(BackupSchema.parse(args));
        break;
      case "database_info":
        result = databaseInfo(args as { dbPath?: string });
        break;

      // Transactions
      case "transaction_begin":
        result = transactionBegin(TransactionBeginSchema.parse(args));
        break;
      case "transaction_commit":
        result = transactionCommit(TransactionEndSchema.parse(args));
        break;
      case "transaction_rollback":
        result = transactionRollback(TransactionEndSchema.parse(args));
        break;

      // Indexes
      case "create_index":
        result = createIndex(CreateIndexSchema.parse(args));
        break;
      case "drop_index":
        result = dropIndex(DropIndexSchema.parse(args));
        break;
      case "list_indexes":
        result = listIndexes(ListIndexesSchema.parse(args));
        break;

      // Triggers
      case "create_trigger":
        result = createTrigger(CreateTriggerSchema.parse(args));
        break;
      case "drop_trigger":
        result = dropTrigger(DropTriggerSchema.parse(args));
        break;
      case "list_triggers":
        result = listTriggers(ListTriggersSchema.parse(args));
        break;

      // Pragma
      case "pragma":
        result = handlePragma(PragmaSchema.parse(args));
        break;

      // Import/Export
      case "export_csv":
        result = exportCsv(ExportCsvSchema.parse(args));
        break;
      case "import_csv":
        result = importCsv(ImportCsvSchema.parse(args));
        break;
      case "export_json":
        result = exportJson(ExportJsonSchema.parse(args));
        break;
      case "import_json":
        result = importJson(ImportJsonSchema.parse(args));
        break;
      case "dump":
        result = dumpDatabase(DumpSchema.parse(args));
        break;

      // Maintenance
      case "vacuum":
        result = vacuum(VacuumSchema.parse(args));
        break;
      case "analyze":
        result = analyze(AnalyzeSchema.parse(args));
        break;
      case "integrity_check":
        result = integrityCheck(IntegrityCheckSchema.parse(args));
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
process.on("SIGINT", () => {
  console.error("Shutting down...");
  for (const conn of connections.values()) {
    try {
      conn.db.close();
    } catch {
      // Ignore close errors during shutdown
    }
  }
  connections.clear();
  process.exit(0);
});

// Start
async function main() {
  // Initialize default connection if path is provided
  if (DEFAULT_DB_PATH !== ":memory:") {
    getConnection(DEFAULT_DB_PATH);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("SQLite MCP Server started");
}

main().catch(console.error);
