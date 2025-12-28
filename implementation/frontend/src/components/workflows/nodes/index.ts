/**
 * KOSMOS AEOS Workflow Nodes
 * Centralized export for all workflow node components
 */

export * from './TriggerNode';
export { default as TriggerNode } from './TriggerNode';

export * from './AgentNode';
export { default as AgentNode } from './AgentNode';

export * from './ConditionNode';
export { default as ConditionNode } from './ConditionNode';

export * from './LoopNode';
export { default as LoopNode } from './LoopNode';

export * from './ActionNode';
export { default as ActionNode } from './ActionNode';

export * from './DelayNode';
export { default as DelayNode } from './DelayNode';

export * from './ParallelNode';
export { default as ParallelNode } from './ParallelNode';

export * from './EndNode';
export { default as EndNode } from './EndNode';

// Node type registry for React Flow
export const nodeTypes = {
  trigger: () => import('./TriggerNode').then((m) => m.default),
  agent: () => import('./AgentNode').then((m) => m.default),
  condition: () => import('./ConditionNode').then((m) => m.default),
  loop: () => import('./LoopNode').then((m) => m.default),
  action: () => import('./ActionNode').then((m) => m.default),
  delay: () => import('./DelayNode').then((m) => m.default),
  parallel: () => import('./ParallelNode').then((m) => m.default),
  end: () => import('./EndNode').then((m) => m.default),
};

// Node categories for the sidebar palette
export const nodeCategories = [
  {
    name: 'Flow Control',
    nodes: [
      { type: 'trigger', label: 'Trigger', description: 'Start workflow execution' },
      { type: 'condition', label: 'Condition', description: 'Branch based on conditions' },
      { type: 'loop', label: 'Loop', description: 'Repeat actions' },
      { type: 'parallel', label: 'Parallel', description: 'Execute in parallel' },
      { type: 'delay', label: 'Delay', description: 'Wait before continuing' },
      { type: 'end', label: 'End', description: 'Complete workflow' },
    ],
  },
  {
    name: 'Agents',
    nodes: [
      { type: 'agent', label: 'Agent', description: 'Execute agent task' },
    ],
  },
  {
    name: 'Actions',
    nodes: [
      { type: 'action', label: 'Action', description: 'Perform an action' },
    ],
  },
];
