/**
 * KOSMOS AEOS End Node
 * Terminal node for workflow completion
 */

'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { StopCircle, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

export interface EndNodeData {
  label: string;
  endType: 'success' | 'failure' | 'conditional' | 'default';
  message?: string;
  returnValue?: string;
}

const endIcons = {
  success: CheckCircle,
  failure: XCircle,
  conditional: AlertTriangle,
  default: StopCircle,
};

const endColors = {
  success: 'from-green-500 to-emerald-600',
  failure: 'from-red-500 to-rose-600',
  conditional: 'from-yellow-500 to-amber-600',
  default: 'from-gray-500 to-slate-600',
};

export const EndNode = memo(({ data, selected }: NodeProps<EndNodeData>) => {
  const Icon = endIcons[data.endType] || StopCircle;
  const colorClass = endColors[data.endType] || endColors.default;

  return (
    <div
      className={`
        relative rounded-full shadow-lg
        ${selected ? 'ring-2 ring-offset-2 ring-gray-400' : ''}
        bg-gradient-to-br ${colorClass}
        transition-all duration-200 hover:shadow-xl
        w-24 h-24 flex flex-col items-center justify-center
      `}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-white !border-2 !border-gray-400"
      />

      {/* Icon */}
      <div className="p-2 bg-white/20 rounded-full mb-1">
        <Icon className="w-6 h-6 text-white" />
      </div>

      {/* Label */}
      <div className="text-xs font-semibold text-white text-center">
        {data.label || 'End'}
      </div>

      {/* Message tooltip indicator */}
      {data.message && (
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2">
          <div className="text-[10px] text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded px-2 py-0.5 shadow whitespace-nowrap">
            {data.message}
          </div>
        </div>
      )}
    </div>
  );
});

EndNode.displayName = 'EndNode';

export default EndNode;
