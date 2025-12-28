/**
 * KOSMOS AEOS Agent Node
 * Node for agent execution in workflows
 */

'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import {
  Zap,
  Brain,
  MessageSquare,
  Calendar,
  Plug,
  Shield,
  Activity,
  Settings,
  Sparkles,
  Eye,
  Briefcase,
  Code,
  FileText,
  Cpu,
} from 'lucide-react';
import { AgentRole } from '@/services/agent.service';

export interface AgentNodeData {
  label: string;
  agentRole: AgentRole;
  prompt?: string;
  config?: Record<string, unknown>;
  timeout?: number;
}

const agentIcons: Record<AgentRole, React.ElementType> = {
  zeus: Zap,
  athena: Brain,
  hermes: MessageSquare,
  chronos: Calendar,
  hephaestus: Plug,
  argus: Shield,
  prometheus: Activity,
  daedalus: Settings,
  mnemosyne: Sparkles,
  iris: Eye,
  apollo: Briefcase,
  hestia: Code,
  thoth: FileText,
  custom: Cpu,
};

const agentColors: Record<AgentRole, string> = {
  zeus: 'from-yellow-500 to-amber-600',
  athena: 'from-indigo-500 to-purple-600',
  hermes: 'from-cyan-500 to-blue-600',
  chronos: 'from-slate-500 to-slate-600',
  hephaestus: 'from-orange-500 to-red-600',
  argus: 'from-emerald-500 to-green-600',
  prometheus: 'from-red-500 to-rose-600',
  daedalus: 'from-violet-500 to-purple-600',
  mnemosyne: 'from-pink-500 to-rose-600',
  iris: 'from-teal-500 to-cyan-600',
  apollo: 'from-amber-500 to-yellow-600',
  hestia: 'from-stone-500 to-stone-600',
  thoth: 'from-blue-500 to-indigo-600',
  custom: 'from-gray-500 to-gray-600',
};

export const AgentNode = memo(({ data, selected }: NodeProps<AgentNodeData>) => {
  const Icon = agentIcons[data.agentRole] || Cpu;
  const colorClass = agentColors[data.agentRole] || agentColors.custom;

  return (
    <div
      className={`
        relative rounded-lg shadow-lg min-w-[200px]
        ${selected ? 'ring-2 ring-blue-400' : ''}
        bg-gradient-to-br ${colorClass}
        transition-all duration-200 hover:shadow-xl
      `}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-white !border-2 !border-blue-400"
      />

      {/* Node Header */}
      <div className="px-4 py-3 flex items-center gap-3">
        <div className="p-2 bg-white/20 rounded-lg">
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <div className="text-xs font-medium text-white/70 uppercase tracking-wide">
            Agent
          </div>
          <div className="text-sm font-semibold text-white truncate">
            {data.label}
          </div>
        </div>
      </div>

      {/* Agent Role Badge */}
      <div className="px-4 pb-2">
        <span className="inline-flex items-center gap-1 text-xs bg-white/20 text-white rounded-full px-2 py-0.5">
          {data.agentRole.charAt(0).toUpperCase() + data.agentRole.slice(1)}
        </span>
      </div>

      {/* Prompt Preview */}
      {data.prompt && (
        <div className="px-4 pb-3">
          <div className="text-xs text-white/70 bg-white/10 rounded px-2 py-1 line-clamp-2">
            {data.prompt}
          </div>
        </div>
      )}

      {/* Timeout indicator */}
      {data.timeout && (
        <div className="absolute top-2 right-2">
          <span className="text-[10px] text-white/60 bg-black/20 rounded px-1">
            {data.timeout}s
          </span>
        </div>
      )}

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-white !border-2 !border-blue-400"
      />
    </div>
  );
});

AgentNode.displayName = 'AgentNode';

export default AgentNode;
