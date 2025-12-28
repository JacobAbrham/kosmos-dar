/**
 * Prefect MCP Server
 *
 * Provides Prefect workflow orchestration for KOSMOS agents.
 * Features:
 * - Flow management (list, get details)
 * - Deployment lifecycle (create, run, pause, resume)
 * - Flow run monitoring and control
 * - Task run inspection
 * - Work pools and queues management
 * - Block management
 * - Schedule management
 * - Log retrieval
 *
 * Authentication: Uses PREFECT_API_URL and PREFECT_API_KEY environment variables.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

// =============================================================================
// Configuration
// =============================================================================

const config = {
  apiUrl: process.env.PREFECT_API_URL || "http://localhost:4200/api",
  apiKey: process.env.PREFECT_API_KEY,
};

// =============================================================================
// API Client
// =============================================================================

async function prefectRequest(
  endpoint: string,
  method: string = "GET",
  body?: any
): Promise<any> {
  const url = `${config.apiUrl}${endpoint}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Prefect API error (${response.status}): ${errorText}`);
  }

  if (response.status === 204) {
    return { success: true };
  }

  return response.json();
}

// =============================================================================
// Tool Definitions
// =============================================================================

const TOOLS: Tool[] = [
  // Flow operations
  {
    name: "list_flows",
    description: "List all flows in Prefect.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Maximum number of flows to return" },
        offset: { type: "number", description: "Number of flows to skip" },
        name_like: { type: "string", description: "Filter by flow name pattern" },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Filter by tags",
        },
      },
    },
  },
  {
    name: "get_flow",
    description: "Get detailed information about a specific flow.",
    inputSchema: {
      type: "object",
      properties: {
        flow_id: { type: "string", description: "Flow ID" },
      },
      required: ["flow_id"],
    },
  },
  // Deployment operations
  {
    name: "list_deployments",
    description: "List all deployments in Prefect.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Maximum number of deployments to return" },
        offset: { type: "number", description: "Number of deployments to skip" },
        flow_id: { type: "string", description: "Filter by flow ID" },
        name_like: { type: "string", description: "Filter by deployment name pattern" },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Filter by tags",
        },
      },
    },
  },
  {
    name: "get_deployment",
    description: "Get detailed information about a specific deployment.",
    inputSchema: {
      type: "object",
      properties: {
        deployment_id: { type: "string", description: "Deployment ID" },
      },
      required: ["deployment_id"],
    },
  },
  {
    name: "create_deployment",
    description: "Create a new deployment for a flow.",
    inputSchema: {
      type: "object",
      properties: {
        flow_id: { type: "string", description: "Flow ID to deploy" },
        name: { type: "string", description: "Deployment name" },
        version: { type: "string", description: "Deployment version" },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Tags for the deployment",
        },
        parameters: { type: "object", description: "Default parameters for flow runs" },
        work_pool_name: { type: "string", description: "Work pool to use" },
        work_queue_name: { type: "string", description: "Work queue to use" },
        schedule: {
          type: "object",
          description: "Schedule configuration (cron, interval, or rrule)",
          properties: {
            cron: { type: "string", description: "Cron expression" },
            interval: { type: "number", description: "Interval in seconds" },
            timezone: { type: "string", description: "Timezone" },
          },
        },
        is_schedule_active: { type: "boolean", description: "Whether the schedule is active" },
        description: { type: "string", description: "Deployment description" },
      },
      required: ["flow_id", "name"],
    },
  },
  {
    name: "run_deployment",
    description: "Trigger a new flow run from a deployment.",
    inputSchema: {
      type: "object",
      properties: {
        deployment_id: { type: "string", description: "Deployment ID" },
        name: { type: "string", description: "Name for the flow run" },
        parameters: { type: "object", description: "Parameters for the flow run" },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Tags for the flow run",
        },
        idempotency_key: { type: "string", description: "Idempotency key to prevent duplicate runs" },
      },
      required: ["deployment_id"],
    },
  },
  {
    name: "pause_deployment",
    description: "Pause a deployment's schedule.",
    inputSchema: {
      type: "object",
      properties: {
        deployment_id: { type: "string", description: "Deployment ID" },
      },
      required: ["deployment_id"],
    },
  },
  {
    name: "resume_deployment",
    description: "Resume a paused deployment's schedule.",
    inputSchema: {
      type: "object",
      properties: {
        deployment_id: { type: "string", description: "Deployment ID" },
      },
      required: ["deployment_id"],
    },
  },
  // Flow run operations
  {
    name: "list_flow_runs",
    description: "List flow runs in Prefect.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Maximum number of flow runs to return" },
        offset: { type: "number", description: "Number of flow runs to skip" },
        flow_id: { type: "string", description: "Filter by flow ID" },
        deployment_id: { type: "string", description: "Filter by deployment ID" },
        state_type: {
          type: "string",
          enum: ["SCHEDULED", "PENDING", "RUNNING", "COMPLETED", "FAILED", "CANCELLED", "CANCELLING", "PAUSED", "CRASHED"],
          description: "Filter by state type",
        },
        state_name: { type: "string", description: "Filter by state name" },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Filter by tags",
        },
        start_time_after: { type: "string", description: "Filter by start time (ISO format)" },
        start_time_before: { type: "string", description: "Filter by start time (ISO format)" },
      },
    },
  },
  {
    name: "get_flow_run",
    description: "Get detailed information about a specific flow run.",
    inputSchema: {
      type: "object",
      properties: {
        flow_run_id: { type: "string", description: "Flow run ID" },
      },
      required: ["flow_run_id"],
    },
  },
  {
    name: "cancel_flow_run",
    description: "Cancel a running or scheduled flow run.",
    inputSchema: {
      type: "object",
      properties: {
        flow_run_id: { type: "string", description: "Flow run ID" },
      },
      required: ["flow_run_id"],
    },
  },
  // Task run operations
  {
    name: "list_task_runs",
    description: "List task runs in Prefect.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Maximum number of task runs to return" },
        offset: { type: "number", description: "Number of task runs to skip" },
        flow_run_id: { type: "string", description: "Filter by flow run ID" },
        state_type: {
          type: "string",
          enum: ["SCHEDULED", "PENDING", "RUNNING", "COMPLETED", "FAILED", "CANCELLED", "CANCELLING", "PAUSED", "CRASHED"],
          description: "Filter by state type",
        },
        state_name: { type: "string", description: "Filter by state name" },
        name_like: { type: "string", description: "Filter by task name pattern" },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Filter by tags",
        },
      },
    },
  },
  {
    name: "get_task_run",
    description: "Get detailed information about a specific task run.",
    inputSchema: {
      type: "object",
      properties: {
        task_run_id: { type: "string", description: "Task run ID" },
      },
      required: ["task_run_id"],
    },
  },
  // Work pool operations
  {
    name: "list_work_pools",
    description: "List all work pools in Prefect.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Maximum number of work pools to return" },
        offset: { type: "number", description: "Number of work pools to skip" },
        name_like: { type: "string", description: "Filter by work pool name pattern" },
        type: { type: "string", description: "Filter by work pool type" },
      },
    },
  },
  {
    name: "create_work_pool",
    description: "Create a new work pool.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Work pool name" },
        type: {
          type: "string",
          description: "Work pool type (e.g., 'process', 'kubernetes', 'docker')",
        },
        description: { type: "string", description: "Work pool description" },
        is_paused: { type: "boolean", description: "Whether the work pool is paused" },
        base_job_template: {
          type: "object",
          description: "Base job template configuration",
        },
      },
      required: ["name", "type"],
    },
  },
  // Work queue operations
  {
    name: "list_work_queues",
    description: "List work queues in a work pool.",
    inputSchema: {
      type: "object",
      properties: {
        work_pool_name: { type: "string", description: "Work pool name" },
        limit: { type: "number", description: "Maximum number of work queues to return" },
        offset: { type: "number", description: "Number of work queues to skip" },
      },
      required: ["work_pool_name"],
    },
  },
  // Block operations
  {
    name: "list_blocks",
    description: "List all blocks in Prefect.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Maximum number of blocks to return" },
        offset: { type: "number", description: "Number of blocks to skip" },
        block_type_slug: { type: "string", description: "Filter by block type slug" },
        name_like: { type: "string", description: "Filter by block name pattern" },
      },
    },
  },
  {
    name: "get_block",
    description: "Get detailed information about a specific block.",
    inputSchema: {
      type: "object",
      properties: {
        block_document_id: { type: "string", description: "Block document ID" },
      },
      required: ["block_document_id"],
    },
  },
  // Schedule operations
  {
    name: "list_schedules",
    description: "List schedules for a deployment.",
    inputSchema: {
      type: "object",
      properties: {
        deployment_id: { type: "string", description: "Deployment ID" },
      },
      required: ["deployment_id"],
    },
  },
  // Log operations
  {
    name: "get_logs",
    description: "Get logs for a flow run.",
    inputSchema: {
      type: "object",
      properties: {
        flow_run_id: { type: "string", description: "Flow run ID" },
        limit: { type: "number", description: "Maximum number of log entries to return" },
        offset: { type: "number", description: "Number of log entries to skip" },
        level: {
          type: "string",
          enum: ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
          description: "Minimum log level",
        },
        sort: {
          type: "string",
          enum: ["ASC", "DESC"],
          description: "Sort order by timestamp",
        },
      },
      required: ["flow_run_id"],
    },
  },
];

// =============================================================================
// Tool Implementations
// =============================================================================

async function listFlows(params: {
  limit?: number;
  offset?: number;
  name_like?: string;
  tags?: string[];
}): Promise<any> {
  const body: any = {
    limit: params.limit || 50,
    offset: params.offset || 0,
  };

  if (params.name_like || params.tags) {
    body.flows = {};
    if (params.name_like) {
      body.flows.name = { like_: params.name_like };
    }
    if (params.tags && params.tags.length > 0) {
      body.flows.tags = { all_: params.tags };
    }
  }

  const flows = await prefectRequest("/flows/filter", "POST", body);

  return {
    flows: flows.map((flow: any) => ({
      id: flow.id,
      name: flow.name,
      tags: flow.tags,
      created: flow.created,
      updated: flow.updated,
    })),
    count: flows.length,
  };
}

async function getFlow(params: { flow_id: string }): Promise<any> {
  const flow = await prefectRequest(`/flows/${params.flow_id}`);

  return {
    id: flow.id,
    name: flow.name,
    tags: flow.tags,
    created: flow.created,
    updated: flow.updated,
  };
}

async function listDeployments(params: {
  limit?: number;
  offset?: number;
  flow_id?: string;
  name_like?: string;
  tags?: string[];
}): Promise<any> {
  const body: any = {
    limit: params.limit || 50,
    offset: params.offset || 0,
  };

  const deploymentFilter: any = {};
  if (params.name_like) {
    deploymentFilter.name = { like_: params.name_like };
  }
  if (params.tags && params.tags.length > 0) {
    deploymentFilter.tags = { all_: params.tags };
  }
  if (Object.keys(deploymentFilter).length > 0) {
    body.deployments = deploymentFilter;
  }

  if (params.flow_id) {
    body.flows = { id: { any_: [params.flow_id] } };
  }

  const deployments = await prefectRequest("/deployments/filter", "POST", body);

  return {
    deployments: deployments.map((d: any) => ({
      id: d.id,
      name: d.name,
      flow_id: d.flow_id,
      version: d.version,
      tags: d.tags,
      is_schedule_active: d.is_schedule_active,
      paused: d.paused,
      work_pool_name: d.work_pool_name,
      work_queue_name: d.work_queue_name,
      created: d.created,
      updated: d.updated,
    })),
    count: deployments.length,
  };
}

async function getDeployment(params: { deployment_id: string }): Promise<any> {
  const deployment = await prefectRequest(`/deployments/${params.deployment_id}`);

  return {
    id: deployment.id,
    name: deployment.name,
    flow_id: deployment.flow_id,
    version: deployment.version,
    description: deployment.description,
    tags: deployment.tags,
    parameters: deployment.parameters,
    is_schedule_active: deployment.is_schedule_active,
    paused: deployment.paused,
    schedules: deployment.schedules,
    work_pool_name: deployment.work_pool_name,
    work_queue_name: deployment.work_queue_name,
    path: deployment.path,
    entrypoint: deployment.entrypoint,
    created: deployment.created,
    updated: deployment.updated,
  };
}

async function createDeployment(params: {
  flow_id: string;
  name: string;
  version?: string;
  tags?: string[];
  parameters?: any;
  work_pool_name?: string;
  work_queue_name?: string;
  schedule?: any;
  is_schedule_active?: boolean;
  description?: string;
}): Promise<any> {
  const body: any = {
    flow_id: params.flow_id,
    name: params.name,
  };

  if (params.version) body.version = params.version;
  if (params.tags) body.tags = params.tags;
  if (params.parameters) body.parameters = params.parameters;
  if (params.work_pool_name) body.work_pool_name = params.work_pool_name;
  if (params.work_queue_name) body.work_queue_name = params.work_queue_name;
  if (params.description) body.description = params.description;
  if (params.is_schedule_active !== undefined) body.is_schedule_active = params.is_schedule_active;

  if (params.schedule) {
    if (params.schedule.cron) {
      body.schedules = [{
        schedule: {
          cron: params.schedule.cron,
          timezone: params.schedule.timezone || "UTC",
        },
        active: params.is_schedule_active !== false,
      }];
    } else if (params.schedule.interval) {
      body.schedules = [{
        schedule: {
          interval: params.schedule.interval,
          timezone: params.schedule.timezone || "UTC",
        },
        active: params.is_schedule_active !== false,
      }];
    }
  }

  const deployment = await prefectRequest("/deployments/", "POST", body);

  return {
    id: deployment.id,
    name: deployment.name,
    flow_id: deployment.flow_id,
    created: true,
  };
}

async function runDeployment(params: {
  deployment_id: string;
  name?: string;
  parameters?: any;
  tags?: string[];
  idempotency_key?: string;
}): Promise<any> {
  const body: any = {};

  if (params.name) body.name = params.name;
  if (params.parameters) body.parameters = params.parameters;
  if (params.tags) body.tags = params.tags;
  if (params.idempotency_key) body.idempotency_key = params.idempotency_key;

  const flowRun = await prefectRequest(
    `/deployments/${params.deployment_id}/create_flow_run`,
    "POST",
    body
  );

  return {
    id: flowRun.id,
    name: flowRun.name,
    deployment_id: params.deployment_id,
    flow_id: flowRun.flow_id,
    state: flowRun.state,
    created: flowRun.created,
  };
}

async function pauseDeployment(params: { deployment_id: string }): Promise<any> {
  await prefectRequest(
    `/deployments/${params.deployment_id}/set_schedule_inactive`,
    "POST"
  );

  return {
    deployment_id: params.deployment_id,
    paused: true,
  };
}

async function resumeDeployment(params: { deployment_id: string }): Promise<any> {
  await prefectRequest(
    `/deployments/${params.deployment_id}/set_schedule_active`,
    "POST"
  );

  return {
    deployment_id: params.deployment_id,
    resumed: true,
  };
}

async function listFlowRuns(params: {
  limit?: number;
  offset?: number;
  flow_id?: string;
  deployment_id?: string;
  state_type?: string;
  state_name?: string;
  tags?: string[];
  start_time_after?: string;
  start_time_before?: string;
}): Promise<any> {
  const body: any = {
    limit: params.limit || 50,
    offset: params.offset || 0,
    sort: "EXPECTED_START_TIME_DESC",
  };

  const flowRunFilter: any = {};
  if (params.state_type) {
    flowRunFilter.state = { type: { any_: [params.state_type] } };
  }
  if (params.state_name) {
    flowRunFilter.state = { ...flowRunFilter.state, name: { any_: [params.state_name] } };
  }
  if (params.tags && params.tags.length > 0) {
    flowRunFilter.tags = { all_: params.tags };
  }
  if (params.start_time_after || params.start_time_before) {
    flowRunFilter.start_time = {};
    if (params.start_time_after) {
      flowRunFilter.start_time.after_ = params.start_time_after;
    }
    if (params.start_time_before) {
      flowRunFilter.start_time.before_ = params.start_time_before;
    }
  }
  if (Object.keys(flowRunFilter).length > 0) {
    body.flow_runs = flowRunFilter;
  }

  if (params.flow_id) {
    body.flows = { id: { any_: [params.flow_id] } };
  }
  if (params.deployment_id) {
    body.deployments = { id: { any_: [params.deployment_id] } };
  }

  const flowRuns = await prefectRequest("/flow_runs/filter", "POST", body);

  return {
    flow_runs: flowRuns.map((fr: any) => ({
      id: fr.id,
      name: fr.name,
      flow_id: fr.flow_id,
      deployment_id: fr.deployment_id,
      state: fr.state,
      tags: fr.tags,
      start_time: fr.start_time,
      end_time: fr.end_time,
      total_run_time: fr.total_run_time,
      created: fr.created,
    })),
    count: flowRuns.length,
  };
}

async function getFlowRun(params: { flow_run_id: string }): Promise<any> {
  const flowRun = await prefectRequest(`/flow_runs/${params.flow_run_id}`);

  return {
    id: flowRun.id,
    name: flowRun.name,
    flow_id: flowRun.flow_id,
    deployment_id: flowRun.deployment_id,
    state: flowRun.state,
    parameters: flowRun.parameters,
    tags: flowRun.tags,
    start_time: flowRun.start_time,
    end_time: flowRun.end_time,
    total_run_time: flowRun.total_run_time,
    estimated_run_time: flowRun.estimated_run_time,
    estimated_start_time_delta: flowRun.estimated_start_time_delta,
    created: flowRun.created,
    updated: flowRun.updated,
  };
}

async function cancelFlowRun(params: { flow_run_id: string }): Promise<any> {
  await prefectRequest(`/flow_runs/${params.flow_run_id}/set_state`, "POST", {
    state: {
      type: "CANCELLING",
      name: "Cancelling",
    },
  });

  return {
    flow_run_id: params.flow_run_id,
    cancelled: true,
  };
}

async function listTaskRuns(params: {
  limit?: number;
  offset?: number;
  flow_run_id?: string;
  state_type?: string;
  state_name?: string;
  name_like?: string;
  tags?: string[];
}): Promise<any> {
  const body: any = {
    limit: params.limit || 50,
    offset: params.offset || 0,
    sort: "EXPECTED_START_TIME_DESC",
  };

  const taskRunFilter: any = {};
  if (params.state_type) {
    taskRunFilter.state = { type: { any_: [params.state_type] } };
  }
  if (params.state_name) {
    taskRunFilter.state = { ...taskRunFilter.state, name: { any_: [params.state_name] } };
  }
  if (params.name_like) {
    taskRunFilter.name = { like_: params.name_like };
  }
  if (params.tags && params.tags.length > 0) {
    taskRunFilter.tags = { all_: params.tags };
  }
  if (Object.keys(taskRunFilter).length > 0) {
    body.task_runs = taskRunFilter;
  }

  if (params.flow_run_id) {
    body.flow_runs = { id: { any_: [params.flow_run_id] } };
  }

  const taskRuns = await prefectRequest("/task_runs/filter", "POST", body);

  return {
    task_runs: taskRuns.map((tr: any) => ({
      id: tr.id,
      name: tr.name,
      flow_run_id: tr.flow_run_id,
      task_key: tr.task_key,
      state: tr.state,
      tags: tr.tags,
      start_time: tr.start_time,
      end_time: tr.end_time,
      total_run_time: tr.total_run_time,
      run_count: tr.run_count,
      created: tr.created,
    })),
    count: taskRuns.length,
  };
}

async function getTaskRun(params: { task_run_id: string }): Promise<any> {
  const taskRun = await prefectRequest(`/task_runs/${params.task_run_id}`);

  return {
    id: taskRun.id,
    name: taskRun.name,
    flow_run_id: taskRun.flow_run_id,
    task_key: taskRun.task_key,
    dynamic_key: taskRun.dynamic_key,
    state: taskRun.state,
    task_inputs: taskRun.task_inputs,
    tags: taskRun.tags,
    start_time: taskRun.start_time,
    end_time: taskRun.end_time,
    total_run_time: taskRun.total_run_time,
    run_count: taskRun.run_count,
    expected_start_time: taskRun.expected_start_time,
    created: taskRun.created,
    updated: taskRun.updated,
  };
}

async function listWorkPools(params: {
  limit?: number;
  offset?: number;
  name_like?: string;
  type?: string;
}): Promise<any> {
  const body: any = {
    limit: params.limit || 50,
    offset: params.offset || 0,
  };

  const workPoolFilter: any = {};
  if (params.name_like) {
    workPoolFilter.name = { like_: params.name_like };
  }
  if (params.type) {
    workPoolFilter.type = { any_: [params.type] };
  }
  if (Object.keys(workPoolFilter).length > 0) {
    body.work_pools = workPoolFilter;
  }

  const workPools = await prefectRequest("/work_pools/filter", "POST", body);

  return {
    work_pools: workPools.map((wp: any) => ({
      id: wp.id,
      name: wp.name,
      type: wp.type,
      description: wp.description,
      is_paused: wp.is_paused,
      status: wp.status,
      created: wp.created,
      updated: wp.updated,
    })),
    count: workPools.length,
  };
}

async function createWorkPool(params: {
  name: string;
  type: string;
  description?: string;
  is_paused?: boolean;
  base_job_template?: any;
}): Promise<any> {
  const body: any = {
    name: params.name,
    type: params.type,
  };

  if (params.description) body.description = params.description;
  if (params.is_paused !== undefined) body.is_paused = params.is_paused;
  if (params.base_job_template) body.base_job_template = params.base_job_template;

  const workPool = await prefectRequest("/work_pools/", "POST", body);

  return {
    id: workPool.id,
    name: workPool.name,
    type: workPool.type,
    created: true,
  };
}

async function listWorkQueues(params: {
  work_pool_name: string;
  limit?: number;
  offset?: number;
}): Promise<any> {
  const body: any = {
    limit: params.limit || 50,
    offset: params.offset || 0,
  };

  const workQueues = await prefectRequest(
    `/work_pools/${params.work_pool_name}/queues/filter`,
    "POST",
    body
  );

  return {
    work_queues: workQueues.map((wq: any) => ({
      id: wq.id,
      name: wq.name,
      work_pool_id: wq.work_pool_id,
      work_pool_name: params.work_pool_name,
      priority: wq.priority,
      is_paused: wq.is_paused,
      status: wq.status,
      created: wq.created,
      updated: wq.updated,
    })),
    count: workQueues.length,
  };
}

async function listBlocks(params: {
  limit?: number;
  offset?: number;
  block_type_slug?: string;
  name_like?: string;
}): Promise<any> {
  const body: any = {
    limit: params.limit || 50,
    offset: params.offset || 0,
    include_secrets: false,
  };

  const blockDocumentFilter: any = {};
  if (params.name_like) {
    blockDocumentFilter.name = { like_: params.name_like };
  }
  if (Object.keys(blockDocumentFilter).length > 0) {
    body.block_documents = blockDocumentFilter;
  }

  if (params.block_type_slug) {
    body.block_types = { slug: { any_: [params.block_type_slug] } };
  }

  const blocks = await prefectRequest("/block_documents/filter", "POST", body);

  return {
    blocks: blocks.map((b: any) => ({
      id: b.id,
      name: b.name,
      block_type_id: b.block_type_id,
      block_type_name: b.block_type?.name,
      block_type_slug: b.block_type?.slug,
      is_anonymous: b.is_anonymous,
      created: b.created,
      updated: b.updated,
    })),
    count: blocks.length,
  };
}

async function getBlock(params: { block_document_id: string }): Promise<any> {
  const block = await prefectRequest(`/block_documents/${params.block_document_id}`);

  return {
    id: block.id,
    name: block.name,
    block_type_id: block.block_type_id,
    block_type_name: block.block_type?.name,
    block_type_slug: block.block_type?.slug,
    data: block.data,
    is_anonymous: block.is_anonymous,
    block_schema_id: block.block_schema_id,
    created: block.created,
    updated: block.updated,
  };
}

async function listSchedules(params: { deployment_id: string }): Promise<any> {
  const deployment = await prefectRequest(`/deployments/${params.deployment_id}`);

  return {
    deployment_id: params.deployment_id,
    schedules: deployment.schedules || [],
    is_schedule_active: deployment.is_schedule_active,
  };
}

async function getLogs(params: {
  flow_run_id: string;
  limit?: number;
  offset?: number;
  level?: string;
  sort?: string;
}): Promise<any> {
  const body: any = {
    limit: params.limit || 100,
    offset: params.offset || 0,
    sort: params.sort === "ASC" ? "TIMESTAMP_ASC" : "TIMESTAMP_DESC",
    logs: {
      flow_run_id: { any_: [params.flow_run_id] },
    },
  };

  if (params.level) {
    const levelMap: Record<string, number> = {
      DEBUG: 10,
      INFO: 20,
      WARNING: 30,
      ERROR: 40,
      CRITICAL: 50,
    };
    body.logs.level = { ge_: levelMap[params.level] || 0 };
  }

  const logs = await prefectRequest("/logs/filter", "POST", body);

  return {
    flow_run_id: params.flow_run_id,
    logs: logs.map((log: any) => ({
      id: log.id,
      level: log.level,
      message: log.message,
      name: log.name,
      timestamp: log.timestamp,
      flow_run_id: log.flow_run_id,
      task_run_id: log.task_run_id,
    })),
    count: logs.length,
  };
}

// =============================================================================
// Server Setup
// =============================================================================

const server = new Server(
  { name: "prefect-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: any;

    switch (name) {
      // Flow operations
      case "list_flows": result = await listFlows(args as any); break;
      case "get_flow": result = await getFlow(args as any); break;
      // Deployment operations
      case "list_deployments": result = await listDeployments(args as any); break;
      case "get_deployment": result = await getDeployment(args as any); break;
      case "create_deployment": result = await createDeployment(args as any); break;
      case "run_deployment": result = await runDeployment(args as any); break;
      case "pause_deployment": result = await pauseDeployment(args as any); break;
      case "resume_deployment": result = await resumeDeployment(args as any); break;
      // Flow run operations
      case "list_flow_runs": result = await listFlowRuns(args as any); break;
      case "get_flow_run": result = await getFlowRun(args as any); break;
      case "cancel_flow_run": result = await cancelFlowRun(args as any); break;
      // Task run operations
      case "list_task_runs": result = await listTaskRuns(args as any); break;
      case "get_task_run": result = await getTaskRun(args as any); break;
      // Work pool operations
      case "list_work_pools": result = await listWorkPools(args as any); break;
      case "create_work_pool": result = await createWorkPool(args as any); break;
      // Work queue operations
      case "list_work_queues": result = await listWorkQueues(args as any); break;
      // Block operations
      case "list_blocks": result = await listBlocks(args as any); break;
      case "get_block": result = await getBlock(args as any); break;
      // Schedule operations
      case "list_schedules": result = await listSchedules(args as any); break;
      // Log operations
      case "get_logs": result = await getLogs(args as any); break;
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
  console.error("Prefect MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
