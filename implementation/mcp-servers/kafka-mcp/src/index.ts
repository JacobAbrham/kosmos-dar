/**
 * Kafka MCP Server
 *
 * Provides Apache Kafka messaging operations for KOSMOS agents.
 * Features:
 * - Produce messages to topics (single and batch)
 * - Consume messages from topics
 * - Topic management (create, delete, list, metadata)
 * - Consumer group management
 * - Offset management (get, seek, commit)
 * - Broker and cluster information
 * - Partition management
 * - ACL management
 * - Health checks
 *
 * Authentication: Uses SASL/PLAIN or SASL/SCRAM with environment variables.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import {
  Kafka,
  Admin,
  Producer,
  Consumer,
  CompressionTypes,
  logLevel,
  ConfigResourceTypes,
  AclResourceTypes,
  AclOperationTypes,
  AclPermissionTypes,
  ResourcePatternTypes,
} from "kafkajs";

// =============================================================================
// Configuration
// =============================================================================

const config = {
  brokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),
  clientId: process.env.KAFKA_CLIENT_ID || "kosmos-kafka-mcp",
  sasl:
    process.env.KAFKA_SASL_USERNAME && process.env.KAFKA_SASL_PASSWORD
      ? {
          mechanism: (process.env.KAFKA_SASL_MECHANISM as "plain" | "scram-sha-256" | "scram-sha-512") || "plain",
          username: process.env.KAFKA_SASL_USERNAME,
          password: process.env.KAFKA_SASL_PASSWORD,
        }
      : undefined,
  ssl: process.env.KAFKA_SSL === "true",
  connectionTimeout: parseInt(process.env.KAFKA_CONNECTION_TIMEOUT || "10000", 10),
  requestTimeout: parseInt(process.env.KAFKA_REQUEST_TIMEOUT || "30000", 10),
};

// Initialize Kafka client
const kafka = new Kafka({
  clientId: config.clientId,
  brokers: config.brokers,
  ssl: config.ssl,
  sasl: config.sasl,
  connectionTimeout: config.connectionTimeout,
  requestTimeout: config.requestTimeout,
  logLevel: logLevel.WARN,
});

let admin: Admin;
let producer: Producer;
let consumer: Consumer | null = null;
let currentConsumerGroupId: string | null = null;

// =============================================================================
// Tool Definitions
// =============================================================================

const TOOLS: Tool[] = [
  // Message Production
  {
    name: "produce",
    description: "Produce a single message to a Kafka topic.",
    inputSchema: {
      type: "object",
      properties: {
        topic: { type: "string", description: "Topic name" },
        message: { type: "string", description: "Message value" },
        key: { type: "string", description: "Message key (optional)" },
        partition: { type: "number", description: "Target partition (optional)" },
        headers: {
          type: "object",
          description: "Message headers as key-value pairs",
        },
        compression: {
          type: "string",
          enum: ["none", "gzip", "snappy", "lz4", "zstd"],
          description: "Compression type (default: none)",
        },
      },
      required: ["topic", "message"],
    },
  },
  {
    name: "produce_batch",
    description: "Produce a batch of messages to one or more topics.",
    inputSchema: {
      type: "object",
      properties: {
        messages: {
          type: "array",
          items: {
            type: "object",
            properties: {
              topic: { type: "string", description: "Topic name" },
              message: { type: "string", description: "Message value" },
              key: { type: "string", description: "Message key (optional)" },
              partition: { type: "number", description: "Target partition" },
              headers: { type: "object", description: "Message headers" },
            },
            required: ["topic", "message"],
          },
          description: "Array of messages to produce",
        },
        compression: {
          type: "string",
          enum: ["none", "gzip", "snappy", "lz4", "zstd"],
          description: "Compression type (default: none)",
        },
      },
      required: ["messages"],
    },
  },
  // Message Consumption
  {
    name: "consume_once",
    description: "Consume a single message from a topic.",
    inputSchema: {
      type: "object",
      properties: {
        topic: { type: "string", description: "Topic to consume from" },
        group_id: { type: "string", description: "Consumer group ID" },
        timeout: {
          type: "number",
          description: "Timeout in milliseconds (default: 5000)",
        },
        from_beginning: {
          type: "boolean",
          description: "Start from beginning of topic (default: false)",
        },
      },
      required: ["topic", "group_id"],
    },
  },
  {
    name: "consume_batch",
    description: "Consume a batch of messages from a topic.",
    inputSchema: {
      type: "object",
      properties: {
        topic: { type: "string", description: "Topic to consume from" },
        group_id: { type: "string", description: "Consumer group ID" },
        max_messages: {
          type: "number",
          description: "Maximum messages to consume (default: 10)",
        },
        timeout: {
          type: "number",
          description: "Timeout in milliseconds (default: 10000)",
        },
        from_beginning: {
          type: "boolean",
          description: "Start from beginning of topic (default: false)",
        },
      },
      required: ["topic", "group_id"],
    },
  },
  // Topic Management
  {
    name: "list_topics",
    description: "List all topics in the Kafka cluster.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "create_topic",
    description: "Create a new Kafka topic.",
    inputSchema: {
      type: "object",
      properties: {
        topic: { type: "string", description: "Topic name" },
        num_partitions: {
          type: "number",
          description: "Number of partitions (default: 1)",
        },
        replication_factor: {
          type: "number",
          description: "Replication factor (default: 1)",
        },
        config_entries: {
          type: "object",
          description: "Topic configuration entries (e.g., retention.ms)",
        },
      },
      required: ["topic"],
    },
  },
  {
    name: "delete_topic",
    description: "Delete a Kafka topic.",
    inputSchema: {
      type: "object",
      properties: {
        topic: { type: "string", description: "Topic name to delete" },
      },
      required: ["topic"],
    },
  },
  {
    name: "get_topic_metadata",
    description: "Get metadata for a specific topic.",
    inputSchema: {
      type: "object",
      properties: {
        topic: { type: "string", description: "Topic name" },
      },
      required: ["topic"],
    },
  },
  // Consumer Group Management
  {
    name: "list_consumer_groups",
    description: "List all consumer groups.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "describe_consumer_group",
    description: "Get detailed information about a consumer group.",
    inputSchema: {
      type: "object",
      properties: {
        group_id: { type: "string", description: "Consumer group ID" },
      },
      required: ["group_id"],
    },
  },
  // Offset Management
  {
    name: "get_offsets",
    description: "Get current offsets for a topic.",
    inputSchema: {
      type: "object",
      properties: {
        topic: { type: "string", description: "Topic name" },
        partitions: {
          type: "array",
          items: { type: "number" },
          description: "Partition numbers (optional, all if not specified)",
        },
      },
      required: ["topic"],
    },
  },
  {
    name: "seek_offset",
    description: "Seek to a specific offset for a consumer.",
    inputSchema: {
      type: "object",
      properties: {
        topic: { type: "string", description: "Topic name" },
        group_id: { type: "string", description: "Consumer group ID" },
        partition: { type: "number", description: "Partition number" },
        offset: { type: "string", description: "Offset to seek to (number, 'earliest', or 'latest')" },
      },
      required: ["topic", "group_id", "partition", "offset"],
    },
  },
  {
    name: "commit_offsets",
    description: "Commit offsets for a consumer group.",
    inputSchema: {
      type: "object",
      properties: {
        group_id: { type: "string", description: "Consumer group ID" },
        topic: { type: "string", description: "Topic name" },
        partitions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              partition: { type: "number", description: "Partition number" },
              offset: { type: "string", description: "Offset to commit" },
            },
            required: ["partition", "offset"],
          },
          description: "Partition-offset pairs to commit",
        },
      },
      required: ["group_id", "topic", "partitions"],
    },
  },
  // Broker and Cluster Information
  {
    name: "list_brokers",
    description: "List all brokers in the Kafka cluster.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_cluster_metadata",
    description: "Get metadata for the entire Kafka cluster.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  // Partition Management
  {
    name: "list_partitions",
    description: "List partitions for a topic with their details.",
    inputSchema: {
      type: "object",
      properties: {
        topic: { type: "string", description: "Topic name" },
      },
      required: ["topic"],
    },
  },
  {
    name: "get_watermarks",
    description: "Get low and high watermarks for topic partitions.",
    inputSchema: {
      type: "object",
      properties: {
        topic: { type: "string", description: "Topic name" },
        partitions: {
          type: "array",
          items: { type: "number" },
          description: "Partition numbers (optional, all if not specified)",
        },
      },
      required: ["topic"],
    },
  },
  // ACL Management
  {
    name: "create_acl",
    description: "Create an ACL (Access Control List) entry.",
    inputSchema: {
      type: "object",
      properties: {
        resource_type: {
          type: "string",
          enum: ["topic", "group", "cluster", "transactional_id", "delegation_token"],
          description: "Resource type",
        },
        resource_name: { type: "string", description: "Resource name (use '*' for all)" },
        resource_pattern_type: {
          type: "string",
          enum: ["literal", "prefixed", "match", "any"],
          description: "Pattern type (default: literal)",
        },
        principal: { type: "string", description: "Principal (e.g., 'User:alice')" },
        host: { type: "string", description: "Host (use '*' for all)" },
        operation: {
          type: "string",
          enum: ["all", "read", "write", "create", "delete", "alter", "describe", "cluster_action", "describe_configs", "alter_configs", "idempotent_write"],
          description: "Operation type",
        },
        permission: {
          type: "string",
          enum: ["allow", "deny"],
          description: "Permission type (default: allow)",
        },
      },
      required: ["resource_type", "resource_name", "principal", "host", "operation"],
    },
  },
  {
    name: "list_acls",
    description: "List ACL entries with optional filtering.",
    inputSchema: {
      type: "object",
      properties: {
        resource_type: {
          type: "string",
          enum: ["topic", "group", "cluster", "transactional_id", "delegation_token", "any"],
          description: "Filter by resource type",
        },
        resource_name: { type: "string", description: "Filter by resource name" },
        principal: { type: "string", description: "Filter by principal" },
      },
    },
  },
  // Health Check
  {
    name: "health_check",
    description: "Check Kafka connectivity and cluster health.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

// =============================================================================
// Helper Functions
// =============================================================================

function getCompressionType(compression?: string): CompressionTypes {
  switch (compression) {
    case "gzip":
      return CompressionTypes.GZIP;
    case "snappy":
      return CompressionTypes.Snappy;
    case "lz4":
      return CompressionTypes.LZ4;
    case "zstd":
      return CompressionTypes.ZSTD;
    default:
      return CompressionTypes.None;
  }
}

function getResourceType(type: string): AclResourceTypes {
  switch (type) {
    case "topic":
      return AclResourceTypes.TOPIC;
    case "group":
      return AclResourceTypes.GROUP;
    case "cluster":
      return AclResourceTypes.CLUSTER;
    case "transactional_id":
      return AclResourceTypes.TRANSACTIONAL_ID;
    case "delegation_token":
      return AclResourceTypes.DELEGATION_TOKEN;
    default:
      return AclResourceTypes.ANY;
  }
}

function getOperationType(operation: string): AclOperationTypes {
  switch (operation) {
    case "read":
      return AclOperationTypes.READ;
    case "write":
      return AclOperationTypes.WRITE;
    case "create":
      return AclOperationTypes.CREATE;
    case "delete":
      return AclOperationTypes.DELETE;
    case "alter":
      return AclOperationTypes.ALTER;
    case "describe":
      return AclOperationTypes.DESCRIBE;
    case "cluster_action":
      return AclOperationTypes.CLUSTER_ACTION;
    case "describe_configs":
      return AclOperationTypes.DESCRIBE_CONFIGS;
    case "alter_configs":
      return AclOperationTypes.ALTER_CONFIGS;
    case "idempotent_write":
      return AclOperationTypes.IDEMPOTENT_WRITE;
    case "all":
      return AclOperationTypes.ALL;
    default:
      return AclOperationTypes.ANY;
  }
}

function getPermissionType(permission?: string): AclPermissionTypes {
  switch (permission) {
    case "deny":
      return AclPermissionTypes.DENY;
    default:
      return AclPermissionTypes.ALLOW;
  }
}

function getResourcePatternType(pattern?: string): ResourcePatternTypes {
  switch (pattern) {
    case "prefixed":
      return ResourcePatternTypes.PREFIXED;
    case "match":
      return ResourcePatternTypes.MATCH;
    case "any":
      return ResourcePatternTypes.ANY;
    default:
      return ResourcePatternTypes.LITERAL;
  }
}

async function getOrCreateConsumer(groupId: string, fromBeginning: boolean = false): Promise<Consumer> {
  if (consumer && currentConsumerGroupId === groupId) {
    return consumer;
  }

  // Disconnect existing consumer if group changed
  if (consumer) {
    await consumer.disconnect();
  }

  consumer = kafka.consumer({ groupId });
  currentConsumerGroupId = groupId;
  await consumer.connect();

  return consumer;
}

// =============================================================================
// Tool Implementations
// =============================================================================

// Message Production

async function produce(params: {
  topic: string;
  message: string;
  key?: string;
  partition?: number;
  headers?: Record<string, string>;
  compression?: string;
}): Promise<any> {
  const result = await producer.send({
    topic: params.topic,
    compression: getCompressionType(params.compression),
    messages: [
      {
        key: params.key,
        value: params.message,
        partition: params.partition,
        headers: params.headers,
      },
    ],
  });

  return {
    success: true,
    topic: params.topic,
    partition: result[0].partition,
    offset: result[0].baseOffset,
    timestamp: new Date().toISOString(),
  };
}

async function produceBatch(params: {
  messages: Array<{
    topic: string;
    message: string;
    key?: string;
    partition?: number;
    headers?: Record<string, string>;
  }>;
  compression?: string;
}): Promise<any> {
  // Group messages by topic
  const topicMessages: Record<string, Array<any>> = {};
  for (const msg of params.messages) {
    if (!topicMessages[msg.topic]) {
      topicMessages[msg.topic] = [];
    }
    topicMessages[msg.topic].push({
      key: msg.key,
      value: msg.message,
      partition: msg.partition,
      headers: msg.headers,
    });
  }

  const results = await producer.sendBatch({
    compression: getCompressionType(params.compression),
    topicMessages: Object.entries(topicMessages).map(([topic, messages]) => ({
      topic,
      messages,
    })),
  });

  return {
    success: true,
    results: results.map((r) => ({
      topic: r.topicName,
      partition: r.partition,
      offset: r.baseOffset,
    })),
    totalMessages: params.messages.length,
    timestamp: new Date().toISOString(),
  };
}

// Message Consumption

async function consumeOnce(params: {
  topic: string;
  group_id: string;
  timeout?: number;
  from_beginning?: boolean;
}): Promise<any> {
  const timeout = params.timeout || 5000;
  const consumerInstance = await getOrCreateConsumer(params.group_id, params.from_beginning);

  await consumerInstance.subscribe({
    topic: params.topic,
    fromBeginning: params.from_beginning || false,
  });

  return new Promise((resolve, reject) => {
    const timer = setTimeout(async () => {
      await consumerInstance.stop();
      resolve({ message: null, timeout: true });
    }, timeout);

    consumerInstance.run({
      eachMessage: async ({ topic, partition, message }) => {
        clearTimeout(timer);
        await consumerInstance.stop();
        resolve({
          topic,
          partition,
          offset: message.offset,
          key: message.key?.toString(),
          value: message.value?.toString(),
          headers: message.headers
            ? Object.fromEntries(
                Object.entries(message.headers).map(([k, v]) => [k, v?.toString()])
              )
            : undefined,
          timestamp: message.timestamp,
        });
      },
    });
  });
}

async function consumeBatch(params: {
  topic: string;
  group_id: string;
  max_messages?: number;
  timeout?: number;
  from_beginning?: boolean;
}): Promise<any> {
  const timeout = params.timeout || 10000;
  const maxMessages = params.max_messages || 10;
  const consumerInstance = await getOrCreateConsumer(params.group_id, params.from_beginning);

  await consumerInstance.subscribe({
    topic: params.topic,
    fromBeginning: params.from_beginning || false,
  });

  const messages: any[] = [];

  return new Promise((resolve, reject) => {
    const timer = setTimeout(async () => {
      await consumerInstance.stop();
      resolve({ messages, count: messages.length, timeout: true });
    }, timeout);

    consumerInstance.run({
      eachMessage: async ({ topic, partition, message }) => {
        messages.push({
          topic,
          partition,
          offset: message.offset,
          key: message.key?.toString(),
          value: message.value?.toString(),
          headers: message.headers
            ? Object.fromEntries(
                Object.entries(message.headers).map(([k, v]) => [k, v?.toString()])
              )
            : undefined,
          timestamp: message.timestamp,
        });

        if (messages.length >= maxMessages) {
          clearTimeout(timer);
          await consumerInstance.stop();
          resolve({ messages, count: messages.length, timeout: false });
        }
      },
    });
  });
}

// Topic Management

async function listTopics(): Promise<any> {
  const metadata = await admin.fetchTopicMetadata();
  const topics = metadata.topics.map((t) => ({
    name: t.name,
    partitions: t.partitions.length,
  }));

  return { topics, count: topics.length };
}

async function createTopic(params: {
  topic: string;
  num_partitions?: number;
  replication_factor?: number;
  config_entries?: Record<string, string>;
}): Promise<any> {
  const configEntries = params.config_entries
    ? Object.entries(params.config_entries).map(([name, value]) => ({
        name,
        value,
      }))
    : undefined;

  await admin.createTopics({
    topics: [
      {
        topic: params.topic,
        numPartitions: params.num_partitions || 1,
        replicationFactor: params.replication_factor || 1,
        configEntries,
      },
    ],
  });

  return {
    success: true,
    topic: params.topic,
    partitions: params.num_partitions || 1,
    replicationFactor: params.replication_factor || 1,
  };
}

async function deleteTopic(params: { topic: string }): Promise<any> {
  await admin.deleteTopics({
    topics: [params.topic],
  });

  return { success: true, topic: params.topic };
}

async function getTopicMetadata(params: { topic: string }): Promise<any> {
  const metadata = await admin.fetchTopicMetadata({ topics: [params.topic] });
  const topic = metadata.topics[0];

  // Get topic configuration
  const configResult = await admin.describeConfigs({
    resources: [
      {
        type: ConfigResourceTypes.TOPIC,
        name: params.topic,
      },
    ],
    includeSynonyms: false,
  });

  const config: Record<string, string> = {};
  if (configResult.resources[0]) {
    for (const entry of configResult.resources[0].configEntries) {
      config[entry.configName] = entry.configValue;
    }
  }

  return {
    name: topic.name,
    partitions: topic.partitions.map((p) => ({
      id: p.partitionId,
      leader: p.leader,
      replicas: p.replicas,
      isr: p.isr,
    })),
    partitionCount: topic.partitions.length,
    config,
  };
}

// Consumer Group Management

async function listConsumerGroups(): Promise<any> {
  const { groups } = await admin.listGroups();

  return {
    groups: groups.map((g) => ({
      groupId: g.groupId,
      protocolType: g.protocolType,
    })),
    count: groups.length,
  };
}

async function describeConsumerGroup(params: { group_id: string }): Promise<any> {
  const result = await admin.describeGroups([params.group_id]);
  const group = result.groups[0];

  return {
    groupId: group.groupId,
    state: group.state,
    protocolType: group.protocolType,
    protocol: group.protocol,
    members: group.members.map((m) => ({
      memberId: m.memberId,
      clientId: m.clientId,
      clientHost: m.clientHost,
    })),
    memberCount: group.members.length,
  };
}

// Offset Management

async function getOffsets(params: {
  topic: string;
  partitions?: number[];
}): Promise<any> {
  const metadata = await admin.fetchTopicMetadata({ topics: [params.topic] });
  const topicData = metadata.topics[0];

  const partitions = params.partitions || topicData.partitions.map((p) => p.partitionId);

  const [earliest, latest] = await Promise.all([
    admin.fetchTopicOffsets(params.topic),
    admin.fetchTopicOffsets(params.topic),
  ]);

  const offsets = partitions.map((partition) => {
    const earliestOffset = earliest.find((o) => o.partition === partition);
    const latestOffset = latest.find((o) => o.partition === partition);
    return {
      partition,
      earliest: earliestOffset?.offset,
      latest: latestOffset?.offset,
      high: latestOffset?.high,
      low: latestOffset?.low,
    };
  });

  return { topic: params.topic, offsets };
}

async function seekOffset(params: {
  topic: string;
  group_id: string;
  partition: number;
  offset: string;
}): Promise<any> {
  let targetOffset: string;

  if (params.offset === "earliest") {
    const offsets = await admin.fetchTopicOffsets(params.topic);
    const partitionData = offsets.find((o) => o.partition === params.partition);
    targetOffset = partitionData?.low || "0";
  } else if (params.offset === "latest") {
    const offsets = await admin.fetchTopicOffsets(params.topic);
    const partitionData = offsets.find((o) => o.partition === params.partition);
    targetOffset = partitionData?.high || "0";
  } else {
    targetOffset = params.offset;
  }

  await admin.setOffsets({
    groupId: params.group_id,
    topic: params.topic,
    partitions: [
      {
        partition: params.partition,
        offset: targetOffset,
      },
    ],
  });

  return {
    success: true,
    topic: params.topic,
    groupId: params.group_id,
    partition: params.partition,
    offset: targetOffset,
  };
}

async function commitOffsets(params: {
  group_id: string;
  topic: string;
  partitions: Array<{ partition: number; offset: string }>;
}): Promise<any> {
  await admin.setOffsets({
    groupId: params.group_id,
    topic: params.topic,
    partitions: params.partitions.map((p) => ({
      partition: p.partition,
      offset: p.offset,
    })),
  });

  return {
    success: true,
    groupId: params.group_id,
    topic: params.topic,
    partitions: params.partitions,
  };
}

// Broker and Cluster Information

async function listBrokers(): Promise<any> {
  const cluster = await admin.describeCluster();

  return {
    brokers: cluster.brokers.map((b) => ({
      nodeId: b.nodeId,
      host: b.host,
      port: b.port,
    })),
    count: cluster.brokers.length,
    controller: cluster.controller,
  };
}

async function getClusterMetadata(): Promise<any> {
  const cluster = await admin.describeCluster();
  const topics = await admin.listTopics();
  const metadata = await admin.fetchTopicMetadata();

  let totalPartitions = 0;
  let totalReplicas = 0;
  for (const topic of metadata.topics) {
    totalPartitions += topic.partitions.length;
    for (const partition of topic.partitions) {
      totalReplicas += partition.replicas.length;
    }
  }

  return {
    clusterId: cluster.clusterId,
    controller: cluster.controller,
    brokers: cluster.brokers.map((b) => ({
      nodeId: b.nodeId,
      host: b.host,
      port: b.port,
    })),
    brokerCount: cluster.brokers.length,
    topicCount: topics.length,
    totalPartitions,
    totalReplicas,
  };
}

// Partition Management

async function listPartitions(params: { topic: string }): Promise<any> {
  const metadata = await admin.fetchTopicMetadata({ topics: [params.topic] });
  const topic = metadata.topics[0];

  const partitions = topic.partitions.map((p) => ({
    id: p.partitionId,
    leader: p.leader,
    replicas: p.replicas,
    isr: p.isr,
    isrCount: p.isr.length,
    replicaCount: p.replicas.length,
    inSync: p.isr.length === p.replicas.length,
  }));

  return {
    topic: params.topic,
    partitions,
    count: partitions.length,
    inSyncCount: partitions.filter((p) => p.inSync).length,
  };
}

async function getWatermarks(params: {
  topic: string;
  partitions?: number[];
}): Promise<any> {
  const offsets = await admin.fetchTopicOffsets(params.topic);

  let watermarks = offsets.map((o) => ({
    partition: o.partition,
    low: o.low,
    high: o.high,
    offset: o.offset,
    messageCount: parseInt(o.high, 10) - parseInt(o.low, 10),
  }));

  if (params.partitions && params.partitions.length > 0) {
    watermarks = watermarks.filter((w) => params.partitions!.includes(w.partition));
  }

  return {
    topic: params.topic,
    watermarks,
    count: watermarks.length,
  };
}

// ACL Management

async function createAcl(params: {
  resource_type: string;
  resource_name: string;
  resource_pattern_type?: string;
  principal: string;
  host: string;
  operation: string;
  permission?: string;
}): Promise<any> {
  await admin.createAcls({
    acl: [
      {
        resourceType: getResourceType(params.resource_type),
        resourceName: params.resource_name,
        resourcePatternType: getResourcePatternType(params.resource_pattern_type),
        principal: params.principal,
        host: params.host,
        operation: getOperationType(params.operation),
        permissionType: getPermissionType(params.permission),
      },
    ],
  });

  return {
    success: true,
    resourceType: params.resource_type,
    resourceName: params.resource_name,
    principal: params.principal,
    operation: params.operation,
    permission: params.permission || "allow",
  };
}

async function listAcls(params: {
  resource_type?: string;
  resource_name?: string;
  principal?: string;
}): Promise<any> {
  const filter: any = {
    resourceType: params.resource_type
      ? getResourceType(params.resource_type)
      : AclResourceTypes.ANY,
    resourceName: params.resource_name,
    resourcePatternType: ResourcePatternTypes.ANY,
    principal: params.principal,
    host: undefined,
    operation: AclOperationTypes.ANY,
    permissionType: AclPermissionTypes.ANY,
  };

  const result = await admin.describeAcls(filter);

  return {
    acls: result.resources.flatMap((r) =>
      r.acls.map((a) => ({
        resourceType: r.resourceType,
        resourceName: r.resourceName,
        resourcePatternType: r.resourcePatternType,
        principal: a.principal,
        host: a.host,
        operation: a.operation,
        permissionType: a.permissionType,
      }))
    ),
    count: result.resources.reduce((sum, r) => sum + r.acls.length, 0),
  };
}

// Health Check

async function healthCheck(): Promise<any> {
  const startTime = Date.now();

  try {
    const cluster = await admin.describeCluster();
    const topics = await admin.listTopics();
    const latency = Date.now() - startTime;

    return {
      status: "healthy",
      latency: `${latency}ms`,
      cluster: {
        id: cluster.clusterId,
        controller: cluster.controller,
        brokerCount: cluster.brokers.length,
        brokers: cluster.brokers.map((b) => ({
          nodeId: b.nodeId,
          host: b.host,
          port: b.port,
        })),
      },
      topicCount: topics.length,
      clientId: config.clientId,
      brokers: config.brokers,
      ssl: config.ssl,
      sasl: config.sasl ? "enabled" : "disabled",
    };
  } catch (error: any) {
    return {
      status: "unhealthy",
      error: error.message,
      clientId: config.clientId,
      brokers: config.brokers,
    };
  }
}

// =============================================================================
// Server Setup
// =============================================================================

const server = new Server(
  {
    name: "kafka-mcp",
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
      // Message Production
      case "produce":
        result = await produce(args as any);
        break;
      case "produce_batch":
        result = await produceBatch(args as any);
        break;
      // Message Consumption
      case "consume_once":
        result = await consumeOnce(args as any);
        break;
      case "consume_batch":
        result = await consumeBatch(args as any);
        break;
      // Topic Management
      case "list_topics":
        result = await listTopics();
        break;
      case "create_topic":
        result = await createTopic(args as any);
        break;
      case "delete_topic":
        result = await deleteTopic(args as any);
        break;
      case "get_topic_metadata":
        result = await getTopicMetadata(args as any);
        break;
      // Consumer Group Management
      case "list_consumer_groups":
        result = await listConsumerGroups();
        break;
      case "describe_consumer_group":
        result = await describeConsumerGroup(args as any);
        break;
      // Offset Management
      case "get_offsets":
        result = await getOffsets(args as any);
        break;
      case "seek_offset":
        result = await seekOffset(args as any);
        break;
      case "commit_offsets":
        result = await commitOffsets(args as any);
        break;
      // Broker and Cluster Information
      case "list_brokers":
        result = await listBrokers();
        break;
      case "get_cluster_metadata":
        result = await getClusterMetadata();
        break;
      // Partition Management
      case "list_partitions":
        result = await listPartitions(args as any);
        break;
      case "get_watermarks":
        result = await getWatermarks(args as any);
        break;
      // ACL Management
      case "create_acl":
        result = await createAcl(args as any);
        break;
      case "list_acls":
        result = await listAcls(args as any);
        break;
      // Health Check
      case "health_check":
        result = await healthCheck();
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
  // Connect admin and producer
  admin = kafka.admin();
  producer = kafka.producer();

  await admin.connect();
  console.error("Kafka admin connected");

  await producer.connect();
  console.error("Kafka producer connected");

  // Start MCP server
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Kafka MCP Server running on stdio");
  console.error(`Connected to brokers: ${config.brokers.join(", ")}`);
  console.error(`Client ID: ${config.clientId}`);
  console.error(`SSL: ${config.ssl ? "enabled" : "disabled"}`);
  console.error(`SASL: ${config.sasl ? "enabled" : "disabled"}`);

  // Handle graceful shutdown
  const shutdown = async () => {
    console.error("Shutting down...");
    if (consumer) {
      await consumer.disconnect();
    }
    await producer.disconnect();
    await admin.disconnect();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
