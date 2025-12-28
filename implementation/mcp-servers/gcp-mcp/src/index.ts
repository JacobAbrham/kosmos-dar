/**
 * GCP MCP Server - Google Cloud Platform integration for KOSMOS
 * Provides access to core GCP services via REST API
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";

const config = {
  projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID || "",
  region: process.env.GOOGLE_CLOUD_REGION || "us-central1",
  zone: process.env.GOOGLE_CLOUD_ZONE || "us-central1-a",
};

// Use Google's metadata server for auth in cloud environments, or service account key
async function getAccessToken(): Promise<string> {
  // Try metadata server first (for cloud environments)
  try {
    const res = await fetch("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token", {
      headers: { "Metadata-Flavor": "Google" },
    });
    if (res.ok) {
      const data = await res.json();
      return data.access_token;
    }
  } catch {}

  // Fallback: try gcloud CLI
  const { exec } = await import("child_process");
  const { promisify } = await import("util");
  const execAsync = promisify(exec);
  try {
    const { stdout } = await execAsync("gcloud auth print-access-token");
    return stdout.trim();
  } catch (e) {
    throw new Error("Could not obtain GCP access token. Ensure GOOGLE_APPLICATION_CREDENTIALS is set or gcloud is authenticated.");
  }
}

async function gcpRequest(method: string, url: string, body?: any): Promise<any> {
  const token = await getAccessToken();
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(error.error?.message || res.statusText);
  }

  return res.status === 204 ? {} : res.json();
}

const TOOLS: Tool[] = [
  // Compute Engine
  { name: "list_instances", description: "List Compute Engine instances.", inputSchema: { type: "object", properties: { zone: { type: "string" } } } },
  { name: "get_instance", description: "Get instance details.", inputSchema: { type: "object", properties: { zone: { type: "string" }, instance: { type: "string" } }, required: ["instance"] } },
  { name: "start_instance", description: "Start a compute instance.", inputSchema: { type: "object", properties: { zone: { type: "string" }, instance: { type: "string" } }, required: ["instance"] } },
  { name: "stop_instance", description: "Stop a compute instance.", inputSchema: { type: "object", properties: { zone: { type: "string" }, instance: { type: "string" } }, required: ["instance"] } },
  // Cloud Storage
  { name: "list_buckets", description: "List Cloud Storage buckets.", inputSchema: { type: "object", properties: {} } },
  { name: "list_objects", description: "List objects in a bucket.", inputSchema: { type: "object", properties: { bucket: { type: "string" }, prefix: { type: "string" }, maxResults: { type: "number" } }, required: ["bucket"] } },
  { name: "get_object_metadata", description: "Get object metadata.", inputSchema: { type: "object", properties: { bucket: { type: "string" }, object: { type: "string" } }, required: ["bucket", "object"] } },
  { name: "delete_object", description: "Delete an object.", inputSchema: { type: "object", properties: { bucket: { type: "string" }, object: { type: "string" } }, required: ["bucket", "object"] } },
  // Cloud Functions
  { name: "list_functions", description: "List Cloud Functions.", inputSchema: { type: "object", properties: { region: { type: "string" } } } },
  { name: "get_function", description: "Get function details.", inputSchema: { type: "object", properties: { region: { type: "string" }, name: { type: "string" } }, required: ["name"] } },
  { name: "call_function", description: "Call a Cloud Function.", inputSchema: { type: "object", properties: { region: { type: "string" }, name: { type: "string" }, data: { type: "object" } }, required: ["name"] } },
  // Cloud Run
  { name: "list_services", description: "List Cloud Run services.", inputSchema: { type: "object", properties: { region: { type: "string" } } } },
  { name: "get_service", description: "Get Cloud Run service details.", inputSchema: { type: "object", properties: { region: { type: "string" }, name: { type: "string" } }, required: ["name"] } },
  // Pub/Sub
  { name: "list_topics", description: "List Pub/Sub topics.", inputSchema: { type: "object", properties: {} } },
  { name: "publish_message", description: "Publish to a Pub/Sub topic.", inputSchema: { type: "object", properties: { topic: { type: "string" }, message: { type: "string" }, attributes: { type: "object" } }, required: ["topic", "message"] } },
  { name: "list_subscriptions", description: "List Pub/Sub subscriptions.", inputSchema: { type: "object", properties: { topic: { type: "string" } } } },
  // BigQuery
  { name: "list_datasets", description: "List BigQuery datasets.", inputSchema: { type: "object", properties: {} } },
  { name: "list_tables", description: "List tables in a dataset.", inputSchema: { type: "object", properties: { datasetId: { type: "string" } }, required: ["datasetId"] } },
  { name: "query", description: "Run a BigQuery query.", inputSchema: { type: "object", properties: { query: { type: "string" }, useLegacySql: { type: "boolean" } }, required: ["query"] } },
  // Cloud SQL
  { name: "list_sql_instances", description: "List Cloud SQL instances.", inputSchema: { type: "object", properties: {} } },
  { name: "get_sql_instance", description: "Get Cloud SQL instance details.", inputSchema: { type: "object", properties: { instance: { type: "string" } }, required: ["instance"] } },
  // GKE
  { name: "list_clusters", description: "List GKE clusters.", inputSchema: { type: "object", properties: { zone: { type: "string" } } } },
  { name: "get_cluster", description: "Get GKE cluster details.", inputSchema: { type: "object", properties: { zone: { type: "string" }, cluster: { type: "string" } }, required: ["cluster"] } },
  // IAM
  { name: "list_service_accounts", description: "List service accounts.", inputSchema: { type: "object", properties: {} } },
  { name: "get_iam_policy", description: "Get IAM policy for a resource.", inputSchema: { type: "object", properties: { resource: { type: "string" } }, required: ["resource"] } },
  // Monitoring
  { name: "list_metric_descriptors", description: "List available metrics.", inputSchema: { type: "object", properties: { filter: { type: "string" } } } },
  { name: "query_metrics", description: "Query time series metrics.", inputSchema: { type: "object", properties: { filter: { type: "string" }, interval: { type: "object" } }, required: ["filter"] } },
  // Secret Manager
  { name: "list_secrets", description: "List secrets.", inputSchema: { type: "object", properties: {} } },
  { name: "get_secret_version", description: "Get a secret version.", inputSchema: { type: "object", properties: { secret: { type: "string" }, version: { type: "string" } }, required: ["secret"] } },
];

// Compute Engine
async function listInstances(params: { zone?: string }): Promise<any> {
  const zone = params.zone || config.zone;
  const result = await gcpRequest("GET", `https://compute.googleapis.com/compute/v1/projects/${config.projectId}/zones/${zone}/instances`);
  return { instances: result.items?.map((i: any) => ({ name: i.name, status: i.status, machineType: i.machineType?.split("/").pop(), zone: i.zone?.split("/").pop() })) || [] };
}

async function getInstance(params: { zone?: string; instance: string }): Promise<any> {
  const zone = params.zone || config.zone;
  return gcpRequest("GET", `https://compute.googleapis.com/compute/v1/projects/${config.projectId}/zones/${zone}/instances/${params.instance}`);
}

async function startInstance(params: { zone?: string; instance: string }): Promise<any> {
  const zone = params.zone || config.zone;
  await gcpRequest("POST", `https://compute.googleapis.com/compute/v1/projects/${config.projectId}/zones/${zone}/instances/${params.instance}/start`);
  return { status: "starting", instance: params.instance };
}

async function stopInstance(params: { zone?: string; instance: string }): Promise<any> {
  const zone = params.zone || config.zone;
  await gcpRequest("POST", `https://compute.googleapis.com/compute/v1/projects/${config.projectId}/zones/${zone}/instances/${params.instance}/stop`);
  return { status: "stopping", instance: params.instance };
}

// Cloud Storage
async function listBuckets(): Promise<any> {
  const result = await gcpRequest("GET", `https://storage.googleapis.com/storage/v1/b?project=${config.projectId}`);
  return { buckets: result.items?.map((b: any) => ({ name: b.name, location: b.location, storageClass: b.storageClass })) || [] };
}

async function listObjects(params: { bucket: string; prefix?: string; maxResults?: number }): Promise<any> {
  const query = new URLSearchParams();
  if (params.prefix) query.set("prefix", params.prefix);
  if (params.maxResults) query.set("maxResults", params.maxResults.toString());
  const result = await gcpRequest("GET", `https://storage.googleapis.com/storage/v1/b/${params.bucket}/o?${query.toString()}`);
  return { objects: result.items?.map((o: any) => ({ name: o.name, size: o.size, contentType: o.contentType, updated: o.updated })) || [] };
}

async function getObjectMetadata(params: { bucket: string; object: string }): Promise<any> {
  return gcpRequest("GET", `https://storage.googleapis.com/storage/v1/b/${params.bucket}/o/${encodeURIComponent(params.object)}`);
}

async function deleteObject(params: { bucket: string; object: string }): Promise<any> {
  await gcpRequest("DELETE", `https://storage.googleapis.com/storage/v1/b/${params.bucket}/o/${encodeURIComponent(params.object)}`);
  return { deleted: true, bucket: params.bucket, object: params.object };
}

// Cloud Functions
async function listFunctions(params: { region?: string }): Promise<any> {
  const region = params.region || config.region;
  const result = await gcpRequest("GET", `https://cloudfunctions.googleapis.com/v2/projects/${config.projectId}/locations/${region}/functions`);
  return { functions: result.functions?.map((f: any) => ({ name: f.name?.split("/").pop(), state: f.state, runtime: f.buildConfig?.runtime })) || [] };
}

async function getFunction(params: { region?: string; name: string }): Promise<any> {
  const region = params.region || config.region;
  return gcpRequest("GET", `https://cloudfunctions.googleapis.com/v2/projects/${config.projectId}/locations/${region}/functions/${params.name}`);
}

async function callFunction(params: { region?: string; name: string; data?: any }): Promise<any> {
  const region = params.region || config.region;
  const result = await gcpRequest("POST", `https://cloudfunctions.googleapis.com/v1/projects/${config.projectId}/locations/${region}/functions/${params.name}:call`, { data: JSON.stringify(params.data || {}) });
  return result;
}

// Cloud Run
async function listServices(params: { region?: string }): Promise<any> {
  const region = params.region || config.region;
  const result = await gcpRequest("GET", `https://run.googleapis.com/v2/projects/${config.projectId}/locations/${region}/services`);
  return { services: result.services?.map((s: any) => ({ name: s.name?.split("/").pop(), uri: s.uri, latestRevision: s.latestReadyRevision })) || [] };
}

async function getService(params: { region?: string; name: string }): Promise<any> {
  const region = params.region || config.region;
  return gcpRequest("GET", `https://run.googleapis.com/v2/projects/${config.projectId}/locations/${region}/services/${params.name}`);
}

// Pub/Sub
async function listTopics(): Promise<any> {
  const result = await gcpRequest("GET", `https://pubsub.googleapis.com/v1/projects/${config.projectId}/topics`);
  return { topics: result.topics?.map((t: any) => ({ name: t.name?.split("/").pop() })) || [] };
}

async function publishMessage(params: { topic: string; message: string; attributes?: any }): Promise<any> {
  const result = await gcpRequest("POST", `https://pubsub.googleapis.com/v1/projects/${config.projectId}/topics/${params.topic}:publish`, {
    messages: [{ data: Buffer.from(params.message).toString("base64"), attributes: params.attributes }],
  });
  return { messageIds: result.messageIds };
}

async function listSubscriptions(params: { topic?: string }): Promise<any> {
  const url = params.topic
    ? `https://pubsub.googleapis.com/v1/projects/${config.projectId}/topics/${params.topic}/subscriptions`
    : `https://pubsub.googleapis.com/v1/projects/${config.projectId}/subscriptions`;
  const result = await gcpRequest("GET", url);
  return { subscriptions: (result.subscriptions || []).map((s: any) => ({ name: typeof s === "string" ? s.split("/").pop() : s.name?.split("/").pop() })) };
}

// BigQuery
async function listDatasets(): Promise<any> {
  const result = await gcpRequest("GET", `https://bigquery.googleapis.com/bigquery/v2/projects/${config.projectId}/datasets`);
  return { datasets: result.datasets?.map((d: any) => ({ datasetId: d.datasetReference?.datasetId, location: d.location })) || [] };
}

async function listTables(params: { datasetId: string }): Promise<any> {
  const result = await gcpRequest("GET", `https://bigquery.googleapis.com/bigquery/v2/projects/${config.projectId}/datasets/${params.datasetId}/tables`);
  return { tables: result.tables?.map((t: any) => ({ tableId: t.tableReference?.tableId, type: t.type })) || [] };
}

async function queryBigQuery(params: { query: string; useLegacySql?: boolean }): Promise<any> {
  const result = await gcpRequest("POST", `https://bigquery.googleapis.com/bigquery/v2/projects/${config.projectId}/queries`, {
    query: params.query,
    useLegacySql: params.useLegacySql || false,
  });
  return { jobComplete: result.jobComplete, totalRows: result.totalRows, rows: result.rows?.slice(0, 100) };
}

// Cloud SQL
async function listSqlInstances(): Promise<any> {
  const result = await gcpRequest("GET", `https://sqladmin.googleapis.com/v1/projects/${config.projectId}/instances`);
  return { instances: result.items?.map((i: any) => ({ name: i.name, databaseVersion: i.databaseVersion, state: i.state, region: i.region })) || [] };
}

async function getSqlInstance(params: { instance: string }): Promise<any> {
  return gcpRequest("GET", `https://sqladmin.googleapis.com/v1/projects/${config.projectId}/instances/${params.instance}`);
}

// GKE
async function listClusters(params: { zone?: string }): Promise<any> {
  const zone = params.zone || "-";
  const result = await gcpRequest("GET", `https://container.googleapis.com/v1/projects/${config.projectId}/locations/${zone}/clusters`);
  return { clusters: result.clusters?.map((c: any) => ({ name: c.name, location: c.location, status: c.status, currentNodeCount: c.currentNodeCount })) || [] };
}

async function getCluster(params: { zone?: string; cluster: string }): Promise<any> {
  const zone = params.zone || config.zone;
  return gcpRequest("GET", `https://container.googleapis.com/v1/projects/${config.projectId}/locations/${zone}/clusters/${params.cluster}`);
}

// IAM
async function listServiceAccounts(): Promise<any> {
  const result = await gcpRequest("GET", `https://iam.googleapis.com/v1/projects/${config.projectId}/serviceAccounts`);
  return { serviceAccounts: result.accounts?.map((a: any) => ({ email: a.email, displayName: a.displayName, disabled: a.disabled })) || [] };
}

async function getIamPolicy(params: { resource: string }): Promise<any> {
  return gcpRequest("POST", `https://cloudresourcemanager.googleapis.com/v1/${params.resource}:getIamPolicy`);
}

// Monitoring
async function listMetricDescriptors(params: { filter?: string }): Promise<any> {
  const query = params.filter ? `?filter=${encodeURIComponent(params.filter)}` : "";
  const result = await gcpRequest("GET", `https://monitoring.googleapis.com/v3/projects/${config.projectId}/metricDescriptors${query}`);
  return { metricDescriptors: result.metricDescriptors?.slice(0, 50).map((m: any) => ({ type: m.type, displayName: m.displayName })) || [] };
}

async function queryMetrics(params: { filter: string; interval?: any }): Promise<any> {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 3600000);
  const interval = params.interval || { startTime: oneHourAgo.toISOString(), endTime: now.toISOString() };
  const query = new URLSearchParams({
    filter: params.filter,
    "interval.startTime": interval.startTime,
    "interval.endTime": interval.endTime,
  });
  const result = await gcpRequest("GET", `https://monitoring.googleapis.com/v3/projects/${config.projectId}/timeSeries?${query.toString()}`);
  return { timeSeries: result.timeSeries?.slice(0, 10) || [] };
}

// Secret Manager
async function listSecrets(): Promise<any> {
  const result = await gcpRequest("GET", `https://secretmanager.googleapis.com/v1/projects/${config.projectId}/secrets`);
  return { secrets: result.secrets?.map((s: any) => ({ name: s.name?.split("/").pop(), createTime: s.createTime })) || [] };
}

async function getSecretVersion(params: { secret: string; version?: string }): Promise<any> {
  const version = params.version || "latest";
  const result = await gcpRequest("GET", `https://secretmanager.googleapis.com/v1/projects/${config.projectId}/secrets/${params.secret}/versions/${version}:access`);
  return { name: result.name, payload: result.payload?.data ? Buffer.from(result.payload.data, "base64").toString() : null };
}

const server = new Server({ name: "gcp-mcp", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result: any;
    switch (name) {
      case "list_instances": result = await listInstances(args as any); break;
      case "get_instance": result = await getInstance(args as any); break;
      case "start_instance": result = await startInstance(args as any); break;
      case "stop_instance": result = await stopInstance(args as any); break;
      case "list_buckets": result = await listBuckets(); break;
      case "list_objects": result = await listObjects(args as any); break;
      case "get_object_metadata": result = await getObjectMetadata(args as any); break;
      case "delete_object": result = await deleteObject(args as any); break;
      case "list_functions": result = await listFunctions(args as any); break;
      case "get_function": result = await getFunction(args as any); break;
      case "call_function": result = await callFunction(args as any); break;
      case "list_services": result = await listServices(args as any); break;
      case "get_service": result = await getService(args as any); break;
      case "list_topics": result = await listTopics(); break;
      case "publish_message": result = await publishMessage(args as any); break;
      case "list_subscriptions": result = await listSubscriptions(args as any); break;
      case "list_datasets": result = await listDatasets(); break;
      case "list_tables": result = await listTables(args as any); break;
      case "query": result = await queryBigQuery(args as any); break;
      case "list_sql_instances": result = await listSqlInstances(); break;
      case "get_sql_instance": result = await getSqlInstance(args as any); break;
      case "list_clusters": result = await listClusters(args as any); break;
      case "get_cluster": result = await getCluster(args as any); break;
      case "list_service_accounts": result = await listServiceAccounts(); break;
      case "get_iam_policy": result = await getIamPolicy(args as any); break;
      case "list_metric_descriptors": result = await listMetricDescriptors(args as any); break;
      case "query_metrics": result = await queryMetrics(args as any); break;
      case "list_secrets": result = await listSecrets(); break;
      case "get_secret_version": result = await getSecretVersion(args as any); break;
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
  console.error("GCP MCP Server running on stdio");
}

main().catch(console.error);
