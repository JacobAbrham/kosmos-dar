'use client';

/**
 * KOSMOS AEOS Agents Page
 * Agent management and overview
 */

import React, { useState } from 'react';
import { DashboardShell } from '@/components/DashboardShell';
import { useAgentContext } from '@/context/AgentContext';
import { AgentStatusCard } from '@/components/agents/AgentStatus';
import { AgentNetwork } from '@/components/agents/AgentWorkflow';
import { AgentStatus } from '@/services/agent.service';
import { RefreshCw, Search } from 'lucide-react';

type ViewMode = 'grid' | 'list' | 'network';

export default function AgentsPage() {
  const { agents, loading, refreshAgents, getAgentHealth } = useAgentContext();
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<AgentStatus | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Filter agents
  const filteredAgents = agents.filter((agent) => {
    if (statusFilter !== 'all' && agent.status !== statusFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        agent.name.toLowerCase().includes(term) ||
        agent.role.toLowerCase().includes(term) ||
        agent.description.toLowerCase().includes(term)
      );
    }
    return true;
  });

  // Stats
  const agentStats = {
    total: agents.length,
    idle: agents.filter((a) => a.status === 'idle').length,
    busy: agents.filter((a) => a.status === 'busy').length,
    error: agents.filter((a) => a.status === 'error').length,
    offline: agents.filter((a) => a.status === 'offline').length,
  };

  return (
    <DashboardShell title="Agents" subtitle="Manage and monitor your AI agents">
      <div className="p-6 space-y-6">
        {/* Action Bar */}
        <div className="flex justify-end">
          <button
            onClick={() => refreshAgents()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Total', value: agentStats.total, color: 'bg-gray-500', filter: 'all' },
            { label: 'Available', value: agentStats.idle, color: 'bg-green-500', filter: 'idle' },
            { label: 'Busy', value: agentStats.busy, color: 'bg-yellow-500', filter: 'busy' },
            { label: 'Error', value: agentStats.error, color: 'bg-red-500', filter: 'error' },
            { label: 'Offline', value: agentStats.offline, color: 'bg-gray-400', filter: 'offline' },
          ].map((stat) => (
            <button
              key={stat.label}
              onClick={() => setStatusFilter(stat.filter as AgentStatus | 'all')}
              className={`
                p-4 rounded-xl border transition-all
                ${statusFilter === stat.filter
                  ? 'border-indigo-500 bg-indigo-500/10'
                  : 'border-gray-800 bg-gray-900/50 hover:border-gray-700'}
              `}
            >
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${stat.color}`} />
                <span className="text-sm text-gray-400">{stat.label}</span>
              </div>
              <p className="text-2xl font-bold text-gray-100 mt-1">
                {stat.value}
              </p>
            </button>
          ))}
        </div>

        {/* Filters and View Toggle */}
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search agents..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-800 bg-gray-900 text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* View Toggle */}
          <div className="flex rounded-lg border border-gray-800 overflow-hidden">
            {[
              { mode: 'grid' as ViewMode, label: 'Grid' },
              { mode: 'list' as ViewMode, label: 'List' },
              { mode: 'network' as ViewMode, label: 'Network' },
            ].map((view) => (
              <button
                key={view.mode}
                onClick={() => setViewMode(view.mode)}
                className={`
                  px-4 py-2 text-sm transition-colors
                  ${viewMode === view.mode
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-900 text-gray-400 hover:bg-gray-800'}
                `}
              >
                {view.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 bg-gray-800 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : viewMode === 'network' ? (
          <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-6">
            <AgentNetwork
              onAgentClick={setSelectedAgent}
              highlightAgent={selectedAgent || undefined}
              className="h-[500px]"
            />
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAgents.map((agent) => (
              <div
                key={agent.id}
                onClick={() => setSelectedAgent(agent.id)}
                className="cursor-pointer"
              >
                <AgentStatusCard
                  agentId={agent.id}
                  showHealth
                  showStats
                  className={`
                    transition-all
                    ${selectedAgent === agent.id ? 'ring-2 ring-indigo-500 scale-[1.02]' : ''}
                  `}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-900/50 rounded-2xl border border-gray-800 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Agent</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Tasks</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Health</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredAgents.map((agent) => {
                  const health = getAgentHealth(agent.id);
                  return (
                    <tr
                      key={agent.id}
                      onClick={() => setSelectedAgent(agent.id)}
                      className={`
                        hover:bg-gray-800/50 cursor-pointer transition-colors
                        ${selectedAgent === agent.id ? 'bg-indigo-500/10' : ''}
                      `}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold">
                            {agent.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-medium text-gray-100">{agent.name}</div>
                            <div className="text-sm text-gray-500">{agent.description.substring(0, 30)}...</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-medium bg-gray-800 rounded-full capitalize text-gray-300">
                          {agent.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`
                          inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-full
                          ${agent.status === 'idle' ? 'bg-green-500/20 text-green-400' :
                            agent.status === 'busy' ? 'bg-yellow-500/20 text-yellow-400' :
                            agent.status === 'error' ? 'bg-red-500/20 text-red-400' :
                            'bg-gray-500/20 text-gray-400'}
                        `}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            agent.status === 'idle' ? 'bg-green-500' :
                            agent.status === 'busy' ? 'bg-yellow-500 animate-pulse' :
                            agent.status === 'error' ? 'bg-red-500' :
                            'bg-gray-500'
                          }`} />
                          {agent.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        {agent.stats.tasksCompleted} completed
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="w-24 h-2 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${health?.healthy ? 'bg-green-500' : 'bg-red-500'}`}
                            style={{ width: health ? `${100 - (health.metrics.cpu + health.metrics.memory) / 2}%` : '0%' }}
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <a
                          href={`/agents/${agent.id}`}
                          className="text-indigo-400 hover:text-indigo-300 text-sm font-medium"
                        >
                          View →
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredAgents.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto bg-gray-800 rounded-full flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-gray-500" />
            </div>
            <h3 className="text-lg font-medium text-gray-100 mb-1">No agents found</h3>
            <p className="text-gray-500">
              {searchTerm || statusFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'No agents are currently configured'}
            </p>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
