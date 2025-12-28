'use client';

import { MessageSquare, Search, Plus } from 'lucide-react';
import { DashboardShell } from '@/components/DashboardShell';

export default function ConversationsPage() {
  return (
    <DashboardShell title="Conversations" subtitle="View and manage your agent conversations">
      <div className="p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-100">Conversations</h1>
              <p className="text-gray-400 mt-1">View and manage your agent conversations</p>
            </div>
            <button className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors">
              <Plus className="w-4 h-4" />
              New Conversation
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              className="w-full pl-10 pr-4 py-3 bg-gray-900 border border-gray-800 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Empty State */}
          <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-800 mb-4">
              <MessageSquare className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-100 mb-2">No conversations yet</h3>
            <p className="text-gray-400 mb-6">Start a new conversation with KOSMOS to get started</p>
            <button className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors">
              <Plus className="w-4 h-4" />
              Start Conversation
            </button>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
