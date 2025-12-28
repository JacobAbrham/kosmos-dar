'use client';

/**
 * KOSMOS AEOS Workflows Page
 * Workflow listing and management
 */

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { workflowService, Workflow, WorkflowStatus } from '@/services/workflow.service';

export default function WorkflowsPage() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<WorkflowStatus | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Load workflows
  useEffect(() => {
    const loadWorkflows = async () => {
      try {
        const response = await workflowService.list({ limit: 50 });
        setWorkflows(response.items);
      } catch (error) {
        console.error('Failed to load workflows:', error);
      } finally {
        setLoading(false);
      }
    };

    loadWorkflows();
  }, []);

  // Filter workflows
  const filteredWorkflows = workflows.filter((wf) => {
    if (statusFilter !== 'all' && wf.status !== statusFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return wf.name.toLowerCase().includes(term) || wf.description.toLowerCase().includes(term);
    }
    return true;
  });

  // Stats
  const stats = {
    total: workflows.length,
    active: workflows.filter((w) => w.status === 'active').length,
    draft: workflows.filter((w) => w.status === 'draft').length,
    paused: workflows.filter((w) => w.status === 'paused').length,
  };

  // Status colors
  const statusColors: Record<WorkflowStatus, string> = {
    draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    paused: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    archived: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };

  // Create new workflow
  const handleCreateWorkflow = async () => {
    try {
      const workflow = await workflowService.create({
        name: 'New Workflow',
        description: 'A new workflow',
      });
      router.push(`/workflows/${workflow.id}`);
    } catch (error) {
      console.error('Failed to create workflow:', error);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Workflows</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Create and manage automated workflows
          </p>
        </div>
        <button
          onClick={handleCreateWorkflow}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Workflow
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats.total, color: 'from-gray-500 to-gray-600' },
          { label: 'Active', value: stats.active, color: 'from-green-500 to-emerald-500' },
          { label: 'Draft', value: stats.draft, color: 'from-blue-500 to-cyan-500' },
          { label: 'Paused', value: stats.paused, color: 'from-yellow-500 to-orange-500' },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`p-4 rounded-xl bg-gradient-to-br ${stat.color} text-white`}
          >
            <p className="text-white/80 text-sm">{stat.label}</p>
            <p className="text-2xl font-bold mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Search */}
        <div className="flex-1">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search workflows..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as WorkflowStatus | 'all')}
          className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="paused">Paused</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {/* Workflow Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-48 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filteredWorkflows.length === 0 ? (
        <div className="text-center py-12">
          <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
            No workflows found
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {searchTerm || statusFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Create your first workflow to get started'}
          </p>
          <button
            onClick={handleCreateWorkflow}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Create Workflow
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredWorkflows.map((workflow) => (
            <div
              key={workflow.id}
              onClick={() => router.push(`/workflows/${workflow.id}`)}
              className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-all cursor-pointer group"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[workflow.status]}`}>
                  {workflow.status}
                </span>
              </div>

              {/* Content */}
              <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-500 transition-colors">
                {workflow.name}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                {workflow.description}
              </p>

              {/* Meta */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <span>{workflow.nodes.length} nodes</span>
                  <span>\u2022</span>
                  <span>v{workflow.version}</span>
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {new Date(workflow.updatedAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Templates Section */}
      <div className="mt-12">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Templates
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              name: 'Data Analysis Pipeline',
              description: 'Analyze data with Athena and generate reports',
              icon: '\u{1F4CA}',
              color: 'from-blue-500 to-cyan-500',
            },
            {
              name: 'Email Automation',
              description: 'Automated email responses with Hermes',
              icon: '\u{1F4E8}',
              color: 'from-green-500 to-emerald-500',
            },
            {
              name: 'Scheduled Reports',
              description: 'Generate and send reports on schedule with Chronos',
              icon: '\u23F0',
              color: 'from-purple-500 to-pink-500',
            },
          ].map((template) => (
            <button
              key={template.name}
              className="p-6 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-500 transition-colors text-left group"
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${template.color} flex items-center justify-center text-white text-2xl mb-4`}>
                {template.icon}
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-500 transition-colors">
                {template.name}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {template.description}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
