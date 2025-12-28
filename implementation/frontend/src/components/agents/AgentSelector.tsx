'use client';

/**
 * KOSMOS AEOS Agent Selector
 * Dropdown/modal for selecting an agent to interact with
 */

import React, { useState, useRef, useEffect } from 'react';
import { useAgentContext, AgentStatusBadge } from '@/context/AgentContext';
import { Agent, AgentRole } from '@/services/agent.service';

// Agent role icons (Greek deity symbols)
const roleIcons: Record<AgentRole, string> = {
  zeus: '\u26A1',         // Lightning bolt
  athena: '\u{1F989}',    // Owl
  hermes: '\u{1F4E8}',    // Envelope
  chronos: '\u23F0',      // Timer
  mnemosyne: '\u{1F9E0}', // Brain
  hephaestus: '\u{1F528}', // Hammer
  apollo: '\u2600',       // Sun
  argus: '\u{1F6E1}',     // Shield
  prometheus: '\u{1F525}', // Fire
  daedalus: '\u2699',     // Gear
  iris: '\u{1F441}',      // Eye
  hestia: '\u{1F3E0}',    // House
  thoth: '\u{1F4DC}',     // Scroll
  custom: '\u{1F916}',    // Robot
};

// Agent role colors
const roleColors: Record<AgentRole, string> = {
  zeus: 'from-yellow-400 to-orange-500',
  athena: 'from-purple-400 to-indigo-500',
  hermes: 'from-blue-400 to-cyan-500',
  chronos: 'from-gray-400 to-gray-600',
  mnemosyne: 'from-pink-400 to-rose-500',
  hephaestus: 'from-orange-400 to-red-500',
  apollo: 'from-yellow-300 to-yellow-500',
  argus: 'from-emerald-400 to-teal-500',
  prometheus: 'from-red-400 to-orange-500',
  daedalus: 'from-violet-400 to-purple-500',
  iris: 'from-teal-400 to-cyan-500',
  hestia: 'from-stone-400 to-stone-600',
  thoth: 'from-blue-400 to-indigo-500',
  custom: 'from-gray-400 to-gray-600',
};

interface AgentSelectorProps {
  value?: string;
  onChange?: (agentId: string, agent: Agent) => void;
  filter?: (agent: Agent) => boolean;
  placeholder?: string;
  disabled?: boolean;
  showStatus?: boolean;
  showDescription?: boolean;
  variant?: 'dropdown' | 'grid' | 'list';
  className?: string;
}

export function AgentSelector({
  value,
  onChange,
  filter,
  placeholder = 'Select an agent...',
  disabled = false,
  showStatus = true,
  showDescription = true,
  variant = 'dropdown',
  className = '',
}: AgentSelectorProps) {
  const { agents, loading, isAgentAvailable } = useAgentContext();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter agents
  const filteredAgents = agents
    .filter((agent) => !filter || filter(agent))
    .filter(
      (agent) =>
        agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        agent.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
        agent.description.toLowerCase().includes(searchTerm.toLowerCase())
    );

  // Selected agent
  const selectedAgent = agents.find((a) => a.id === value);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle agent selection
  const handleSelect = (agent: Agent) => {
    onChange?.(agent.id, agent);
    setIsOpen(false);
    setSearchTerm('');
  };

  // Render agent item
  const renderAgentItem = (agent: Agent, isSelected: boolean = false) => (
    <div
      key={agent.id}
      onClick={() => !disabled && handleSelect(agent)}
      className={`
        flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all
        ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500' : ''}
        ${disabled || !isAgentAvailable(agent.id)
          ? 'opacity-50 cursor-not-allowed'
          : 'hover:bg-gray-100 dark:hover:bg-gray-800'}
      `}
    >
      {/* Agent avatar */}
      <div
        className={`
          w-10 h-10 rounded-full flex items-center justify-center text-white
          bg-gradient-to-br ${roleColors[agent.role]}
        `}
      >
        <span className="text-lg">{roleIcons[agent.role]}</span>
      </div>

      {/* Agent info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 dark:text-white truncate">
            {agent.name}
          </span>
          {showStatus && <AgentStatusBadge agentId={agent.id} size="sm" />}
        </div>
        {showDescription && (
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
            {agent.description}
          </p>
        )}
      </div>

      {/* Role badge */}
      <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-full capitalize">
        {agent.role}
      </span>
    </div>
  );

  // Dropdown variant
  if (variant === 'dropdown') {
    return (
      <div ref={containerRef} className={`relative ${className}`}>
        {/* Trigger button */}
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`
            w-full flex items-center gap-3 p-3 rounded-lg border
            bg-white dark:bg-gray-900 text-left
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-400'}
            ${isOpen ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-300 dark:border-gray-700'}
          `}
        >
          {selectedAgent ? (
            <>
              <div
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-white
                  bg-gradient-to-br ${roleColors[selectedAgent.role]}
                `}
              >
                <span>{roleIcons[selectedAgent.role]}</span>
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-medium text-gray-900 dark:text-white">
                  {selectedAgent.name}
                </span>
              </div>
              {showStatus && <AgentStatusBadge agentId={selectedAgent.id} size="sm" />}
            </>
          ) : (
            <span className="text-gray-500">{placeholder}</span>
          )}

          {/* Dropdown arrow */}
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown menu */}
        {isOpen && (
          <div className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 max-h-80 overflow-hidden">
            {/* Search input */}
            <div className="p-2 border-b border-gray-200 dark:border-gray-700">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search agents..."
                className="w-full px-3 py-2 rounded-md bg-gray-100 dark:bg-gray-800 border-0 focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>

            {/* Agent list */}
            <div className="overflow-y-auto max-h-60 p-2 space-y-1">
              {loading ? (
                <div className="p-4 text-center text-gray-500">Loading agents...</div>
              ) : filteredAgents.length === 0 ? (
                <div className="p-4 text-center text-gray-500">No agents found</div>
              ) : (
                filteredAgents.map((agent) =>
                  renderAgentItem(agent, agent.id === value)
                )
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Grid variant
  if (variant === 'grid') {
    return (
      <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 ${className}`}>
        {loading ? (
          [...Array(8)].map((_, i) => (
            <div
              key={i}
              className="p-4 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse"
            >
              <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 mb-3" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
            </div>
          ))
        ) : (
          filteredAgents.map((agent) => (
            <div
              key={agent.id}
              onClick={() => !disabled && handleSelect(agent)}
              className={`
                p-4 rounded-xl border-2 cursor-pointer transition-all
                ${agent.id === value
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}
                ${disabled || !isAgentAvailable(agent.id) ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <div className="flex items-center justify-between mb-3">
                <div
                  className={`
                    w-12 h-12 rounded-full flex items-center justify-center text-white
                    bg-gradient-to-br ${roleColors[agent.role]}
                  `}
                >
                  <span className="text-xl">{roleIcons[agent.role]}</span>
                </div>
                {showStatus && <AgentStatusBadge agentId={agent.id} />}
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                {agent.name}
              </h3>
              {showDescription && (
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-1">
                  {agent.description}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    );
  }

  // List variant
  return (
    <div className={`space-y-2 ${className}`}>
      {loading ? (
        [...Array(5)].map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 p-3 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse"
          >
            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700" />
            <div className="flex-1">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2 w-1/3" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
            </div>
          </div>
        ))
      ) : (
        filteredAgents.map((agent) => renderAgentItem(agent, agent.id === value))
      )}
    </div>
  );
}

export default AgentSelector;
