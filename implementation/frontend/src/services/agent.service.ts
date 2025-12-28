/**
 * KOSMOS AEOS Agent Service
 * Agent CRUD, execution, and monitoring API methods
 */

import { apiGet, apiPost, apiPut, apiDelete, apiStream, PaginatedResponse } from './api';

// Agent status types
export type AgentStatus = 'idle' | 'busy' | 'error' | 'offline' | 'initializing';

// Agent capability types
export type AgentCapability =
  | 'orchestration'
  | 'analysis'
  | 'communication'
  | 'scheduling'
  | 'memory'
  | 'integration'
  | 'monitoring'
  | 'security'
  | 'resource_management'
  | 'context_management';

// Agent role (Greek deity naming)
export type AgentRole =
  | 'zeus'       // Orchestrator - coordinates all agents
  | 'athena'     // Strategic Planning - complex reasoning
  | 'hermes'     // Communication - messaging & notifications
  | 'chronos'    // Scheduling - calendar & time management
  | 'mnemosyne'  // Memory - context & knowledge
  | 'hephaestus' // Integration - external tools & APIs
  | 'apollo'     // Business - forecasting & decisions
  | 'argus'      // Security - monitoring & compliance
  | 'prometheus' // Analytics - metrics & insights
  | 'daedalus'   // Engineering - code & technical tasks
  | 'iris'       // Interface - UI generation & SDUI
  | 'hestia'     // Maintenance - system health
  | 'thoth'      // Documentation - knowledge management
  | 'custom';    // User-defined agents

// Agent interface
export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  description: string;
  status: AgentStatus;
  capabilities: AgentCapability[];
  config: AgentConfig;
  stats: AgentStats;
  createdAt: string;
  updatedAt: string;
}

// Agent configuration
export interface AgentConfig {
  model: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  tools?: string[];
  mcpServers?: string[];
  rateLimit?: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
  timeout?: number;
  retryPolicy?: {
    maxRetries: number;
    backoffMultiplier: number;
  };
  governance?: {
    requireApproval: boolean;
    approvalThreshold: 'low' | 'medium' | 'high' | 'critical';
    allowedActions: string[];
  };
}

// Agent statistics
export interface AgentStats {
  tasksCompleted: number;
  tasksInProgress: number;
  tasksFailed: number;
  averageResponseTime: number;
  tokensUsed: number;
  lastActiveAt: string;
  uptime: number;
}

// Agent execution request
export interface AgentExecuteRequest {
  message: string;
  context?: Record<string, unknown>;
  stream?: boolean;
  tools?: string[];
  maxTokens?: number;
}

// Agent execution response
export interface AgentExecuteResponse {
  id: string;
  agentId: string;
  message: string;
  toolCalls?: ToolCall[];
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata?: Record<string, unknown>;
}

// Tool call
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

// Agent plan
export interface AgentPlan {
  id: string;
  agentId: string;
  taskId: string;
  steps: PlanStep[];
  status: 'draft' | 'approved' | 'executing' | 'completed' | 'failed';
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
}

