/**
 * KOSMOS AEOS Trigger Node
 * Start node for workflow execution
 */

'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Play, Clock, Calendar, Webhook, Mail, MessageSquare } from 'lucide-react';

export interface TriggerNodeData {
  label: string;
  triggerType: 'manual' | 'schedule' | 'webhook' | 'email' | 'event' | 'message';
  config?: {
    schedule?: string;
    webhookUrl?: string;
    eventType?: string;
  };
}

const triggerIcons = {
  manual: Play,
  schedule: Clock,
  webhook: Webhook,
  email: Mail,
  event: Calendar,
  message: MessageSquare,
};

const triggerColors = {
  manual: 'from-green-500 to-green-600',
  schedule: 'from-blue-500 to-blue-600',
  webhook: 'from-purple-500 to-purple-600',
  email: 'from-orange-500 to-orange-600',
  event: 'from-pink-500 to-pink-600',
  message: 'from-cyan-500 to-cyan-600',
};

export const TriggerNode = memo(({ data, selected }: NodeProps<TriggerNodeData>) => {
  const Icon = triggerIcons[data.triggerType] || Play;
  const colorClass = triggerColors[data.triggerType] || triggerColors.manual;

  return (
    <div
      className={`
        relative rounded-lg shadow-lg min-w-[180px]
        ${selected ? 'ring-2 ring-green-400' : ''}
        bg-gradient-to-br ${colorClass}
        transition-all duration-200 hover:shadow-xl
      `}
    >
      {/* Node Header */}
      <div className="px-4 py-3 flex items-center gap-2">
        <div className="p-2 bg-white/20 rounded-lg">
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <div className="text-xs font-medium text-white/70 uppercase tracking-wide">
            Trigger
          </div>
          <div className="text-sm font-semibold text-white truncate">
            {data.label}
          </div>
        </div>
      </div>

      {/* Trigger Config Preview */}
      {data.config?.schedule && (
        <div className="px-4 pb-3">
          <div className="text-xs text-white/70 bg-white/10 rounded px-2 py-1">
            {data.config.schedule}
          </div>
        </div>
      )}

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-white !border-2 !border-green-400"
      />
    </div>
  );
});

TriggerNode.displayName = 'TriggerNode';

export default TriggerNode;
