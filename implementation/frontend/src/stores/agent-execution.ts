/**
 * KOSMOS DAR Agent Execution Store (Jotai)
 * 
 * Real-time interdependent state for agent execution, tool calls, progress, and cost tracking.
 * Uses Jotai for fine-grained reactivity and WebSocket integration.
 */

import { atom } from 'jotai';
import type { AgentStatus, ToolCall } from '@/services/agent.service';

// ============================================================================
// TYPES
// ============================================================================

export interface ExecutionStatus {
  executionId: string;
  agentId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0-100
  currentStep?: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface ToolCallStatus {
  toolCallId: string;
  executionId: string;
  toolName: string;
  server: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress?: number; // 0-100 for long-running tools
  result?: unknown;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface CostTracking {
  executionId: string;
  agentId: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUSD: number;
  model: string;
  timestamp: string;
}

export interface CircuitBreakerStatus {
  server: string;
  state: 'closed' | 'open' | 'half-open';
  failures: number;
  lastFailure?: string;
  nextRetry?: string;
}

// ============================================================================
// BASE ATOMS
// ============================================================================

/**
 * Map of execution ID to execution status
 * Updated in real-time via WebSocket
 */
export const executionStatusAtom = atom<Map<string, ExecutionStatus>>(new Map());

/**
 * Map of tool call ID to tool call status
 * Updated in real-time via WebSocket
 */
export const toolCallStatusAtom = atom<Map<string, ToolCallStatus>>(new Map());

/**
 * Map of execution ID to cost tracking
 * Updated in real-time as tokens are consumed
 */
export const costTrackingAtom = atom<Map<string, CostTracking>>(new Map());

/**
 * Map of MCP server to circuit breaker status
 * Updated when circuit breakers change state
 */
export const circuitBreakerStatusAtom = atom<Map<string, CircuitBreakerStatus>>(new Map());

/**
 * Map of agent ID to current execution ID
 * Tracks which execution is currently active for each agent
 */
export const agentActiveExecutionAtom = atom<Map<string, string>>(new Map());

// ============================================================================
// DERIVED ATOMS (Computed State)
// ============================================================================

/**
 * Get execution status for a specific execution ID
 */
export const getExecutionStatusAtom = (executionId: string) =>
  atom((get) => get(executionStatusAtom).get(executionId));

/**
 * Get all tool calls for a specific execution ID
 */
export const getExecutionToolCallsAtom = (executionId: string) =>
  atom((get) => {
    const toolCalls = get(toolCallStatusAtom);
    return Array.from(toolCalls.values()).filter(
      (tc) => tc.executionId === executionId
    );
  });

/**
 * Get cost tracking for a specific execution ID
 */
export const getExecutionCostAtom = (executionId: string) =>
  atom((get) => get(costTrackingAtom).get(executionId));

/**
 * Get active execution ID for a specific agent
 */
export const getAgentActiveExecutionAtom = (agentId: string) =>
  atom((get) => get(agentActiveExecutionAtom).get(agentId));

/**
 * Get all executions for a specific agent
 */
export const getAgentExecutionsAtom = (agentId: string) =>
  atom((get) => {
    const executions = get(executionStatusAtom);
    return Array.from(executions.values()).filter(
      (exec) => exec.agentId === agentId
    );
  });

/**
 * Get circuit breaker status for a specific MCP server
 */
export const getCircuitBreakerStatusAtom = (server: string) =>
  atom((get) => get(circuitBreakerStatusAtom).get(server));

/**
 * Total cost for all active executions
 */
export const totalActiveCostAtom = atom((get) => {
  const executions = get(executionStatusAtom);
  const costs = get(costTrackingAtom);
  
  let total = 0;
  executions.forEach((exec, execId) => {
    if (exec.status === 'running' || exec.status === 'pending') {
      const cost = costs.get(execId);
      if (cost) {
        total += cost.costUSD;
      }
    }
  });
  
  return total;
});

/**
 * Total tokens used across all active executions
 */
export const totalActiveTokensAtom = atom((get) => {
  const executions = get(executionStatusAtom);
  const costs = get(costTrackingAtom);
  
  let inputTokens = 0;
  let outputTokens = 0;
  
  executions.forEach((exec, execId) => {
    if (exec.status === 'running' || exec.status === 'pending') {
      const cost = costs.get(execId);
      if (cost) {
        inputTokens += cost.inputTokens;
        outputTokens += cost.outputTokens;
      }
    }
  });
  
  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
  };
});

/**
 * Active tool calls count
 */
export const activeToolCallsAtom = atom((get) => {
  const toolCalls = get(toolCallStatusAtom);
  return Array.from(toolCalls.values()).filter(
    (tc) => tc.status === 'running' || tc.status === 'pending'
  ).length;
});

/**
 * Failed tool calls count
 */
export const failedToolCallsAtom = atom((get) => {
  const toolCalls = get(toolCallStatusAtom);
  return Array.from(toolCalls.values()).filter(
    (tc) => tc.status === 'failed'
  ).length;
});

// ============================================================================
// WRITE ATOMS (Actions)
// ============================================================================

/**
 * Update execution status
 */
export const updateExecutionStatusAtom = atom(
  null,
  (get, set, update: ExecutionStatus) => {
    const executions = new Map(get(executionStatusAtom));
    executions.set(update.executionId, update);
    set(executionStatusAtom, executions);
    
    // Update agent active execution mapping
    if (update.status === 'running' || update.status === 'pending') {
      const activeExecutions = new Map(get(agentActiveExecutionAtom));
      activeExecutions.set(update.agentId, update.executionId);
      set(agentActiveExecutionAtom, activeExecutions);
    } else if (update.status === 'completed' || update.status === 'failed') {
      const activeExecutions = new Map(get(agentActiveExecutionAtom));
      const currentActive = activeExecutions.get(update.agentId);
      if (currentActive === update.executionId) {
        activeExecutions.delete(update.agentId);
        set(agentActiveExecutionAtom, activeExecutions);
      }
    }
  }
);

/**
 * Update tool call status
 */
export const updateToolCallStatusAtom = atom(
  null,
  (get, set, update: ToolCallStatus) => {
    const toolCalls = new Map(get(toolCallStatusAtom));
    toolCalls.set(update.toolCallId, update);
    set(toolCallStatusAtom, toolCalls);
  }
);

/**
 * Update cost tracking
 */
export const updateCostTrackingAtom = atom(
  null,
  (get, set, update: CostTracking) => {
    const costs = new Map(get(costTrackingAtom));
    costs.set(update.executionId, update);
    set(costTrackingAtom, costs);
  }
);

/**
 * Update circuit breaker status
 */
export const updateCircuitBreakerStatusAtom = atom(
  null,
  (get, set, update: CircuitBreakerStatus) => {
    const circuitBreakers = new Map(get(circuitBreakerStatusAtom));
    circuitBreakers.set(update.server, update);
    set(circuitBreakerStatusAtom, circuitBreakers);
  }
);

/**
 * Clear execution data (cleanup)
 */
export const clearExecutionAtom = atom(
  null,
  (get, set, executionId: string) => {
    const executions = new Map(get(executionStatusAtom));
    const toolCalls = new Map(get(toolCallStatusAtom));
    const costs = new Map(get(costTrackingAtom));
    const activeExecutions = new Map(get(agentActiveExecutionAtom));
    
    // Remove execution
    const exec = executions.get(executionId);
    if (exec) {
      executions.delete(executionId);
      set(executionStatusAtom, executions);
      
      // Remove from active executions
      const currentActive = activeExecutions.get(exec.agentId);
      if (currentActive === executionId) {
        activeExecutions.delete(exec.agentId);
        set(agentActiveExecutionAtom, activeExecutions);
      }
    }
    
    // Remove related tool calls
    const relatedToolCalls = Array.from(toolCalls.entries()).filter(
      ([_, tc]) => tc.executionId === executionId
    );
    relatedToolCalls.forEach(([id]) => toolCalls.delete(id));
    set(toolCallStatusAtom, toolCalls);
    
    // Remove cost tracking
    costs.delete(executionId);
    set(costTrackingAtom, costs);
  }
);

/**
 * Clear all completed executions (cleanup)
 */
export const clearCompletedExecutionsAtom = atom(
  null,
  (get, set) => {
    const executions = new Map(get(executionStatusAtom));
    const completedIds: string[] = [];
    
    executions.forEach((exec, id) => {
      if (exec.status === 'completed' || exec.status === 'failed' || exec.status === 'cancelled') {
        completedIds.push(id);
      }
    });
    
    completedIds.forEach((id) => {
      set(clearExecutionAtom, id);
    });
  }
);

// ============================================================================
// SELECTOR HOOKS (For React Components)
// ============================================================================

/**
 * Hook to get execution status
 * Usage: const status = useAtomValue(getExecutionStatusAtom(executionId));
 */
export { getExecutionStatusAtom as useExecutionStatus };

/**
 * Hook to get execution tool calls
 * Usage: const toolCalls = useAtomValue(getExecutionToolCallsAtom(executionId));
 */
export { getExecutionToolCallsAtom as useExecutionToolCalls };

/**
 * Hook to get execution cost
 * Usage: const cost = useAtomValue(getExecutionCostAtom(executionId));
 */
export { getExecutionCostAtom as useExecutionCost };

/**
 * Hook to get agent active execution
 * Usage: const execId = useAtomValue(getAgentActiveExecutionAtom(agentId));
 */
export { getAgentActiveExecutionAtom as useAgentActiveExecution };

/**
 * Hook to get agent executions
 * Usage: const executions = useAtomValue(getAgentExecutionsAtom(agentId));
 */
export { getAgentExecutionsAtom as useAgentExecutions };

/**
 * Hook to get circuit breaker status
 * Usage: const cbStatus = useAtomValue(getCircuitBreakerStatusAtom(server));
 */
export { getCircuitBreakerStatusAtom as useCircuitBreakerStatus };

/**
 * Hook to get total active cost
 * Usage: const totalCost = useAtomValue(totalActiveCostAtom);
 */
export { totalActiveCostAtom as useTotalActiveCost };

/**
 * Hook to get total active tokens
 * Usage: const tokens = useAtomValue(totalActiveTokensAtom);
 */
export { totalActiveTokensAtom as useTotalActiveTokens };

/**
 * Hook to get active tool calls count
 * Usage: const count = useAtomValue(activeToolCallsAtom);
 */
export { activeToolCallsAtom as useActiveToolCalls };

/**
 * Hook to get failed tool calls count
 * Usage: const count = useAtomValue(failedToolCallsAtom);
 */
export { failedToolCallsAtom as useFailedToolCalls };

// ============================================================================
// WEB SOCKET INTEGRATION HELPERS
// ============================================================================

/**
 * Update execution status from WebSocket message
 */
export function updateExecutionFromWebSocket(
  setExecutionStatus: (update: ExecutionStatus) => void,
  message: {
    type: string;
    data?: {
      executionId: string;
      agentId: string;
      status?: string;
      progress?: number;
      currentStep?: string;
      error?: string;
    };
  }
) {
  if (message.type === 'agent:status' && message.data) {
    const { executionId, agentId, status, progress, currentStep, error } = message.data;
    
    setExecutionStatus({
      executionId,
      agentId,
      status: (status as ExecutionStatus['status']) || 'running',
      progress: progress || 0,
      currentStep,
      error,
      startedAt: new Date().toISOString(),
    });
  }
}

/**
 * Update tool call status from WebSocket message
 */
export function updateToolCallFromWebSocket(
  setToolCallStatus: (update: ToolCallStatus) => void,
  message: {
    type: string;
    data?: {
      toolCallId: string;
      executionId: string;
      toolName: string;
      server: string;
      status?: string;
      progress?: number;
      result?: unknown;
      error?: string;
    };
  }
) {
  if (message.type === 'agent:tool_call' && message.data) {
    const {
      toolCallId,
      executionId,
      toolName,
      server,
      status,
      progress,
      result,
      error,
    } = message.data;
    
    setToolCallStatus({
      toolCallId,
      executionId,
      toolName,
      server,
      status: (status as ToolCallStatus['status']) || 'pending',
      progress,
      result,
      error,
      startedAt: new Date().toISOString(),
    });
  }
}

/**
 * Update cost tracking from WebSocket message
 */
export function updateCostFromWebSocket(
  setCostTracking: (update: CostTracking) => void,
  message: {
    type: string;
    data?: {
      executionId: string;
      agentId: string;
      inputTokens?: number;
      outputTokens?: number;
      totalTokens?: number;
      costUSD?: number;
      model?: string;
    };
  }
) {
  if (message.type === 'agent:cost' && message.data) {
    const {
      executionId,
      agentId,
      inputTokens = 0,
      outputTokens = 0,
      totalTokens = 0,
      costUSD = 0,
      model = 'unknown',
    } = message.data;
    
    setCostTracking({
      executionId,
      agentId,
      inputTokens,
      outputTokens,
      totalTokens: totalTokens || inputTokens + outputTokens,
      costUSD,
      model,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Update circuit breaker status from WebSocket message
 */
export function updateCircuitBreakerFromWebSocket(
  setCircuitBreakerStatus: (update: CircuitBreakerStatus) => void,
  message: {
    type: string;
    data?: {
      server: string;
      state?: string;
      failures?: number;
      lastFailure?: string;
      nextRetry?: string;
    };
  }
) {
  if (message.type === 'circuit_breaker:status' && message.data) {
    const { server, state, failures, lastFailure, nextRetry } = message.data;
    
    setCircuitBreakerStatus({
      server,
      state: (state as CircuitBreakerStatus['state']) || 'closed',
      failures: failures || 0,
      lastFailure,
      nextRetry,
    });
  }
}
