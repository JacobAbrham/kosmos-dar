'use client';

/**
 * KOSMOS AEOS SDUI Hook
 * Server-Driven UI state management and real-time updates
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useWebSocket } from './useWebSocket';
import {
  sduiService,
  SDUILayout,
  SDUIComponent,
  SDUIUpdate,
  SDUIEvent,
  SDUIAction,
} from '@/services/sdui.service';

// SDUI state
export interface SDUIState {
  layout: SDUILayout | null;
  data: Record<string, unknown>;
  loading: boolean;
  error: Error | null;
}

// Hook options
export interface UseSDUIOptions {
  screenSlug?: string;
  layoutId?: string;
  agentId?: string;
  taskId?: string;
  autoLoad?: boolean;
  onUpdate?: (update: SDUIUpdate) => void;
  onEvent?: (event: SDUIEvent) => void;
}

// Hook return type
export interface UseSDUIReturn {
  state: SDUIState;
  layout: SDUILayout | null;
  data: Record<string, unknown>;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  executeAction: (action: SDUIAction, context?: Record<string, unknown>) => Promise<void>;
  sendEvent: (event: Omit<SDUIEvent, 'timestamp'>) => Promise<void>;
  submitForm: (formId: string, data: Record<string, unknown>) => Promise<void>;
  updateComponent: (componentId: string, updates: Partial<SDUIComponent>) => void;
  setData: (key: string, value: unknown) => void;
  getComponent: (id: string) => SDUIComponent | undefined;
}

export function useSDUI(options: UseSDUIOptions = {}): UseSDUIReturn {
  const {
    screenSlug,
    layoutId,
    agentId,
    taskId,
    autoLoad = true,
    onUpdate,
    onEvent,
  } = options;

  const [state, setState] = useState<SDUIState>({
    layout: null,
    data: {},
    loading: false,
    error: null,
  });

  const mountedRef = useRef(true);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // WebSocket for real-time updates
  const { on, emit } = useWebSocket({
    onMessage: (message) => {
      if (message.type === 'sdui:update' && mountedRef.current) {
        const update = message.data as SDUIUpdate;
        applyUpdate(update);
        onUpdate?.(update);
      }
    },
  });

  // Load layout based on source
  const loadLayout = useCallback(async (): Promise<SDUILayout | null> => {
    if (screenSlug) {
      const screen = await sduiService.getScreen(screenSlug);
      return screen.layout;
    } else if (layoutId) {
      return await sduiService.getLayout(layoutId);
    } else if (agentId) {
      return await sduiService.getAgentUI(agentId);
    } else if (taskId) {
      return await sduiService.getTaskUI(taskId);
    }
    return null;
  }, [screenSlug, layoutId, agentId, taskId]);

  // Refresh layout
  // eslint-disable-next-line react-hooks/exhaustive-deps -- clearRefreshInterval causes infinite loop if included
  const refresh = useCallback(async () => {
    if (!mountedRef.current) return;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const layout = await loadLayout();
      if (mountedRef.current) {
        setState((prev) => ({
          ...prev,
          layout,
          data: layout?.data || {},
          loading: false,
        }));

        // Set up auto-refresh if specified
        if (layout?.meta?.refreshInterval) {
          clearRefreshInterval();
          refreshIntervalRef.current = setInterval(() => {
            refresh();
          }, layout.meta.refreshInterval * 1000);
        }
      }
    } catch (error) {
      if (mountedRef.current) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error : new Error('Failed to load layout'),
        }));
      }
    }
  }, [loadLayout]);

  // Clear refresh interval
  const clearRefreshInterval = useCallback(() => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
  }, []);

  // Apply update to layout
  const applyUpdate = useCallback((update: SDUIUpdate) => {
    setState((prev) => {
      if (!prev.layout) return prev;

      const newLayout = { ...prev.layout };
      const newData = { ...prev.data, ...update.data };

      switch (update.type) {
        case 'replace':
          if (update.component) {
            newLayout.root = replaceComponent(newLayout.root, update.targetId, update.component);
          }
          break;

        case 'patch':
          if (update.component) {
            newLayout.root = patchComponent(newLayout.root, update.targetId, update.component);
          }
          break;

        case 'append':
          if (update.component) {
            newLayout.root = appendComponent(newLayout.root, update.targetId, update.component);
          }
          break;

        case 'remove':
          newLayout.root = removeComponent(newLayout.root, update.targetId);
          break;
      }

      return { ...prev, layout: newLayout, data: newData };
    });
  }, []);

  // Helper: Replace component
  const replaceComponent = (
    root: SDUIComponent,
    targetId: string,
    newComponent: SDUIComponent
  ): SDUIComponent => {
    if (root.id === targetId) {
      return newComponent;
    }

    if (root.children) {
      return {
        ...root,
        children: root.children.map((child) => replaceComponent(child, targetId, newComponent)),
      };
    }

    return root;
  };

  // Helper: Patch component
  const patchComponent = (
    root: SDUIComponent,
    targetId: string,
    updates: Partial<SDUIComponent>
  ): SDUIComponent => {
    if (root.id === targetId) {
      return { ...root, ...updates };
    }

    if (root.children) {
      return {
        ...root,
        children: root.children.map((child) => patchComponent(child, targetId, updates)),
      };
    }

    return root;
  };

  // Helper: Append component
  const appendComponent = (
    root: SDUIComponent,
    targetId: string,
    newComponent: SDUIComponent
  ): SDUIComponent => {
    if (root.id === targetId) {
      return {
        ...root,
        children: [...(root.children || []), newComponent],
      };
    }

    if (root.children) {
      return {
        ...root,
        children: root.children.map((child) => appendComponent(child, targetId, newComponent)),
      };
    }

    return root;
  };

  // Helper: Remove component
  const removeComponent = (root: SDUIComponent, targetId: string): SDUIComponent => {
    if (root.id === targetId) {
      // This shouldn't happen at root level
      return root;
    }

    if (root.children) {
      return {
        ...root,
        children: root.children
          .filter((child) => child.id !== targetId)
          .map((child) => removeComponent(child, targetId)),
      };
    }

    return root;
  };

  // Execute action
  const executeAction = useCallback(
    async (action: SDUIAction, context: Record<string, unknown> = {}) => {
      try {
        const updates = await sduiService.executeAction(action, {
          ...state.data,
          ...context,
        });

        updates.forEach(applyUpdate);
      } catch (error) {
        console.error('Action execution failed:', error);
        throw error;
      }
    },
    [state.data, applyUpdate]
  );

  // Send event
  const sendEvent = useCallback(
    async (event: Omit<SDUIEvent, 'timestamp'>) => {
      const fullEvent: SDUIEvent = {
        ...event,
        timestamp: new Date().toISOString(),
      };

      onEvent?.(fullEvent);

      // Send via WebSocket for real-time
      emit('sdui:event', fullEvent);

      // Also send via API for persistence
      try {
        const updates = await sduiService.sendEvent(fullEvent);
        updates.forEach(applyUpdate);
      } catch (error) {
        console.error('Event send failed:', error);
      }
    },
    [emit, onEvent, applyUpdate]
  );

  // Submit form
  const submitForm = useCallback(
    async (formId: string, data: Record<string, unknown>) => {
      const result = await sduiService.submitForm(formId, data);

      if (result.updates) {
        result.updates.forEach(applyUpdate);
      }

      if (!result.success && result.errors) {
        throw new Error(Object.values(result.errors).join(', '));
      }
    },
    [applyUpdate]
  );

  // Update component locally
  const updateComponent = useCallback(
    (componentId: string, updates: Partial<SDUIComponent>) => {
      setState((prev) => {
        if (!prev.layout) return prev;

        return {
          ...prev,
          layout: {
            ...prev.layout,
            root: patchComponent(prev.layout.root, componentId, updates),
          },
        };
      });
    },
    []
  );

  // Set data value
  const setData = useCallback((key: string, value: unknown) => {
    setState((prev) => ({
      ...prev,
      data: { ...prev.data, [key]: value },
    }));
  }, []);

  // Get component by ID
  const getComponent = useCallback(
    (id: string): SDUIComponent | undefined => {
      if (!state.layout) return undefined;

      const findComponent = (component: SDUIComponent): SDUIComponent | undefined => {
        if (component.id === id) return component;

        if (component.children) {
          for (const child of component.children) {
            const found = findComponent(child);
            if (found) return found;
          }
        }

        return undefined;
      };

      return findComponent(state.layout.root);
    },
    [state.layout]
  );

  // Subscribe to SDUI updates
  useEffect(() => {
    const layoutId = state.layout?.id;
    if (layoutId) {
      const unsubscribe = on<SDUIUpdate>('sdui:update', (update) => {
        applyUpdate(update);
        onUpdate?.(update);
      });

      // Subscribe to layout channel
      emit('subscribe', { channels: [`sdui:${layoutId}`] });

      return () => {
        unsubscribe();
        emit('unsubscribe', { channels: [`sdui:${layoutId}`] });
      };
    }
  }, [state.layout?.id, on, emit, applyUpdate, onUpdate]);

  // Auto-load on mount
  useEffect(() => {
    mountedRef.current = true;

    if (autoLoad && (screenSlug || layoutId || agentId || taskId)) {
      refresh();
    }

    return () => {
      mountedRef.current = false;
      clearRefreshInterval();
    };
  }, [autoLoad, screenSlug, layoutId, agentId, taskId, refresh, clearRefreshInterval]);

  return {
    state,
    layout: state.layout,
    data: state.data,
    loading: state.loading,
    error: state.error,
    refresh,
    executeAction,
    sendEvent,
    submitForm,
    updateComponent,
    setData,
    getComponent,
  };
}

export default useSDUI;
