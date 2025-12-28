/**
 * KOSMOS AEOS Workflow Service
 * Workflow CRUD, execution, and builder operations
 */

import { apiGet, apiPost, apiPut, apiDelete, PaginatedResponse } from './api';
import { AgentRole } from './agent.service';
import { TaskStatus, TaskPriority } from './task.service';

// Workflow status
export type WorkflowStatus = 'draft' | 'active' | 'paused' | 'archived';

// Node types for workflow builder
export type WorkflowNodeType =
  | 'trigger'
  | 'agent'
  | 'condition'
  | 'loop'
  | 'action'
  | 'delay'
  | 'parallel'
  | 'merge'
  | 'end';

// Trigger types
export type TriggerType =
  | 'manual'
  | 'schedule'
  | 'webhook'
  | 'event'
  | 'api'
  | 'email'
  | 'file_upload';

// Workflow node interface
export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  position: { x: number; y: number };
  data: WorkflowNodeData;
}

// Node data based on type
export interface WorkflowNodeData {
  label: string;
  description?: string;

  // Trigger node
  trigger?: {
    type: TriggerType;
    config: Record<string, unknown>;
  };

  // Agent node
  agent?: {
    role: AgentRole;
    action: string;
    input?: Record<string, unknown>;
    timeout?: number;
  };

  // Condition node
  condition?: {
    expression: string;
    branches: {
      condition: string;
      targetNodeId: string;
    }[];
  };

  // Loop node
  loop?: {
    type: 'count' | 'while' | 'foreach';
    config: Record<string, unknown>;
    maxIterations?: number;
  };

  // Action node
  action?: {
    type: string;
    config: Record<string, unknown>;
  };

  // Delay node
  delay?: {
    duration: number;
    unit: 'seconds' | 'minutes' | 'hours' | 'days';
  };

  // Parallel node
  parallel?: {
    branches: string[];
    waitForAll?: boolean;
  };
}

// Workflow edge
export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
  type?: 'default' | 'conditional' | 'error';
  animated?: boolean;
  data?: {
    condition?: string;
  };
}

// Workflow definition
export interface Workflow {
  id: string;
  name: string;
  description: string;
  version: number;
  status: WorkflowStatus;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  variables: WorkflowVariable[];
  triggers: WorkflowTrigger[];
  settings: WorkflowSettings;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

// Workflow variable
export interface WorkflowVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  defaultValue?: unknown;
  required?: boolean;
  description?: string;
}

// Workflow trigger configuration
export interface WorkflowTrigger {
  id: string;
  type: TriggerType;
  enabled: boolean;
  config: {
    // Schedule trigger
    cron?: string;
    timezone?: string;
    // Webhook trigger
    webhookPath?: string;
    webhookSecret?: string;
    // Event trigger
    eventType?: string;
    eventFilter?: Record<string, unknown>;
    // API trigger
    apiEndpoint?: string;
    apiMethod?: 'GET' | 'POST' | 'PUT';
    // Email trigger
    emailAddress?: string;
    subjectFilter?: string;
    // File upload trigger
    allowedTypes?: string[];
    maxSize?: number;
  };
}

// Workflow settings
export interface WorkflowSettings {
  timeout?: number;
  retryPolicy?: {
    maxRetries: number;
    backoffMultiplier: number;
    retryableErrors?: string[];
  };
  errorHandling?: {
    strategy: 'stop' | 'continue' | 'rollback';
    notifyOnError?: boolean;
    notifyEmails?: string[];
  };
  concurrency?: {
    maxConcurrent: number;
    queueBehavior: 'queue' | 'reject' | 'replace';
  };
  governance?: {
    requireApproval: boolean;
    approvers?: string[];
  };
  logging?: {
    level: 'minimal' | 'normal' | 'verbose';
    retentionDays: number;
  };
}

// Workflow execution
export interface WorkflowExecution {
  id: string;
  workflowId: string;
  workflowVersion: number;
  status: TaskStatus;
  priority: TaskPriority;
  triggeredBy: string;
  triggerType: TriggerType;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  nodeExecutions: NodeExecution[];
  startedAt: string;
  completedAt?: string;
  duration?: number;
  error?: {
    nodeId: string;
    message: string;
    stack?: string;
  };
}

// Node execution
export interface NodeExecution {
  nodeId: string;
  nodeType: WorkflowNodeType;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  input?: Record<string, unknown>;
  output?: unknown;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  retryCount?: number;
}

// Create workflow request
export interface CreateWorkflowRequest {
  name: string;
  description?: string;
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
  variables?: WorkflowVariable[];
  triggers?: WorkflowTrigger[];
  settings?: Partial<WorkflowSettings>;
}

