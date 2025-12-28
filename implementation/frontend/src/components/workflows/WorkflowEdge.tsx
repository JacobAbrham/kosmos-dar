/**
 * KOSMOS AEOS Workflow Edge
 * Custom edge component for workflow connections
 */

'use client';

import React, { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
} from 'reactflow';
import { X, Zap } from 'lucide-react';

export interface WorkflowEdgeData {
  label?: string;
  condition?: string;
  animated?: boolean;
  style?: 'bezier' | 'smoothstep' | 'straight';
  color?: string;
}

export const WorkflowEdge = memo(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
}: EdgeProps<WorkflowEdgeData>) => {
  const style = data?.style || 'bezier';

  // Get path based on style
  const getPath = () => {
    const params = {
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    };

    switch (style) {
      case 'smoothstep':
        return getSmoothStepPath(params);
      case 'straight':
        return getStraightPath(params);
      default:
        return getBezierPath(params);
    }
  };

  const [edgePath, labelX, labelY] = getPath();

  const edgeColor = data?.color || (selected ? '#3b82f6' : '#94a3b8');

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: edgeColor,
          strokeWidth: selected ? 3 : 2,
          transition: 'stroke 0.2s, stroke-width 0.2s',
          ...(data?.animated && {
            strokeDasharray: '5,5',
            animation: 'dash 0.5s linear infinite',
          }),
        }}
      />

      {/* Edge Label */}
      {(data?.label || data?.condition) && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <div
              className={`
                px-2 py-1 rounded text-xs font-medium
                ${selected
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                }
                shadow-sm border border-gray-200 dark:border-gray-700
                flex items-center gap-1
              `}
            >
              {data?.animated && <Zap className="w-3 h-3" />}
              {data?.label || data?.condition}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

WorkflowEdge.displayName = 'WorkflowEdge';

// Animated edge for active connections
export const AnimatedEdge = memo((props: EdgeProps<WorkflowEdgeData>) => (
  <WorkflowEdge {...props} data={{ ...props.data, animated: true }} />
));

AnimatedEdge.displayName = 'AnimatedEdge';

// Conditional edge with true/false styling
export const ConditionalEdge = memo(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  sourceHandleId,
}: EdgeProps<WorkflowEdgeData>) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const isTrue = sourceHandleId === 'true';
  const color = isTrue ? '#22c55e' : '#ef4444';

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: color,
          strokeWidth: selected ? 3 : 2,
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all',
          }}
        >
          <div
            className={`
              px-2 py-0.5 rounded-full text-xs font-medium text-white
              ${isTrue ? 'bg-green-500' : 'bg-red-500'}
            `}
          >
            {isTrue ? 'Yes' : 'No'}
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
});

ConditionalEdge.displayName = 'ConditionalEdge';

// Edge types registry
export const edgeTypes = {
  default: WorkflowEdge,
  animated: AnimatedEdge,
  conditional: ConditionalEdge,
};

export default WorkflowEdge;
