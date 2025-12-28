/**
 * KOSMOS AEOS Workflow Canvas
 * React Flow canvas for workflow node visualization
 */

'use client';

import React, { useCallback, useRef, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Connection,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  ReactFlowProvider,
  ReactFlowInstance,
  OnConnect,
  OnNodesChange,
  OnEdgesChange,
  BackgroundVariant,
  SelectionMode,
} from 'reactflow';
import 'reactflow/dist/style.css';

import TriggerNode from './nodes/TriggerNode';
import AgentNode from './nodes/AgentNode';
import ConditionNode from './nodes/ConditionNode';
import LoopNode from './nodes/LoopNode';
import ActionNode from './nodes/ActionNode';
import DelayNode from './nodes/DelayNode';
import ParallelNode from './nodes/ParallelNode';
import EndNode from './nodes/EndNode';
import { edgeTypes } from './WorkflowEdge';

// Register custom node types
const nodeTypes = {
  trigger: TriggerNode,
  agent: AgentNode,
  condition: ConditionNode,
  loop: LoopNode,
  action: ActionNode,
  delay: DelayNode,
  parallel: ParallelNode,
  end: EndNode,
};

export interface WorkflowCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  onNodeSelect?: (node: Node | null) => void;
  onDrop?: (event: React.DragEvent, position: { x: number; y: number }) => void;
  onDragOver?: (event: React.DragEvent) => void;
  showMinimap?: boolean;
  showControls?: boolean;
  showBackground?: boolean;
  backgroundVariant?: BackgroundVariant;
  isLocked?: boolean;
  className?: string;
}

export const WorkflowCanvas: React.FC<WorkflowCanvasProps> = ({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeSelect,
  onDrop,
  onDragOver,
  showMinimap = true,
  showControls = true,
  showBackground = true,
  backgroundVariant = BackgroundVariant.Dots,
  isLocked = false,
  className = '',
}) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onNodeSelect?.(node);
    },
    [onNodeSelect]
  );

  const handlePaneClick = useCallback(() => {
    onNodeSelect?.(null);
  }, [onNodeSelect]);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      if (!reactFlowInstance || !reactFlowWrapper.current) return;

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      onDrop?.(event, position);
    },
    [reactFlowInstance, onDrop]
  );

  const handleDragOver = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      onDragOver?.(event);
    },
    [onDragOver]
  );

  return (
    <div ref={reactFlowWrapper} className={`flex-1 h-full ${className}`}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={isLocked ? undefined : onNodesChange}
        onEdgesChange={isLocked ? undefined : onEdgesChange}
        onConnect={isLocked ? undefined : onConnect}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onInit={setReactFlowInstance}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        snapToGrid
        snapGrid={[15, 15]}
        selectionMode={SelectionMode.Partial}
        deleteKeyCode={isLocked ? null : ['Backspace', 'Delete']}
        multiSelectionKeyCode={['Shift']}
        panOnScroll
        zoomOnScroll
        panOnDrag={[1, 2]}
        selectNodesOnDrag={false}
        nodesDraggable={!isLocked}
        nodesConnectable={!isLocked}
        elementsSelectable={!isLocked}
        className="bg-gray-50 dark:bg-gray-900"
      >
        {showBackground && (
          <Background
            variant={backgroundVariant}
            gap={20}
            size={1}
            color="#e5e7eb"
            className="dark:!bg-gray-900"
          />
        )}

        {showControls && (
          <Controls
            position="bottom-right"
            showZoom
            showFitView
            showInteractive={!isLocked}
            className="!bg-white dark:!bg-gray-800 !rounded-lg !shadow-lg !border !border-gray-200 dark:!border-gray-700"
          />
        )}

        {showMinimap && (
          <MiniMap
            position="bottom-left"
            nodeColor={(node) => {
              switch (node.type) {
                case 'trigger':
                  return '#22c55e';
                case 'agent':
                  return '#3b82f6';
                case 'condition':
                  return '#f59e0b';
                case 'loop':
                  return '#8b5cf6';
                case 'action':
                  return '#6b7280';
                case 'delay':
                  return '#64748b';
                case 'parallel':
                  return '#06b6d4';
                case 'end':
                  return '#ef4444';
                default:
                  return '#9ca3af';
              }
            }}
            maskColor="rgba(0, 0, 0, 0.1)"
            className="!bg-white dark:!bg-gray-800 !rounded-lg !shadow-lg !border !border-gray-200 dark:!border-gray-700"
          />
        )}
      </ReactFlow>
    </div>
  );
};

// Wrapper with provider
export const WorkflowCanvasWithProvider: React.FC<WorkflowCanvasProps> = (props) => {
  return (
    <ReactFlowProvider>
      <WorkflowCanvas {...props} />
    </ReactFlowProvider>
  );
};

export default WorkflowCanvasWithProvider;
