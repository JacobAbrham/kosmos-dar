'use client';

/**
 * KOSMOS AEOS Agent Context
 * Global agent state provider with multi-agent support
 */

import React, { createContext, useContext, ReactNode, useState, useCallback, useEffect, useRef } from 'react';
import { useWebSocketContext } from './WebSocketContext';
import {
  agentService,
  Agent,
  AgentStatus,
  AgentRole,
  AgentHealth,
} from '@/services/agent.service';

// Active agent session
interface AgentSession {
  agentId: string;
  role: AgentRole;
  conversationId: string;
  startedAt: string;
}

// Context state
interface AgentGlobalState {
  agents: Agent[];
  agentHealth: Record<string, AgentHealth>;
  activeSession: AgentSession | null;
  recentAgents: string[];
  loading: boolean;
  error: Error | null;
}

// Context value type
interface AgentContextValue {
  // State
  agents: Agent[];
  agentHealth: Record<string, AgentHealth>;
  activeSession: AgentSession | null;
  recentAgents: string[];
  loading: boolean;
  error: Error | null;

  // Agent queries
  getAgent: (agentId: string) => Agent | undefined;
  getAgentByRole: (role: AgentRole) => Agent | undefined;
  getAgentHealth: (agentId: string) => AgentHealth | undefined;
  isAgentAvailable: (agentId: string) => boolean;

  // Agent actions
  refreshAgents: () => Promise<void>;
  refreshHealth: () => Promise<void>;
  startSession: (agentId: string) => Promise<AgentSession>;
  endSession: () => void;
  switchAgent: (agentId: string) => Promise<void>;

  // Helpers
  getOrchestratorAgent: () => Agent | undefined;
  getAvailableAgents: () => Agent[];
  getAgentsByCapability: (capability: string) => Agent[];
}

// Create context
const AgentContext = createContext<AgentContextValue | null>(null);

// Provider props
interface AgentProviderProps {
  children: ReactNode;
  autoLoadAgents?: boolean;
  healthCheckInterval?: number;
}

/**
 * Agent Provider Component
 * Manages global agent state and provides agent-related methods
 */
