/**
 * Redis MCP Server
 *
 * Provides Redis cache and data operations for KOSMOS agents.
 * Features:
 * - Key-value operations (get, set, delete)
 * - Hash, List, Set, Sorted Set operations
 * - Pub/Sub messaging
 * - Streams for event sourcing
 * - TTL and expiration management
 *
 * Authentication: Uses Redis connection URL.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import Redis from "ioredis";

// =============================================================================
// Configuration
// =============================================================================

const config = {
  url: process.env.REDIS_URL || "redis://localhost:6379",
  keyPrefix: process.env.REDIS_KEY_PREFIX || "kosmos:",
};

const redis = new Redis(config.url);

// =============================================================================
// Tool Definitions
// =============================================================================

const TOOLS: Tool[] = [
  // String operations
  {
    name: "get",
    description: "Get the value of a key.",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Key name" },
      },
      required: ["key"],
    },
  },
  {
    name: "set",
    description: "Set a key to a value with optional TTL.",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Key name" },
        value: { type: "string", description: "Value to set" },
        ttl: { type: "number", description: "Time-to-live in seconds" },
        nx: { type: "boolean", description: "Only set if key doesn't exist" },
        xx: { type: "boolean", description: "Only set if key exists" },
      },
      required: ["key", "value"],
    },
  },
  {
    name: "delete",
    description: "Delete one or more keys.",
    inputSchema: {
      type: "object",
      properties: {
        keys: {
          type: "array",
          items: { type: "string" },
          description: "Keys to delete",
        },
      },
      required: ["keys"],
    },
  },
  {
    name: "exists",
    description: "Check if keys exist.",
    inputSchema: {
      type: "object",
      properties: {
        keys: {
          type: "array",
          items: { type: "string" },
          description: "Keys to check",
        },
      },
      required: ["keys"],
    },
  },
  {
    name: "expire",
    description: "Set a key's TTL.",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Key name" },
        seconds: { type: "number", description: "TTL in seconds" },
      },
      required: ["key", "seconds"],
    },
  },
  {
    name: "ttl",
    description: "Get the remaining TTL of a key.",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Key name" },
      },
      required: ["key"],
    },
  },
  {
    name: "keys",
    description: "Find keys matching a pattern.",
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Pattern (e.g., 'user:*')" },
        count: { type: "number", description: "Max keys to return (uses SCAN)" },
      },
      required: ["pattern"],
    },
  },
  // Hash operations
  {
    name: "hget",
    description: "Get a hash field value.",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Hash key" },
        field: { type: "string", description: "Field name" },
      },
      required: ["key", "field"],
    },
  },
  {
    name: "hset",
    description: "Set hash field(s).",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Hash key" },
        fields: {
          type: "object",
          description: "Field-value pairs to set",
        },
      },
      required: ["key", "fields"],
    },
  },
  {
    name: "hgetall",
    description: "Get all fields and values of a hash.",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Hash key" },
      },
      required: ["key"],
    },
  },
  {
    name: "hdel",
    description: "Delete hash fields.",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Hash key" },
        fields: {
          type: "array",
          items: { type: "string" },
          description: "Fields to delete",
        },
      },
      required: ["key", "fields"],
    },
  },
  // List operations
  {
    name: "lpush",
    description: "Push values to the head of a list.",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "List key" },
        values: {
          type: "array",
          items: { type: "string" },
          description: "Values to push",
        },
      },
      required: ["key", "values"],
    },
  },
  {
    name: "rpush",
    description: "Push values to the tail of a list.",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "List key" },
        values: {
          type: "array",
          items: { type: "string" },
          description: "Values to push",
        },
      },
      required: ["key", "values"],
    },
  },
  {
    name: "lrange",
    description: "Get a range of list elements.",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "List key" },
        start: { type: "number", description: "Start index (0-based)" },
        stop: { type: "number", description: "Stop index (-1 for end)" },
      },
      required: ["key", "start", "stop"],
    },
  },
  {
    name: "lpop",
    description: "Remove and return element(s) from list head.",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "List key" },
        count: { type: "number", description: "Number of elements to pop" },
      },
      required: ["key"],
    },
  },
  // Set operations
  {
    name: "sadd",
    description: "Add members to a set.",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Set key" },
        members: {
          type: "array",
          items: { type: "string" },
          description: "Members to add",
        },
      },
      required: ["key", "members"],
    },
  },
  {
    name: "smembers",
    description: "Get all members of a set.",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Set key" },
      },
      required: ["key"],
    },
  },
  {
    name: "sismember",
    description: "Check if a value is a member of a set.",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Set key" },
        member: { type: "string", description: "Member to check" },
      },
      required: ["key", "member"],
    },
  },
  // Sorted Set operations
  {
    name: "zadd",
    description: "Add members with scores to a sorted set.",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Sorted set key" },
        members: {
          type: "array",
          items: {
            type: "object",
            properties: {
              score: { type: "number" },
              member: { type: "string" },
            },
          },
          description: "Score-member pairs",
        },
      },
      required: ["key", "members"],
    },
  },
  {
    name: "zrange",
    description: "Get members by rank range.",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Sorted set key" },
        start: { type: "number", description: "Start rank" },
        stop: { type: "number", description: "Stop rank" },
        withScores: { type: "boolean", description: "Include scores" },
      },
      required: ["key", "start", "stop"],
    },
  },
  {
    name: "zrangebyscore",
    description: "Get members by score range.",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Sorted set key" },
        min: { type: "string", description: "Min score (or '-inf')" },
        max: { type: "string", description: "Max score (or '+inf')" },
        withScores: { type: "boolean", description: "Include scores" },
        limit: { type: "number", description: "Max results" },
      },
      required: ["key", "min", "max"],
    },
  },
  // Pub/Sub
  {
    name: "publish",
    description: "Publish a message to a channel.",
    inputSchema: {
      type: "object",
      properties: {
        channel: { type: "string", description: "Channel name" },
        message: { type: "string", description: "Message to publish" },
      },
      required: ["channel", "message"],
    },
  },
  // JSON operations (using string serialization)
  {
    name: "json_set",
    description: "Set a JSON value (stored as string).",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Key name" },
        value: { type: "object", description: "JSON value" },
        ttl: { type: "number", description: "TTL in seconds" },
      },
      required: ["key", "value"],
    },
  },
  {
    name: "json_get",
    description: "Get and parse a JSON value.",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Key name" },
      },
      required: ["key"],
    },
  },
  // Utility
  {
    name: "info",
    description: "Get Redis server information.",
    inputSchema: {
      type: "object",
      properties: {
        section: {
          type: "string",
          enum: ["server", "clients", "memory", "stats", "replication", "cpu", "keyspace"],
          description: "Info section",
        },
      },
    },
  },
  {
    name: "dbsize",
    description: "Get the number of keys in the database.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

// =============================================================================
// Helper Functions
// =============================================================================

function prefixKey(key: string): string {
  return config.keyPrefix + key;
}

// =============================================================================
// Tool Implementations
// =============================================================================

async function get(params: { key: string }): Promise<any> {
  const value = await redis.get(prefixKey(params.key));
  return { key: params.key, value };
}

async function set(params: {
  key: string;
  value: string;
  ttl?: number;
  nx?: boolean;
  xx?: boolean;
}): Promise<any> {
  const args: any[] = [prefixKey(params.key), params.value];

  if (params.ttl) {
    args.push("EX", params.ttl);
  }
  if (params.nx) {
    args.push("NX");
  }
  if (params.xx) {
    args.push("XX");
  }

  const result = await (redis as any).set(...args);
  return { key: params.key, success: result === "OK" };
}

async function del(params: { keys: string[] }): Promise<any> {
  const prefixedKeys = params.keys.map(prefixKey);
  const count = await redis.del(...prefixedKeys);
  return { deleted: count };
}

async function exists(params: { keys: string[] }): Promise<any> {
  const prefixedKeys = params.keys.map(prefixKey);
  const count = await redis.exists(...prefixedKeys);
  return { existing: count, total: params.keys.length };
}

async function expire(params: { key: string; seconds: number }): Promise<any> {
  const result = await redis.expire(prefixKey(params.key), params.seconds);
  return { key: params.key, success: result === 1 };
}

async function ttl(params: { key: string }): Promise<any> {
  const remaining = await redis.ttl(prefixKey(params.key));
  return { key: params.key, ttl: remaining };
}

async function keys(params: { pattern: string; count?: number }): Promise<any> {
  const pattern = prefixKey(params.pattern);
  const maxCount = params.count || 100;

  const foundKeys: string[] = [];
  let cursor = "0";

  do {
    const [newCursor, batch] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
    cursor = newCursor;
    foundKeys.push(...batch);
  } while (cursor !== "0" && foundKeys.length < maxCount);

  // Remove prefix from keys
  const unprefixedKeys = foundKeys.slice(0, maxCount).map((k) =>
    k.startsWith(config.keyPrefix) ? k.slice(config.keyPrefix.length) : k
  );

  return { keys: unprefixedKeys, count: unprefixedKeys.length };
}

async function hget(params: { key: string; field: string }): Promise<any> {
  const value = await redis.hget(prefixKey(params.key), params.field);
  return { key: params.key, field: params.field, value };
}

async function hset(params: { key: string; fields: Record<string, string> }): Promise<any> {
  const entries = Object.entries(params.fields).flat();
  const result = await redis.hset(prefixKey(params.key), ...entries);
  return { key: params.key, fieldsSet: result };
}

async function hgetall(params: { key: string }): Promise<any> {
  const data = await redis.hgetall(prefixKey(params.key));
  return { key: params.key, data };
}

async function hdel(params: { key: string; fields: string[] }): Promise<any> {
  const result = await redis.hdel(prefixKey(params.key), ...params.fields);
  return { key: params.key, deleted: result };
}

async function lpush(params: { key: string; values: string[] }): Promise<any> {
  const result = await redis.lpush(prefixKey(params.key), ...params.values);
  return { key: params.key, length: result };
}

async function rpush(params: { key: string; values: string[] }): Promise<any> {
  const result = await redis.rpush(prefixKey(params.key), ...params.values);
  return { key: params.key, length: result };
}

async function lrange(params: { key: string; start: number; stop: number }): Promise<any> {
  const values = await redis.lrange(prefixKey(params.key), params.start, params.stop);
  return { key: params.key, values };
}

async function lpop(params: { key: string; count?: number }): Promise<any> {
  let values;
  if (params.count && params.count > 1) {
    values = await redis.lpop(prefixKey(params.key), params.count);
  } else {
    const value = await redis.lpop(prefixKey(params.key));
    values = value ? [value] : [];
  }
  return { key: params.key, values };
}

async function sadd(params: { key: string; members: string[] }): Promise<any> {
  const result = await redis.sadd(prefixKey(params.key), ...params.members);
  return { key: params.key, added: result };
}

async function smembers(params: { key: string }): Promise<any> {
  const members = await redis.smembers(prefixKey(params.key));
  return { key: params.key, members };
}

async function sismember(params: { key: string; member: string }): Promise<any> {
  const result = await redis.sismember(prefixKey(params.key), params.member);
  return { key: params.key, member: params.member, isMember: result === 1 };
}

async function zadd(params: { key: string; members: { score: number; member: string }[] }): Promise<any> {
  const args: (number | string)[] = [];
  for (const m of params.members) {
    args.push(m.score, m.member);
  }
  const result = await redis.zadd(prefixKey(params.key), ...args);
  return { key: params.key, added: result };
}

async function zrange(params: {
  key: string;
  start: number;
  stop: number;
  withScores?: boolean;
}): Promise<any> {
  let result;
  if (params.withScores) {
    result = await redis.zrange(prefixKey(params.key), params.start, params.stop, "WITHSCORES");
    // Convert to pairs
    const pairs: { member: string; score: number }[] = [];
    for (let i = 0; i < result.length; i += 2) {
      pairs.push({ member: result[i], score: parseFloat(result[i + 1]) });
    }
    return { key: params.key, members: pairs };
  } else {
    result = await redis.zrange(prefixKey(params.key), params.start, params.stop);
    return { key: params.key, members: result };
  }
}

async function zrangebyscore(params: {
  key: string;
  min: string;
  max: string;
  withScores?: boolean;
  limit?: number;
}): Promise<any> {
  const args: any[] = [prefixKey(params.key), params.min, params.max];

  if (params.withScores) {
    args.push("WITHSCORES");
  }
  if (params.limit) {
    args.push("LIMIT", 0, params.limit);
  }

  const result = await (redis as any).zrangebyscore(...args);

  if (params.withScores) {
    const pairs: { member: string; score: number }[] = [];
    for (let i = 0; i < result.length; i += 2) {
      pairs.push({ member: result[i], score: parseFloat(result[i + 1]) });
    }
    return { key: params.key, members: pairs };
  }

  return { key: params.key, members: result };
}

async function publish(params: { channel: string; message: string }): Promise<any> {
  const subscribers = await redis.publish(params.channel, params.message);
  return { channel: params.channel, subscribers };
}

async function jsonSet(params: { key: string; value: any; ttl?: number }): Promise<any> {
  const serialized = JSON.stringify(params.value);
  if (params.ttl) {
    await redis.setex(prefixKey(params.key), params.ttl, serialized);
  } else {
    await redis.set(prefixKey(params.key), serialized);
  }
  return { key: params.key, success: true };
}

async function jsonGet(params: { key: string }): Promise<any> {
  const value = await redis.get(prefixKey(params.key));
  if (value === null) {
    return { key: params.key, value: null };
  }
  try {
    return { key: params.key, value: JSON.parse(value) };
  } catch {
    return { key: params.key, value, error: "Not valid JSON" };
  }
}

async function info(params: { section?: string }): Promise<any> {
  const result = await redis.info(params.section);
  // Parse info string into object
  const info: Record<string, string> = {};
  for (const line of result.split("\n")) {
    if (line && !line.startsWith("#")) {
      const [key, value] = line.split(":");
      if (key && value) {
        info[key.trim()] = value.trim();
      }
    }
  }
  return { section: params.section || "all", info };
}

async function dbsize(): Promise<any> {
  const size = await redis.dbsize();
  return { keys: size };
}

// =============================================================================
// Server Setup
// =============================================================================

const server = new Server(
  {
    name: "redis-mcp",
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
      case "get": result = await get(args as any); break;
      case "set": result = await set(args as any); break;
      case "delete": result = await del(args as any); break;
      case "exists": result = await exists(args as any); break;
      case "expire": result = await expire(args as any); break;
      case "ttl": result = await ttl(args as any); break;
      case "keys": result = await keys(args as any); break;
      case "hget": result = await hget(args as any); break;
      case "hset": result = await hset(args as any); break;
      case "hgetall": result = await hgetall(args as any); break;
      case "hdel": result = await hdel(args as any); break;
      case "lpush": result = await lpush(args as any); break;
      case "rpush": result = await rpush(args as any); break;
      case "lrange": result = await lrange(args as any); break;
      case "lpop": result = await lpop(args as any); break;
      case "sadd": result = await sadd(args as any); break;
      case "smembers": result = await smembers(args as any); break;
      case "sismember": result = await sismember(args as any); break;
      case "zadd": result = await zadd(args as any); break;
      case "zrange": result = await zrange(args as any); break;
      case "zrangebyscore": result = await zrangebyscore(args as any); break;
      case "publish": result = await publish(args as any); break;
      case "json_set": result = await jsonSet(args as any); break;
      case "json_get": result = await jsonGet(args as any); break;
      case "info": result = await info(args as any); break;
      case "dbsize": result = await dbsize(); break;
      default: throw new Error(`Unknown tool: ${name}`);
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
  console.error("Redis MCP Server running on stdio");
  console.error(`Connected to: ${config.url}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
