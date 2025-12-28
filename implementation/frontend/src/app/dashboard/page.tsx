'use client';

/**
 * KOSMOS AEOS Dashboard Page
 * Main dashboard with system overview and quick actions
 */

import React, { useEffect, useState } from 'react';
import { useAgentContext } from '@/context/AgentContext';
import { AllAgentsStatus } from '@/components/agents/AgentStatus';
import { AgentChat } from '@/components/agents/AgentChat';
import { taskService, Task, TaskStatus } from '@/services/task.service';

export default function DashboardPage() {
  const { agents, loading: agentsLoading, activeSession, startSession } = useAgentContext();
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<number>(0);
  const [tasksLoading, setTasksLoading] = useState(true);

  // Load dashboard data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [tasks, approvals] = await Promise.all([
          taskService.getRecentTasks(5),
          taskService.getPendingApprovals({ limit: 1 }),
        ]);
        setRecentTasks(tasks);
        setPendingApprovals(approvals.total);
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setTasksLoading(false);
      }
    };

    loadData();
  }, []);

  // Quick stats
  const stats = [
    {
      label: 'Active Agents',
      value: agents.filter((a) => a.status === 'idle' || a.status === 'busy').length,
      total: agents.length,
      icon: '\u{1F916}',
      color: 'from-blue-500 to-cyan-500',
    },
    {
      label: 'Tasks Today',
      value: recentTasks.filter((t) => {
        const today = new Date().toDateString();
        return new Date(t.createdAt).toDateString() === today;
      }).length,
      icon: '\u2705',
      color: 'from-green-500 to-emerald-500',
    },
    {
      label: 'Pending Approvals',
      value: pendingApprovals,
      icon: '\u23F3',
      color: 'from-yellow-500 to-orange-500',
      urgent: pendingApprovals > 0,
    },
    {
      label: 'Active Workflows',
      value: recentTasks.filter((t) => t.status === 'running').length,
      icon: '\u{1F504}',
      color: 'from-purple-500 to-pink-500',
    },
  ];

  // Status colors for tasks
  const statusColors: Record<TaskStatus, string> = {
    pending: 'bg-gray-100 text-gray-700',
    queued: 'bg-blue-100 text-blue-700',
    running: 'bg-yellow-100 text-yellow-700',
    awaiting_approval: 'bg-orange-100 text-orange-700',
    completed: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
    cancelled: 'bg-gray-100 text-gray-500',
    paused: 'bg-purple-100 text-purple-700',
  };

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Welcome to KOSMOS AEOS - Your Agentic Operating System
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`
              relative overflow-hidden rounded-2xl p-6 text-white
              bg-gradient-to-br ${stat.color}
              ${stat.urgent ? 'ring-2 ring-offset-2 ring-yellow-400 animate-pulse' : ''}
            `}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-white/80 text-sm">{stat.label}</p>
                <p className="text-3xl font-bold mt-1">
                  {stat.value}
                  {stat.total !== undefined && (
                    <span className="text-lg font-normal text-white/60">
                      /{stat.total}
                    </span>
                  )}
                </p>
              </div>
              <span className="text-3xl opacity-50">{stat.icon}</span>
            </div>
            <div className="absolute bottom-0 right-0 w-20 h-20 bg-white/10 rounded-tl-full" />
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agent Status - 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Agent Overview */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Agent Status
              </h2>
              <a
                href="/agents"
                className="text-sm text-blue-500 hover:text-blue-600"
              >
                View All \u2192
              </a>
            </div>
            <AllAgentsStatus
              onAgentClick={(agentId) => {
                startSession(agentId);
              }}
            />
          </div>

          {/* Recent Tasks */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Recent Tasks
              </h2>
              <a
                href="/tasks"
                className="text-sm text-blue-500 hover:text-blue-600"
              >
                View All \u2192
              </a>
            </div>

            {tasksLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : recentTasks.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No recent tasks</p>
                <p className="text-sm mt-1">Start by asking an agent to help you</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <h3 className="font-medium text-gray-900 dark:text-white truncate">
                          {task.title}
                        </h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[task.status]}`}>
                          {task.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-1">
                        {task.description}
                      </p>
                    </div>
                    <div className="text-right text-sm text-gray-500 dark:text-gray-400 ml-4">
                      {new Date(task.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Chat - 1 column */}
        <div className="lg:col-span-1">
          <div className="sticky top-6">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Quick Chat
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Talk to Zeus, the orchestrator
              </p>
            </div>
            <AgentChat
              role="zeus"
              placeholder="Ask Zeus anything..."
              maxHeight="400px"
            />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'New Task', icon: '\u2795', href: '/tasks/new', color: 'bg-blue-500' },
            { label: 'View Workflows', icon: '\u{1F504}', href: '/workflows', color: 'bg-purple-500' },
            { label: 'Analytics', icon: '\u{1F4CA}', href: '/analytics', color: 'bg-green-500' },
            { label: 'Settings', icon: '\u2699\uFE0F', href: '/settings', color: 'bg-gray-500' },
          ].map((action) => (
            <a
              key={action.label}
              href={action.href}
              className="flex flex-col items-center gap-3 p-6 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <div className={`w-12 h-12 ${action.color} rounded-full flex items-center justify-center text-white text-xl`}>
                {action.icon}
              </div>
              <span className="font-medium text-gray-900 dark:text-white">
                {action.label}
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
