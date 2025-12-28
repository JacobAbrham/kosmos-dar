/**
 * KOSMOS AEOS Agent Hook
 * Agent interaction, status monitoring, and execution
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useWebSocket } from './useWebSocket';
import {
  agentService,
  Agent,
  AgentStatus,
  AgentRole,
  AgentHealth,
  AgentExecuteRequest,
  AgentExecuteResponse,
  AgentPlan,
  ToolCall,
} from '@/services/agent.service';

// Message in conversation
export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  agentId: string;
  toolCalls?: ToolCall[];
  timestamp: string;
  streaming?: boolean;
}

// Agent state
export interface AgentState {
  agent: Agent | null;
  health: AgentHealth | null;
  loading: boolean;
  error: Error | null;
  executing: boolean;
}

// Conversation state
export interface ConversationState {
  messages: ConversationMessage[];
  currentStream: string;
  isStreaming: boolean;
}

// Hook options
export interface UseAgentOptions {
  agentId?: string;
  role?: AgentRole;
  autoLoad?: boolean;
  onStatusChange?: (status: AgentStatus) => void;
  onMessage?: (message: ConversationMessage) => void;
  onToolCall?: (toolCall: ToolCall) => void;
  onError?: (error: Error) => void;
}

// Hook return type
export interface UseAgentReturn {
  // Agent state
  agent: Agent | null;
  health: AgentHealth | null;
  loading: boolean;
  error: Error | null;
  executing: boolean;
  isConnected: boolean;

  // Conversation
  messages: ConversationMessage[];
  isStreaming: boolean;
  currentStream: string;

  // Actions
  loadAgent: (id?: string) => Promise<void>;
  execute: (request: AgentExecuteRequest) => Promise<AgentExecuteResponse | void>;
  executeStream: (message: string) => Promise<void>;
  stopExecution: () => void;
  createPlan: (taskDescription: string) => Promise<AgentPlan>;
  delegate: (toAgentId: string, taskId: string) => Promise<void>;
  startAgent: () => Promise<void>;
  stopAgent: () => Promise<void>;
  restartAgent: () => Promise<void>;
  clearMessages: () => void;
  refreshHealth: () => Promise<void>;
}

export function useAgent(options: UseAgentOptions = {}): UseAgentReturn {
  const {
    agentId: initialAgentId,
    role,
    autoLoad = true,
    onStatusChange,
    onMessage,
    onToolCall,
    onError,
  } = options;

  const [agentState, setAgentState] = useState<AgentState>({
    agent: null,
    health: null,
    loading: false,
    error: null,
    executing: false,
  });

  const [conversation, setConversation] = useState<ConversationState>({
    messages: [],
    currentStream: '',
    isStreaming: false,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const currentAgentId = agentState.agent?.id || initialAgentId;

  // WebSocket for real-time updates
  const { status: wsStatus, on, emit, subscribe, unsubscribe } = useWebSocket({
    onMessage: (message) => {
      if (!mountedRef.current) return;

      switch (message.type) {
        case 'agent:status':
          handleStatusUpdate(message.data as { agentId: string; status: AgentStatus });
          break;

        case 'agent:message':
          handleAgentMessage(message.data as ConversationMessage);
          break;

        case 'agent:stream':
          handleStreamChunk(message.data as { chunk: string; done: boolean });
          break;

        case 'agent:tool_call':
          handleToolCall(message.data as ToolCall);
          break;
      }
    },
  });

  const isConnected = wsStatus === 'connected';

  // Handle status update
  const handleStatusUpdate = useCallback(
    (data: { agentId: string; status: AgentStatus }) => {
      if (data.agentId === currentAgentId) {
        setAgentState((prev) => ({
          ...prev,
          agent: prev.agent ? { ...prev.agent, status: data.status } : null,
        }));
        onStatusChange?.(data.status);
      }
    },
    [currentAgentId, onStatusChange]
  );

  // Handle agent message
  const handleAgentMessage = useCallback(
    (message: ConversationMessage) => {
      if (message.agentId === currentAgentId) {
        setConversation((prev) => ({
          ...prev,
          messages: [...prev.messages, message],
        }));
        onMessage?.(message);
      }
    },
    [currentAgentId, onMessage]
  );

  // Handle stream chunk
  const handleStreamChunk = useCallback((data: { chunk: string; done: boolean }) => {
    setConversation((prev) => {
      if (data.done) {
        // Finalize streaming message
        const streamedContent = prev.currentStream + data.chunk;
        const newMessage: ConversationMessage = {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: streamedContent,
          agentId: currentAgentId || '',
          timestamp: new Date().toISOString(),
        };

        return {
          ...prev,
          messages: [...prev.messages, newMessage],
          currentStream: '',
          isStreaming: false,
        };
      }

      return {
        ...prev,
        currentStream: prev.currentStream + data.chunk,
      };
    });
  }, [currentAgentId]);

  // Handle tool call
  const handleToolCall = useCallback(
    (toolCall: ToolCall) => {
      onToolCall?.(toolCall);
    },
    [onToolCall]
  );

  // Load agent
  const loadAgent = useCallback(
    async (id?: string) => {
      const agentId = id || initialAgentId;
      if (!agentId && !role) return;

      setAgentState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const agent = role
          ? await agentService.getByRole(role)
          : await agentService.get(agentId!);

        const health = await agentService.getHealth(agent.id);

        if (mountedRef.current) {
          setAgentState((prev) => ({
            ...prev,
            agent,
            health,
            loading: false,
          }));

          // Subscribe to agent updates
          subscribe([`agent:${agent.id}`]);
        }
      } catch (error) {
        if (mountedRef.current) {
          const err = error instanceof Error ? error : new Error('Failed to load agent');
          setAgentState((prev) => ({ ...prev, loading: false, error: err }));
          onError?.(err);
        }
      }
    },
    [initialAgentId, role, subscribe, onError]
  );

  // Execute non-streaming request
  const execute = useCallback(
    async (request: AgentExecuteRequest): Promise<AgentExecuteResponse | void> => {
      if (!currentAgentId) return;

      // Add user message to conversation
      const userMessage: ConversationMessage = {
        id: `msg-${Date.now()}`,
        role: 'user',
        content: request.message,
        agentId: currentAgentId,
        timestamp: new Date().toISOString(),
      };

      setConversation((prev) => ({
        ...prev,
        messages: [...prev.messages, userMessage],
      }));

      setAgentState((prev) => ({ ...prev, executing: true }));

      try {
        const response = await agentService.execute(currentAgentId, request);

        // Add assistant message
        const assistantMessage: ConversationMessage = {
          id: response.id,
          role: 'assistant',
          content: response.message,
          agentId: currentAgentId,
          toolCalls: response.toolCalls,
          timestamp: new Date().toISOString(),
        };

        if (mountedRef.current) {
          setConversation((prev) => ({
            ...prev,
            messages: [...prev.messages, assistantMessage],
          }));
          onMessage?.(assistantMessage);
        }

        return response;
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Execution failed');
        onError?.(err);
        throw err;
      } finally {
        if (mountedRef.current) {
          setAgentState((prev) => ({ ...prev, executing: false }));
        }
      }
    },
    [currentAgentId, onMessage, onError]
  );

  // Execute streaming request
  const executeStream = useCallback(
    async (message: string) => {
      if (!currentAgentId) return;

      // Add user message
      const userMessage: ConversationMessage = {
        id: `msg-${Date.now()}`,
        role: 'user',
        content: message,
        agentId: currentAgentId,
        timestamp: new Date().toISOString(),
      };

      setConversation((prev) => ({
        ...prev,
        messages: [...prev.messages, userMessage],
        isStreaming: true,
        currentStream: '',
      }));

      setAgentState((prev) => ({ ...prev, executing: true }));

      // Create abort controller
      abortControllerRef.current = new AbortController();

      try {
        await agentService.executeStream(
          currentAgentId,
          { message, stream: true },
          (chunk) => {
            if (mountedRef.current) {
              setConversation((prev) => ({
                ...prev,
                currentStream: prev.currentStream + chunk,
              }));
            }
          },
          { signal: abortControllerRef.current.signal }
        );

        // Finalize the streaming message
        if (mountedRef.current) {
          setConversation((prev) => {
            const assistantMessage: ConversationMessage = {
              id: `msg-${Date.now()}`,
              role: 'assistant',
              content: prev.currentStream,
              agentId: currentAgentId,
              timestamp: new Date().toISOString(),
            };

            return {
              ...prev,
              messages: [...prev.messages, assistantMessage],
              currentStream: '',
              isStreaming: false,
            };
          });
        }
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          onError?.(error);
        }
      } finally {
        if (mountedRef.current) {
          setAgentState((prev) => ({ ...prev, executing: false }));
          setConversation((prev) => ({ ...prev, isStreaming: false }));
        }
        abortControllerRef.current = null;
      }
    },
    [currentAgentId, onError]
  );

  // Stop current execution
  const stopExecution = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Finalize any streaming content
    setConversation((prev) => {
      if (prev.isStreaming && prev.currentStream) {
        const assistantMessage: ConversationMessage = {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: prev.currentStream + ' [stopped]',
          agentId: currentAgentId || '',
          timestamp: new Date().toISOString(),
        };

        return {
          ...prev,
          messages: [...prev.messages, assistantMessage],
          currentStream: '',
          isStreaming: false,
        };
      }
      return { ...prev, isStreaming: false };
    });

    setAgentState((prev) => ({ ...prev, executing: false }));
  }, [currentAgentId]);

  // Create execution plan
  const createPlan = useCallback(
    async (taskDescription: string): Promise<AgentPlan> => {
      if (!currentAgentId) throw new Error('No agent selected');
      return agentService.createPlan(currentAgentId, taskDescription);
    },
    [currentAgentId]
  );

  // Delegate to another agent
  const delegate = useCallback(
    async (toAgentId: string, taskId: string) => {
      if (!currentAgentId) throw new Error('No agent selected');
      await agentService.delegate(currentAgentId, toAgentId, taskId);
    },
    [currentAgentId]
  );

  // Agent lifecycle methods
  const startAgent = useCallback(async () => {
    if (!currentAgentId) return;
    const result = await agentService.start(currentAgentId);
    setAgentState((prev) => ({
      ...prev,
      agent: prev.agent ? { ...prev.agent, status: result.status } : null,
    }));
  }, [currentAgentId]);

  const stopAgent = useCallback(async () => {
    if (!currentAgentId) return;
    const result = await agentService.stop(currentAgentId);
    setAgentState((prev) => ({
      ...prev,
      agent: prev.agent ? { ...prev.agent, status: result.status } : null,
    }));
  }, [currentAgentId]);

  const restartAgent = useCallback(async () => {
    if (!currentAgentId) return;
    const result = await agentService.restart(currentAgentId);
    setAgentState((prev) => ({
      ...prev,
      agent: prev.agent ? { ...prev.agent, status: result.status } : null,
    }));
  }, [currentAgentId]);

  // Clear messages
  const clearMessages = useCallback(() => {
    setConversation({
      messages: [],
      currentStream: '',
      isStreaming: false,
    });
  }, []);

  // Refresh health
  const refreshHealth = useCallback(async () => {
    if (!currentAgentId) return;
    const health = await agentService.getHealth(currentAgentId);
    setAgentState((prev) => ({ ...prev, health }));
  }, [currentAgentId]);

  // Auto-load on mount
  useEffect(() => {
    mountedRef.current = true;

    if (autoLoad && (initialAgentId || role)) {
      loadAgent();
    }

    return () => {
      mountedRef.current = false;

      // Cleanup subscriptions
      if (currentAgentId) {
        unsubscribe([`agent:${currentAgentId}`]);
      }

      // Abort any ongoing requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [autoLoad, initialAgentId, role, loadAgent, unsubscribe, currentAgentId]);

  return {
    // Agent state
    agent: agentState.agent,
    health: agentState.health,
    loading: agentState.loading,
    error: agentState.error,
    executing: agentState.executing,
    isConnected,

    // Conversation
    messages: conversation.messages,
    isStreaming: conversation.isStreaming,
    currentStream: conversation.currentStream,

    // Actions
    loadAgent,
    execute,
    executeStream,
    stopExecution,
    createPlan,
    delegate,
    startAgent,
    stopAgent,
    restartAgent,
    clearMessages,
    refreshHealth,
  };
}

export default useAgent;
