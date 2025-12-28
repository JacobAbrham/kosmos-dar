/**
 * Neo4j MCP Server - Graph database operations for KOSMOS agents
 *
 * Provides comprehensive tools for interacting with Neo4j graph databases:
 * - Query execution (Cypher)
 * - Node CRUD operations
 * - Relationship management
 * - Path finding algorithms
 * - Schema introspection
 * - Index management
 * - Transaction support
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import neo4j, { Driver, Session, Transaction } from "neo4j-driver";

// Environment configuration
const config = {
  uri: process.env.NEO4J_URI || "bolt://localhost:7687",
  user: process.env.NEO4J_USER || process.env.NEO4J_USERNAME || "neo4j",
  password: process.env.NEO4J_PASSWORD || "",
  database: process.env.NEO4J_DATABASE || "neo4j",
};

let driver: Driver | null = null;

/**
 * Get or create the Neo4j driver instance
 */
function getDriver(): Driver {
  if (!driver) {
    driver = neo4j.driver(
      config.uri,
      neo4j.auth.basic(config.user, config.password),
      {
        maxConnectionPoolSize: 50,
        connectionAcquisitionTimeout: 30000,
        connectionTimeout: 30000,
      }
    );
  }
  return driver;
}

/**
 * Execute a Cypher query and return formatted results
 */
async function runQuery(
  cypher: string,
  params?: Record<string, any>,
  database?: string,
  accessMode: "READ" | "WRITE" = "WRITE"
): Promise<any> {
  const session = getDriver().session({
    database: database || config.database,
    defaultAccessMode: accessMode === "READ" ? neo4j.session.READ : neo4j.session.WRITE,
  });

  try {
    const result = await session.run(cypher, params);
    return {
      records: result.records.map((r) => {
        const obj = r.toObject();
        // Convert Neo4j integers to regular numbers
        return convertNeo4jTypes(obj);
      }),
      summary: {
        counters: result.summary.counters.updates(),
        queryType: result.summary.queryType,
        resultAvailableAfter: result.summary.resultAvailableAfter?.toNumber(),
        resultConsumedAfter: result.summary.resultConsumedAfter?.toNumber(),
      },
    };
  } finally {
    await session.close();
  }
}

/**
 * Convert Neo4j types (Integer, Node, Relationship) to plain JS objects
 */
function convertNeo4jTypes(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Neo4j Integer
  if (neo4j.isInt(obj)) {
    return obj.toNumber();
  }

  // Neo4j Node
  if (obj.labels !== undefined && obj.properties !== undefined && obj.identity !== undefined) {
    return {
      id: neo4j.isInt(obj.identity) ? obj.identity.toNumber() : obj.identity,
      labels: obj.labels,
      properties: convertNeo4jTypes(obj.properties),
    };
  }

  // Neo4j Relationship
  if (obj.type !== undefined && obj.properties !== undefined && obj.start !== undefined && obj.end !== undefined) {
    return {
      id: neo4j.isInt(obj.identity) ? obj.identity.toNumber() : obj.identity,
      type: obj.type,
      startNodeId: neo4j.isInt(obj.start) ? obj.start.toNumber() : obj.start,
      endNodeId: neo4j.isInt(obj.end) ? obj.end.toNumber() : obj.end,
      properties: convertNeo4jTypes(obj.properties),
    };
  }

  // Neo4j Path
  if (obj.segments !== undefined && obj.start !== undefined && obj.end !== undefined) {
    return {
      start: convertNeo4jTypes(obj.start),
      end: convertNeo4jTypes(obj.end),
      segments: obj.segments.map((seg: any) => ({
        start: convertNeo4jTypes(seg.start),
        relationship: convertNeo4jTypes(seg.relationship),
        end: convertNeo4jTypes(seg.end),
      })),
      length: obj.length,
    };
  }

  // Array
  if (Array.isArray(obj)) {
    return obj.map(convertNeo4jTypes);
  }

  // Object
  if (typeof obj === "object") {
    const result: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      result[key] = convertNeo4jTypes(obj[key]);
    }
    return result;
  }

  return obj;
}

