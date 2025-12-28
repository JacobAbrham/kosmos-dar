'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface Agent {
  id: string;
  name: string;
  domain: string;
  status: 'ready' | 'processing' | 'error';
  color: string;
  description: string;
}

const agents: Agent[] = [
  {
    id: 'zeus',
    name: 'Zeus',
    domain: 'Orchestration',
    status: 'ready',
    color: 'bg-yellow-500',
    description: 'Master orchestrator',
  },
  {
    id: 'hermes',
    name: 'Hermes',
    domain: 'Data Integration',
    status: 'ready',
    color: 'bg-green-500',
    description: 'Data fetching & transformation',
  },
  {
    id: 'aegis',
    name: 'AEGIS',
    domain: 'Security',
    status: 'ready',
    color: 'bg-red-500',
    description: 'Security guardian',
  },
  {
    id: 'athena',
    name: 'Athena',
    domain: 'Analytics',
    status: 'ready',
    color: 'bg-purple-500',
    description: 'Analytics & insights',
  },
  {
    id: 'chronos',
    name: 'Chronos',
    domain: 'Scheduling',
    status: 'ready',
    color: 'bg-blue-500',
    description: 'Time & scheduling',
  },
  {
    id: 'hephaestus',
    name: 'Hephaestus',
    domain: 'Development',
    status: 'ready',
    color: 'bg-orange-500',
    description: 'Code & engineering',
  },
  {
    id: 'nur_prometheus',
    name: 'Nur PROMETHEUS',
    domain: 'Finance',
    status: 'ready',
    color: 'bg-teal-500',
    description: 'Cost & governance',
  },
  {
    id: 'iris',
    name: 'Iris',
    domain: 'Communication',
    status: 'ready',
    color: 'bg-pink-500',
    description: 'Notifications & messaging',
  },
  {
    id: 'memorix',
    name: 'MEMORIX',
    domain: 'Memory',
    status: 'ready',
    color: 'bg-cyan-500',
    description: 'Knowledge management',
  },
  {
    id: 'hestia',
    name: 'Hestia',
    domain: 'Operations',
    status: 'ready',
    color: 'bg-lime-500',
    description: 'System operations',
  },
  {
    id: 'morpheus',
    name: 'Morpheus',
    domain: 'Prediction',
    status: 'ready',
    color: 'bg-violet-500',
    description: 'Forecasting & simulation',
  },
];

export function AgentPanel() {
  return (
    <div className="glassmorphism h-full overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-800/50">
        <h2 className="font-semibold">Agent Status</h2>
        <p className="text-sm text-gray-500 mt-1">
          {agents.filter((a) => a.status === 'ready').length}/{agents.length} agents ready
        </p>
      </div>

      {/* Agent list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {agents.map((agent) => (
          <div key={agent.id}>
            <AgentCard agent={agent} />
          </div>
        ))}
      </div>

      {/* Pentarchy indicator */}
      <div className="p-4 border-t border-gray-800/50">
        <div className="text-xs text-gray-500 mb-2">Pentarchy Voters</div>
        <div className="flex gap-2">
          <PentarchyBadge name="Athena" color="bg-purple-500" />
          <PentarchyBadge name="Hephaestus" color="bg-orange-500" />
          <PentarchyBadge name="PROMETHEUS" color="bg-teal-500" />
        </div>
      </div>
    </div>
  );
}

function AgentCard({ agent }: { agent: Agent }) {
  return (
    <div className="agent-card flex items-center gap-3">
      {/* Status indicator */}
      <div className={cn('agent-status', agent.status)} />

      {/* Avatar */}
      <div
        className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold',
          agent.color
        )}
      >
        {agent.name[0]}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{agent.name}</div>
        <div className="text-xs text-gray-500 truncate">{agent.domain}</div>
      </div>
    </div>
  );
}

function PentarchyBadge({ name, color }: { name: string; color: string }) {
  return (
    <div
      className={cn(
        'px-2 py-1 rounded text-xs font-medium text-white',
        color
      )}
    >
      {name}
    </div>
  );
}
