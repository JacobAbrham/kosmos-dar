'use client';

/**
 * KOSMOS AEOS SDUI Context
 * Server-Driven UI state provider
 */

import React, { createContext, useContext, ReactNode, useState, useCallback } from 'react';
import { useSDUI, UseSDUIReturn } from '@/hooks/useSDUI';
import {
  SDUILayout,
  SDUIComponent,
  SDUIUpdate,
  SDUIAction,
} from '@/services/sdui.service';

// Global SDUI state
interface SDUIGlobalState {
  currentScreen: string | null;
  layouts: Record<string, SDUILayout>;
  modals: SDUIComponent[];
  notifications: SDUIComponent[];
  theme: 'light' | 'dark' | 'system';
}

// Context value type
interface SDUIContextValue {
  // Global state
  globalState: SDUIGlobalState;
  setCurrentScreen: (screen: string) => void;
  cacheLayout: (id: string, layout: SDUILayout) => void;
  getCachedLayout: (id: string) => SDUILayout | undefined;
  clearCache: () => void;

  // Modal management
  openModal: (component: SDUIComponent) => void;
  closeModal: (id?: string) => void;
  closeAllModals: () => void;

  // Notifications
  showNotification: (component: SDUIComponent) => void;
  dismissNotification: (id: string) => void;
  clearNotifications: () => void;

  // Theme
  setTheme: (theme: 'light' | 'dark' | 'system') => void;

  // Current screen SDUI hook
  screenHook: UseSDUIReturn | null;
}

// Create context
const SDUIContext = createContext<SDUIContextValue | null>(null);

// Provider props
interface SDUIProviderProps {
  children: ReactNode;
  initialScreen?: string;
  initialTheme?: 'light' | 'dark' | 'system';
}

/**
 * SDUI Provider Component
 * Manages global SDUI state and provides screen-specific hooks
 */
export function SDUIProvider({
  children,
  initialScreen,
  initialTheme = 'system',
}: SDUIProviderProps) {
  // Global state
  const [globalState, setGlobalState] = useState<SDUIGlobalState>({
    currentScreen: initialScreen || null,
    layouts: {},
    modals: [],
    notifications: [],
    theme: initialTheme,
  });

  // Current screen SDUI hook
  const screenHook = useSDUI({
    screenSlug: globalState.currentScreen || undefined,
    autoLoad: !!globalState.currentScreen,
    onUpdate: (update) => {
      // Handle global updates (modals, notifications)
      if (update.type === 'append' && update.targetId === 'modals') {
        if (update.component) {
          setGlobalState((prev) => ({
            ...prev,
            modals: [...prev.modals, update.component!],
          }));
        }
      }
    },
  });

  // Set current screen
  const setCurrentScreen = useCallback((screen: string) => {
    setGlobalState((prev) => ({
      ...prev,
      currentScreen: screen,
    }));
  }, []);

  // Cache layout
  const cacheLayout = useCallback((id: string, layout: SDUILayout) => {
    setGlobalState((prev) => ({
      ...prev,
      layouts: { ...prev.layouts, [id]: layout },
    }));
  }, []);

  // Get cached layout
  const getCachedLayout = useCallback(
    (id: string): SDUILayout | undefined => {
      return globalState.layouts[id];
    },
    [globalState.layouts]
  );

  // Clear cache
  const clearCache = useCallback(() => {
    setGlobalState((prev) => ({
      ...prev,
      layouts: {},
    }));
  }, []);

  // Open modal
  const openModal = useCallback((component: SDUIComponent) => {
    setGlobalState((prev) => ({
      ...prev,
      modals: [...prev.modals, component],
    }));
  }, []);

  // Close modal
  const closeModal = useCallback((id?: string) => {
    setGlobalState((prev) => ({
      ...prev,
      modals: id
        ? prev.modals.filter((m) => m.id !== id)
        : prev.modals.slice(0, -1),
    }));
  }, []);

  // Close all modals
  const closeAllModals = useCallback(() => {
    setGlobalState((prev) => ({
      ...prev,
      modals: [],
    }));
  }, []);

  // Show notification
  const showNotification = useCallback((component: SDUIComponent) => {
    const id = component.id || `notification-${Date.now()}`;
    const notification = { ...component, id };

    setGlobalState((prev) => ({
      ...prev,
      notifications: [...prev.notifications, notification],
    }));

    // Auto-dismiss after 5 seconds if not persistent
    if (!component.props?.persistent) {
      setTimeout(() => {
        setGlobalState((prev) => ({
          ...prev,
          notifications: prev.notifications.filter((n) => n.id !== id),
        }));
      }, 5000);
    }
  }, []);

  // Dismiss notification
  const dismissNotification = useCallback((id: string) => {
    setGlobalState((prev) => ({
      ...prev,
      notifications: prev.notifications.filter((n) => n.id !== id),
    }));
  }, []);

  // Clear notifications
  const clearNotifications = useCallback(() => {
    setGlobalState((prev) => ({
      ...prev,
      notifications: [],
    }));
  }, []);

  // Set theme
  const setTheme = useCallback((theme: 'light' | 'dark' | 'system') => {
    setGlobalState((prev) => ({
      ...prev,
      theme,
    }));

    // Apply theme to document
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      root.classList.remove('light', 'dark');

      if (theme === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.classList.add(prefersDark ? 'dark' : 'light');
      } else {
        root.classList.add(theme);
      }
    }
  }, []);

  const value: SDUIContextValue = {
    globalState,
    setCurrentScreen,
    cacheLayout,
    getCachedLayout,
    clearCache,
    openModal,
    closeModal,
    closeAllModals,
    showNotification,
    dismissNotification,
    clearNotifications,
    setTheme,
    screenHook,
  };

  return (
    <SDUIContext.Provider value={value}>
      {children}
      {/* Modal container */}
      <ModalContainer modals={globalState.modals} onClose={closeModal} />
      {/* Notification container */}
      <NotificationContainer
        notifications={globalState.notifications}
        onDismiss={dismissNotification}
      />
    </SDUIContext.Provider>
  );
}

