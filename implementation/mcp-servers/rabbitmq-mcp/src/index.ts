/**
 * RabbitMQ MCP Server
 *
 * Provides RabbitMQ message queue management for KOSMOS agents.
 * Features:
 * - Queue management (create, delete, purge, list)
 * - Exchange management (create, delete, list)
 * - Binding management (create, delete, list)
 * - Message publishing and consumption
 * - Virtual host management
 * - User management
 * - Cluster overview and health checks
 *
 * Uses RabbitMQ Management HTTP API.
 * Authentication: Uses RABBITMQ_URL, RABBITMQ_USER, RABBITMQ_PASSWORD.
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
  url: process.env.RABBITMQ_URL || "http://localhost:15672",
  user: process.env.RABBITMQ_USER || "guest",
  password: process.env.RABBITMQ_PASSWORD || "guest",
  defaultVhost: process.env.RABBITMQ_VHOST || "/",
};

// =============================================================================
// HTTP Client Helper
// =============================================================================

async function apiRequest(
  method: string,
  path: string,
  body?: any
): Promise<any> {
  const url = `${config.url}/api${path}`;
  const auth = Buffer.from(`${config.user}:${config.password}`).toString("base64");

  const headers: Record<string, string> = {
    Authorization: `Basic ${auth}`,
    "Content-Type": "application/json",
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`RabbitMQ API error (${response.status}): ${errorText}`);
  }

  // Some endpoints return empty responses
  const text = await response.text();
  if (!text) {
    return { success: true };
  }

  try {
    return JSON.parse(text);
  } catch {
    return { success: true, message: text };
  }
}

function encodeVhost(vhost: string): string {
  return encodeURIComponent(vhost);
}

// =============================================================================
// Tool Definitions
// =============================================================================

const TOOLS: Tool[] = [
  // Message Operations
  {
    name: "publish",
    description: "Publish a message to an exchange.",
    inputSchema: {
      type: "object",
      properties: {
        vhost: { type: "string", description: "Virtual host (default: /)" },
        exchange: { type: "string", description: "Exchange name (empty string for default exchange)" },
        routing_key: { type: "string", description: "Routing key" },
        payload: { type: "string", description: "Message payload" },
        payload_encoding: {
          type: "string",
          enum: ["string", "base64"],
          description: "Payload encoding (default: string)",
        },
        properties: {
          type: "object",
          description: "Message properties (content_type, content_encoding, headers, delivery_mode, priority, correlation_id, reply_to, expiration, message_id, timestamp, type, user_id, app_id)",
        },
      },
      required: ["exchange", "routing_key", "payload"],
    },
  },
  {
    name: "get_messages",
    description: "Get messages from a queue (does not remove them by default).",
    inputSchema: {
      type: "object",
      properties: {
        vhost: { type: "string", description: "Virtual host (default: /)" },
        queue: { type: "string", description: "Queue name" },
        count: { type: "number", description: "Number of messages to get (default: 1, max: 100)" },
        ack_mode: {
          type: "string",
          enum: ["ack_requeue_true", "ack_requeue_false", "reject_requeue_true", "reject_requeue_false"],
          description: "Acknowledgement mode (default: ack_requeue_true - leaves messages in queue)",
        },
        encoding: {
          type: "string",
          enum: ["auto", "base64"],
          description: "Response encoding (default: auto)",
        },
        truncate: { type: "number", description: "Truncate payload to this many bytes" },
      },
      required: ["queue"],
    },
  },
  // Queue Operations
  {
    name: "list_queues",
    description: "List all queues in a virtual host.",
    inputSchema: {
      type: "object",
      properties: {
        vhost: { type: "string", description: "Virtual host (default: /)" },
        name: { type: "string", description: "Filter by queue name (regex)" },
        page: { type: "number", description: "Page number" },
        page_size: { type: "number", description: "Items per page" },
      },
    },
  },
  {
    name: "get_queue",
    description: "Get detailed information about a specific queue.",
    inputSchema: {
      type: "object",
      properties: {
        vhost: { type: "string", description: "Virtual host (default: /)" },
        name: { type: "string", description: "Queue name" },
      },
      required: ["name"],
    },
  },
  {
    name: "create_queue",
    description: "Declare a new queue.",
    inputSchema: {
      type: "object",
      properties: {
        vhost: { type: "string", description: "Virtual host (default: /)" },
        name: { type: "string", description: "Queue name" },
        durable: { type: "boolean", description: "Survive broker restart (default: true)" },
        auto_delete: { type: "boolean", description: "Delete when last consumer disconnects (default: false)" },
        arguments: {
          type: "object",
          description: "Queue arguments (x-message-ttl, x-expires, x-max-length, x-max-length-bytes, x-dead-letter-exchange, x-dead-letter-routing-key, x-max-priority, x-queue-type)",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "delete_queue",
    description: "Delete a queue.",
    inputSchema: {
      type: "object",
      properties: {
        vhost: { type: "string", description: "Virtual host (default: /)" },
        name: { type: "string", description: "Queue name" },
        if_unused: { type: "boolean", description: "Only delete if unused" },
        if_empty: { type: "boolean", description: "Only delete if empty" },
      },
      required: ["name"],
    },
  },
  {
    name: "purge_queue",
    description: "Purge all messages from a queue.",
    inputSchema: {
      type: "object",
      properties: {
        vhost: { type: "string", description: "Virtual host (default: /)" },
        name: { type: "string", description: "Queue name" },
      },
      required: ["name"],
    },
  },
  // Exchange Operations
  {
    name: "list_exchanges",
    description: "List all exchanges in a virtual host.",
    inputSchema: {
      type: "object",
      properties: {
        vhost: { type: "string", description: "Virtual host (default: /)" },
        name: { type: "string", description: "Filter by exchange name (regex)" },
        page: { type: "number", description: "Page number" },
        page_size: { type: "number", description: "Items per page" },
      },
    },
  },
  {
    name: "get_exchange",
    description: "Get detailed information about a specific exchange.",
    inputSchema: {
      type: "object",
      properties: {
        vhost: { type: "string", description: "Virtual host (default: /)" },
        name: { type: "string", description: "Exchange name" },
      },
      required: ["name"],
    },
  },
  {
    name: "create_exchange",
    description: "Declare a new exchange.",
    inputSchema: {
      type: "object",
      properties: {
        vhost: { type: "string", description: "Virtual host (default: /)" },
        name: { type: "string", description: "Exchange name" },
        type: {
          type: "string",
          enum: ["direct", "fanout", "topic", "headers"],
          description: "Exchange type (default: direct)",
        },
        durable: { type: "boolean", description: "Survive broker restart (default: true)" },
        auto_delete: { type: "boolean", description: "Delete when no longer used (default: false)" },
        internal: { type: "boolean", description: "Internal exchange (default: false)" },
        arguments: {
          type: "object",
          description: "Exchange arguments (alternate-exchange, etc.)",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "delete_exchange",
    description: "Delete an exchange.",
    inputSchema: {
      type: "object",
      properties: {
        vhost: { type: "string", description: "Virtual host (default: /)" },
        name: { type: "string", description: "Exchange name" },
        if_unused: { type: "boolean", description: "Only delete if unused" },
      },
      required: ["name"],
    },
  },
  // Binding Operations
  {
    name: "list_bindings",
    description: "List all bindings in a virtual host.",
    inputSchema: {
      type: "object",
      properties: {
        vhost: { type: "string", description: "Virtual host (default: /)" },
        source: { type: "string", description: "Filter by source exchange" },
        destination: { type: "string", description: "Filter by destination" },
        destination_type: {
          type: "string",
          enum: ["queue", "exchange"],
          description: "Filter by destination type",
        },
      },
    },
  },
  {
    name: "create_binding",
    description: "Create a binding between an exchange and a queue or another exchange.",
    inputSchema: {
      type: "object",
      properties: {
        vhost: { type: "string", description: "Virtual host (default: /)" },
        source: { type: "string", description: "Source exchange name" },
        destination: { type: "string", description: "Destination name (queue or exchange)" },
        destination_type: {
          type: "string",
          enum: ["queue", "exchange"],
          description: "Destination type (default: queue)",
        },
        routing_key: { type: "string", description: "Routing key (default: empty string)" },
        arguments: {
          type: "object",
          description: "Binding arguments (for headers exchange)",
        },
      },
      required: ["source", "destination"],
    },
  },
  {
    name: "delete_binding",
    description: "Delete a binding.",
    inputSchema: {
      type: "object",
      properties: {
        vhost: { type: "string", description: "Virtual host (default: /)" },
        source: { type: "string", description: "Source exchange name" },
        destination: { type: "string", description: "Destination name" },
        destination_type: {
          type: "string",
          enum: ["queue", "exchange"],
          description: "Destination type (default: queue)",
        },
        properties_key: { type: "string", description: "Properties key (routing key or ~ for no key)" },
      },
      required: ["source", "destination", "properties_key"],
    },
  },
  // Virtual Host Operations
  {
    name: "list_vhosts",
    description: "List all virtual hosts.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "create_vhost",
    description: "Create a new virtual host.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Virtual host name" },
        description: { type: "string", description: "Description" },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Tags for the vhost",
        },
        tracing: { type: "boolean", description: "Enable tracing (default: false)" },
      },
      required: ["name"],
    },
  },
  // User Operations
  {
    name: "list_users",
    description: "List all users.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_user",
    description: "Get information about a specific user.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Username" },
      },
      required: ["name"],
    },
  },
  // Cluster Operations
  {
    name: "get_overview",
    description: "Get RabbitMQ cluster overview including statistics and node information.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "health_check",
    description: "Check RabbitMQ health status.",
    inputSchema: {
      type: "object",
      properties: {
        check: {
          type: "string",
          enum: ["alarms", "local-alarms", "virtual-hosts", "node-is-mirror-sync-critical", "node-is-quorum-critical"],
          description: "Specific health check to run (default: alarms)",
        },
      },
    },
  },
];

// =============================================================================
// Tool Implementations
// =============================================================================

// Message Operations

async function publish(params: {
  vhost?: string;
  exchange: string;
  routing_key: string;
  payload: string;
  payload_encoding?: string;
  properties?: Record<string, any>;
}): Promise<any> {
  const vhost = params.vhost || config.defaultVhost;
  const exchangeName = params.exchange || "amq.default";

  const body = {
    routing_key: params.routing_key,
    payload: params.payload,
    payload_encoding: params.payload_encoding || "string",
    properties: params.properties || {},
  };

  const result = await apiRequest(
    "POST",
    `/exchanges/${encodeVhost(vhost)}/${encodeURIComponent(exchangeName)}/publish`,
    body
  );

  return {
    routed: result.routed,
    exchange: params.exchange,
    routing_key: params.routing_key,
    vhost,
  };
}

async function getMessages(params: {
  vhost?: string;
  queue: string;
  count?: number;
  ack_mode?: string;
  encoding?: string;
  truncate?: number;
}): Promise<any> {
  const vhost = params.vhost || config.defaultVhost;

  const body = {
    count: Math.min(params.count || 1, 100),
    ackmode: params.ack_mode || "ack_requeue_true",
    encoding: params.encoding || "auto",
    truncate: params.truncate,
  };

  const messages = await apiRequest(
    "POST",
    `/queues/${encodeVhost(vhost)}/${encodeURIComponent(params.queue)}/get`,
    body
  );

  return {
    queue: params.queue,
    vhost,
    message_count: messages.length,
    messages: messages.map((m: any) => ({
      payload: m.payload,
      payload_encoding: m.payload_encoding,
      routing_key: m.routing_key,
      exchange: m.exchange,
      message_count: m.message_count,
      properties: m.properties,
      redelivered: m.redelivered,
    })),
  };
}

// Queue Operations

async function listQueues(params: {
  vhost?: string;
  name?: string;
  page?: number;
  page_size?: number;
}): Promise<any> {
  const vhost = params.vhost || config.defaultVhost;
  let path = `/queues/${encodeVhost(vhost)}`;

  const queryParams: string[] = [];
  if (params.name) queryParams.push(`name=${encodeURIComponent(params.name)}`);
  if (params.page) queryParams.push(`page=${params.page}`);
  if (params.page_size) queryParams.push(`page_size=${params.page_size}`);

  if (queryParams.length > 0) {
    path += `?${queryParams.join("&")}`;
  }

  const queues = await apiRequest("GET", path);

  // Handle paginated response
  if (queues.items) {
    return {
      vhost,
      queues: queues.items.map((q: any) => ({
        name: q.name,
        vhost: q.vhost,
        durable: q.durable,
        auto_delete: q.auto_delete,
        messages: q.messages,
        messages_ready: q.messages_ready,
        messages_unacknowledged: q.messages_unacknowledged,
        consumers: q.consumers,
        state: q.state,
        type: q.type,
      })),
      total_count: queues.total_count,
      page: queues.page,
      page_count: queues.page_count,
    };
  }

  return {
    vhost,
    queues: queues.map((q: any) => ({
      name: q.name,
      vhost: q.vhost,
      durable: q.durable,
      auto_delete: q.auto_delete,
      messages: q.messages,
      messages_ready: q.messages_ready,
      messages_unacknowledged: q.messages_unacknowledged,
      consumers: q.consumers,
      state: q.state,
      type: q.type,
    })),
    count: queues.length,
  };
}

async function getQueue(params: {
  vhost?: string;
  name: string;
}): Promise<any> {
  const vhost = params.vhost || config.defaultVhost;
  const queue = await apiRequest(
    "GET",
    `/queues/${encodeVhost(vhost)}/${encodeURIComponent(params.name)}`
  );

  return {
    name: queue.name,
    vhost: queue.vhost,
    durable: queue.durable,
    auto_delete: queue.auto_delete,
    exclusive: queue.exclusive,
    arguments: queue.arguments,
    state: queue.state,
    type: queue.type,
    messages: queue.messages,
    messages_ready: queue.messages_ready,
    messages_unacknowledged: queue.messages_unacknowledged,
    consumers: queue.consumers,
    consumer_utilisation: queue.consumer_utilisation,
    memory: queue.memory,
    message_bytes: queue.message_bytes,
    message_bytes_ready: queue.message_bytes_ready,
    message_bytes_unacknowledged: queue.message_bytes_unacknowledged,
    message_stats: queue.message_stats,
  };
}

async function createQueue(params: {
  vhost?: string;
  name: string;
  durable?: boolean;
  auto_delete?: boolean;
  arguments?: Record<string, any>;
}): Promise<any> {
  const vhost = params.vhost || config.defaultVhost;

  const body = {
    durable: params.durable !== false,
    auto_delete: params.auto_delete || false,
    arguments: params.arguments || {},
  };

  await apiRequest(
    "PUT",
    `/queues/${encodeVhost(vhost)}/${encodeURIComponent(params.name)}`,
    body
  );

  return {
    success: true,
    name: params.name,
    vhost,
    durable: body.durable,
    auto_delete: body.auto_delete,
  };
}

async function deleteQueue(params: {
  vhost?: string;
  name: string;
  if_unused?: boolean;
  if_empty?: boolean;
}): Promise<any> {
  const vhost = params.vhost || config.defaultVhost;
  let path = `/queues/${encodeVhost(vhost)}/${encodeURIComponent(params.name)}`;

  const queryParams: string[] = [];
  if (params.if_unused) queryParams.push("if-unused=true");
  if (params.if_empty) queryParams.push("if-empty=true");

  if (queryParams.length > 0) {
    path += `?${queryParams.join("&")}`;
  }

  await apiRequest("DELETE", path);

  return {
    success: true,
    name: params.name,
    vhost,
  };
}

async function purgeQueue(params: {
  vhost?: string;
  name: string;
}): Promise<any> {
  const vhost = params.vhost || config.defaultVhost;

  await apiRequest(
    "DELETE",
    `/queues/${encodeVhost(vhost)}/${encodeURIComponent(params.name)}/contents`
  );

  return {
    success: true,
    name: params.name,
    vhost,
  };
}

// Exchange Operations

async function listExchanges(params: {
  vhost?: string;
  name?: string;
  page?: number;
  page_size?: number;
}): Promise<any> {
  const vhost = params.vhost || config.defaultVhost;
  let path = `/exchanges/${encodeVhost(vhost)}`;

  const queryParams: string[] = [];
  if (params.name) queryParams.push(`name=${encodeURIComponent(params.name)}`);
  if (params.page) queryParams.push(`page=${params.page}`);
  if (params.page_size) queryParams.push(`page_size=${params.page_size}`);

  if (queryParams.length > 0) {
    path += `?${queryParams.join("&")}`;
  }

  const exchanges = await apiRequest("GET", path);

  // Handle paginated response
  if (exchanges.items) {
    return {
      vhost,
      exchanges: exchanges.items.map((e: any) => ({
        name: e.name,
        vhost: e.vhost,
        type: e.type,
        durable: e.durable,
        auto_delete: e.auto_delete,
        internal: e.internal,
        arguments: e.arguments,
      })),
      total_count: exchanges.total_count,
      page: exchanges.page,
      page_count: exchanges.page_count,
    };
  }

  return {
    vhost,
    exchanges: exchanges.map((e: any) => ({
      name: e.name,
      vhost: e.vhost,
      type: e.type,
      durable: e.durable,
      auto_delete: e.auto_delete,
      internal: e.internal,
      arguments: e.arguments,
    })),
    count: exchanges.length,
  };
}

async function getExchange(params: {
  vhost?: string;
  name: string;
}): Promise<any> {
  const vhost = params.vhost || config.defaultVhost;
  const exchange = await apiRequest(
    "GET",
    `/exchanges/${encodeVhost(vhost)}/${encodeURIComponent(params.name)}`
  );

  return {
    name: exchange.name,
    vhost: exchange.vhost,
    type: exchange.type,
    durable: exchange.durable,
    auto_delete: exchange.auto_delete,
    internal: exchange.internal,
    arguments: exchange.arguments,
    message_stats: exchange.message_stats,
  };
}

async function createExchange(params: {
  vhost?: string;
  name: string;
  type?: string;
  durable?: boolean;
  auto_delete?: boolean;
  internal?: boolean;
  arguments?: Record<string, any>;
}): Promise<any> {
  const vhost = params.vhost || config.defaultVhost;

  const body = {
    type: params.type || "direct",
    durable: params.durable !== false,
    auto_delete: params.auto_delete || false,
    internal: params.internal || false,
    arguments: params.arguments || {},
  };

  await apiRequest(
    "PUT",
    `/exchanges/${encodeVhost(vhost)}/${encodeURIComponent(params.name)}`,
    body
  );

  return {
    success: true,
    name: params.name,
    vhost,
    type: body.type,
    durable: body.durable,
    auto_delete: body.auto_delete,
    internal: body.internal,
  };
}

async function deleteExchange(params: {
  vhost?: string;
  name: string;
  if_unused?: boolean;
}): Promise<any> {
  const vhost = params.vhost || config.defaultVhost;
  let path = `/exchanges/${encodeVhost(vhost)}/${encodeURIComponent(params.name)}`;

  if (params.if_unused) {
    path += "?if-unused=true";
  }

  await apiRequest("DELETE", path);

  return {
    success: true,
    name: params.name,
    vhost,
  };
}

// Binding Operations

async function listBindings(params: {
  vhost?: string;
  source?: string;
  destination?: string;
  destination_type?: string;
}): Promise<any> {
  const vhost = params.vhost || config.defaultVhost;
  let path: string;

  if (params.source && params.destination && params.destination_type) {
    // Get specific bindings between source and destination
    const destType = params.destination_type === "exchange" ? "e" : "q";
    path = `/bindings/${encodeVhost(vhost)}/e/${encodeURIComponent(params.source)}/${destType}/${encodeURIComponent(params.destination)}`;
  } else if (params.source) {
    // Get all bindings from a source exchange
    path = `/exchanges/${encodeVhost(vhost)}/${encodeURIComponent(params.source)}/bindings/source`;
  } else if (params.destination && params.destination_type === "queue") {
    // Get all bindings to a queue
    path = `/queues/${encodeVhost(vhost)}/${encodeURIComponent(params.destination)}/bindings`;
  } else if (params.destination && params.destination_type === "exchange") {
    // Get all bindings to an exchange
    path = `/exchanges/${encodeVhost(vhost)}/${encodeURIComponent(params.destination)}/bindings/destination`;
  } else {
    // Get all bindings in vhost
    path = `/bindings/${encodeVhost(vhost)}`;
  }

  const bindings = await apiRequest("GET", path);

  return {
    vhost,
    bindings: bindings.map((b: any) => ({
      source: b.source,
      destination: b.destination,
      destination_type: b.destination_type,
      routing_key: b.routing_key,
      arguments: b.arguments,
      properties_key: b.properties_key,
    })),
    count: bindings.length,
  };
}

async function createBinding(params: {
  vhost?: string;
  source: string;
  destination: string;
  destination_type?: string;
  routing_key?: string;
  arguments?: Record<string, any>;
}): Promise<any> {
  const vhost = params.vhost || config.defaultVhost;
  const destType = (params.destination_type || "queue") === "exchange" ? "e" : "q";

  const body = {
    routing_key: params.routing_key || "",
    arguments: params.arguments || {},
  };

  await apiRequest(
    "POST",
    `/bindings/${encodeVhost(vhost)}/e/${encodeURIComponent(params.source)}/${destType}/${encodeURIComponent(params.destination)}`,
    body
  );

  return {
    success: true,
    source: params.source,
    destination: params.destination,
    destination_type: params.destination_type || "queue",
    routing_key: params.routing_key || "",
    vhost,
  };
}

async function deleteBinding(params: {
  vhost?: string;
  source: string;
  destination: string;
  destination_type?: string;
  properties_key: string;
}): Promise<any> {
  const vhost = params.vhost || config.defaultVhost;
  const destType = (params.destination_type || "queue") === "exchange" ? "e" : "q";

  await apiRequest(
    "DELETE",
    `/bindings/${encodeVhost(vhost)}/e/${encodeURIComponent(params.source)}/${destType}/${encodeURIComponent(params.destination)}/${encodeURIComponent(params.properties_key)}`
  );

  return {
    success: true,
    source: params.source,
    destination: params.destination,
    destination_type: params.destination_type || "queue",
    properties_key: params.properties_key,
    vhost,
  };
}

// Virtual Host Operations

async function listVhosts(): Promise<any> {
  const vhosts = await apiRequest("GET", "/vhosts");

  return {
    vhosts: vhosts.map((v: any) => ({
      name: v.name,
      description: v.description,
      tags: v.tags,
      tracing: v.tracing,
      cluster_state: v.cluster_state,
      messages: v.messages,
      messages_ready: v.messages_ready,
      messages_unacknowledged: v.messages_unacknowledged,
    })),
    count: vhosts.length,
  };
}

async function createVhost(params: {
  name: string;
  description?: string;
  tags?: string[];
  tracing?: boolean;
}): Promise<any> {
  const body: Record<string, any> = {};

  if (params.description) body.description = params.description;
  if (params.tags) body.tags = params.tags.join(",");
  if (params.tracing !== undefined) body.tracing = params.tracing;

  await apiRequest(
    "PUT",
    `/vhosts/${encodeURIComponent(params.name)}`,
    Object.keys(body).length > 0 ? body : undefined
  );

  return {
    success: true,
    name: params.name,
    description: params.description,
    tags: params.tags,
    tracing: params.tracing || false,
  };
}

// User Operations

async function listUsers(): Promise<any> {
  const users = await apiRequest("GET", "/users");

  return {
    users: users.map((u: any) => ({
      name: u.name,
      tags: u.tags,
      password_hash: u.password_hash ? "[hidden]" : undefined,
      hashing_algorithm: u.hashing_algorithm,
    })),
    count: users.length,
  };
}

async function getUser(params: { name: string }): Promise<any> {
  const user = await apiRequest(
    "GET",
    `/users/${encodeURIComponent(params.name)}`
  );

  return {
    name: user.name,
    tags: user.tags,
    hashing_algorithm: user.hashing_algorithm,
  };
}

// Cluster Operations

async function getOverview(): Promise<any> {
  const overview = await apiRequest("GET", "/overview");

  return {
    management_version: overview.management_version,
    rates_mode: overview.rates_mode,
    rabbitmq_version: overview.rabbitmq_version,
    erlang_version: overview.erlang_version,
    erlang_full_version: overview.erlang_full_version,
    cluster_name: overview.cluster_name,
    product_name: overview.product_name,
    product_version: overview.product_version,
    message_stats: overview.message_stats,
    queue_totals: overview.queue_totals,
    object_totals: overview.object_totals,
    node: overview.node,
    listeners: overview.listeners,
    contexts: overview.contexts,
  };
}

async function healthCheck(params: { check?: string }): Promise<any> {
  const checkType = params.check || "alarms";
  let path: string;

  switch (checkType) {
    case "alarms":
      path = "/health/checks/alarms";
      break;
    case "local-alarms":
      path = "/health/checks/local-alarms";
      break;
    case "virtual-hosts":
      path = "/health/checks/virtual-hosts";
      break;
    case "node-is-mirror-sync-critical":
      path = "/health/checks/node-is-mirror-sync-critical";
      break;
    case "node-is-quorum-critical":
      path = "/health/checks/node-is-quorum-critical";
      break;
    default:
      path = "/health/checks/alarms";
  }

  try {
    const result = await apiRequest("GET", path);
    return {
      check: checkType,
      status: "ok",
      result,
    };
  } catch (error: any) {
    return {
      check: checkType,
      status: "failed",
      error: error.message,
    };
  }
}

// =============================================================================
// Server Setup
// =============================================================================

const server = new Server(
  {
    name: "rabbitmq-mcp",
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
      // Message Operations
      case "publish":
        result = await publish(args as any);
        break;
      case "get_messages":
        result = await getMessages(args as any);
        break;
      // Queue Operations
      case "list_queues":
        result = await listQueues(args as any);
        break;
      case "get_queue":
        result = await getQueue(args as any);
        break;
      case "create_queue":
        result = await createQueue(args as any);
        break;
      case "delete_queue":
        result = await deleteQueue(args as any);
        break;
      case "purge_queue":
        result = await purgeQueue(args as any);
        break;
      // Exchange Operations
      case "list_exchanges":
        result = await listExchanges(args as any);
        break;
      case "get_exchange":
        result = await getExchange(args as any);
        break;
      case "create_exchange":
        result = await createExchange(args as any);
        break;
      case "delete_exchange":
        result = await deleteExchange(args as any);
        break;
      // Binding Operations
      case "list_bindings":
        result = await listBindings(args as any);
        break;
      case "create_binding":
        result = await createBinding(args as any);
        break;
      case "delete_binding":
        result = await deleteBinding(args as any);
        break;
      // Virtual Host Operations
      case "list_vhosts":
        result = await listVhosts();
        break;
      case "create_vhost":
        result = await createVhost(args as any);
        break;
      // User Operations
      case "list_users":
        result = await listUsers();
        break;
      case "get_user":
        result = await getUser(args as any);
        break;
      // Cluster Operations
      case "get_overview":
        result = await getOverview();
        break;
      case "health_check":
        result = await healthCheck(args as any);
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
  console.error("RabbitMQ MCP Server running on stdio");
  console.error(`API endpoint: ${config.url}`);
  console.error(`Default vhost: ${config.defaultVhost}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
