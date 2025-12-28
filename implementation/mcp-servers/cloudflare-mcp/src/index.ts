/**
 * Cloudflare MCP Server - Cloudflare platform integration for KOSMOS
 * Provides access to Workers, KV, R2, DNS, Pages, D1, Queues, and Analytics
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";

const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || "";
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || "";
const BASE_URL = "https://api.cloudflare.com/client/v4";

async function cfRequest(path: string, options: RequestInit = {}): Promise<any> {
  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Authorization": `Bearer ${API_TOKEN}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const data = await response.json();
  if (!data.success && data.errors?.length) {
    throw new Error(data.errors.map((e: any) => e.message).join(", "));
  }
  return data;
}

const TOOLS: Tool[] = [
  // Workers
  { name: "workers_list", description: "List all Workers scripts.", inputSchema: { type: "object", properties: {} } },
  { name: "workers_get", description: "Get a Worker script details.", inputSchema: { type: "object", properties: { scriptName: { type: "string", description: "Worker script name" } }, required: ["scriptName"] } },
  { name: "workers_create", description: "Create/update a Worker script.", inputSchema: { type: "object", properties: { scriptName: { type: "string", description: "Worker script name" }, script: { type: "string", description: "Worker script content (JavaScript/TypeScript)" }, bindings: { type: "array", description: "Optional bindings configuration" } }, required: ["scriptName", "script"] } },
  { name: "workers_delete", description: "Delete a Worker script.", inputSchema: { type: "object", properties: { scriptName: { type: "string", description: "Worker script name" } }, required: ["scriptName"] } },
  { name: "workers_deploy", description: "Deploy a Worker to production.", inputSchema: { type: "object", properties: { scriptName: { type: "string", description: "Worker script name" }, routes: { type: "array", items: { type: "string" }, description: "Routes to deploy to" } }, required: ["scriptName"] } },

  // KV Namespaces
  { name: "kv_list_namespaces", description: "List all KV namespaces.", inputSchema: { type: "object", properties: {} } },
  { name: "kv_create_namespace", description: "Create a KV namespace.", inputSchema: { type: "object", properties: { title: { type: "string", description: "Namespace title" } }, required: ["title"] } },
  { name: "kv_delete_namespace", description: "Delete a KV namespace.", inputSchema: { type: "object", properties: { namespaceId: { type: "string", description: "Namespace ID" } }, required: ["namespaceId"] } },
  { name: "kv_list_keys", description: "List keys in a KV namespace.", inputSchema: { type: "object", properties: { namespaceId: { type: "string", description: "Namespace ID" }, prefix: { type: "string", description: "Key prefix filter" }, limit: { type: "number", description: "Max keys to return" }, cursor: { type: "string", description: "Pagination cursor" } }, required: ["namespaceId"] } },
  { name: "kv_read", description: "Read a value from KV.", inputSchema: { type: "object", properties: { namespaceId: { type: "string", description: "Namespace ID" }, key: { type: "string", description: "Key to read" } }, required: ["namespaceId", "key"] } },
  { name: "kv_write", description: "Write a value to KV.", inputSchema: { type: "object", properties: { namespaceId: { type: "string", description: "Namespace ID" }, key: { type: "string", description: "Key to write" }, value: { type: "string", description: "Value to store" }, expirationTtl: { type: "number", description: "TTL in seconds" }, metadata: { type: "object", description: "Optional metadata" } }, required: ["namespaceId", "key", "value"] } },
  { name: "kv_delete", description: "Delete a key from KV.", inputSchema: { type: "object", properties: { namespaceId: { type: "string", description: "Namespace ID" }, key: { type: "string", description: "Key to delete" } }, required: ["namespaceId", "key"] } },

  // R2 Storage
  { name: "r2_list_buckets", description: "List all R2 buckets.", inputSchema: { type: "object", properties: {} } },
  { name: "r2_create_bucket", description: "Create an R2 bucket.", inputSchema: { type: "object", properties: { name: { type: "string", description: "Bucket name" }, locationHint: { type: "string", description: "Location hint (e.g., 'wnam', 'enam', 'weur', 'eeur', 'apac')" } }, required: ["name"] } },
  { name: "r2_delete_bucket", description: "Delete an R2 bucket.", inputSchema: { type: "object", properties: { name: { type: "string", description: "Bucket name" } }, required: ["name"] } },
  { name: "r2_list_objects", description: "List objects in an R2 bucket.", inputSchema: { type: "object", properties: { bucket: { type: "string", description: "Bucket name" }, prefix: { type: "string", description: "Object prefix filter" }, delimiter: { type: "string", description: "Delimiter for hierarchy" }, limit: { type: "number", description: "Max objects to return" }, cursor: { type: "string", description: "Pagination cursor" } }, required: ["bucket"] } },
  { name: "r2_get_object", description: "Get object metadata from R2.", inputSchema: { type: "object", properties: { bucket: { type: "string", description: "Bucket name" }, key: { type: "string", description: "Object key" } }, required: ["bucket", "key"] } },
  { name: "r2_put_object", description: "Upload an object to R2.", inputSchema: { type: "object", properties: { bucket: { type: "string", description: "Bucket name" }, key: { type: "string", description: "Object key" }, body: { type: "string", description: "Object content" }, contentType: { type: "string", description: "Content-Type header" } }, required: ["bucket", "key", "body"] } },
  { name: "r2_delete_object", description: "Delete an object from R2.", inputSchema: { type: "object", properties: { bucket: { type: "string", description: "Bucket name" }, key: { type: "string", description: "Object key" } }, required: ["bucket", "key"] } },

  // DNS Zones
  { name: "dns_list_zones", description: "List all DNS zones.", inputSchema: { type: "object", properties: { name: { type: "string", description: "Zone name filter" }, status: { type: "string", description: "Zone status filter" }, page: { type: "number", description: "Page number" }, perPage: { type: "number", description: "Results per page" } } } },
  { name: "dns_get_zone", description: "Get DNS zone details.", inputSchema: { type: "object", properties: { zoneId: { type: "string", description: "Zone ID" } }, required: ["zoneId"] } },
  { name: "dns_create_zone", description: "Create a DNS zone.", inputSchema: { type: "object", properties: { name: { type: "string", description: "Domain name" }, type: { type: "string", enum: ["full", "partial", "secondary"], description: "Zone type" }, jumpStart: { type: "boolean", description: "Fetch existing DNS records" } }, required: ["name"] } },
  { name: "dns_delete_zone", description: "Delete a DNS zone.", inputSchema: { type: "object", properties: { zoneId: { type: "string", description: "Zone ID" } }, required: ["zoneId"] } },
  { name: "dns_list_records", description: "List DNS records in a zone.", inputSchema: { type: "object", properties: { zoneId: { type: "string", description: "Zone ID" }, type: { type: "string", description: "Record type filter (A, AAAA, CNAME, etc.)" }, name: { type: "string", description: "Record name filter" }, page: { type: "number" }, perPage: { type: "number" } }, required: ["zoneId"] } },
  { name: "dns_create_record", description: "Create a DNS record.", inputSchema: { type: "object", properties: { zoneId: { type: "string", description: "Zone ID" }, type: { type: "string", description: "Record type (A, AAAA, CNAME, MX, TXT, etc.)" }, name: { type: "string", description: "Record name" }, content: { type: "string", description: "Record content" }, ttl: { type: "number", description: "TTL in seconds (1 = auto)" }, priority: { type: "number", description: "Priority (for MX, SRV)" }, proxied: { type: "boolean", description: "Whether to proxy through Cloudflare" } }, required: ["zoneId", "type", "name", "content"] } },
  { name: "dns_update_record", description: "Update a DNS record.", inputSchema: { type: "object", properties: { zoneId: { type: "string", description: "Zone ID" }, recordId: { type: "string", description: "Record ID" }, type: { type: "string", description: "Record type" }, name: { type: "string", description: "Record name" }, content: { type: "string", description: "Record content" }, ttl: { type: "number" }, proxied: { type: "boolean" } }, required: ["zoneId", "recordId", "type", "name", "content"] } },
  { name: "dns_delete_record", description: "Delete a DNS record.", inputSchema: { type: "object", properties: { zoneId: { type: "string", description: "Zone ID" }, recordId: { type: "string", description: "Record ID" } }, required: ["zoneId", "recordId"] } },

  // Pages Projects
  { name: "pages_list_projects", description: "List all Pages projects.", inputSchema: { type: "object", properties: {} } },
  { name: "pages_get_project", description: "Get a Pages project.", inputSchema: { type: "object", properties: { projectName: { type: "string", description: "Project name" } }, required: ["projectName"] } },
  { name: "pages_create_project", description: "Create a Pages project.", inputSchema: { type: "object", properties: { name: { type: "string", description: "Project name" }, productionBranch: { type: "string", description: "Production branch name" }, buildConfig: { type: "object", description: "Build configuration", properties: { buildCommand: { type: "string" }, destinationDir: { type: "string" }, rootDir: { type: "string" } } } }, required: ["name"] } },
  { name: "pages_delete_project", description: "Delete a Pages project.", inputSchema: { type: "object", properties: { projectName: { type: "string", description: "Project name" } }, required: ["projectName"] } },
  { name: "pages_list_deployments", description: "List deployments for a Pages project.", inputSchema: { type: "object", properties: { projectName: { type: "string", description: "Project name" } }, required: ["projectName"] } },
  { name: "pages_get_deployment", description: "Get a specific deployment.", inputSchema: { type: "object", properties: { projectName: { type: "string", description: "Project name" }, deploymentId: { type: "string", description: "Deployment ID" } }, required: ["projectName", "deploymentId"] } },

  // D1 Databases
  { name: "d1_list_databases", description: "List all D1 databases.", inputSchema: { type: "object", properties: {} } },
  { name: "d1_create_database", description: "Create a D1 database.", inputSchema: { type: "object", properties: { name: { type: "string", description: "Database name" }, primaryLocationHint: { type: "string", description: "Location hint" } }, required: ["name"] } },
  { name: "d1_delete_database", description: "Delete a D1 database.", inputSchema: { type: "object", properties: { databaseId: { type: "string", description: "Database ID" } }, required: ["databaseId"] } },
  { name: "d1_get_database", description: "Get D1 database details.", inputSchema: { type: "object", properties: { databaseId: { type: "string", description: "Database ID" } }, required: ["databaseId"] } },
  { name: "d1_query", description: "Execute a SQL query on D1.", inputSchema: { type: "object", properties: { databaseId: { type: "string", description: "Database ID" }, sql: { type: "string", description: "SQL query to execute" }, params: { type: "array", description: "Query parameters" } }, required: ["databaseId", "sql"] } },

  // Queues
  { name: "queues_list", description: "List all Queues.", inputSchema: { type: "object", properties: {} } },
  { name: "queues_create", description: "Create a Queue.", inputSchema: { type: "object", properties: { name: { type: "string", description: "Queue name" } }, required: ["name"] } },
  { name: "queues_delete", description: "Delete a Queue.", inputSchema: { type: "object", properties: { queueId: { type: "string", description: "Queue ID" } }, required: ["queueId"] } },
  { name: "queues_get", description: "Get Queue details.", inputSchema: { type: "object", properties: { queueId: { type: "string", description: "Queue ID" } }, required: ["queueId"] } },
  { name: "queues_send_message", description: "Send a message to a Queue.", inputSchema: { type: "object", properties: { queueId: { type: "string", description: "Queue ID" }, body: { type: "object", description: "Message body" }, contentType: { type: "string", description: "Content type (json or text)" } }, required: ["queueId", "body"] } },
  { name: "queues_list_consumers", description: "List Queue consumers.", inputSchema: { type: "object", properties: { queueId: { type: "string", description: "Queue ID" } }, required: ["queueId"] } },
  { name: "queues_create_consumer", description: "Create a Queue consumer.", inputSchema: { type: "object", properties: { queueId: { type: "string", description: "Queue ID" }, scriptName: { type: "string", description: "Worker script name" }, settings: { type: "object", description: "Consumer settings", properties: { batchSize: { type: "number" }, maxRetries: { type: "number" }, maxWaitTimeMs: { type: "number" } } } }, required: ["queueId", "scriptName"] } },
  { name: "queues_delete_consumer", description: "Delete a Queue consumer.", inputSchema: { type: "object", properties: { queueId: { type: "string", description: "Queue ID" }, consumerId: { type: "string", description: "Consumer ID" } }, required: ["queueId", "consumerId"] } },

  // Analytics
  { name: "analytics_get_zone", description: "Get zone analytics.", inputSchema: { type: "object", properties: { zoneId: { type: "string", description: "Zone ID" }, since: { type: "string", description: "Start time (ISO 8601)" }, until: { type: "string", description: "End time (ISO 8601)" } }, required: ["zoneId"] } },
  { name: "analytics_get_workers", description: "Get Workers analytics.", inputSchema: { type: "object", properties: { scriptName: { type: "string", description: "Worker script name (optional for all workers)" }, since: { type: "string", description: "Start time (ISO 8601)" }, until: { type: "string", description: "End time (ISO 8601)" } } } },
  { name: "analytics_get_dns", description: "Get DNS analytics.", inputSchema: { type: "object", properties: { zoneId: { type: "string", description: "Zone ID" }, since: { type: "string", description: "Start time (ISO 8601)" }, until: { type: "string", description: "End time (ISO 8601)" }, dimensions: { type: "array", items: { type: "string" }, description: "Dimensions to group by" } }, required: ["zoneId"] } },
  { name: "analytics_get_web", description: "Get Web Analytics data.", inputSchema: { type: "object", properties: { siteTag: { type: "string", description: "Site tag" }, since: { type: "string", description: "Start time (ISO 8601)" }, until: { type: "string", description: "End time (ISO 8601)" } }, required: ["siteTag"] } },
];

// Workers Functions
async function workersList(): Promise<any> {
  const result = await cfRequest(`/accounts/${ACCOUNT_ID}/workers/scripts`);
  return { scripts: result.result?.map((s: any) => ({ id: s.id, etag: s.etag, handlers: s.handlers, createdOn: s.created_on, modifiedOn: s.modified_on })) };
}

async function workersGet(params: { scriptName: string }): Promise<any> {
  const result = await cfRequest(`/accounts/${ACCOUNT_ID}/workers/scripts/${params.scriptName}`);
  return { script: result.result };
}

async function workersCreate(params: { scriptName: string; script: string; bindings?: any[] }): Promise<any> {
  const metadata: any = { main_module: "worker.js" };
  if (params.bindings) metadata.bindings = params.bindings;

  const formData = new FormData();
  formData.append("metadata", JSON.stringify(metadata));
  formData.append("worker.js", new Blob([params.script], { type: "application/javascript+module" }), "worker.js");

  const response = await fetch(`${BASE_URL}/accounts/${ACCOUNT_ID}/workers/scripts/${params.scriptName}`, {
    method: "PUT",
    headers: { "Authorization": `Bearer ${API_TOKEN}` },
    body: formData,
  });
  const data = await response.json();
  if (!data.success) throw new Error(data.errors?.map((e: any) => e.message).join(", ") || "Failed to create worker");
  return { success: true, script: data.result };
}

async function workersDelete(params: { scriptName: string }): Promise<any> {
  await cfRequest(`/accounts/${ACCOUNT_ID}/workers/scripts/${params.scriptName}`, { method: "DELETE" });
  return { deleted: true, scriptName: params.scriptName };
}

async function workersDeploy(params: { scriptName: string; routes?: string[] }): Promise<any> {
  // Get script subdomain for deployment
  const result = await cfRequest(`/accounts/${ACCOUNT_ID}/workers/scripts/${params.scriptName}/subdomain`, { method: "POST", body: JSON.stringify({ enabled: true }) });
  let routeResults: any[] = [];
  if (params.routes?.length) {
    for (const pattern of params.routes) {
      const routeResult = await cfRequest(`/accounts/${ACCOUNT_ID}/workers/scripts/${params.scriptName}/routes`, { method: "POST", body: JSON.stringify({ pattern }) });
      routeResults.push(routeResult.result);
    }
  }
  return { deployed: true, subdomain: result.result, routes: routeResults };
}

// KV Functions
async function kvListNamespaces(): Promise<any> {
  const result = await cfRequest(`/accounts/${ACCOUNT_ID}/storage/kv/namespaces`);
  return { namespaces: result.result?.map((ns: any) => ({ id: ns.id, title: ns.title, supportsUrlEncoding: ns.supports_url_encoding })) };
}

async function kvCreateNamespace(params: { title: string }): Promise<any> {
  const result = await cfRequest(`/accounts/${ACCOUNT_ID}/storage/kv/namespaces`, { method: "POST", body: JSON.stringify({ title: params.title }) });
  return { namespace: result.result };
}

async function kvDeleteNamespace(params: { namespaceId: string }): Promise<any> {
  await cfRequest(`/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${params.namespaceId}`, { method: "DELETE" });
  return { deleted: true, namespaceId: params.namespaceId };
}

async function kvListKeys(params: { namespaceId: string; prefix?: string; limit?: number; cursor?: string }): Promise<any> {
  const queryParams = new URLSearchParams();
  if (params.prefix) queryParams.append("prefix", params.prefix);
  if (params.limit) queryParams.append("limit", params.limit.toString());
  if (params.cursor) queryParams.append("cursor", params.cursor);
  const result = await cfRequest(`/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${params.namespaceId}/keys?${queryParams}`);
  return { keys: result.result, cursor: result.result_info?.cursor };
}

async function kvRead(params: { namespaceId: string; key: string }): Promise<any> {
  const response = await fetch(`${BASE_URL}/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${params.namespaceId}/values/${encodeURIComponent(params.key)}`, {
    headers: { "Authorization": `Bearer ${API_TOKEN}` },
  });
  if (!response.ok) throw new Error(`Failed to read key: ${response.statusText}`);
  const value = await response.text();
  return { key: params.key, value };
}

async function kvWrite(params: { namespaceId: string; key: string; value: string; expirationTtl?: number; metadata?: any }): Promise<any> {
  const queryParams = new URLSearchParams();
  if (params.expirationTtl) queryParams.append("expiration_ttl", params.expirationTtl.toString());
  const body = params.metadata ? JSON.stringify({ value: params.value, metadata: params.metadata }) : params.value;
  const contentType = params.metadata ? "application/json" : "text/plain";

  await fetch(`${BASE_URL}/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${params.namespaceId}/values/${encodeURIComponent(params.key)}?${queryParams}`, {
    method: "PUT",
    headers: { "Authorization": `Bearer ${API_TOKEN}`, "Content-Type": contentType },
    body,
  });
  return { success: true, key: params.key };
}

async function kvDelete(params: { namespaceId: string; key: string }): Promise<any> {
  await cfRequest(`/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${params.namespaceId}/values/${encodeURIComponent(params.key)}`, { method: "DELETE" });
  return { deleted: true, key: params.key };
}

// R2 Functions
async function r2ListBuckets(): Promise<any> {
  const result = await cfRequest(`/accounts/${ACCOUNT_ID}/r2/buckets`);
  return { buckets: result.result?.buckets?.map((b: any) => ({ name: b.name, creationDate: b.creation_date, location: b.location })) };
}

async function r2CreateBucket(params: { name: string; locationHint?: string }): Promise<any> {
  const body: any = { name: params.name };
  if (params.locationHint) body.locationHint = params.locationHint;
  const result = await cfRequest(`/accounts/${ACCOUNT_ID}/r2/buckets`, { method: "POST", body: JSON.stringify(body) });
  return { bucket: result.result };
}

async function r2DeleteBucket(params: { name: string }): Promise<any> {
  await cfRequest(`/accounts/${ACCOUNT_ID}/r2/buckets/${params.name}`, { method: "DELETE" });
  return { deleted: true, name: params.name };
}

async function r2ListObjects(params: { bucket: string; prefix?: string; delimiter?: string; limit?: number; cursor?: string }): Promise<any> {
  const queryParams = new URLSearchParams();
  if (params.prefix) queryParams.append("prefix", params.prefix);
  if (params.delimiter) queryParams.append("delimiter", params.delimiter);
  if (params.limit) queryParams.append("limit", params.limit.toString());
  if (params.cursor) queryParams.append("cursor", params.cursor);
  const result = await cfRequest(`/accounts/${ACCOUNT_ID}/r2/buckets/${params.bucket}/objects?${queryParams}`);
  return { objects: result.result?.objects, truncated: result.result?.truncated, cursor: result.result?.cursor };
}

async function r2GetObject(params: { bucket: string; key: string }): Promise<any> {
  const result = await cfRequest(`/accounts/${ACCOUNT_ID}/r2/buckets/${params.bucket}/objects/${encodeURIComponent(params.key)}`);
  return { object: result.result };
}

async function r2PutObject(params: { bucket: string; key: string; body: string; contentType?: string }): Promise<any> {
  await fetch(`${BASE_URL}/accounts/${ACCOUNT_ID}/r2/buckets/${params.bucket}/objects/${encodeURIComponent(params.key)}`, {
    method: "PUT",
    headers: { "Authorization": `Bearer ${API_TOKEN}`, "Content-Type": params.contentType || "application/octet-stream" },
    body: params.body,
  });
  return { success: true, bucket: params.bucket, key: params.key };
}

async function r2DeleteObject(params: { bucket: string; key: string }): Promise<any> {
  await cfRequest(`/accounts/${ACCOUNT_ID}/r2/buckets/${params.bucket}/objects/${encodeURIComponent(params.key)}`, { method: "DELETE" });
  return { deleted: true, bucket: params.bucket, key: params.key };
}

// DNS Functions
async function dnsListZones(params: { name?: string; status?: string; page?: number; perPage?: number }): Promise<any> {
  const queryParams = new URLSearchParams();
  if (params.name) queryParams.append("name", params.name);
  if (params.status) queryParams.append("status", params.status);
  if (params.page) queryParams.append("page", params.page.toString());
  if (params.perPage) queryParams.append("per_page", params.perPage.toString());
  const result = await cfRequest(`/zones?${queryParams}`);
  return { zones: result.result?.map((z: any) => ({ id: z.id, name: z.name, status: z.status, nameServers: z.name_servers, plan: z.plan?.name })) };
}

async function dnsGetZone(params: { zoneId: string }): Promise<any> {
  const result = await cfRequest(`/zones/${params.zoneId}`);
  return { zone: result.result };
}

async function dnsCreateZone(params: { name: string; type?: string; jumpStart?: boolean }): Promise<any> {
  const body: any = { name: params.name, account: { id: ACCOUNT_ID } };
  if (params.type) body.type = params.type;
  if (params.jumpStart !== undefined) body.jump_start = params.jumpStart;
  const result = await cfRequest("/zones", { method: "POST", body: JSON.stringify(body) });
  return { zone: result.result };
}

async function dnsDeleteZone(params: { zoneId: string }): Promise<any> {
  await cfRequest(`/zones/${params.zoneId}`, { method: "DELETE" });
  return { deleted: true, zoneId: params.zoneId };
}

async function dnsListRecords(params: { zoneId: string; type?: string; name?: string; page?: number; perPage?: number }): Promise<any> {
  const queryParams = new URLSearchParams();
  if (params.type) queryParams.append("type", params.type);
  if (params.name) queryParams.append("name", params.name);
  if (params.page) queryParams.append("page", params.page.toString());
  if (params.perPage) queryParams.append("per_page", params.perPage.toString());
  const result = await cfRequest(`/zones/${params.zoneId}/dns_records?${queryParams}`);
  return { records: result.result?.map((r: any) => ({ id: r.id, type: r.type, name: r.name, content: r.content, ttl: r.ttl, proxied: r.proxied, priority: r.priority })) };
}

async function dnsCreateRecord(params: { zoneId: string; type: string; name: string; content: string; ttl?: number; priority?: number; proxied?: boolean }): Promise<any> {
  const body: any = { type: params.type, name: params.name, content: params.content };
  if (params.ttl) body.ttl = params.ttl;
  if (params.priority !== undefined) body.priority = params.priority;
  if (params.proxied !== undefined) body.proxied = params.proxied;
  const result = await cfRequest(`/zones/${params.zoneId}/dns_records`, { method: "POST", body: JSON.stringify(body) });
  return { record: result.result };
}

async function dnsUpdateRecord(params: { zoneId: string; recordId: string; type: string; name: string; content: string; ttl?: number; proxied?: boolean }): Promise<any> {
  const body: any = { type: params.type, name: params.name, content: params.content };
  if (params.ttl) body.ttl = params.ttl;
  if (params.proxied !== undefined) body.proxied = params.proxied;
  const result = await cfRequest(`/zones/${params.zoneId}/dns_records/${params.recordId}`, { method: "PUT", body: JSON.stringify(body) });
  return { record: result.result };
}

async function dnsDeleteRecord(params: { zoneId: string; recordId: string }): Promise<any> {
  await cfRequest(`/zones/${params.zoneId}/dns_records/${params.recordId}`, { method: "DELETE" });
  return { deleted: true, recordId: params.recordId };
}

// Pages Functions
async function pagesListProjects(): Promise<any> {
  const result = await cfRequest(`/accounts/${ACCOUNT_ID}/pages/projects`);
  return { projects: result.result?.map((p: any) => ({ name: p.name, subdomain: p.subdomain, productionBranch: p.production_branch, createdOn: p.created_on })) };
}

async function pagesGetProject(params: { projectName: string }): Promise<any> {
  const result = await cfRequest(`/accounts/${ACCOUNT_ID}/pages/projects/${params.projectName}`);
  return { project: result.result };
}

async function pagesCreateProject(params: { name: string; productionBranch?: string; buildConfig?: any }): Promise<any> {
  const body: any = { name: params.name };
  if (params.productionBranch) body.production_branch = params.productionBranch;
  if (params.buildConfig) body.build_config = params.buildConfig;
  const result = await cfRequest(`/accounts/${ACCOUNT_ID}/pages/projects`, { method: "POST", body: JSON.stringify(body) });
  return { project: result.result };
}

async function pagesDeleteProject(params: { projectName: string }): Promise<any> {
  await cfRequest(`/accounts/${ACCOUNT_ID}/pages/projects/${params.projectName}`, { method: "DELETE" });
  return { deleted: true, projectName: params.projectName };
}

async function pagesListDeployments(params: { projectName: string }): Promise<any> {
  const result = await cfRequest(`/accounts/${ACCOUNT_ID}/pages/projects/${params.projectName}/deployments`);
  return { deployments: result.result?.map((d: any) => ({ id: d.id, url: d.url, environment: d.environment, createdOn: d.created_on, productionBranch: d.production_branch })) };
}

async function pagesGetDeployment(params: { projectName: string; deploymentId: string }): Promise<any> {
  const result = await cfRequest(`/accounts/${ACCOUNT_ID}/pages/projects/${params.projectName}/deployments/${params.deploymentId}`);
  return { deployment: result.result };
}

// D1 Functions
async function d1ListDatabases(): Promise<any> {
  const result = await cfRequest(`/accounts/${ACCOUNT_ID}/d1/database`);
  return { databases: result.result?.map((db: any) => ({ uuid: db.uuid, name: db.name, version: db.version, createdAt: db.created_at })) };
}

async function d1CreateDatabase(params: { name: string; primaryLocationHint?: string }): Promise<any> {
  const body: any = { name: params.name };
  if (params.primaryLocationHint) body.primary_location_hint = params.primaryLocationHint;
  const result = await cfRequest(`/accounts/${ACCOUNT_ID}/d1/database`, { method: "POST", body: JSON.stringify(body) });
  return { database: result.result };
}

async function d1DeleteDatabase(params: { databaseId: string }): Promise<any> {
  await cfRequest(`/accounts/${ACCOUNT_ID}/d1/database/${params.databaseId}`, { method: "DELETE" });
  return { deleted: true, databaseId: params.databaseId };
}

async function d1GetDatabase(params: { databaseId: string }): Promise<any> {
  const result = await cfRequest(`/accounts/${ACCOUNT_ID}/d1/database/${params.databaseId}`);
  return { database: result.result };
}

async function d1Query(params: { databaseId: string; sql: string; params?: any[] }): Promise<any> {
  const body: any = { sql: params.sql };
  if (params.params) body.params = params.params;
  const result = await cfRequest(`/accounts/${ACCOUNT_ID}/d1/database/${params.databaseId}/query`, { method: "POST", body: JSON.stringify(body) });
  return { results: result.result };
}

// Queues Functions
async function queuesList(): Promise<any> {
  const result = await cfRequest(`/accounts/${ACCOUNT_ID}/queues`);
  return { queues: result.result?.map((q: any) => ({ queueId: q.queue_id, queueName: q.queue_name, createdOn: q.created_on, modifiedOn: q.modified_on })) };
}

async function queuesCreate(params: { name: string }): Promise<any> {
  const result = await cfRequest(`/accounts/${ACCOUNT_ID}/queues`, { method: "POST", body: JSON.stringify({ queue_name: params.name }) });
  return { queue: result.result };
}

async function queuesDelete(params: { queueId: string }): Promise<any> {
  await cfRequest(`/accounts/${ACCOUNT_ID}/queues/${params.queueId}`, { method: "DELETE" });
  return { deleted: true, queueId: params.queueId };
}

async function queuesGet(params: { queueId: string }): Promise<any> {
  const result = await cfRequest(`/accounts/${ACCOUNT_ID}/queues/${params.queueId}`);
  return { queue: result.result };
}

async function queuesSendMessage(params: { queueId: string; body: any; contentType?: string }): Promise<any> {
  const result = await cfRequest(`/accounts/${ACCOUNT_ID}/queues/${params.queueId}/messages`, {
    method: "POST",
    body: JSON.stringify({ body: params.body, content_type: params.contentType || "json" }),
  });
  return { message: result.result };
}

async function queuesListConsumers(params: { queueId: string }): Promise<any> {
  const result = await cfRequest(`/accounts/${ACCOUNT_ID}/queues/${params.queueId}/consumers`);
  return { consumers: result.result };
}

async function queuesCreateConsumer(params: { queueId: string; scriptName: string; settings?: any }): Promise<any> {
  const body: any = { script_name: params.scriptName, environment: "production" };
  if (params.settings) body.settings = params.settings;
  const result = await cfRequest(`/accounts/${ACCOUNT_ID}/queues/${params.queueId}/consumers`, { method: "POST", body: JSON.stringify(body) });
  return { consumer: result.result };
}

async function queuesDeleteConsumer(params: { queueId: string; consumerId: string }): Promise<any> {
  await cfRequest(`/accounts/${ACCOUNT_ID}/queues/${params.queueId}/consumers/${params.consumerId}`, { method: "DELETE" });
  return { deleted: true, consumerId: params.consumerId };
}

// Analytics Functions
async function analyticsGetZone(params: { zoneId: string; since?: string; until?: string }): Promise<any> {
  const queryParams = new URLSearchParams();
  if (params.since) queryParams.append("since", params.since);
  if (params.until) queryParams.append("until", params.until);
  const result = await cfRequest(`/zones/${params.zoneId}/analytics/dashboard?${queryParams}`);
  return { analytics: result.result };
}

async function analyticsGetWorkers(params: { scriptName?: string; since?: string; until?: string }): Promise<any> {
  const queryParams = new URLSearchParams();
  if (params.since) queryParams.append("since", params.since);
  if (params.until) queryParams.append("until", params.until);

  let path = `/accounts/${ACCOUNT_ID}/workers/analytics`;
  if (params.scriptName) {
    path = `/accounts/${ACCOUNT_ID}/workers/scripts/${params.scriptName}/analytics`;
  }
  const result = await cfRequest(`${path}?${queryParams}`);
  return { analytics: result.result };
}

async function analyticsGetDns(params: { zoneId: string; since?: string; until?: string; dimensions?: string[] }): Promise<any> {
  const queryParams = new URLSearchParams();
  if (params.since) queryParams.append("since", params.since);
  if (params.until) queryParams.append("until", params.until);
  if (params.dimensions) queryParams.append("dimensions", params.dimensions.join(","));
  const result = await cfRequest(`/zones/${params.zoneId}/dns_analytics/report?${queryParams}`);
  return { analytics: result.result };
}

async function analyticsGetWeb(params: { siteTag: string; since?: string; until?: string }): Promise<any> {
  const queryParams = new URLSearchParams();
  if (params.since) queryParams.append("since", params.since);
  if (params.until) queryParams.append("until", params.until);
  const result = await cfRequest(`/accounts/${ACCOUNT_ID}/rum/site_info/${params.siteTag}?${queryParams}`);
  return { analytics: result.result };
}

const server = new Server({ name: "cloudflare-mcp", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result: any;
    switch (name) {
      // Workers
      case "workers_list": result = await workersList(); break;
      case "workers_get": result = await workersGet(args as any); break;
      case "workers_create": result = await workersCreate(args as any); break;
      case "workers_delete": result = await workersDelete(args as any); break;
      case "workers_deploy": result = await workersDeploy(args as any); break;
      // KV
      case "kv_list_namespaces": result = await kvListNamespaces(); break;
      case "kv_create_namespace": result = await kvCreateNamespace(args as any); break;
      case "kv_delete_namespace": result = await kvDeleteNamespace(args as any); break;
      case "kv_list_keys": result = await kvListKeys(args as any); break;
      case "kv_read": result = await kvRead(args as any); break;
      case "kv_write": result = await kvWrite(args as any); break;
      case "kv_delete": result = await kvDelete(args as any); break;
      // R2
      case "r2_list_buckets": result = await r2ListBuckets(); break;
      case "r2_create_bucket": result = await r2CreateBucket(args as any); break;
      case "r2_delete_bucket": result = await r2DeleteBucket(args as any); break;
      case "r2_list_objects": result = await r2ListObjects(args as any); break;
      case "r2_get_object": result = await r2GetObject(args as any); break;
      case "r2_put_object": result = await r2PutObject(args as any); break;
      case "r2_delete_object": result = await r2DeleteObject(args as any); break;
      // DNS
      case "dns_list_zones": result = await dnsListZones(args as any); break;
      case "dns_get_zone": result = await dnsGetZone(args as any); break;
      case "dns_create_zone": result = await dnsCreateZone(args as any); break;
      case "dns_delete_zone": result = await dnsDeleteZone(args as any); break;
      case "dns_list_records": result = await dnsListRecords(args as any); break;
      case "dns_create_record": result = await dnsCreateRecord(args as any); break;
      case "dns_update_record": result = await dnsUpdateRecord(args as any); break;
      case "dns_delete_record": result = await dnsDeleteRecord(args as any); break;
      // Pages
      case "pages_list_projects": result = await pagesListProjects(); break;
      case "pages_get_project": result = await pagesGetProject(args as any); break;
      case "pages_create_project": result = await pagesCreateProject(args as any); break;
      case "pages_delete_project": result = await pagesDeleteProject(args as any); break;
      case "pages_list_deployments": result = await pagesListDeployments(args as any); break;
      case "pages_get_deployment": result = await pagesGetDeployment(args as any); break;
      // D1
      case "d1_list_databases": result = await d1ListDatabases(); break;
      case "d1_create_database": result = await d1CreateDatabase(args as any); break;
      case "d1_delete_database": result = await d1DeleteDatabase(args as any); break;
      case "d1_get_database": result = await d1GetDatabase(args as any); break;
      case "d1_query": result = await d1Query(args as any); break;
      // Queues
      case "queues_list": result = await queuesList(); break;
      case "queues_create": result = await queuesCreate(args as any); break;
      case "queues_delete": result = await queuesDelete(args as any); break;
      case "queues_get": result = await queuesGet(args as any); break;
      case "queues_send_message": result = await queuesSendMessage(args as any); break;
      case "queues_list_consumers": result = await queuesListConsumers(args as any); break;
      case "queues_create_consumer": result = await queuesCreateConsumer(args as any); break;
      case "queues_delete_consumer": result = await queuesDeleteConsumer(args as any); break;
      // Analytics
      case "analytics_get_zone": result = await analyticsGetZone(args as any); break;
      case "analytics_get_workers": result = await analyticsGetWorkers(args as any); break;
      case "analytics_get_dns": result = await analyticsGetDns(args as any); break;
      case "analytics_get_web": result = await analyticsGetWeb(args as any); break;
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
  console.error("Cloudflare MCP Server running on stdio");
}

main().catch(console.error);
