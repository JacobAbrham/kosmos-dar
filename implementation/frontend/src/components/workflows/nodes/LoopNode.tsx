/**
 * KOSMOS AEOS Loop Node
 * Iteration node for repeating actions
 */

'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Repeat, IterationCw } from 'lucide-react';

export interface LoopNodeData {
  label: string;
  loopType: 'for' | 'while' | 'forEach' | 'until';
  iterations?: number;
  collection?: string;
  condition?: string;
  currentItem?: string;
}

const loopLabels = {
  for: 'For Loop',
  while: 'While Loop',
  forEach: 'For Each',
  until: 'Until',
};

export const LoopNode = memo(({ data, selected }: NodeProps<LoopNodeData>) => {
  return (
    <div
      className={`
        relative rounded-lg shadow-lg min-w-[180px]
        ${selected ? 'ring-2 ring-purple-400' : ''}
        bg-gradient-to-br from-purple-500 to-violet-600
        transition-all duration-200 hover:shadow-xl
      `}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-white !border-2 !border-purple-400"
      />

      {/* Node Header */}
      <div className="px-4 py-3 flex items-center gap-3">
        <div className="p-2 bg-white/20 rounded-lg">
          <Repeat className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <div className="text-xs font-medium text-white/70 uppercase tracking-wide">
            {loopLabels[data.loopType]}
          </div>
          <div className="text-sm font-semibold text-white truncate">
            {data.label}
          </div>
        </div>
      </div>

      {/* Loop Config */}
      <div className="px-4 pb-3 space-y-1">
        {data.loopType === 'for' && data.iterations && (
          <div className="flex items-center gap-2 text-xs text-white/70">
            <IterationCw className="w-3 h-3" />
            <span>{data.iterations} iterations</span>
          </div>
        )}
        {data.loopType === 'forEach' && data.collection && (
          <div className="text-xs text-white/70 bg-white/10 rounded px-2 py-1">
            each {data.currentItem || 'item'} in {data.collection}
          </div>
        )}
        {(data.loopType === 'while' || data.loopType === 'until') && data.condition && (
          <div className="text-xs text-white/70 bg-white/10 rounded px-2 py-1">
            {data.condition}
          </div>
        )}
      </div>

      {/* Loop Body Handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="body"
        className="!w-3 !h-3 !bg-white !border-2 !border-purple-400"
        style={{ top: '50%' }}
      />
      <div className="absolute right-[-32px] top-1/2 -translate-y-1/2">
        <span className="text-[10px] text-purple-600 dark:text-purple-400 font-medium">
          Body
        </span>
      </div>

      {/* Loop Back Handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="back"
        className="!w-3 !h-3 !bg-purple-300 !border-2 !border-purple-400"
        style={{ top: '50%' }}
      />
      <div className="absolute left-[-32px] top-1/2 -translate-y-1/2">
        <span className="text-[10px] text-purple-600 dark:text-purple-400 font-medium">
          Back
        </span>
      </div>

      {/* Exit Handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="exit"
        className="!w-3 !h-3 !bg-white !border-2 !border-purple-400"
      />
      <div className="absolute bottom-[-20px] left-1/2 -translate-x-1/2">
        <span className="text-[10px] text-purple-600 dark:text-purple-400 font-medium">
          Done
        </span>
      </div>
    </div>
  );
});

LoopNode.displayName = 'LoopNode';

export default LoopNode;