export function AgentProvider({
  children,
  autoLoadAgents = true,
  healthCheckInterval = 30000,
}: AgentProviderProps) {
  const [state, setState] = useState<AgentGlobalState>({
    agents: [],
    agentHealth: {},
    activeSession: null,
    recentAgents: [],
    loading: false,
    error: null,
  });

  const { on, subscribe, unsubscribe, isOnline } = useWebSocketContext();
  const healthIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // Load all agents
  const refreshAgents = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const response = await agentService.list({ limit: 100 });

      if (mountedRef.current) {
        setState((prev) => ({
          ...prev,
          agents: response.items,
          loading: false,
        }));
      }
    } catch (error) {
      if (mountedRef.current) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error : new Error('Failed to load agents'),
        }));
      }
    }
  }, []);

  // Refresh health for all agents
  const refreshHealth = useCallback(async () => {
    try {
      const healthData = await agentService.getAllHealth();

      if (mountedRef.current) {
        const healthMap: Record<string, AgentHealth> = {};
        healthData.forEach((health) => {
          healthMap[health.agentId] = health;
        });

        setState((prev) => ({
          ...prev,
          agentHealth: healthMap,
        }));
      }
    } catch (error) {
      console.error('Failed to refresh agent health:', error);
    }
  }, []);

  // Get agent by ID
  const getAgent = useCallback(
    (agentId: string): Agent | undefined => {
      return state.agents.find((a) => a.id === agentId);
    },
    [state.agents]
  );

  // Get agent by role
  const getAgentByRole = useCallback(
    (role: AgentRole): Agent | undefined => {
      return state.agents.find((a) => a.role === role);
    },
    [state.agents]
  );

  // Get agent health
  const getAgentHealth = useCallback(
    (agentId: string): AgentHealth | undefined => {
      return state.agentHealth[agentId];
    },
    [state.agentHealth]
  );

  // Check if agent is available
  const isAgentAvailable = useCallback(
    (agentId: string): boolean => {
      const agent = getAgent(agentId);
      const health = getAgentHealth(agentId);

      return (
        agent?.status === 'idle' &&
        (health?.healthy ?? true)
      );
    },
    [getAgent, getAgentHealth]
  );

  // Start a session with an agent
  const startSession = useCallback(
    async (agentId: string): Promise<AgentSession> => {
      const agent = getAgent(agentId);
      if (!agent) {
        throw new Error(`Agent ${agentId} not found`);
      }

      const session: AgentSession = {
        agentId,
        role: agent.role,
        conversationId: `conv-${Date.now()}`,
        startedAt: new Date().toISOString(),
      };

      // Subscribe to agent updates
      subscribe([`agent:${agentId}`]);

      // Update recent agents
      setState((prev) => ({
        ...prev,
        activeSession: session,
        recentAgents: [agentId, ...prev.recentAgents.filter((id) => id !== agentId)].slice(0, 5),
      }));

      return session;
    },
    [getAgent, subscribe]
  );

  // End current session
  const endSession = useCallback(() => {
    if (state.activeSession) {
      unsubscribe([`agent:${state.activeSession.agentId}`]);
    }

    setState((prev) => ({
      ...prev,
      activeSession: null,
    }));
  }, [state.activeSession, unsubscribe]);

  // Switch to a different agent
  const switchAgent = useCallback(
    async (agentId: string) => {
      endSession();
      await startSession(agentId);
    },
    [endSession, startSession]
  );

  // Get orchestrator agent (Zeus)
  const getOrchestratorAgent = useCallback((): Agent | undefined => {
    return getAgentByRole('zeus');
  }, [getAgentByRole]);

  // Get all available agents
  const getAvailableAgents = useCallback((): Agent[] => {
    return state.agents.filter((agent) => isAgentAvailable(agent.id));
  }, [state.agents, isAgentAvailable]);

  // Get agents by capability
  const getAgentsByCapability = useCallback(
    (capability: string): Agent[] => {
      return state.agents.filter((agent) =>
        agent.capabilities.includes(capability as any)
      );
    },
    [state.agents]
  );

  // Handle agent status updates from WebSocket
  useEffect(() => {
    if (!isOnline) return;

    const unsubscribeStatus = on<{ agentId: string; status: AgentStatus }>(
      'agent:status',
      (data) => {
        setState((prev) => ({
          ...prev,
          agents: prev.agents.map((agent) =>
            agent.id === data.agentId
              ? { ...agent, status: data.status }
              : agent
          ),
        }));
      }
    );

    return () => {
      unsubscribeStatus();
    };
  }, [isOnline, on]);

  // Auto-load agents on mount
  useEffect(() => {
    mountedRef.current = true;

    if (autoLoadAgents) {
      refreshAgents();
      refreshHealth();
    }

    // Set up health check interval
    if (healthCheckInterval > 0) {
      healthIntervalRef.current = setInterval(refreshHealth, healthCheckInterval);
    }

    return () => {
      mountedRef.current = false;

      if (healthIntervalRef.current) {
        clearInterval(healthIntervalRef.current);
      }
    };
  }, [autoLoadAgents, healthCheckInterval, refreshAgents, refreshHealth]);

  const value: AgentContextValue = {
    // State
    agents: state.agents,
    agentHealth: state.agentHealth,
    activeSession: state.activeSession,
    recentAgents: state.recentAgents,
    loading: state.loading,
    error: state.error,

    // Agent queries
    getAgent,
    getAgentByRole,
    getAgentHealth,
    isAgentAvailable,

    // Agent actions
    refreshAgents,
    refreshHealth,
    startSession,
    endSession,
    switchAgent,

    // Helpers
    getOrchestratorAgent,
    getAvailableAgents,
    getAgentsByCapability,
  };

  return (
    <AgentContext.Provider value={value}>
      {children}
    </AgentContext.Provider>
  );
}

/**
 * Hook to use Agent context
 */
export function useAgentContext(): AgentContextValue {
  const context = useContext(AgentContext);

  if (!context) {
    throw new Error('useAgentContext must be used within an AgentProvider');
  }

  return context;
}

/**
 * HOC to inject Agent context
 */
export function withAgentContext<P extends object>(
  WrappedComponent: React.ComponentType<P & { agentContext: AgentContextValue }>
) {
  return function WithAgentContextComponent(props: P) {
    const agentContext = useAgentContext();
    return <WrappedComponent {...props} agentContext={agentContext} />;
  };
}

// Agent status badge component
interface AgentStatusBadgeProps {
  agentId: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function AgentStatusBadge({
  agentId,
  showLabel = false,
  size = 'md',
}: AgentStatusBadgeProps) {
  const { getAgent, getAgentHealth } = useAgentContext();

  const agent = getAgent(agentId);
  const health = getAgentHealth(agentId);

  if (!agent) return null;

  const statusColors: Record<AgentStatus, string> = {
    idle: 'bg-green-500',
    busy: 'bg-yellow-500',
    error: 'bg-red-500',
    offline: 'bg-gray-500',
    initializing: 'bg-blue-500',
  };

  const statusLabels: Record<AgentStatus, string> = {
    idle: 'Available',
    busy: 'Busy',
    error: 'Error',
    offline: 'Offline',
    initializing: 'Starting...',
  };

  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  const status = agent.status;
  const isHealthy = health?.healthy ?? true;

  return (
    <div className="flex items-center gap-2">
      <div
        className={`
          ${sizeClasses[size]}
          rounded-full
          ${statusColors[status]}
          ${status === 'busy' || status === 'initializing' ? 'animate-pulse' : ''}
          ${!isHealthy ? 'ring-2 ring-red-300' : ''}
        `}
        title={`${statusLabels[status]}${!isHealthy ? ' (Unhealthy)' : ''}`}
      />
      {showLabel && (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {statusLabels[status]}
        </span>
      )}
    </div>
  );
}

export default AgentContext;
