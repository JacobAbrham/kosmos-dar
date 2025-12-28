/**
 * dbt Cloud MCP Server - Data transformation and analytics engineering for KOSMOS
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";

const config = {
  apiUrl: process.env.DBT_CLOUD_URL || "https://cloud.getdbt.com/api/v2",
  token: process.env.DBT_CLOUD_TOKEN || "",
  accountId: process.env.DBT_ACCOUNT_ID || "",
};

async function dbtRequest(method: string, path: string, body?: any): Promise<any> {
  const url = `${config.apiUrl}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Token ${config.token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.status?.user_message || error.message || res.statusText);
  }

  return res.json();
}

// Helper to get account path
function accountPath(): string {
  return `/accounts/${config.accountId}`;
}

const TOOLS: Tool[] = [
  // Accounts
  {
    name: "list_accounts",
    description: "List all dbt Cloud accounts accessible to the current user.",
    inputSchema: { type: "object", properties: {} },
  },
  // Projects
  {
    name: "list_projects",
    description: "List all projects in the account.",
    inputSchema: {
      type: "object",
      properties: {
        state: { type: "number", description: "Filter by project state (1=active, 2=deleted)" },
      },
    },
  },
  {
    name: "get_project",
    description: "Get details of a specific project.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "number", description: "The project ID" },
      },
      required: ["projectId"],
    },
  },
  // Environments
  {
    name: "list_environments",
    description: "List all environments in a project.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "number", description: "The project ID" },
      },
      required: ["projectId"],
    },
  },
  {
    name: "get_environment",
    description: "Get details of a specific environment.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "number", description: "The project ID" },
        environmentId: { type: "number", description: "The environment ID" },
      },
      required: ["projectId", "environmentId"],
    },
  },
  // Jobs
  {
    name: "list_jobs",
    description: "List all jobs in the account or a specific project.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "number", description: "Filter by project ID" },
        environmentId: { type: "number", description: "Filter by environment ID" },
        state: { type: "number", description: "Filter by job state (1=active)" },
        offset: { type: "number", description: "Pagination offset" },
        limit: { type: "number", description: "Number of results to return" },
      },
    },
  },
  {
    name: "get_job",
    description: "Get details of a specific job.",
    inputSchema: {
      type: "object",
      properties: {
        jobId: { type: "number", description: "The job ID" },
      },
      required: ["jobId"],
    },
  },
  {
    name: "trigger_job",
    description: "Trigger a job run.",
    inputSchema: {
      type: "object",
      properties: {
        jobId: { type: "number", description: "The job ID to trigger" },
        cause: { type: "string", description: "Reason for triggering the job" },
        gitSha: { type: "string", description: "Git SHA to run (optional)" },
        gitBranch: { type: "string", description: "Git branch to run (optional)" },
        schemaOverride: { type: "string", description: "Override the target schema (optional)" },
        dbtVersionOverride: { type: "string", description: "Override the dbt version (optional)" },
        threadsOverride: { type: "number", description: "Override the number of threads (optional)" },
        targetNameOverride: { type: "string", description: "Override the target name (optional)" },
        generateDocsOverride: { type: "boolean", description: "Override generate docs setting (optional)" },
        timeoutSecondsOverride: { type: "number", description: "Override timeout in seconds (optional)" },
        stepsOverride: { type: "array", items: { type: "string" }, description: "Override the steps to run (optional)" },
      },
      required: ["jobId", "cause"],
    },
  },
  // Runs
  {
    name: "list_runs",
    description: "List job runs.",
    inputSchema: {
      type: "object",
      properties: {
        jobId: { type: "number", description: "Filter by job ID" },
        projectId: { type: "number", description: "Filter by project ID" },
        environmentId: { type: "number", description: "Filter by environment ID" },
        status: { type: "string", description: "Filter by status (queued, starting, running, success, error, cancelled)" },
        orderBy: { type: "string", description: "Order by field (e.g., '-created_at')" },
        offset: { type: "number", description: "Pagination offset" },
        limit: { type: "number", description: "Number of results to return" },
      },
    },
  },
  {
    name: "get_run",
    description: "Get details of a specific run.",
    inputSchema: {
      type: "object",
      properties: {
        runId: { type: "number", description: "The run ID" },
        includeRelated: { type: "array", items: { type: "string" }, description: "Include related data (e.g., ['trigger', 'job'])" },
      },
      required: ["runId"],
    },
  },
  {
    name: "cancel_run",
    description: "Cancel a running job.",
    inputSchema: {
      type: "object",
      properties: {
        runId: { type: "number", description: "The run ID to cancel" },
      },
      required: ["runId"],
    },
  },
  {
    name: "get_run_artifact",
    description: "Get an artifact from a run (manifest.json, catalog.json, run_results.json, sources.json).",
    inputSchema: {
      type: "object",
      properties: {
        runId: { type: "number", description: "The run ID" },
        path: { type: "string", description: "Artifact path (e.g., 'manifest.json', 'catalog.json', 'run_results.json')" },
        step: { type: "number", description: "Step number (optional, defaults to last step)" },
      },
      required: ["runId", "path"],
    },
  },
  // Models (via Discovery API)
  {
    name: "list_models",
    description: "List models in a project (requires Discovery API access).",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "number", description: "The project ID" },
        environmentId: { type: "number", description: "The environment ID" },
        database: { type: "string", description: "Filter by database" },
        schema: { type: "string", description: "Filter by schema" },
      },
      required: ["projectId", "environmentId"],
    },
  },
  {
    name: "get_model",
    description: "Get details of a specific model.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "number", description: "The project ID" },
        environmentId: { type: "number", description: "The environment ID" },
        uniqueId: { type: "string", description: "The model unique ID (e.g., 'model.my_project.my_model')" },
      },
      required: ["projectId", "environmentId", "uniqueId"],
    },
  },
  // Sources
  {
    name: "list_sources",
    description: "List sources in a project.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "number", description: "The project ID" },
        environmentId: { type: "number", description: "The environment ID" },
        database: { type: "string", description: "Filter by database" },
        schema: { type: "string", description: "Filter by schema" },
      },
      required: ["projectId", "environmentId"],
    },
  },
  // Tests
  {
    name: "list_tests",
    description: "List tests in a project.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "number", description: "The project ID" },
        environmentId: { type: "number", description: "The environment ID" },
      },
      required: ["projectId", "environmentId"],
    },
  },
  {
    name: "get_run_results",
    description: "Get test and run results from a specific run.",
    inputSchema: {
      type: "object",
      properties: {
        runId: { type: "number", description: "The run ID" },
      },
      required: ["runId"],
    },
  },
  // Exposures
  {
    name: "list_exposures",
    description: "List exposures in a project.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "number", description: "The project ID" },
        environmentId: { type: "number", description: "The environment ID" },
      },
      required: ["projectId", "environmentId"],
    },
  },
  // Metrics
  {
    name: "list_metrics",
    description: "List metrics in a project.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "number", description: "The project ID" },
        environmentId: { type: "number", description: "The environment ID" },
      },
      required: ["projectId", "environmentId"],
    },
  },
  // Docs
  {
    name: "get_docs",
    description: "Get the generated documentation URL for a project.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "number", description: "The project ID" },
        jobId: { type: "number", description: "The job ID that generated docs" },
      },
      required: ["projectId", "jobId"],
    },
  },
];

// Account functions
async function listAccounts(): Promise<any> {
  return dbtRequest("GET", "/accounts/");
}

// Project functions
async function listProjects(params: { state?: number }): Promise<any> {
  let path = `${accountPath()}/projects/`;
  const queryParams: string[] = [];
  if (params.state !== undefined) queryParams.push(`state=${params.state}`);
  if (queryParams.length > 0) path += `?${queryParams.join("&")}`;
  return dbtRequest("GET", path);
}

async function getProject(params: { projectId: number }): Promise<any> {
  return dbtRequest("GET", `${accountPath()}/projects/${params.projectId}/`);
}

// Environment functions
async function listEnvironments(params: { projectId: number }): Promise<any> {
  return dbtRequest("GET", `${accountPath()}/projects/${params.projectId}/environments/`);
}

async function getEnvironment(params: { projectId: number; environmentId: number }): Promise<any> {
  return dbtRequest("GET", `${accountPath()}/projects/${params.projectId}/environments/${params.environmentId}/`);
}

// Job functions
async function listJobs(params: {
  projectId?: number;
  environmentId?: number;
  state?: number;
  offset?: number;
  limit?: number;
}): Promise<any> {
  let path = `${accountPath()}/jobs/`;
  const queryParams: string[] = [];
  if (params.projectId !== undefined) queryParams.push(`project_id=${params.projectId}`);
  if (params.environmentId !== undefined) queryParams.push(`environment_id=${params.environmentId}`);
  if (params.state !== undefined) queryParams.push(`state=${params.state}`);
  if (params.offset !== undefined) queryParams.push(`offset=${params.offset}`);
  if (params.limit !== undefined) queryParams.push(`limit=${params.limit}`);
  if (queryParams.length > 0) path += `?${queryParams.join("&")}`;
  return dbtRequest("GET", path);
}

async function getJob(params: { jobId: number }): Promise<any> {
  return dbtRequest("GET", `${accountPath()}/jobs/${params.jobId}/`);
}

async function triggerJob(params: {
  jobId: number;
  cause: string;
  gitSha?: string;
  gitBranch?: string;
  schemaOverride?: string;
  dbtVersionOverride?: string;
  threadsOverride?: number;
  targetNameOverride?: string;
  generateDocsOverride?: boolean;
  timeoutSecondsOverride?: number;
  stepsOverride?: string[];
}): Promise<any> {
  const body: any = { cause: params.cause };
  if (params.gitSha) body.git_sha = params.gitSha;
  if (params.gitBranch) body.git_branch = params.gitBranch;
  if (params.schemaOverride) body.schema_override = params.schemaOverride;
  if (params.dbtVersionOverride) body.dbt_version_override = params.dbtVersionOverride;
  if (params.threadsOverride !== undefined) body.threads_override = params.threadsOverride;
  if (params.targetNameOverride) body.target_name_override = params.targetNameOverride;
  if (params.generateDocsOverride !== undefined) body.generate_docs_override = params.generateDocsOverride;
  if (params.timeoutSecondsOverride !== undefined) body.timeout_seconds_override = params.timeoutSecondsOverride;
  if (params.stepsOverride) body.steps_override = params.stepsOverride;
  return dbtRequest("POST", `${accountPath()}/jobs/${params.jobId}/run/`, body);
}

// Run functions
async function listRuns(params: {
  jobId?: number;
  projectId?: number;
  environmentId?: number;
  status?: string;
  orderBy?: string;
  offset?: number;
  limit?: number;
}): Promise<any> {
  let path = `${accountPath()}/runs/`;
  const queryParams: string[] = [];
  if (params.jobId !== undefined) queryParams.push(`job_definition_id=${params.jobId}`);
  if (params.projectId !== undefined) queryParams.push(`project_id=${params.projectId}`);
  if (params.environmentId !== undefined) queryParams.push(`environment_id=${params.environmentId}`);
  if (params.status) queryParams.push(`status=${params.status}`);
  if (params.orderBy) queryParams.push(`order_by=${params.orderBy}`);
  if (params.offset !== undefined) queryParams.push(`offset=${params.offset}`);
  if (params.limit !== undefined) queryParams.push(`limit=${params.limit}`);
  if (queryParams.length > 0) path += `?${queryParams.join("&")}`;
  return dbtRequest("GET", path);
}

async function getRun(params: { runId: number; includeRelated?: string[] }): Promise<any> {
  let path = `${accountPath()}/runs/${params.runId}/`;
  if (params.includeRelated && params.includeRelated.length > 0) {
    path += `?include_related=${params.includeRelated.join(",")}`;
  }
  return dbtRequest("GET", path);
}

async function cancelRun(params: { runId: number }): Promise<any> {
  return dbtRequest("POST", `${accountPath()}/runs/${params.runId}/cancel/`);
}

async function getRunArtifact(params: { runId: number; path: string; step?: number }): Promise<any> {
  let artifactPath = `${accountPath()}/runs/${params.runId}/artifacts/${params.path}`;
  if (params.step !== undefined) {
    artifactPath += `?step=${params.step}`;
  }
  return dbtRequest("GET", artifactPath);
}

// Discovery API functions (for models, sources, tests, etc.)
async function discoveryQuery(projectId: number, environmentId: number, query: string): Promise<any> {
  // Discovery API uses GraphQL
  const discoveryUrl = process.env.DBT_DISCOVERY_URL || "https://metadata.cloud.getdbt.com/graphql";
  const res = await fetch(discoveryUrl, {
    method: "POST",
    headers: {
      Authorization: `Token ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      variables: {
        environmentId,
      },
    }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || res.statusText);
  }

  return res.json();
}

async function listModels(params: {
  projectId: number;
  environmentId: number;
  database?: string;
  schema?: string;
}): Promise<any> {
  const query = `
    query ($environmentId: BigInt!) {
      environment(id: $environmentId) {
        definition {
          models {
            uniqueId
            name
            database
            schema
            description
            packageName
            materializedType
            meta
          }
        }
      }
    }
  `;
  const result = await discoveryQuery(params.projectId, params.environmentId, query);
  let models = result.data?.environment?.definition?.models || [];

  // Apply filters
  if (params.database) {
    models = models.filter((m: any) => m.database === params.database);
  }
  if (params.schema) {
    models = models.filter((m: any) => m.schema === params.schema);
  }

  return { data: models };
}

async function getModel(params: {
  projectId: number;
  environmentId: number;
  uniqueId: string;
}): Promise<any> {
  const query = `
    query ($environmentId: BigInt!) {
      environment(id: $environmentId) {
        definition {
          models(filter: { uniqueIds: ["${params.uniqueId}"] }) {
            uniqueId
            name
            database
            schema
            description
            packageName
            materializedType
            meta
            columns {
              name
              description
              type
            }
            dependsOn
            tags
            rawCode
            compiledCode
          }
        }
      }
    }
  `;
  const result = await discoveryQuery(params.projectId, params.environmentId, query);
  const models = result.data?.environment?.definition?.models || [];
  return { data: models[0] || null };
}

async function listSources(params: {
  projectId: number;
  environmentId: number;
  database?: string;
  schema?: string;
}): Promise<any> {
  const query = `
    query ($environmentId: BigInt!) {
      environment(id: $environmentId) {
        definition {
          sources {
            uniqueId
            name
            sourceName
            database
            schema
            description
            identifier
            loader
            meta
            freshnessChecked
            maxLoadedAt
            snapshottedAt
            state
          }
        }
      }
    }
  `;
  const result = await discoveryQuery(params.projectId, params.environmentId, query);
  let sources = result.data?.environment?.definition?.sources || [];

  // Apply filters
  if (params.database) {
    sources = sources.filter((s: any) => s.database === params.database);
  }
  if (params.schema) {
    sources = sources.filter((s: any) => s.schema === params.schema);
  }

  return { data: sources };
}

async function listTests(params: { projectId: number; environmentId: number }): Promise<any> {
  const query = `
    query ($environmentId: BigInt!) {
      environment(id: $environmentId) {
        definition {
          tests {
            uniqueId
            name
            columnName
            dependsOn
            tags
            status
            executionTime
            failures
          }
        }
      }
    }
  `;
  const result = await discoveryQuery(params.projectId, params.environmentId, query);
  return { data: result.data?.environment?.definition?.tests || [] };
}

async function getRunResults(params: { runId: number }): Promise<any> {
  // Get run_results.json artifact
  return getRunArtifact({ runId: params.runId, path: "run_results.json" });
}

async function listExposures(params: { projectId: number; environmentId: number }): Promise<any> {
  const query = `
    query ($environmentId: BigInt!) {
      environment(id: $environmentId) {
        definition {
          exposures {
            uniqueId
            name
            description
            type
            owner {
              name
              email
            }
            url
            dependsOn
            tags
            meta
          }
        }
      }
    }
  `;
  const result = await discoveryQuery(params.projectId, params.environmentId, query);
  return { data: result.data?.environment?.definition?.exposures || [] };
}

async function listMetrics(params: { projectId: number; environmentId: number }): Promise<any> {
  const query = `
    query ($environmentId: BigInt!) {
      environment(id: $environmentId) {
        definition {
          metrics {
            uniqueId
            name
            description
            type
            label
            filters
            dimensions
            timeGrains
            dependsOn
            tags
            meta
          }
        }
      }
    }
  `;
  const result = await discoveryQuery(params.projectId, params.environmentId, query);
  return { data: result.data?.environment?.definition?.metrics || [] };
}

async function getDocs(params: { projectId: number; jobId: number }): Promise<any> {
  // Get the latest successful run for the job that generated docs
  const runs = await listRuns({
    jobId: params.jobId,
    projectId: params.projectId,
    status: "success",
    orderBy: "-created_at",
    limit: 1,
  });

  if (!runs.data || runs.data.length === 0) {
    throw new Error("No successful runs found for this job");
  }

  const run = runs.data[0];
  const docsUrl = `https://cloud.getdbt.com/accounts/${config.accountId}/runs/${run.id}/docs/`;

  return {
    data: {
      runId: run.id,
      docsUrl,
      generatedAt: run.finished_at,
      status: "available",
    },
  };
}

const server = new Server(
  { name: "dbt-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result: any;
    switch (name) {
      // Accounts
      case "list_accounts":
        result = await listAccounts();
        break;
      // Projects
      case "list_projects":
        result = await listProjects(args as any);
        break;
      case "get_project":
        result = await getProject(args as any);
        break;
      // Environments
      case "list_environments":
        result = await listEnvironments(args as any);
        break;
      case "get_environment":
        result = await getEnvironment(args as any);
        break;
      // Jobs
      case "list_jobs":
        result = await listJobs(args as any);
        break;
      case "get_job":
        result = await getJob(args as any);
        break;
      case "trigger_job":
        result = await triggerJob(args as any);
        break;
      // Runs
      case "list_runs":
        result = await listRuns(args as any);
        break;
      case "get_run":
        result = await getRun(args as any);
        break;
      case "cancel_run":
        result = await cancelRun(args as any);
        break;
      case "get_run_artifact":
        result = await getRunArtifact(args as any);
        break;
      // Models
      case "list_models":
        result = await listModels(args as any);
        break;
      case "get_model":
        result = await getModel(args as any);
        break;
      // Sources
      case "list_sources":
        result = await listSources(args as any);
        break;
      // Tests
      case "list_tests":
        result = await listTests(args as any);
        break;
      case "get_run_results":
        result = await getRunResults(args as any);
        break;
      // Exposures
      case "list_exposures":
        result = await listExposures(args as any);
        break;
      // Metrics
      case "list_metrics":
        result = await listMetrics(args as any);
        break;
      // Docs
      case "get_docs":
        result = await getDocs(args as any);
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (error: any) {
    return { content: [{ type: "text", text: JSON.stringify({ error: error.message }) }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("dbt Cloud MCP Server running on stdio");
}

main().catch(console.error);