// Tool definitions
const TOOLS: Tool[] = [
  // Query Execution
  {
    name: "query",
    description: "Execute a Cypher query against the Neo4j database. Supports both read and write operations.",
    inputSchema: {
      type: "object",
      properties: {
        cypher: {
          type: "string",
          description: "Cypher query to execute",
        },
        params: {
          type: "object",
          description: "Query parameters (use $paramName in Cypher)",
        },
        database: {
          type: "string",
          description: "Database name (optional, defaults to configured database)",
        },
      },
      required: ["cypher"],
    },
  },
  {
    name: "read_query",
    description: "Execute a read-only Cypher query. Uses read transaction mode for better performance.",
    inputSchema: {
      type: "object",
      properties: {
        cypher: {
          type: "string",
          description: "Read-only Cypher query to execute",
        },
        params: {
          type: "object",
          description: "Query parameters",
        },
        database: {
          type: "string",
          description: "Database name (optional)",
        },
      },
      required: ["cypher"],
    },
  },

  // Node Operations
  {
    name: "create_node",
    description: "Create a new node with specified labels and properties",
    inputSchema: {
      type: "object",
      properties: {
        labels: {
          type: "array",
          items: { type: "string" },
          description: "Node labels (e.g., ['Person', 'Employee'])",
        },
        properties: {
          type: "object",
          description: "Node properties (key-value pairs)",
        },
        database: {
          type: "string",
          description: "Database name (optional)",
        },
      },
      required: ["labels"],
    },
  },
  {
    name: "get_node",
    description: "Get a node by its internal ID",
    inputSchema: {
      type: "object",
      properties: {
        nodeId: {
          type: "number",
          description: "Internal node ID",
        },
        database: {
          type: "string",
          description: "Database name (optional)",
        },
      },
      required: ["nodeId"],
    },
  },
  {
    name: "update_node",
    description: "Update properties of an existing node",
    inputSchema: {
      type: "object",
      properties: {
        nodeId: {
          type: "number",
          description: "Internal node ID",
        },
        properties: {
          type: "object",
          description: "Properties to update or add",
        },
        replace: {
          type: "boolean",
          description: "If true, replace all properties; if false, merge with existing",
          default: false,
        },
        database: {
          type: "string",
          description: "Database name (optional)",
        },
      },
      required: ["nodeId", "properties"],
    },
  },
  {
    name: "delete_node",
    description: "Delete a node by ID. Use detach=true to delete connected relationships.",
    inputSchema: {
      type: "object",
      properties: {
        nodeId: {
          type: "number",
          description: "Internal node ID",
        },
        detach: {
          type: "boolean",
          description: "If true, delete all relationships connected to the node",
          default: false,
        },
        database: {
          type: "string",
          description: "Database name (optional)",
        },
      },
      required: ["nodeId"],
    },
  },
  {
    name: "find_nodes",
    description: "Find nodes by label and/or properties",
    inputSchema: {
      type: "object",
      properties: {
        label: {
          type: "string",
          description: "Node label to search for",
        },
        properties: {
          type: "object",
          description: "Properties to match (exact match)",
        },
        limit: {
          type: "number",
          description: "Maximum number of results (default: 100)",
          default: 100,
        },
        skip: {
          type: "number",
          description: "Number of results to skip (for pagination)",
          default: 0,
        },
        orderBy: {
          type: "string",
          description: "Property to order by",
        },
        orderDirection: {
          type: "string",
          enum: ["ASC", "DESC"],
          description: "Order direction",
          default: "ASC",
        },
        database: {
          type: "string",
          description: "Database name (optional)",
        },
      },
    },
  },

  // Relationship Operations
  {
    name: "create_relationship",
    description: "Create a relationship between two nodes",
    inputSchema: {
      type: "object",
      properties: {
        fromNodeId: {
          type: "number",
          description: "Source node ID",
        },
        toNodeId: {
          type: "number",
          description: "Target node ID",
        },
        type: {
          type: "string",
          description: "Relationship type (e.g., 'KNOWS', 'WORKS_AT')",
        },
        properties: {
          type: "object",
          description: "Relationship properties",
        },
        database: {
          type: "string",
          description: "Database name (optional)",
        },
      },
      required: ["fromNodeId", "toNodeId", "type"],
    },
  },
  {
    name: "get_relationship",
    description: "Get a relationship by its ID",
    inputSchema: {
      type: "object",
      properties: {
        relationshipId: {
          type: "number",
          description: "Internal relationship ID",
        },
        database: {
          type: "string",
          description: "Database name (optional)",
        },
      },
      required: ["relationshipId"],
    },
  },
  {
    name: "delete_relationship",
    description: "Delete a relationship by ID",
    inputSchema: {
      type: "object",
      properties: {
        relationshipId: {
          type: "number",
          description: "Internal relationship ID",
        },
        database: {
          type: "string",
          description: "Database name (optional)",
        },
      },
      required: ["relationshipId"],
    },
  },

  // Graph Traversal
  {
    name: "find_paths",
    description: "Find paths between two nodes",
    inputSchema: {
      type: "object",
      properties: {
        fromNodeId: {
          type: "number",
          description: "Starting node ID",
        },
        toNodeId: {
          type: "number",
          description: "Ending node ID",
        },
        relationshipTypes: {
          type: "array",
          items: { type: "string" },
          description: "Relationship types to traverse (optional, all types if not specified)",
        },
        maxDepth: {
          type: "number",
          description: "Maximum path length (default: 10)",
          default: 10,
        },
        shortestOnly: {
          type: "boolean",
          description: "If true, return only shortest paths",
          default: false,
        },
        limit: {
          type: "number",
          description: "Maximum number of paths to return",
          default: 10,
        },
        database: {
          type: "string",
          description: "Database name (optional)",
        },
      },
      required: ["fromNodeId", "toNodeId"],
    },
  },
  {
    name: "get_neighbors",
    description: "Get neighboring nodes of a given node",
    inputSchema: {
      type: "object",
      properties: {
        nodeId: {
          type: "number",
          description: "Node ID to find neighbors for",
        },
        relationshipTypes: {
          type: "array",
          items: { type: "string" },
          description: "Relationship types to follow",
        },
        direction: {
          type: "string",
          enum: ["INCOMING", "OUTGOING", "BOTH"],
          description: "Direction of relationships (default: BOTH)",
          default: "BOTH",
        },
        depth: {
          type: "number",
          description: "Maximum depth to traverse (default: 1)",
          default: 1,
        },
        limit: {
          type: "number",
          description: "Maximum number of neighbors to return",
          default: 100,
        },
        database: {
          type: "string",
          description: "Database name (optional)",
        },
      },
      required: ["nodeId"],
    },
  },

  // Statistics
  {
    name: "count_nodes",
    description: "Count nodes, optionally filtered by label",
    inputSchema: {
      type: "object",
      properties: {
        label: {
          type: "string",
          description: "Node label to count (optional, counts all if not specified)",
        },
        database: {
          type: "string",
          description: "Database name (optional)",
        },
      },
    },
  },

  // Schema Introspection
  {
    name: "list_labels",
    description: "List all node labels in the database",
    inputSchema: {
      type: "object",
      properties: {
        database: {
          type: "string",
          description: "Database name (optional)",
        },
      },
    },
  },
  {
    name: "list_relationship_types",
    description: "List all relationship types in the database",
    inputSchema: {
      type: "object",
      properties: {
        database: {
          type: "string",
          description: "Database name (optional)",
        },
      },
    },
  },
  {
    name: "list_property_keys",
    description: "List all property keys used in the database",
    inputSchema: {
      type: "object",
      properties: {
        database: {
          type: "string",
          description: "Database name (optional)",
        },
      },
    },
  },
  {
    name: "get_schema",
    description: "Get the full database schema including labels, relationship types, and property keys",
    inputSchema: {
      type: "object",
      properties: {
        database: {
          type: "string",
          description: "Database name (optional)",
        },
      },
    },
  },

  // Index Management
  {
    name: "create_index",
    description: "Create an index on node properties",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Index name",
        },
        label: {
          type: "string",
          description: "Node label to index",
        },
        properties: {
          type: "array",
          items: { type: "string" },
          description: "Properties to include in the index",
        },
        indexType: {
          type: "string",
          enum: ["BTREE", "FULLTEXT", "POINT", "RANGE", "TEXT"],
          description: "Type of index (default: RANGE for Neo4j 5+, BTREE for older)",
          default: "RANGE",
        },
        database: {
          type: "string",
          description: "Database name (optional)",
        },
      },
      required: ["name", "label", "properties"],
    },
  },
  {
    name: "drop_index",
    description: "Drop an index by name",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Index name to drop",
        },
        database: {
          type: "string",
          description: "Database name (optional)",
        },
      },
      required: ["name"],
    },
  },

  // Transaction Support
  {
    name: "run_transaction",
    description: "Execute multiple queries in a single transaction",
    inputSchema: {
      type: "object",
      properties: {
        queries: {
          type: "array",
          items: {
            type: "object",
            properties: {
              cypher: { type: "string" },
              params: { type: "object" },
            },
            required: ["cypher"],
          },
          description: "Queries to execute in order within the transaction",
        },
        database: {
          type: "string",
          description: "Database name (optional)",
        },
      },
      required: ["queries"],
    },
  },
];

