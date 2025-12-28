'use client';

/**
 * KOSMOS AEOS Analytics Page
 * System metrics and usage analytics
 */

import React, { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/DashboardShell';
import { useAgentContext } from '@/context/AgentContext';
import { taskService } from '@/services/task.service';

interface AnalyticsData {
  tasks: {
    total: number;
    completed: number;
    failed: number;
    pending: number;
    averageDuration: number;
    byType: Record<string, number>;
    byPriority: Record<string, number>;
    byAgent: Record<string, number>;
    timeline: Array<{ date: string; count: number }>;
  };
}

export default function AnalyticsPage() {
  const { agents } = useAgentContext();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  // Load analytics
  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        const from = new Date();
        from.setDate(from.getDate() - (timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90));

        const tasks = await taskService.getMetrics({
          from: from.toISOString(),
          groupBy: timeRange === '7d' ? 'day' : 'week',
        });

        setAnalytics({ tasks });
      } catch (error) {
        console.error('Failed to load analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAnalytics();
  }, [timeRange]);

  // Calculate agent stats
  const agentStats = agents.map((agent) => ({
    name: agent.name,
    role: agent.role,
    tasksCompleted: agent.stats.tasksCompleted,
    tasksInProgress: agent.stats.tasksInProgress,
    tasksFailed: agent.stats.tasksFailed,
    avgResponseTime: agent.stats.averageResponseTime,
    tokensUsed: agent.stats.tokensUsed,
  }));

  if (loading) {
    return (
      <DashboardShell title="Analytics" subtitle="System performance and usage metrics">
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-800 rounded-2xl animate-pulse" />
            ))}
          </div>
          <div className="h-96 bg-gray-800 rounded-2xl animate-pulse" />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Analytics" subtitle="System performance and usage metrics">
      <div className="p-6 space-y-6">
        {/* Time range selector */}
        <div className="flex justify-end">
          <div className="flex rounded-lg border border-gray-800 overflow-hidden">
            {(['7d', '30d', '90d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`
                  px-4 py-2 text-sm transition-colors
                  ${timeRange === range
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-900 text-gray-400 hover:bg-gray-800'}
                `}
              >
                {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
              </button>
            ))}
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { label: 'Total Tasks', value: analytics?.tasks.total || 0, color: 'from-blue-500 to-cyan-500', change: '+12%', changeType: 'up' },
            { label: 'Completed', value: analytics?.tasks.completed || 0, color: 'from-green-500 to-emerald-500', change: '+8%', changeType: 'up' },
            { label: 'Failed', value: analytics?.tasks.failed || 0, color: 'from-red-500 to-pink-500', change: '-5%', changeType: 'down' },
            { label: 'Avg Duration', value: `${((analytics?.tasks.averageDuration || 0) / 1000).toFixed(1)}s`, color: 'from-purple-500 to-indigo-500', change: '-15%', changeType: 'down' },
          ].map((stat) => (
            <div key={stat.label} className={`p-6 rounded-2xl bg-gradient-to-br ${stat.color} text-white`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-white/80 text-sm">{stat.label}</p>
                  <p className="text-3xl font-bold mt-1">{stat.value}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-1 text-sm">
                <span className={stat.changeType === 'up' ? 'text-green-200' : 'text-red-200'}>
                  {stat.changeType === 'up' ? '↑' : '↓'} {stat.change}
                </span>
                <span className="text-white/60">vs previous period</span>
              </div>
            </div>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Timeline Chart */}
          <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-6">
            <h2 className="text-lg font-semibold text-gray-100 mb-4">Task Activity</h2>
            <div className="h-64 flex items-end gap-2">
              {(analytics?.tasks.timeline || []).slice(0, 14).map((day, i) => {
                const maxCount = Math.max(...(analytics?.tasks.timeline || []).map((d) => d.count), 1);
                const height = (day.count / maxCount) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2">
                    <div
                      className="w-full bg-indigo-500 rounded-t transition-all hover:bg-indigo-400"
                      style={{ height: `${height}%`, minHeight: '4px' }}
                      title={`${day.date}: ${day.count} tasks`}
                    />
                    <span className="text-xs text-gray-500 -rotate-45 origin-left">
                      {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Task Distribution */}
          <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-6">
            <h2 className="text-lg font-semibold text-gray-100 mb-4">Task Distribution by Type</h2>
            <div className="space-y-4">
              {Object.entries(analytics?.tasks.byType || {}).map(([type, count]) => {
                const total = Object.values(analytics?.tasks.byType || {}).reduce((a, b) => a + b, 0) || 1;
                const percentage = (count / total) * 100;
                return (
                  <div key={type}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400 capitalize">{type}</span>
                      <span className="font-medium text-gray-100">{count}</span>
                    </div>
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Agent Performance Table */}
        <div className="bg-gray-900/50 rounded-2xl border border-gray-800 overflow-hidden">
          <div className="p-6 border-b border-gray-800">
            <h2 className="text-lg font-semibold text-gray-100">Agent Performance</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Agent</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Completed</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">In Progress</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Failed</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Avg Response</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Tokens Used</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Success Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {agentStats.map((agent) => {
                  const total = agent.tasksCompleted + agent.tasksFailed;
                  const successRate = total > 0 ? (agent.tasksCompleted / total) * 100 : 100;
                  return (
                    <tr key={agent.name} className="hover:bg-gray-800/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold">
                            {agent.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-medium text-gray-100">{agent.name}</div>
                            <div className="text-sm text-gray-500 capitalize">{agent.role}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-100">{agent.tasksCompleted}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-100">{agent.tasksInProgress}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-100">{agent.tasksFailed}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-100">{agent.avgResponseTime}ms</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-100">{(agent.tokensUsed / 1000).toFixed(1)}K</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                successRate >= 90 ? 'bg-green-500' :
                                successRate >= 70 ? 'bg-yellow-500' :
                                'bg-red-500'
                              }`}
                              style={{ width: `${successRate}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-100">{successRate.toFixed(0)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
