/**
 * Filesystem MCP Server
 *
 * Provides secure local file operations for KOSMOS agents.
 * Features:
 * - Read/write files with encoding support
 * - Directory operations (list, create, delete)
 * - File search with glob patterns
 * - File watching for real-time updates
 * - Secure sandbox with configurable allowed paths
 *
 * Security: All operations are restricted to configured allowed directories.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import { glob } from "glob";
import * as mimeTypes from "mime-types";
import { watch, FSWatcher } from "chokidar";

// =============================================================================
// Configuration
// =============================================================================

const config = {
  allowedPaths: (process.env.FS_ALLOWED_PATHS || process.cwd()).split(","),
  maxFileSize: parseInt(process.env.FS_MAX_FILE_SIZE || "10485760"), // 10MB
  enableWatch: process.env.FS_ENABLE_WATCH === "true",
};

// Active file watchers
const watchers: Map<string, FSWatcher> = new Map();

// =============================================================================
// Security Helpers
// =============================================================================

function isPathAllowed(targetPath: string): boolean {
  const resolved = path.resolve(targetPath);
  return config.allowedPaths.some(allowed =>
    resolved.startsWith(path.resolve(allowed))
  );
}

function assertPathAllowed(targetPath: string): void {
  if (!isPathAllowed(targetPath)) {
    throw new Error(`Access denied: Path "${targetPath}" is outside allowed directories`);
  }
}

// =============================================================================
// Tool Definitions
// =============================================================================

const TOOLS: Tool[] = [
  {
    name: "read_file",
    description: "Read the contents of a file. Supports text and binary files with various encodings.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Absolute or relative path to the file",
        },
        encoding: {
          type: "string",
          enum: ["utf8", "base64", "hex", "latin1"],
          description: "File encoding (default: utf8, use base64 for binary)",
        },
        start: {
          type: "number",
          description: "Start byte position for partial read",
        },
        end: {
          type: "number",
          description: "End byte position for partial read",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Write content to a file. Creates parent directories if needed.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Absolute or relative path to the file",
        },
        content: {
          type: "string",
          description: "Content to write to the file",
        },
        encoding: {
          type: "string",
          enum: ["utf8", "base64", "hex", "latin1"],
          description: "Content encoding (default: utf8)",
        },
        append: {
          type: "boolean",
          description: "Append to file instead of overwriting",
        },
        createDirs: {
          type: "boolean",
          description: "Create parent directories if they don't exist (default: true)",
        },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "list_directory",
    description: "List contents of a directory with optional filtering and metadata.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Directory path to list",
        },
        recursive: {
          type: "boolean",
          description: "List subdirectories recursively",
        },
        includeHidden: {
          type: "boolean",
          description: "Include hidden files (starting with .)",
        },
        filter: {
          type: "string",
          description: "Glob pattern to filter results (e.g., '*.ts')",
        },
        includeStats: {
          type: "boolean",
          description: "Include file size, modified time, etc.",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "create_directory",
    description: "Create a new directory, including parent directories if needed.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Directory path to create",
        },
        recursive: {
          type: "boolean",
          description: "Create parent directories (default: true)",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "delete_path",
    description: "Delete a file or directory. Use with caution.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to delete",
        },
        recursive: {
          type: "boolean",
          description: "Delete directory contents recursively",
        },
        force: {
          type: "boolean",
          description: "Ignore errors if path doesn't exist",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "move_path",
    description: "Move or rename a file or directory.",
    inputSchema: {
      type: "object",
      properties: {
        source: {
          type: "string",
          description: "Source path",
        },
        destination: {
          type: "string",
          description: "Destination path",
        },
        overwrite: {
          type: "boolean",
          description: "Overwrite if destination exists",
        },
      },
      required: ["source", "destination"],
    },
  },
  {
    name: "copy_path",
    description: "Copy a file or directory.",
    inputSchema: {
      type: "object",
      properties: {
        source: {
          type: "string",
          description: "Source path",
        },
        destination: {
          type: "string",
          description: "Destination path",
        },
        recursive: {
          type: "boolean",
          description: "Copy directory contents recursively",
        },
        overwrite: {
          type: "boolean",
          description: "Overwrite if destination exists",
        },
      },
      required: ["source", "destination"],
    },
  },
  {
    name: "search_files",
    description: "Search for files using glob patterns. Powerful pattern matching for finding files.",
    inputSchema: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "Glob pattern (e.g., '**/*.ts', 'src/**/*.{js,jsx}')",
        },
        cwd: {
          type: "string",
          description: "Base directory for search (default: current working directory)",
        },
        ignore: {
          type: "array",
          items: { type: "string" },
          description: "Patterns to ignore (e.g., ['node_modules/**'])",
        },
        maxResults: {
          type: "number",
          description: "Maximum number of results to return",
        },
        includeStats: {
          type: "boolean",
          description: "Include file metadata in results",
        },
      },
      required: ["pattern"],
    },
  },
  {
    name: "get_file_info",
    description: "Get detailed information about a file or directory.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to get info for",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "watch_path",
    description: "Start watching a path for changes. Returns a watch ID to stop later.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to watch (file or directory)",
        },
        recursive: {
          type: "boolean",
          description: "Watch subdirectories recursively",
        },
        events: {
          type: "array",
          items: {
            type: "string",
            enum: ["add", "change", "unlink", "addDir", "unlinkDir"],
          },
          description: "Events to watch for",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "unwatch_path",
    description: "Stop watching a path.",
    inputSchema: {
      type: "object",
      properties: {
        watchId: {
          type: "string",
          description: "Watch ID returned from watch_path",
        },
      },
      required: ["watchId"],
    },
  },
];

