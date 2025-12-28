/**
 * KOSMOS AEOS Action Node
 * Generic action node for various operations
 */

'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import {
  Cog,
  Send,
  Database,
  Globe,
  FileText,
  Mail,
  Bell,
  Code,
  Calculator,
  Filter,
  Shuffle,
  Upload,
  Download,
  Lock,
  Unlock,
} from 'lucide-react';

export type ActionType =
  | 'transform'
  | 'api_call'
  | 'database'
  | 'http'
  | 'file'
  | 'email'
  | 'notification'
  | 'code'
  | 'calculate'
  | 'filter'
  | 'map'
  | 'upload'
  | 'download'
  | 'encrypt'
  | 'decrypt';

export interface ActionNodeData {
  label: string;
  actionType: ActionType;
  config?: Record<string, unknown>;
  input?: string;
  output?: string;
}

const actionIcons: Record<ActionType, React.ElementType> = {
  transform: Cog,
  api_call: Send,
  database: Database,
  http: Globe,
  file: FileText,
  email: Mail,
  notification: Bell,
  code: Code,
  calculate: Calculator,
  filter: Filter,
  map: Shuffle,
  upload: Upload,
  download: Download,
  encrypt: Lock,
  decrypt: Unlock,
};

const actionColors: Record<ActionType, string> = {
  transform: 'from-gray-500 to-gray-600',
  api_call: 'from-blue-500 to-blue-600',
  database: 'from-emerald-500 to-emerald-600',
  http: 'from-sky-500 to-sky-600',
  file: 'from-amber-500 to-amber-600',
  email: 'from-red-500 to-red-600',
  notification: 'from-orange-500 to-orange-600',
  code: 'from-violet-500 to-violet-600',
  calculate: 'from-indigo-500 to-indigo-600',
  filter: 'from-teal-500 to-teal-600',
  map: 'from-pink-500 to-pink-600',
  upload: 'from-green-500 to-green-600',
  download: 'from-cyan-500 to-cyan-600',
  encrypt: 'from-rose-500 to-rose-600',
  decrypt: 'from-fuchsia-500 to-fuchsia-600',
};

export const ActionNode = memo(({ data, selected }: NodeProps<ActionNodeData>) => {
  const Icon = actionIcons[data.actionType] || Cog;
  const colorClass = actionColors[data.actionType] || actionColors.transform;

  return (
    <div
      className={`
        relative rounded-lg shadow-lg min-w-[180px]
        ${selected ? 'ring-2 ring-blue-400' : ''}
        bg-gradient-to-br ${colorClass}
        transition-all duration-200 hover:shadow-xl
      `}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-white !border-2 !border-blue-400"
      />

      {/* Node Header */}
      <div className="px-4 py-3 flex items-center gap-3">
        <div className="p-2 bg-white/20 rounded-lg">
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <div className="text-xs font-medium text-white/70 uppercase tracking-wide">
            Action
          </div>
          <div className="text-sm font-semibold text-white truncate">
            {data.label}
          </div>
        </div>
      </div>

      {/* Action Type Badge */}
      <div className="px-4 pb-2">
        <span className="inline-flex items-center gap-1 text-xs bg-white/20 text-white rounded-full px-2 py-0.5 capitalize">
          {data.actionType.replace('_', ' ')}
        </span>
      </div>

      {/* Input/Output Preview */}
      {(data.input || data.output) && (
        <div className="px-4 pb-3 space-y-1">
          {data.input && (
            <div className="text-xs text-white/70">
              <span className="text-white/50">Input:</span> {data.input}
            </div>
          )}
          {data.output && (
            <div className="text-xs text-white/70">
              <span className="text-white/50">Output:</span> {data.output}
            </div>
          )}
        </div>
      )}

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-white !border-2 !border-blue-400"
      />
    </div>
  );
});

ActionNode.displayName = 'ActionNode';

export default ActionNode;