// Tool Implementations

async function executeQuery(params: {
  cypher: string;
  params?: Record<string, any>;
  database?: string;
}): Promise<any> {
  return runQuery(params.cypher, params.params, params.database, "WRITE");
}

async function executeReadQuery(params: {
  cypher: string;
  params?: Record<string, any>;
  database?: string;
}): Promise<any> {
  return runQuery(params.cypher, params.params, params.database, "READ");
}

async function createNode(params: {
  labels: string[];
  properties?: Record<string, any>;
  database?: string;
}): Promise<any> {
  const labelStr = params.labels.map((l) => `:${l}`).join("");
  const cypher = `CREATE (n${labelStr} $props) RETURN n, elementId(n) as elementId, id(n) as nodeId`;
  const result = await runQuery(cypher, { props: params.properties || {} }, params.database);

  if (result.records.length > 0) {
    return {
      success: true,
      node: result.records[0].n,
      nodeId: result.records[0].nodeId,
      elementId: result.records[0].elementId,
    };
  }
  return { success: false, message: "Failed to create node" };
}

async function getNode(params: {
  nodeId: number;
  database?: string;
}): Promise<any> {
  const result = await runQuery(
    "MATCH (n) WHERE id(n) = $nodeId RETURN n, labels(n) as labels, elementId(n) as elementId",
    { nodeId: neo4j.int(params.nodeId) },
    params.database,
    "READ"
  );

  if (result.records.length > 0) {
    return {
      found: true,
      node: result.records[0].n,
      labels: result.records[0].labels,
      elementId: result.records[0].elementId,
    };
  }
  return { found: false, message: `Node with ID ${params.nodeId} not found` };
}

