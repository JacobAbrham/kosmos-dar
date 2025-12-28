/**
 * KOSMOS AEOS Parallel Node
 * Node for parallel execution of multiple branches
 */

'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { GitFork, GitMerge } from 'lucide-react';

export interface ParallelNodeData {
  label: string;
  mode: 'fork' | 'join';
  branches?: number;
  waitAll?: boolean;
}

export const ParallelNode = memo(({ data, selected }: NodeProps<ParallelNodeData>) => {
  const isFork = data.mode === 'fork';
  const Icon = isFork ? GitFork : GitMerge;

  return (
    <div
      className={`
        relative rounded-lg shadow-lg min-w-[160px]
        ${selected ? 'ring-2 ring-cyan-400' : ''}
        bg-gradient-to-br from-cyan-500 to-teal-600
        transition-all duration-200 hover:shadow-xl
      `}
    >
      {/* Input Handle(s) */}
      {isFork ? (
        <Handle
          type="target"
          position={Position.Top}
          className="!w-3 !h-3 !bg-white !border-2 !border-cyan-400"
        />
      ) : (
        <>
          {/* Multiple input handles for join */}
          <Handle
            type="target"
            position={Position.Top}
            id="input-1"
            className="!w-3 !h-3 !bg-white !border-2 !border-cyan-400"
            style={{ left: '30%' }}
          />
          <Handle
            type="target"
            position={Position.Top}
            id="input-2"
            className="!w-3 !h-3 !bg-white !border-2 !border-cyan-400"
            style={{ left: '50%' }}
          />
          <Handle
            type="target"
            position={Position.Top}
            id="input-3"
            className="!w-3 !h-3 !bg-white !border-2 !border-cyan-400"
            style={{ left: '70%' }}
          />
        </>
      )}

      {/* Node Header */}
      <div className="px-4 py-3 flex items-center gap-3">
        <div className="p-2 bg-white/20 rounded-lg">
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <div className="text-xs font-medium text-white/70 uppercase tracking-wide">
            {isFork ? 'Parallel Fork' : 'Parallel Join'}
          </div>
          <div className="text-sm font-semibold text-white truncate">
            {data.label}
          </div>
        </div>
      </div>

      {/* Config */}
      <div className="px-4 pb-3">
        {isFork && data.branches && (
          <div className="text-xs text-white/70 bg-white/10 rounded px-2 py-1">
            {data.branches} parallel branches
          </div>
        )}
        {!isFork && (
          <div className="text-xs text-white/70 bg-white/10 rounded px-2 py-1">
            {data.waitAll ? 'Wait for all' : 'Continue on first'}
          </div>
        )}
      </div>

      {/* Output Handle(s) */}
      {isFork ? (
        <>
          {/* Multiple output handles for fork */}
          <Handle
            type="source"
            position={Position.Bottom}
            id="output-1"
            className="!w-3 !h-3 !bg-white !border-2 !border-cyan-400"
            style={{ left: '30%' }}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="output-2"
            className="!w-3 !h-3 !bg-white !border-2 !border-cyan-400"
            style={{ left: '50%' }}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="output-3"
            className="!w-3 !h-3 !bg-white !border-2 !border-cyan-400"
            style={{ left: '70%' }}
          />
        </>
      ) : (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-3 !h-3 !bg-white !border-2 !border-cyan-400"
        />
      )}
    </div>
  );
});

ParallelNode.displayName = 'ParallelNode';

export default ParallelNode;
