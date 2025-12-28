/**
 * KOSMOS Scheduler MCP Server
 *
 * Implements task scheduling tools for the KOSMOS system:
 *
 * Schedule Management:
 * 1. create_schedule - Create a scheduled task
 * 2. update_schedule - Update an existing schedule
 * 3. delete_schedule - Delete a schedule
 * 4. list_schedules - List all schedules
 * 5. get_schedule - Get schedule details
 * 6. enable_schedule - Enable a schedule
 * 7. disable_schedule - Disable a schedule
 *
 * Execution Management:
 * 8. trigger_now - Trigger scheduled task immediately
 * 9. list_executions - List execution history
 * 10. get_execution - Get execution details
 * 11. cancel_execution - Cancel a running execution
 *
 * Workflow Management:
 * 12. create_workflow - Create a multi-step workflow
 * 13. get_workflow - Get workflow definition
 * 14. list_workflows - List all workflows
 * 15. trigger_workflow - Trigger a workflow
 * 16. get_workflow_status - Get workflow execution status
 *
 * Cron and Scheduling:
 * 17. set_cron - Set cron expression for a schedule
 * 18. get_next_runs - Get next scheduled runs
 *
 * Global Control:
 * 19. pause_all - Pause all schedules
 * 20. resume_all - Resume all schedules
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// =============================================================================
// Types and Interfaces
// =============================================================================

type ScheduleStatus = "enabled" | "disabled" | "paused";
type ExecutionStatus = "pending" | "running" | "completed" | "failed" | "cancelled" | "timeout";
type WorkflowStatus = "pending" | "running" | "completed" | "failed" | "cancelled" | "paused";
type StepStatus = "pending" | "running" | "completed" | "failed" | "skipped";

interface Schedule {
  id: string;
  name: string;
  description: string;
  cronExpression: string;
  timezone: string;
  status: ScheduleStatus;
  taskType: string;
  taskPayload: Record<string, unknown>;
  retryConfig: RetryConfig;
  timeout: number; // milliseconds
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  lastRunAt?: Date;
  nextRunAt?: Date;
  metadata: Record<string, unknown>;
}

interface RetryConfig {
  maxRetries: number;
  retryDelayMs: number;
  backoffMultiplier: number;
  maxDelayMs: number;
}

interface Execution {
  id: string;
  scheduleId?: string;
  workflowId?: string;
  workflowExecutionId?: string;
  status: ExecutionStatus;
  taskType: string;
  taskPayload: Record<string, unknown>;
  result?: unknown;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  retryCount: number;
  logs: ExecutionLog[];
  metadata: Record<string, unknown>;
}

interface ExecutionLog {
  timestamp: Date;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  data?: Record<string, unknown>;
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  status: ScheduleStatus;
  concurrency: number;
  timeout: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown>;
}

interface WorkflowStep {
  id: string;
  name: string;
  taskType: string;
  taskPayload: Record<string, unknown>;
  dependsOn: string[]; // step IDs
  timeout: number;
  retryConfig: RetryConfig;
  condition?: string; // JavaScript expression
}

interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: WorkflowStatus;
  stepExecutions: StepExecution[];
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  error?: string;
  metadata: Record<string, unknown>;
}

interface StepExecution {
  stepId: string;
  stepName: string;
  status: StepStatus;
  executionId?: string;
  startedAt?: Date;
  completedAt?: Date;
  result?: unknown;
  error?: string;
}

// Global pause flag
let globalPaused = false;

// =============================================================================
// Cron Parser - Simple Implementation
// =============================================================================

interface CronParts {
  minute: number[];
  hour: number[];
  dayOfMonth: number[];
  month: number[];
  dayOfWeek: number[];
}

function parseRange(part: string, min: number, max: number): number[] {
  const result: number[] = [];

  if (part === "*") {
    for (let i = min; i <= max; i++) result.push(i);
    return result;
  }

  // Handle step values like */5 or 1-10/2
  if (part.includes("/")) {
    const [range, stepStr] = part.split("/");
    const step = parseInt(stepStr, 10);
    let start = min;
    let end = max;

    if (range !== "*") {
      if (range.includes("-")) {
        const [startStr, endStr] = range.split("-");
        start = parseInt(startStr, 10);
        end = parseInt(endStr, 10);
      } else {
        start = parseInt(range, 10);
      }
    }

    for (let i = start; i <= end; i += step) {
      result.push(i);
    }
    return result;
  }

  // Handle ranges like 1-5
  if (part.includes("-")) {
    const [startStr, endStr] = part.split("-");
    const start = parseInt(startStr, 10);
    const end = parseInt(endStr, 10);
    for (let i = start; i <= end; i++) result.push(i);
    return result;
  }

  // Handle comma-separated values like 1,3,5
  if (part.includes(",")) {
    return part.split(",").map((v) => parseInt(v.trim(), 10));
  }

  // Single value
  result.push(parseInt(part, 10));
  return result;
}

function parseCron(expression: string): CronParts {
  const parts = expression.trim().split(/\s+/);

  if (parts.length !== 5) {
    throw new Error(`Invalid cron expression: expected 5 parts, got ${parts.length}`);
  }

  return {
    minute: parseRange(parts[0], 0, 59),
    hour: parseRange(parts[1], 0, 23),
    dayOfMonth: parseRange(parts[2], 1, 31),
    month: parseRange(parts[3], 1, 12),
    dayOfWeek: parseRange(parts[4], 0, 6),
  };
}