async function updateNode(params: {
  nodeId: number;
  properties: Record<string, any>;
  replace?: boolean;
  database?: string;
}): Promise<any> {
  const operator = params.replace ? "=" : "+=";
  const cypher = `MATCH (n) WHERE id(n) = $nodeId SET n ${operator} $props RETURN n, labels(n) as labels`;
  const result = await runQuery(
    cypher,
    { nodeId: neo4j.int(params.nodeId), props: params.properties },
    params.database
  );

  if (result.records.length > 0) {
    return {
      success: true,
      node: result.records[0].n,
      labels: result.records[0].labels,
    };
  }
  return { success: false, message: `Node with ID ${params.nodeId} not found` };
}

async function deleteNode(params: {
  nodeId: number;
  detach?: boolean;
  database?: string;
}): Promise<any> {
  const cypher = params.detach
    ? "MATCH (n) WHERE id(n) = $nodeId DETACH DELETE n RETURN count(n) as deleted"
    : "MATCH (n) WHERE id(n) = $nodeId DELETE n RETURN count(n) as deleted";

  try {
    const result = await runQuery(cypher, { nodeId: neo4j.int(params.nodeId) }, params.database);
    return {
      success: true,
      nodeId: params.nodeId,
      deleted: true,
    };
  } catch (error: any) {
    if (error.message?.includes("still has relationships")) {
      return {
        success: false,
        message: "Cannot delete node with relationships. Use detach=true to delete relationships as well.",
      };
    }
    throw error;
  }
}

