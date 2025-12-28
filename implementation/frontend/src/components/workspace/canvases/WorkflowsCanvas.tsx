'use client';

import { GitBranch, Plus, Play, Pause } from 'lucide-react';

export function WorkflowsCanvas() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Workflows</h1>
            <p className="text-gray-400 mt-1">Automate tasks with visual workflows</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors">
            <Plus className="w-4 h-4" />
            New Workflow
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
            <div className="text-2xl font-bold text-white">0</div>
            <div className="text-sm text-gray-400">Active Workflows</div>
          </div>
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
            <div className="text-2xl font-bold text-white">0</div>
            <div className="text-sm text-gray-400">Executions Today</div>
          </div>
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
            <div className="text-2xl font-bold text-white">--</div>
            <div className="text-sm text-gray-400">Success Rate</div>
          </div>
        </div>

        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-8">
          <div className="text-center py-16">
            <GitBranch className="w-16 h-16 mx-auto mb-4 text-purple-400 opacity-50" />
            <h3 className="text-lg font-semibold text-white mb-2">No workflows yet</h3>
            <p className="text-gray-400 mb-6">
              Create automated workflows to streamline your operations
            </p>
            <button className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors">
              Create First Workflow
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WorkflowsCanvas;