function getNextRun(cronParts: CronParts, after: Date = new Date()): Date {
  const next = new Date(after.getTime() + 60000); // Start from next minute
  next.setSeconds(0);
  next.setMilliseconds(0);

  // Simple iteration to find next matching time (up to 1 year)
  const maxIterations = 525600; // minutes in a year

  for (let i = 0; i < maxIterations; i++) {
    const minute = next.getMinutes();
    const hour = next.getHours();
    const dayOfMonth = next.getDate();
    const month = next.getMonth() + 1; // 1-12
    const dayOfWeek = next.getDay(); // 0-6

    if (
      cronParts.minute.includes(minute) &&
      cronParts.hour.includes(hour) &&
      cronParts.dayOfMonth.includes(dayOfMonth) &&
      cronParts.month.includes(month) &&
      cronParts.dayOfWeek.includes(dayOfWeek)
    ) {
      return next;
    }

    next.setMinutes(next.getMinutes() + 1);
  }

  throw new Error("Could not find next run within 1 year");
}

function getNextRuns(cronExpression: string, count: number = 5, after: Date = new Date()): Date[] {
  const cronParts = parseCron(cronExpression);
  const runs: Date[] = [];
  let current = after;

  for (let i = 0; i < count; i++) {
    const nextRun = getNextRun(cronParts, current);
    runs.push(nextRun);
    current = nextRun;
  }

  return runs;
}

function validateCron(expression: string): { valid: boolean; error?: string } {
  try {
    parseCron(expression);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// =============================================================================
// Zod Schemas
// =============================================================================

const RetryConfigSchema = z.object({
  maxRetries: z.number().min(0).max(10).default(3),
  retryDelayMs: z.number().min(0).default(1000),
  backoffMultiplier: z.number().min(1).max(10).default(2),
  maxDelayMs: z.number().min(0).default(300000),
});

const CreateScheduleSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().default(""),
  cronExpression: z.string(),
  timezone: z.string().default("UTC"),
  taskType: z.string().min(1),
  taskPayload: z.record(z.unknown()).default({}),
  retryConfig: RetryConfigSchema.optional(),
  timeout: z.number().min(1000).default(300000), // 5 min default
  tags: z.array(z.string()).default([]),
  enabled: z.boolean().default(true),
  metadata: z.record(z.unknown()).optional(),
});

