'use client';

/**
 * KOSMOS AEOS Agent Status
 * Real-time agent status indicators and health display
 * Enhanced with Jotai for real-time execution progress, tool calls, and cost tracking
 */

import React from 'react';
import { useAgentContext } from '@/context/AgentContext';
import { Agent, AgentStatus as AgentStatusType, AgentHealth, AgentRole } from '@/services/agent.service';
import { useAgentExecutionStatus, useAgentCostTracking, useAgentToolCalls } from '@/hooks/useAgentExecution';

// Status configurations
const statusConfig: Record<AgentStatusType, {
  label: string;
  color: string;
  bgColor: string;
  icon: string;
  animate: boolean;
}> = {
  idle: {
    label: 'Available',
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    icon: '\u2713', // Check
    animate: false,
  },
  busy: {
    label: 'Processing',
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
    icon: '\u23F3', // Hourglass
    animate: true,
  },
  error: {
    label: 'Error',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    icon: '\u26A0', // Warning
    animate: false,
  },
  offline: {
    label: 'Offline',
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-100 dark:bg-gray-900/30',
    icon: '\u25CF', // Circle
    animate: false,
  },
  initializing: {
    label: 'Starting',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    icon: '\u21BB', // Rotate
    animate: true,
  },
};

// Props interfaces
interface AgentStatusIndicatorProps {
  agentId: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  showIcon?: boolean;
  className?: string;
}

interface AgentStatusCardProps {
  agentId: string;
  showHealth?: boolean;
  showStats?: boolean;
  compact?: boolean;
  className?: string;
}

interface AgentHealthBarProps {
  agentId: string;
  className?: string;
}

interface AllAgentsStatusProps {
  onAgentClick?: (agentId: string) => void;
  filter?: (agent: Agent) => boolean;
  className?: string;
}

/**
 * Simple status indicator dot/badge
 */