// =============================================================================
// Tool Implementations
// =============================================================================

async function readFile(params: {
  path: string;
  encoding?: string;
  start?: number;
  end?: number;
}): Promise<any> {
  assertPathAllowed(params.path);

  const encoding = (params.encoding || "utf8") as BufferEncoding;
  const stats = await fs.stat(params.path);

  if (stats.size > config.maxFileSize) {
    throw new Error(`File too large: ${stats.size} bytes (max: ${config.maxFileSize})`);
  }

  let content: string;

  if (params.start !== undefined || params.end !== undefined) {
    const fileHandle = await fs.open(params.path, "r");
    try {
      const buffer = Buffer.alloc((params.end || stats.size) - (params.start || 0));
      await fileHandle.read(buffer, 0, buffer.length, params.start || 0);
      content = buffer.toString(encoding);
    } finally {
      await fileHandle.close();
    }
  } else {
    content = await fs.readFile(params.path, { encoding });
  }

  return {
    path: path.resolve(params.path),
    content,
    size: stats.size,
    mimeType: mimeTypes.lookup(params.path) || "application/octet-stream",
    encoding,
  };
}

async function writeFile(params: {
  path: string;
  content: string;
  encoding?: string;
  append?: boolean;
  createDirs?: boolean;
}): Promise<any> {
  assertPathAllowed(params.path);

  const encoding = (params.encoding || "utf8") as BufferEncoding;
  const createDirs = params.createDirs !== false;

  if (createDirs) {
    await fs.mkdir(path.dirname(params.path), { recursive: true });
  }

  if (params.append) {
    await fs.appendFile(params.path, params.content, { encoding });
  } else {
    await fs.writeFile(params.path, params.content, { encoding });
  }

  const stats = await fs.stat(params.path);

  return {
    path: path.resolve(params.path),
    size: stats.size,
    created: !params.append,
    appended: !!params.append,
  };
}

