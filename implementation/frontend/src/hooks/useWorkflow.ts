/**
 * KOSMOS AEOS Workflow Hook
 * Workflow builder state management and operations
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useWebSocket } from './useWebSocket';
import {
  workflowService,
  Workflow,
  WorkflowNode,
  WorkflowEdge,
  WorkflowExecution,
  WorkflowNodeType,
  WorkflowStatus,
  CreateWorkflowRequest,
  NodeExecution,
} from '@/services/workflow.service';
import { TaskStatus } from '@/services/task.service';

// Builder state
export interface WorkflowBuilderState {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  isDirty: boolean;
  isValid: boolean;
  validationErrors: Array<{ nodeId?: string; message: string }>;
}

// Workflow state
export interface WorkflowState {
  workflow: Workflow | null;
  loading: boolean;
  saving: boolean;
  error: Error | null;
}

// Execution state
export interface ExecutionState {
  execution: WorkflowExecution | null;
  nodeStates: Record<string, NodeExecution>;
  isRunning: boolean;
}

// Hook options
export interface UseWorkflowOptions {
  workflowId?: string;
  autoLoad?: boolean;
  autoSave?: boolean;
  autoSaveDelay?: number;
  onSave?: (workflow: Workflow) => void;
  onExecutionUpdate?: (execution: WorkflowExecution) => void;
  onError?: (error: Error) => void;
}

// Hook return type
export interface UseWorkflowReturn {
  // Workflow state
  workflow: Workflow | null;
  loading: boolean;
  saving: boolean;
  error: Error | null;

  // Builder state
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  isDirty: boolean;
  isValid: boolean;
  validationErrors: Array<{ nodeId?: string; message: string }>;

  // Execution state
  execution: WorkflowExecution | null;
  nodeStates: Record<string, NodeExecution>;
  isRunning: boolean;

  // Workflow actions
  loadWorkflow: (id?: string) => Promise<void>;
  createWorkflow: (request: CreateWorkflowRequest) => Promise<Workflow>;
  saveWorkflow: () => Promise<void>;
  publishWorkflow: () => Promise<void>;
  deleteWorkflow: () => Promise<void>;
  duplicateWorkflow: (name?: string) => Promise<Workflow>;

  // Builder actions
  addNode: (node: Omit<WorkflowNode, 'id'>) => string;
  updateNode: (nodeId: string, updates: Partial<WorkflowNode>) => void;
  removeNode: (nodeId: string) => void;
  addEdge: (edge: Omit<WorkflowEdge, 'id'>) => string;
  updateEdge: (edgeId: string, updates: Partial<WorkflowEdge>) => void;
  removeEdge: (edgeId: string) => void;
  selectNode: (nodeId: string | null) => void;
  selectEdge: (edgeId: string | null) => void;
  validate: () => Promise<boolean>;
  clear: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  // Execution actions
  executeWorkflow: (input?: Record<string, unknown>) => Promise<void>;
  cancelExecution: () => Promise<void>;
  retryExecution: (fromNodeId?: string) => Promise<void>;

  // Utilities
  exportWorkflow: () => Promise<string>;
  importWorkflow: (json: string) => Promise<void>;
  getNodeById: (nodeId: string) => WorkflowNode | undefined;
  getEdgesForNode: (nodeId: string) => { incoming: WorkflowEdge[]; outgoing: WorkflowEdge[] };
}

// Generate unique ID
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export function useWorkflow(options: UseWorkflowOptions = {}): UseWorkflowReturn {
  const {
    workflowId: initialWorkflowId,
    autoLoad = true,
    autoSave = false,
    autoSaveDelay = 2000,
    onSave,
    onExecutionUpdate,
    onError,
  } = options;

  // State
  const [workflowState, setWorkflowState] = useState<WorkflowState>({
    workflow: null,
    loading: false,
    saving: false,
    error: null,
  });

  const [builder, setBuilder] = useState<WorkflowBuilderState>({
    nodes: [],
    edges: [],
    selectedNodeId: null,
    selectedEdgeId: null,
    isDirty: false,
    isValid: true,
    validationErrors: [],
  });

  const [executionState, setExecutionState] = useState<ExecutionState>({
    execution: null,
    nodeStates: {},
    isRunning: false,
  });

  // History for undo/redo
  const [history, setHistory] = useState<{ nodes: WorkflowNode[]; edges: WorkflowEdge[] }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const mountedRef = useRef(true);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentWorkflowId = workflowState.workflow?.id || initialWorkflowId;

  // WebSocket for execution updates
  const { on, subscribe, unsubscribe } = useWebSocket({
    onMessage: (message) => {
      if (!mountedRef.current) return;

      if (message.type === 'task:updated' || message.type === 'task:completed') {
        const data = message.data as WorkflowExecution;
        if (data.workflowId === currentWorkflowId) {
          updateExecutionState(data);
        }
      }
    },
  });

  // Update execution state
  const updateExecutionState = useCallback((execution: WorkflowExecution) => {
    const nodeStates: Record<string, NodeExecution> = {};
    execution.nodeExecutions.forEach((ne) => {
      nodeStates[ne.nodeId] = ne;
    });

    setExecutionState({
      execution,
      nodeStates,
      isRunning: execution.status === 'running' || execution.status === 'pending',
    });

    onExecutionUpdate?.(execution);
  }, [onExecutionUpdate]);

  // Save history for undo/redo
  const saveHistory = useCallback(() => {
    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push({ nodes: [...builder.nodes], edges: [...builder.edges] });
      return newHistory.slice(-50); // Keep last 50 states
    });
    setHistoryIndex((prev) => prev + 1);
  }, [builder.nodes, builder.edges, historyIndex]);

  // Load workflow
  const loadWorkflow = useCallback(
    async (id?: string) => {
      const workflowId = id || initialWorkflowId;
      if (!workflowId) return;

      setWorkflowState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const workflow = await workflowService.get(workflowId);

        if (mountedRef.current) {
          setWorkflowState((prev) => ({
            ...prev,
            workflow,
            loading: false,
          }));

          setBuilder({
            nodes: workflow.nodes,
            edges: workflow.edges,
            selectedNodeId: null,
            selectedEdgeId: null,
            isDirty: false,
            isValid: true,
            validationErrors: [],
          });

          // Initialize history
          setHistory([{ nodes: workflow.nodes, edges: workflow.edges }]);
          setHistoryIndex(0);

          // Subscribe to execution updates
          subscribe([`workflow:${workflow.id}`]);
        }
      } catch (error) {
        if (mountedRef.current) {
          const err = error instanceof Error ? error : new Error('Failed to load workflow');
          setWorkflowState((prev) => ({ ...prev, loading: false, error: err }));
          onError?.(err);
        }
      }
    },
    [initialWorkflowId, subscribe, onError]
  );

  // Create workflow
  const createWorkflow = useCallback(
    async (request: CreateWorkflowRequest): Promise<Workflow> => {
      const workflow = await workflowService.create(request);

      if (mountedRef.current) {
        setWorkflowState((prev) => ({ ...prev, workflow }));
        setBuilder({
          nodes: workflow.nodes,
          edges: workflow.edges,
          selectedNodeId: null,
          selectedEdgeId: null,
          isDirty: false,
          isValid: true,
          validationErrors: [],
        });
      }

      return workflow;
    },
    []
  );

  // Save workflow
  const saveWorkflow = useCallback(async () => {
    if (!currentWorkflowId || !builder.isDirty) return;

    setWorkflowState((prev) => ({ ...prev, saving: true }));

    try {
      const workflow = await workflowService.update(currentWorkflowId, {
        nodes: builder.nodes,
        edges: builder.edges,
      });

      if (mountedRef.current) {
        setWorkflowState((prev) => ({
          ...prev,
          workflow,
          saving: false,
        }));

        setBuilder((prev) => ({ ...prev, isDirty: false }));
        onSave?.(workflow);
      }
    } catch (error) {
      if (mountedRef.current) {
        const err = error instanceof Error ? error : new Error('Failed to save workflow');
        setWorkflowState((prev) => ({ ...prev, saving: false, error: err }));
        onError?.(err);
      }
    }
  }, [currentWorkflowId, builder.nodes, builder.edges, builder.isDirty, onSave, onError]);

  // Publish workflow
  const publishWorkflow = useCallback(async () => {
    if (!currentWorkflowId) return;

    await saveWorkflow();
    const workflow = await workflowService.publish(currentWorkflowId);

    if (mountedRef.current) {
      setWorkflowState((prev) => ({ ...prev, workflow }));
    }
  }, [currentWorkflowId, saveWorkflow]);

  // Delete workflow
  const deleteWorkflow = useCallback(async () => {
    if (!currentWorkflowId) return;
    await workflowService.delete(currentWorkflowId);

    if (mountedRef.current) {
      setWorkflowState({ workflow: null, loading: false, saving: false, error: null });
      setBuilder({
        nodes: [],
        edges: [],
        selectedNodeId: null,
        selectedEdgeId: null,
        isDirty: false,
        isValid: true,
        validationErrors: [],
      });
    }
  }, [currentWorkflowId]);

  // Duplicate workflow
  const duplicateWorkflow = useCallback(
    async (name?: string): Promise<Workflow> => {
      if (!currentWorkflowId) throw new Error('No workflow to duplicate');
      return workflowService.duplicate(currentWorkflowId, name);
    },
    [currentWorkflowId]
  );

  // Add node
  const addNode = useCallback((node: Omit<WorkflowNode, 'id'>): string => {
    const id = `node-${generateId()}`;
    const newNode: WorkflowNode = { ...node, id };

    saveHistory();
    setBuilder((prev) => ({
      ...prev,
      nodes: [...prev.nodes, newNode],
      isDirty: true,
    }));

    return id;
  }, [saveHistory]);

  // Update node
  const updateNode = useCallback((nodeId: string, updates: Partial<WorkflowNode>) => {
    saveHistory();
    setBuilder((prev) => ({
      ...prev,
      nodes: prev.nodes.map((node) =>
        node.id === nodeId ? { ...node, ...updates } : node
      ),
      isDirty: true,
    }));
  }, [saveHistory]);

  // Remove node
  const removeNode = useCallback((nodeId: string) => {
    saveHistory();
    setBuilder((prev) => ({
      ...prev,
      nodes: prev.nodes.filter((node) => node.id !== nodeId),
      edges: prev.edges.filter(
        (edge) => edge.source !== nodeId && edge.target !== nodeId
      ),
      selectedNodeId: prev.selectedNodeId === nodeId ? null : prev.selectedNodeId,
      isDirty: true,
    }));
  }, [saveHistory]);

  // Add edge
  const addEdge = useCallback((edge: Omit<WorkflowEdge, 'id'>): string => {
    const id = `edge-${generateId()}`;
    const newEdge: WorkflowEdge = { ...edge, id };

    saveHistory();
    setBuilder((prev) => ({
      ...prev,
      edges: [...prev.edges, newEdge],
      isDirty: true,
    }));

    return id;
  }, [saveHistory]);

  // Update edge
  const updateEdge = useCallback((edgeId: string, updates: Partial<WorkflowEdge>) => {
    saveHistory();
    setBuilder((prev) => ({
      ...prev,
      edges: prev.edges.map((edge) =>
        edge.id === edgeId ? { ...edge, ...updates } : edge
      ),
      isDirty: true,
    }));
  }, [saveHistory]);

  // Remove edge
  const removeEdge = useCallback((edgeId: string) => {
    saveHistory();
    setBuilder((prev) => ({
      ...prev,
      edges: prev.edges.filter((edge) => edge.id !== edgeId),
      selectedEdgeId: prev.selectedEdgeId === edgeId ? null : prev.selectedEdgeId,
      isDirty: true,
    }));
  }, [saveHistory]);

  // Select node
  const selectNode = useCallback((nodeId: string | null) => {
    setBuilder((prev) => ({
      ...prev,
      selectedNodeId: nodeId,
      selectedEdgeId: null,
    }));
  }, []);

  // Select edge
  const selectEdge = useCallback((edgeId: string | null) => {
    setBuilder((prev) => ({
      ...prev,
      selectedEdgeId: edgeId,
      selectedNodeId: null,
    }));
  }, []);

  // Validate workflow
  const validate = useCallback(async (): Promise<boolean> => {
    const result = await workflowService.validate({
      nodes: builder.nodes,
      edges: builder.edges,
    });

    setBuilder((prev) => ({
      ...prev,
      isValid: result.valid,
      validationErrors: result.errors || [],
    }));

    return result.valid;
  }, [builder.nodes, builder.edges]);

  // Clear builder
  const clear = useCallback(() => {
    saveHistory();
    setBuilder({
      nodes: [],
      edges: [],
      selectedNodeId: null,
      selectedEdgeId: null,
      isDirty: true,
      isValid: true,
      validationErrors: [],
    });
  }, [saveHistory]);

  // Undo
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setBuilder((prev) => ({
        ...prev,
        nodes: prevState.nodes,
        edges: prevState.edges,
        isDirty: true,
      }));
      setHistoryIndex((prev) => prev - 1);
    }
  }, [history, historyIndex]);

  // Redo
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setBuilder((prev) => ({
        ...prev,
        nodes: nextState.nodes,
        edges: nextState.edges,
        isDirty: true,
      }));
      setHistoryIndex((prev) => prev + 1);
    }
  }, [history, historyIndex]);

  // Execute workflow
  const executeWorkflow = useCallback(
    async (input?: Record<string, unknown>) => {
      if (!currentWorkflowId) return;

      const execution = await workflowService.execute(currentWorkflowId, input);
      updateExecutionState(execution);
    },
    [currentWorkflowId, updateExecutionState]
  );

  // Cancel execution
  const cancelExecution = useCallback(async () => {
    if (!executionState.execution?.id) return;

    const execution = await workflowService.cancelExecution(executionState.execution.id);
    updateExecutionState(execution);
  }, [executionState.execution?.id, updateExecutionState]);

  // Retry execution
  const retryExecution = useCallback(
    async (fromNodeId?: string) => {
      if (!executionState.execution?.id) return;

      const execution = await workflowService.retryExecution(
        executionState.execution.id,
        fromNodeId
      );
      updateExecutionState(execution);
    },
    [executionState.execution?.id, updateExecutionState]
  );

  // Export workflow
  const exportWorkflow = useCallback(async (): Promise<string> => {
    if (!currentWorkflowId) throw new Error('No workflow to export');
    const result = await workflowService.export(currentWorkflowId);
    return result.json;
  }, [currentWorkflowId]);

  // Import workflow
  const importWorkflow = useCallback(async (json: string) => {
    const workflow = await workflowService.import(json);

    if (mountedRef.current) {
      setWorkflowState((prev) => ({ ...prev, workflow }));
      setBuilder({
        nodes: workflow.nodes,
        edges: workflow.edges,
        selectedNodeId: null,
        selectedEdgeId: null,
        isDirty: false,
        isValid: true,
        validationErrors: [],
      });
    }
  }, []);

  // Get node by ID
  const getNodeById = useCallback(
    (nodeId: string): WorkflowNode | undefined => {
      return builder.nodes.find((node) => node.id === nodeId);
    },
    [builder.nodes]
  );

  // Get edges for node
  const getEdgesForNode = useCallback(
    (nodeId: string): { incoming: WorkflowEdge[]; outgoing: WorkflowEdge[] } => {
      return {
        incoming: builder.edges.filter((edge) => edge.target === nodeId),
        outgoing: builder.edges.filter((edge) => edge.source === nodeId),
      };
    },
    [builder.edges]
  );

  // Auto-save effect
  useEffect(() => {
    if (autoSave && builder.isDirty && currentWorkflowId) {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }

      autoSaveTimerRef.current = setTimeout(() => {
        saveWorkflow();
      }, autoSaveDelay);
    }

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [autoSave, autoSaveDelay, builder.isDirty, currentWorkflowId, saveWorkflow]);

  // Auto-load on mount
  useEffect(() => {
    mountedRef.current = true;

    if (autoLoad && initialWorkflowId) {
      loadWorkflow();
    }

    return () => {
      mountedRef.current = false;

      if (currentWorkflowId) {
        unsubscribe([`workflow:${currentWorkflowId}`]);
      }
    };
  }, [autoLoad, initialWorkflowId, loadWorkflow, unsubscribe, currentWorkflowId]);

  return {
    // Workflow state
    workflow: workflowState.workflow,
    loading: workflowState.loading,
    saving: workflowState.saving,
    error: workflowState.error,

    // Builder state
    nodes: builder.nodes,
    edges: builder.edges,
    selectedNodeId: builder.selectedNodeId,
    selectedEdgeId: builder.selectedEdgeId,
    isDirty: builder.isDirty,
    isValid: builder.isValid,
    validationErrors: builder.validationErrors,

    // Execution state
    execution: executionState.execution,
    nodeStates: executionState.nodeStates,
    isRunning: executionState.isRunning,

    // Workflow actions
    loadWorkflow,
    createWorkflow,
    saveWorkflow,
    publishWorkflow,
    deleteWorkflow,
    duplicateWorkflow,

    // Builder actions
    addNode,
    updateNode,
    removeNode,
    addEdge,
    updateEdge,
    removeEdge,
    selectNode,
    selectEdge,
    validate,
    clear,
    undo,
    redo,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,

    // Execution actions
    executeWorkflow,
    cancelExecution,
    retryExecution,

    // Utilities
    exportWorkflow,
    importWorkflow,
    getNodeById,
    getEdgesForNode,
  };
}

export default useWorkflow;
