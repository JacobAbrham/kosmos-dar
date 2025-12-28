/**
 * KOSMOS AEOS Workflow Sidebar
 * Node palette and properties panel
 */

'use client';

import React, { useState } from 'react';
import {
  Play,
  GitBranch,
  Repeat,
  GitFork,
  Timer,
  StopCircle,
  Cpu,
  Cog,
  ChevronDown,
  ChevronRight,
  Search,
  Settings,
  Info,
  Zap,
  Brain,
  MessageSquare,
  Calendar,
  Plug,
  Shield,
  Activity,
  Sparkles,
  Eye,
  Briefcase,
  Code,
  FileText,
} from 'lucide-react';
import { nodeCategories } from './nodes';
import { AgentRole } from '@/services/agent.service';

export interface WorkflowSidebarProps {
  selectedNode?: {
    id: string;
    type: string;
    data: Record<string, unknown>;
  } | null;
  onNodeDragStart?: (event: React.DragEvent, nodeType: string, data?: Record<string, unknown>) => void;
  onNodeUpdate?: (nodeId: string, data: Record<string, unknown>) => void;
  onClose?: () => void;
}

const nodeIcons: Record<string, React.ElementType> = {
  trigger: Play,
  condition: GitBranch,
  loop: Repeat,
  parallel: GitFork,
  delay: Timer,
  end: StopCircle,
  agent: Cpu,
  action: Cog,
};

const agentIcons: Record<AgentRole, React.ElementType> = {
  zeus: Zap,
  athena: Brain,
  hermes: MessageSquare,
  chronos: Calendar,
  hephaestus: Plug,
  argus: Shield,
  prometheus: Activity,
  daedalus: Settings,
  mnemosyne: Sparkles,
  iris: Eye,
  apollo: Briefcase,
  hestia: Code,
  thoth: FileText,
  custom: Cpu,
};

const agentList: AgentRole[] = [
  'zeus',
  'athena',
  'hermes',
  'chronos',
  'hephaestus',
  'argus',
  'prometheus',
  'daedalus',
  'mnemosyne',
  'iris',
  'apollo',
  'hestia',
  'thoth',
];

// Draggable node item
const DraggableNode: React.FC<{
  type: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  data?: Record<string, unknown>;
  onDragStart: (event: React.DragEvent, nodeType: string, data?: Record<string, unknown>) => void;
}> = ({ type, label, description, icon: Icon, data, onDragStart }) => {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, type, data)}
      className="
        flex items-center gap-3 p-3 rounded-lg
        bg-gray-50 dark:bg-gray-800
        border border-gray-200 dark:border-gray-700
        hover:border-blue-400 dark:hover:border-blue-500
        hover:bg-blue-50 dark:hover:bg-blue-900/20
        cursor-grab active:cursor-grabbing
        transition-all duration-200
      "
    >
      <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
        <Icon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 dark:text-white">
          {label}
        </div>
        {description && (
          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {description}
          </div>
        )}
      </div>
    </div>
  );
};

