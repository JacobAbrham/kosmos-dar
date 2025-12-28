/**
 * KOSMOS AEOS Condition Node
 * Branching node for if/else logic
 */

'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { GitBranch, Check, X } from 'lucide-react';

export interface ConditionNodeData {
  label: string;
  condition: string;
  operator?: 'equals' | 'contains' | 'greater' | 'less' | 'exists' | 'custom';
  leftValue?: string;
  rightValue?: string;
}

export const ConditionNode = memo(({ data, selected }: NodeProps<ConditionNodeData>) => {
  return (
    <div
      className={`
        relative min-w-[180px]
        ${selected ? 'ring-2 ring-yellow-400' : ''}
        transition-all duration-200
      `}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-white !border-2 !border-yellow-400"
      />

      {/* Diamond Shape Container */}
      <div className="relative flex items-center justify-center">
        {/* Diamond Background */}
        <div
          className="w-32 h-32 bg-gradient-to-br from-yellow-500 to-amber-600 shadow-lg rotate-45 rounded-lg"
        />

        {/* Content Overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="p-2 bg-white/20 rounded-lg mb-1">
            <GitBranch className="w-5 h-5 text-white" />
          </div>
          <div className="text-xs font-medium text-white/70 uppercase tracking-wide">
            Condition
          </div>
          <div className="text-sm font-semibold text-white text-center px-4 truncate max-w-[120px]">
            {data.label}
          </div>
        </div>
      </div>

      {/* Condition Preview */}
      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-full text-center">
        <div className="text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded px-2 py-1 inline-block shadow">
          {data.condition || 'No condition set'}
        </div>
      </div>

      {/* True Output Handle (Left) */}
      <Handle
        type="source"
        position={Position.Left}
        id="true"
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-white"
        style={{ top: '50%' }}
      />
      <div className="absolute left-[-24px] top-1/2 -translate-y-1/2 flex items-center gap-1">
        <Check className="w-3 h-3 text-green-500" />
        <span className="text-[10px] text-green-600 font-medium">Yes</span>
      </div>

      {/* False Output Handle (Right) */}
      <Handle
        type="source"
        position={Position.Right}
        id="false"
        className="!w-3 !h-3 !bg-red-500 !border-2 !border-white"
        style={{ top: '50%' }}
      />
      <div className="absolute right-[-20px] top-1/2 -translate-y-1/2 flex items-center gap-1">
        <span className="text-[10px] text-red-600 font-medium">No</span>
        <X className="w-3 h-3 text-red-500" />
      </div>
    </div>
  );
});

ConditionNode.displayName = 'ConditionNode';

export default ConditionNode;
