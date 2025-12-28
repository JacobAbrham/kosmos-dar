'use client';

/**
 * KOSMOS AEOS Agent Configuration
 * Configuration panel for agent settings
 */

import React, { useState, useEffect } from 'react';
import { useAgentContext } from '@/context/AgentContext';
import { agentService, Agent, AgentConfig as AgentConfigType } from '@/services/agent.service';

interface AgentConfigProps {
  agentId: string;
  onSave?: (config: AgentConfigType) => void;
  onCancel?: () => void;
  readonly?: boolean;
  className?: string;
}

interface ConfigSection {
  title: string;
  description: string;
  fields: ConfigField[];
}

interface ConfigField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'toggle' | 'slider' | 'multiselect' | 'json';
  description?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
}

export function AgentConfigPanel({
  agentId,
  onSave,
  onCancel,
  readonly = false,
  className = '',
}: AgentConfigProps) {
  const { getAgent } = useAgentContext();
  const agent = getAgent(agentId);

  const [config, setConfig] = useState<AgentConfigType | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Load agent config
  useEffect(() => {
    if (agent) {
      setConfig({ ...agent.config });
    }
  }, [agent]);

  if (!agent || !config) {
    return (
      <div className={`animate-pulse space-y-4 ${className}`}>
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded" />
          ))}
        </div>
      </div>
    );
  }

  // Configuration sections
  const sections: ConfigSection[] = [
    {
      title: 'Model Settings',
      description: 'Configure the AI model behavior',
      fields: [
        {
          key: 'model',
          label: 'Model',
          type: 'select',
          description: 'The AI model to use for this agent',
          options: [
            { value: 'claude-3-opus', label: 'Claude 3 Opus' },
            { value: 'claude-3-sonnet', label: 'Claude 3 Sonnet' },
            { value: 'claude-3-haiku', label: 'Claude 3 Haiku' },
            { value: 'gpt-4', label: 'GPT-4' },
            { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
          ],
        },
        {
          key: 'temperature',
          label: 'Temperature',
          type: 'slider',
          description: 'Controls randomness in responses (0 = deterministic, 1 = creative)',
          min: 0,
          max: 1,
          step: 0.1,
        },
        {
          key: 'maxTokens',
          label: 'Max Tokens',
          type: 'number',
          description: 'Maximum tokens in response',
          min: 100,
          max: 128000,
        },
      ],
    },
    {
      title: 'Rate Limiting',
      description: 'Control API usage limits',
      fields: [
        {
          key: 'rateLimit.requestsPerMinute',
          label: 'Requests per Minute',
          type: 'number',
          description: 'Maximum requests allowed per minute',
          min: 1,
          max: 1000,
        },
        {
          key: 'rateLimit.tokensPerMinute',
          label: 'Tokens per Minute',
          type: 'number',
          description: 'Maximum tokens allowed per minute',
          min: 1000,
          max: 1000000,
        },
      ],
    },
    {
      title: 'Retry Policy',
      description: 'Configure error handling and retries',
      fields: [
        {
          key: 'retryPolicy.maxRetries',
          label: 'Max Retries',
          type: 'number',
          description: 'Maximum retry attempts on failure',
          min: 0,
          max: 10,
        },
        {
          key: 'retryPolicy.backoffMultiplier',
          label: 'Backoff Multiplier',
          type: 'number',
          description: 'Delay multiplier between retries',
          min: 1,
          max: 5,
          step: 0.5,
        },
        {
          key: 'timeout',
          label: 'Timeout (seconds)',
          type: 'number',
          description: 'Request timeout in seconds',
          min: 10,
          max: 600,
        },
      ],
    },
    {
      title: 'Governance',
      description: 'Human-in-the-loop settings',
      fields: [
        {
          key: 'governance.requireApproval',
          label: 'Require Approval',
          type: 'toggle',
          description: 'Require human approval before executing actions',
        },
        {
          key: 'governance.approvalThreshold',
          label: 'Approval Threshold',
          type: 'select',
          description: 'Minimum risk level requiring approval',
          options: [
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
            { value: 'critical', label: 'Critical Only' },
          ],
        },
      ],
    },
  ];

  // Get nested value from config
  const getNestedValue = (obj: Record<string, unknown>, path: string): unknown => {
    return path.split('.').reduce((current, key) => {
      if (current && typeof current === 'object') {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj as unknown);
  };

  // Set nested value in config
  const setNestedValue = (obj: Record<string, unknown>, path: string, value: unknown): void => {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      return current[key] as Record<string, unknown>;
    }, obj);
    target[lastKey] = value;
  };

  // Handle field change
  const handleChange = (key: string, value: unknown) => {
    setConfig((prev) => {
      if (!prev) return null;
      const newConfig = { ...prev };
      setNestedValue(newConfig as unknown as Record<string, unknown>, key, value);
      return newConfig;
    });
    setIsDirty(true);
  };

  // Handle save
  const handleSave = async () => {
    if (!config) return;

    setSaving(true);
    setError(null);

    try {
      const updatedAgent = await agentService.updateConfig(agentId, config);
      setIsDirty(false);
      onSave?.(updatedAgent.config);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  // Render field
  const renderField = (field: ConfigField) => {
    const value = getNestedValue(config as unknown as Record<string, unknown>, field.key);

    switch (field.type) {
      case 'text':
        return (
          <input
            type="text"
            value={(value as string) || ''}
            onChange={(e) => handleChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            disabled={readonly}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 disabled:opacity-50"
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={(value as number) || ''}
            onChange={(e) => handleChange(field.key, parseFloat(e.target.value))}
            min={field.min}
            max={field.max}
            step={field.step}
            disabled={readonly}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 disabled:opacity-50"
          />
        );

      case 'select':
        return (
          <select
            value={(value as string) || ''}
            onChange={(e) => handleChange(field.key, e.target.value)}
            disabled={readonly}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 disabled:opacity-50"
          >
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case 'toggle':
        return (
          <button
            type="button"
            onClick={() => !readonly && handleChange(field.key, !value)}
            disabled={readonly}
            className={`
              relative inline-flex h-6 w-11 items-center rounded-full transition-colors
              ${value ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}
              ${readonly ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <span
              className={`
                inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                ${value ? 'translate-x-6' : 'translate-x-1'}
              `}
            />
          </button>
        );

      case 'slider':
        return (
          <div className="flex items-center gap-3">
            <input
              type="range"
              value={(value as number) || field.min || 0}
              onChange={(e) => handleChange(field.key, parseFloat(e.target.value))}
              min={field.min}
              max={field.max}
              step={field.step}
              disabled={readonly}
              className="flex-1"
            />
            <span className="w-12 text-right text-sm font-medium">
              {(value as number)?.toFixed(1) || field.min}
            </span>
          </div>
        );

      case 'multiselect':
        return (
          <div className="flex flex-wrap gap-2">
            {field.options?.map((option) => {
              const isSelected = Array.isArray(value) && value.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    if (readonly) return;
                    const current = Array.isArray(value) ? value : [];
                    const newValue = isSelected
                      ? current.filter((v) => v !== option.value)
                      : [...current, option.value];
                    handleChange(field.key, newValue);
                  }}
                  disabled={readonly}
                  className={`
                    px-3 py-1 rounded-full text-sm transition-colors
                    ${isSelected
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}
                    ${readonly ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80'}
                  `}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        );

      case 'json':
        return (
          <textarea
            value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
            onChange={(e) => {
              try {
                handleChange(field.key, JSON.parse(e.target.value));
              } catch {
                // Keep as string if invalid JSON
                handleChange(field.key, e.target.value);
              }
            }}
            disabled={readonly}
            rows={4}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 font-mono text-sm disabled:opacity-50"
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          {agent.name} Configuration
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Configure settings for {agent.role} agent
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
          {error}
        </div>
      )}

      {/* Sections */}
      {sections.map((section) => (
        <div
          key={section.title}
          className="p-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            {section.title}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {section.description}
          </p>

          <div className="space-y-4">
            {section.fields.map((field) => (
              <div key={field.key}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {field.label}
                </label>
                {renderField(field)}
                {field.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {field.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Actions */}
      {!readonly && (
        <div className="flex justify-end gap-3">
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!isDirty || saving}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {saving && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  );
}

export default AgentConfigPanel;
