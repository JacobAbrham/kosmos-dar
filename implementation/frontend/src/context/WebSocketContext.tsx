'use client';

/**
 * KOSMOS AEOS WebSocket Context
 * Global WebSocket connection provider
 */

import React, { createContext, useContext, ReactNode } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import type { UseWebSocketReturn, ConnectionStatus } from '@/hooks/useWebSocket';

// Context value type
interface WebSocketContextValue extends UseWebSocketReturn {
  // Additional context-specific methods
  isOnline: boolean;
}

// Create context
const WebSocketContext = createContext<WebSocketContextValue | null>(null);

// Provider props
interface WebSocketProviderProps {
  children: ReactNode;
  namespace?: string;
  autoConnect?: boolean;
}

/**
 * WebSocket Provider Component
 * Provides global WebSocket connection to all children
 */
export function WebSocketProvider({
  children,
  namespace = '',
  autoConnect = true,
}: WebSocketProviderProps) {
  const wsHook = useWebSocket({
    namespace,
    autoConnect,
    reconnect: true,
    onConnect: () => {
      console.log('[WebSocket] Connected');
    },
    onDisconnect: (reason) => {
      console.log('[WebSocket] Disconnected:', reason);
    },
    onError: (error) => {
      console.error('[WebSocket] Error:', error);
    },
  });

  const value: WebSocketContextValue = {
    ...wsHook,
    isOnline: wsHook.status === 'connected',
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

/**
 * Hook to use WebSocket context
 */
export function useWebSocketContext(): WebSocketContextValue {
  const context = useContext(WebSocketContext);

  if (!context) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }

  return context;
}

/**
 * HOC to inject WebSocket context
 */
export function withWebSocket<P extends object>(
  WrappedComponent: React.ComponentType<P & { ws: WebSocketContextValue }>
) {
  return function WithWebSocketComponent(props: P) {
    const ws = useWebSocketContext();
    return <WrappedComponent {...props} ws={ws} />;
  };
}

// Connection status indicator component
interface ConnectionStatusProps {
  showText?: boolean;
  className?: string;
}

export function ConnectionStatus({ showText = false, className = '' }: ConnectionStatusProps) {
  const { status, isOnline } = useWebSocketContext();

  const statusColors: Record<ConnectionStatus, string> = {
    connected: 'bg-green-500',
    connecting: 'bg-yellow-500',
    disconnected: 'bg-gray-500',
    error: 'bg-red-500',
  };

  const statusLabels: Record<ConnectionStatus, string> = {
    connected: 'Connected',
    connecting: 'Connecting...',
    disconnected: 'Disconnected',
    error: 'Connection Error',
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        className={`w-2 h-2 rounded-full ${statusColors[status]} ${
          status === 'connecting' ? 'animate-pulse' : ''
        }`}
        title={statusLabels[status]}
      />
      {showText && (
        <span className="text-sm text-gray-500">{statusLabels[status]}</span>
      )}
    </div>
  );
}

export default WebSocketContext;
