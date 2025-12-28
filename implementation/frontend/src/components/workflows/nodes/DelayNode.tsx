/**
 * KOSMOS AEOS Delay Node
 * Wait/delay node for timing operations
 */

'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Timer, Clock } from 'lucide-react';

export interface DelayNodeData {
  label: string;
  delayType: 'fixed' | 'dynamic' | 'until';
  duration?: number;
  unit?: 'seconds' | 'minutes' | 'hours' | 'days';
  untilTime?: string;
  untilCondition?: string;
}

const formatDuration = (duration: number, unit: string) => {
  if (unit === 'seconds') return `${duration}s`;
  if (unit === 'minutes') return `${duration}m`;
  if (unit === 'hours') return `${duration}h`;
  if (unit === 'days') return `${duration}d`;
  return `${duration}`;
};

export const DelayNode = memo(({ data, selected }: NodeProps<DelayNodeData>) => {
  return (
    <div
      className={`
        relative rounded-lg shadow-lg min-w-[160px]
        ${selected ? 'ring-2 ring-slate-400' : ''}
        bg-gradient-to-br from-slate-500 to-slate-600
        transition-all duration-200 hover:shadow-xl
      `}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-white !border-2 !border-slate-400"
      />

      {/* Node Header */}
      <div className="px-4 py-3 flex items-center gap-3">
        <div className="p-2 bg-white/20 rounded-lg">
          <Timer className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <div className="text-xs font-medium text-white/70 uppercase tracking-wide">
            Delay
          </div>
          <div className="text-sm font-semibold text-white truncate">
            {data.label}
          </div>
        </div>
      </div>

      {/* Delay Config */}
      <div className="px-4 pb-3">
        {data.delayType === 'fixed' && data.duration && data.unit && (
          <div className="flex items-center gap-2 text-sm text-white/90 bg-white/10 rounded px-2 py-1">
            <Clock className="w-3 h-3" />
            <span className="font-mono">
              {formatDuration(data.duration, data.unit)}
            </span>
          </div>
        )}
        {data.delayType === 'until' && data.untilTime && (
          <div className="text-xs text-white/70 bg-white/10 rounded px-2 py-1">
            Until: {data.untilTime}
          </div>
        )}
        {data.delayType === 'dynamic' && (
          <div className="text-xs text-white/70 bg-white/10 rounded px-2 py-1">
            Dynamic delay
          </div>
        )}
      </div>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-white !border-2 !border-slate-400"
      />
    </div>
  );
});

DelayNode.displayName = 'DelayNode';

export default DelayNode;
