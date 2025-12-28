'use client';

/**
 * KOSMOS AEOS Agent Detail Page
 * Individual agent view with chat, config, and monitoring
 */

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAgentContext } from '@/context/AgentContext';
import { useAgent } from '@/hooks/useAgent';
import { AgentStatusCard } from '@/components/agents/AgentStatus';
import { AgentChat } from '@/components/agents/AgentChat';
import { AgentConfigPanel } from '@/components/agents/AgentConfig';

type Tab = 'chat' | 'config' | 'logs' | 'metrics';

export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params?.id as string;

  const { getAgent, refreshHealth } = useAgentContext();
  const agent = getAgent(agentId);

  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const { agent: agentDetails, health, loading, error } = useAgent({
    agentId,
    autoLoad: true,
  });

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="h-4 w-96 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-96 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse" />
          <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
            Agent not found
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            The agent you&apos;re looking for doesn&apos;t exist or has been removed.
          </p>
          <button
            onClick={() => router.push('/agents')}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Back to Agents
          </button>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'chat', label: 'Chat', icon: '\u{1F4AC}' },
    { id: 'config', label: 'Configuration', icon: '\u2699\uFE0F' },
    { id: 'logs', label: 'Logs', icon: '\u{1F4DD}' },
    { id: 'metrics', label: 'Metrics', icon: '\u{1F4CA}' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/agents')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold">
              {agent.name.charAt(0)}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {agent.name}
              </h1>
              <p className="text-gray-500 dark:text-gray-400 capitalize">
                {agent.role} Agent
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className={`
            inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium
            ${agent.status === 'idle' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
              agent.status === 'busy' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
              agent.status === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
              'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'}
          `}>
            <span className={`w-2 h-2 rounded-full ${
              agent.status === 'idle' ? 'bg-green-500' :
              agent.status === 'busy' ? 'bg-yellow-500 animate-pulse' :
              agent.status === 'error' ? 'bg-red-500' :
              'bg-gray-500'
            }`} />
            {agent.status}
          </span>
          <button
            onClick={() => refreshHealth()}
            className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            title="Refresh"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-4 -mb-px">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-colors
                ${activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'}
              `}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2">
          {activeTab === 'chat' && (
            <AgentChat
              agentId={agentId}
              showToolCalls
              showTimestamps
              maxHeight="600px"
            />
          )}

          {activeTab === 'config' && (
            <AgentConfigPanel
              agentId={agentId}
              onSave={() => {
                // Optionally refresh after save
              }}
            />
          )}

          {activeTab === 'logs' && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Agent Logs
              </h2>
              <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm text-gray-300 h-96 overflow-y-auto">
                <div className="space-y-2">
                  {[
                    { time: '12:34:56', level: 'INFO', message: 'Agent initialized successfully' },
                    { time: '12:34:57', level: 'DEBUG', message: 'Loading configuration...' },
                    { time: '12:34:58', level: 'INFO', message: 'Connected to MCP gateway' },
                    { time: '12:35:01', level: 'DEBUG', message: 'Registered 5 tools' },
                    { time: '12:35:05', level: 'INFO', message: 'Ready to accept requests' },
                  ].map((log, i) => (
                    <div key={i} className="flex gap-4">
                      <span className="text-gray-500">{log.time}</span>
                      <span className={`w-14 ${
                        log.level === 'INFO' ? 'text-blue-400' :
                        log.level === 'DEBUG' ? 'text-gray-500' :
                        log.level === 'WARN' ? 'text-yellow-400' :
                        'text-red-400'
                      }`}>
                        [{log.level}]
                      </span>
                      <span>{log.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'metrics' && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Performance Metrics
              </h2>
              <div className="grid grid-cols-2 gap-6">
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Avg Response Time</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {agent.stats.averageResponseTime}ms
                  </p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Tokens Used</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {(agent.stats.tokensUsed / 1000).toFixed(1)}K
                  </p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Success Rate</p>
                  <p className="text-2xl font-bold text-green-600">
                    {agent.stats.tasksCompleted + agent.stats.tasksFailed > 0
                      ? ((agent.stats.tasksCompleted / (agent.stats.tasksCompleted + agent.stats.tasksFailed)) * 100).toFixed(1)
                      : 100}%
                  </p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Uptime</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {Math.floor(agent.stats.uptime / 3600)}h {Math.floor((agent.stats.uptime % 3600) / 60)}m
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Card */}
          <AgentStatusCard
            agentId={agentId}
            showHealth
            showStats
          />

          {/* Capabilities */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Capabilities
            </h3>
            <div className="flex flex-wrap gap-2">
              {agent.capabilities.map((cap) => (
                <span
                  key={cap}
                  className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-sm rounded-full"
                >
                  {cap.replace('_', ' ')}
                </span>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Actions
            </h3>
            <div className="space-y-2">
              <button className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors flex items-center gap-3">
                <span className="text-green-500">\u25B6</span>
                <span>Start Agent</span>
              </button>
              <button className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors flex items-center gap-3">
                <span className="text-yellow-500">\u23F8</span>
                <span>Pause Agent</span>
              </button>
              <button className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors flex items-center gap-3">
                <span className="text-blue-500">\u21BB</span>
                <span>Restart Agent</span>
              </button>
              <button className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors flex items-center gap-3 text-red-500">
                <span>\u23F9</span>
                <span>Stop Agent</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