async function findNodes(params: {
  label?: string;
  properties?: Record<string, any>;
  limit?: number;
  skip?: number;
  orderBy?: string;
  orderDirection?: "ASC" | "DESC";
  database?: string;
}): Promise<any> {
  let cypher = params.label ? `MATCH (n:${params.label})` : "MATCH (n)";
  const queryParams: Record<string, any> = {};

  if (params.properties && Object.keys(params.properties).length > 0) {
    const conditions = Object.entries(params.properties).map(([k, v], i) => {
      queryParams[`prop${i}`] = v;
      return `n.${k} = $prop${i}`;
    });
    cypher += ` WHERE ${conditions.join(" AND ")}`;
  }

  cypher += " RETURN n, id(n) as nodeId, labels(n) as labels, elementId(n) as elementId";

  if (params.orderBy) {
    cypher += ` ORDER BY n.${params.orderBy} ${params.orderDirection || "ASC"}`;
  }

  if (params.skip) {
    cypher += ` SKIP ${params.skip}`;
  }

  cypher += ` LIMIT ${params.limit || 100}`;

  const result = await runQuery(cypher, queryParams, params.database, "READ");

  return {
    count: result.records.length,
    nodes: result.records.map((r: any) => ({
      node: r.n,
      nodeId: r.nodeId,
      labels: r.labels,
      elementId: r.elementId,
    })),
  };
}

async function createRelationship(params: {
  fromNodeId: number;
  toNodeId: number;
  type: string;
  properties?: Record<string, any>;
  database?: string;
}): Promise<any> {
  const cypher = `
    MATCH (a), (b)
    WHERE id(a) = $fromId AND id(b) = $toId
    CREATE (a)-[r:${params.type} $props]->(b)
    RETURN r, id(r) as relationshipId, elementId(r) as elementId
  `;

  const result = await runQuery(
    cypher,
    {
      fromId: neo4j.int(params.fromNodeId),
      toId: neo4j.int(params.toNodeId),
      props: params.properties || {},
    },
    params.database
  );

  if (result.records.length > 0) {
    return {
      success: true,
      relationship: result.records[0].r,
      relationshipId: result.records[0].relationshipId,
      elementId: result.records[0].elementId,
    };
  }
  return {
    success: false,
    message: "Failed to create relationship. Verify both nodes exist.",
  };
}

async function getRelationship(params: {
  relationshipId: number;
  database?: string;
}): Promise<any> {
  const cypher = `
    MATCH ()-[r]-()
    WHERE id(r) = $relId
    RETURN r, type(r) as type, startNode(r) as startNode, endNode(r) as endNode,
           id(startNode(r)) as startNodeId, id(endNode(r)) as endNodeId,
           elementId(r) as elementId
    LIMIT 1
  `;

  const result = await runQuery(
    cypher,
    { relId: neo4j.int(params.relationshipId) },
    params.database,
    "READ"
  );

  if (result.records.length > 0) {
    const record = result.records[0];
    return {
      found: true,
      relationship: record.r,
      type: record.type,
      startNode: record.startNode,
      endNode: record.endNode,
      startNodeId: record.startNodeId,
      endNodeId: record.endNodeId,
      elementId: record.elementId,
    };
  }
  return { found: false, message: `Relationship with ID ${params.relationshipId} not found` };
}

async function deleteRelationship(params: {
  relationshipId: number;
  database?: string;
}): Promise<any> {
  const cypher = "MATCH ()-[r]-() WHERE id(r) = $relId DELETE r RETURN count(r) as deleted";
  await runQuery(cypher, { relId: neo4j.int(params.relationshipId) }, params.database);

  return {
    success: true,
    relationshipId: params.relationshipId,
    deleted: true,
  };
}

async function findPaths(params: {
  fromNodeId: number;
  toNodeId: number;
  relationshipTypes?: string[];
  maxDepth?: number;
  shortestOnly?: boolean;
  limit?: number;
  database?: string;
}): Promise<any> {
  const relFilter = params.relationshipTypes?.length
    ? `:${params.relationshipTypes.join("|")}`
    : "";
  const depth = params.maxDepth || 10;
  const limit = params.limit || 10;

  let cypher: string;
  if (params.shortestOnly) {
    cypher = `
      MATCH (a), (b), p = shortestPath((a)-[${relFilter}*..${depth}]-(b))
      WHERE id(a) = $fromId AND id(b) = $toId
      RETURN p as path, length(p) as pathLength
    `;
  } else {
    cypher = `
      MATCH p = (a)-[${relFilter}*..${depth}]-(b)
      WHERE id(a) = $fromId AND id(b) = $toId
      RETURN p as path, length(p) as pathLength
      ORDER BY length(p)
      LIMIT ${limit}
    `;
  }

  const result = await runQuery(
    cypher,
    { fromId: neo4j.int(params.fromNodeId), toId: neo4j.int(params.toNodeId) },
    params.database,
    "READ"
  );

  return {
    count: result.records.length,
    paths: result.records.map((r: any) => ({
      path: r.path,
      length: r.pathLength,
    })),
  };
}