const UpdateScheduleSchema = z.object({
  scheduleId: z.string(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  cronExpression: z.string().optional(),
  timezone: z.string().optional(),
  taskType: z.string().min(1).optional(),
  taskPayload: z.record(z.unknown()).optional(),
  retryConfig: RetryConfigSchema.optional(),
  timeout: z.number().min(1000).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const DeleteScheduleSchema = z.object({
  scheduleId: z.string(),
  force: z.boolean().default(false),
});

const ListSchedulesSchema = z.object({
  status: z.enum(["all", "enabled", "disabled", "paused"]).optional(),
  taskType: z.string().optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
});

const GetScheduleSchema = z.object({
  scheduleId: z.string(),
});

const EnableScheduleSchema = z.object({
  scheduleId: z.string(),
});

const DisableScheduleSchema = z.object({
  scheduleId: z.string(),
});

const TriggerNowSchema = z.object({
  scheduleId: z.string(),
  overridePayload: z.record(z.unknown()).optional(),
});

const ListExecutionsSchema = z.object({
  scheduleId: z.string().optional(),
  workflowId: z.string().optional(),
  status: z.enum(["all", "pending", "running", "completed", "failed", "cancelled", "timeout"]).optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
});

const GetExecutionSchema = z.object({
  executionId: z.string(),
});

const CancelExecutionSchema = z.object({
  executionId: z.string(),
  reason: z.string().optional(),
});

const WorkflowStepSchema = z.object({
  name: z.string().min(1),
  taskType: z.string().min(1),
  taskPayload: z.record(z.unknown()).default({}),
  dependsOn: z.array(z.string()).default([]),
  timeout: z.number().min(1000).default(60000),
  retryConfig: RetryConfigSchema.optional(),
  condition: z.string().optional(),
});

const CreateWorkflowSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().default(""),
  steps: z.array(WorkflowStepSchema).min(1),
  concurrency: z.number().min(1).max(10).default(1),
  timeout: z.number().min(1000).default(3600000), // 1 hour default
  tags: z.array(z.string()).default([]),
  enabled: z.boolean().default(true),
  metadata: z.record(z.unknown()).optional(),
});

const GetWorkflowSchema = z.object({
  workflowId: z.string(),
});

const ListWorkflowsSchema = z.object({
  status: z.enum(["all", "enabled", "disabled"]).optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
});

const TriggerWorkflowSchema = z.object({
  workflowId: z.string(),
  initialContext: z.record(z.unknown()).optional(),
});

const GetWorkflowStatusSchema = z.object({
  workflowExecutionId: z.string(),
});

const SetCronSchema = z.object({
  scheduleId: z.string(),
  cronExpression: z.string(),
  timezone: z.string().optional(),
});

const GetNextRunsSchema = z.object({
  scheduleId: z.string().optional(),
  cronExpression: z.string().optional(),
  count: z.number().min(1).max(20).default(5),
});

const PauseAllSchema = z.object({
  reason: z.string().optional(),
});

const ResumeAllSchema = z.object({
  reason: z.string().optional(),
});

// =============================================================================
// Tool Definitions
// =============================================================================

const TOOLS: Tool[] = [
  // Schedule Management Tools
  {
    name: "create_schedule",
    description: "Create a new scheduled task with cron expression",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Schedule name (max 200 chars)" },
        description: { type: "string", description: "Schedule description" },
        cronExpression: {
          type: "string",
          description: "Cron expression (5 parts: minute hour dayOfMonth month dayOfWeek)",
        },
        timezone: { type: "string", description: "Timezone (default: UTC)" },
        taskType: { type: "string", description: "Type of task to execute" },
        taskPayload: { type: "object", description: "Payload to pass to the task" },
        retryConfig: {
          type: "object",
          properties: {
            maxRetries: { type: "number", description: "Maximum retry attempts" },
            retryDelayMs: { type: "number", description: "Initial retry delay in ms" },
            backoffMultiplier: { type: "number", description: "Backoff multiplier for retries" },
            maxDelayMs: { type: "number", description: "Maximum delay between retries" },
          },
          description: "Retry configuration",
        },
        timeout: { type: "number", description: "Task timeout in milliseconds" },
        tags: { type: "array", items: { type: "string" }, description: "Tags for categorization" },
        enabled: { type: "boolean", description: "Whether schedule is enabled (default: true)" },
        metadata: { type: "object", description: "Additional metadata" },
      },
      required: ["name", "cronExpression", "taskType"],
    },
  },
  {
    name: "update_schedule",
    description: "Update an existing schedule",
    inputSchema: {
      type: "object",
      properties: {
        scheduleId: { type: "string", description: "ID of the schedule to update" },
        name: { type: "string", description: "New schedule name" },
        description: { type: "string", description: "New description" },
        cronExpression: { type: "string", description: "New cron expression" },
        timezone: { type: "string", description: "New timezone" },
        taskType: { type: "string", description: "New task type" },
        taskPayload: { type: "object", description: "New task payload" },
        retryConfig: { type: "object", description: "New retry configuration" },
        timeout: { type: "number", description: "New timeout" },
        tags: { type: "array", items: { type: "string" }, description: "New tags" },
        metadata: { type: "object", description: "New metadata" },
      },
      required: ["scheduleId"],
    },
  },
  {
    name: "delete_schedule",
    description: "Delete a schedule",
    inputSchema: {
      type: "object",
      properties: {
        scheduleId: { type: "string", description: "ID of the schedule to delete" },
        force: { type: "boolean", description: "Force delete even if executions are running" },
      },
      required: ["scheduleId"],
    },
  },
  {
    name: "list_schedules",
    description: "List all schedules with optional filters",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["all", "enabled", "disabled", "paused"],
          description: "Filter by status",
        },
        taskType: { type: "string", description: "Filter by task type" },
        tags: { type: "array", items: { type: "string" }, description: "Filter by tags (any match)" },
        limit: { type: "number", description: "Maximum results (default: 50)" },
        offset: { type: "number", description: "Offset for pagination" },
      },
    },
  },
  {
    name: "get_schedule",
    description: "Get details of a specific schedule",
    inputSchema: {
      type: "object",
      properties: {
        scheduleId: { type: "string", description: "ID of the schedule" },
      },
      required: ["scheduleId"],
    },
  },
  {
    name: "enable_schedule",
    description: "Enable a disabled schedule",
    inputSchema: {
      type: "object",
      properties: {
        scheduleId: { type: "string", description: "ID of the schedule to enable" },
      },
      required: ["scheduleId"],
    },
  },
  {
    name: "disable_schedule",
    description: "Disable an active schedule",
    inputSchema: {
      type: "object",
      properties: {
        scheduleId: { type: "string", description: "ID of the schedule to disable" },
      },
      required: ["scheduleId"],
    },
  },

  // Execution Management Tools
  {
    name: "trigger_now",
    description: "Trigger a scheduled task immediately",
    inputSchema: {
      type: "object",
      properties: {
        scheduleId: { type: "string", description: "ID of the schedule to trigger" },
        overridePayload: { type: "object", description: "Override the task payload for this execution" },
      },
      required: ["scheduleId"],
    },
  },
  {
    name: "list_executions",
    description: "List execution history with optional filters",
    inputSchema: {
      type: "object",
      properties: {
        scheduleId: { type: "string", description: "Filter by schedule ID" },
        workflowId: { type: "string", description: "Filter by workflow ID" },
        status: {
          type: "string",
          enum: ["all", "pending", "running", "completed", "failed", "cancelled", "timeout"],
          description: "Filter by execution status",
        },
        fromDate: { type: "string", description: "Start date (ISO format)" },
        toDate: { type: "string", description: "End date (ISO format)" },
        limit: { type: "number", description: "Maximum results (default: 50)" },
        offset: { type: "number", description: "Offset for pagination" },
      },
    },
  },
  {
    name: "get_execution",
    description: "Get details of a specific execution",
    inputSchema: {
      type: "object",
      properties: {
        executionId: { type: "string", description: "ID of the execution" },
      },
      required: ["executionId"],
    },
  },
  {
    name: "cancel_execution",
    description: "Cancel a running execution",
    inputSchema: {
      type: "object",
      properties: {
        executionId: { type: "string", description: "ID of the execution to cancel" },
        reason: { type: "string", description: "Reason for cancellation" },
      },
      required: ["executionId"],
    },
  },

  // Workflow Management Tools
  {
    name: "create_workflow",
    description: "Create a multi-step workflow",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Workflow name" },
        description: { type: "string", description: "Workflow description" },
        steps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Step name" },
              taskType: { type: "string", description: "Task type for this step" },
              taskPayload: { type: "object", description: "Task payload" },
              dependsOn: { type: "array", items: { type: "string" }, description: "IDs of dependent steps" },
              timeout: { type: "number", description: "Step timeout in ms" },
              retryConfig: { type: "object", description: "Retry configuration" },
              condition: { type: "string", description: "JavaScript condition expression" },
            },
            required: ["name", "taskType"],
          },
          description: "Workflow steps",
        },
        concurrency: { type: "number", description: "Max concurrent steps (default: 1)" },
        timeout: { type: "number", description: "Workflow timeout in ms" },
        tags: { type: "array", items: { type: "string" }, description: "Tags" },
        enabled: { type: "boolean", description: "Whether workflow is enabled" },
        metadata: { type: "object", description: "Additional metadata" },
      },
      required: ["name", "steps"],
    },
  },
  {
    name: "get_workflow",
    description: "Get workflow definition",
    inputSchema: {
      type: "object",
      properties: {
        workflowId: { type: "string", description: "ID of the workflow" },
      },
      required: ["workflowId"],
    },
  },
  {
    name: "list_workflows",
    description: "List all workflows",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["all", "enabled", "disabled"],
          description: "Filter by status",
        },
        tags: { type: "array", items: { type: "string" }, description: "Filter by tags" },
        limit: { type: "number", description: "Maximum results" },
        offset: { type: "number", description: "Offset for pagination" },
      },
    },
  },
  {
    name: "trigger_workflow",
    description: "Trigger a workflow execution",
    inputSchema: {
      type: "object",
      properties: {
        workflowId: { type: "string", description: "ID of the workflow to trigger" },
        initialContext: { type: "object", description: "Initial context/variables for the workflow" },
      },
      required: ["workflowId"],
    },
  },
  {
    name: "get_workflow_status",
    description: "Get workflow execution status and progress",
    inputSchema: {
      type: "object",
      properties: {
        workflowExecutionId: { type: "string", description: "ID of the workflow execution" },
      },
      required: ["workflowExecutionId"],
    },
  },

  // Cron and Scheduling Tools
  {
    name: "set_cron",
    description: "Set or update cron expression for a schedule",
    inputSchema: {
      type: "object",
      properties: {
        scheduleId: { type: "string", description: "ID of the schedule" },
        cronExpression: { type: "string", description: "New cron expression" },
        timezone: { type: "string", description: "Timezone (optional)" },
      },
      required: ["scheduleId", "cronExpression"],
    },
  },
  {
    name: "get_next_runs",
    description: "Get next scheduled run times",
    inputSchema: {
      type: "object",
      properties: {
        scheduleId: { type: "string", description: "Get next runs for a specific schedule" },
        cronExpression: { type: "string", description: "Or provide a cron expression directly" },
        count: { type: "number", description: "Number of future runs to return (default: 5)" },
      },
    },
  },

  // Global Control Tools
  {
    name: "pause_all",
    description: "Pause all schedules globally",
    inputSchema: {
      type: "object",
      properties: {
        reason: { type: "string", description: "Reason for pausing all schedules" },
      },
    },
  },
  {
    name: "resume_all",
    description: "Resume all paused schedules",
    inputSchema: {
      type: "object",
      properties: {
        reason: { type: "string", description: "Reason for resuming schedules" },
      },
    },
  },
];