// Category accordion
const NodeCategory: React.FC<{
  name: string;
  nodes: Array<{ type: string; label: string; description?: string }>;
  isOpen: boolean;
  onToggle: () => void;
  onDragStart: (event: React.DragEvent, nodeType: string, data?: Record<string, unknown>) => void;
}> = ({ name, nodes, isOpen, onToggle, onDragStart }) => {
  return (
    <div className="border-b border-gray-200 dark:border-gray-700">
      <button
        onClick={onToggle}
        className="
          w-full flex items-center justify-between p-3
          text-sm font-medium text-gray-700 dark:text-gray-300
          hover:bg-gray-50 dark:hover:bg-gray-800
        "
      >
        <span>{name}</span>
        {isOpen ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
      </button>
      {isOpen && (
        <div className="p-3 pt-0 space-y-2">
          {nodes.map((node) => (
            <DraggableNode
              key={node.type}
              type={node.type}
              label={node.label}
              description={node.description}
              icon={nodeIcons[node.type] || Cog}
              onDragStart={onDragStart}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Node properties panel
const NodeProperties: React.FC<{
  node: {
    id: string;
    type: string;
    data: Record<string, unknown>;
  };
  onUpdate: (nodeId: string, data: Record<string, unknown>) => void;
}> = ({ node, onUpdate }) => {
  const handleChange = (key: string, value: unknown) => {
    onUpdate(node.id, { ...node.data, [key]: value });
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
        <Settings className="w-4 h-4" />
        Node Properties
      </div>

      {/* Common properties */}
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Label
          </label>
          <input
            type="text"
            value={(node.data.label as string) || ''}
            onChange={(e) => handleChange('label', e.target.value)}
            className="
              w-full px-3 py-2 text-sm
              bg-white dark:bg-gray-800
              border border-gray-200 dark:border-gray-700
              rounded-lg focus:ring-2 focus:ring-blue-500
            "
          />
        </div>

        {/* Type-specific properties */}
        {node.type === 'trigger' && (
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Trigger Type
            </label>
            <select
              value={(node.data.triggerType as string) || 'manual'}
              onChange={(e) => handleChange('triggerType', e.target.value)}
              className="
                w-full px-3 py-2 text-sm
                bg-white dark:bg-gray-800
                border border-gray-200 dark:border-gray-700
                rounded-lg focus:ring-2 focus:ring-blue-500
              "
            >
              <option value="manual">Manual</option>
              <option value="schedule">Schedule</option>
              <option value="webhook">Webhook</option>
              <option value="email">Email</option>
              <option value="event">Event</option>
              <option value="message">Message</option>
            </select>
          </div>
        )}

        {node.type === 'agent' && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Agent
              </label>
              <select
                value={(node.data.agentRole as string) || 'zeus'}
                onChange={(e) => handleChange('agentRole', e.target.value)}
                className="
                  w-full px-3 py-2 text-sm
                  bg-white dark:bg-gray-800
                  border border-gray-200 dark:border-gray-700
                  rounded-lg focus:ring-2 focus:ring-blue-500
                "
              >
                {agentList.map((role) => (
                  <option key={role} value={role}>
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Prompt
              </label>
              <textarea
                value={(node.data.prompt as string) || ''}
                onChange={(e) => handleChange('prompt', e.target.value)}
                rows={3}
                className="
                  w-full px-3 py-2 text-sm
                  bg-white dark:bg-gray-800
                  border border-gray-200 dark:border-gray-700
                  rounded-lg focus:ring-2 focus:ring-blue-500
                "
              />
            </div>
          </>
        )}

        {node.type === 'condition' && (
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Condition Expression
            </label>
            <input
              type="text"
              value={(node.data.condition as string) || ''}
              onChange={(e) => handleChange('condition', e.target.value)}
              placeholder="e.g., result.status === 'success'"
              className="
                w-full px-3 py-2 text-sm font-mono
                bg-white dark:bg-gray-800
                border border-gray-200 dark:border-gray-700
                rounded-lg focus:ring-2 focus:ring-blue-500
              "
            />
          </div>
        )}

        {node.type === 'delay' && (
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Duration
              </label>
              <input
                type="number"
                value={(node.data.duration as number) || 0}
                onChange={(e) => handleChange('duration', parseInt(e.target.value))}
                min={0}
                className="
                  w-full px-3 py-2 text-sm
                  bg-white dark:bg-gray-800
                  border border-gray-200 dark:border-gray-700
                  rounded-lg focus:ring-2 focus:ring-blue-500
                "
              />
            </div>
            <div className="w-24">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Unit
              </label>
              <select
                value={(node.data.unit as string) || 'seconds'}
                onChange={(e) => handleChange('unit', e.target.value)}
                className="
                  w-full px-3 py-2 text-sm
                  bg-white dark:bg-gray-800
                  border border-gray-200 dark:border-gray-700
                  rounded-lg focus:ring-2 focus:ring-blue-500
                "
              >
                <option value="seconds">Sec</option>
                <option value="minutes">Min</option>
                <option value="hours">Hours</option>
                <option value="days">Days</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Node info */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <Info className="w-3 h-3" />
          Node ID: {node.id}
        </div>
      </div>
    </div>
  );
};

export const WorkflowSidebar: React.FC<WorkflowSidebarProps> = ({
  selectedNode,
  onNodeDragStart,
  onNodeUpdate,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    'Flow Control': true,
    'Agents': true,
    'Actions': true,
  });
  const [activeTab, setActiveTab] = useState<'nodes' | 'properties'>('nodes');

  const handleDragStart = (
    event: React.DragEvent,
    nodeType: string,
    data?: Record<string, unknown>
  ) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.setData('application/json', JSON.stringify(data || {}));
    event.dataTransfer.effectAllowed = 'move';
    onNodeDragStart?.(event, nodeType, data);
  };

  const toggleCategory = (name: string) => {
    setOpenCategories((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  // Filter nodes by search query
  const filteredCategories = nodeCategories.map((category) => ({
    ...category,
    nodes: category.nodes.filter(
      (node) =>
        node.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (node.description && node.description.toLowerCase().includes(searchQuery.toLowerCase()))
    ),
  })).filter((category) => category.nodes.length > 0);

  return (
    <div className="w-72 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => setActiveTab('nodes')}
          className={`
            flex-1 px-4 py-3 text-sm font-medium
            ${activeTab === 'nodes'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
            }
          `}
        >
          Nodes
        </button>
        <button
          onClick={() => setActiveTab('properties')}
          className={`
            flex-1 px-4 py-3 text-sm font-medium
            ${activeTab === 'properties'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
            }
          `}
        >
          Properties
        </button>
      </div>

      {activeTab === 'nodes' ? (
        <>
          {/* Search */}
          <div className="p-3 border-b border-gray-200 dark:border-gray-800">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search nodes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="
                  w-full pl-9 pr-3 py-2 text-sm
                  bg-gray-50 dark:bg-gray-800
                  border border-gray-200 dark:border-gray-700
                  rounded-lg focus:ring-2 focus:ring-blue-500
                "
              />
            </div>
          </div>

          {/* Node categories */}
          <div className="flex-1 overflow-y-auto">
            {filteredCategories.map((category) => (
              <NodeCategory
                key={category.name}
                name={category.name}
                nodes={category.nodes}
                isOpen={openCategories[category.name]}
                onToggle={() => toggleCategory(category.name)}
                onDragStart={handleDragStart}
              />
            ))}

            {/* Agent nodes */}
            <div className="border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => toggleCategory('All Agents')}
                className="
                  w-full flex items-center justify-between p-3
                  text-sm font-medium text-gray-700 dark:text-gray-300
                  hover:bg-gray-50 dark:hover:bg-gray-800
                "
              >
                <span>All Agents</span>
                {openCategories['All Agents'] ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
              {openCategories['All Agents'] && (
                <div className="p-3 pt-0 space-y-2">
                  {agentList.map((role) => (
                    <DraggableNode
                      key={role}
                      type="agent"
                      label={role.charAt(0).toUpperCase() + role.slice(1)}
                      description={`${role.charAt(0).toUpperCase() + role.slice(1)} agent`}
                      icon={agentIcons[role]}
                      data={{ agentRole: role, label: role.charAt(0).toUpperCase() + role.slice(1) }}
                      onDragStart={handleDragStart}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {selectedNode ? (
            <NodeProperties
              node={selectedNode}
              onUpdate={onNodeUpdate || (() => {})}
            />
          ) : (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Select a node to view properties</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WorkflowSidebar;