/**
 * Hook to use SDUI context
 */
export function useSDUIContext(): SDUIContextValue {
  const context = useContext(SDUIContext);

  if (!context) {
    throw new Error('useSDUIContext must be used within a SDUIProvider');
  }

  return context;
}

// Modal container component
interface ModalContainerProps {
  modals: SDUIComponent[];
  onClose: (id?: string) => void;
}

function ModalContainer({ modals, onClose }: ModalContainerProps) {
  if (modals.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onClose()}
      />
      {/* Modals stack */}
      {modals.map((modal, index) => (
        <div
          key={modal.id}
          className="absolute inset-0 flex items-center justify-center"
          style={{ zIndex: 51 + index }}
        >
          <div
            className="relative bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-lg w-full mx-4 animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            {modal.props?.title !== undefined && modal.props?.title !== null && (
              <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
                <h3 className="text-lg font-semibold">
                  {String(modal.props.title)}
                </h3>
                <button
                  onClick={() => onClose(modal.id)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
            {/* Modal content - would be rendered by SDUIRenderer */}
            <div className="p-4">
              {modal.props?.content !== undefined ? String(modal.props.content) : 'Modal content'}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Notification container component
interface NotificationContainerProps {
  notifications: SDUIComponent[];
  onDismiss: (id: string) => void;
}

function NotificationContainer({ notifications, onDismiss }: NotificationContainerProps) {
  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm w-full">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`
            p-4 rounded-lg shadow-lg animate-in slide-in-from-right
            ${notification.props?.variant === 'error' ? 'bg-red-500 text-white' : ''}
            ${notification.props?.variant === 'success' ? 'bg-green-500 text-white' : ''}
            ${notification.props?.variant === 'warning' ? 'bg-yellow-500 text-black' : ''}
            ${!notification.props?.variant ? 'bg-white dark:bg-gray-800 dark:text-white' : ''}
          `}
        >
          <div className="flex items-start gap-3">
            <div className="flex-1">
              {notification.props?.title !== undefined && notification.props?.title !== null && (
                <h4 className="font-semibold text-sm">
                  {String(notification.props.title)}
                </h4>
              )}
              <p className="text-sm opacity-90">
                {notification.props?.message !== undefined ? String(notification.props.message) : 'Notification'}
              </p>
            </div>
            <button
              onClick={() => onDismiss(notification.id)}
              className="p-1 hover:opacity-75 rounded"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default SDUIContext;
