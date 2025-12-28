'use client';

import { FolderOpen, Upload, Search, Grid, List } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export function FilesCanvas() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Files</h1>
            <p className="text-gray-400 mt-1">Document storage and management</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center bg-white/[0.04] rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  "p-2 rounded transition-colors",
                  viewMode === 'grid' ? "bg-white/[0.1] text-white" : "text-gray-400"
                )}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  "p-2 rounded transition-colors",
                  viewMode === 'list' ? "bg-white/[0.1] text-white" : "text-gray-400"
                )}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors">
              <Upload className="w-4 h-4" />
              Upload
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search files..."
            className="w-full pl-10 pr-4 py-3 bg-white/[0.04] border border-white/[0.06] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-8">
          <div className="text-center py-16">
            <FolderOpen className="w-16 h-16 mx-auto mb-4 text-cyan-400 opacity-50" />
            <h3 className="text-lg font-semibold text-white mb-2">No files yet</h3>
            <p className="text-gray-400 mb-6">
              Upload documents to your knowledge base
            </p>
            <button className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors">
              Upload Files
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FilesCanvas;