// =============================================================================
// In-Memory Storage
// =============================================================================

const schedules: Map<string, Schedule> = new Map();
const executions: Map<string, Execution> = new Map();
const workflows: Map<string, Workflow> = new Map();
const workflowExecutions: Map<string, WorkflowExecution> = new Map();

// =============================================================================
// Helper Functions
// =============================================================================

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function defaultRetryConfig(): RetryConfig {
  return {
    maxRetries: 3,
    retryDelayMs: 1000,
    backoffMultiplier: 2,
    maxDelayMs: 300000,
  };
}

function updateNextRun(schedule: Schedule): void {
  try {
    const runs = getNextRuns(schedule.cronExpression, 1);
    schedule.nextRunAt = runs[0];
  } catch {
    schedule.nextRunAt = undefined;
  }
}

// =============================================================================
// Tool Handlers
// =============================================================================

// Schedule Management Handlers

async function createSchedule(params: z.infer<typeof CreateScheduleSchema>): Promise<Schedule> {
  // Validate cron expression
  const validation = validateCron(params.cronExpression);
  if (!validation.valid) {
    throw new Error(`Invalid cron expression: ${validation.error}`);
  }

  const id = generateId("sched");
  const now = new Date();

  const schedule: Schedule = {
    id,
    name: params.name,
    description: params.description ?? "",
    cronExpression: params.cronExpression,
    timezone: params.timezone ?? "UTC",
    status: params.enabled ? "enabled" : "disabled",
    taskType: params.taskType,
    taskPayload: params.taskPayload ?? {},
    retryConfig: params.retryConfig ?? defaultRetryConfig(),
    timeout: params.timeout ?? 300000,
    tags: params.tags ?? [],
    createdAt: now,
    updatedAt: now,
    metadata: params.metadata ?? {},
  };

  updateNextRun(schedule);
  schedules.set(id, schedule);

  return schedule;
}

