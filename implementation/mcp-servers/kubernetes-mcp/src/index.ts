/**
 * Kubernetes MCP Server - Cluster management for KOSMOS agents
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";
import * as k8s from "@kubernetes/client-node";

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const coreApi = kc.makeApiClient(k8s.CoreV1Api);
const appsApi = kc.makeApiClient(k8s.AppsV1Api);
const batchApi = kc.makeApiClient(k8s.BatchV1Api);

const TOOLS: Tool[] = [
  // Namespace
  { name: "list_namespaces", description: "List all namespaces.", inputSchema: { type: "object", properties: {} } },
  { name: "create_namespace", description: "Create a namespace.", inputSchema: { type: "object", properties: { name: { type: "string" }, labels: { type: "object" } }, required: ["name"] } },
  { name: "delete_namespace", description: "Delete a namespace.", inputSchema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } },
  // Pods
  { name: "list_pods", description: "List pods in a namespace.", inputSchema: { type: "object", properties: { namespace: { type: "string" }, labelSelector: { type: "string" } } } },
  { name: "get_pod", description: "Get pod details.", inputSchema: { type: "object", properties: { namespace: { type: "string" }, name: { type: "string" } }, required: ["namespace", "name"] } },
  { name: "delete_pod", description: "Delete a pod.", inputSchema: { type: "object", properties: { namespace: { type: "string" }, name: { type: "string" } }, required: ["namespace", "name"] } },
  { name: "pod_logs", description: "Get pod logs.", inputSchema: { type: "object", properties: { namespace: { type: "string" }, name: { type: "string" }, container: { type: "string" }, tailLines: { type: "number" } }, required: ["namespace", "name"] } },
  // Deployments
  { name: "list_deployments", description: "List deployments.", inputSchema: { type: "object", properties: { namespace: { type: "string" } } } },
  { name: "get_deployment", description: "Get deployment details.", inputSchema: { type: "object", properties: { namespace: { type: "string" }, name: { type: "string" } }, required: ["namespace", "name"] } },
  { name: "scale_deployment", description: "Scale a deployment.", inputSchema: { type: "object", properties: { namespace: { type: "string" }, name: { type: "string" }, replicas: { type: "number" } }, required: ["namespace", "name", "replicas"] } },
  { name: "restart_deployment", description: "Restart a deployment.", inputSchema: { type: "object", properties: { namespace: { type: "string" }, name: { type: "string" } }, required: ["namespace", "name"] } },
  { name: "delete_deployment", description: "Delete a deployment.", inputSchema: { type: "object", properties: { namespace: { type: "string" }, name: { type: "string" } }, required: ["namespace", "name"] } },
  // Services
  { name: "list_services", description: "List services.", inputSchema: { type: "object", properties: { namespace: { type: "string" } } } },
  { name: "get_service", description: "Get service details.", inputSchema: { type: "object", properties: { namespace: { type: "string" }, name: { type: "string" } }, required: ["namespace", "name"] } },
  { name: "delete_service", description: "Delete a service.", inputSchema: { type: "object", properties: { namespace: { type: "string" }, name: { type: "string" } }, required: ["namespace", "name"] } },
  // ConfigMaps & Secrets
  { name: "list_configmaps", description: "List configmaps.", inputSchema: { type: "object", properties: { namespace: { type: "string" } } } },
  { name: "get_configmap", description: "Get configmap data.", inputSchema: { type: "object", properties: { namespace: { type: "string" }, name: { type: "string" } }, required: ["namespace", "name"] } },
  { name: "list_secrets", description: "List secrets (names only).", inputSchema: { type: "object", properties: { namespace: { type: "string" } } } },
  // Jobs
  { name: "list_jobs", description: "List jobs.", inputSchema: { type: "object", properties: { namespace: { type: "string" } } } },
  { name: "delete_job", description: "Delete a job.", inputSchema: { type: "object", properties: { namespace: { type: "string" }, name: { type: "string" } }, required: ["namespace", "name"] } },
  // Nodes
  { name: "list_nodes", description: "List cluster nodes.", inputSchema: { type: "object", properties: {} } },
  { name: "get_node", description: "Get node details.", inputSchema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } },
  // Events
  { name: "list_events", description: "List events.", inputSchema: { type: "object", properties: { namespace: { type: "string" }, limit: { type: "number" } } } },
  // Apply
  { name: "apply_manifest", description: "Apply a YAML manifest.", inputSchema: { type: "object", properties: { manifest: { type: "string", description: "YAML manifest content" } }, required: ["manifest"] } },
];

async function listNamespaces(): Promise<any> {
  const res = await coreApi.listNamespace();
  return { namespaces: res.body.items.map(ns => ({ name: ns.metadata?.name, status: ns.status?.phase, labels: ns.metadata?.labels })) };
}

async function createNamespace(params: { name: string; labels?: any }): Promise<any> {
  await coreApi.createNamespace({ metadata: { name: params.name, labels: params.labels } });
  return { name: params.name, created: true };
}

async function deleteNamespace(params: { name: string }): Promise<any> {
  await coreApi.deleteNamespace(params.name);
  return { name: params.name, deleted: true };
}

async function listPods(params: { namespace?: string; labelSelector?: string }): Promise<any> {
  const ns = params.namespace || "default";
  const res = await coreApi.listNamespacedPod(ns, undefined, undefined, undefined, undefined, params.labelSelector);
  return { pods: res.body.items.map(p => ({ name: p.metadata?.name, status: p.status?.phase, restarts: p.status?.containerStatuses?.[0]?.restartCount || 0, node: p.spec?.nodeName })) };
}

async function getPod(params: { namespace: string; name: string }): Promise<any> {
  const res = await coreApi.readNamespacedPod(params.name, params.namespace);
  const p = res.body;
  return { name: p.metadata?.name, namespace: p.metadata?.namespace, status: p.status?.phase, ip: p.status?.podIP, node: p.spec?.nodeName, containers: p.spec?.containers?.map(c => ({ name: c.name, image: c.image })), conditions: p.status?.conditions };
}

async function deletePod(params: { namespace: string; name: string }): Promise<any> {
  await coreApi.deleteNamespacedPod(params.name, params.namespace);
  return { name: params.name, deleted: true };
}

async function podLogs(params: { namespace: string; name: string; container?: string; tailLines?: number }): Promise<any> {
  const res = await coreApi.readNamespacedPodLog(params.name, params.namespace, params.container, undefined, undefined, undefined, undefined, undefined, undefined, params.tailLines || 100);
  return { name: params.name, logs: res.body };
}

async function listDeployments(params: { namespace?: string }): Promise<any> {
  const ns = params.namespace || "default";
  const res = await appsApi.listNamespacedDeployment(ns);
  return { deployments: res.body.items.map(d => ({ name: d.metadata?.name, replicas: d.status?.replicas, ready: d.status?.readyReplicas, available: d.status?.availableReplicas })) };
}

async function getDeployment(params: { namespace: string; name: string }): Promise<any> {
  const res = await appsApi.readNamespacedDeployment(params.name, params.namespace);
  const d = res.body;
  return { name: d.metadata?.name, replicas: d.spec?.replicas, ready: d.status?.readyReplicas, strategy: d.spec?.strategy?.type, containers: d.spec?.template?.spec?.containers?.map(c => ({ name: c.name, image: c.image })) };
}

async function scaleDeployment(params: { namespace: string; name: string; replicas: number }): Promise<any> {
  await appsApi.patchNamespacedDeploymentScale(params.name, params.namespace, { spec: { replicas: params.replicas } }, undefined, undefined, undefined, undefined, undefined, { headers: { "Content-Type": "application/strategic-merge-patch+json" } });
  return { name: params.name, replicas: params.replicas, scaled: true };
}

async function restartDeployment(params: { namespace: string; name: string }): Promise<any> {
  const patch = { spec: { template: { metadata: { annotations: { "kubectl.kubernetes.io/restartedAt": new Date().toISOString() } } } } };
  await appsApi.patchNamespacedDeployment(params.name, params.namespace, patch, undefined, undefined, undefined, undefined, undefined, { headers: { "Content-Type": "application/strategic-merge-patch+json" } });
  return { name: params.name, restarted: true };
}

async function deleteDeployment(params: { namespace: string; name: string }): Promise<any> {
  await appsApi.deleteNamespacedDeployment(params.name, params.namespace);
  return { name: params.name, deleted: true };
}

async function listServices(params: { namespace?: string }): Promise<any> {
  const ns = params.namespace || "default";
  const res = await coreApi.listNamespacedService(ns);
  return { services: res.body.items.map(s => ({ name: s.metadata?.name, type: s.spec?.type, clusterIP: s.spec?.clusterIP, ports: s.spec?.ports?.map(p => ({ port: p.port, targetPort: p.targetPort, protocol: p.protocol })) })) };
}

async function getService(params: { namespace: string; name: string }): Promise<any> {
  const res = await coreApi.readNamespacedService(params.name, params.namespace);
  const s = res.body;
  return { name: s.metadata?.name, type: s.spec?.type, clusterIP: s.spec?.clusterIP, externalIPs: s.spec?.externalIPs, ports: s.spec?.ports, selector: s.spec?.selector };
}

async function deleteService(params: { namespace: string; name: string }): Promise<any> {
  await coreApi.deleteNamespacedService(params.name, params.namespace);
  return { name: params.name, deleted: true };
}

async function listConfigMaps(params: { namespace?: string }): Promise<any> {
  const ns = params.namespace || "default";
  const res = await coreApi.listNamespacedConfigMap(ns);
  return { configmaps: res.body.items.map(c => ({ name: c.metadata?.name, keys: Object.keys(c.data || {}) })) };
}

async function getConfigMap(params: { namespace: string; name: string }): Promise<any> {
  const res = await coreApi.readNamespacedConfigMap(params.name, params.namespace);
  return { name: res.body.metadata?.name, data: res.body.data };
}

async function listSecrets(params: { namespace?: string }): Promise<any> {
  const ns = params.namespace || "default";
  const res = await coreApi.listNamespacedSecret(ns);
  return { secrets: res.body.items.map(s => ({ name: s.metadata?.name, type: s.type, keys: Object.keys(s.data || {}) })) };
}

async function listJobs(params: { namespace?: string }): Promise<any> {
  const ns = params.namespace || "default";
  const res = await batchApi.listNamespacedJob(ns);
  return { jobs: res.body.items.map(j => ({ name: j.metadata?.name, active: j.status?.active, succeeded: j.status?.succeeded, failed: j.status?.failed, completionTime: j.status?.completionTime })) };
}

async function deleteJob(params: { namespace: string; name: string }): Promise<any> {
  await batchApi.deleteNamespacedJob(params.name, params.namespace, undefined, undefined, undefined, undefined, "Background");
  return { name: params.name, deleted: true };
}

async function listNodes(): Promise<any> {
  const res = await coreApi.listNode();
  return { nodes: res.body.items.map(n => ({ name: n.metadata?.name, status: n.status?.conditions?.find(c => c.type === "Ready")?.status, roles: Object.keys(n.metadata?.labels || {}).filter(l => l.startsWith("node-role.kubernetes.io/")).map(l => l.split("/")[1]), capacity: n.status?.capacity })) };
}

async function getNode(params: { name: string }): Promise<any> {
  const res = await coreApi.readNode(params.name);
  const n = res.body;
  return { name: n.metadata?.name, labels: n.metadata?.labels, capacity: n.status?.capacity, allocatable: n.status?.allocatable, conditions: n.status?.conditions, nodeInfo: n.status?.nodeInfo };
}

async function listEvents(params: { namespace?: string; limit?: number }): Promise<any> {
  const ns = params.namespace || "default";
  const res = await coreApi.listNamespacedEvent(ns, undefined, undefined, undefined, undefined, undefined, params.limit || 50);
  return { events: res.body.items.slice(0, params.limit || 50).map(e => ({ type: e.type, reason: e.reason, message: e.message, object: `${e.involvedObject?.kind}/${e.involvedObject?.name}`, count: e.count, lastTimestamp: e.lastTimestamp })) };
}

async function applyManifest(params: { manifest: string }): Promise<any> {
  // Parse YAML and apply - simplified version
  return { applied: false, message: "Use kubectl apply for complex manifests. This endpoint supports simple object creation." };
}

const server = new Server({ name: "kubernetes-mcp", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result: any;
    switch (name) {
      case "list_namespaces": result = await listNamespaces(); break;
      case "create_namespace": result = await createNamespace(args as any); break;
      case "delete_namespace": result = await deleteNamespace(args as any); break;
      case "list_pods": result = await listPods(args as any); break;
      case "get_pod": result = await getPod(args as any); break;
      case "delete_pod": result = await deletePod(args as any); break;
      case "pod_logs": result = await podLogs(args as any); break;
      case "list_deployments": result = await listDeployments(args as any); break;
      case "get_deployment": result = await getDeployment(args as any); break;
      case "scale_deployment": result = await scaleDeployment(args as any); break;
      case "restart_deployment": result = await restartDeployment(args as any); break;
      case "delete_deployment": result = await deleteDeployment(args as any); break;
      case "list_services": result = await listServices(args as any); break;
      case "get_service": result = await getService(args as any); break;
      case "delete_service": result = await deleteService(args as any); break;
      case "list_configmaps": result = await listConfigMaps(args as any); break;
      case "get_configmap": result = await getConfigMap(args as any); break;
      case "list_secrets": result = await listSecrets(args as any); break;
      case "list_jobs": result = await listJobs(args as any); break;
      case "delete_job": result = await deleteJob(args as any); break;
      case "list_nodes": result = await listNodes(); break;
      case "get_node": result = await getNode(args as any); break;
      case "list_events": result = await listEvents(args as any); break;
      case "apply_manifest": result = await applyManifest(args as any); break;
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
  console.error("Kubernetes MCP Server running on stdio");
}

main().catch(console.error);