async function getNeighbors(params: {
  nodeId: number;
  relationshipTypes?: string[];
  direction?: "INCOMING" | "OUTGOING" | "BOTH";
  depth?: number;
  limit?: number;
  database?: string;
}): Promise<any> {
  const relFilter = params.relationshipTypes?.length
    ? `:${params.relationshipTypes.join("|")}`
    : "";
  const depth = params.depth || 1;
  const limit = params.limit || 100;

  let pattern: string;
  switch (params.direction) {
    case "INCOMING":
      pattern = `(n)<-[r${relFilter}*1..${depth}]-(m)`;
      break;
    case "OUTGOING":
      pattern = `(n)-[r${relFilter}*1..${depth}]->(m)`;
      break;
    default:
      pattern = `(n)-[r${relFilter}*1..${depth}]-(m)`;
  }

  const cypher = `
    MATCH ${pattern}
    WHERE id(n) = $nodeId
    RETURN DISTINCT m as neighbor, id(m) as nodeId, labels(m) as labels, elementId(m) as elementId
    LIMIT ${limit}
  `;

  const result = await runQuery(
    cypher,
    { nodeId: neo4j.int(params.nodeId) },
    params.database,
    "READ"
  );

  return {
    count: result.records.length,
    neighbors: result.records.map((r: any) => ({
      node: r.neighbor,
      nodeId: r.nodeId,
      labels: r.labels,
      elementId: r.elementId,
    })),
  };
}

async function countNodes(params: {
  label?: string;
  database?: string;
}): Promise<any> {
  const cypher = params.label
    ? `MATCH (n:${params.label}) RETURN count(n) as count`
    : "MATCH (n) RETURN count(n) as count";

  const result = await runQuery(cypher, {}, params.database, "READ");

  return {
    label: params.label || "(all)",
    count: result.records[0]?.count || 0,
  };
}

async function listLabels(params: { database?: string }): Promise<any> {
  const result = await runQuery("CALL db.labels()", {}, params.database, "READ");

  return {
    labels: result.records.map((r: any) => r.label),
    count: result.records.length,
  };
}

async function listRelationshipTypes(params: { database?: string }): Promise<any> {
  const result = await runQuery("CALL db.relationshipTypes()", {}, params.database, "READ");

  return {
    relationshipTypes: result.records.map((r: any) => r.relationshipType),
    count: result.records.length,
  };
}

async function listPropertyKeys(params: { database?: string }): Promise<any> {
  const result = await runQuery("CALL db.propertyKeys()", {}, params.database, "READ");

  return {
    propertyKeys: result.records.map((r: any) => r.propertyKey),
    count: result.records.length,
  };
}

async function getSchema(params: { database?: string }): Promise<any> {
  const [labels, relationshipTypes, propertyKeys, indexes, constraints] = await Promise.all([
    runQuery("CALL db.labels()", {}, params.database, "READ"),
    runQuery("CALL db.relationshipTypes()", {}, params.database, "READ"),
    runQuery("CALL db.propertyKeys()", {}, params.database, "READ"),
    runQuery("SHOW INDEXES", {}, params.database, "READ").catch(() => ({ records: [] })),
    runQuery("SHOW CONSTRAINTS", {}, params.database, "READ").catch(() => ({ records: [] })),
  ]);

  return {
    labels: labels.records.map((r: any) => r.label),
    relationshipTypes: relationshipTypes.records.map((r: any) => r.relationshipType),
    propertyKeys: propertyKeys.records.map((r: any) => r.propertyKey),
    indexes: indexes.records,
    constraints: constraints.records,
  };
}

