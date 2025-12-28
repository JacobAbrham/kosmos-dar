/**
 * KOSMOS AEOS Workflow Toolbar
 * Controls for workflow builder (save, load, run, etc.)
 */

'use client';

import React from 'react';
import {
  Save,
  Upload,
  Play,
  Pause,
  Square,
  Undo,
  Redo,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Grid,
  Lock,
  Unlock,
  Copy,
  Trash2,
  Settings,
  Download,
  FileJson,
} from 'lucide-react';

export interface WorkflowToolbarProps {
  workflowName?: string;
  isDirty?: boolean;
  isRunning?: boolean;
  isPaused?: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  isLocked?: boolean;
  onSave?: () => void;
  onLoad?: () => void;
  onRun?: () => void;
  onPause?: () => void;
  onStop?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFitView?: () => void;
  onToggleGrid?: () => void;
  onToggleLock?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onSettings?: () => void;
  onExport?: () => void;
}

const ToolbarButton: React.FC<{
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  variant?: 'default' | 'primary' | 'danger' | 'success';
}> = ({ icon: Icon, label, onClick, disabled, active, variant = 'default' }) => {
  const variantClasses = {
    default: 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400',
    primary: 'hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-600 dark:text-blue-400',
    danger: 'hover:bg-red-100 dark:hover:bg-red-900 text-red-600 dark:text-red-400',
    success: 'hover:bg-green-100 dark:hover:bg-green-900 text-green-600 dark:text-green-400',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`
        p-2 rounded-lg transition-colors
        ${variantClasses[variant]}
        ${active ? 'bg-gray-100 dark:bg-gray-700' : ''}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      <Icon className="w-5 h-5" />
    </button>
  );
};

const ToolbarDivider: React.FC = () => (
  <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />
);

export const WorkflowToolbar: React.FC<WorkflowToolbarProps> = ({
  workflowName = 'Untitled Workflow',
  isDirty = false,
  isRunning = false,
  isPaused = false,
  canUndo = false,
  canRedo = false,
  isLocked = false,
  onSave,
  onLoad,
  onRun,
  onPause,
  onStop,
  onUndo,
  onRedo,
  onZoomIn,
  onZoomOut,
  onFitView,
  onToggleGrid,
  onToggleLock,
  onDuplicate,
  onDelete,
  onSettings,
  onExport,
}) => {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
      {/* Left Section - File Operations */}
      <div className="flex items-center gap-1">
        <ToolbarButton
          icon={Save}
          label={isDirty ? 'Save (unsaved changes)' : 'Save'}
          onClick={onSave}
          variant={isDirty ? 'primary' : 'default'}
        />
        <ToolbarButton icon={Upload} label="Load" onClick={onLoad} />
        <ToolbarButton icon={Download} label="Export" onClick={onExport} />
        <ToolbarButton icon={FileJson} label="Export as JSON" onClick={onExport} />

        <ToolbarDivider />

        <ToolbarButton
          icon={Undo}
          label="Undo"
          onClick={onUndo}
          disabled={!canUndo}
        />
        <ToolbarButton
          icon={Redo}
          label="Redo"
          onClick={onRedo}
          disabled={!canRedo}
        />

        <ToolbarDivider />

        <ToolbarButton icon={Copy} label="Duplicate" onClick={onDuplicate} />
        <ToolbarButton
          icon={Trash2}
          label="Delete"
          onClick={onDelete}
          variant="danger"
        />
      </div>

      {/* Center Section - Workflow Name */}
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {workflowName}
        </h2>
        {isDirty && (
          <span className="text-xs text-orange-500 font-medium">
            (unsaved)
          </span>
        )}
        {isRunning && (
          <span className="flex items-center gap-1 text-xs text-green-500 font-medium">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Running
          </span>
        )}
      </div>

      {/* Right Section - View & Run Controls */}
      <div className="flex items-center gap-1">
        <ToolbarButton icon={ZoomOut} label="Zoom Out" onClick={onZoomOut} />
        <ToolbarButton icon={ZoomIn} label="Zoom In" onClick={onZoomIn} />
        <ToolbarButton icon={Maximize2} label="Fit View" onClick={onFitView} />
        <ToolbarButton icon={Grid} label="Toggle Grid" onClick={onToggleGrid} />

        <ToolbarDivider />

        <ToolbarButton
          icon={isLocked ? Lock : Unlock}
          label={isLocked ? 'Unlock' : 'Lock'}
          onClick={onToggleLock}
          active={isLocked}
        />
        <ToolbarButton icon={Settings} label="Settings" onClick={onSettings} />

        <ToolbarDivider />

        {!isRunning ? (
          <ToolbarButton
            icon={Play}
            label="Run Workflow"
            onClick={onRun}
            variant="success"
          />
        ) : (
          <>
            <ToolbarButton
              icon={isPaused ? Play : Pause}
              label={isPaused ? 'Resume' : 'Pause'}
              onClick={onPause}
              variant="primary"
            />
            <ToolbarButton
              icon={Square}
              label="Stop"
              onClick={onStop}
              variant="danger"
            />
          </>
        )}
      </div>
    </div>
  );
};

export default WorkflowToolbar;