async function updateSchedule(params: z.infer<typeof UpdateScheduleSchema>): Promise<Schedule> {
  const schedule = schedules.get(params.scheduleId);
  if (!schedule) throw new Error(`Schedule not found: ${params.scheduleId}`);

  if (params.cronExpression) {
    const validation = validateCron(params.cronExpression);
    if (!validation.valid) {
      throw new Error(`Invalid cron expression: ${validation.error}`);
    }
    schedule.cronExpression = params.cronExpression;
  }

  if (params.name !== undefined) schedule.name = params.name;
  if (params.description !== undefined) schedule.description = params.description;
  if (params.timezone !== undefined) schedule.timezone = params.timezone;
  if (params.taskType !== undefined) schedule.taskType = params.taskType;
  if (params.taskPayload !== undefined) schedule.taskPayload = params.taskPayload;
  if (params.retryConfig !== undefined) schedule.retryConfig = params.retryConfig;
  if (params.timeout !== undefined) schedule.timeout = params.timeout;
  if (params.tags !== undefined) schedule.tags = params.tags;
  if (params.metadata !== undefined) schedule.metadata = params.metadata;

  schedule.updatedAt = new Date();
  updateNextRun(schedule);

  return schedule;
}

async function deleteSchedule(params: z.infer<typeof DeleteScheduleSchema>) {
  const schedule = schedules.get(params.scheduleId);
  if (!schedule) throw new Error(`Schedule not found: ${params.scheduleId}`);

  // Check for running executions
  if (!params.force) {
    const runningExecutions = Array.from(executions.values()).filter(
      (e) => e.scheduleId === params.scheduleId && e.status === "running"
    );
    if (runningExecutions.length > 0) {
      throw new Error(
        `Schedule has ${runningExecutions.length} running execution(s). Use force=true to delete anyway.`
      );
    }
  }

  schedules.delete(params.scheduleId);

  return {
    deleted: true,
    scheduleId: params.scheduleId,
    scheduleName: schedule.name,
    timestamp: new Date().toISOString(),
  };
}

async function listSchedules(params: z.infer<typeof ListSchedulesSchema>) {
  let results = Array.from(schedules.values());

  // Apply status filter
  if (params.status && params.status !== "all") {
    results = results.filter((s) => s.status === params.status);
  }

  // Apply task type filter
  if (params.taskType) {
    results = results.filter((s) => s.taskType === params.taskType);
  }

  // Apply tags filter (any match)
  if (params.tags && params.tags.length > 0) {
    results = results.filter((s) => s.tags.some((t) => params.tags!.includes(t)));
  }

  // Sort by created date (newest first)
  results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const total = results.length;
  const offset = params.offset ?? 0;
  const limit = params.limit ?? 50;

  results = results.slice(offset, offset + limit);

  return {
    schedules: results.map((s) => ({
      id: s.id,
      name: s.name,
      status: s.status,
      cronExpression: s.cronExpression,
      taskType: s.taskType,
      nextRunAt: s.nextRunAt,
      lastRunAt: s.lastRunAt,
      tags: s.tags,
    })),
    total,
    offset,
    limit,
    globalPaused,
  };
}

async function getSchedule(params: z.infer<typeof GetScheduleSchema>) {
  const schedule = schedules.get(params.scheduleId);
  if (!schedule) throw new Error(`Schedule not found: ${params.scheduleId}`);

  // Get recent executions
  const recentExecutions = Array.from(executions.values())
    .filter((e) => e.scheduleId === params.scheduleId)
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
    .slice(0, 5);

  return {
    schedule,
    recentExecutions: recentExecutions.map((e) => ({
      id: e.id,
      status: e.status,
      startedAt: e.startedAt,
      completedAt: e.completedAt,
      duration: e.duration,
    })),
    globalPaused,
  };
}

async function enableSchedule(params: z.infer<typeof EnableScheduleSchema>) {
  const schedule = schedules.get(params.scheduleId);
  if (!schedule) throw new Error(`Schedule not found: ${params.scheduleId}`);

  if (schedule.status === "enabled") {
    throw new Error("Schedule is already enabled");
  }

  schedule.status = "enabled";
  schedule.updatedAt = new Date();
  updateNextRun(schedule);

  return {
    enabled: true,
    scheduleId: schedule.id,
    scheduleName: schedule.name,
    nextRunAt: schedule.nextRunAt,
    timestamp: new Date().toISOString(),
  };
}

