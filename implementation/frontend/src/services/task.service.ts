/**
 * KOSMOS AEOS Task Service
 * Task CRUD, status management, and HITL operations
 */

import { apiGet, apiPost, apiPut, apiDelete, PaginatedResponse } from './api';
import { AgentRole } from './agent.service';

// Task status
export type TaskStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'awaiting_approval'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'paused';

// Task priority
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

// Task type
export type TaskType =
  | 'analysis'
  | 'communication'
  | 'scheduling'
  | 'integration'
  | 'workflow'
  | 'maintenance'
  | 'custom';

// Task interface
export interface Task {
  id: string;
  title: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  assignedAgent: AgentRole | null;
  createdBy: string;
  context: TaskContext;
  result?: TaskResult;
  steps: TaskStep[];
  approvals: TaskApproval[];
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}

// Task context
export interface TaskContext {
  tenantId: string;
  userId?: string;
  conversationId?: string;
  parentTaskId?: string;
  metadata?: Record<string, unknown>;
  input?: Record<string, unknown>;
}

// Task result
export interface TaskResult {
  success: boolean;
  output?: unknown;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  metrics?: {
    duration: number;
    tokensUsed: number;
    toolCalls: number;
  };
}

// Task step
export interface TaskStep {
  id: string;
  order: number;
  name: string;
  description: string;
  agent: AgentRole;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  result?: unknown;
  startedAt?: string;
  completedAt?: string;
}

// Task approval (HITL)
export interface TaskApproval {
  id: string;
  taskId: string;
  stepId?: string;
  type: 'plan' | 'action' | 'result' | 'escalation';
  status: 'pending' | 'approved' | 'rejected' | 'timeout';
  requestedAt: string;
  requiredBy?: string;
  details: {
    title: string;
    description: string;
    action: string;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    context?: Record<string, unknown>;
  };
  response?: {
    decision: 'approved' | 'rejected';
    reason?: string;
    respondedBy: string;
    respondedAt: string;
  };
  timeout?: {
    duration: number;
    action: 'approve' | 'reject' | 'escalate';
  };
}

// Create task request
export interface CreateTaskRequest {
  title: string;
  description: string;
  type?: TaskType;
  priority?: TaskPriority;
  assignedAgent?: AgentRole;
  context?: Partial<TaskContext>;
  autoApprove?: boolean;
}

