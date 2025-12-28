'use client';

import { Database, Upload, Search, FolderOpen } from 'lucide-react';
import { DashboardShell } from '@/components/DashboardShell';

export default function KnowledgePage() {
  return (
    <DashboardShell title="Knowledge Base" subtitle="Manage documents with MEMORIX">
      <div className="p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-100">Knowledge Base</h1>
              <p className="text-gray-400 mt-1">Manage documents and data sources for MEMORIX</p>
            </div>
            <button className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-medium rounded-lg transition-colors">
              <Upload className="w-4 h-4" />
              Upload Documents
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search knowledge base..."
              className="w-full pl-10 pr-4 py-3 bg-gray-900 border border-gray-800 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-4">
              <div className="text-2xl font-bold text-cyan-400">0</div>
              <div className="text-sm text-gray-400">Documents</div>
            </div>
            <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-4">
              <div className="text-2xl font-bold text-cyan-400">0</div>
              <div className="text-sm text-gray-400">Data Sources</div>
            </div>
            <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-4">
              <div className="text-2xl font-bold text-cyan-400">0 MB</div>
              <div className="text-sm text-gray-400">Storage Used</div>
            </div>
          </div>

          {/* Empty State */}
          <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-cyan-500/20 mb-4">
              <Database className="w-8 h-8 text-cyan-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-100 mb-2">No documents yet</h3>
            <p className="text-gray-400 mb-6">
              Upload documents or connect data sources to build your knowledge base
            </p>
            <div className="flex gap-3 justify-center">
              <button className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-medium rounded-lg transition-colors">
                <Upload className="w-4 h-4" />
                Upload Files
              </button>
              <button className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors">
                <FolderOpen className="w-4 h-4" />
                Connect Source
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