async function disableSchedule(params: z.infer<typeof DisableScheduleSchema>) {
  const schedule = schedules.get(params.scheduleId);
  if (!schedule) throw new Error(`Schedule not found: ${params.scheduleId}`);

  if (schedule.status === "disabled") {
    throw new Error("Schedule is already disabled");
  }

  schedule.status = "disabled";
  schedule.updatedAt = new Date();

  return {
    disabled: true,
    scheduleId: schedule.id,
    scheduleName: schedule.name,
    timestamp: new Date().toISOString(),
  };
}

// Execution Management Handlers

async function triggerNow(params: z.infer<typeof TriggerNowSchema>): Promise<Execution> {
  const schedule = schedules.get(params.scheduleId);
  if (!schedule) throw new Error(`Schedule not found: ${params.scheduleId}`);

  if (globalPaused) {
    throw new Error("All schedules are globally paused. Use resume_all first.");
  }

  const id = generateId("exec");
  const now = new Date();

  const execution: Execution = {
    id,
    scheduleId: params.scheduleId,
    status: "running",
    taskType: schedule.taskType,
    taskPayload: params.overridePayload ?? schedule.taskPayload,
    startedAt: now,
    retryCount: 0,
    logs: [
      {
        timestamp: now,
        level: "info",
        message: "Execution started (manual trigger)",
        data: { triggeredAt: now.toISOString() },
      },
    ],
    metadata: {},
  };

  executions.set(id, execution);

  // Simulate task completion after a short delay
  setTimeout(() => {
    execution.status = "completed";
    execution.completedAt = new Date();
    execution.duration = execution.completedAt.getTime() - execution.startedAt.getTime();
    execution.result = { success: true, message: "Task completed successfully" };
    execution.logs.push({
      timestamp: execution.completedAt,
      level: "info",
      message: "Execution completed",
    });

    // Update schedule's lastRunAt
    schedule.lastRunAt = execution.startedAt;
    updateNextRun(schedule);
  }, 100);

  return execution;
}

async function listExecutions(params: z.infer<typeof ListExecutionsSchema>) {
  let results = Array.from(executions.values());

  if (params.scheduleId) {
    results = results.filter((e) => e.scheduleId === params.scheduleId);
  }

  if (params.workflowId) {
    results = results.filter((e) => e.workflowId === params.workflowId);
  }

  if (params.status && params.status !== "all") {
    results = results.filter((e) => e.status === params.status);
  }

  if (params.fromDate) {
    const from = new Date(params.fromDate);
    results = results.filter((e) => e.startedAt >= from);
  }

  if (params.toDate) {
    const to = new Date(params.toDate);
    results = results.filter((e) => e.startedAt <= to);
  }

  // Sort by start date (newest first)
  results.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

  const total = results.length;
  const offset = params.offset ?? 0;
  const limit = params.limit ?? 50;

  results = results.slice(offset, offset + limit);

  return {
    executions: results.map((e) => ({
      id: e.id,
      scheduleId: e.scheduleId,
      workflowId: e.workflowId,
      status: e.status,
      taskType: e.taskType,
      startedAt: e.startedAt,
      completedAt: e.completedAt,
      duration: e.duration,
      retryCount: e.retryCount,
    })),
    total,
    offset,
    limit,
  };
}

async function getExecution(params: z.infer<typeof GetExecutionSchema>) {
  const execution = executions.get(params.executionId);
  if (!execution) throw new Error(`Execution not found: ${params.executionId}`);

  const schedule = execution.scheduleId ? schedules.get(execution.scheduleId) : null;
  const workflow = execution.workflowId ? workflows.get(execution.workflowId) : null;

  return {
    execution,
    schedule: schedule
      ? { id: schedule.id, name: schedule.name, taskType: schedule.taskType }
      : null,
    workflow: workflow
      ? { id: workflow.id, name: workflow.name }
      : null,
  };
}

async function cancelExecution(params: z.infer<typeof CancelExecutionSchema>) {
  const execution = executions.get(params.executionId);
  if (!execution) throw new Error(`Execution not found: ${params.executionId}`);

  if (execution.status !== "pending" && execution.status !== "running") {
    throw new Error(`Cannot cancel execution with status: ${execution.status}`);
  }

  const now = new Date();
  execution.status = "cancelled";
  execution.completedAt = now;
  execution.duration = now.getTime() - execution.startedAt.getTime();
  execution.error = params.reason ?? "Cancelled by user";
  execution.logs.push({
    timestamp: now,
    level: "warn",
    message: `Execution cancelled: ${params.reason ?? "No reason provided"}`,
  });

  return {
    cancelled: true,
    executionId: execution.id,
    reason: params.reason ?? "No reason provided",
    timestamp: now.toISOString(),
  };
}

// Workflow Management Handlers

