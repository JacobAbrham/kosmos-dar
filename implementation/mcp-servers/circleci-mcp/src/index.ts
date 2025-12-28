/**
 * CircleCI MCP Server
 *
 * CircleCI CI/CD pipeline management for KOSMOS agents including:
 * - Pipeline operations
 * - Workflow management
 * - Job operations
 * - Project management
 * - Environment variables
 * - Contexts
 * - Insights
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// Environment configuration
const CIRCLECI_TOKEN = process.env.CIRCLECI_TOKEN || "";
const CIRCLECI_API_BASE = "https://circleci.com/api/v2";

// API helper
async function circleciRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${CIRCLECI_API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Circle-Token": CIRCLECI_TOKEN,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`CircleCI API error (${response.status}): ${error}`);
  }

  return response.json() as Promise<T>;
}

// Tool schemas
const ListPipelinesSchema = z.object({
  projectSlug: z.string().describe("Project slug (e.g., gh/owner/repo)"),
  branch: z.string().optional().describe("Filter by branch"),
  pageToken: z.string().optional().describe("Pagination token"),
});

const GetPipelineSchema = z.object({
  pipelineId: z.string().describe("Pipeline ID"),
});

const TriggerPipelineSchema = z.object({
  projectSlug: z.string().describe("Project slug (e.g., gh/owner/repo)"),
  branch: z.string().optional().describe("Branch to build"),
  tag: z.string().optional().describe("Tag to build"),
  parameters: z.record(z.any()).optional().describe("Pipeline parameters"),
});

const ListWorkflowsSchema = z.object({
  pipelineId: z.string().describe("Pipeline ID"),
  pageToken: z.string().optional().describe("Pagination token"),
});

const GetWorkflowSchema = z.object({
  workflowId: z.string().describe("Workflow ID"),
});

const CancelWorkflowSchema = z.object({
  workflowId: z.string().describe("Workflow ID to cancel"),
});

const RerunWorkflowSchema = z.object({
  workflowId: z.string().describe("Workflow ID to rerun"),
  fromFailed: z.boolean().default(false).describe("Only rerun failed jobs"),
  sparseTree: z.boolean().default(false).describe("Rerun as sparse tree"),
});

const ListJobsSchema = z.object({
  workflowId: z.string().describe("Workflow ID"),
  pageToken: z.string().optional().describe("Pagination token"),
});

const GetJobSchema = z.object({
  projectSlug: z.string().describe("Project slug (e.g., gh/owner/repo)"),
  jobNumber: z.number().describe("Job number"),
});

const GetJobArtifactsSchema = z.object({
  projectSlug: z.string().describe("Project slug (e.g., gh/owner/repo)"),
  jobNumber: z.number().describe("Job number"),
  pageToken: z.string().optional().describe("Pagination token"),
});

const ListProjectsSchema = z.object({
  pageToken: z.string().optional().describe("Pagination token"),
});

const GetProjectSchema = z.object({
  projectSlug: z.string().describe("Project slug (e.g., gh/owner/repo)"),
});

const ListEnvvarsSchema = z.object({
  projectSlug: z.string().describe("Project slug (e.g., gh/owner/repo)"),
  pageToken: z.string().optional().describe("Pagination token"),
});

const CreateEnvvarSchema = z.object({
  projectSlug: z.string().describe("Project slug (e.g., gh/owner/repo)"),
  name: z.string().describe("Environment variable name"),
  value: z.string().describe("Environment variable value"),
});

const DeleteEnvvarSchema = z.object({
  projectSlug: z.string().describe("Project slug (e.g., gh/owner/repo)"),
  name: z.string().describe("Environment variable name"),
});

const ListContextsSchema = z.object({
  ownerId: z.string().describe("Organization ID"),
  ownerType: z.enum(["account", "organization"]).default("organization"),
  pageToken: z.string().optional().describe("Pagination token"),
});

const GetContextSchema = z.object({
  contextId: z.string().describe("Context ID"),
});

const ListInsightsSchema = z.object({
  projectSlug: z.string().describe("Project slug (e.g., gh/owner/repo)"),
  branch: z.string().optional().describe("Filter by branch"),
  reportingWindow: z.enum(["last-7-days", "last-30-days", "last-60-days", "last-90-days"]).default("last-30-days"),
});

const GetUserSchema = z.object({});

const ListCollaborationsSchema = z.object({});

// Tool definitions
const TOOLS: Tool[] = [
  {
    name: "list_pipelines",
    description: "List pipelines for a project",
    inputSchema: {
      type: "object",
      properties: {
        projectSlug: { type: "string", description: "Project slug (e.g., gh/owner/repo)" },
        branch: { type: "string", description: "Filter by branch" },
        pageToken: { type: "string", description: "Pagination token" },
      },
      required: ["projectSlug"],
    },
  },
  {
    name: "get_pipeline",
    description: "Get details of a specific pipeline",
    inputSchema: {
      type: "object",
      properties: {
        pipelineId: { type: "string", description: "Pipeline ID" },
      },
      required: ["pipelineId"],
    },
  },
  {
    name: "trigger_pipeline",
    description: "Trigger a new pipeline for a project",
    inputSchema: {
      type: "object",
      properties: {
        projectSlug: { type: "string", description: "Project slug (e.g., gh/owner/repo)" },
        branch: { type: "string", description: "Branch to build" },
        tag: { type: "string", description: "Tag to build" },
        parameters: { type: "object", description: "Pipeline parameters" },
      },
      required: ["projectSlug"],
    },
  },
  {
    name: "list_workflows",
    description: "List workflows in a pipeline",
    inputSchema: {
      type: "object",
      properties: {
        pipelineId: { type: "string", description: "Pipeline ID" },
        pageToken: { type: "string", description: "Pagination token" },
      },
      required: ["pipelineId"],
    },
  },
  {
    name: "get_workflow",
    description: "Get details of a specific workflow",
    inputSchema: {
      type: "object",
      properties: {
        workflowId: { type: "string", description: "Workflow ID" },
      },
      required: ["workflowId"],
    },
  },
  {
    name: "cancel_workflow",
    description: "Cancel a running workflow",
    inputSchema: {
      type: "object",
      properties: {
        workflowId: { type: "string", description: "Workflow ID to cancel" },
      },
      required: ["workflowId"],
    },
  },
  {
    name: "rerun_workflow",
    description: "Rerun a workflow",
    inputSchema: {
      type: "object",
      properties: {
        workflowId: { type: "string", description: "Workflow ID to rerun" },
        fromFailed: { type: "boolean", default: false, description: "Only rerun failed jobs" },
        sparseTree: { type: "boolean", default: false, description: "Rerun as sparse tree" },
      },
      required: ["workflowId"],
    },
  },
  {
    name: "list_jobs",
    description: "List jobs in a workflow",
    inputSchema: {
      type: "object",
      properties: {
        workflowId: { type: "string", description: "Workflow ID" },
        pageToken: { type: "string", description: "Pagination token" },
      },
      required: ["workflowId"],
    },
  },
  {
    name: "get_job",
    description: "Get details of a specific job",
    inputSchema: {
      type: "object",
      properties: {
        projectSlug: { type: "string", description: "Project slug (e.g., gh/owner/repo)" },
        jobNumber: { type: "number", description: "Job number" },
      },
      required: ["projectSlug", "jobNumber"],
    },
  },
  {
    name: "get_job_artifacts",
    description: "Get artifacts from a job",
    inputSchema: {
      type: "object",
      properties: {
        projectSlug: { type: "string", description: "Project slug (e.g., gh/owner/repo)" },
        jobNumber: { type: "number", description: "Job number" },
        pageToken: { type: "string", description: "Pagination token" },
      },
      required: ["projectSlug", "jobNumber"],
    },
  },
  {
    name: "list_projects",
    description: "List followed projects",
    inputSchema: {
      type: "object",
      properties: {
        pageToken: { type: "string", description: "Pagination token" },
      },
    },
  },
  {
    name: "get_project",
    description: "Get project details",
    inputSchema: {
      type: "object",
      properties: {
        projectSlug: { type: "string", description: "Project slug (e.g., gh/owner/repo)" },
      },
      required: ["projectSlug"],
    },
  },
  {
    name: "list_envvars",
    description: "List environment variables for a project",
    inputSchema: {
      type: "object",
      properties: {
        projectSlug: { type: "string", description: "Project slug (e.g., gh/owner/repo)" },
        pageToken: { type: "string", description: "Pagination token" },
      },
      required: ["projectSlug"],
    },
  },
  {
    name: "create_envvar",
    description: "Create an environment variable for a project",
    inputSchema: {
      type: "object",
      properties: {
        projectSlug: { type: "string", description: "Project slug (e.g., gh/owner/repo)" },
        name: { type: "string", description: "Environment variable name" },
        value: { type: "string", description: "Environment variable value" },
      },
      required: ["projectSlug", "name", "value"],
    },
  },
  {
    name: "delete_envvar",
    description: "Delete an environment variable from a project",
    inputSchema: {
      type: "object",
      properties: {
        projectSlug: { type: "string", description: "Project slug (e.g., gh/owner/repo)" },
        name: { type: "string", description: "Environment variable name" },
      },
      required: ["projectSlug", "name"],
    },
  },
  {
    name: "list_contexts",
    description: "List contexts for an organization",
    inputSchema: {
      type: "object",
      properties: {
        ownerId: { type: "string", description: "Organization ID" },
        ownerType: { type: "string", enum: ["account", "organization"], default: "organization" },
        pageToken: { type: "string", description: "Pagination token" },
      },
      required: ["ownerId"],
    },
  },
  {
    name: "get_context",
    description: "Get context details",
    inputSchema: {
      type: "object",
      properties: {
        contextId: { type: "string", description: "Context ID" },
      },
      required: ["contextId"],
    },
  },
  {
    name: "list_insights",
    description: "Get project insights and metrics",
    inputSchema: {
      type: "object",
      properties: {
        projectSlug: { type: "string", description: "Project slug (e.g., gh/owner/repo)" },
        branch: { type: "string", description: "Filter by branch" },
        reportingWindow: {
          type: "string",
          enum: ["last-7-days", "last-30-days", "last-60-days", "last-90-days"],
          default: "last-30-days"
        },
      },
      required: ["projectSlug"],
    },
  },
  {
    name: "get_user",
    description: "Get current authenticated user information",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "list_collaborations",
    description: "List organizations and accounts the user collaborates with",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

// Tool implementations

async function listPipelines(params: z.infer<typeof ListPipelinesSchema>): Promise<any> {
  const queryParams = new URLSearchParams();
  if (params.branch) queryParams.set("branch", params.branch);
  if (params.pageToken) queryParams.set("page-token", params.pageToken);

  const query = queryParams.toString();
  const endpoint = `/project/${params.projectSlug}/pipeline${query ? `?${query}` : ""}`;

  const result = await circleciRequest<any>(endpoint);

  return {
    nextPageToken: result.next_page_token,
    pipelines: result.items.map((p: any) => ({
      id: p.id,
      number: p.number,
      state: p.state,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      trigger: {
        type: p.trigger?.type,
        receivedAt: p.trigger?.received_at,
        actor: p.trigger?.actor?.login,
      },
      vcs: {
        branch: p.vcs?.branch,
        tag: p.vcs?.tag,
        revision: p.vcs?.revision,
        originRepositoryUrl: p.vcs?.origin_repository_url,
      },
    })),
  };
}

async function getPipeline(params: z.infer<typeof GetPipelineSchema>): Promise<any> {
  const result = await circleciRequest<any>(`/pipeline/${params.pipelineId}`);

  return {
    id: result.id,
    number: result.number,
    state: result.state,
    createdAt: result.created_at,
    updatedAt: result.updated_at,
    trigger: {
      type: result.trigger?.type,
      receivedAt: result.trigger?.received_at,
      actor: result.trigger?.actor?.login,
    },
    vcs: {
      branch: result.vcs?.branch,
      tag: result.vcs?.tag,
      revision: result.vcs?.revision,
      originRepositoryUrl: result.vcs?.origin_repository_url,
    },
    projectSlug: result.project_slug,
  };
}

async function triggerPipeline(params: z.infer<typeof TriggerPipelineSchema>): Promise<any> {
  const body: any = {};
  if (params.branch) body.branch = params.branch;
  if (params.tag) body.tag = params.tag;
  if (params.parameters) body.parameters = params.parameters;

  const result = await circleciRequest<any>(
    `/project/${params.projectSlug}/pipeline`,
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  );

  return {
    id: result.id,
    number: result.number,
    state: result.state,
    createdAt: result.created_at,
  };
}

async function listWorkflows(params: z.infer<typeof ListWorkflowsSchema>): Promise<any> {
  const queryParams = new URLSearchParams();
  if (params.pageToken) queryParams.set("page-token", params.pageToken);

  const query = queryParams.toString();
  const endpoint = `/pipeline/${params.pipelineId}/workflow${query ? `?${query}` : ""}`;

  const result = await circleciRequest<any>(endpoint);

  return {
    nextPageToken: result.next_page_token,
    workflows: result.items.map((w: any) => ({
      id: w.id,
      name: w.name,
      status: w.status,
      createdAt: w.created_at,
      stoppedAt: w.stopped_at,
      pipelineId: w.pipeline_id,
      pipelineNumber: w.pipeline_number,
      projectSlug: w.project_slug,
    })),
  };
}

async function getWorkflow(params: z.infer<typeof GetWorkflowSchema>): Promise<any> {
  const result = await circleciRequest<any>(`/workflow/${params.workflowId}`);

  return {
    id: result.id,
    name: result.name,
    status: result.status,
    createdAt: result.created_at,
    stoppedAt: result.stopped_at,
    pipelineId: result.pipeline_id,
    pipelineNumber: result.pipeline_number,
    projectSlug: result.project_slug,
    canceledBy: result.canceled_by,
    errorsBy: result.errors_by,
    tag: result.tag,
  };
}

async function cancelWorkflow(params: z.infer<typeof CancelWorkflowSchema>): Promise<any> {
  await circleciRequest<any>(
    `/workflow/${params.workflowId}/cancel`,
    { method: "POST" }
  );

  return {
    workflowId: params.workflowId,
    message: "Workflow cancellation requested",
  };
}

async function rerunWorkflow(params: z.infer<typeof RerunWorkflowSchema>): Promise<any> {
  const body: any = {};
  if (params.fromFailed) body.from_failed = params.fromFailed;
  if (params.sparseTree) body.sparse_tree = params.sparseTree;

  const result = await circleciRequest<any>(
    `/workflow/${params.workflowId}/rerun`,
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  );

  return {
    workflowId: result.workflow_id,
  };
}

async function listJobs(params: z.infer<typeof ListJobsSchema>): Promise<any> {
  const queryParams = new URLSearchParams();
  if (params.pageToken) queryParams.set("page-token", params.pageToken);

  const query = queryParams.toString();
  const endpoint = `/workflow/${params.workflowId}/job${query ? `?${query}` : ""}`;

  const result = await circleciRequest<any>(endpoint);

  return {
    nextPageToken: result.next_page_token,
    jobs: result.items.map((j: any) => ({
      id: j.id,
      name: j.name,
      status: j.status,
      type: j.type,
      jobNumber: j.job_number,
      startedAt: j.started_at,
      stoppedAt: j.stopped_at,
      approvalRequestId: j.approval_request_id,
      approvedBy: j.approved_by,
      dependencies: j.dependencies,
      projectSlug: j.project_slug,
    })),
  };
}

async function getJob(params: z.infer<typeof GetJobSchema>): Promise<any> {
  const result = await circleciRequest<any>(
    `/project/${params.projectSlug}/job/${params.jobNumber}`
  );

  return {
    webUrl: result.web_url,
    project: {
      slug: result.project?.slug,
      name: result.project?.name,
      externalUrl: result.project?.external_url,
    },
    parallelRuns: result.parallel_runs,
    startedAt: result.started_at,
    latestWorkflow: {
      id: result.latest_workflow?.id,
      name: result.latest_workflow?.name,
    },
    name: result.name,
    executor: {
      type: result.executor?.type,
      resourceClass: result.executor?.resource_class,
    },
    parallelism: result.parallelism,
    status: result.status,
    number: result.number,
    pipeline: {
      id: result.pipeline?.id,
    },
    duration: result.duration,
    createdAt: result.created_at,
    contexts: result.contexts,
    organization: {
      name: result.organization?.name,
    },
    queuedAt: result.queued_at,
    stoppedAt: result.stopped_at,
  };
}

async function getJobArtifacts(params: z.infer<typeof GetJobArtifactsSchema>): Promise<any> {
  const queryParams = new URLSearchParams();
  if (params.pageToken) queryParams.set("page-token", params.pageToken);

  const query = queryParams.toString();
  const endpoint = `/project/${params.projectSlug}/${params.jobNumber}/artifacts${query ? `?${query}` : ""}`;

  const result = await circleciRequest<any>(endpoint);

  return {
    nextPageToken: result.next_page_token,
    artifacts: result.items.map((a: any) => ({
      path: a.path,
      nodeIndex: a.node_index,
      url: a.url,
    })),
  };
}

async function listProjects(_params: z.infer<typeof ListProjectsSchema>): Promise<any> {
  const result = await circleciRequest<any>("/me/collaborations");

  // Get projects for each collaboration
  const projects: any[] = [];
  for (const collab of result) {
    try {
      const projectsResult = await circleciRequest<any>(
        `/project?org-id=${collab.id}`
      );
      if (projectsResult.items) {
        projects.push(...projectsResult.items);
      }
    } catch {
      // Some collaborations may not have projects
    }
  }

  return {
    projects: projects.map((p: any) => ({
      slug: p.slug,
      name: p.name,
      organizationName: p.organization_name,
      organizationSlug: p.organization_slug,
      organizationId: p.organization_id,
      vcsInfo: {
        vcsUrl: p.vcs_info?.vcs_url,
        provider: p.vcs_info?.provider,
        defaultBranch: p.vcs_info?.default_branch,
      },
    })),
  };
}

async function getProject(params: z.infer<typeof GetProjectSchema>): Promise<any> {
  const result = await circleciRequest<any>(`/project/${params.projectSlug}`);

  return {
    slug: result.slug,
    name: result.name,
    id: result.id,
    organizationName: result.organization_name,
    organizationSlug: result.organization_slug,
    organizationId: result.organization_id,
    vcsInfo: {
      vcsUrl: result.vcs_info?.vcs_url,
      provider: result.vcs_info?.provider,
      defaultBranch: result.vcs_info?.default_branch,
    },
  };
}

async function listEnvvars(params: z.infer<typeof ListEnvvarsSchema>): Promise<any> {
  const queryParams = new URLSearchParams();
  if (params.pageToken) queryParams.set("page-token", params.pageToken);

  const query = queryParams.toString();
  const endpoint = `/project/${params.projectSlug}/envvar${query ? `?${query}` : ""}`;

  const result = await circleciRequest<any>(endpoint);

  return {
    nextPageToken: result.next_page_token,
    envvars: result.items.map((e: any) => ({
      name: e.name,
      value: e.value, // CircleCI returns masked value
      createdAt: e.created_at,
    })),
  };
}

async function createEnvvar(params: z.infer<typeof CreateEnvvarSchema>): Promise<any> {
  const result = await circleciRequest<any>(
    `/project/${params.projectSlug}/envvar`,
    {
      method: "POST",
      body: JSON.stringify({
        name: params.name,
        value: params.value,
      }),
    }
  );

  return {
    name: result.name,
    value: result.value, // Returns masked value
    createdAt: result.created_at,
  };
}

async function deleteEnvvar(params: z.infer<typeof DeleteEnvvarSchema>): Promise<any> {
  await circleciRequest<any>(
    `/project/${params.projectSlug}/envvar/${params.name}`,
    { method: "DELETE" }
  );

  return {
    name: params.name,
    message: "Environment variable deleted",
  };
}

async function listContexts(params: z.infer<typeof ListContextsSchema>): Promise<any> {
  const queryParams = new URLSearchParams();
  queryParams.set("owner-id", params.ownerId);
  queryParams.set("owner-type", params.ownerType);
  if (params.pageToken) queryParams.set("page-token", params.pageToken);

  const result = await circleciRequest<any>(`/context?${queryParams.toString()}`);

  return {
    nextPageToken: result.next_page_token,
    contexts: result.items.map((c: any) => ({
      id: c.id,
      name: c.name,
      createdAt: c.created_at,
    })),
  };
}

async function getContext(params: z.infer<typeof GetContextSchema>): Promise<any> {
  const result = await circleciRequest<any>(`/context/${params.contextId}`);

  return {
    id: result.id,
    name: result.name,
    createdAt: result.created_at,
  };
}

async function listInsights(params: z.infer<typeof ListInsightsSchema>): Promise<any> {
  const queryParams = new URLSearchParams();
  if (params.branch) queryParams.set("branch", params.branch);
  queryParams.set("reporting-window", params.reportingWindow);

  const query = queryParams.toString();
  const endpoint = `/insights/${params.projectSlug}/workflows${query ? `?${query}` : ""}`;

  const result = await circleciRequest<any>(endpoint);

  return {
    nextPageToken: result.next_page_token,
    workflows: result.items.map((w: any) => ({
      name: w.name,
      metrics: {
        successRate: w.metrics?.success_rate,
        totalRuns: w.metrics?.total_runs,
        failedRuns: w.metrics?.failed_runs,
        successfulRuns: w.metrics?.successful_runs,
        throughput: w.metrics?.throughput,
        mttr: w.metrics?.mttr,
        totalCreditsUsed: w.metrics?.total_credits_used,
        durationMetrics: {
          min: w.metrics?.duration_metrics?.min,
          mean: w.metrics?.duration_metrics?.mean,
          median: w.metrics?.duration_metrics?.median,
          p95: w.metrics?.duration_metrics?.p95,
          max: w.metrics?.duration_metrics?.max,
          standardDeviation: w.metrics?.duration_metrics?.standard_deviation,
        },
      },
      windowStart: w.window_start,
      windowEnd: w.window_end,
    })),
  };
}

async function getUser(_params: z.infer<typeof GetUserSchema>): Promise<any> {
  const result = await circleciRequest<any>("/me");

  return {
    id: result.id,
    login: result.login,
    name: result.name,
  };
}

async function listCollaborations(_params: z.infer<typeof ListCollaborationsSchema>): Promise<any> {
  const result = await circleciRequest<any>("/me/collaborations");

  return {
    collaborations: result.map((c: any) => ({
      id: c.id,
      vcsType: c.vcs_type,
      name: c.name,
      avatarUrl: c.avatar_url,
      slug: c.slug,
    })),
  };
}

// Create server
const server = new Server(
  {
    name: "circleci-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

// Call tool
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;

    switch (name) {
      case "list_pipelines":
        result = await listPipelines(ListPipelinesSchema.parse(args));
        break;
      case "get_pipeline":
        result = await getPipeline(GetPipelineSchema.parse(args));
        break;
      case "trigger_pipeline":
        result = await triggerPipeline(TriggerPipelineSchema.parse(args));
        break;
      case "list_workflows":
        result = await listWorkflows(ListWorkflowsSchema.parse(args));
        break;
      case "get_workflow":
        result = await getWorkflow(GetWorkflowSchema.parse(args));
        break;
      case "cancel_workflow":
        result = await cancelWorkflow(CancelWorkflowSchema.parse(args));
        break;
      case "rerun_workflow":
        result = await rerunWorkflow(RerunWorkflowSchema.parse(args));
        break;
      case "list_jobs":
        result = await listJobs(ListJobsSchema.parse(args));
        break;
      case "get_job":
        result = await getJob(GetJobSchema.parse(args));
        break;
      case "get_job_artifacts":
        result = await getJobArtifacts(GetJobArtifactsSchema.parse(args));
        break;
      case "list_projects":
        result = await listProjects(ListProjectsSchema.parse(args));
        break;
      case "get_project":
        result = await getProject(GetProjectSchema.parse(args));
        break;
      case "list_envvars":
        result = await listEnvvars(ListEnvvarsSchema.parse(args));
        break;
      case "create_envvar":
        result = await createEnvvar(CreateEnvvarSchema.parse(args));
        break;
      case "delete_envvar":
        result = await deleteEnvvar(DeleteEnvvarSchema.parse(args));
        break;
      case "list_contexts":
        result = await listContexts(ListContextsSchema.parse(args));
        break;
      case "get_context":
        result = await getContext(GetContextSchema.parse(args));
        break;
      case "list_insights":
        result = await listInsights(ListInsightsSchema.parse(args));
        break;
      case "get_user":
        result = await getUser(GetUserSchema.parse(args));
        break;
      case "list_collaborations":
        result = await listCollaborations(ListCollaborationsSchema.parse(args));
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
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

// Start
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("CircleCI MCP Server started");
}

main().catch(console.error);
