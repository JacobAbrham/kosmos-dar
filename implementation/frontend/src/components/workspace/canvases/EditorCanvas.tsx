'use client';

import { Code, FileCode, Terminal, GitBranch } from 'lucide-react';

export function EditorCanvas() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Editor</h1>
          <p className="text-gray-400 mt-1">Code and document editing with Hephaestus</p>
        </div>

        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-8">
          <div className="text-center py-16">
            <Code className="w-16 h-16 mx-auto mb-4 text-orange-400 opacity-50" />
            <h3 className="text-lg font-semibold text-white mb-2">Code Editor</h3>
            <p className="text-gray-400 mb-6">
              AI-powered code editing and generation
            </p>
            <div className="flex justify-center gap-4">
              <button className="flex items-center gap-2 px-4 py-2 bg-white/[0.06] hover:bg-white/[0.1] text-white rounded-lg transition-colors">
                <FileCode className="w-4 h-4" />
                New File
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-white/[0.06] hover:bg-white/[0.1] text-white rounded-lg transition-colors">
                <Terminal className="w-4 h-4" />
                Terminal
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-white/[0.06] hover:bg-white/[0.1] text-white rounded-lg transition-colors">
                <GitBranch className="w-4 h-4" />
                Git
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EditorCanvas;