async function createWorkflow(params: z.infer<typeof CreateWorkflowSchema>): Promise<Workflow> {
  const id = generateId("wf");
  const now = new Date();

  // Create steps with IDs
  const steps: WorkflowStep[] = params.steps.map((step, index) => ({
    id: `step_${index}`,
    name: step.name,
    taskType: step.taskType,
    taskPayload: step.taskPayload ?? {},
    dependsOn: step.dependsOn ?? [],
    timeout: step.timeout ?? 60000,
    retryConfig: step.retryConfig ?? defaultRetryConfig(),
    condition: step.condition,
  }));

  // Validate step dependencies
  const stepIds = new Set(steps.map((s) => s.id));
  for (const step of steps) {
    for (const dep of step.dependsOn) {
      if (!stepIds.has(dep)) {
        throw new Error(`Step "${step.name}" depends on unknown step: ${dep}`);
      }
    }
  }

  const workflow: Workflow = {
    id,
    name: params.name,
    description: params.description ?? "",
    steps,
    status: params.enabled ? "enabled" : "disabled",
    concurrency: params.concurrency ?? 1,
    timeout: params.timeout ?? 3600000,
    tags: params.tags ?? [],
    createdAt: now,
    updatedAt: now,
    metadata: params.metadata ?? {},
  };

  workflows.set(id, workflow);

  return workflow;
}

async function getWorkflow(params: z.infer<typeof GetWorkflowSchema>) {
  const workflow = workflows.get(params.workflowId);
  if (!workflow) throw new Error(`Workflow not found: ${params.workflowId}`);

  // Get recent workflow executions
  const recentExecutions = Array.from(workflowExecutions.values())
    .filter((we) => we.workflowId === params.workflowId)
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
    .slice(0, 5);

  return {
    workflow,
    recentExecutions: recentExecutions.map((we) => ({
      id: we.id,
      status: we.status,
      startedAt: we.startedAt,
      completedAt: we.completedAt,
      duration: we.duration,
    })),
  };
}

async function listWorkflows(params: z.infer<typeof ListWorkflowsSchema>) {
  let results = Array.from(workflows.values());

  if (params.status && params.status !== "all") {
    results = results.filter((w) => w.status === params.status);
  }

  if (params.tags && params.tags.length > 0) {
    results = results.filter((w) => w.tags.some((t) => params.tags!.includes(t)));
  }

  results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const total = results.length;
  const offset = params.offset ?? 0;
  const limit = params.limit ?? 50;

  results = results.slice(offset, offset + limit);

  return {
    workflows: results.map((w) => ({
      id: w.id,
      name: w.name,
      description: w.description,
      status: w.status,
      stepCount: w.steps.length,
      tags: w.tags,
      createdAt: w.createdAt,
    })),
    total,
    offset,
    limit,
  };
}

async function triggerWorkflow(params: z.infer<typeof TriggerWorkflowSchema>): Promise<WorkflowExecution> {
  const workflow = workflows.get(params.workflowId);
  if (!workflow) throw new Error(`Workflow not found: ${params.workflowId}`);

  if (workflow.status === "disabled") {
    throw new Error("Workflow is disabled");
  }

  if (globalPaused) {
    throw new Error("All schedules are globally paused. Use resume_all first.");
  }

  const id = generateId("wfexec");
  const now = new Date();

  const stepExecutions: StepExecution[] = workflow.steps.map((step) => ({
    stepId: step.id,
    stepName: step.name,
    status: "pending",
  }));

  const workflowExecution: WorkflowExecution = {
    id,
    workflowId: params.workflowId,
    status: "running",
    stepExecutions,
    startedAt: now,
    metadata: params.initialContext ?? {},
  };

  workflowExecutions.set(id, workflowExecution);

  // Simulate workflow execution
  setTimeout(() => {
    // Execute steps (simplified - in reality would handle dependencies)
    for (const stepExec of workflowExecution.stepExecutions) {
      const step = workflow.steps.find((s) => s.id === stepExec.stepId);
      if (step) {
        stepExec.status = "completed";
        stepExec.startedAt = new Date();
        stepExec.completedAt = new Date();
        stepExec.result = { success: true };
      }
    }

    workflowExecution.status = "completed";
    workflowExecution.completedAt = new Date();
    workflowExecution.duration =
      workflowExecution.completedAt.getTime() - workflowExecution.startedAt.getTime();
  }, 200);

  return workflowExecution;
}

async function getWorkflowStatus(params: z.infer<typeof GetWorkflowStatusSchema>) {
  const workflowExecution = workflowExecutions.get(params.workflowExecutionId);
  if (!workflowExecution) {
    throw new Error(`Workflow execution not found: ${params.workflowExecutionId}`);
  }

  const workflow = workflows.get(workflowExecution.workflowId);

  const completedSteps = workflowExecution.stepExecutions.filter((s) => s.status === "completed").length;
  const totalSteps = workflowExecution.stepExecutions.length;

  return {
    workflowExecution,
    workflow: workflow
      ? { id: workflow.id, name: workflow.name }
      : null,
    progress: {
      completedSteps,
      totalSteps,
      percentage: totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0,
    },
    stepDetails: workflowExecution.stepExecutions,
  };
}

// Cron and Scheduling Handlers

async function setCron(params: z.infer<typeof SetCronSchema>) {
  const schedule = schedules.get(params.scheduleId);
  if (!schedule) throw new Error(`Schedule not found: ${params.scheduleId}`);

  const validation = validateCron(params.cronExpression);
  if (!validation.valid) {
    throw new Error(`Invalid cron expression: ${validation.error}`);
  }

  const previousCron = schedule.cronExpression;
  schedule.cronExpression = params.cronExpression;
  if (params.timezone) schedule.timezone = params.timezone;
  schedule.updatedAt = new Date();
  updateNextRun(schedule);

  return {
    updated: true,
    scheduleId: schedule.id,
    scheduleName: schedule.name,
    previousCron,
    newCron: params.cronExpression,
    timezone: schedule.timezone,
    nextRunAt: schedule.nextRunAt,
    timestamp: new Date().toISOString(),
  };
}

