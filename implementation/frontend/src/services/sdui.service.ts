/**
 * KOSMOS AEOS SDUI Service
 * Server-Driven UI API methods and types
 */

import { apiGet, apiPost, apiPatch } from './api';

// SDUI Component Types
export type SDUIComponentType =
  | 'container'
  | 'text'
  | 'button'
  | 'input'
  | 'card'
  | 'list'
  | 'table'
  | 'chart'
  | 'form'
  | 'modal'
  | 'alert'
  | 'progress'
  | 'tabs'
  | 'accordion'
  | 'image'
  | 'avatar'
  | 'badge'
  | 'divider'
  | 'skeleton'
  | 'markdown';

// Base component interface
export interface SDUIComponent {
  id: string;
  type: SDUIComponentType;
  props?: Record<string, unknown>;
  children?: SDUIComponent[];
  actions?: SDUIAction[];
  bindings?: SDUIBinding[];
  conditionals?: SDUIConditional[];
  styles?: SDUIStyles;
}

// Action types
export interface SDUIAction {
  type: 'navigate' | 'api_call' | 'set_state' | 'emit_event' | 'open_modal' | 'close_modal';
  trigger: 'click' | 'submit' | 'change' | 'load' | 'hover';
  payload: Record<string, unknown>;
  confirmation?: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
  };
}

// Data binding
export interface SDUIBinding {
  source: string; // Data path
  target: string; // Component property
  transform?: string; // Transform function name
}

// Conditional rendering
export interface SDUIConditional {
  condition: string; // Expression
  show?: boolean;
  hide?: boolean;
  disable?: boolean;
}

// Component styles
export interface SDUIStyles {
  className?: string;
  style?: Record<string, string | number>;
  variant?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

// Layout response from server
export interface SDUILayout {
  id: string;
  name: string;
  version: string;
  root: SDUIComponent;
  data?: Record<string, unknown>;
  meta?: {
    title?: string;
    description?: string;
    refreshInterval?: number;
  };
}

// Screen configuration
export interface SDUIScreen {
  id: string;
  slug: string;
  title: string;
  layout: SDUILayout;
  permissions?: string[];
  createdAt: string;
  updatedAt: string;
}

// Event from UI to server
export interface SDUIEvent {
  type: string;
  componentId: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

// Server response for UI updates
export interface SDUIUpdate {
  type: 'replace' | 'patch' | 'append' | 'remove';
  targetId: string;
  component?: SDUIComponent;
  data?: Record<string, unknown>;
}

// SDUI Service methods
export const sduiService = {
  /**
   * Get a screen layout by slug
   */
  getScreen: (slug: string): Promise<SDUIScreen> => {
    return apiGet<SDUIScreen>(`/api/v1/sdui/screens/${slug}`);
  },

  /**
   * Get a layout by ID
   */
  getLayout: (layoutId: string): Promise<SDUILayout> => {
    return apiGet<SDUILayout>(`/api/v1/sdui/layouts/${layoutId}`);
  },

  /**
   * Get agent-specific UI
   */
  getAgentUI: (agentId: string, context?: Record<string, unknown>): Promise<SDUILayout> => {
    return apiPost<SDUILayout>(`/api/v1/sdui/agents/${agentId}/ui`, { context });
  },

  /**
   * Get task-specific UI
   */
  getTaskUI: (taskId: string): Promise<SDUILayout> => {
    return apiGet<SDUILayout>(`/api/v1/sdui/tasks/${taskId}/ui`);
  },

  /**
   * Get dashboard layout
   */
  getDashboard: (dashboardId?: string): Promise<SDUILayout> => {
    const id = dashboardId || 'default';
    return apiGet<SDUILayout>(`/api/v1/sdui/dashboards/${id}`);
  },

  /**
   * Send UI event to server
   */
  sendEvent: (event: SDUIEvent): Promise<SDUIUpdate[]> => {
    return apiPost<SDUIUpdate[]>('/api/v1/sdui/events', event);
  },

  /**
   * Execute an action
   */
  executeAction: (
    action: SDUIAction,
    context: Record<string, unknown>
  ): Promise<SDUIUpdate[]> => {
    return apiPost<SDUIUpdate[]>('/api/v1/sdui/actions', { action, context });
  },

  /**
   * Submit form data
   */
  submitForm: (
    formId: string,
    data: Record<string, unknown>
  ): Promise<{ success: boolean; updates?: SDUIUpdate[]; errors?: Record<string, string> }> => {
    return apiPost(`/api/v1/sdui/forms/${formId}/submit`, data);
  },

  /**
   * Get component data (for dynamic lists, tables, etc.)
   */
  getComponentData: (
    componentId: string,
    params?: Record<string, unknown>
  ): Promise<Record<string, unknown>> => {
    return apiGet(`/api/v1/sdui/components/${componentId}/data`, params);
  },

  /**
   * Update component state
   */
  updateComponentState: (
    componentId: string,
    state: Record<string, unknown>
  ): Promise<SDUIUpdate[]> => {
    return apiPatch<SDUIUpdate[]>(`/api/v1/sdui/components/${componentId}/state`, state);
  },

  /**
   * Get available widgets for dashboard
   */
  getAvailableWidgets: (): Promise<SDUIComponent[]> => {
    return apiGet<SDUIComponent[]>('/api/v1/sdui/widgets');
  },

  /**
   * Save dashboard configuration
   */
  saveDashboard: (
    dashboardId: string,
    layout: SDUILayout
  ): Promise<{ success: boolean }> => {
    return apiPost(`/api/v1/sdui/dashboards/${dashboardId}`, layout);
  },
};

export default sduiService;