async function createIndex(params: {
  name: string;
  label: string;
  properties: string[];
  indexType?: string;
  database?: string;
}): Promise<any> {
  const props = params.properties.map((p) => `n.${p}`).join(", ");
  const indexType = params.indexType || "RANGE";

  // Different syntax for different index types
  let cypher: string;
  if (indexType === "FULLTEXT") {
    cypher = `CREATE FULLTEXT INDEX ${params.name} FOR (n:${params.label}) ON EACH [${props}]`;
  } else {
    cypher = `CREATE ${indexType} INDEX ${params.name} FOR (n:${params.label}) ON (${props})`;
  }

  try {
    await runQuery(cypher, {}, params.database);
    return {
      success: true,
      name: params.name,
      label: params.label,
      properties: params.properties,
      indexType,
      created: true,
    };
  } catch (error: any) {
    // Fallback for older Neo4j versions
    if (error.message?.includes("Invalid input")) {
      cypher = `CREATE INDEX ${params.name} FOR (n:${params.label}) ON (${props})`;
      await runQuery(cypher, {}, params.database);
      return {
        success: true,
        name: params.name,
        label: params.label,
        properties: params.properties,
        created: true,
      };
    }
    throw error;
  }
}

async function dropIndex(params: {
  name: string;
  database?: string;
}): Promise<any> {
  try {
    await runQuery(`DROP INDEX ${params.name}`, {}, params.database);
    return {
      success: true,
      name: params.name,
      dropped: true,
    };
  } catch (error: any) {
    if (error.message?.includes("does not exist")) {
      return {
        success: false,
        name: params.name,
        message: `Index '${params.name}' does not exist`,
      };
    }
    throw error;
  }
}

async function runTransaction(params: {
  queries: Array<{ cypher: string; params?: Record<string, any> }>;
  database?: string;
}): Promise<any> {
  const session = getDriver().session({
    database: params.database || config.database,
  });

  const results: any[] = [];

  try {
    await session.executeWrite(async (tx: Transaction) => {
      for (const query of params.queries) {
        const result = await tx.run(query.cypher, query.params || {});
        results.push({
          records: result.records.map((r) => convertNeo4jTypes(r.toObject())),
          summary: {
            counters: result.summary.counters.updates(),
            queryType: result.summary.queryType,
          },
        });
      }
    });

    return {
      success: true,
      transactionId: `txn_${Date.now()}`,
      queriesExecuted: params.queries.length,
      results,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      message: "Transaction rolled back due to error",
    };
  } finally {
    await session.close();
  }
}

// Create MCP server
const server = new Server(
  {
    name: "neo4j-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: any;

    switch (name) {
      case "query":
        result = await executeQuery(args as any);
        break;
      case "read_query":
        result = await executeReadQuery(args as any);
        break;
      case "create_node":
        result = await createNode(args as any);
        break;
      case "get_node":
        result = await getNode(args as any);
        break;
      case "update_node":
        result = await updateNode(args as any);
        break;
      case "delete_node":
        result = await deleteNode(args as any);
        break;
      case "find_nodes":
        result = await findNodes(args as any);
        break;
      case "create_relationship":
        result = await createRelationship(args as any);
        break;
      case "get_relationship":
        result = await getRelationship(args as any);
        break;
      case "delete_relationship":
        result = await deleteRelationship(args as any);
        break;
      case "find_paths":
        result = await findPaths(args as any);
        break;
      case "get_neighbors":
        result = await getNeighbors(args as any);
        break;
      case "count_nodes":
        result = await countNodes(args as any);
        break;
      case "list_labels":
        result = await listLabels(args as any);
        break;
      case "list_relationship_types":
        result = await listRelationshipTypes(args as any);
        break;
      case "list_property_keys":
        result = await listPropertyKeys(args as any);
        break;
      case "get_schema":
        result = await getSchema(args as any);
        break;
      case "create_index":
        result = await createIndex(args as any);
        break;
      case "drop_index":
        result = await dropIndex(args as any);
        break;
      case "run_transaction":
        result = await runTransaction(args as any);
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

// Graceful shutdown
process.on("SIGINT", async () => {
  console.error("Shutting down Neo4j MCP Server...");
  if (driver) {
    await driver.close();
  }
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.error("Shutting down Neo4j MCP Server...");
  if (driver) {
    await driver.close();
  }
  process.exit(0);
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Neo4j MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Failed to start Neo4j MCP Server:", error);
  process.exit(1);
});
