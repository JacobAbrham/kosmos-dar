'use client';

/**
 * KOSMOS AEOS Workflow Editor Page
 * Visual workflow builder with React Flow
 */

import React, { useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useWorkflow } from '@/hooks/useWorkflow';
import { WorkflowNode, WorkflowNodeType } from '@/services/workflow.service';

// Node palette items
const nodePalette: Array<{
  type: WorkflowNodeType;
  label: string;
  icon: string;
  description: string;
  color: string;
}> = [
  { type: 'trigger', label: 'Trigger', icon: '\u26A1', description: 'Start the workflow', color: 'bg-yellow-500' },
  { type: 'agent', label: 'Agent', icon: '\u{1F916}', description: 'Execute agent action', color: 'bg-purple-500' },
  { type: 'condition', label: 'Condition', icon: '\u2753', description: 'Branch logic', color: 'bg-blue-500' },
  { type: 'loop', label: 'Loop', icon: '\u{1F504}', description: 'Repeat actions', color: 'bg-green-500' },
  { type: 'action', label: 'Action', icon: '\u{1F3AF}', description: 'Perform action', color: 'bg-orange-500' },
  { type: 'delay', label: 'Delay', icon: '\u23F1', description: 'Wait before continuing', color: 'bg-gray-500' },
  { type: 'parallel', label: 'Parallel', icon: '\u2261', description: 'Run in parallel', color: 'bg-cyan-500' },
  { type: 'end', label: 'End', icon: '\u23F9', description: 'End workflow', color: 'bg-red-500' },
];

export default function WorkflowEditorPage() {
  const params = useParams();
  const router = useRouter();
  const workflowId = params?.id as string;

  const {
    workflow,
    nodes,
    edges,
    loading,
    saving,
    error,
    isDirty,
    selectedNodeId,
    addNode,
    updateNode,
    removeNode,
    addEdge,
    removeEdge,
    selectNode,
    saveWorkflow,
    publishWorkflow,
    executeWorkflow,
    validate,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useWorkflow({
    workflowId: workflowId === 'new' ? undefined : workflowId,
    autoLoad: workflowId !== 'new',
    autoSave: true,
    autoSaveDelay: 3000,
  });

  const [showNodePalette, setShowNodePalette] = useState(true);
  const [showProperties, setShowProperties] = useState(true);

  // Handle drop node from palette
  const handleDropNode = useCallback(
    (type: WorkflowNodeType, position: { x: number; y: number }) => {
      const paletteItem = nodePalette.find((n) => n.type === type);
      if (!paletteItem) return;

      addNode({
        type,
        position,
        data: {
          label: paletteItem.label,
          description: paletteItem.description,
        },
      });
    },
    [addNode]
  );

  // Selected node
  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading workflow...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100 dark:bg-gray-950">
      {/* Toolbar */}
      <div className="h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4">
        {/* Left section */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/workflows')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <input
              type="text"
              value={workflow?.name || 'New Workflow'}
              onChange={(e) => {
                // Update workflow name
              }}
              className="font-semibold text-gray-900 dark:text-white bg-transparent border-0 focus:ring-0 p-0"
            />
            <p className="text-xs text-gray-500">
              {isDirty ? 'Unsaved changes' : 'Saved'}
              {workflow?.version && ` • v${workflow.version}`}
            </p>
          </div>
        </div>

        {/* Center section - Undo/Redo */}
        <div className="flex items-center gap-1">
          <button
            onClick={undo}
            disabled={!canUndo}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
            title="Undo"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
            title="Redo"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
            </svg>
          </button>
        </div>

        {/* Right section */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => validate()}
            className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            Validate
          </button>
          <button
            onClick={() => saveWorkflow()}
            disabled={saving || !isDirty}
            className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={() => publishWorkflow()}
            className="px-4 py-1.5 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
          >
            Publish
          </button>
          <button
            onClick={() => executeWorkflow()}
            className="px-4 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Run
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Node Palette */}
        {showNodePalette && (
          <div className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
            <div className="p-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                Node Types
              </h3>
              <div className="space-y-2">
                {nodePalette.map((node) => (
                  <div
                    key={node.type}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('node-type', node.type);
                    }}
                    className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-grab hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 ${node.color} rounded-lg flex items-center justify-center text-white`}>
                        {node.icon}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white text-sm">
                          {node.label}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {node.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Canvas */}
        <div
          className="flex-1 relative"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            const type = e.dataTransfer.getData('node-type') as WorkflowNodeType;
            if (type) {
              const rect = e.currentTarget.getBoundingClientRect();
              handleDropNode(type, {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
              });
            }
          }}
        >
          {/* Placeholder for React Flow */}
          <div className="absolute inset-0 flex items-center justify-center">
            {nodes.length === 0 ? (
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
                  Start Building
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Drag nodes from the palette to create your workflow
                </p>
              </div>
            ) : (
              <div className="w-full h-full bg-gray-50 dark:bg-gray-950 relative">
                {/* Simple node visualization (React Flow would replace this) */}
                {nodes.map((node) => (
                  <div
                    key={node.id}
                    onClick={() => selectNode(node.id)}
                    style={{
                      position: 'absolute',
                      left: node.position.x,
                      top: node.position.y,
                    }}
                    className={`
                      p-4 bg-white dark:bg-gray-900 rounded-xl shadow-lg cursor-pointer
                      border-2 transition-all
                      ${selectedNodeId === node.id ? 'border-blue-500 scale-105' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}
                    `}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 ${nodePalette.find((n) => n.type === node.type)?.color || 'bg-gray-500'} rounded-lg flex items-center justify-center text-white`}>
                        {nodePalette.find((n) => n.type === node.type)?.icon || '\u2699'}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white text-sm">
                          {node.data.label}
                        </p>
                        <p className="text-xs text-gray-500">{node.type}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Zoom controls */}
          <div className="absolute bottom-4 right-4 flex flex-col gap-2">
            <button className="w-10 h-10 bg-white dark:bg-gray-800 rounded-lg shadow-lg flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700">
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <button className="w-10 h-10 bg-white dark:bg-gray-800 rounded-lg shadow-lg flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700">
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <button className="w-10 h-10 bg-white dark:bg-gray-800 rounded-lg shadow-lg flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700">
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>
          </div>
        </div>

        {/* Properties Panel */}
        {showProperties && selectedNode && (
          <div className="w-80 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 overflow-y-auto">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Node Properties
                </h3>
                <button
                  onClick={() => removeNode(selectedNode.id)}
                  className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

              {/* Node type */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Type
                </label>
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 ${nodePalette.find((n) => n.type === selectedNode.type)?.color || 'bg-gray-500'} rounded flex items-center justify-center text-white text-xs`}>
                    {nodePalette.find((n) => n.type === selectedNode.type)?.icon || '\u2699'}
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                    {selectedNode.type}
                  </span>
                </div>
              </div>

              {/* Label */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Label
                </label>
                <input
                  type="text"
                  value={selectedNode.data.label || ''}
                  onChange={(e) =>
                    updateNode(selectedNode.id, {
                      data: { ...selectedNode.data, label: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                />
              </div>

              {/* Description */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Description
                </label>
                <textarea
                  value={selectedNode.data.description || ''}
                  onChange={(e) =>
                    updateNode(selectedNode.id, {
                      data: { ...selectedNode.data, description: e.target.value },
                    })
                  }
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                />
              </div>

              {/* Type-specific fields would go here */}
              <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500">
                  Node ID: {selectedNode.id}
                </p>
                <p className="text-xs text-gray-500">
                  Position: ({Math.round(selectedNode.position.x)}, {Math.round(selectedNode.position.y)})
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