// Task filter params
export interface TaskFilterParams {
  [key: string]: unknown;
  status?: TaskStatus | TaskStatus[];
  priority?: TaskPriority | TaskPriority[];
  type?: TaskType | TaskType[];
  assignedAgent?: AgentRole;
  createdBy?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

// Task Service methods
export const taskService = {
  /**
   * List tasks with filters
   */
  list: (params?: TaskFilterParams): Promise<PaginatedResponse<Task>> => {
    return apiGet<PaginatedResponse<Task>>('/api/v1/tasks', params);
  },

  /**
   * Get task by ID
   */
  get: (taskId: string): Promise<Task> => {
    return apiGet<Task>(`/api/v1/tasks/${taskId}`);
  },

  /**
   * Create new task
   */
  create: (request: CreateTaskRequest): Promise<Task> => {
    return apiPost<Task>('/api/v1/tasks', request);
  },

  /**
   * Update task
   */
  update: (taskId: string, updates: Partial<Task>): Promise<Task> => {
    return apiPut<Task>(`/api/v1/tasks/${taskId}`, updates);
  },

  /**
   * Delete task
   */
  delete: (taskId: string): Promise<{ success: boolean }> => {
    return apiDelete<{ success: boolean }>(`/api/v1/tasks/${taskId}`);
  },

  /**
   * Cancel task
   */
  cancel: (taskId: string, reason?: string): Promise<Task> => {
    return apiPost<Task>(`/api/v1/tasks/${taskId}/cancel`, { reason });
  },

  /**
   * Pause task
   */
  pause: (taskId: string): Promise<Task> => {
    return apiPost<Task>(`/api/v1/tasks/${taskId}/pause`, {});
  },

  /**
   * Resume task
   */
  resume: (taskId: string): Promise<Task> => {
    return apiPost<Task>(`/api/v1/tasks/${taskId}/resume`, {});
  },

  /**
   * Retry failed task
   */
  retry: (taskId: string): Promise<Task> => {
    return apiPost<Task>(`/api/v1/tasks/${taskId}/retry`, {});
  },

  /**
   * Get task status
   */
  getStatus: (taskId: string): Promise<{ status: TaskStatus; progress?: number }> => {
    return apiGet(`/api/v1/tasks/${taskId}/status`);
  },

  /**
   * Get task steps
   */
  getSteps: (taskId: string): Promise<TaskStep[]> => {
    return apiGet<TaskStep[]>(`/api/v1/tasks/${taskId}/steps`);
  },

  /**
   * Get task result
   */
  getResult: (taskId: string): Promise<TaskResult> => {
    return apiGet<TaskResult>(`/api/v1/tasks/${taskId}/result`);
  },

  /**
   * Get pending approvals
   */
  getPendingApprovals: (params?: {
    userId?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<TaskApproval>> => {
    return apiGet<PaginatedResponse<TaskApproval>>('/api/v1/approvals/pending', params);
  },

  /**
   * Get approval by ID
   */
  getApproval: (approvalId: string): Promise<TaskApproval> => {
    return apiGet<TaskApproval>(`/api/v1/approvals/${approvalId}`);
  },

  /**
   * Approve task/action
   */
  approve: (approvalId: string, reason?: string): Promise<TaskApproval> => {
    return apiPost<TaskApproval>(`/api/v1/approvals/${approvalId}/approve`, { reason });
  },

  /**
   * Reject task/action
   */
  reject: (approvalId: string, reason: string): Promise<TaskApproval> => {
    return apiPost<TaskApproval>(`/api/v1/approvals/${approvalId}/reject`, { reason });
  },

  /**
   * Request additional information for approval
   */
  requestInfo: (
    approvalId: string,
    questions: string[]
  ): Promise<TaskApproval> => {
    return apiPost<TaskApproval>(`/api/v1/approvals/${approvalId}/request-info`, { questions });
  },

  /**
   * Escalate approval
   */
  escalate: (approvalId: string, escalateTo: string, reason: string): Promise<TaskApproval> => {
    return apiPost<TaskApproval>(`/api/v1/approvals/${approvalId}/escalate`, {
      escalateTo,
      reason,
    });
  },

  /**
   * Get task history
   */
  getHistory: (taskId: string): Promise<Array<{
    action: string;
    timestamp: string;
    actor: string;
    details?: Record<string, unknown>;
  }>> => {
    return apiGet(`/api/v1/tasks/${taskId}/history`);
  },

  /**
   * Get task metrics
   */
  getMetrics: (params?: {
    from?: string;
    to?: string;
    groupBy?: 'day' | 'week' | 'month';
  }): Promise<{
    total: number;
    completed: number;
    failed: number;
    pending: number;
    averageDuration: number;
    byType: Record<TaskType, number>;
    byPriority: Record<TaskPriority, number>;
    byAgent: Record<AgentRole, number>;
    timeline: Array<{ date: string; count: number }>;
  }> => {
    return apiGet('/api/v1/tasks/metrics', params);
  },

  /**
   * Get user's recent tasks
   */
  getRecentTasks: (limit?: number): Promise<Task[]> => {
    return apiGet<Task[]>('/api/v1/tasks/recent', { limit });
  },

  /**
   * Search tasks
   */
  search: (query: string, params?: TaskFilterParams): Promise<PaginatedResponse<Task>> => {
    return apiGet<PaginatedResponse<Task>>('/api/v1/tasks/search', { q: query, ...params });
  },

  /**
   * Bulk update tasks
   */
  bulkUpdate: (
    taskIds: string[],
    updates: { status?: TaskStatus; priority?: TaskPriority; assignedAgent?: AgentRole }
  ): Promise<{ updated: number }> => {
    return apiPost('/api/v1/tasks/bulk-update', { taskIds, updates });
  },

  /**
   * Export tasks
   */
  export: (params?: TaskFilterParams): Promise<{ url: string }> => {
    return apiPost('/api/v1/tasks/export', params);
  },
};

export default taskService;
