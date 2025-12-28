/**
 * Jenkins MCP Server - CI/CD automation for KOSMOS agents
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";

// Configuration from environment variables
const JENKINS_URL = process.env.JENKINS_URL || "http://localhost:8080";
const JENKINS_USER = process.env.JENKINS_USER || "";
const JENKINS_TOKEN = process.env.JENKINS_TOKEN || "";

// HTTP client helper with Basic auth
async function jenkinsRequest(
  method: string,
  path: string,
  body?: any,
  contentType: string = "application/json",
  queryParams?: Record<string, string>
): Promise<any> {
  if (!JENKINS_USER || !JENKINS_TOKEN) {
    throw new Error("JENKINS_USER and JENKINS_TOKEN environment variables are required");
  }

  let url = `${JENKINS_URL}${path}`;
  if (queryParams) {
    const params = new URLSearchParams(queryParams);
    url += `?${params.toString()}`;
  }

  const auth = Buffer.from(`${JENKINS_USER}:${JENKINS_TOKEN}`).toString("base64");

  const headers: Record<string, string> = {
    "Authorization": `Basic ${auth}`,
  };

  if (contentType === "application/json") {
    headers["Content-Type"] = "application/json";
  } else if (contentType === "application/xml") {
    headers["Content-Type"] = "application/xml";
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? (contentType === "application/json" ? JSON.stringify(body) : body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Jenkins API error (${response.status}): ${errorText}`);
  }

  const responseContentType = response.headers.get("content-type");
  if (responseContentType?.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

// Helper to get CSRF crumb for POST requests
async function getCrumbHeader(): Promise<Record<string, string>> {
  try {
    const crumb = await jenkinsRequest("GET", "/crumbIssuer/api/json");
    return { [crumb.crumbRequestField]: crumb.crumb };
  } catch {
    // CSRF protection might be disabled
    return {};
  }
}

// POST request with CSRF crumb
async function jenkinsPostRequest(
  path: string,
  body?: any,
  contentType: string = "application/json",
  queryParams?: Record<string, string>
): Promise<any> {
  if (!JENKINS_USER || !JENKINS_TOKEN) {
    throw new Error("JENKINS_USER and JENKINS_TOKEN environment variables are required");
  }

  const crumbHeaders = await getCrumbHeader();

  let url = `${JENKINS_URL}${path}`;
  if (queryParams) {
    const params = new URLSearchParams(queryParams);
    url += `?${params.toString()}`;
  }

  const auth = Buffer.from(`${JENKINS_USER}:${JENKINS_TOKEN}`).toString("base64");

  const headers: Record<string, string> = {
    "Authorization": `Basic ${auth}`,
    ...crumbHeaders,
  };

  if (contentType === "application/json") {
    headers["Content-Type"] = "application/json";
  } else if (contentType === "application/xml") {
    headers["Content-Type"] = "application/xml";
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: body !== undefined ? (contentType === "application/json" ? JSON.stringify(body) : body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Jenkins API error (${response.status}): ${errorText}`);
  }

  const responseContentType = response.headers.get("content-type");
  if (responseContentType?.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

// Tool definitions
const TOOLS: Tool[] = [
  // Job Management
  {
    name: "list_jobs",
    description: "List all Jenkins jobs with optional folder path.",
    inputSchema: {
      type: "object",
      properties: {
        folder: { type: "string", description: "Folder path (e.g., 'folder1/folder2')" },
        depth: { type: "number", description: "Tree depth for nested jobs (default: 1)" },
      },
    },
  },
  {
    name: "get_job",
    description: "Get detailed information about a specific Jenkins job.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Job name or full path (e.g., 'folder/job-name')" },
      },
      required: ["name"],
    },
  },
  {
    name: "create_job",
    description: "Create a new Jenkins job from XML configuration.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Job name" },
        configXml: { type: "string", description: "Job configuration XML" },
        folder: { type: "string", description: "Parent folder path (optional)" },
      },
      required: ["name", "configXml"],
    },
  },
  {
    name: "delete_job",
    description: "Delete a Jenkins job.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Job name or full path" },
      },
      required: ["name"],
    },
  },

  // Build Management
  {
    name: "build_job",
    description: "Trigger a build for a Jenkins job without parameters.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Job name or full path" },
        delay: { type: "number", description: "Delay in seconds before starting build" },
      },
      required: ["name"],
    },
  },
  {
    name: "build_with_params",
    description: "Trigger a parameterized build for a Jenkins job.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Job name or full path" },
        parameters: {
          type: "object",
          description: "Build parameters as key-value pairs",
          additionalProperties: { type: "string" },
        },
        delay: { type: "number", description: "Delay in seconds before starting build" },
      },
      required: ["name", "parameters"],
    },
  },
  {
    name: "list_builds",
    description: "List builds for a Jenkins job.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Job name or full path" },
        limit: { type: "number", description: "Maximum number of builds to return (default: 10)" },
      },
      required: ["name"],
    },
  },
  {
    name: "get_build",
    description: "Get detailed information about a specific build.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Job name or full path" },
        number: { type: "number", description: "Build number" },
      },
      required: ["name", "number"],
    },
  },
  {
    name: "get_build_log",
    description: "Get console output for a build.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Job name or full path" },
        number: { type: "number", description: "Build number" },
        start: { type: "number", description: "Start byte offset for progressive log fetching" },
      },
      required: ["name", "number"],
    },
  },
  {
    name: "stop_build",
    description: "Stop a running build.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Job name or full path" },
        number: { type: "number", description: "Build number" },
      },
      required: ["name", "number"],
    },
  },

  // Node Management
  {
    name: "list_nodes",
    description: "List all Jenkins build nodes (agents).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_node",
    description: "Get detailed information about a specific node.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Node name (use 'master' or '(master)' for built-in node)" },
      },
      required: ["name"],
    },
  },
  {
    name: "enable_node",
    description: "Enable a disabled Jenkins node.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Node name" },
      },
      required: ["name"],
    },
  },
  {
    name: "disable_node",
    description: "Disable a Jenkins node with an optional reason.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Node name" },
        reason: { type: "string", description: "Reason for disabling the node" },
      },
      required: ["name"],
    },
  },

  // View Management
  {
    name: "list_views",
    description: "List all Jenkins views.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },

  // Queue Management
  {
    name: "get_queue",
    description: "Get the current Jenkins build queue.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "cancel_queue_item",
    description: "Cancel a queued build item.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Queue item ID" },
      },
      required: ["id"],
    },
  },

  // Credentials Management
  {
    name: "list_credentials",
    description: "List credentials in a specific domain.",
    inputSchema: {
      type: "object",
      properties: {
        store: { type: "string", description: "Credentials store (default: system)" },
        domain: { type: "string", description: "Credentials domain (default: _)" },
      },
    },
  },

  // System Management
  {
    name: "get_crumb",
    description: "Get CSRF crumb for making authenticated POST requests.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "restart_jenkins",
    description: "Safely restart Jenkins after current builds complete.",
    inputSchema: {
      type: "object",
      properties: {
        safe: { type: "boolean", description: "Wait for builds to complete (default: true)" },
      },
    },
  },
];

// Helper to build job path
function buildJobPath(name: string): string {
  // Handle folder paths like "folder1/folder2/job-name"
  const parts = name.split("/").filter(p => p);
  return parts.map(p => `job/${encodeURIComponent(p)}`).join("/");
}

// Tool implementations

async function listJobs(params: { folder?: string; depth?: number }): Promise<any> {
  const depth = params.depth || 1;
  let basePath = "";

  if (params.folder) {
    basePath = `/${buildJobPath(params.folder)}`;
  }

  const treeParam = `jobs[name,url,color,buildable,description${depth > 1 ? ",jobs[name,url,color,buildable]".repeat(depth - 1) : ""}]`;

  const result = await jenkinsRequest("GET", `${basePath}/api/json`, undefined, "application/json", {
    tree: treeParam,
  });

  return {
    jobs: (result.jobs || []).map((job: any) => ({
      name: job.name,
      url: job.url,
      color: job.color,
      buildable: job.buildable,
      description: job.description,
      nestedJobs: job.jobs,
    })),
  };
}

async function getJob(params: { name: string }): Promise<any> {
  const jobPath = buildJobPath(params.name);
  const result = await jenkinsRequest("GET", `/${jobPath}/api/json`);

  return {
    name: result.name,
    displayName: result.displayName,
    fullName: result.fullName,
    url: result.url,
    description: result.description,
    buildable: result.buildable,
    color: result.color,
    inQueue: result.inQueue,
    keepDependencies: result.keepDependencies,
    nextBuildNumber: result.nextBuildNumber,
    concurrentBuild: result.concurrentBuild,
    disabled: result.disabled,
    lastBuild: result.lastBuild,
    lastCompletedBuild: result.lastCompletedBuild,
    lastFailedBuild: result.lastFailedBuild,
    lastStableBuild: result.lastStableBuild,
    lastSuccessfulBuild: result.lastSuccessfulBuild,
    lastUnstableBuild: result.lastUnstableBuild,
    lastUnsuccessfulBuild: result.lastUnsuccessfulBuild,
    healthReport: result.healthReport,
    property: result.property,
  };
}

async function createJob(params: { name: string; configXml: string; folder?: string }): Promise<any> {
  let basePath = "";
  if (params.folder) {
    basePath = `/${buildJobPath(params.folder)}`;
  }

  await jenkinsPostRequest(`${basePath}/createItem`, params.configXml, "application/xml", {
    name: params.name,
  });

  return {
    name: params.name,
    folder: params.folder,
    created: true,
  };
}

async function deleteJob(params: { name: string }): Promise<any> {
  const jobPath = buildJobPath(params.name);
  await jenkinsPostRequest(`/${jobPath}/doDelete`);
  return { name: params.name, deleted: true };
}

async function buildJob(params: { name: string; delay?: number }): Promise<any> {
  const jobPath = buildJobPath(params.name);
  const queryParams: Record<string, string> = {};
  if (params.delay !== undefined) {
    queryParams.delay = `${params.delay}sec`;
  }

  await jenkinsPostRequest(`/${jobPath}/build`, undefined, "application/json", queryParams);
  return { name: params.name, buildTriggered: true };
}

async function buildWithParams(params: { name: string; parameters: Record<string, string>; delay?: number }): Promise<any> {
  const jobPath = buildJobPath(params.name);
  const queryParams: Record<string, string> = { ...params.parameters };
  if (params.delay !== undefined) {
    queryParams.delay = `${params.delay}sec`;
  }

  await jenkinsPostRequest(`/${jobPath}/buildWithParameters`, undefined, "application/json", queryParams);
  return { name: params.name, buildTriggered: true, parameters: params.parameters };
}

async function listBuilds(params: { name: string; limit?: number }): Promise<any> {
  const jobPath = buildJobPath(params.name);
  const limit = params.limit || 10;

  const result = await jenkinsRequest(
    "GET",
    `/${jobPath}/api/json`,
    undefined,
    "application/json",
    { tree: `builds[number,url,result,timestamp,duration,building,displayName]{0,${limit}}` }
  );

  return {
    job: params.name,
    builds: (result.builds || []).map((build: any) => ({
      number: build.number,
      url: build.url,
      result: build.result,
      timestamp: build.timestamp,
      duration: build.duration,
      building: build.building,
      displayName: build.displayName,
    })),
  };
}

async function getBuild(params: { name: string; number: number }): Promise<any> {
  const jobPath = buildJobPath(params.name);
  const result = await jenkinsRequest("GET", `/${jobPath}/${params.number}/api/json`);

  return {
    number: result.number,
    url: result.url,
    displayName: result.displayName,
    fullDisplayName: result.fullDisplayName,
    description: result.description,
    result: result.result,
    timestamp: result.timestamp,
    duration: result.duration,
    estimatedDuration: result.estimatedDuration,
    building: result.building,
    keepLog: result.keepLog,
    queueId: result.queueId,
    executor: result.executor,
    artifacts: result.artifacts,
    actions: result.actions,
    changeSets: result.changeSets,
    culprits: result.culprits,
  };
}

async function getBuildLog(params: { name: string; number: number; start?: number }): Promise<any> {
  const jobPath = buildJobPath(params.name);
  const queryParams: Record<string, string> = {};
  if (params.start !== undefined) {
    queryParams.start = String(params.start);
  }

  const log = await jenkinsRequest(
    "GET",
    `/${jobPath}/${params.number}/consoleText`,
    undefined,
    "text/plain",
    queryParams
  );

  return {
    job: params.name,
    build: params.number,
    log: log,
  };
}

async function stopBuild(params: { name: string; number: number }): Promise<any> {
  const jobPath = buildJobPath(params.name);
  await jenkinsPostRequest(`/${jobPath}/${params.number}/stop`);
  return { job: params.name, build: params.number, stopped: true };
}

async function listNodes(): Promise<any> {
  const result = await jenkinsRequest("GET", "/computer/api/json");

  return {
    totalExecutors: result.totalExecutors,
    busyExecutors: result.busyExecutors,
    nodes: (result.computer || []).map((node: any) => ({
      displayName: node.displayName,
      description: node.description,
      offline: node.offline,
      offlineCause: node.offlineCause,
      offlineCauseReason: node.offlineCauseReason,
      temporarilyOffline: node.temporarilyOffline,
      idle: node.idle,
      jnlpAgent: node.jnlpAgent,
      launchSupported: node.launchSupported,
      manualLaunchAllowed: node.manualLaunchAllowed,
      numExecutors: node.numExecutors,
      icon: node.icon,
      iconClassName: node.iconClassName,
      monitorData: node.monitorData,
    })),
  };
}

async function getNode(params: { name: string }): Promise<any> {
  const nodeName = params.name === "master" || params.name === "(master)" ? "(master)" : params.name;
  const encodedName = encodeURIComponent(nodeName);
  const result = await jenkinsRequest("GET", `/computer/${encodedName}/api/json`);

  return {
    displayName: result.displayName,
    description: result.description,
    offline: result.offline,
    offlineCause: result.offlineCause,
    offlineCauseReason: result.offlineCauseReason,
    temporarilyOffline: result.temporarilyOffline,
    idle: result.idle,
    jnlpAgent: result.jnlpAgent,
    launchSupported: result.launchSupported,
    manualLaunchAllowed: result.manualLaunchAllowed,
    numExecutors: result.numExecutors,
    executors: result.executors,
    oneOffExecutors: result.oneOffExecutors,
    absoluteRemotePath: result.absoluteRemotePath,
    icon: result.icon,
    monitorData: result.monitorData,
  };
}

async function enableNode(params: { name: string }): Promise<any> {
  const nodeName = params.name === "master" || params.name === "(master)" ? "(master)" : params.name;
  const encodedName = encodeURIComponent(nodeName);
  await jenkinsPostRequest(`/computer/${encodedName}/toggleOffline`, undefined, "application/json", {
    offlineMessage: "",
  });
  return { name: params.name, enabled: true };
}

async function disableNode(params: { name: string; reason?: string }): Promise<any> {
  const nodeName = params.name === "master" || params.name === "(master)" ? "(master)" : params.name;
  const encodedName = encodeURIComponent(nodeName);
  await jenkinsPostRequest(`/computer/${encodedName}/toggleOffline`, undefined, "application/json", {
    offlineMessage: params.reason || "Disabled via MCP",
  });
  return { name: params.name, disabled: true, reason: params.reason };
}

async function listViews(): Promise<any> {
  const result = await jenkinsRequest("GET", "/api/json", undefined, "application/json", {
    tree: "views[name,url,description]",
  });

  return {
    views: (result.views || []).map((view: any) => ({
      name: view.name,
      url: view.url,
      description: view.description,
    })),
  };
}

async function getQueue(): Promise<any> {
  const result = await jenkinsRequest("GET", "/queue/api/json");

  return {
    items: (result.items || []).map((item: any) => ({
      id: item.id,
      task: {
        name: item.task?.name,
        url: item.task?.url,
        color: item.task?.color,
      },
      why: item.why,
      buildableStartMilliseconds: item.buildableStartMilliseconds,
      inQueueSince: item.inQueueSince,
      blocked: item.blocked,
      buildable: item.buildable,
      stuck: item.stuck,
      pending: item.pending,
      params: item.params,
      actions: item.actions,
    })),
  };
}

async function cancelQueueItem(params: { id: number }): Promise<any> {
  await jenkinsPostRequest("/queue/cancelItem", undefined, "application/json", {
    id: String(params.id),
  });
  return { id: params.id, cancelled: true };
}

async function listCredentials(params: { store?: string; domain?: string }): Promise<any> {
  const store = params.store || "system";
  const domain = params.domain || "_";

  const result = await jenkinsRequest(
    "GET",
    `/credentials/store/${store}/domain/${domain}/api/json`,
    undefined,
    "application/json",
    { tree: "credentials[id,displayName,description,typeName]" }
  );

  return {
    store,
    domain,
    credentials: (result.credentials || []).map((cred: any) => ({
      id: cred.id,
      displayName: cred.displayName,
      description: cred.description,
      typeName: cred.typeName,
    })),
  };
}

async function getCrumb(): Promise<any> {
  const result = await jenkinsRequest("GET", "/crumbIssuer/api/json");
  return {
    crumb: result.crumb,
    crumbRequestField: result.crumbRequestField,
  };
}

async function restartJenkins(params: { safe?: boolean }): Promise<any> {
  const safe = params.safe !== false;
  const endpoint = safe ? "/safeRestart" : "/restart";
  await jenkinsPostRequest(endpoint);
  return { restarting: true, safe };
}

// Server setup
const server = new Server(
  { name: "jenkins-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result: any;
    switch (name) {
      // Job Management
      case "list_jobs":
        result = await listJobs(args as any);
        break;
      case "get_job":
        result = await getJob(args as any);
        break;
      case "create_job":
        result = await createJob(args as any);
        break;
      case "delete_job":
        result = await deleteJob(args as any);
        break;

      // Build Management
      case "build_job":
        result = await buildJob(args as any);
        break;
      case "build_with_params":
        result = await buildWithParams(args as any);
        break;
      case "list_builds":
        result = await listBuilds(args as any);
        break;
      case "get_build":
        result = await getBuild(args as any);
        break;
      case "get_build_log":
        result = await getBuildLog(args as any);
        break;
      case "stop_build":
        result = await stopBuild(args as any);
        break;

      // Node Management
      case "list_nodes":
        result = await listNodes();
        break;
      case "get_node":
        result = await getNode(args as any);
        break;
      case "enable_node":
        result = await enableNode(args as any);
        break;
      case "disable_node":
        result = await disableNode(args as any);
        break;

      // View Management
      case "list_views":
        result = await listViews();
        break;

      // Queue Management
      case "get_queue":
        result = await getQueue();
        break;
      case "cancel_queue_item":
        result = await cancelQueueItem(args as any);
        break;

      // Credentials Management
      case "list_credentials":
        result = await listCredentials(args as any);
        break;

      // System Management
      case "get_crumb":
        result = await getCrumb();
        break;
      case "restart_jenkins":
        result = await restartJenkins(args as any);
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
  console.error("Jenkins MCP Server running on stdio");
}

main().catch(console.error);
