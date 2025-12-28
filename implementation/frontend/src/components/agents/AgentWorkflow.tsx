'use client';

/**
 * KOSMOS AEOS Agent Workflow Visualization
 * Shows agent delegation and workflow execution
 */

import React, { useState, useEffect } from 'react';
import { useAgentContext } from '@/context/AgentContext';
import { Agent, AgentRole, AgentPlan, PlanStep } from '@/services/agent.service';

// Role colors for visualization
const roleColors: Record<AgentRole, string> = {
  zeus: '#F59E0B',
  athena: '#8B5CF6',
  hermes: '#3B82F6',
  chronos: '#6B7280',
  mnemosyne: '#EC4899',
  hephaestus: '#EF4444',
  apollo: '#FBBF24',
  argus: '#10B981',
  prometheus: '#F97316',
  daedalus: '#A855F7',
  iris: '#14B8A6',
  hestia: '#78716C',
  thoth: '#6366F1',
  custom: '#9CA3AF',
};

interface AgentWorkflowProps {
  plan?: AgentPlan;
  onStepClick?: (step: PlanStep) => void;
  showLegend?: boolean;
  className?: string;
}

export function AgentWorkflowVisualization({
  plan,
  onStepClick,
  showLegend = true,
  className = '',
}: AgentWorkflowProps) {
  const { agents, getAgentByRole } = useAgentContext();
  const [selectedStep, setSelectedStep] = useState<string | null>(null);

  if (!plan) {
    return (
      <div className={`flex items-center justify-center h-64 text-gray-500 ${className}`}>
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
          </svg>
          <p>No workflow plan available</p>
        </div>
      </div>
    );
  }

  // Group steps by order for parallel execution visualization
  const stepsByOrder = plan.steps.reduce((acc, step) => {
    if (!acc[step.order]) {
      acc[step.order] = [];
    }
    acc[step.order].push(step);
    return acc;
  }, {} as Record<number, PlanStep[]>);

  const orderGroups = Object.keys(stepsByOrder)
    .map(Number)
    .sort((a, b) => a - b);

  // Status colors
  const statusColors: Record<string, { bg: string; text: string; border: string }> = {
    pending: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', border: 'border-gray-300 dark:border-gray-600' },
    running: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-400' },
    completed: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400', border: 'border-green-400' },
    failed: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400', border: 'border-red-400' },
    skipped: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-400', border: 'border-gray-300 dark:border-gray-600' },
  };

  // Handle step click
  const handleStepClick = (step: PlanStep) => {
    setSelectedStep(selectedStep === step.id ? null : step.id);
    onStepClick?.(step);
  };

  // Render step node
  const renderStep = (step: PlanStep) => {
    const agent = getAgentByRole(step.agent);
    const colors = statusColors[step.status];
    const isSelected = selectedStep === step.id;

    return (
      <div
        key={step.id}
        onClick={() => handleStepClick(step)}
        className={`
          relative p-4 rounded-xl border-2 cursor-pointer transition-all
          ${colors.bg} ${colors.border}
          ${isSelected ? 'ring-2 ring-blue-500 scale-105' : 'hover:scale-102'}
          min-w-[200px]
        `}
      >
        {/* Status indicator */}
        <div className="absolute -top-2 -right-2">
          {step.status === 'running' && (
            <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse" />
          )}
          {step.status === 'completed' && (
            <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
          {step.status === 'failed' && (
            <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          )}
        </div>

        {/* Agent avatar */}
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
            style={{ backgroundColor: roleColors[step.agent] }}
          >
            {step.agent.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="font-semibold text-gray-900 dark:text-white">
              {agent?.name || step.agent}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">
              {step.agent}
            </div>
          </div>
        </div>

        {/* Action */}
        <div className={`text-sm font-medium ${colors.text}`}>
          {step.action}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
          {step.description}
        </div>

        {/* Result preview (when selected and completed) */}
        {isSelected && step.status === 'completed' && step.result !== undefined && step.result !== null && (
          <div className="mt-3 p-2 bg-white dark:bg-gray-900 rounded text-xs font-mono overflow-hidden">
            <pre className="whitespace-pre-wrap">
              {typeof step.result === 'string'
                ? (step.result as string).substring(0, 100)
                : JSON.stringify(step.result, null, 2).substring(0, 100)}
              ...
            </pre>
          </div>
        )}

        {/* Error message */}
        {step.status === 'failed' && step.error && (
          <div className="mt-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">
            {step.error}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Plan header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Execution Plan
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Task: {plan.taskId}
          </p>
        </div>
        <div className={`
          px-3 py-1 rounded-full text-sm font-medium capitalize
          ${plan.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
            plan.status === 'executing' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
            plan.status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
            'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'}
        `}>
          {plan.status}
        </div>
      </div>

      {/* Workflow visualization */}
      <div className="relative overflow-x-auto pb-4">
        <div className="flex items-center gap-8 min-w-max">
          {orderGroups.map((order, groupIndex) => (
            <React.Fragment key={order}>
              {/* Step group */}
              <div className="flex flex-col gap-4">
                {stepsByOrder[order].map((step) => renderStep(step))}
              </div>

              {/* Arrow connector */}
              {groupIndex < orderGroups.length - 1 && (
                <div className="flex items-center">
                  <div className="w-8 h-0.5 bg-gray-300 dark:bg-gray-600" />
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="flex flex-wrap gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-500 dark:text-gray-400 mr-2">Agents:</div>
          {Object.entries(roleColors).map(([role, color]) => {
            const agent = getAgentByRole(role as AgentRole);
            if (!agent) return null;

            return (
              <div key={role} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  {agent.name}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Compact agent delegation flow
 */
interface AgentDelegationFlowProps {
  steps: Array<{ from: AgentRole; to: AgentRole; action: string }>;
  className?: string;
}

export function AgentDelegationFlow({ steps, className = '' }: AgentDelegationFlowProps) {
  const { getAgentByRole } = useAgentContext();

  return (
    <div className={`flex items-center flex-wrap gap-2 ${className}`}>
      {steps.map((step, index) => {
        const fromAgent = getAgentByRole(step.from);
        const toAgent = getAgentByRole(step.to);

        return (
          <React.Fragment key={index}>
            {index === 0 && (
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: roleColors[step.from] }}
                title={fromAgent?.name}
              >
                {step.from.charAt(0).toUpperCase()}
              </div>
            )}

            <div className="flex items-center gap-1">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
              <span className="text-xs text-gray-500 dark:text-gray-400">{step.action}</span>
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </div>

            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
              style={{ backgroundColor: roleColors[step.to] }}
              title={toAgent?.name}
            >
              {step.to.charAt(0).toUpperCase()}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

/**
 * Agent network diagram showing all agents and their relationships
 */
interface AgentNetworkProps {
  onAgentClick?: (agentId: string) => void;
  highlightAgent?: string;
  className?: string;
}

export function AgentNetwork({
  onAgentClick,
  highlightAgent,
  className = '',
}: AgentNetworkProps) {
  const { agents } = useAgentContext();

  // Simple circular layout
  const centerX = 200;
  const centerY = 200;
  const radius = 150;

  return (
    <div className={`relative ${className}`}>
      <svg viewBox="0 0 400 400" className="w-full h-full">
        {/* Connection lines */}
        {agents.map((agent, i) => {
          const angle1 = (i * 2 * Math.PI) / agents.length - Math.PI / 2;
          const x1 = centerX + radius * Math.cos(angle1);
          const y1 = centerY + radius * Math.sin(angle1);

          // Draw lines to Zeus (orchestrator) from all agents
          if (agent.role !== 'zeus') {
            const zeusIndex = agents.findIndex((a) => a.role === 'zeus');
            if (zeusIndex !== -1) {
              const zeusAngle = (zeusIndex * 2 * Math.PI) / agents.length - Math.PI / 2;
              const zeusX = centerX + radius * Math.cos(zeusAngle);
              const zeusY = centerY + radius * Math.sin(zeusAngle);

              return (
                <line
                  key={`line-${agent.id}`}
                  x1={x1}
                  y1={y1}
                  x2={zeusX}
                  y2={zeusY}
                  stroke={roleColors[agent.role]}
                  strokeWidth="1"
                  strokeOpacity="0.3"
                  strokeDasharray="4,4"
                />
              );
            }
          }
          return null;
        })}

        {/* Agent nodes */}
        {agents.map((agent, i) => {
          const angle = (i * 2 * Math.PI) / agents.length - Math.PI / 2;
          const x = centerX + radius * Math.cos(angle);
          const y = centerY + radius * Math.sin(angle);
          const isHighlighted = highlightAgent === agent.id;

          return (
            <g
              key={agent.id}
              onClick={() => onAgentClick?.(agent.id)}
              className={onAgentClick ? 'cursor-pointer' : ''}
              style={{ transform: isHighlighted ? 'scale(1.2)' : 'scale(1)', transformOrigin: `${x}px ${y}px` }}
            >
              <circle
                cx={x}
                cy={y}
                r={isHighlighted ? 28 : 24}
                fill={roleColors[agent.role]}
                className="transition-all"
              />
              <text
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="white"
                fontSize="10"
                fontWeight="bold"
              >
                {agent.role.slice(0, 3).toUpperCase()}
              </text>
              <text
                x={x}
                y={y + 40}
                textAnchor="middle"
                fontSize="10"
                className="fill-gray-600 dark:fill-gray-400"
              >
                {agent.name}
              </text>
            </g>
          );
        })}

        {/* Center label */}
        <text
          x={centerX}
          y={centerY}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="12"
          className="fill-gray-400"
        >
          KOSMOS
        </text>
      </svg>
    </div>
  );
}

export default AgentWorkflowVisualization;