// Plan step
export interface PlanStep {
  id: string;
  order: number;
  action: string;
  agent: AgentRole;
  description: string;
  dependencies: string[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  result?: unknown;
  error?: string;
}

// Agent health
export interface AgentHealth {
  agentId: string;
  status: AgentStatus;
  healthy: boolean;
  lastCheck: string;
  metrics: {
    cpu: number;
    memory: number;
    latency: number;
    errorRate: number;
  };
  issues?: string[];
}

// Agent logs
export interface AgentLog {
  id: string;
  agentId: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
}

// Agent Service methods
export const agentService = {
  /**
   * List all agents
   */
  list: (params?: {
    status?: AgentStatus;
    role?: AgentRole;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Agent>> => {
    return apiGet<PaginatedResponse<Agent>>('/api/v1/agents', params);
  },

  /**
   * Get agent by ID
   */
  get: (agentId: string): Promise<Agent> => {
    return apiGet<Agent>(`/api/v1/agents/${agentId}`);
  },

  /**
   * Get agent by role
   */
  getByRole: (role: AgentRole): Promise<Agent> => {
    return apiGet<Agent>(`/api/v1/agents/role/${role}`);
  },

  /**
   * Update agent configuration
   */
  updateConfig: (agentId: string, config: Partial<AgentConfig>): Promise<Agent> => {
    return apiPut<Agent>(`/api/v1/agents/${agentId}/config`, config);
  },

  /**
   * Execute agent with message
   */
  execute: (agentId: string, request: AgentExecuteRequest): Promise<AgentExecuteResponse> => {
    return apiPost<AgentExecuteResponse>(`/api/v1/agents/${agentId}/execute`, request);
  },

  /**
   * Execute agent with streaming response
   */
  executeStream: (
    agentId: string,
    request: AgentExecuteRequest,
    onMessage: (chunk: string) => void,
    options?: { signal?: AbortSignal }
  ): Promise<void> => {
    return apiStream(
      `/api/v1/agents/${agentId}/execute/stream?message=${encodeURIComponent(request.message)}`,
      onMessage,
      options
    );
  },

  /**
   * Get agent plan for a task
   */
  getPlan: (agentId: string, taskId: string): Promise<AgentPlan> => {
    return apiGet<AgentPlan>(`/api/v1/agents/${agentId}/plans/${taskId}`);
  },

  /**
   * Create execution plan
   */
  createPlan: (agentId: string, taskDescription: string): Promise<AgentPlan> => {
    return apiPost<AgentPlan>(`/api/v1/agents/${agentId}/plan`, { task: taskDescription });
  },

  /**
   * Approve plan
   */
  approvePlan: (planId: string): Promise<AgentPlan> => {
    return apiPost<AgentPlan>(`/api/v1/plans/${planId}/approve`, {});
  },

  /**
   * Execute approved plan
   */
  executePlan: (planId: string): Promise<{ taskId: string }> => {
    return apiPost<{ taskId: string }>(`/api/v1/plans/${planId}/execute`, {});
  },

  /**
   * Get agent health
   */
  getHealth: (agentId: string): Promise<AgentHealth> => {
    return apiGet<AgentHealth>(`/api/v1/agents/${agentId}/health`);
  },

  /**
   * Get all agents health
   */
  getAllHealth: (): Promise<AgentHealth[]> => {
    return apiGet<AgentHealth[]>('/api/v1/agents/health');
  },

  /**
   * Get agent logs
   */
  getLogs: (agentId: string, params?: {
    level?: string;
    from?: string;
    to?: string;
    limit?: number;
  }): Promise<AgentLog[]> => {
    return apiGet<AgentLog[]>(`/api/v1/agents/${agentId}/logs`, params);
  },

  /**
   * Get agent capabilities
   */
  getCapabilities: (agentId: string): Promise<AgentCapability[]> => {
    return apiGet<AgentCapability[]>(`/api/v1/agents/${agentId}/capabilities`);
  },

  /**
   * Get available tools for agent
   */
  getTools: (agentId: string): Promise<string[]> => {
    return apiGet<string[]>(`/api/v1/agents/${agentId}/tools`);
  },

  /**
   * Start agent
   */
  start: (agentId: string): Promise<{ status: AgentStatus }> => {
    return apiPost<{ status: AgentStatus }>(`/api/v1/agents/${agentId}/start`, {});
  },

  /**
   * Stop agent
   */
  stop: (agentId: string): Promise<{ status: AgentStatus }> => {
    return apiPost<{ status: AgentStatus }>(`/api/v1/agents/${agentId}/stop`, {});
  },

  /**
   * Restart agent
   */
  restart: (agentId: string): Promise<{ status: AgentStatus }> => {
    return apiPost<{ status: AgentStatus }>(`/api/v1/agents/${agentId}/restart`, {});
  },

  /**
   * Get agent delegation options
   */
  getDelegationOptions: (agentId: string): Promise<Agent[]> => {
    return apiGet<Agent[]>(`/api/v1/agents/${agentId}/delegation-options`);
  },

  /**
   * Delegate task to another agent
   */
  delegate: (
    fromAgentId: string,
    toAgentId: string,
    taskId: string
  ): Promise<{ success: boolean }> => {
    return apiPost(`/api/v1/agents/${fromAgentId}/delegate`, {
      targetAgentId: toAgentId,
      taskId,
    });
  },
};

export default agentService;