// Workflow filter params
export interface WorkflowFilterParams {
  [key: string]: unknown;
  status?: WorkflowStatus | WorkflowStatus[];
  createdBy?: string;
  search?: string;
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

// Workflow Service methods
export const workflowService = {
  /**
   * List workflows
   */
  list: (params?: WorkflowFilterParams): Promise<PaginatedResponse<Workflow>> => {
    return apiGet<PaginatedResponse<Workflow>>('/api/v1/workflows', params);
  },

  /**
   * Get workflow by ID
   */
  get: (workflowId: string): Promise<Workflow> => {
    return apiGet<Workflow>(`/api/v1/workflows/${workflowId}`);
  },

  /**
   * Get workflow by ID and version
   */
  getVersion: (workflowId: string, version: number): Promise<Workflow> => {
    return apiGet<Workflow>(`/api/v1/workflows/${workflowId}/versions/${version}`);
  },

  /**
   * Create new workflow
   */
  create: (request: CreateWorkflowRequest): Promise<Workflow> => {
    return apiPost<Workflow>('/api/v1/workflows', request);
  },

  /**
   * Update workflow
   */
  update: (workflowId: string, updates: Partial<Workflow>): Promise<Workflow> => {
    return apiPut<Workflow>(`/api/v1/workflows/${workflowId}`, updates);
  },

  /**
   * Delete workflow
   */
  delete: (workflowId: string): Promise<{ success: boolean }> => {
    return apiDelete<{ success: boolean }>(`/api/v1/workflows/${workflowId}`);
  },

  /**
   * Publish workflow (make it active)
   */
  publish: (workflowId: string): Promise<Workflow> => {
    return apiPost<Workflow>(`/api/v1/workflows/${workflowId}/publish`, {});
  },

  /**
   * Unpublish workflow (set to draft)
   */
  unpublish: (workflowId: string): Promise<Workflow> => {
    return apiPost<Workflow>(`/api/v1/workflows/${workflowId}/unpublish`, {});
  },

  /**
   * Archive workflow
   */
  archive: (workflowId: string): Promise<Workflow> => {
    return apiPost<Workflow>(`/api/v1/workflows/${workflowId}/archive`, {});
  },

  /**
   * Duplicate workflow
   */
  duplicate: (workflowId: string, name?: string): Promise<Workflow> => {
    return apiPost<Workflow>(`/api/v1/workflows/${workflowId}/duplicate`, { name });
  },

  /**
   * Get workflow versions
   */
  getVersions: (workflowId: string): Promise<Array<{
    version: number;
    createdAt: string;
    createdBy: string;
    changes?: string;
  }>> => {
    return apiGet(`/api/v1/workflows/${workflowId}/versions`);
  },

  /**
   * Rollback to a previous version
   */
  rollback: (workflowId: string, version: number): Promise<Workflow> => {
    return apiPost<Workflow>(`/api/v1/workflows/${workflowId}/rollback`, { version });
  },

  /**
   * Execute workflow manually
   */
  execute: (
    workflowId: string,
    input?: Record<string, unknown>,
    options?: { priority?: TaskPriority; async?: boolean }
  ): Promise<WorkflowExecution> => {
    return apiPost<WorkflowExecution>(`/api/v1/workflows/${workflowId}/execute`, {
      input,
      ...options,
    });
  },

  /**
   * Get workflow execution
   */
  getExecution: (executionId: string): Promise<WorkflowExecution> => {
    return apiGet<WorkflowExecution>(`/api/v1/executions/${executionId}`);
  },

  /**
   * List workflow executions
   */
  listExecutions: (
    workflowId: string,
    params?: {
      status?: TaskStatus;
      from?: string;
      to?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<PaginatedResponse<WorkflowExecution>> => {
    return apiGet<PaginatedResponse<WorkflowExecution>>(
      `/api/v1/workflows/${workflowId}/executions`,
      params
    );
  },

  /**
   * Cancel execution
   */
  cancelExecution: (executionId: string): Promise<WorkflowExecution> => {
    return apiPost<WorkflowExecution>(`/api/v1/executions/${executionId}/cancel`, {});
  },

  /**
   * Retry failed execution
   */
  retryExecution: (
    executionId: string,
    fromNodeId?: string
  ): Promise<WorkflowExecution> => {
    return apiPost<WorkflowExecution>(`/api/v1/executions/${executionId}/retry`, {
      fromNodeId,
    });
  },

  /**
   * Validate workflow definition
   */
  validate: (workflow: Partial<Workflow>): Promise<{
    valid: boolean;
    errors?: Array<{
      nodeId?: string;
      field?: string;
      message: string;
    }>;
    warnings?: Array<{
      nodeId?: string;
      message: string;
    }>;
  }> => {
    return apiPost('/api/v1/workflows/validate', workflow);
  },

  /**
   * Get workflow templates
   */
  getTemplates: (): Promise<Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    thumbnail?: string;
    workflow: Partial<Workflow>;
  }>> => {
    return apiGet('/api/v1/workflows/templates');
  },

  /**
   * Create workflow from template
   */
  createFromTemplate: (
    templateId: string,
    name: string,
    variables?: Record<string, unknown>
  ): Promise<Workflow> => {
    return apiPost<Workflow>('/api/v1/workflows/from-template', {
      templateId,
      name,
      variables,
    });
  },

  /**
   * Export workflow as JSON
   */
  export: (workflowId: string): Promise<{ json: string }> => {
    return apiGet(`/api/v1/workflows/${workflowId}/export`);
  },

  /**
   * Import workflow from JSON
   */
  import: (json: string, name?: string): Promise<Workflow> => {
    return apiPost<Workflow>('/api/v1/workflows/import', { json, name });
  },

  /**
   * Get workflow analytics
   */
  getAnalytics: (
    workflowId: string,
    params?: { from?: string; to?: string }
  ): Promise<{
    totalExecutions: number;
    successRate: number;
    averageDuration: number;
    executionsByDay: Array<{ date: string; count: number; successRate: number }>;
    nodeMetrics: Array<{
      nodeId: string;
      executions: number;
      averageDuration: number;
      errorRate: number;
    }>;
  }> => {
    return apiGet(`/api/v1/workflows/${workflowId}/analytics`, params);
  },

  /**
   * Get available node types
   */
  getNodeTypes: (): Promise<Array<{
    type: WorkflowNodeType;
    label: string;
    description: string;
    icon: string;
    category: string;
    inputs: Array<{ name: string; type: string; required: boolean }>;
    outputs: Array<{ name: string; type: string }>;
  }>> => {
    return apiGet('/api/v1/workflows/node-types');
  },

  /**
   * Get available actions for action nodes
   */
  getAvailableActions: (): Promise<Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    config: Record<string, unknown>;
  }>> => {
    return apiGet('/api/v1/workflows/actions');
  },
};

export default workflowService;