async function handleGetNextRuns(params: z.infer<typeof GetNextRunsSchema>) {
  let cronExpression: string;
  let scheduleName: string | undefined;

  if (params.scheduleId) {
    const schedule = schedules.get(params.scheduleId);
    if (!schedule) throw new Error(`Schedule not found: ${params.scheduleId}`);
    cronExpression = schedule.cronExpression;
    scheduleName = schedule.name;
  } else if (params.cronExpression) {
    const validation = validateCron(params.cronExpression);
    if (!validation.valid) {
      throw new Error(`Invalid cron expression: ${validation.error}`);
    }
    cronExpression = params.cronExpression;
  } else {
    throw new Error("Either scheduleId or cronExpression must be provided");
  }

  const count = params.count ?? 5;
  const runs = getNextRuns(cronExpression, count);

  return {
    cronExpression,
    scheduleName,
    nextRuns: runs.map((r) => ({
      timestamp: r.toISOString(),
      dayOfWeek: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][r.getDay()],
    })),
    count,
  };
}

// Global Control Handlers

async function pauseAll(params: z.infer<typeof PauseAllSchema>) {
  if (globalPaused) {
    throw new Error("Schedules are already paused");
  }

  globalPaused = true;

  // Update all enabled schedules to paused
  const pausedSchedules: string[] = [];
  for (const schedule of schedules.values()) {
    if (schedule.status === "enabled") {
      schedule.status = "paused";
      pausedSchedules.push(schedule.id);
    }
  }

  return {
    paused: true,
    reason: params.reason ?? "No reason provided",
    schedulesAffected: pausedSchedules.length,
    timestamp: new Date().toISOString(),
  };
}

async function resumeAll(params: z.infer<typeof ResumeAllSchema>) {
  if (!globalPaused) {
    throw new Error("Schedules are not paused");
  }

  globalPaused = false;

  // Update all paused schedules to enabled
  const resumedSchedules: string[] = [];
  for (const schedule of schedules.values()) {
    if (schedule.status === "paused") {
      schedule.status = "enabled";
      updateNextRun(schedule);
      resumedSchedules.push(schedule.id);
    }
  }

  return {
    resumed: true,
    reason: params.reason ?? "No reason provided",
    schedulesAffected: resumedSchedules.length,
    timestamp: new Date().toISOString(),
  };
}

// =============================================================================
// Server Setup
// =============================================================================

const server = new Server(
  {
    name: "kosmos-scheduler-mcp",
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
      // Schedule Management
      case "create_schedule":
        result = await createSchedule(CreateScheduleSchema.parse(args));
        break;
      case "update_schedule":
        result = await updateSchedule(UpdateScheduleSchema.parse(args));
        break;
      case "delete_schedule":
        result = await deleteSchedule(DeleteScheduleSchema.parse(args));
        break;
      case "list_schedules":
        result = await listSchedules(ListSchedulesSchema.parse(args ?? {}));
        break;
      case "get_schedule":
        result = await getSchedule(GetScheduleSchema.parse(args));
        break;
      case "enable_schedule":
        result = await enableSchedule(EnableScheduleSchema.parse(args));
        break;
      case "disable_schedule":
        result = await disableSchedule(DisableScheduleSchema.parse(args));
        break;

      // Execution Management
      case "trigger_now":
        result = await triggerNow(TriggerNowSchema.parse(args));
        break;
      case "list_executions":
        result = await listExecutions(ListExecutionsSchema.parse(args ?? {}));
        break;
      case "get_execution":
        result = await getExecution(GetExecutionSchema.parse(args));
        break;
      case "cancel_execution":
        result = await cancelExecution(CancelExecutionSchema.parse(args));
        break;

      // Workflow Management
      case "create_workflow":
        result = await createWorkflow(CreateWorkflowSchema.parse(args));
        break;
      case "get_workflow":
        result = await getWorkflow(GetWorkflowSchema.parse(args));
        break;
      case "list_workflows":
        result = await listWorkflows(ListWorkflowsSchema.parse(args ?? {}));
        break;
      case "trigger_workflow":
        result = await triggerWorkflow(TriggerWorkflowSchema.parse(args));
        break;
      case "get_workflow_status":
        result = await getWorkflowStatus(GetWorkflowStatusSchema.parse(args));
        break;

      // Cron and Scheduling
      case "set_cron":
        result = await setCron(SetCronSchema.parse(args));
        break;
      case "get_next_runs":
        result = await handleGetNextRuns(GetNextRunsSchema.parse(args ?? {}));
        break;

      // Global Control
      case "pause_all":
        result = await pauseAll(PauseAllSchema.parse(args ?? {}));
        break;
      case "resume_all":
        result = await resumeAll(ResumeAllSchema.parse(args ?? {}));
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
  console.error("KOSMOS Scheduler MCP Server started");
}

main().catch(console.error);
