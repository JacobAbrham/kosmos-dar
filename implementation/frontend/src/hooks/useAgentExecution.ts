/**
 * KOSMOS DAR Agent Execution Hook
 * 
 * Integrates WebSocket updates with Jotai atoms for real-time agent execution state.
 */

'use client';

import { useEffect } from 'react';
import { atom, useAtomValue, useSetAtom } from 'jotai';
import { useWebSocketContext } from '@/context/WebSocketContext';
import {
  getAgentActiveExecutionAtom,
  getExecutionStatusAtom,
  getExecutionToolCallsAtom,
  getExecutionCostAtom,
  updateExecutionStatusAtom,
  updateToolCallStatusAtom,
  updateCostTrackingAtom,
  updateCircuitBreakerFromWebSocket,
  updateCircuitBreakerStatusAtom,
  type ExecutionStatus,
  type ToolCallStatus,
  type CostTracking,
} from '@/stores/agent-execution';

/**
 * Hook to sync WebSocket updates with Jotai atoms for agent execution
 */
export function useAgentExecutionSync() {
  const ws = useWebSocketContext();
  const setExecutionStatus = useSetAtom(updateExecutionStatusAtom);
  const setToolCallStatus = useSetAtom(updateToolCallStatusAtom);
  const setCostTracking = useSetAtom(updateCostTrackingAtom);
  const setCircuitBreakerStatus = useSetAtom(updateCircuitBreakerStatusAtom);

  useEffect(() => {
    if (!ws.isOnline) return;

    // Subscribe to agent execution events
    const unsubscribeStatus = ws.on('agent:status', (data: any) => {
      if (data.executionId && data.agentId) {
        setExecutionStatus({
          executionId: data.executionId,
          agentId: data.agentId,
          status: data.status || 'running',
          progress: data.progress || 0,
          currentStep: data.currentStep,
          error: data.error,
          startedAt: data.startedAt || new Date().toISOString(),
          completedAt: data.completedAt,
        });
      }
    });

    const unsubscribeToolCall = ws.on('agent:tool_call', (data: any) => {
      if (data.toolCallId && data.executionId) {
        setToolCallStatus({
          toolCallId: data.toolCallId,
          executionId: data.executionId,
          toolName: data.toolName || 'unknown',
          server: data.server || 'unknown',
          status: data.status || 'pending',
          progress: data.progress,
          result: data.result,
          error: data.error,
          startedAt: data.startedAt || new Date().toISOString(),
          completedAt: data.completedAt,
        });
      }
    });

    const unsubscribeCost = ws.on('agent:cost', (data: any) => {
      if (data.executionId && data.agentId) {
        setCostTracking({
          executionId: data.executionId,
          agentId: data.agentId,
          inputTokens: data.inputTokens || 0,
          outputTokens: data.outputTokens || 0,
          totalTokens: data.totalTokens || (data.inputTokens || 0) + (data.outputTokens || 0),
          costUSD: data.costUSD || 0,
          model: data.model || 'unknown',
          timestamp: data.timestamp || new Date().toISOString(),
        });
      }
    });

    const unsubscribeCircuitBreaker = ws.on('circuit_breaker:status', (data: any) => {
      if (data.server) {
        setCircuitBreakerStatus({
          server: data.server,
          state: data.state || 'closed',
          failures: data.failures || 0,
          lastFailure: data.lastFailure,
          nextRetry: data.nextRetry,
        });
      }
    });

    return () => {
      unsubscribeStatus();
      unsubscribeToolCall();
      unsubscribeCost();
      unsubscribeCircuitBreaker();
    };
  }, [ws.isOnline, ws.on, setExecutionStatus, setToolCallStatus, setCostTracking, setCircuitBreakerStatus]);
}

/**
 * Hook to get real-time execution status for an agent
 */
export function useAgentExecutionStatus(agentId: string) {
  const activeExecutionId = useAtomValue(getAgentActiveExecutionAtom(agentId));
  const executionStatus = useAtomValue(
    activeExecutionId ? getExecutionStatusAtom(activeExecutionId) : atom<ExecutionStatus | undefined>(undefined)
  );
  const toolCalls = useAtomValue(
    activeExecutionId ? getExecutionToolCallsAtom(activeExecutionId) : atom<ToolCallStatus[]>([])
  );
  const cost = useAtomValue(
    activeExecutionId ? getExecutionCostAtom(activeExecutionId) : atom<CostTracking | undefined>(undefined)
  );

  return {
    activeExecutionId,
    executionStatus,
    toolCalls,
    cost,
    isRunning: executionStatus?.status === 'running' || executionStatus?.status === 'pending',
    progress: executionStatus?.progress || 0,
    currentStep: executionStatus?.currentStep,
  };
}

/**
 * Hook to get real-time cost tracking for an agent
 */
export function useAgentCostTracking(agentId: string) {
  const { cost, executionStatus } = useAgentExecutionStatus(agentId);
  
  return {
    cost: cost?.costUSD || 0,
    tokens: {
      input: cost?.inputTokens || 0,
      output: cost?.outputTokens || 0,
      total: cost?.totalTokens || 0,
    },
    model: cost?.model || 'unknown',
    isTracking: executionStatus?.status === 'running' || executionStatus?.status === 'pending',
  };
}

/**
 * Hook to get real-time tool call progress for an agent
 */
export function useAgentToolCalls(agentId: string) {
  const { toolCalls } = useAgentExecutionStatus(agentId);

  const activeToolCalls = toolCalls.filter(
    (tc: ToolCallStatus) => tc.status === 'running' || tc.status === 'pending'
  );
  const completedToolCalls = toolCalls.filter((tc: ToolCallStatus) => tc.status === 'completed');
  const failedToolCalls = toolCalls.filter((tc: ToolCallStatus) => tc.status === 'failed');

  return {
    all: toolCalls,
    active: activeToolCalls,
    completed: completedToolCalls,
    failed: failedToolCalls,
    activeToolCalls, // Alias for backwards compatibility
    activeCount: activeToolCalls.length,
    completedCount: completedToolCalls.length,
    failedCount: failedToolCalls.length,
  };
}
