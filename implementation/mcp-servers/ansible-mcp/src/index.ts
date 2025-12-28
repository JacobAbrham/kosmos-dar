/**
 * Ansible Tower/AWX MCP Server - Automation platform management for KOSMOS agents
 * Provides tools for managing job templates, inventories, projects, and workflows
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";

const config = {
  endpoint: process.env.AWX_URL || "http://localhost:8052",
  token: process.env.AWX_TOKEN || "",
};

async function awxRequest(method: string, path: string, body?: any): Promise<any> {
  const res = await fetch(`${config.endpoint}/api/v2${path}`, {
    method,
    headers: {
      "Authorization": `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || error.message || res.statusText);
  }
  return res.status === 204 ? {} : res.json();
}

const TOOLS: Tool[] = [
  // Job Templates
  {
    name: "list_job_templates",
    description: "List all job templates in AWX/Tower.",
    inputSchema: {
      type: "object",
      properties: {
        search: { type: "string", description: "Search filter" },
        page: { type: "number", description: "Page number" },
        page_size: { type: "number", description: "Results per page" },
        order_by: { type: "string", description: "Field to order by" },
      },
    },
  },
  {
    name: "get_job_template",
    description: "Get details of a specific job template.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Job template ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "launch_job",
    description: "Launch a job from a job template.",
    inputSchema: {
      type: "object",
      properties: {
        job_template_id: { type: "number", description: "Job template ID to launch" },
        inventory: { type: "number", description: "Inventory ID override" },
        credential: { type: "number", description: "Credential ID override" },
        limit: { type: "string", description: "Host limit pattern" },
        extra_vars: { type: "object", description: "Extra variables as key-value pairs" },
        job_tags: { type: "string", description: "Comma-separated list of tags to run" },
        skip_tags: { type: "string", description: "Comma-separated list of tags to skip" },
        verbosity: { type: "number", description: "Verbosity level (0-5)" },
      },
      required: ["job_template_id"],
    },
  },
  // Jobs
  {
    name: "list_jobs",
    description: "List job runs with optional filtering.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["new", "pending", "waiting", "running", "successful", "failed", "error", "canceled"], description: "Filter by job status" },
        job_template: { type: "number", description: "Filter by job template ID" },
        search: { type: "string", description: "Search filter" },
        page: { type: "number", description: "Page number" },
        page_size: { type: "number", description: "Results per page" },
        order_by: { type: "string", description: "Field to order by (prefix with - for descending)" },
      },
    },
  },
  {
    name: "get_job",
    description: "Get job details and output.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Job ID" },
        include_output: { type: "boolean", description: "Include job stdout output" },
      },
      required: ["id"],
    },
  },
  {
    name: "cancel_job",
    description: "Cancel a running job.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Job ID to cancel" },
      },
      required: ["id"],
    },
  },
  // Inventories
  {
    name: "list_inventories",
    description: "List all inventories.",
    inputSchema: {
      type: "object",
      properties: {
        search: { type: "string", description: "Search filter" },
        page: { type: "number", description: "Page number" },
        page_size: { type: "number", description: "Results per page" },
        organization: { type: "number", description: "Filter by organization ID" },
      },
    },
  },
  {
    name: "get_inventory",
    description: "Get inventory details.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Inventory ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "list_hosts",
    description: "List hosts in an inventory.",
    inputSchema: {
      type: "object",
      properties: {
        inventory_id: { type: "number", description: "Inventory ID" },
        search: { type: "string", description: "Search filter" },
        page: { type: "number", description: "Page number" },
        page_size: { type: "number", description: "Results per page" },
        enabled: { type: "boolean", description: "Filter by enabled status" },
      },
      required: ["inventory_id"],
    },
  },
  {
    name: "add_host",
    description: "Add a host to an inventory.",
    inputSchema: {
      type: "object",
      properties: {
        inventory_id: { type: "number", description: "Inventory ID to add host to" },
        name: { type: "string", description: "Host name or IP address" },
        description: { type: "string", description: "Host description" },
        enabled: { type: "boolean", description: "Whether the host is enabled" },
        variables: { type: "object", description: "Host variables as key-value pairs" },
      },
      required: ["inventory_id", "name"],
    },
  },
  // Projects
  {
    name: "list_projects",
    description: "List all projects.",
    inputSchema: {
      type: "object",
      properties: {
        search: { type: "string", description: "Search filter" },
        page: { type: "number", description: "Page number" },
        page_size: { type: "number", description: "Results per page" },
        organization: { type: "number", description: "Filter by organization ID" },
      },
    },
  },
  {
    name: "sync_project",
    description: "Sync a project from its SCM source.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Project ID to sync" },
      },
      required: ["id"],
    },
  },
  // Credentials
  {
    name: "list_credentials",
    description: "List all credentials.",
    inputSchema: {
      type: "object",
      properties: {
        search: { type: "string", description: "Search filter" },
        page: { type: "number", description: "Page number" },
        page_size: { type: "number", description: "Results per page" },
        credential_type: { type: "number", description: "Filter by credential type ID" },
        organization: { type: "number", description: "Filter by organization ID" },
      },
    },
  },
  // Workflows
  {
    name: "list_workflows",
    description: "List workflow job templates.",
    inputSchema: {
      type: "object",
      properties: {
        search: { type: "string", description: "Search filter" },
        page: { type: "number", description: "Page number" },
        page_size: { type: "number", description: "Results per page" },
        organization: { type: "number", description: "Filter by organization ID" },
      },
    },
  },
  {
    name: "launch_workflow",
    description: "Launch a workflow job template.",
    inputSchema: {
      type: "object",
      properties: {
        workflow_template_id: { type: "number", description: "Workflow template ID to launch" },
        inventory: { type: "number", description: "Inventory ID override" },
        extra_vars: { type: "object", description: "Extra variables as key-value pairs" },
        limit: { type: "string", description: "Host limit pattern" },
      },
      required: ["workflow_template_id"],
    },
  },
  {
    name: "get_workflow_job",
    description: "Get workflow job status and details.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Workflow job ID" },
        include_nodes: { type: "boolean", description: "Include workflow node details" },
      },
      required: ["id"],
    },
  },
  // Schedules
  {
    name: "list_schedules",
    description: "List all schedules.",
    inputSchema: {
      type: "object",
      properties: {
        search: { type: "string", description: "Search filter" },
        page: { type: "number", description: "Page number" },
        page_size: { type: "number", description: "Results per page" },
        unified_job_template: { type: "number", description: "Filter by job template ID" },
      },
    },
  },
  {
    name: "create_schedule",
    description: "Create a schedule for a job template.",
    inputSchema: {
      type: "object",
      properties: {
        unified_job_template_id: { type: "number", description: "Job template or workflow template ID" },
        name: { type: "string", description: "Schedule name" },
        description: { type: "string", description: "Schedule description" },
        rrule: { type: "string", description: "iCal RRULE for recurrence (e.g., DTSTART:20231201T000000Z RRULE:FREQ=DAILY;INTERVAL=1)" },
        enabled: { type: "boolean", description: "Whether the schedule is enabled" },
        extra_data: { type: "object", description: "Extra variables for the scheduled job" },
      },
      required: ["unified_job_template_id", "name", "rrule"],
    },
  },
  // Activity Stream
  {
    name: "get_activity_stream",
    description: "Get activity stream events.",
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "number", description: "Page number" },
        page_size: { type: "number", description: "Results per page" },
        object1: { type: "string", description: "Filter by object type (e.g., job, project, inventory)" },
        object2: { type: "string", description: "Filter by secondary object type" },
        search: { type: "string", description: "Search filter" },
      },
    },
  },
];

// Job Templates
async function listJobTemplates(params: { search?: string; page?: number; page_size?: number; order_by?: string }): Promise<any> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.page) query.set("page", params.page.toString());
  if (params.page_size) query.set("page_size", params.page_size.toString());
  if (params.order_by) query.set("order_by", params.order_by);
  const queryStr = query.toString();
  return awxRequest("GET", `/job_templates/${queryStr ? `?${queryStr}` : ""}`);
}

async function getJobTemplate(params: { id: number }): Promise<any> {
  return awxRequest("GET", `/job_templates/${params.id}/`);
}

async function launchJob(params: {
  job_template_id: number;
  inventory?: number;
  credential?: number;
  limit?: string;
  extra_vars?: Record<string, any>;
  job_tags?: string;
  skip_tags?: string;
  verbosity?: number;
}): Promise<any> {
  const body: Record<string, any> = {};
  if (params.inventory) body.inventory = params.inventory;
  if (params.credential) body.credential = params.credential;
  if (params.limit) body.limit = params.limit;
  if (params.extra_vars) body.extra_vars = JSON.stringify(params.extra_vars);
  if (params.job_tags) body.job_tags = params.job_tags;
  if (params.skip_tags) body.skip_tags = params.skip_tags;
  if (params.verbosity !== undefined) body.verbosity = params.verbosity;
  return awxRequest("POST", `/job_templates/${params.job_template_id}/launch/`, body);
}

// Jobs
async function listJobs(params: {
  status?: string;
  job_template?: number;
  search?: string;
  page?: number;
  page_size?: number;
  order_by?: string;
}): Promise<any> {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.job_template) query.set("job_template", params.job_template.toString());
  if (params.search) query.set("search", params.search);
  if (params.page) query.set("page", params.page.toString());
  if (params.page_size) query.set("page_size", params.page_size.toString());
  if (params.order_by) query.set("order_by", params.order_by);
  const queryStr = query.toString();
  return awxRequest("GET", `/jobs/${queryStr ? `?${queryStr}` : ""}`);
}

async function getJob(params: { id: number; include_output?: boolean }): Promise<any> {
  const job = await awxRequest("GET", `/jobs/${params.id}/`);
  if (params.include_output) {
    try {
      const stdout = await awxRequest("GET", `/jobs/${params.id}/stdout/?format=txt`);
      job.stdout = stdout;
    } catch {
      // stdout may not be available
    }
  }
  return job;
}

async function cancelJob(params: { id: number }): Promise<any> {
  await awxRequest("POST", `/jobs/${params.id}/cancel/`);
  return { id: params.id, canceled: true };
}

// Inventories
async function listInventories(params: {
  search?: string;
  page?: number;
  page_size?: number;
  organization?: number;
}): Promise<any> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.page) query.set("page", params.page.toString());
  if (params.page_size) query.set("page_size", params.page_size.toString());
  if (params.organization) query.set("organization", params.organization.toString());
  const queryStr = query.toString();
  return awxRequest("GET", `/inventories/${queryStr ? `?${queryStr}` : ""}`);
}

async function getInventory(params: { id: number }): Promise<any> {
  return awxRequest("GET", `/inventories/${params.id}/`);
}

async function listHosts(params: {
  inventory_id: number;
  search?: string;
  page?: number;
  page_size?: number;
  enabled?: boolean;
}): Promise<any> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.page) query.set("page", params.page.toString());
  if (params.page_size) query.set("page_size", params.page_size.toString());
  if (params.enabled !== undefined) query.set("enabled", params.enabled.toString());
  const queryStr = query.toString();
  return awxRequest("GET", `/inventories/${params.inventory_id}/hosts/${queryStr ? `?${queryStr}` : ""}`);
}

async function addHost(params: {
  inventory_id: number;
  name: string;
  description?: string;
  enabled?: boolean;
  variables?: Record<string, any>;
}): Promise<any> {
  const body: Record<string, any> = {
    name: params.name,
    inventory: params.inventory_id,
  };
  if (params.description) body.description = params.description;
  if (params.enabled !== undefined) body.enabled = params.enabled;
  if (params.variables) body.variables = JSON.stringify(params.variables);
  return awxRequest("POST", `/hosts/`, body);
}

// Projects
async function listProjects(params: {
  search?: string;
  page?: number;
  page_size?: number;
  organization?: number;
}): Promise<any> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.page) query.set("page", params.page.toString());
  if (params.page_size) query.set("page_size", params.page_size.toString());
  if (params.organization) query.set("organization", params.organization.toString());
  const queryStr = query.toString();
  return awxRequest("GET", `/projects/${queryStr ? `?${queryStr}` : ""}`);
}

async function syncProject(params: { id: number }): Promise<any> {
  return awxRequest("POST", `/projects/${params.id}/update/`);
}

// Credentials
async function listCredentials(params: {
  search?: string;
  page?: number;
  page_size?: number;
  credential_type?: number;
  organization?: number;
}): Promise<any> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.page) query.set("page", params.page.toString());
  if (params.page_size) query.set("page_size", params.page_size.toString());
  if (params.credential_type) query.set("credential_type", params.credential_type.toString());
  if (params.organization) query.set("organization", params.organization.toString());
  const queryStr = query.toString();
  return awxRequest("GET", `/credentials/${queryStr ? `?${queryStr}` : ""}`);
}

// Workflows
async function listWorkflows(params: {
  search?: string;
  page?: number;
  page_size?: number;
  organization?: number;
}): Promise<any> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.page) query.set("page", params.page.toString());
  if (params.page_size) query.set("page_size", params.page_size.toString());
  if (params.organization) query.set("organization", params.organization.toString());
  const queryStr = query.toString();
  return awxRequest("GET", `/workflow_job_templates/${queryStr ? `?${queryStr}` : ""}`);
}

async function launchWorkflow(params: {
  workflow_template_id: number;
  inventory?: number;
  extra_vars?: Record<string, any>;
  limit?: string;
}): Promise<any> {
  const body: Record<string, any> = {};
  if (params.inventory) body.inventory = params.inventory;
  if (params.extra_vars) body.extra_vars = JSON.stringify(params.extra_vars);
  if (params.limit) body.limit = params.limit;
  return awxRequest("POST", `/workflow_job_templates/${params.workflow_template_id}/launch/`, body);
}

async function getWorkflowJob(params: { id: number; include_nodes?: boolean }): Promise<any> {
  const job = await awxRequest("GET", `/workflow_jobs/${params.id}/`);
  if (params.include_nodes) {
    const nodes = await awxRequest("GET", `/workflow_jobs/${params.id}/workflow_nodes/`);
    job.workflow_nodes = nodes.results || nodes;
  }
  return job;
}

// Schedules
async function listSchedules(params: {
  search?: string;
  page?: number;
  page_size?: number;
  unified_job_template?: number;
}): Promise<any> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.page) query.set("page", params.page.toString());
  if (params.page_size) query.set("page_size", params.page_size.toString());
  if (params.unified_job_template) query.set("unified_job_template", params.unified_job_template.toString());
  const queryStr = query.toString();
  return awxRequest("GET", `/schedules/${queryStr ? `?${queryStr}` : ""}`);
}

async function createSchedule(params: {
  unified_job_template_id: number;
  name: string;
  description?: string;
  rrule: string;
  enabled?: boolean;
  extra_data?: Record<string, any>;
}): Promise<any> {
  const body: Record<string, any> = {
    unified_job_template: params.unified_job_template_id,
    name: params.name,
    rrule: params.rrule,
  };
  if (params.description) body.description = params.description;
  if (params.enabled !== undefined) body.enabled = params.enabled;
  if (params.extra_data) body.extra_data = params.extra_data;
  return awxRequest("POST", `/schedules/`, body);
}

// Activity Stream
async function getActivityStream(params: {
  page?: number;
  page_size?: number;
  object1?: string;
  object2?: string;
  search?: string;
}): Promise<any> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", params.page.toString());
  if (params.page_size) query.set("page_size", params.page_size.toString());
  if (params.object1) query.set("object1", params.object1);
  if (params.object2) query.set("object2", params.object2);
  if (params.search) query.set("search", params.search);
  const queryStr = query.toString();
  return awxRequest("GET", `/activity_stream/${queryStr ? `?${queryStr}` : ""}`);
}

const server = new Server(
  { name: "ansible-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result: any;
    switch (name) {
      // Job Templates
      case "list_job_templates":
        result = await listJobTemplates(args as any);
        break;
      case "get_job_template":
        result = await getJobTemplate(args as any);
        break;
      case "launch_job":
        result = await launchJob(args as any);
        break;
      // Jobs
      case "list_jobs":
        result = await listJobs(args as any);
        break;
      case "get_job":
        result = await getJob(args as any);
        break;
      case "cancel_job":
        result = await cancelJob(args as any);
        break;
      // Inventories
      case "list_inventories":
        result = await listInventories(args as any);
        break;
      case "get_inventory":
        result = await getInventory(args as any);
        break;
      case "list_hosts":
        result = await listHosts(args as any);
        break;
      case "add_host":
        result = await addHost(args as any);
        break;
      // Projects
      case "list_projects":
        result = await listProjects(args as any);
        break;
      case "sync_project":
        result = await syncProject(args as any);
        break;
      // Credentials
      case "list_credentials":
        result = await listCredentials(args as any);
        break;
      // Workflows
      case "list_workflows":
        result = await listWorkflows(args as any);
        break;
      case "launch_workflow":
        result = await launchWorkflow(args as any);
        break;
      case "get_workflow_job":
        result = await getWorkflowJob(args as any);
        break;
      // Schedules
      case "list_schedules":
        result = await listSchedules(args as any);
        break;
      case "create_schedule":
        result = await createSchedule(args as any);
        break;
      // Activity Stream
      case "get_activity_stream":
        result = await getActivityStream(args as any);
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
  console.error("Ansible MCP Server running on stdio");
}

main().catch(console.error);
