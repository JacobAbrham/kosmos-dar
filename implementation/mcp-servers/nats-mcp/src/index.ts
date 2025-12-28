/**
 * NATS MCP Server
 *
 * Provides high-performance messaging capabilities for KOSMOS agents.
 * Features:
 * - Core NATS pub/sub messaging
 * - Request/Reply pattern
 * - JetStream for persistence
 * - Key-Value store operations
 * - Stream and consumer management
 *
 * Authentication: Uses NATS connection URL with optional credentials.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import {
  connect,
  NatsConnection,
  JetStreamManager,
  JetStreamClient,
  StringCodec,
  AckPolicy,
  DeliverPolicy,
  ReplayPolicy,
  RetentionPolicy,
  StorageType,
  DiscardPolicy,
} from "nats";

// =============================================================================
// Configuration
// =============================================================================

const config = {
  url: process.env.NATS_URL || "nats://localhost:4222",
  user: process.env.NATS_USER,
  password: process.env.NATS_PASSWORD,
  token: process.env.NATS_TOKEN,
};

let nc: NatsConnection;
let jsm: JetStreamManager;
let js: JetStreamClient;
const sc = StringCodec();

// =============================================================================
// Tool Definitions
// =============================================================================

const TOOLS: Tool[] = [
  // Core NATS messaging
  {
    name: "publish",
    description: "Publish a message to a NATS subject.",
    inputSchema: {
      type: "object",
      properties: {
        subject: { type: "string", description: "Subject to publish to" },
        data: { type: "string", description: "Message data" },
        headers: {
          type: "object",
          description: "Optional headers as key-value pairs",
        },
      },
      required: ["subject", "data"],
    },
  },
  {
    name: "request",
    description: "Send a request and wait for a reply (request/reply pattern).",
    inputSchema: {
      type: "object",
      properties: {
        subject: { type: "string", description: "Subject to send request to" },
        data: { type: "string", description: "Request data" },
        timeout: {
          type: "number",
          description: "Timeout in milliseconds (default 5000)",
        },
        headers: {
          type: "object",
          description: "Optional headers as key-value pairs",
        },
      },
      required: ["subject", "data"],
    },
  },
  {
    name: "subscribe_once",
    description: "Subscribe to a subject and receive one message.",
    inputSchema: {
      type: "object",
      properties: {
        subject: { type: "string", description: "Subject to subscribe to" },
        timeout: {
          type: "number",
          description: "Timeout in milliseconds (default 5000)",
        },
      },
      required: ["subject"],
    },
  },
  // JetStream Stream Management
  {
    name: "list_streams",
    description: "List all JetStream streams.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "create_stream",
    description: "Create a new JetStream stream.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Stream name" },
        subjects: {
          type: "array",
          items: { type: "string" },
          description: "Subjects to bind to stream",
        },
        retention: {
          type: "string",
          enum: ["limits", "interest", "workqueue"],
          description: "Retention policy (default: limits)",
        },
        storage: {
          type: "string",
          enum: ["file", "memory"],
          description: "Storage type (default: file)",
        },
        max_msgs: {
          type: "number",
          description: "Maximum number of messages",
        },
        max_bytes: {
          type: "number",
          description: "Maximum bytes for stream",
        },
        max_age: {
          type: "number",
          description: "Maximum age in nanoseconds",
        },
        max_msg_size: {
          type: "number",
          description: "Maximum message size in bytes",
        },
        discard: {
          type: "string",
          enum: ["old", "new"],
          description: "Discard policy when limits reached",
        },
        replicas: {
          type: "number",
          description: "Number of replicas (default: 1)",
        },
        duplicate_window: {
          type: "number",
          description: "Duplicate detection window in nanoseconds",
        },
      },
      required: ["name", "subjects"],
    },
  },
  {
    name: "delete_stream",
    description: "Delete a JetStream stream.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Stream name" },
      },
      required: ["name"],
    },
  },
  {
    name: "get_stream_info",
    description: "Get detailed information about a stream.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Stream name" },
      },
      required: ["name"],
    },
  },
  // JetStream Consumer Management
  {
    name: "list_consumers",
    description: "List all consumers for a stream.",
    inputSchema: {
      type: "object",
      properties: {
        stream: { type: "string", description: "Stream name" },
      },
      required: ["stream"],
    },
  },
  {
    name: "create_consumer",
    description: "Create a new consumer for a stream.",
    inputSchema: {
      type: "object",
      properties: {
        stream: { type: "string", description: "Stream name" },
        name: { type: "string", description: "Consumer name (durable)" },
        filter_subject: {
          type: "string",
          description: "Filter subject (optional)",
        },
        ack_policy: {
          type: "string",
          enum: ["none", "all", "explicit"],
          description: "Ack policy (default: explicit)",
        },
        deliver_policy: {
          type: "string",
          enum: ["all", "last", "new", "by_start_sequence", "by_start_time", "last_per_subject"],
          description: "Deliver policy (default: all)",
        },
        replay_policy: {
          type: "string",
          enum: ["instant", "original"],
          description: "Replay policy (default: instant)",
        },
        max_deliver: {
          type: "number",
          description: "Maximum delivery attempts",
        },
        ack_wait: {
          type: "number",
          description: "Ack wait timeout in nanoseconds",
        },
        max_ack_pending: {
          type: "number",
          description: "Maximum pending acks",
        },
      },
      required: ["stream", "name"],
    },
  },
  {
    name: "delete_consumer",
    description: "Delete a consumer from a stream.",
    inputSchema: {
      type: "object",
      properties: {
        stream: { type: "string", description: "Stream name" },
        name: { type: "string", description: "Consumer name" },
      },
      required: ["stream", "name"],
    },
  },
  // JetStream Message Operations
  {
    name: "get_message",
    description: "Get a specific message from a stream by sequence number.",
    inputSchema: {
      type: "object",
      properties: {
        stream: { type: "string", description: "Stream name" },
        seq: { type: "number", description: "Message sequence number" },
      },
      required: ["stream", "seq"],
    },
  },
  {
    name: "publish_to_stream",
    description: "Publish a message to JetStream with acknowledgment.",
    inputSchema: {
      type: "object",
      properties: {
        subject: { type: "string", description: "Subject to publish to" },
        data: { type: "string", description: "Message data" },
        msg_id: {
          type: "string",
          description: "Message ID for deduplication",
        },
        headers: {
          type: "object",
          description: "Optional headers as key-value pairs",
        },
      },
      required: ["subject", "data"],
    },
  },
  {
    name: "ack_message",
    description: "Acknowledge a message (used after consuming from JetStream).",
    inputSchema: {
      type: "object",
      properties: {
        stream: { type: "string", description: "Stream name" },
        consumer: { type: "string", description: "Consumer name" },
        seq: { type: "number", description: "Stream sequence number to ack" },
      },
      required: ["stream", "consumer", "seq"],
    },
  },
  // Key-Value Store Operations
  {
    name: "list_kv_buckets",
    description: "List all Key-Value buckets.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_kv_value",
    description: "Get a value from a Key-Value bucket.",
    inputSchema: {
      type: "object",
      properties: {
        bucket: { type: "string", description: "Bucket name" },
        key: { type: "string", description: "Key name" },
      },
      required: ["bucket", "key"],
    },
  },
  {
    name: "put_kv_value",
    description: "Put a value into a Key-Value bucket.",
    inputSchema: {
      type: "object",
      properties: {
        bucket: { type: "string", description: "Bucket name" },
        key: { type: "string", description: "Key name" },
        value: { type: "string", description: "Value to store" },
      },
      required: ["bucket", "key", "value"],
    },
  },
  {
    name: "delete_kv_value",
    description: "Delete a value from a Key-Value bucket.",
    inputSchema: {
      type: "object",
      properties: {
        bucket: { type: "string", description: "Bucket name" },
        key: { type: "string", description: "Key name" },
      },
      required: ["bucket", "key"],
    },
  },
  // Server Information
  {
    name: "get_server_info",
    description: "Get NATS server information.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_stats",
    description: "Get NATS server statistics.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

// =============================================================================
// Helper Functions
// =============================================================================

function parseHeaders(headers?: Record<string, string>): any {
  if (!headers) return undefined;
  const { headers: NatsHeaders } = require("nats");
  const h = NatsHeaders();
  for (const [key, value] of Object.entries(headers)) {
    h.set(key, value);
  }
  return h;
}

function headersToObject(headers: any): Record<string, string> | undefined {
  if (!headers) return undefined;
  const result: Record<string, string> = {};
  for (const key of headers.keys()) {
    result[key] = headers.get(key);
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function getRetentionPolicy(policy?: string): RetentionPolicy {
  switch (policy) {
    case "interest":
      return RetentionPolicy.Interest;
    case "workqueue":
      return RetentionPolicy.Workqueue;
    default:
      return RetentionPolicy.Limits;
  }
}

function getStorageType(storage?: string): StorageType {
  switch (storage) {
    case "memory":
      return StorageType.Memory;
    default:
      return StorageType.File;
  }
}

function getDiscardPolicy(discard?: string): DiscardPolicy {
  switch (discard) {
    case "new":
      return DiscardPolicy.New;
    default:
      return DiscardPolicy.Old;
  }
}

function getAckPolicy(policy?: string): AckPolicy {
  switch (policy) {
    case "none":
      return AckPolicy.None;
    case "all":
      return AckPolicy.All;
    default:
      return AckPolicy.Explicit;
  }
}

function getDeliverPolicy(policy?: string): DeliverPolicy {
  switch (policy) {
    case "last":
      return DeliverPolicy.Last;
    case "new":
      return DeliverPolicy.New;
    case "by_start_sequence":
      return DeliverPolicy.StartSequence;
    case "by_start_time":
      return DeliverPolicy.StartTime;
    case "last_per_subject":
      return DeliverPolicy.LastPerSubject;
    default:
      return DeliverPolicy.All;
  }
}

function getReplayPolicy(policy?: string): ReplayPolicy {
  switch (policy) {
    case "original":
      return ReplayPolicy.Original;
    default:
      return ReplayPolicy.Instant;
  }
}

// =============================================================================
// Tool Implementations
// =============================================================================

// Core NATS messaging

async function publish(params: {
  subject: string;
  data: string;
  headers?: Record<string, string>;
}): Promise<any> {
  nc.publish(params.subject, sc.encode(params.data), {
    headers: parseHeaders(params.headers),
  });
  return { success: true, subject: params.subject };
}

async function request(params: {
  subject: string;
  data: string;
  timeout?: number;
  headers?: Record<string, string>;
}): Promise<any> {
  const timeout = params.timeout || 5000;
  const msg = await nc.request(params.subject, sc.encode(params.data), {
    timeout,
    headers: parseHeaders(params.headers),
  });
  return {
    subject: msg.subject,
    data: sc.decode(msg.data),
    headers: headersToObject(msg.headers),
  };
}

async function subscribeOnce(params: {
  subject: string;
  timeout?: number;
}): Promise<any> {
  const timeout = params.timeout || 5000;
  const sub = nc.subscribe(params.subject, { max: 1 });

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      sub.unsubscribe();
      reject(new Error(`Timeout waiting for message on ${params.subject}`));
    }, timeout);

    (async () => {
      for await (const msg of sub) {
        clearTimeout(timer);
        resolve({
          subject: msg.subject,
          data: sc.decode(msg.data),
          headers: headersToObject(msg.headers),
        });
        break;
      }
    })();
  });
}

// JetStream Stream Management

async function listStreams(): Promise<any> {
  const streams: any[] = [];
  const lister = jsm.streams.list();
  for await (const si of lister) {
    streams.push({
      name: si.config.name,
      subjects: si.config.subjects,
      messages: si.state.messages,
      bytes: si.state.bytes,
      first_seq: si.state.first_seq,
      last_seq: si.state.last_seq,
      consumer_count: si.state.consumer_count,
    });
  }
  return { streams, count: streams.length };
}

async function createStream(params: {
  name: string;
  subjects: string[];
  retention?: string;
  storage?: string;
  max_msgs?: number;
  max_bytes?: number;
  max_age?: number;
  max_msg_size?: number;
  discard?: string;
  replicas?: number;
  duplicate_window?: number;
}): Promise<any> {
  const stream = await jsm.streams.add({
    name: params.name,
    subjects: params.subjects,
    retention: getRetentionPolicy(params.retention),
    storage: getStorageType(params.storage),
    max_msgs: params.max_msgs ?? -1,
    max_bytes: params.max_bytes ?? -1,
    max_age: params.max_age ?? 0,
    max_msg_size: params.max_msg_size ?? -1,
    discard: getDiscardPolicy(params.discard),
    num_replicas: params.replicas ?? 1,
    duplicate_window: params.duplicate_window ?? 0,
  });
  return {
    success: true,
    name: stream.config.name,
    subjects: stream.config.subjects,
    storage: stream.config.storage,
    retention: stream.config.retention,
    replicas: stream.config.num_replicas,
  };
}

async function deleteStream(params: { name: string }): Promise<any> {
  const deleted = await jsm.streams.delete(params.name);
  return { success: deleted, name: params.name };
}

async function getStreamInfo(params: { name: string }): Promise<any> {
  const info = await jsm.streams.info(params.name);
  return {
    name: info.config.name,
    subjects: info.config.subjects,
    retention: info.config.retention,
    storage: info.config.storage,
    max_msgs: info.config.max_msgs,
    max_bytes: info.config.max_bytes,
    max_age: info.config.max_age,
    max_msg_size: info.config.max_msg_size,
    discard: info.config.discard,
    replicas: info.config.num_replicas,
    state: {
      messages: info.state.messages,
      bytes: info.state.bytes,
      first_seq: info.state.first_seq,
      first_ts: info.state.first_ts,
      last_seq: info.state.last_seq,
      last_ts: info.state.last_ts,
      consumer_count: info.state.consumer_count,
    },
  };
}

// JetStream Consumer Management

async function listConsumers(params: { stream: string }): Promise<any> {
  const consumers: any[] = [];
  const lister = jsm.consumers.list(params.stream);
  for await (const ci of lister) {
    consumers.push({
      name: ci.name,
      stream: ci.stream_name,
      created: ci.created,
      ack_policy: ci.config.ack_policy,
      deliver_policy: ci.config.deliver_policy,
      num_pending: ci.num_pending,
      num_ack_pending: ci.num_ack_pending,
      num_redelivered: ci.num_redelivered,
    });
  }
  return { stream: params.stream, consumers, count: consumers.length };
}

async function createConsumer(params: {
  stream: string;
  name: string;
  filter_subject?: string;
  ack_policy?: string;
  deliver_policy?: string;
  replay_policy?: string;
  max_deliver?: number;
  ack_wait?: number;
  max_ack_pending?: number;
}): Promise<any> {
  const consumer = await jsm.consumers.add(params.stream, {
    durable_name: params.name,
    filter_subject: params.filter_subject,
    ack_policy: getAckPolicy(params.ack_policy),
    deliver_policy: getDeliverPolicy(params.deliver_policy),
    replay_policy: getReplayPolicy(params.replay_policy),
    max_deliver: params.max_deliver,
    ack_wait: params.ack_wait,
    max_ack_pending: params.max_ack_pending,
  });
  return {
    success: true,
    name: consumer.name,
    stream: consumer.stream_name,
    ack_policy: consumer.config.ack_policy,
    deliver_policy: consumer.config.deliver_policy,
  };
}

async function deleteConsumer(params: {
  stream: string;
  name: string;
}): Promise<any> {
  const deleted = await jsm.consumers.delete(params.stream, params.name);
  return { success: deleted, stream: params.stream, name: params.name };
}

// JetStream Message Operations

async function getMessage(params: {
  stream: string;
  seq: number;
}): Promise<any> {
  const msg = await jsm.streams.getMessage(params.stream, { seq: params.seq });
  return {
    stream: params.stream,
    seq: msg.seq,
    subject: msg.subject,
    data: sc.decode(msg.data),
    time: msg.time,
    headers: headersToObject(msg.header),
  };
}

async function publishToStream(params: {
  subject: string;
  data: string;
  msg_id?: string;
  headers?: Record<string, string>;
}): Promise<any> {
  const pubAck = await js.publish(params.subject, sc.encode(params.data), {
    msgID: params.msg_id,
    headers: parseHeaders(params.headers),
  });
  return {
    success: true,
    stream: pubAck.stream,
    seq: pubAck.seq,
    duplicate: pubAck.duplicate,
  };
}

async function ackMessage(params: {
  stream: string;
  consumer: string;
  seq: number;
}): Promise<any> {
  // Get the consumer and fetch the message to ack
  const consumer = await js.consumers.get(params.stream, params.consumer);
  const messages = await consumer.fetch({ max_messages: 1 });

  for await (const m of messages) {
    if (m.seq === params.seq) {
      m.ack();
      return { success: true, stream: params.stream, consumer: params.consumer, seq: params.seq };
    }
  }

  return { success: false, error: "Message not found or already acknowledged" };
}

// Key-Value Store Operations

async function listKvBuckets(): Promise<any> {
  const buckets: any[] = [];
  const lister = jsm.streams.list();
  for await (const si of lister) {
    // KV buckets are stored as streams with name prefix KV_
    if (si.config.name.startsWith("KV_")) {
      buckets.push({
        name: si.config.name.replace("KV_", ""),
        storage: si.config.storage,
        replicas: si.config.num_replicas,
        entries: si.state.messages,
        bytes: si.state.bytes,
      });
    }
  }
  return { buckets, count: buckets.length };
}

async function getKvValue(params: {
  bucket: string;
  key: string;
}): Promise<any> {
  const kv = await js.views.kv(params.bucket);
  const entry = await kv.get(params.key);
  if (!entry) {
    return { bucket: params.bucket, key: params.key, value: null, found: false };
  }
  return {
    bucket: params.bucket,
    key: params.key,
    value: sc.decode(entry.value),
    revision: entry.revision,
    created: entry.created,
    found: true,
  };
}

async function putKvValue(params: {
  bucket: string;
  key: string;
  value: string;
}): Promise<any> {
  const kv = await js.views.kv(params.bucket);
  const revision = await kv.put(params.key, sc.encode(params.value));
  return {
    bucket: params.bucket,
    key: params.key,
    revision,
    success: true,
  };
}

async function deleteKvValue(params: {
  bucket: string;
  key: string;
}): Promise<any> {
  const kv = await js.views.kv(params.bucket);
  await kv.delete(params.key);
  return {
    bucket: params.bucket,
    key: params.key,
    success: true,
  };
}

// Server Information

async function getServerInfo(): Promise<any> {
  const info = nc.info;
  return {
    server_id: info?.server_id,
    server_name: info?.server_name,
    version: info?.version,
    proto: info?.proto,
    go: info?.go,
    host: info?.host,
    port: info?.port,
    headers: info?.headers,
    max_payload: info?.max_payload,
    jetstream: info?.jetstream,
    client_id: info?.client_id,
    client_ip: info?.client_ip,
    cluster: info?.cluster,
    connect_urls: info?.connect_urls,
    ldm: info?.ldm,
  };
}

async function getStats(): Promise<any> {
  const stats = nc.stats();
  return {
    inBytes: stats.inBytes,
    outBytes: stats.outBytes,
    inMsgs: stats.inMsgs,
    outMsgs: stats.outMsgs,
  };
}

// =============================================================================
// Server Setup
// =============================================================================

const server = new Server(
  {
    name: "nats-mcp",
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
      // Core NATS messaging
      case "publish":
        result = await publish(args as any);
        break;
      case "request":
        result = await request(args as any);
        break;
      case "subscribe_once":
        result = await subscribeOnce(args as any);
        break;
      // JetStream Stream Management
      case "list_streams":
        result = await listStreams();
        break;
      case "create_stream":
        result = await createStream(args as any);
        break;
      case "delete_stream":
        result = await deleteStream(args as any);
        break;
      case "get_stream_info":
        result = await getStreamInfo(args as any);
        break;
      // JetStream Consumer Management
      case "list_consumers":
        result = await listConsumers(args as any);
        break;
      case "create_consumer":
        result = await createConsumer(args as any);
        break;
      case "delete_consumer":
        result = await deleteConsumer(args as any);
        break;
      // JetStream Message Operations
      case "get_message":
        result = await getMessage(args as any);
        break;
      case "publish_to_stream":
        result = await publishToStream(args as any);
        break;
      case "ack_message":
        result = await ackMessage(args as any);
        break;
      // Key-Value Store Operations
      case "list_kv_buckets":
        result = await listKvBuckets();
        break;
      case "get_kv_value":
        result = await getKvValue(args as any);
        break;
      case "put_kv_value":
        result = await putKvValue(args as any);
        break;
      case "delete_kv_value":
        result = await deleteKvValue(args as any);
        break;
      // Server Information
      case "get_server_info":
        result = await getServerInfo();
        break;
      case "get_stats":
        result = await getStats();
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
  // Build connection options
  const connectOpts: any = {
    servers: config.url,
  };

  if (config.user && config.password) {
    connectOpts.user = config.user;
    connectOpts.pass = config.password;
  } else if (config.token) {
    connectOpts.token = config.token;
  }

  // Connect to NATS
  nc = await connect(connectOpts);
  console.error(`Connected to NATS at ${config.url}`);

  // Initialize JetStream
  jsm = await nc.jetstreamManager();
  js = nc.jetstream();
  console.error("JetStream initialized");

  // Start MCP server
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("NATS MCP Server running on stdio");

  // Handle graceful shutdown
  nc.closed().then(() => {
    console.error("NATS connection closed");
    process.exit(0);
  });
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