async function listDirectory(params: {
  path: string;
  recursive?: boolean;
  includeHidden?: boolean;
  filter?: string;
  includeStats?: boolean;
}): Promise<any> {
  assertPathAllowed(params.path);

  const entries = await fs.readdir(params.path, { withFileTypes: true });
  const results: any[] = [];

  for (const entry of entries) {
    if (!params.includeHidden && entry.name.startsWith(".")) {
      continue;
    }

    if (params.filter) {
      const matches = await glob(params.filter, {
        cwd: params.path,
        dot: params.includeHidden,
      });
      if (!matches.includes(entry.name)) {
        continue;
      }
    }

    const fullPath = path.join(params.path, entry.name);
    const item: any = {
      name: entry.name,
      path: fullPath,
      type: entry.isDirectory() ? "directory" : "file",
    };

    if (params.includeStats) {
      const stats = await fs.stat(fullPath);
      item.size = stats.size;
      item.modified = stats.mtime.toISOString();
      item.created = stats.birthtime.toISOString();
      if (!entry.isDirectory()) {
        item.mimeType = mimeTypes.lookup(entry.name) || "application/octet-stream";
      }
    }

    results.push(item);

    if (params.recursive && entry.isDirectory()) {
      const subItems = await listDirectory({
        path: fullPath,
        recursive: true,
        includeHidden: params.includeHidden,
        filter: params.filter,
        includeStats: params.includeStats,
      });
      results.push(...subItems.entries);
    }
  }

  return {
    path: path.resolve(params.path),
    entries: results,
    count: results.length,
  };
}

async function createDirectory(params: {
  path: string;
  recursive?: boolean;
}): Promise<any> {
  assertPathAllowed(params.path);

  const recursive = params.recursive !== false;
  await fs.mkdir(params.path, { recursive });

  return {
    path: path.resolve(params.path),
    created: true,
  };
}

async function deletePath(params: {
  path: string;
  recursive?: boolean;
  force?: boolean;
}): Promise<any> {
  assertPathAllowed(params.path);

  try {
    const stats = await fs.stat(params.path);

    if (stats.isDirectory()) {
      await fs.rm(params.path, { recursive: params.recursive, force: params.force });
    } else {
      await fs.unlink(params.path);
    }

    return {
      path: path.resolve(params.path),
      deleted: true,
      type: stats.isDirectory() ? "directory" : "file",
    };
  } catch (error: any) {
    if (params.force && error.code === "ENOENT") {
      return {
        path: path.resolve(params.path),
        deleted: false,
        reason: "Path did not exist",
      };
    }
    throw error;
  }
}

async function movePath(params: {
  source: string;
  destination: string;
  overwrite?: boolean;
}): Promise<any> {
  assertPathAllowed(params.source);
  assertPathAllowed(params.destination);

  if (!params.overwrite) {
    try {
      await fs.access(params.destination);
      throw new Error(`Destination already exists: ${params.destination}`);
    } catch (error: any) {
      if (error.code !== "ENOENT") throw error;
    }
  }

  await fs.rename(params.source, params.destination);

  return {
    source: path.resolve(params.source),
    destination: path.resolve(params.destination),
    moved: true,
  };
}

async function copyPath(params: {
  source: string;
  destination: string;
  recursive?: boolean;
  overwrite?: boolean;
}): Promise<any> {
  assertPathAllowed(params.source);
  assertPathAllowed(params.destination);

  const stats = await fs.stat(params.source);

  if (stats.isDirectory()) {
    await fs.cp(params.source, params.destination, {
      recursive: params.recursive,
      force: params.overwrite,
    });
  } else {
    if (!params.overwrite) {
      try {
        await fs.access(params.destination);
        throw new Error(`Destination already exists: ${params.destination}`);
      } catch (error: any) {
        if (error.code !== "ENOENT") throw error;
      }
    }
    await fs.copyFile(params.source, params.destination);
  }

  return {
    source: path.resolve(params.source),
    destination: path.resolve(params.destination),
    copied: true,
    type: stats.isDirectory() ? "directory" : "file",
  };
}

