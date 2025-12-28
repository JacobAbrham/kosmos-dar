/**
 * KOSMOS AEOS Workflow Builder
 * Main workflow editor container with canvas, toolbar, and sidebar
 */

'use client';

import React, { useCallback, useState, useEffect } from 'react';
import {
  Node,
  Edge,
  Connection,
  addEdge,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange,
} from 'reactflow';

import WorkflowCanvas from './WorkflowCanvas';
import WorkflowToolbar from './WorkflowToolbar';
import WorkflowSidebar from './WorkflowSidebar';
import { useWorkflow } from '@/hooks/useWorkflow';
import { workflowService, Workflow, WorkflowNode, WorkflowNodeType, WorkflowEdge as WFEdge } from '@/services/workflow.service';

export interface WorkflowBuilderProps {
  workflowId?: string;
  initialNodes?: Node[];
  initialEdges?: Edge[];
  onSave?: (nodes: Node[], edges: Edge[]) => void;
  onRun?: () => void;
  readOnly?: boolean;
  className?: string;
}

// Generate unique node ID
const generateNodeId = () => `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Convert workflow nodes to React Flow nodes
const toReactFlowNodes = (workflowNodes: WorkflowNode[]): Node[] => {
  return workflowNodes.map((node) => ({
    id: node.id,
    type: node.type,
    position: node.position,
    data: node.data,
  }));
};

// Convert workflow edges to React Flow edges
const toReactFlowEdges = (workflowEdges: WFEdge[]): Edge[] => {
  return workflowEdges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    type: edge.type,
    data: edge.data,
    animated: edge.animated,
    label: edge.label,
  }));
};

export const WorkflowBuilder: React.FC<WorkflowBuilderProps> = ({
  workflowId,
  initialNodes = [],
  initialEdges = [],
  onSave,
  onRun,
  readOnly = false,
  className = '',
}) => {
  // State
  const [nodes, setNodes] = useNodesState(initialNodes);
  const [edges, setEdges] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLocked, setIsLocked] = useState(readOnly);
  const [showGrid, setShowGrid] = useState(true);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);

  // History for undo/redo
  const [history, setHistory] = useState<{ nodes: Node[]; edges: Edge[] }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Load workflow
  useEffect(() => {
    if (workflowId) {
      workflowService.get(workflowId).then((wf) => {
        setWorkflow(wf);
        // Convert workflow nodes/edges to React Flow format
        if (wf.nodes) {
          setNodes(toReactFlowNodes(wf.nodes));
        }
        if (wf.edges) {
          setEdges(toReactFlowEdges(wf.edges));
        }
      });
    }
  }, [workflowId, setNodes, setEdges]);

  // Save history for undo/redo
  const saveHistory = useCallback(() => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ nodes: [...nodes], edges: [...edges] });
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setIsDirty(true);
  }, [nodes, edges, history, historyIndex]);

  // Node changes handler
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
      if (changes.some((c) => c.type !== 'select')) {
        setIsDirty(true);
      }
    },
    [setNodes]
  );

  // Edge changes handler
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((eds) => applyEdgeChanges(changes, eds));
      if (changes.some((c) => c.type !== 'select')) {
        setIsDirty(true);
      }
    },
    [setEdges]
  );

  // Connection handler
  const onConnect = useCallback(
    (connection: Connection) => {
      const newEdge: Edge = {
        id: `edge_${connection.source}_${connection.target}_${Date.now()}`,
        source: connection.source!,
        target: connection.target!,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
        type: connection.sourceHandle === 'true' || connection.sourceHandle === 'false'
          ? 'conditional'
          : 'default',
      };
      setEdges((eds) => addEdge(newEdge, eds));
      saveHistory();
    },
    [setEdges, saveHistory]
  );

  // Node selection handler
  const onNodeSelect = useCallback((node: Node | null) => {
    setSelectedNode(node);
  }, []);

  // Drop handler for adding new nodes
  const onDrop = useCallback(
    (event: React.DragEvent, position: { x: number; y: number }) => {
      const nodeType = event.dataTransfer.getData('application/reactflow');
      const nodeData = JSON.parse(event.dataTransfer.getData('application/json') || '{}');

      if (!nodeType) return;

      const newNode: Node = {
        id: generateNodeId(),
        type: nodeType,
        position,
        data: {
          label: nodeData.label || `New ${nodeType}`,
          ...nodeData,
        },
      };

      setNodes((nds) => [...nds, newNode]);
      saveHistory();
    },
    [setNodes, saveHistory]
  );

  // Node update handler
  const onNodeUpdate = useCallback(
    (nodeId: string, data: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
        )
      );
      setIsDirty(true);
    },
    [setNodes]
  );

  // Toolbar handlers
  const handleSave = useCallback(async () => {
    if (workflowId && workflow) {
      // Convert React Flow nodes/edges back to workflow format
      const workflowNodes = nodes.map(node => ({
        id: node.id,
        type: node.type as WorkflowNodeType,
        position: node.position,
        data: node.data,
      })) as WorkflowNode[];

      const workflowEdges = edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        label: edge.label as string | undefined,
        type: edge.type as 'default' | 'conditional' | 'error' | undefined,
        animated: edge.animated,
        data: edge.data,
      })) as WFEdge[];

      await workflowService.update(workflowId, {
        nodes: workflowNodes,
        edges: workflowEdges,
      });
    }
    onSave?.(nodes, edges);
    setIsDirty(false);
  }, [nodes, edges, workflowId, workflow, onSave]);

  const handleRun = useCallback(async () => {
    if (workflowId) {
      await workflowService.execute(workflowId, {});
      setIsRunning(true);
    }
    onRun?.();
  }, [workflowId, onRun]);

  const handlePause = useCallback(() => {
    setIsPaused(!isPaused);
  }, [isPaused]);

  const handleStop = useCallback(() => {
    setIsRunning(false);
    setIsPaused(false);
  }, []);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setNodes(prevState.nodes);
      setEdges(prevState.edges);
      setHistoryIndex(historyIndex - 1);
    }
  }, [history, historyIndex, setNodes, setEdges]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setNodes(nextState.nodes);
      setEdges(nextState.edges);
      setHistoryIndex(historyIndex + 1);
    }
  }, [history, historyIndex, setNodes, setEdges]);

  const handleDuplicate = useCallback(() => {
    if (selectedNode) {
      const newNode: Node = {
        ...selectedNode,
        id: generateNodeId(),
        position: {
          x: selectedNode.position.x + 50,
          y: selectedNode.position.y + 50,
        },
      };
      setNodes((nds) => [...nds, newNode]);
      saveHistory();
    }
  }, [selectedNode, setNodes, saveHistory]);

  const handleDelete = useCallback(() => {
    if (selectedNode) {
      setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
      setEdges((eds) =>
        eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id)
      );
      setSelectedNode(null);
      saveHistory();
    }
  }, [selectedNode, setNodes, setEdges, saveHistory]);

  return (
    <ReactFlowProvider>
      <div className={`flex flex-col h-full ${className}`}>
        {/* Toolbar */}
        <WorkflowToolbar
          workflowName={workflow?.name || 'Untitled Workflow'}
          isDirty={isDirty}
          isRunning={isRunning}
          isPaused={isPaused}
          canUndo={historyIndex > 0}
          canRedo={historyIndex < history.length - 1}
          isLocked={isLocked}
          onSave={handleSave}
          onRun={handleRun}
          onPause={handlePause}
          onStop={handleStop}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
          onToggleLock={() => setIsLocked(!isLocked)}
          onToggleGrid={() => setShowGrid(!showGrid)}
        />

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <WorkflowSidebar
            selectedNode={
              selectedNode
                ? {
                    id: selectedNode.id,
                    type: selectedNode.type || '',
                    data: selectedNode.data as Record<string, unknown>,
                  }
                : null
            }
            onNodeUpdate={onNodeUpdate}
          />

          {/* Canvas */}
          <WorkflowCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeSelect={onNodeSelect}
            onDrop={onDrop}
            showMinimap
            showControls
            showBackground={showGrid}
            isLocked={isLocked}
          />
        </div>
      </div>
    </ReactFlowProvider>
  );
};

export default WorkflowBuilder;