export function AgentStatusIndicator({
  agentId,
  size = 'md',
  showLabel = false,
  showIcon = false,
  className = '',
}: AgentStatusIndicatorProps) {
  const { getAgent } = useAgentContext();
  const agent = getAgent(agentId);

  if (!agent) return null;

  const config = statusConfig[agent.status];

  const sizeClasses = {
    xs: 'w-2 h-2',
    sm: 'w-2.5 h-2.5',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  const textSizeClasses = {
    xs: 'text-xs',
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <div
        className={`
          ${sizeClasses[size]}
          rounded-full
          ${config.bgColor}
          ${config.animate ? 'animate-pulse' : ''}
          flex items-center justify-center
        `}
      >
        <div className={`${sizeClasses[size]} rounded-full ${config.color.replace('text-', 'bg-')}`} />
      </div>
      {showIcon && (
        <span className={`${textSizeClasses[size]} ${config.color}`}>
          {config.icon}
        </span>
      )}
      {showLabel && (
        <span className={`${textSizeClasses[size]} ${config.color} font-medium`}>
          {config.label}
        </span>
      )}
    </div>
  );
}

/**
 * Agent status card with detailed information
 */
export function AgentStatusCard({
  agentId,
  showHealth = true,
  showStats = true,
  compact = false,
  className = '',
}: AgentStatusCardProps) {
  const { getAgent, getAgentHealth } = useAgentContext();
  const agent = getAgent(agentId);
  const health = getAgentHealth(agentId);
  
  // Real-time execution status from Jotai
  const { executionStatus, isRunning, progress, currentStep } = useAgentExecutionStatus(agentId);
  const { cost, tokens } = useAgentCostTracking(agentId);
  const { activeToolCalls, activeCount } = useAgentToolCalls(agentId);

  if (!agent) return null;

  const config = statusConfig[agent.status];

  return (
    <div
      className={`
        rounded-xl border border-gray-200 dark:border-gray-700
        bg-white dark:bg-gray-900 overflow-hidden
        ${className}
      `}
    >
      {/* Header */}
      <div className={`${config.bgColor} px-4 ${compact ? 'py-2' : 'py-3'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AgentStatusIndicator agentId={agentId} size="md" />
            <span className={`font-semibold ${config.color}`}>{config.label}</span>
          </div>
          {config.animate && (
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className={`${compact ? 'p-3' : 'p-4'} space-y-3`}>
        {/* Agent info */}
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">{agent.name}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{agent.role}</p>
        </div>

        {/* Real-time execution progress */}
        {isRunning && executionStatus && (
          <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Execution Progress</span>
              <span className="font-medium text-gray-700 dark:text-gray-300">{progress}%</span>
            </div>
            <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            {currentStep && (
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {currentStep}
              </p>
            )}
            {activeCount > 0 && (
              <p className="text-xs text-blue-600 dark:text-blue-400">
                {activeCount} tool call{activeCount !== 1 ? 's' : ''} active
              </p>
            )}
          </div>
        )}

        {/* Real-time cost tracking */}
        {isRunning && cost > 0 && (
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-gray-500 dark:text-gray-400">Cost</span>
              <span className="font-medium text-gray-700 dark:text-gray-300">
                ${cost.toFixed(4)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>Tokens: {tokens.total.toLocaleString()}</span>
              <span>({tokens.input.toLocaleString()} in / {tokens.output.toLocaleString()} out)</span>
            </div>
          </div>
        )}

        {/* Health metrics */}
        {showHealth && health && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">CPU</span>
              <div className="flex items-center gap-2">
                <div className="w-20 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      health.metrics.cpu > 80 ? 'bg-red-500' : health.metrics.cpu > 60 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${health.metrics.cpu}%` }}
                  />
                </div>
                <span className="text-gray-600 dark:text-gray-300 w-10 text-right">
                  {health.metrics.cpu}%
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Memory</span>
              <div className="flex items-center gap-2">
                <div className="w-20 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      health.metrics.memory > 80 ? 'bg-red-500' : health.metrics.memory > 60 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${health.metrics.memory}%` }}
                  />
                </div>
                <span className="text-gray-600 dark:text-gray-300 w-10 text-right">
                  {health.metrics.memory}%
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Latency</span>
              <span className={`font-medium ${
                health.metrics.latency > 1000 ? 'text-red-500' : health.metrics.latency > 500 ? 'text-yellow-500' : 'text-green-500'
              }`}>
                {health.metrics.latency}ms
              </span>
            </div>
          </div>
        )}

        {/* Stats */}
        {showStats && !compact && (
          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {agent.stats.tasksCompleted}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {agent.stats.tasksInProgress}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">In Progress</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {agent.stats.tasksFailed}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Failed</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Health bar for an agent
 */
export function AgentHealthBar({ agentId, className = '' }: AgentHealthBarProps) {
  const { getAgentHealth } = useAgentContext();
  const health = getAgentHealth(agentId);

  if (!health) {
    return (
      <div className={`h-2 bg-gray-200 dark:bg-gray-700 rounded-full ${className}`}>
        <div className="h-full w-full bg-gray-300 dark:bg-gray-600 rounded-full animate-pulse" />
      </div>
    );
  }

  // Calculate overall health score (0-100)
  const healthScore = Math.round(
    (100 - health.metrics.cpu) * 0.3 +
    (100 - health.metrics.memory) * 0.3 +
    (100 - Math.min(health.metrics.errorRate * 10, 100)) * 0.4
  );

  const healthColor = healthScore > 70 ? 'bg-green-500' : healthScore > 40 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className={`h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden ${className}`}>
      <div
        className={`h-full ${healthColor} rounded-full transition-all duration-500`}
        style={{ width: `${healthScore}%` }}
        title={`Health: ${healthScore}%`}
      />
    </div>
  );
}

/**
 * Grid showing status of all agents
 */
export function AllAgentsStatus({
  onAgentClick,
  filter,
  className = '',
}: AllAgentsStatusProps) {
  const { agents, loading } = useAgentContext();

  const filteredAgents = filter ? agents.filter(filter) : agents;

  if (loading) {
    return (
      <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 ${className}`}>
        {[...Array(10)].map((_, i) => (
          <div key={i} className="p-4 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse">
            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 mb-2" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-1" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 ${className}`}>
      {filteredAgents.map((agent) => {
        const config = statusConfig[agent.status];

        return (
          <div
            key={agent.id}
            onClick={() => onAgentClick?.(agent.id)}
            className={`
              p-4 rounded-xl border border-gray-200 dark:border-gray-700
              bg-white dark:bg-gray-900
              ${onAgentClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}
            `}
          >
            <div className="flex items-center gap-2 mb-2">
              <AgentStatusIndicator agentId={agent.id} size="md" />
              <span className={`text-sm font-medium ${config.color}`}>
                {config.label}
              </span>
            </div>
            <h4 className="font-semibold text-gray-900 dark:text-white truncate">
              {agent.name}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
              {agent.role}
            </p>
            <AgentHealthBar agentId={agent.id} className="mt-2" />
          </div>
        );
      })}
    </div>
  );
}

export default AgentStatusCard;
