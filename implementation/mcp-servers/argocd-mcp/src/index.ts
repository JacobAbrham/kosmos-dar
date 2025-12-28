/**
 * ArgoCD MCP Server - GitOps continuous delivery for KOSMOS agents
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";

// Configuration from environment variables
const ARGOCD_URL = process.env.ARGOCD_URL || "https://argocd.example.com";
const ARGOCD_TOKEN = process.env.ARGOCD_TOKEN || "";

// HTTP client helper
async function argocdRequest(
  method: string,
  path: string,
  body?: any,
  queryParams?: Record<string, string>
): Promise<any> {
  if (!ARGOCD_TOKEN) {
    throw new Error("ARGOCD_TOKEN environment variable is required");
  }

  let url = `${ARGOCD_URL}/api/v1${path}`;
  if (queryParams) {
    const params = new URLSearchParams(queryParams);
    url += `?${params.toString()}`;
  }

  const response = await fetch(url, {
    method,
    headers: {
      "Authorization": `Bearer ${ARGOCD_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ArgoCD API error (${response.status}): ${errorText}`);
  }

  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

// Tool definitions
const TOOLS: Tool[] = [
  // Application Management
  {
    name: "list_applications",
    description: "List all ArgoCD applications with optional filtering by project or selector.",
    inputSchema: {
      type: "object",
      properties: {
        project: { type: "string", description: "Filter by project name" },
        selector: { type: "string", description: "Label selector for filtering" },
      },
    },
  },
  {
    name: "get_application",
    description: "Get detailed information about a specific ArgoCD application.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Application name" },
      },
      required: ["name"],
    },
  },
  {
    name: "create_application",
    description: "Create a new ArgoCD application.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Application name" },
        project: { type: "string", description: "Project name (default: default)" },
        repoURL: { type: "string", description: "Git repository URL" },
        path: { type: "string", description: "Path within repository" },
        targetRevision: { type: "string", description: "Target revision (branch, tag, or commit)" },
        destServer: { type: "string", description: "Destination cluster server URL" },
        destNamespace: { type: "string", description: "Destination namespace" },
        syncPolicy: {
          type: "object",
          description: "Sync policy configuration",
          properties: {
            automated: { type: "boolean", description: "Enable automated sync" },
            prune: { type: "boolean", description: "Enable resource pruning" },
            selfHeal: { type: "boolean", description: "Enable self-healing" },
          },
        },
        helm: {
          type: "object",
          description: "Helm-specific configuration",
          properties: {
            valueFiles: { type: "array", items: { type: "string" }, description: "Values files" },
            values: { type: "string", description: "Inline values YAML" },
          },
        },
      },
      required: ["name", "repoURL", "path", "destServer", "destNamespace"],
    },
  },
  {
    name: "update_application",
    description: "Update an existing ArgoCD application.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Application name" },
        repoURL: { type: "string", description: "Git repository URL" },
        path: { type: "string", description: "Path within repository" },
        targetRevision: { type: "string", description: "Target revision" },
        destNamespace: { type: "string", description: "Destination namespace" },
        syncPolicy: {
          type: "object",
          description: "Sync policy configuration",
          properties: {
            automated: { type: "boolean" },
            prune: { type: "boolean" },
            selfHeal: { type: "boolean" },
          },
        },
      },
      required: ["name"],
    },
  },
  {
    name: "delete_application",
    description: "Delete an ArgoCD application.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Application name" },
        cascade: { type: "boolean", description: "Cascade delete to resources (default: true)" },
        propagationPolicy: { type: "string", description: "Propagation policy: foreground, background, orphan" },
      },
      required: ["name"],
    },
  },
  {
    name: "sync_application",
    description: "Trigger a sync operation for an application.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Application name" },
        revision: { type: "string", description: "Specific revision to sync" },
        prune: { type: "boolean", description: "Prune resources not in source" },
        dryRun: { type: "boolean", description: "Perform a dry run" },
        resources: {
          type: "array",
          description: "Specific resources to sync",
          items: {
            type: "object",
            properties: {
              group: { type: "string" },
              kind: { type: "string" },
              name: { type: "string" },
              namespace: { type: "string" },
            },
          },
        },
      },
      required: ["name"],
    },
  },
  {
    name: "get_sync_status",
    description: "Get the current sync status of an application.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Application name" },
      },
      required: ["name"],
    },
  },
  {
    name: "rollback_application",
    description: "Rollback an application to a previous revision.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Application name" },
        id: { type: "number", description: "Rollback to this history ID" },
        prune: { type: "boolean", description: "Prune resources during rollback" },
      },
      required: ["name", "id"],
    },
  },
  {
    name: "refresh_application",
    description: "Refresh application state from the source repository.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Application name" },
        hard: { type: "boolean", description: "Force a hard refresh invalidating cache" },
      },
      required: ["name"],
    },
  },

  // Repository Management
  {
    name: "list_repositories",
    description: "List all configured Git repositories.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "add_repository",
    description: "Add a new Git repository to ArgoCD.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "Repository URL" },
        username: { type: "string", description: "Username for authentication" },
        password: { type: "string", description: "Password or token for authentication" },
        sshPrivateKey: { type: "string", description: "SSH private key for authentication" },
        insecure: { type: "boolean", description: "Skip TLS verification" },
        enableLfs: { type: "boolean", description: "Enable Git LFS" },
        type: { type: "string", description: "Repository type: git or helm" },
        name: { type: "string", description: "Repository name (for Helm repos)" },
      },
      required: ["repo"],
    },
  },
  {
    name: "delete_repository",
    description: "Remove a Git repository from ArgoCD.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "Repository URL to remove" },
      },
      required: ["repo"],
    },
  },

  // Cluster Management
  {
    name: "list_clusters",
    description: "List all managed Kubernetes clusters.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "add_cluster",
    description: "Add a new Kubernetes cluster to ArgoCD.",
    inputSchema: {
      type: "object",
      properties: {
        server: { type: "string", description: "Cluster API server URL" },
        name: { type: "string", description: "Cluster name" },
        config: {
          type: "object",
          description: "Cluster configuration",
          properties: {
            bearerToken: { type: "string", description: "Bearer token for authentication" },
            tlsClientConfig: {
              type: "object",
              properties: {
                insecure: { type: "boolean" },
                caData: { type: "string" },
                certData: { type: "string" },
                keyData: { type: "string" },
              },
            },
          },
        },
        namespaces: {
          type: "array",
          items: { type: "string" },
          description: "Namespaces allowed for this cluster",
        },
      },
      required: ["server", "name"],
    },
  },

  // Project Management
  {
    name: "list_projects",
    description: "List all ArgoCD projects.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "create_project",
    description: "Create a new ArgoCD project.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Project name" },
        description: { type: "string", description: "Project description" },
        sourceRepos: {
          type: "array",
          items: { type: "string" },
          description: "Allowed source repositories (* for all)",
        },
        destinations: {
          type: "array",
          description: "Allowed destination clusters and namespaces",
          items: {
            type: "object",
            properties: {
              server: { type: "string" },
              namespace: { type: "string" },
              name: { type: "string" },
            },
          },
        },
        clusterResourceWhitelist: {
          type: "array",
          description: "Allowed cluster-scoped resources",
          items: {
            type: "object",
            properties: {
              group: { type: "string" },
              kind: { type: "string" },
            },
          },
        },
        namespaceResourceBlacklist: {
          type: "array",
          description: "Denied namespace-scoped resources",
          items: {
            type: "object",
            properties: {
              group: { type: "string" },
              kind: { type: "string" },
            },
          },
        },
      },
      required: ["name"],
    },
  },

  // Resource Information
  {
    name: "get_resource_tree",
    description: "Get the resource tree for an application showing all managed resources.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Application name" },
      },
      required: ["name"],
    },
  },
  {
    name: "get_manifests",
    description: "Get the rendered Kubernetes manifests for an application.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Application name" },
        revision: { type: "string", description: "Specific revision to render" },
      },
      required: ["name"],
    },
  },
  {
    name: "get_logs",
    description: "Get logs for an application's pods.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Application name" },
        namespace: { type: "string", description: "Pod namespace" },
        podName: { type: "string", description: "Pod name" },
        container: { type: "string", description: "Container name" },
        tailLines: { type: "number", description: "Number of lines from end" },
        sinceSeconds: { type: "number", description: "Logs since N seconds ago" },
        follow: { type: "boolean", description: "Follow logs (streaming)" },
      },
      required: ["name"],
    },
  },
  {
    name: "list_events",
    description: "List events for an application.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Application name" },
      },
      required: ["name"],
    },
  },
];

// Tool implementations

async function listApplications(params: { project?: string; selector?: string }): Promise<any> {
  const queryParams: Record<string, string> = {};
  if (params.project) queryParams.project = params.project;
  if (params.selector) queryParams.selector = params.selector;

  const result = await argocdRequest("GET", "/applications", undefined, queryParams);
  return {
    applications: (result.items || []).map((app: any) => ({
      name: app.metadata?.name,
      project: app.spec?.project,
      repoURL: app.spec?.source?.repoURL,
      path: app.spec?.source?.path,
      targetRevision: app.spec?.source?.targetRevision,
      destServer: app.spec?.destination?.server,
      destNamespace: app.spec?.destination?.namespace,
      syncStatus: app.status?.sync?.status,
      healthStatus: app.status?.health?.status,
    })),
  };
}

async function getApplication(params: { name: string }): Promise<any> {
  const result = await argocdRequest("GET", `/applications/${params.name}`);
  return {
    name: result.metadata?.name,
    namespace: result.metadata?.namespace,
    project: result.spec?.project,
    source: result.spec?.source,
    destination: result.spec?.destination,
    syncPolicy: result.spec?.syncPolicy,
    syncStatus: result.status?.sync,
    health: result.status?.health,
    operationState: result.status?.operationState,
    reconciledAt: result.status?.reconciledAt,
    resources: result.status?.resources,
    history: result.status?.history,
    conditions: result.status?.conditions,
  };
}

async function createApplication(params: {
  name: string;
  project?: string;
  repoURL: string;
  path: string;
  targetRevision?: string;
  destServer: string;
  destNamespace: string;
  syncPolicy?: { automated?: boolean; prune?: boolean; selfHeal?: boolean };
  helm?: { valueFiles?: string[]; values?: string };
}): Promise<any> {
  const application: any = {
    metadata: {
      name: params.name,
    },
    spec: {
      project: params.project || "default",
      source: {
        repoURL: params.repoURL,
        path: params.path,
        targetRevision: params.targetRevision || "HEAD",
      },
      destination: {
        server: params.destServer,
        namespace: params.destNamespace,
      },
    },
  };

  if (params.syncPolicy) {
    application.spec.syncPolicy = {};
    if (params.syncPolicy.automated) {
      application.spec.syncPolicy.automated = {
        prune: params.syncPolicy.prune || false,
        selfHeal: params.syncPolicy.selfHeal || false,
      };
    }
  }

  if (params.helm) {
    application.spec.source.helm = {};
    if (params.helm.valueFiles) {
      application.spec.source.helm.valueFiles = params.helm.valueFiles;
    }
    if (params.helm.values) {
      application.spec.source.helm.values = params.helm.values;
    }
  }

  const result = await argocdRequest("POST", "/applications", application);
  return {
    name: result.metadata?.name,
    created: true,
    syncStatus: result.status?.sync?.status,
  };
}

async function updateApplication(params: {
  name: string;
  repoURL?: string;
  path?: string;
  targetRevision?: string;
  destNamespace?: string;
  syncPolicy?: { automated?: boolean; prune?: boolean; selfHeal?: boolean };
}): Promise<any> {
  // First get the current application
  const current = await argocdRequest("GET", `/applications/${params.name}`);

  // Update fields
  if (params.repoURL) current.spec.source.repoURL = params.repoURL;
  if (params.path) current.spec.source.path = params.path;
  if (params.targetRevision) current.spec.source.targetRevision = params.targetRevision;
  if (params.destNamespace) current.spec.destination.namespace = params.destNamespace;

  if (params.syncPolicy) {
    current.spec.syncPolicy = current.spec.syncPolicy || {};
    if (params.syncPolicy.automated !== undefined) {
      if (params.syncPolicy.automated) {
        current.spec.syncPolicy.automated = {
          prune: params.syncPolicy.prune || false,
          selfHeal: params.syncPolicy.selfHeal || false,
        };
      } else {
        delete current.spec.syncPolicy.automated;
      }
    }
  }

  const result = await argocdRequest("PUT", `/applications/${params.name}`, current);
  return {
    name: result.metadata?.name,
    updated: true,
    syncStatus: result.status?.sync?.status,
  };
}

async function deleteApplication(params: {
  name: string;
  cascade?: boolean;
  propagationPolicy?: string;
}): Promise<any> {
  const queryParams: Record<string, string> = {};
  if (params.cascade !== undefined) queryParams.cascade = String(params.cascade);
  if (params.propagationPolicy) queryParams.propagationPolicy = params.propagationPolicy;

  await argocdRequest("DELETE", `/applications/${params.name}`, undefined, queryParams);
  return { name: params.name, deleted: true };
}

async function syncApplication(params: {
  name: string;
  revision?: string;
  prune?: boolean;
  dryRun?: boolean;
  resources?: Array<{ group?: string; kind: string; name: string; namespace?: string }>;
}): Promise<any> {
  const syncRequest: any = {};

  if (params.revision) syncRequest.revision = params.revision;
  if (params.prune) syncRequest.prune = true;
  if (params.dryRun) syncRequest.dryRun = true;
  if (params.resources) syncRequest.resources = params.resources;

  const result = await argocdRequest("POST", `/applications/${params.name}/sync`, syncRequest);
  return {
    name: params.name,
    syncStarted: true,
    operationState: result.status?.operationState,
  };
}

async function getSyncStatus(params: { name: string }): Promise<any> {
  const result = await argocdRequest("GET", `/applications/${params.name}`);
  return {
    name: result.metadata?.name,
    sync: result.status?.sync,
    health: result.status?.health,
    operationState: result.status?.operationState,
    reconciledAt: result.status?.reconciledAt,
    conditions: result.status?.conditions,
  };
}

async function rollbackApplication(params: { name: string; id: number; prune?: boolean }): Promise<any> {
  const result = await argocdRequest("POST", `/applications/${params.name}/rollback`, {
    id: params.id,
    prune: params.prune || false,
  });
  return {
    name: params.name,
    rollbackStarted: true,
    operationState: result.status?.operationState,
  };
}

async function refreshApplication(params: { name: string; hard?: boolean }): Promise<any> {
  const queryParams: Record<string, string> = {
    refresh: params.hard ? "hard" : "normal",
  };
  const result = await argocdRequest("GET", `/applications/${params.name}`, undefined, queryParams);
  return {
    name: result.metadata?.name,
    refreshed: true,
    syncStatus: result.status?.sync?.status,
    healthStatus: result.status?.health?.status,
  };
}

async function listRepositories(): Promise<any> {
  const result = await argocdRequest("GET", "/repositories");
  return {
    repositories: (result.items || []).map((repo: any) => ({
      repo: repo.repo,
      type: repo.type,
      name: repo.name,
      connectionState: repo.connectionState,
    })),
  };
}

async function addRepository(params: {
  repo: string;
  username?: string;
  password?: string;
  sshPrivateKey?: string;
  insecure?: boolean;
  enableLfs?: boolean;
  type?: string;
  name?: string;
}): Promise<any> {
  const repoConfig: any = {
    repo: params.repo,
    type: params.type || "git",
  };

  if (params.username) repoConfig.username = params.username;
  if (params.password) repoConfig.password = params.password;
  if (params.sshPrivateKey) repoConfig.sshPrivateKey = params.sshPrivateKey;
  if (params.insecure) repoConfig.insecure = true;
  if (params.enableLfs) repoConfig.enableLfs = true;
  if (params.name) repoConfig.name = params.name;

  const result = await argocdRequest("POST", "/repositories", repoConfig);
  return {
    repo: result.repo,
    type: result.type,
    added: true,
    connectionState: result.connectionState,
  };
}

async function deleteRepository(params: { repo: string }): Promise<any> {
  await argocdRequest("DELETE", `/repositories/${encodeURIComponent(params.repo)}`);
  return { repo: params.repo, deleted: true };
}

async function listClusters(): Promise<any> {
  const result = await argocdRequest("GET", "/clusters");
  return {
    clusters: (result.items || []).map((cluster: any) => ({
      server: cluster.server,
      name: cluster.name,
      connectionState: cluster.connectionState,
      serverVersion: cluster.serverVersion,
      namespaces: cluster.namespaces,
    })),
  };
}

async function addCluster(params: {
  server: string;
  name: string;
  config?: {
    bearerToken?: string;
    tlsClientConfig?: {
      insecure?: boolean;
      caData?: string;
      certData?: string;
      keyData?: string;
    };
  };
  namespaces?: string[];
}): Promise<any> {
  const clusterConfig: any = {
    server: params.server,
    name: params.name,
  };

  if (params.config) {
    clusterConfig.config = params.config;
  }
  if (params.namespaces) {
    clusterConfig.namespaces = params.namespaces;
  }

  const result = await argocdRequest("POST", "/clusters", clusterConfig);
  return {
    server: result.server,
    name: result.name,
    added: true,
    connectionState: result.connectionState,
  };
}

async function listProjects(): Promise<any> {
  const result = await argocdRequest("GET", "/projects");
  return {
    projects: (result.items || []).map((project: any) => ({
      name: project.metadata?.name,
      description: project.spec?.description,
      sourceRepos: project.spec?.sourceRepos,
      destinations: project.spec?.destinations,
    })),
  };
}

async function createProject(params: {
  name: string;
  description?: string;
  sourceRepos?: string[];
  destinations?: Array<{ server?: string; namespace?: string; name?: string }>;
  clusterResourceWhitelist?: Array<{ group: string; kind: string }>;
  namespaceResourceBlacklist?: Array<{ group: string; kind: string }>;
}): Promise<any> {
  const project: any = {
    metadata: {
      name: params.name,
    },
    spec: {
      description: params.description || "",
      sourceRepos: params.sourceRepos || ["*"],
      destinations: params.destinations || [{ server: "*", namespace: "*" }],
    },
  };

  if (params.clusterResourceWhitelist) {
    project.spec.clusterResourceWhitelist = params.clusterResourceWhitelist;
  }
  if (params.namespaceResourceBlacklist) {
    project.spec.namespaceResourceBlacklist = params.namespaceResourceBlacklist;
  }

  const result = await argocdRequest("POST", "/projects", { project });
  return {
    name: result.metadata?.name,
    created: true,
  };
}

async function getResourceTree(params: { name: string }): Promise<any> {
  const result = await argocdRequest("GET", `/applications/${params.name}/resource-tree`);
  return {
    name: params.name,
    nodes: (result.nodes || []).map((node: any) => ({
      group: node.group,
      kind: node.kind,
      name: node.name,
      namespace: node.namespace,
      version: node.version,
      health: node.health,
      parentRefs: node.parentRefs,
      info: node.info,
      createdAt: node.createdAt,
    })),
    orphanedNodes: result.orphanedNodes,
    hosts: result.hosts,
  };
}

async function getManifests(params: { name: string; revision?: string }): Promise<any> {
  const queryParams: Record<string, string> = {};
  if (params.revision) queryParams.revision = params.revision;

  const result = await argocdRequest("GET", `/applications/${params.name}/manifests`, undefined, queryParams);
  return {
    name: params.name,
    revision: result.revision,
    manifests: result.manifests,
    namespace: result.namespace,
    server: result.server,
  };
}

async function getLogs(params: {
  name: string;
  namespace?: string;
  podName?: string;
  container?: string;
  tailLines?: number;
  sinceSeconds?: number;
  follow?: boolean;
}): Promise<any> {
  const queryParams: Record<string, string> = {};
  if (params.namespace) queryParams.namespace = params.namespace;
  if (params.podName) queryParams.podName = params.podName;
  if (params.container) queryParams.container = params.container;
  if (params.tailLines) queryParams.tailLines = String(params.tailLines);
  if (params.sinceSeconds) queryParams.sinceSeconds = String(params.sinceSeconds);
  if (params.follow) queryParams.follow = "true";

  const result = await argocdRequest("GET", `/applications/${params.name}/logs`, undefined, queryParams);
  return {
    name: params.name,
    logs: result,
  };
}

async function listEvents(params: { name: string }): Promise<any> {
  const result = await argocdRequest("GET", `/applications/${params.name}/events`);
  return {
    name: params.name,
    events: (result.items || []).map((event: any) => ({
      type: event.type,
      reason: event.reason,
      message: event.message,
      firstTimestamp: event.firstTimestamp,
      lastTimestamp: event.lastTimestamp,
      count: event.count,
      source: event.source,
      involvedObject: event.involvedObject,
    })),
  };
}

// Server setup
const server = new Server(
  { name: "argocd-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result: any;
    switch (name) {
      // Application Management
      case "list_applications":
        result = await listApplications(args as any);
        break;
      case "get_application":
        result = await getApplication(args as any);
        break;
      case "create_application":
        result = await createApplication(args as any);
        break;
      case "update_application":
        result = await updateApplication(args as any);
        break;
      case "delete_application":
        result = await deleteApplication(args as any);
        break;
      case "sync_application":
        result = await syncApplication(args as any);
        break;
      case "get_sync_status":
        result = await getSyncStatus(args as any);
        break;
      case "rollback_application":
        result = await rollbackApplication(args as any);
        break;
      case "refresh_application":
        result = await refreshApplication(args as any);
        break;

      // Repository Management
      case "list_repositories":
        result = await listRepositories();
        break;
      case "add_repository":
        result = await addRepository(args as any);
        break;
      case "delete_repository":
        result = await deleteRepository(args as any);
        break;

      // Cluster Management
      case "list_clusters":
        result = await listClusters();
        break;
      case "add_cluster":
        result = await addCluster(args as any);
        break;

      // Project Management
      case "list_projects":
        result = await listProjects();
        break;
      case "create_project":
        result = await createProject(args as any);
        break;

      // Resource Information
      case "get_resource_tree":
        result = await getResourceTree(args as any);
        break;
      case "get_manifests":
        result = await getManifests(args as any);
        break;
      case "get_logs":
        result = await getLogs(args as any);
        break;
      case "list_events":
        result = await listEvents(args as any);
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (error: any) {
    return {
      content: [{ type: "text", text: JSON.stringify({ error: error.message }) }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("ArgoCD MCP Server running on stdio");
}

main().catch(console.error);