async function searchFiles(params: {
  pattern: string;
  cwd?: string;
  ignore?: string[];
  maxResults?: number;
  includeStats?: boolean;
}): Promise<any> {
  const cwd = params.cwd || process.cwd();
  assertPathAllowed(cwd);

  const matches = await glob(params.pattern, {
    cwd,
    ignore: params.ignore || ["node_modules/**"],
    absolute: true,
    nodir: false,
  });

  const limited = params.maxResults ? matches.slice(0, params.maxResults) : matches;

  const results: any[] = [];
  for (const match of limited) {
    const item: any = { path: match };

    if (params.includeStats) {
      try {
        const stats = await fs.stat(match);
        item.type = stats.isDirectory() ? "directory" : "file";
        item.size = stats.size;
        item.modified = stats.mtime.toISOString();
      } catch {
        item.error = "Could not read stats";
      }
    }

    results.push(item);
  }

  return {
    pattern: params.pattern,
    cwd,
    results,
    count: results.length,
    totalMatches: matches.length,
    truncated: params.maxResults ? matches.length > params.maxResults : false,
  };
}

async function getFileInfo(params: { path: string }): Promise<any> {
  assertPathAllowed(params.path);

  const stats = await fs.stat(params.path);
  const resolved = path.resolve(params.path);

  return {
    path: resolved,
    name: path.basename(resolved),
    directory: path.dirname(resolved),
    extension: path.extname(resolved),
    type: stats.isDirectory() ? "directory" : stats.isFile() ? "file" : "other",
    size: stats.size,
    sizeHuman: formatBytes(stats.size),
    mimeType: stats.isFile() ? (mimeTypes.lookup(resolved) || "application/octet-stream") : null,
    created: stats.birthtime.toISOString(),
    modified: stats.mtime.toISOString(),
    accessed: stats.atime.toISOString(),
    permissions: stats.mode.toString(8),
    isSymlink: stats.isSymbolicLink(),
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

async function watchPath(params: {
  path: string;
  recursive?: boolean;
  events?: string[];
}): Promise<any> {
  if (!config.enableWatch) {
    throw new Error("File watching is disabled. Set FS_ENABLE_WATCH=true to enable.");
  }

  assertPathAllowed(params.path);

  const watchId = `watch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const watcher = watch(params.path, {
    persistent: true,
    ignoreInitial: true,
    depth: params.recursive ? undefined : 0,
  });

  watchers.set(watchId, watcher);

  return {
    watchId,
    path: path.resolve(params.path),
    recursive: params.recursive || false,
    events: params.events || ["add", "change", "unlink"],
    status: "watching",
  };
}

async function unwatchPath(params: { watchId: string }): Promise<any> {
  const watcher = watchers.get(params.watchId);

  if (!watcher) {
    throw new Error(`Watch not found: ${params.watchId}`);
  }

  await watcher.close();
  watchers.delete(params.watchId);

  return {
    watchId: params.watchId,
    status: "stopped",
  };
}

// =============================================================================
// Server Setup
// =============================================================================

const server = new Server(
  {
    name: "filesystem-mcp",
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
      case "read_file":
        result = await readFile(args as any);
        break;
      case "write_file":
        result = await writeFile(args as any);
        break;
      case "list_directory":
        result = await listDirectory(args as any);
        break;
      case "create_directory":
        result = await createDirectory(args as any);
        break;
      case "delete_path":
        result = await deletePath(args as any);
        break;
      case "move_path":
        result = await movePath(args as any);
        break;
      case "copy_path":
        result = await copyPath(args as any);
        break;
      case "search_files":
        result = await searchFiles(args as any);
        break;
      case "get_file_info":
        result = await getFileInfo(args as any);
        break;
      case "watch_path":
        result = await watchPath(args as any);
        break;
      case "unwatch_path":
        result = await unwatchPath(args as any);
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
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: error.message,
            code: error.code,
          }),
        },
      ],
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
  console.error("Filesystem MCP Server running on stdio");
  console.error(`Allowed paths: ${config.allowedPaths.join(", ")}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
