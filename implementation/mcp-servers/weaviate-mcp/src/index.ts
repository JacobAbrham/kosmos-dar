/**
 * Weaviate MCP Server - Vector database for semantic search and AI applications
 * Uses Weaviate REST API for all operations
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";

const config = {
  url: process.env.WEAVIATE_URL || "http://localhost:8080",
  apiKey: process.env.WEAVIATE_API_KEY || "",
};

// Helper function for making API requests
async function weaviateRequest(
  endpoint: string,
  method: string = "GET",
  body?: any,
  isGraphQL: boolean = false
): Promise<any> {
  const url = `${config.url}${endpoint}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }

  const options: RequestInit = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Weaviate API error (${response.status}): ${errorText}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

// GraphQL helper
async function graphqlQuery(query: string, variables?: Record<string, any>): Promise<any> {
  const body: any = { query };
  if (variables) {
    body.variables = variables;
  }
  return weaviateRequest("/v1/graphql", "POST", body, true);
}

const TOOLS: Tool[] = [
  // Schema Operations
  {
    name: "list_classes",
    description: "List all classes in the Weaviate schema.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "get_class",
    description: "Get a specific class schema by name.",
    inputSchema: {
      type: "object",
      properties: {
        className: { type: "string", description: "Name of the class" }
      },
      required: ["className"]
    }
  },
  {
    name: "create_class",
    description: "Create a new class in the schema.",
    inputSchema: {
      type: "object",
      properties: {
        className: { type: "string", description: "Name of the class (PascalCase)" },
        description: { type: "string", description: "Description of the class" },
        properties: {
          type: "array",
          description: "Array of property definitions",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              dataType: { type: "array", items: { type: "string" } },
              description: { type: "string" },
              tokenization: { type: "string" },
              indexFilterable: { type: "boolean" },
              indexSearchable: { type: "boolean" }
            },
            required: ["name", "dataType"]
          }
        },
        vectorizer: { type: "string", description: "Vectorizer module (e.g., text2vec-openai)" },
        moduleConfig: { type: "object", description: "Module-specific configuration" },
        vectorIndexType: { type: "string", description: "Vector index type (hnsw, flat)" },
        vectorIndexConfig: { type: "object", description: "Vector index configuration" },
        shardingConfig: { type: "object", description: "Sharding configuration" },
        replicationConfig: { type: "object", description: "Replication configuration" },
        invertedIndexConfig: { type: "object", description: "Inverted index configuration" }
      },
      required: ["className"]
    }
  },
  {
    name: "update_class",
    description: "Update an existing class (limited to description and invertedIndexConfig).",
    inputSchema: {
      type: "object",
      properties: {
        className: { type: "string", description: "Name of the class" },
        description: { type: "string", description: "New description" },
        invertedIndexConfig: { type: "object", description: "Updated inverted index config" }
      },
      required: ["className"]
    }
  },
  {
    name: "delete_class",
    description: "Delete a class and all its objects.",
    inputSchema: {
      type: "object",
      properties: {
        className: { type: "string", description: "Name of the class to delete" }
      },
      required: ["className"]
    }
  },
  {
    name: "add_property",
    description: "Add a new property to an existing class.",
    inputSchema: {
      type: "object",
      properties: {
        className: { type: "string", description: "Name of the class" },
        property: {
          type: "object",
          description: "Property definition",
          properties: {
            name: { type: "string" },
            dataType: { type: "array", items: { type: "string" } },
            description: { type: "string" },
            tokenization: { type: "string" },
            indexFilterable: { type: "boolean" },
            indexSearchable: { type: "boolean" }
          },
          required: ["name", "dataType"]
        }
      },
      required: ["className", "property"]
    }
  },

  // Object Operations
  {
    name: "create_object",
    description: "Create a new object in a class.",
    inputSchema: {
      type: "object",
      properties: {
        className: { type: "string", description: "Class name" },
        properties: { type: "object", description: "Object properties" },
        id: { type: "string", description: "Optional UUID for the object" },
        vector: { type: "array", items: { type: "number" }, description: "Optional custom vector" },
        tenant: { type: "string", description: "Tenant name for multi-tenancy" }
      },
      required: ["className", "properties"]
    }
  },
  {
    name: "get_object",
    description: "Get an object by ID.",
    inputSchema: {
      type: "object",
      properties: {
        className: { type: "string", description: "Class name" },
        id: { type: "string", description: "Object UUID" },
        include: { type: "array", items: { type: "string" }, description: "Additional fields to include (vector, classification)" },
        tenant: { type: "string", description: "Tenant name for multi-tenancy" }
      },
      required: ["className", "id"]
    }
  },
  {
    name: "update_object",
    description: "Update an existing object (full replacement).",
    inputSchema: {
      type: "object",
      properties: {
        className: { type: "string", description: "Class name" },
        id: { type: "string", description: "Object UUID" },
        properties: { type: "object", description: "New object properties" },
        vector: { type: "array", items: { type: "number" }, description: "Optional custom vector" },
        tenant: { type: "string", description: "Tenant name for multi-tenancy" }
      },
      required: ["className", "id", "properties"]
    }
  },
  {
    name: "patch_object",
    description: "Partially update an object (merge properties).",
    inputSchema: {
      type: "object",
      properties: {
        className: { type: "string", description: "Class name" },
        id: { type: "string", description: "Object UUID" },
        properties: { type: "object", description: "Properties to merge" },
        tenant: { type: "string", description: "Tenant name for multi-tenancy" }
      },
      required: ["className", "id", "properties"]
    }
  },
  {
    name: "delete_object",
    description: "Delete an object by ID.",
    inputSchema: {
      type: "object",
      properties: {
        className: { type: "string", description: "Class name" },
        id: { type: "string", description: "Object UUID" },
        tenant: { type: "string", description: "Tenant name for multi-tenancy" }
      },
      required: ["className", "id"]
    }
  },
  {
    name: "check_object_exists",
    description: "Check if an object exists by ID.",
    inputSchema: {
      type: "object",
      properties: {
        className: { type: "string", description: "Class name" },
        id: { type: "string", description: "Object UUID" },
        tenant: { type: "string", description: "Tenant name for multi-tenancy" }
      },
      required: ["className", "id"]
    }
  },

  // Batch Operations
  {
    name: "batch_create_objects",
    description: "Create multiple objects in batch.",
    inputSchema: {
      type: "object",
      properties: {
        objects: {
          type: "array",
          description: "Array of objects to create",
          items: {
            type: "object",
            properties: {
              class: { type: "string" },
              properties: { type: "object" },
              id: { type: "string" },
              vector: { type: "array", items: { type: "number" } },
              tenant: { type: "string" }
            },
            required: ["class", "properties"]
          }
        }
      },
      required: ["objects"]
    }
  },
  {
    name: "batch_delete_objects",
    description: "Delete multiple objects matching a filter.",
    inputSchema: {
      type: "object",
      properties: {
        className: { type: "string", description: "Class name" },
        where: { type: "object", description: "Filter to match objects for deletion" },
        dryRun: { type: "boolean", description: "If true, only return count without deleting" },
        output: { type: "string", enum: ["minimal", "verbose"], description: "Output verbosity" },
        tenant: { type: "string", description: "Tenant name for multi-tenancy" }
      },
      required: ["className", "where"]
    }
  },

  // Vector Search
  {
    name: "vector_search",
    description: "Search objects using vector similarity (nearVector).",
    inputSchema: {
      type: "object",
      properties: {
        className: { type: "string", description: "Class to search" },
        vector: { type: "array", items: { type: "number" }, description: "Query vector" },
        limit: { type: "number", description: "Maximum results to return" },
        offset: { type: "number", description: "Number of results to skip" },
        certainty: { type: "number", description: "Minimum certainty (0-1)" },
        distance: { type: "number", description: "Maximum distance" },
        properties: { type: "array", items: { type: "string" }, description: "Properties to return" },
        where: { type: "object", description: "Filter conditions" },
        tenant: { type: "string", description: "Tenant name for multi-tenancy" }
      },
      required: ["className", "vector"]
    }
  },
  {
    name: "near_text_search",
    description: "Search objects using natural language text (requires text2vec module).",
    inputSchema: {
      type: "object",
      properties: {
        className: { type: "string", description: "Class to search" },
        concepts: { type: "array", items: { type: "string" }, description: "Concepts to search for" },
        limit: { type: "number", description: "Maximum results to return" },
        offset: { type: "number", description: "Number of results to skip" },
        certainty: { type: "number", description: "Minimum certainty (0-1)" },
        distance: { type: "number", description: "Maximum distance" },
        moveTo: { type: "object", description: "Move results towards these concepts" },
        moveAwayFrom: { type: "object", description: "Move results away from these concepts" },
        properties: { type: "array", items: { type: "string" }, description: "Properties to return" },
        where: { type: "object", description: "Filter conditions" },
        tenant: { type: "string", description: "Tenant name for multi-tenancy" }
      },
      required: ["className", "concepts"]
    }
  },
  {
    name: "near_object_search",
    description: "Search objects similar to another object.",
    inputSchema: {
      type: "object",
      properties: {
        className: { type: "string", description: "Class to search" },
        id: { type: "string", description: "UUID of the object to find similar objects to" },
        limit: { type: "number", description: "Maximum results to return" },
        offset: { type: "number", description: "Number of results to skip" },
        certainty: { type: "number", description: "Minimum certainty (0-1)" },
        distance: { type: "number", description: "Maximum distance" },
        properties: { type: "array", items: { type: "string" }, description: "Properties to return" },
        where: { type: "object", description: "Filter conditions" },
        tenant: { type: "string", description: "Tenant name for multi-tenancy" }
      },
      required: ["className", "id"]
    }
  },

  // Keyword/BM25 Search
  {
    name: "bm25_search",
    description: "Search objects using BM25 keyword search.",
    inputSchema: {
      type: "object",
      properties: {
        className: { type: "string", description: "Class to search" },
        query: { type: "string", description: "Search query" },
        properties: { type: "array", items: { type: "string" }, description: "Properties to search in" },
        limit: { type: "number", description: "Maximum results to return" },
        offset: { type: "number", description: "Number of results to skip" },
        returnProperties: { type: "array", items: { type: "string" }, description: "Properties to return" },
        where: { type: "object", description: "Filter conditions" },
        tenant: { type: "string", description: "Tenant name for multi-tenancy" }
      },
      required: ["className", "query"]
    }
  },

  // Hybrid Search
  {
    name: "hybrid_search",
    description: "Search using both vector and keyword (BM25) search combined.",
    inputSchema: {
      type: "object",
      properties: {
        className: { type: "string", description: "Class to search" },
        query: { type: "string", description: "Search query" },
        alpha: { type: "number", description: "Weight of vector vs keyword (0=keyword, 1=vector)" },
        vector: { type: "array", items: { type: "number" }, description: "Optional custom vector" },
        fusionType: { type: "string", enum: ["rankedFusion", "relativeScoreFusion"], description: "Fusion algorithm" },
        properties: { type: "array", items: { type: "string" }, description: "Properties to search in" },
        limit: { type: "number", description: "Maximum results to return" },
        offset: { type: "number", description: "Number of results to skip" },
        returnProperties: { type: "array", items: { type: "string" }, description: "Properties to return" },
        where: { type: "object", description: "Filter conditions" },
        tenant: { type: "string", description: "Tenant name for multi-tenancy" }
      },
      required: ["className", "query"]
    }
  },

  // Filters
  {
    name: "filter_objects",
    description: "Get objects matching filter conditions without semantic search.",
    inputSchema: {
      type: "object",
      properties: {
        className: { type: "string", description: "Class to query" },
        where: {
          type: "object",
          description: "Filter object with path, operator, and value(s). Operators: Equal, NotEqual, GreaterThan, LessThan, Like, WithinGeoRange, IsNull, ContainsAny, ContainsAll, And, Or"
        },
        limit: { type: "number", description: "Maximum results to return" },
        offset: { type: "number", description: "Number of results to skip" },
        properties: { type: "array", items: { type: "string" }, description: "Properties to return" },
        sort: {
          type: "array",
          description: "Sort configuration",
          items: {
            type: "object",
            properties: {
              path: { type: "array", items: { type: "string" } },
              order: { type: "string", enum: ["asc", "desc"] }
            }
          }
        },
        tenant: { type: "string", description: "Tenant name for multi-tenancy" }
      },
      required: ["className", "where"]
    }
  },
  {
    name: "aggregate",
    description: "Aggregate data from a class.",
    inputSchema: {
      type: "object",
      properties: {
        className: { type: "string", description: "Class to aggregate" },
        fields: { type: "array", items: { type: "string" }, description: "Fields to aggregate (e.g., 'meta { count }', 'propertyName { count minimum maximum }')" },
        where: { type: "object", description: "Filter conditions" },
        groupBy: { type: "array", items: { type: "string" }, description: "Properties to group by" },
        objectLimit: { type: "number", description: "Limit objects to aggregate" },
        nearText: { type: "object", description: "Near text filter for aggregation" },
        nearVector: { type: "object", description: "Near vector filter for aggregation" },
        tenant: { type: "string", description: "Tenant name for multi-tenancy" }
      },
      required: ["className"]
    }
  },

  // References
  {
    name: "add_reference",
    description: "Add a cross-reference from one object to another.",
    inputSchema: {
      type: "object",
      properties: {
        fromClassName: { type: "string", description: "Source class name" },
        fromId: { type: "string", description: "Source object UUID" },
        fromPropertyName: { type: "string", description: "Reference property name" },
        toClassName: { type: "string", description: "Target class name" },
        toId: { type: "string", description: "Target object UUID" },
        tenant: { type: "string", description: "Tenant name for multi-tenancy" }
      },
      required: ["fromClassName", "fromId", "fromPropertyName", "toClassName", "toId"]
    }
  },
  {
    name: "delete_reference",
    description: "Delete a cross-reference from one object to another.",
    inputSchema: {
      type: "object",
      properties: {
        fromClassName: { type: "string", description: "Source class name" },
        fromId: { type: "string", description: "Source object UUID" },
        fromPropertyName: { type: "string", description: "Reference property name" },
        toClassName: { type: "string", description: "Target class name" },
        toId: { type: "string", description: "Target object UUID" },
        tenant: { type: "string", description: "Tenant name for multi-tenancy" }
      },
      required: ["fromClassName", "fromId", "fromPropertyName", "toClassName", "toId"]
    }
  },
  {
    name: "update_references",
    description: "Replace all references for a property with new ones.",
    inputSchema: {
      type: "object",
      properties: {
        fromClassName: { type: "string", description: "Source class name" },
        fromId: { type: "string", description: "Source object UUID" },
        fromPropertyName: { type: "string", description: "Reference property name" },
        references: {
          type: "array",
          description: "Array of new references",
          items: {
            type: "object",
            properties: {
              beacon: { type: "string", description: "Weaviate beacon URI" }
            },
            required: ["beacon"]
          }
        },
        tenant: { type: "string", description: "Tenant name for multi-tenancy" }
      },
      required: ["fromClassName", "fromId", "fromPropertyName", "references"]
    }
  },

  // Backups
  {
    name: "create_backup",
    description: "Create a backup of specified classes.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Backup ID" },
        backend: { type: "string", description: "Storage backend (filesystem, s3, gcs, azure)" },
        include: { type: "array", items: { type: "string" }, description: "Classes to include (all if empty)" },
        exclude: { type: "array", items: { type: "string" }, description: "Classes to exclude" }
      },
      required: ["id", "backend"]
    }
  },
  {
    name: "get_backup_status",
    description: "Get the status of a backup operation.",
    inputSchema: {
      type: "object",
      properties: {
        backend: { type: "string", description: "Storage backend" },
        id: { type: "string", description: "Backup ID" }
      },
      required: ["backend", "id"]
    }
  },
  {
    name: "restore_backup",
    description: "Restore a backup.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Backup ID" },
        backend: { type: "string", description: "Storage backend" },
        include: { type: "array", items: { type: "string" }, description: "Classes to include" },
        exclude: { type: "array", items: { type: "string" }, description: "Classes to exclude" }
      },
      required: ["id", "backend"]
    }
  },
  {
    name: "list_backups",
    description: "List all backups for a backend.",
    inputSchema: {
      type: "object",
      properties: {
        backend: { type: "string", description: "Storage backend" }
      },
      required: ["backend"]
    }
  },

  // Cluster Operations
  {
    name: "cluster_status",
    description: "Get the cluster status and node information.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "get_meta",
    description: "Get Weaviate instance metadata including version and modules.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "check_ready",
    description: "Check if the Weaviate instance is ready to accept requests.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "check_live",
    description: "Check if the Weaviate instance is alive.",
    inputSchema: { type: "object", properties: {} }
  },

  // Tenants (Multi-tenancy)
  {
    name: "list_tenants",
    description: "List all tenants for a multi-tenant class.",
    inputSchema: {
      type: "object",
      properties: {
        className: { type: "string", description: "Class name" }
      },
      required: ["className"]
    }
  },
  {
    name: "create_tenants",
    description: "Create tenants for a multi-tenant class.",
    inputSchema: {
      type: "object",
      properties: {
        className: { type: "string", description: "Class name" },
        tenants: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              activityStatus: { type: "string", enum: ["HOT", "COLD", "FROZEN"] }
            },
            required: ["name"]
          }
        }
      },
      required: ["className", "tenants"]
    }
  },
  {
    name: "delete_tenants",
    description: "Delete tenants from a multi-tenant class.",
    inputSchema: {
      type: "object",
      properties: {
        className: { type: "string", description: "Class name" },
        tenants: { type: "array", items: { type: "string" }, description: "Tenant names to delete" }
      },
      required: ["className", "tenants"]
    }
  },
  {
    name: "update_tenants",
    description: "Update tenant activity status.",
    inputSchema: {
      type: "object",
      properties: {
        className: { type: "string", description: "Class name" },
        tenants: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              activityStatus: { type: "string", enum: ["HOT", "COLD", "FROZEN"] }
            },
            required: ["name", "activityStatus"]
          }
        }
      },
      required: ["className", "tenants"]
    }
  }
];

// Implementation functions

// Schema Operations
async function listClasses(): Promise<any> {
  const schema = await weaviateRequest("/v1/schema");
  return {
    classes: schema.classes?.map((c: any) => ({
      name: c.class,
      description: c.description,
      vectorizer: c.vectorizer,
      properties: c.properties?.length || 0
    })) || []
  };
}

async function getClass(params: { className: string }): Promise<any> {
  return weaviateRequest(`/v1/schema/${params.className}`);
}

async function createClass(params: any): Promise<any> {
  const classObj: any = {
    class: params.className,
  };

  if (params.description) classObj.description = params.description;
  if (params.properties) classObj.properties = params.properties;
  if (params.vectorizer) classObj.vectorizer = params.vectorizer;
  if (params.moduleConfig) classObj.moduleConfig = params.moduleConfig;
  if (params.vectorIndexType) classObj.vectorIndexType = params.vectorIndexType;
  if (params.vectorIndexConfig) classObj.vectorIndexConfig = params.vectorIndexConfig;
  if (params.shardingConfig) classObj.shardingConfig = params.shardingConfig;
  if (params.replicationConfig) classObj.replicationConfig = params.replicationConfig;
  if (params.invertedIndexConfig) classObj.invertedIndexConfig = params.invertedIndexConfig;

  await weaviateRequest("/v1/schema", "POST", classObj);
  return { className: params.className, created: true };
}

async function updateClass(params: { className: string; description?: string; invertedIndexConfig?: any }): Promise<any> {
  const updates: any = {};
  if (params.description) updates.description = params.description;
  if (params.invertedIndexConfig) updates.invertedIndexConfig = params.invertedIndexConfig;

  await weaviateRequest(`/v1/schema/${params.className}`, "PUT", updates);
  return { className: params.className, updated: true };
}

async function deleteClass(params: { className: string }): Promise<any> {
  await weaviateRequest(`/v1/schema/${params.className}`, "DELETE");
  return { className: params.className, deleted: true };
}

async function addProperty(params: { className: string; property: any }): Promise<any> {
  await weaviateRequest(`/v1/schema/${params.className}/properties`, "POST", params.property);
  return { className: params.className, property: params.property.name, added: true };
}

// Object Operations
async function createObject(params: any): Promise<any> {
  const obj: any = {
    class: params.className,
    properties: params.properties,
  };
  if (params.id) obj.id = params.id;
  if (params.vector) obj.vector = params.vector;
  if (params.tenant) obj.tenant = params.tenant;

  const result = await weaviateRequest("/v1/objects", "POST", obj);
  return { id: result.id, className: params.className, created: true };
}

async function getObject(params: { className: string; id: string; include?: string[]; tenant?: string }): Promise<any> {
  let url = `/v1/objects/${params.className}/${params.id}`;
  const queryParams: string[] = [];
  if (params.include?.length) queryParams.push(`include=${params.include.join(",")}`);
  if (params.tenant) queryParams.push(`tenant=${params.tenant}`);
  if (queryParams.length) url += `?${queryParams.join("&")}`;

  return weaviateRequest(url);
}

async function updateObject(params: any): Promise<any> {
  const obj: any = {
    class: params.className,
    properties: params.properties,
  };
  if (params.vector) obj.vector = params.vector;

  let url = `/v1/objects/${params.className}/${params.id}`;
  if (params.tenant) url += `?tenant=${params.tenant}`;

  await weaviateRequest(url, "PUT", obj);
  return { id: params.id, className: params.className, updated: true };
}

async function patchObject(params: any): Promise<any> {
  const obj: any = {
    class: params.className,
    properties: params.properties,
  };

  let url = `/v1/objects/${params.className}/${params.id}`;
  if (params.tenant) url += `?tenant=${params.tenant}`;

  await weaviateRequest(url, "PATCH", obj);
  return { id: params.id, className: params.className, patched: true };
}

async function deleteObject(params: { className: string; id: string; tenant?: string }): Promise<any> {
  let url = `/v1/objects/${params.className}/${params.id}`;
  if (params.tenant) url += `?tenant=${params.tenant}`;

  await weaviateRequest(url, "DELETE");
  return { id: params.id, className: params.className, deleted: true };
}

async function checkObjectExists(params: { className: string; id: string; tenant?: string }): Promise<any> {
  let url = `/v1/objects/${params.className}/${params.id}`;
  if (params.tenant) url += `?tenant=${params.tenant}`;

  try {
    const response = await fetch(`${config.url}${url}`, {
      method: "HEAD",
      headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {},
    });
    return { id: params.id, exists: response.ok };
  } catch {
    return { id: params.id, exists: false };
  }
}

// Batch Operations
async function batchCreateObjects(params: { objects: any[] }): Promise<any> {
  const result = await weaviateRequest("/v1/batch/objects", "POST", { objects: params.objects });
  return {
    created: result.length,
    results: result.map((r: any) => ({
      id: r.id,
      status: r.result?.status || "SUCCESS",
      errors: r.result?.errors
    }))
  };
}

async function batchDeleteObjects(params: any): Promise<any> {
  const body: any = {
    match: {
      class: params.className,
      where: params.where,
    },
  };
  if (params.dryRun) body.dryRun = params.dryRun;
  if (params.output) body.output = params.output;

  let url = "/v1/batch/objects";
  if (params.tenant) url += `?tenant=${params.tenant}`;

  return weaviateRequest(url, "DELETE", body);
}

// Search Operations
async function vectorSearch(params: any): Promise<any> {
  const nearVector: any = { vector: params.vector };
  if (params.certainty !== undefined) nearVector.certainty = params.certainty;
  if (params.distance !== undefined) nearVector.distance = params.distance;

  const properties = params.properties?.join(" ") || "_additional { id }";

  let whereClause = "";
  if (params.where) {
    whereClause = `, where: ${JSON.stringify(params.where).replace(/"([^"]+)":/g, "$1:")}`;
  }

  let tenantClause = "";
  if (params.tenant) {
    tenantClause = `, tenant: "${params.tenant}"`;
  }

  const query = `{
    Get {
      ${params.className}(
        nearVector: ${JSON.stringify(nearVector).replace(/"([^"]+)":/g, "$1:")}
        limit: ${params.limit || 10}
        ${params.offset ? `offset: ${params.offset}` : ""}
        ${whereClause}
        ${tenantClause}
      ) {
        ${properties}
        _additional { id distance certainty }
      }
    }
  }`;

  const result = await graphqlQuery(query);
  return result.data?.Get?.[params.className] || [];
}

async function nearTextSearch(params: any): Promise<any> {
  const nearText: any = { concepts: params.concepts };
  if (params.certainty !== undefined) nearText.certainty = params.certainty;
  if (params.distance !== undefined) nearText.distance = params.distance;
  if (params.moveTo) nearText.moveTo = params.moveTo;
  if (params.moveAwayFrom) nearText.moveAwayFrom = params.moveAwayFrom;

  const properties = params.properties?.join(" ") || "_additional { id }";

  let whereClause = "";
  if (params.where) {
    whereClause = `, where: ${JSON.stringify(params.where).replace(/"([^"]+)":/g, "$1:")}`;
  }

  let tenantClause = "";
  if (params.tenant) {
    tenantClause = `, tenant: "${params.tenant}"`;
  }

  const query = `{
    Get {
      ${params.className}(
        nearText: ${JSON.stringify(nearText).replace(/"([^"]+)":/g, "$1:")}
        limit: ${params.limit || 10}
        ${params.offset ? `offset: ${params.offset}` : ""}
        ${whereClause}
        ${tenantClause}
      ) {
        ${properties}
        _additional { id distance certainty }
      }
    }
  }`;

  const result = await graphqlQuery(query);
  return result.data?.Get?.[params.className] || [];
}

async function nearObjectSearch(params: any): Promise<any> {
  const nearObject: any = { id: params.id };
  if (params.certainty !== undefined) nearObject.certainty = params.certainty;
  if (params.distance !== undefined) nearObject.distance = params.distance;

  const properties = params.properties?.join(" ") || "_additional { id }";

  let whereClause = "";
  if (params.where) {
    whereClause = `, where: ${JSON.stringify(params.where).replace(/"([^"]+)":/g, "$1:")}`;
  }

  let tenantClause = "";
  if (params.tenant) {
    tenantClause = `, tenant: "${params.tenant}"`;
  }

  const query = `{
    Get {
      ${params.className}(
        nearObject: ${JSON.stringify(nearObject).replace(/"([^"]+)":/g, "$1:")}
        limit: ${params.limit || 10}
        ${params.offset ? `offset: ${params.offset}` : ""}
        ${whereClause}
        ${tenantClause}
      ) {
        ${properties}
        _additional { id distance certainty }
      }
    }
  }`;

  const result = await graphqlQuery(query);
  return result.data?.Get?.[params.className] || [];
}

async function bm25Search(params: any): Promise<any> {
  const bm25: any = { query: params.query };
  if (params.properties?.length) bm25.properties = params.properties;

  const returnProperties = params.returnProperties?.join(" ") || "_additional { id }";

  let whereClause = "";
  if (params.where) {
    whereClause = `, where: ${JSON.stringify(params.where).replace(/"([^"]+)":/g, "$1:")}`;
  }

  let tenantClause = "";
  if (params.tenant) {
    tenantClause = `, tenant: "${params.tenant}"`;
  }

  const query = `{
    Get {
      ${params.className}(
        bm25: ${JSON.stringify(bm25).replace(/"([^"]+)":/g, "$1:")}
        limit: ${params.limit || 10}
        ${params.offset ? `offset: ${params.offset}` : ""}
        ${whereClause}
        ${tenantClause}
      ) {
        ${returnProperties}
        _additional { id score }
      }
    }
  }`;

  const result = await graphqlQuery(query);
  return result.data?.Get?.[params.className] || [];
}

async function hybridSearch(params: any): Promise<any> {
  const hybrid: any = { query: params.query };
  if (params.alpha !== undefined) hybrid.alpha = params.alpha;
  if (params.vector) hybrid.vector = params.vector;
  if (params.fusionType) hybrid.fusionType = params.fusionType;
  if (params.properties?.length) hybrid.properties = params.properties;

  const returnProperties = params.returnProperties?.join(" ") || "_additional { id }";

  let whereClause = "";
  if (params.where) {
    whereClause = `, where: ${JSON.stringify(params.where).replace(/"([^"]+)":/g, "$1:")}`;
  }

  let tenantClause = "";
  if (params.tenant) {
    tenantClause = `, tenant: "${params.tenant}"`;
  }

  const query = `{
    Get {
      ${params.className}(
        hybrid: ${JSON.stringify(hybrid).replace(/"([^"]+)":/g, "$1:")}
        limit: ${params.limit || 10}
        ${params.offset ? `offset: ${params.offset}` : ""}
        ${whereClause}
        ${tenantClause}
      ) {
        ${returnProperties}
        _additional { id score }
      }
    }
  }`;

  const result = await graphqlQuery(query);
  return result.data?.Get?.[params.className] || [];
}

async function filterObjects(params: any): Promise<any> {
  const properties = params.properties?.join(" ") || "_additional { id }";

  let sortClause = "";
  if (params.sort?.length) {
    const sorts = params.sort.map((s: any) => `{ path: ${JSON.stringify(s.path)}, order: ${s.order} }`).join(", ");
    sortClause = `, sort: [${sorts}]`;
  }

  let tenantClause = "";
  if (params.tenant) {
    tenantClause = `, tenant: "${params.tenant}"`;
  }

  const query = `{
    Get {
      ${params.className}(
        where: ${JSON.stringify(params.where).replace(/"([^"]+)":/g, "$1:")}
        limit: ${params.limit || 100}
        ${params.offset ? `offset: ${params.offset}` : ""}
        ${sortClause}
        ${tenantClause}
      ) {
        ${properties}
        _additional { id }
      }
    }
  }`;

  const result = await graphqlQuery(query);
  return result.data?.Get?.[params.className] || [];
}

async function aggregate(params: any): Promise<any> {
  const fields = params.fields?.join(" ") || "meta { count }";

  let groupByClause = "";
  if (params.groupBy?.length) {
    groupByClause = `, groupBy: ${JSON.stringify(params.groupBy)}`;
  }

  let whereClause = "";
  if (params.where) {
    whereClause = `, where: ${JSON.stringify(params.where).replace(/"([^"]+)":/g, "$1:")}`;
  }

  let nearTextClause = "";
  if (params.nearText) {
    nearTextClause = `, nearText: ${JSON.stringify(params.nearText).replace(/"([^"]+)":/g, "$1:")}`;
  }

  let nearVectorClause = "";
  if (params.nearVector) {
    nearVectorClause = `, nearVector: ${JSON.stringify(params.nearVector).replace(/"([^"]+)":/g, "$1:")}`;
  }

  let tenantClause = "";
  if (params.tenant) {
    tenantClause = `, tenant: "${params.tenant}"`;
  }

  const query = `{
    Aggregate {
      ${params.className}(
        ${whereClause}
        ${groupByClause}
        ${params.objectLimit ? `objectLimit: ${params.objectLimit}` : ""}
        ${nearTextClause}
        ${nearVectorClause}
        ${tenantClause}
      ) {
        ${fields}
      }
    }
  }`;

  const result = await graphqlQuery(query);
  return result.data?.Aggregate?.[params.className] || [];
}

// Reference Operations
async function addReference(params: any): Promise<any> {
  const beacon = `weaviate://localhost/${params.toClassName}/${params.toId}`;
  let url = `/v1/objects/${params.fromClassName}/${params.fromId}/references/${params.fromPropertyName}`;
  if (params.tenant) url += `?tenant=${params.tenant}`;

  await weaviateRequest(url, "POST", { beacon });
  return { from: params.fromId, to: params.toId, property: params.fromPropertyName, added: true };
}

async function deleteReference(params: any): Promise<any> {
  const beacon = `weaviate://localhost/${params.toClassName}/${params.toId}`;
  let url = `/v1/objects/${params.fromClassName}/${params.fromId}/references/${params.fromPropertyName}`;
  if (params.tenant) url += `?tenant=${params.tenant}`;

  await weaviateRequest(url, "DELETE", { beacon });
  return { from: params.fromId, to: params.toId, property: params.fromPropertyName, deleted: true };
}

async function updateReferences(params: any): Promise<any> {
  let url = `/v1/objects/${params.fromClassName}/${params.fromId}/references/${params.fromPropertyName}`;
  if (params.tenant) url += `?tenant=${params.tenant}`;

  await weaviateRequest(url, "PUT", params.references);
  return { from: params.fromId, property: params.fromPropertyName, updated: true, count: params.references.length };
}

// Backup Operations
async function createBackup(params: any): Promise<any> {
  const body: any = { id: params.id };
  if (params.include) body.include = params.include;
  if (params.exclude) body.exclude = params.exclude;

  return weaviateRequest(`/v1/backups/${params.backend}`, "POST", body);
}

async function getBackupStatus(params: { backend: string; id: string }): Promise<any> {
  return weaviateRequest(`/v1/backups/${params.backend}/${params.id}`);
}

async function restoreBackup(params: any): Promise<any> {
  const body: any = {};
  if (params.include) body.include = params.include;
  if (params.exclude) body.exclude = params.exclude;

  return weaviateRequest(`/v1/backups/${params.backend}/${params.id}/restore`, "POST", body);
}

async function listBackups(params: { backend: string }): Promise<any> {
  return weaviateRequest(`/v1/backups/${params.backend}`);
}

// Cluster Operations
async function clusterStatus(): Promise<any> {
  return weaviateRequest("/v1/nodes");
}

async function getMeta(): Promise<any> {
  return weaviateRequest("/v1/meta");
}

async function checkReady(): Promise<any> {
  try {
    await weaviateRequest("/.well-known/ready");
    return { ready: true };
  } catch (error: any) {
    return { ready: false, error: error.message };
  }
}

async function checkLive(): Promise<any> {
  try {
    await weaviateRequest("/.well-known/live");
    return { live: true };
  } catch (error: any) {
    return { live: false, error: error.message };
  }
}

// Tenant Operations
async function listTenants(params: { className: string }): Promise<any> {
  return weaviateRequest(`/v1/schema/${params.className}/tenants`);
}

async function createTenants(params: { className: string; tenants: any[] }): Promise<any> {
  await weaviateRequest(`/v1/schema/${params.className}/tenants`, "POST", params.tenants);
  return { className: params.className, tenantsCreated: params.tenants.length };
}

async function deleteTenants(params: { className: string; tenants: string[] }): Promise<any> {
  await weaviateRequest(`/v1/schema/${params.className}/tenants`, "DELETE", params.tenants);
  return { className: params.className, tenantsDeleted: params.tenants.length };
}

async function updateTenants(params: { className: string; tenants: any[] }): Promise<any> {
  await weaviateRequest(`/v1/schema/${params.className}/tenants`, "PUT", params.tenants);
  return { className: params.className, tenantsUpdated: params.tenants.length };
}

// Server setup
const server = new Server(
  { name: "weaviate-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result: any;
    switch (name) {
      // Schema Operations
      case "list_classes": result = await listClasses(); break;
      case "get_class": result = await getClass(args as any); break;
      case "create_class": result = await createClass(args as any); break;
      case "update_class": result = await updateClass(args as any); break;
      case "delete_class": result = await deleteClass(args as any); break;
      case "add_property": result = await addProperty(args as any); break;

      // Object Operations
      case "create_object": result = await createObject(args as any); break;
      case "get_object": result = await getObject(args as any); break;
      case "update_object": result = await updateObject(args as any); break;
      case "patch_object": result = await patchObject(args as any); break;
      case "delete_object": result = await deleteObject(args as any); break;
      case "check_object_exists": result = await checkObjectExists(args as any); break;

      // Batch Operations
      case "batch_create_objects": result = await batchCreateObjects(args as any); break;
      case "batch_delete_objects": result = await batchDeleteObjects(args as any); break;

      // Search Operations
      case "vector_search": result = await vectorSearch(args as any); break;
      case "near_text_search": result = await nearTextSearch(args as any); break;
      case "near_object_search": result = await nearObjectSearch(args as any); break;
      case "bm25_search": result = await bm25Search(args as any); break;
      case "hybrid_search": result = await hybridSearch(args as any); break;
      case "filter_objects": result = await filterObjects(args as any); break;
      case "aggregate": result = await aggregate(args as any); break;

      // Reference Operations
      case "add_reference": result = await addReference(args as any); break;
      case "delete_reference": result = await deleteReference(args as any); break;
      case "update_references": result = await updateReferences(args as any); break;

      // Backup Operations
      case "create_backup": result = await createBackup(args as any); break;
      case "get_backup_status": result = await getBackupStatus(args as any); break;
      case "restore_backup": result = await restoreBackup(args as any); break;
      case "list_backups": result = await listBackups(args as any); break;

      // Cluster Operations
      case "cluster_status": result = await clusterStatus(); break;
      case "get_meta": result = await getMeta(); break;
      case "check_ready": result = await checkReady(); break;
      case "check_live": result = await checkLive(); break;

      // Tenant Operations
      case "list_tenants": result = await listTenants(args as any); break;
      case "create_tenants": result = await createTenants(args as any); break;
      case "delete_tenants": result = await deleteTenants(args as any); break;
      case "update_tenants": result = await updateTenants(args as any); break;

      default: throw new Error(`Unknown tool: ${name}`);
    }
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (error: any) {
    return { content: [{ type: "text", text: JSON.stringify({ error: error.message }) }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Weaviate MCP Server running on stdio");
}

main().catch(console.error);
