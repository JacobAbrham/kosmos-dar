/**
 * Vercel MCP Server
 *
 * Vercel platform management for KOSMOS agents including:
 * - Deployments (list, create, delete, promote)
 * - Projects (list, create, update, delete)
 * - Domains (list, add, remove, verify)
 * - Environment variables
 * - Logs (access, runtime)
 * - Analytics
 * - Edge config
 * - Teams
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
const VERCEL_TOKEN = process.env.VERCEL_TOKEN || "";
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID || "";

const VERCEL_API_BASE = "https://api.vercel.com";

// Helper for API requests
async function vercelRequest(
  endpoint: string,
  method: string = "GET",
  body?: any,
  queryParams?: Record<string, string>
): Promise<any> {
  const url = new URL(`${VERCEL_API_BASE}${endpoint}`);

  // Add team ID if configured
  if (VERCEL_TEAM_ID) {
    url.searchParams.set("teamId", VERCEL_TEAM_ID);
  }

  // Add additional query params
  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, value);
      }
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${VERCEL_TOKEN}`,
    "Content-Type": "application/json",
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body && method !== "GET") {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url.toString(), options);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vercel API error (${response.status}): ${errorText}`);
  }

  // Some endpoints return no content
  if (response.status === 204) {
    return { success: true };
  }

  return response.json();
}

// ============================================
// Zod Schemas
// ============================================

// Deployment Schemas
const ListDeploymentsSchema = z.object({
  projectId: z.string().optional().describe("Filter by project ID"),
  target: z.enum(["production", "preview"]).optional(),
  state: z.enum(["BUILDING", "ERROR", "INITIALIZING", "QUEUED", "READY", "CANCELED"]).optional(),
  limit: z.number().default(20),
});

const GetDeploymentSchema = z.object({
  deploymentId: z.string().describe("Deployment ID or URL"),
});

const CreateDeploymentSchema = z.object({
  name: z.string().describe("Project name"),
  target: z.enum(["production", "preview"]).default("preview"),
  gitSource: z.object({
    type: z.enum(["github", "gitlab", "bitbucket"]),
    repoId: z.string().optional(),
    ref: z.string().optional(),
    sha: z.string().optional(),
  }).optional(),
  projectSettings: z.object({
    framework: z.string().optional(),
    buildCommand: z.string().optional(),
    outputDirectory: z.string().optional(),
    installCommand: z.string().optional(),
    devCommand: z.string().optional(),
  }).optional(),
});

const DeleteDeploymentSchema = z.object({
  deploymentId: z.string(),
});

const PromoteDeploymentSchema = z.object({
  deploymentId: z.string(),
  projectId: z.string(),
});

const CancelDeploymentSchema = z.object({
  deploymentId: z.string(),
});

// Project Schemas
const ListProjectsSchema = z.object({
  search: z.string().optional(),
  limit: z.number().default(20),
});

const GetProjectSchema = z.object({
  projectId: z.string(),
});

const CreateProjectSchema = z.object({
  name: z.string(),
  framework: z.string().optional(),
  gitRepository: z.object({
    type: z.enum(["github", "gitlab", "bitbucket"]),
    repo: z.string(),
  }).optional(),
  buildCommand: z.string().optional(),
  outputDirectory: z.string().optional(),
  installCommand: z.string().optional(),
  devCommand: z.string().optional(),
  rootDirectory: z.string().optional(),
  publicSource: z.boolean().optional(),
});

const UpdateProjectSchema = z.object({
  projectId: z.string(),
  name: z.string().optional(),
  framework: z.string().optional(),
  buildCommand: z.string().optional(),
  outputDirectory: z.string().optional(),
  installCommand: z.string().optional(),
  devCommand: z.string().optional(),
  rootDirectory: z.string().optional(),
  publicSource: z.boolean().optional(),
});

const DeleteProjectSchema = z.object({
  projectId: z.string(),
});

// Domain Schemas
const ListDomainsSchema = z.object({
  limit: z.number().default(20),
});

const ListProjectDomainsSchema = z.object({
  projectId: z.string(),
});

const AddDomainSchema = z.object({
  projectId: z.string(),
  domain: z.string(),
  gitBranch: z.string().optional(),
  redirect: z.string().optional(),
  redirectStatusCode: z.number().optional(),
});

const RemoveDomainSchema = z.object({
  projectId: z.string(),
  domain: z.string(),
});

const VerifyDomainSchema = z.object({
  projectId: z.string(),
  domain: z.string(),
});

const GetDomainConfigSchema = z.object({
  domain: z.string(),
});

// Environment Variable Schemas
const ListEnvVarsSchema = z.object({
  projectId: z.string(),
});

const GetEnvVarSchema = z.object({
  projectId: z.string(),
  envId: z.string(),
});

const CreateEnvVarSchema = z.object({
  projectId: z.string(),
  key: z.string(),
  value: z.string(),
  type: z.enum(["plain", "encrypted", "secret", "sensitive"]).default("encrypted"),
  target: z.array(z.enum(["production", "preview", "development"])).default(["production", "preview", "development"]),
  gitBranch: z.string().optional(),
});

const UpdateEnvVarSchema = z.object({
  projectId: z.string(),
  envId: z.string(),
  key: z.string().optional(),
  value: z.string().optional(),
  type: z.enum(["plain", "encrypted", "secret", "sensitive"]).optional(),
  target: z.array(z.enum(["production", "preview", "development"])).optional(),
  gitBranch: z.string().optional(),
});

const DeleteEnvVarSchema = z.object({
  projectId: z.string(),
  envId: z.string(),
});

// Logs Schemas
const GetDeploymentLogsSchema = z.object({
  deploymentId: z.string(),
  follow: z.boolean().optional(),
  limit: z.number().default(100),
});

const GetRuntimeLogsSchema = z.object({
  projectId: z.string(),
  deploymentId: z.string().optional(),
  source: z.enum(["build", "edge", "external", "lambda", "static"]).optional(),
  level: z.enum(["debug", "info", "warn", "error"]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.number().default(100),
});

// Analytics Schemas
const GetAnalyticsSchema = z.object({
  projectId: z.string(),
  from: z.string().optional().describe("Start date (ISO 8601)"),
  to: z.string().optional().describe("End date (ISO 8601)"),
  environment: z.enum(["production", "preview", "all"]).default("production"),
});

const GetWebVitalsSchema = z.object({
  projectId: z.string(),
  from: z.string().optional(),
  to: z.string().optional(),
});

// Edge Config Schemas
const ListEdgeConfigsSchema = z.object({
  limit: z.number().default(20),
});

const GetEdgeConfigSchema = z.object({
  edgeConfigId: z.string(),
});

const CreateEdgeConfigSchema = z.object({
  slug: z.string(),
});

const DeleteEdgeConfigSchema = z.object({
  edgeConfigId: z.string(),
});

const GetEdgeConfigItemsSchema = z.object({
  edgeConfigId: z.string(),
});

const UpdateEdgeConfigItemsSchema = z.object({
  edgeConfigId: z.string(),
  items: z.array(z.object({
    operation: z.enum(["create", "update", "upsert", "delete"]),
    key: z.string(),
    value: z.any().optional(),
  })),
});

// Team Schemas
const ListTeamsSchema = z.object({
  limit: z.number().default(20),
});

const GetTeamSchema = z.object({
  teamId: z.string(),
});

const ListTeamMembersSchema = z.object({
  teamId: z.string(),
  limit: z.number().default(20),
});

const InviteTeamMemberSchema = z.object({
  teamId: z.string(),
  email: z.string(),
  role: z.enum(["MEMBER", "OWNER", "VIEWER", "DEVELOPER", "BILLING"]).default("MEMBER"),
});

const RemoveTeamMemberSchema = z.object({
  teamId: z.string(),
  userId: z.string(),
});

// ============================================
// Tool Definitions
// ============================================

const TOOLS: Tool[] = [
  // Deployment Tools
  {
    name: "list_deployments",
    description: "List deployments with optional filters",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Filter by project ID" },
        target: { type: "string", enum: ["production", "preview"] },
        state: { type: "string", enum: ["BUILDING", "ERROR", "INITIALIZING", "QUEUED", "READY", "CANCELED"] },
        limit: { type: "number", default: 20 },
      },
    },
  },
  {
    name: "get_deployment",
    description: "Get details about a specific deployment",
    inputSchema: {
      type: "object",
      properties: {
        deploymentId: { type: "string", description: "Deployment ID or URL" },
      },
      required: ["deploymentId"],
    },
  },
  {
    name: "create_deployment",
    description: "Create a new deployment",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Project name" },
        target: { type: "string", enum: ["production", "preview"], default: "preview" },
        gitSource: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["github", "gitlab", "bitbucket"] },
            repoId: { type: "string" },
            ref: { type: "string" },
            sha: { type: "string" },
          },
        },
        projectSettings: {
          type: "object",
          properties: {
            framework: { type: "string" },
            buildCommand: { type: "string" },
            outputDirectory: { type: "string" },
            installCommand: { type: "string" },
            devCommand: { type: "string" },
          },
        },
      },
      required: ["name"],
    },
  },
  {
    name: "delete_deployment",
    description: "Delete a deployment",
    inputSchema: {
      type: "object",
      properties: {
        deploymentId: { type: "string" },
      },
      required: ["deploymentId"],
    },
  },
  {
    name: "promote_deployment",
    description: "Promote a deployment to production",
    inputSchema: {
      type: "object",
      properties: {
        deploymentId: { type: "string" },
        projectId: { type: "string" },
      },
      required: ["deploymentId", "projectId"],
    },
  },
  {
    name: "cancel_deployment",
    description: "Cancel a running deployment",
    inputSchema: {
      type: "object",
      properties: {
        deploymentId: { type: "string" },
      },
      required: ["deploymentId"],
    },
  },
  // Project Tools
  {
    name: "list_projects",
    description: "List all projects",
    inputSchema: {
      type: "object",
      properties: {
        search: { type: "string" },
        limit: { type: "number", default: 20 },
      },
    },
  },
  {
    name: "get_project",
    description: "Get details about a specific project",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
      },
      required: ["projectId"],
    },
  },
  {
    name: "create_project",
    description: "Create a new project",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        framework: { type: "string" },
        gitRepository: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["github", "gitlab", "bitbucket"] },
            repo: { type: "string" },
          },
        },
        buildCommand: { type: "string" },
        outputDirectory: { type: "string" },
        installCommand: { type: "string" },
        devCommand: { type: "string" },
        rootDirectory: { type: "string" },
        publicSource: { type: "boolean" },
      },
      required: ["name"],
    },
  },
  {
    name: "update_project",
    description: "Update a project's settings",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        name: { type: "string" },
        framework: { type: "string" },
        buildCommand: { type: "string" },
        outputDirectory: { type: "string" },
        installCommand: { type: "string" },
        devCommand: { type: "string" },
        rootDirectory: { type: "string" },
        publicSource: { type: "boolean" },
      },
      required: ["projectId"],
    },
  },
  {
    name: "delete_project",
    description: "Delete a project",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
      },
      required: ["projectId"],
    },
  },
  // Domain Tools
  {
    name: "list_domains",
    description: "List all domains",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", default: 20 },
      },
    },
  },
  {
    name: "list_project_domains",
    description: "List domains for a specific project",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
      },
      required: ["projectId"],
    },
  },
  {
    name: "add_domain",
    description: "Add a domain to a project",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        domain: { type: "string" },
        gitBranch: { type: "string" },
        redirect: { type: "string" },
        redirectStatusCode: { type: "number" },
      },
      required: ["projectId", "domain"],
    },
  },
  {
    name: "remove_domain",
    description: "Remove a domain from a project",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        domain: { type: "string" },
      },
      required: ["projectId", "domain"],
    },
  },
  {
    name: "verify_domain",
    description: "Verify a domain's DNS configuration",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        domain: { type: "string" },
      },
      required: ["projectId", "domain"],
    },
  },
  {
    name: "get_domain_config",
    description: "Get DNS configuration for a domain",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string" },
      },
      required: ["domain"],
    },
  },
  // Environment Variable Tools
  {
    name: "list_env_vars",
    description: "List environment variables for a project",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
      },
      required: ["projectId"],
    },
  },
  {
    name: "get_env_var",
    description: "Get a specific environment variable",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        envId: { type: "string" },
      },
      required: ["projectId", "envId"],
    },
  },
  {
    name: "create_env_var",
    description: "Create a new environment variable",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        key: { type: "string" },
        value: { type: "string" },
        type: { type: "string", enum: ["plain", "encrypted", "secret", "sensitive"], default: "encrypted" },
        target: { type: "array", items: { type: "string", enum: ["production", "preview", "development"] } },
        gitBranch: { type: "string" },
      },
      required: ["projectId", "key", "value"],
    },
  },
  {
    name: "update_env_var",
    description: "Update an environment variable",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        envId: { type: "string" },
        key: { type: "string" },
        value: { type: "string" },
        type: { type: "string", enum: ["plain", "encrypted", "secret", "sensitive"] },
        target: { type: "array", items: { type: "string", enum: ["production", "preview", "development"] } },
        gitBranch: { type: "string" },
      },
      required: ["projectId", "envId"],
    },
  },
  {
    name: "delete_env_var",
    description: "Delete an environment variable",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        envId: { type: "string" },
      },
      required: ["projectId", "envId"],
    },
  },
  // Logs Tools
  {
    name: "get_deployment_logs",
    description: "Get build logs for a deployment",
    inputSchema: {
      type: "object",
      properties: {
        deploymentId: { type: "string" },
        follow: { type: "boolean" },
        limit: { type: "number", default: 100 },
      },
      required: ["deploymentId"],
    },
  },
  {
    name: "get_runtime_logs",
    description: "Get runtime logs for a project",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        deploymentId: { type: "string" },
        source: { type: "string", enum: ["build", "edge", "external", "lambda", "static"] },
        level: { type: "string", enum: ["debug", "info", "warn", "error"] },
        startDate: { type: "string" },
        endDate: { type: "string" },
        limit: { type: "number", default: 100 },
      },
      required: ["projectId"],
    },
  },
  // Analytics Tools
  {
    name: "get_analytics",
    description: "Get analytics data for a project",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        from: { type: "string", description: "Start date (ISO 8601)" },
        to: { type: "string", description: "End date (ISO 8601)" },
        environment: { type: "string", enum: ["production", "preview", "all"], default: "production" },
      },
      required: ["projectId"],
    },
  },
  {
    name: "get_web_vitals",
    description: "Get Web Vitals metrics for a project",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        from: { type: "string" },
        to: { type: "string" },
      },
      required: ["projectId"],
    },
  },
  // Edge Config Tools
  {
    name: "list_edge_configs",
    description: "List all Edge Configs",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", default: 20 },
      },
    },
  },
  {
    name: "get_edge_config",
    description: "Get details about an Edge Config",
    inputSchema: {
      type: "object",
      properties: {
        edgeConfigId: { type: "string" },
      },
      required: ["edgeConfigId"],
    },
  },
  {
    name: "create_edge_config",
    description: "Create a new Edge Config",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string" },
      },
      required: ["slug"],
    },
  },
  {
    name: "delete_edge_config",
    description: "Delete an Edge Config",
    inputSchema: {
      type: "object",
      properties: {
        edgeConfigId: { type: "string" },
      },
      required: ["edgeConfigId"],
    },
  },
  {
    name: "get_edge_config_items",
    description: "Get all items from an Edge Config",
    inputSchema: {
      type: "object",
      properties: {
        edgeConfigId: { type: "string" },
      },
      required: ["edgeConfigId"],
    },
  },
  {
    name: "update_edge_config_items",
    description: "Update items in an Edge Config",
    inputSchema: {
      type: "object",
      properties: {
        edgeConfigId: { type: "string" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              operation: { type: "string", enum: ["create", "update", "upsert", "delete"] },
              key: { type: "string" },
              value: {},
            },
            required: ["operation", "key"],
          },
        },
      },
      required: ["edgeConfigId", "items"],
    },
  },
  // Team Tools
  {
    name: "list_teams",
    description: "List all teams",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", default: 20 },
      },
    },
  },
  {
    name: "get_team",
    description: "Get details about a team",
    inputSchema: {
      type: "object",
      properties: {
        teamId: { type: "string" },
      },
      required: ["teamId"],
    },
  },
  {
    name: "list_team_members",
    description: "List members of a team",
    inputSchema: {
      type: "object",
      properties: {
        teamId: { type: "string" },
        limit: { type: "number", default: 20 },
      },
      required: ["teamId"],
    },
  },
  {
    name: "invite_team_member",
    description: "Invite a new member to a team",
    inputSchema: {
      type: "object",
      properties: {
        teamId: { type: "string" },
        email: { type: "string" },
        role: { type: "string", enum: ["MEMBER", "OWNER", "VIEWER", "DEVELOPER", "BILLING"], default: "MEMBER" },
      },
      required: ["teamId", "email"],
    },
  },
  {
    name: "remove_team_member",
    description: "Remove a member from a team",
    inputSchema: {
      type: "object",
      properties: {
        teamId: { type: "string" },
        userId: { type: "string" },
      },
      required: ["teamId", "userId"],
    },
  },
];

// ============================================
// Tool Implementations
// ============================================

// Deployment implementations
async function listDeployments(params: z.infer<typeof ListDeploymentsSchema>): Promise<any> {
  const queryParams: Record<string, string> = {
    limit: params.limit.toString(),
  };

  if (params.projectId) queryParams.projectId = params.projectId;
  if (params.target) queryParams.target = params.target;
  if (params.state) queryParams.state = params.state;

  const result = await vercelRequest("/v6/deployments", "GET", undefined, queryParams);

  return {
    count: result.deployments?.length || 0,
    deployments: result.deployments?.map((d: any) => ({
      id: d.uid,
      name: d.name,
      url: d.url,
      state: d.state,
      target: d.target,
      createdAt: d.createdAt,
      buildingAt: d.buildingAt,
      ready: d.ready,
      readyState: d.readyState,
      creator: d.creator?.username,
      meta: d.meta,
    })) || [],
  };
}

async function getDeployment(params: z.infer<typeof GetDeploymentSchema>): Promise<any> {
  const result = await vercelRequest(`/v13/deployments/${params.deploymentId}`);

  return {
    id: result.id,
    name: result.name,
    url: result.url,
    state: result.readyState,
    target: result.target,
    createdAt: result.createdAt,
    buildingAt: result.buildingAt,
    ready: result.ready,
    aliasAssigned: result.aliasAssigned,
    aliasError: result.aliasError,
    creator: result.creator,
    meta: result.meta,
    regions: result.regions,
    routes: result.routes,
    plan: result.plan,
    public: result.public,
    version: result.version,
  };
}

async function createDeployment(params: z.infer<typeof CreateDeploymentSchema>): Promise<any> {
  const body: any = {
    name: params.name,
    target: params.target,
  };

  if (params.gitSource) {
    body.gitSource = params.gitSource;
  }

  if (params.projectSettings) {
    body.projectSettings = params.projectSettings;
  }

  const result = await vercelRequest("/v13/deployments", "POST", body);

  return {
    id: result.id,
    name: result.name,
    url: result.url,
    state: result.readyState,
    target: result.target,
    createdAt: result.createdAt,
  };
}

async function deleteDeployment(params: z.infer<typeof DeleteDeploymentSchema>): Promise<any> {
  await vercelRequest(`/v13/deployments/${params.deploymentId}`, "DELETE");
  return { success: true, deploymentId: params.deploymentId };
}

async function promoteDeployment(params: z.infer<typeof PromoteDeploymentSchema>): Promise<any> {
  const result = await vercelRequest(
    `/v10/projects/${params.projectId}/promote/${params.deploymentId}`,
    "POST"
  );
  return {
    success: true,
    jobId: result.jobId,
    deploymentId: params.deploymentId,
  };
}

async function cancelDeployment(params: z.infer<typeof CancelDeploymentSchema>): Promise<any> {
  const result = await vercelRequest(
    `/v12/deployments/${params.deploymentId}/cancel`,
    "PATCH"
  );
  return {
    id: result.id,
    state: result.readyState,
  };
}

// Project implementations
async function listProjects(params: z.infer<typeof ListProjectsSchema>): Promise<any> {
  const queryParams: Record<string, string> = {
    limit: params.limit.toString(),
  };

  if (params.search) queryParams.search = params.search;

  const result = await vercelRequest("/v9/projects", "GET", undefined, queryParams);

  return {
    count: result.projects?.length || 0,
    projects: result.projects?.map((p: any) => ({
      id: p.id,
      name: p.name,
      framework: p.framework,
      latestDeployments: p.latestDeployments?.map((d: any) => ({
        id: d.id,
        url: d.url,
        state: d.readyState,
        target: d.target,
      })),
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      nodeVersion: p.nodeVersion,
      buildCommand: p.buildCommand,
      outputDirectory: p.outputDirectory,
      rootDirectory: p.rootDirectory,
    })) || [],
  };
}

async function getProject(params: z.infer<typeof GetProjectSchema>): Promise<any> {
  const result = await vercelRequest(`/v9/projects/${params.projectId}`);

  return {
    id: result.id,
    name: result.name,
    framework: result.framework,
    nodeVersion: result.nodeVersion,
    buildCommand: result.buildCommand,
    devCommand: result.devCommand,
    installCommand: result.installCommand,
    outputDirectory: result.outputDirectory,
    rootDirectory: result.rootDirectory,
    publicSource: result.publicSource,
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
    latestDeployments: result.latestDeployments,
    link: result.link,
    targets: result.targets,
  };
}

async function createProject(params: z.infer<typeof CreateProjectSchema>): Promise<any> {
  const body: any = {
    name: params.name,
  };

  if (params.framework) body.framework = params.framework;
  if (params.gitRepository) body.gitRepository = params.gitRepository;
  if (params.buildCommand) body.buildCommand = params.buildCommand;
  if (params.outputDirectory) body.outputDirectory = params.outputDirectory;
  if (params.installCommand) body.installCommand = params.installCommand;
  if (params.devCommand) body.devCommand = params.devCommand;
  if (params.rootDirectory) body.rootDirectory = params.rootDirectory;
  if (params.publicSource !== undefined) body.publicSource = params.publicSource;

  const result = await vercelRequest("/v10/projects", "POST", body);

  return {
    id: result.id,
    name: result.name,
    framework: result.framework,
    createdAt: result.createdAt,
  };
}

async function updateProject(params: z.infer<typeof UpdateProjectSchema>): Promise<any> {
  const { projectId, ...updates } = params;

  const result = await vercelRequest(`/v9/projects/${projectId}`, "PATCH", updates);

  return {
    id: result.id,
    name: result.name,
    framework: result.framework,
    updatedAt: result.updatedAt,
  };
}

async function deleteProject(params: z.infer<typeof DeleteProjectSchema>): Promise<any> {
  await vercelRequest(`/v9/projects/${params.projectId}`, "DELETE");
  return { success: true, projectId: params.projectId };
}

// Domain implementations
async function listDomains(params: z.infer<typeof ListDomainsSchema>): Promise<any> {
  const queryParams: Record<string, string> = {
    limit: params.limit.toString(),
  };

  const result = await vercelRequest("/v5/domains", "GET", undefined, queryParams);

  return {
    count: result.domains?.length || 0,
    domains: result.domains?.map((d: any) => ({
      name: d.name,
      verified: d.verified,
      nameservers: d.nameservers,
      createdAt: d.createdAt,
      boughtAt: d.boughtAt,
      expiresAt: d.expiresAt,
      transferredAt: d.transferredAt,
    })) || [],
  };
}

async function listProjectDomains(params: z.infer<typeof ListProjectDomainsSchema>): Promise<any> {
  const result = await vercelRequest(`/v9/projects/${params.projectId}/domains`);

  return {
    count: result.domains?.length || 0,
    domains: result.domains?.map((d: any) => ({
      name: d.name,
      apexName: d.apexName,
      verified: d.verified,
      verification: d.verification,
      gitBranch: d.gitBranch,
      redirect: d.redirect,
      redirectStatusCode: d.redirectStatusCode,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    })) || [],
  };
}

async function addDomain(params: z.infer<typeof AddDomainSchema>): Promise<any> {
  const body: any = {
    name: params.domain,
  };

  if (params.gitBranch) body.gitBranch = params.gitBranch;
  if (params.redirect) body.redirect = params.redirect;
  if (params.redirectStatusCode) body.redirectStatusCode = params.redirectStatusCode;

  const result = await vercelRequest(`/v10/projects/${params.projectId}/domains`, "POST", body);

  return {
    name: result.name,
    apexName: result.apexName,
    verified: result.verified,
    verification: result.verification,
  };
}

async function removeDomain(params: z.infer<typeof RemoveDomainSchema>): Promise<any> {
  await vercelRequest(`/v9/projects/${params.projectId}/domains/${params.domain}`, "DELETE");
  return { success: true, domain: params.domain };
}

async function verifyDomain(params: z.infer<typeof VerifyDomainSchema>): Promise<any> {
  const result = await vercelRequest(
    `/v9/projects/${params.projectId}/domains/${params.domain}/verify`,
    "POST"
  );

  return {
    name: result.name,
    verified: result.verified,
    verification: result.verification,
  };
}

async function getDomainConfig(params: z.infer<typeof GetDomainConfigSchema>): Promise<any> {
  const result = await vercelRequest(`/v6/domains/${params.domain}/config`);

  return {
    configuredBy: result.configuredBy,
    acceptedChallenges: result.acceptedChallenges,
    misconfigured: result.misconfigured,
  };
}

// Environment Variable implementations
async function listEnvVars(params: z.infer<typeof ListEnvVarsSchema>): Promise<any> {
  const result = await vercelRequest(`/v9/projects/${params.projectId}/env`);

  return {
    count: result.envs?.length || 0,
    envVars: result.envs?.map((e: any) => ({
      id: e.id,
      key: e.key,
      value: e.value,
      type: e.type,
      target: e.target,
      gitBranch: e.gitBranch,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    })) || [],
  };
}

async function getEnvVar(params: z.infer<typeof GetEnvVarSchema>): Promise<any> {
  const result = await vercelRequest(`/v9/projects/${params.projectId}/env/${params.envId}`);

  return {
    id: result.id,
    key: result.key,
    value: result.value,
    type: result.type,
    target: result.target,
    gitBranch: result.gitBranch,
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
  };
}

async function createEnvVar(params: z.infer<typeof CreateEnvVarSchema>): Promise<any> {
  const body = {
    key: params.key,
    value: params.value,
    type: params.type,
    target: params.target,
    gitBranch: params.gitBranch,
  };

  const result = await vercelRequest(`/v10/projects/${params.projectId}/env`, "POST", body);

  return {
    id: result.created?.id,
    key: result.created?.key,
    type: result.created?.type,
    target: result.created?.target,
  };
}

async function updateEnvVar(params: z.infer<typeof UpdateEnvVarSchema>): Promise<any> {
  const { projectId, envId, ...updates } = params;

  const result = await vercelRequest(`/v9/projects/${projectId}/env/${envId}`, "PATCH", updates);

  return {
    id: result.id,
    key: result.key,
    type: result.type,
    target: result.target,
    updatedAt: result.updatedAt,
  };
}

async function deleteEnvVar(params: z.infer<typeof DeleteEnvVarSchema>): Promise<any> {
  await vercelRequest(`/v9/projects/${params.projectId}/env/${params.envId}`, "DELETE");
  return { success: true, envId: params.envId };
}

// Logs implementations
async function getDeploymentLogs(params: z.infer<typeof GetDeploymentLogsSchema>): Promise<any> {
  const queryParams: Record<string, string> = {};

  if (params.follow) queryParams.follow = "1";

  const result = await vercelRequest(
    `/v2/deployments/${params.deploymentId}/events`,
    "GET",
    undefined,
    queryParams
  );

  // Limit the logs
  const logs = Array.isArray(result) ? result.slice(0, params.limit) : [];

  return {
    count: logs.length,
    logs: logs.map((log: any) => ({
      type: log.type,
      created: log.created,
      payload: log.payload,
      text: log.text,
    })),
  };
}

async function getRuntimeLogs(params: z.infer<typeof GetRuntimeLogsSchema>): Promise<any> {
  const queryParams: Record<string, string> = {
    projectId: params.projectId,
  };

  if (params.deploymentId) queryParams.deploymentId = params.deploymentId;
  if (params.source) queryParams.source = params.source;
  if (params.level) queryParams.level = params.level;
  if (params.startDate) queryParams.startDate = params.startDate;
  if (params.endDate) queryParams.endDate = params.endDate;

  const result = await vercelRequest("/v1/logs", "GET", undefined, queryParams);

  const logs = result.data?.slice(0, params.limit) || [];

  return {
    count: logs.length,
    logs: logs.map((log: any) => ({
      id: log.id,
      message: log.message,
      timestamp: log.timestamp,
      source: log.source,
      level: log.level,
      deploymentId: log.deploymentId,
      requestId: log.requestId,
      statusCode: log.statusCode,
      path: log.path,
    })),
  };
}

// Analytics implementations
async function getAnalytics(params: z.infer<typeof GetAnalyticsSchema>): Promise<any> {
  const queryParams: Record<string, string> = {
    environment: params.environment,
  };

  if (params.from) queryParams.from = params.from;
  if (params.to) queryParams.to = params.to;

  const result = await vercelRequest(
    `/v1/web/insights/stats`,
    "GET",
    undefined,
    { ...queryParams, projectId: params.projectId }
  );

  return {
    visitors: result.visitors,
    pageViews: result.pageViews,
    bounceRate: result.bounceRate,
    avgDuration: result.avgDuration,
    topPages: result.topPages,
    topReferrers: result.topReferrers,
    countries: result.countries,
    devices: result.devices,
    browsers: result.browsers,
  };
}

async function getWebVitals(params: z.infer<typeof GetWebVitalsSchema>): Promise<any> {
  const queryParams: Record<string, string> = {};

  if (params.from) queryParams.from = params.from;
  if (params.to) queryParams.to = params.to;

  const result = await vercelRequest(
    `/v1/web/insights/vitals`,
    "GET",
    undefined,
    { ...queryParams, projectId: params.projectId }
  );

  return {
    lcp: result.lcp,
    fid: result.fid,
    cls: result.cls,
    fcp: result.fcp,
    ttfb: result.ttfb,
    inp: result.inp,
  };
}

// Edge Config implementations
async function listEdgeConfigs(params: z.infer<typeof ListEdgeConfigsSchema>): Promise<any> {
  const result = await vercelRequest("/v1/edge-config", "GET", undefined, {
    limit: params.limit.toString(),
  });

  return {
    count: result.length || 0,
    edgeConfigs: (result || []).map((ec: any) => ({
      id: ec.id,
      slug: ec.slug,
      createdAt: ec.createdAt,
      updatedAt: ec.updatedAt,
      itemCount: ec.itemCount,
      sizeInBytes: ec.sizeInBytes,
    })),
  };
}

async function getEdgeConfig(params: z.infer<typeof GetEdgeConfigSchema>): Promise<any> {
  const result = await vercelRequest(`/v1/edge-config/${params.edgeConfigId}`);

  return {
    id: result.id,
    slug: result.slug,
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
    itemCount: result.itemCount,
    sizeInBytes: result.sizeInBytes,
    digest: result.digest,
  };
}

async function createEdgeConfig(params: z.infer<typeof CreateEdgeConfigSchema>): Promise<any> {
  const result = await vercelRequest("/v1/edge-config", "POST", {
    slug: params.slug,
  });

  return {
    id: result.id,
    slug: result.slug,
    createdAt: result.createdAt,
  };
}

async function deleteEdgeConfig(params: z.infer<typeof DeleteEdgeConfigSchema>): Promise<any> {
  await vercelRequest(`/v1/edge-config/${params.edgeConfigId}`, "DELETE");
  return { success: true, edgeConfigId: params.edgeConfigId };
}

async function getEdgeConfigItems(params: z.infer<typeof GetEdgeConfigItemsSchema>): Promise<any> {
  const result = await vercelRequest(`/v1/edge-config/${params.edgeConfigId}/items`);

  return {
    count: result.length || 0,
    items: (result || []).map((item: any) => ({
      key: item.key,
      value: item.value,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
  };
}

async function updateEdgeConfigItems(params: z.infer<typeof UpdateEdgeConfigItemsSchema>): Promise<any> {
  const result = await vercelRequest(
    `/v1/edge-config/${params.edgeConfigId}/items`,
    "PATCH",
    { items: params.items }
  );

  return {
    status: result.status,
  };
}

// Team implementations
async function listTeams(params: z.infer<typeof ListTeamsSchema>): Promise<any> {
  const result = await vercelRequest("/v2/teams", "GET", undefined, {
    limit: params.limit.toString(),
  });

  return {
    count: result.teams?.length || 0,
    teams: result.teams?.map((t: any) => ({
      id: t.id,
      slug: t.slug,
      name: t.name,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      avatar: t.avatar,
      membership: t.membership,
    })) || [],
  };
}

async function getTeam(params: z.infer<typeof GetTeamSchema>): Promise<any> {
  const result = await vercelRequest(`/v2/teams/${params.teamId}`);

  return {
    id: result.id,
    slug: result.slug,
    name: result.name,
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
    avatar: result.avatar,
    description: result.description,
    billing: result.billing,
    membership: result.membership,
  };
}

async function listTeamMembers(params: z.infer<typeof ListTeamMembersSchema>): Promise<any> {
  const result = await vercelRequest(`/v2/teams/${params.teamId}/members`, "GET", undefined, {
    limit: params.limit.toString(),
  });

  return {
    count: result.members?.length || 0,
    members: result.members?.map((m: any) => ({
      uid: m.uid,
      username: m.username,
      email: m.email,
      name: m.name,
      role: m.role,
      joinedAt: m.joinedAt,
      avatar: m.avatar,
    })) || [],
  };
}

async function inviteTeamMember(params: z.infer<typeof InviteTeamMemberSchema>): Promise<any> {
  const result = await vercelRequest(`/v1/teams/${params.teamId}/members`, "POST", {
    email: params.email,
    role: params.role,
  });

  return {
    id: result.id,
    email: params.email,
    role: params.role,
  };
}

async function removeTeamMember(params: z.infer<typeof RemoveTeamMemberSchema>): Promise<any> {
  await vercelRequest(`/v2/teams/${params.teamId}/members/${params.userId}`, "DELETE");
  return { success: true, userId: params.userId };
}

// ============================================
// Server Setup
// ============================================

const server = new Server(
  {
    name: "vercel-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;

    switch (name) {
      // Deployments
      case "list_deployments":
        result = await listDeployments(ListDeploymentsSchema.parse(args));
        break;
      case "get_deployment":
        result = await getDeployment(GetDeploymentSchema.parse(args));
        break;
      case "create_deployment":
        result = await createDeployment(CreateDeploymentSchema.parse(args));
        break;
      case "delete_deployment":
        result = await deleteDeployment(DeleteDeploymentSchema.parse(args));
        break;
      case "promote_deployment":
        result = await promoteDeployment(PromoteDeploymentSchema.parse(args));
        break;
      case "cancel_deployment":
        result = await cancelDeployment(CancelDeploymentSchema.parse(args));
        break;

      // Projects
      case "list_projects":
        result = await listProjects(ListProjectsSchema.parse(args));
        break;
      case "get_project":
        result = await getProject(GetProjectSchema.parse(args));
        break;
      case "create_project":
        result = await createProject(CreateProjectSchema.parse(args));
        break;
      case "update_project":
        result = await updateProject(UpdateProjectSchema.parse(args));
        break;
      case "delete_project":
        result = await deleteProject(DeleteProjectSchema.parse(args));
        break;

      // Domains
      case "list_domains":
        result = await listDomains(ListDomainsSchema.parse(args));
        break;
      case "list_project_domains":
        result = await listProjectDomains(ListProjectDomainsSchema.parse(args));
        break;
      case "add_domain":
        result = await addDomain(AddDomainSchema.parse(args));
        break;
      case "remove_domain":
        result = await removeDomain(RemoveDomainSchema.parse(args));
        break;
      case "verify_domain":
        result = await verifyDomain(VerifyDomainSchema.parse(args));
        break;
      case "get_domain_config":
        result = await getDomainConfig(GetDomainConfigSchema.parse(args));
        break;

      // Environment Variables
      case "list_env_vars":
        result = await listEnvVars(ListEnvVarsSchema.parse(args));
        break;
      case "get_env_var":
        result = await getEnvVar(GetEnvVarSchema.parse(args));
        break;
      case "create_env_var":
        result = await createEnvVar(CreateEnvVarSchema.parse(args));
        break;
      case "update_env_var":
        result = await updateEnvVar(UpdateEnvVarSchema.parse(args));
        break;
      case "delete_env_var":
        result = await deleteEnvVar(DeleteEnvVarSchema.parse(args));
        break;

      // Logs
      case "get_deployment_logs":
        result = await getDeploymentLogs(GetDeploymentLogsSchema.parse(args));
        break;
      case "get_runtime_logs":
        result = await getRuntimeLogs(GetRuntimeLogsSchema.parse(args));
        break;

      // Analytics
      case "get_analytics":
        result = await getAnalytics(GetAnalyticsSchema.parse(args));
        break;
      case "get_web_vitals":
        result = await getWebVitals(GetWebVitalsSchema.parse(args));
        break;

      // Edge Config
      case "list_edge_configs":
        result = await listEdgeConfigs(ListEdgeConfigsSchema.parse(args));
        break;
      case "get_edge_config":
        result = await getEdgeConfig(GetEdgeConfigSchema.parse(args));
        break;
      case "create_edge_config":
        result = await createEdgeConfig(CreateEdgeConfigSchema.parse(args));
        break;
      case "delete_edge_config":
        result = await deleteEdgeConfig(DeleteEdgeConfigSchema.parse(args));
        break;
      case "get_edge_config_items":
        result = await getEdgeConfigItems(GetEdgeConfigItemsSchema.parse(args));
        break;
      case "update_edge_config_items":
        result = await updateEdgeConfigItems(UpdateEdgeConfigItemsSchema.parse(args));
        break;

      // Teams
      case "list_teams":
        result = await listTeams(ListTeamsSchema.parse(args));
        break;
      case "get_team":
        result = await getTeam(GetTeamSchema.parse(args));
        break;
      case "list_team_members":
        result = await listTeamMembers(ListTeamMembersSchema.parse(args));
        break;
      case "invite_team_member":
        result = await inviteTeamMember(InviteTeamMemberSchema.parse(args));
        break;
      case "remove_team_member":
        result = await removeTeamMember(RemoveTeamMemberSchema.parse(args));
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

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Vercel MCP Server started");
}

main().catch(console.error);
