'use client';

/**
 * KOSMOS AEOS WebSocket Hook
 * Native WebSocket connection management with auto-reconnect
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { getAccessToken } from '@/services/api';

// WebSocket configuration - derive from API URL
const getWebSocketUrl = (): string => {
  if (typeof window === 'undefined') {
    return 'ws://localhost:8000';
  }

  const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
  if (wsUrl) {
    return wsUrl;
  }

  // Derive from current location for development
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  
  // In development with Next.js rewrites, connect to backend
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (apiUrl) {
    try {
      const url = new URL(apiUrl);
      return `${protocol}//${url.host}`;
    } catch {
      // Fall through to default
    }
  }

  return `${protocol}//${host}`;
};

const RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;
const RECONNECT_MULTIPLIER = 1.5;
const MAX_RECONNECT_ATTEMPTS = 10;

// Connection status
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

// WebSocket event types
export type WebSocketEventType =
  | 'agent:status'
  | 'agent:message'
  | 'agent:stream'
  | 'agent:tool_call'
  | 'task:created'
  | 'task:updated'
  | 'task:completed'
  | 'task:failed'
  | 'approval:requested'
  | 'approval:resolved'
  | 'sdui:update'
  | 'notification'
  | 'connected'
  | 'ping'
  | 'error';

// WebSocket message
export interface WebSocketMessage<T = unknown> {
  type: WebSocketEventType;
  data?: T;
  timestamp?: string;
  correlationId?: string;
  session_id?: string;
  connection_id?: string;
  message?: string;
}

// Hook options
export interface UseWebSocketOptions {
  autoConnect?: boolean;
  reconnect?: boolean;
  namespace?: string;
  query?: Record<string, string>;
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
  onError?: (error: Error) => void;
  onMessage?: (message: WebSocketMessage) => void;
}

// Hook return type
export interface UseWebSocketReturn {
  socket: WebSocket | null;
  status: ConnectionStatus;
  connect: () => void;
  disconnect: () => void;
  emit: <T>(event: string, data: T) => void;
  on: <T>(event: WebSocketEventType, handler: (data: T) => void) => () => void;
  off: (event: WebSocketEventType) => void;
  subscribe: (channels: string[]) => void;
  unsubscribe: (channels: string[]) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const {
    autoConnect = true,
    reconnect = true,
    namespace = '',
    query = {},
    onConnect,
    onDisconnect,
    onError,
    onMessage,
  } = options;

  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  const eventHandlers = useRef<Map<WebSocketEventType, Set<(data: unknown) => void>>>(new Map());

  // Clear reconnect timeout
  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = null;
    }
  }, []);

  // Schedule reconnection with exponential backoff
  // eslint-disable-next-line react-hooks/exhaustive-deps -- connect is intentionally omitted to prevent reconnect loops
  const scheduleReconnect = useCallback(() => {
    if (!reconnect || !mountedRef.current) return;
    if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
      console.warn('[WebSocket] Max reconnection attempts reached');
      setStatus('error');
      return;
    }

    clearReconnectTimeout();

    const delay = Math.min(
      RECONNECT_DELAY * Math.pow(RECONNECT_MULTIPLIER, reconnectAttempts.current),
      MAX_RECONNECT_DELAY
    );

    reconnectTimeout.current = setTimeout(() => {
      reconnectAttempts.current++;
      connect();
    }, delay);
  }, [reconnect, clearReconnectTimeout]);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (socketRef.current?.readyState === WebSocket.OPEN) return;

    const token = getAccessToken();
    const tenantId = localStorage.getItem('kosmos_tenant_id') || '';

    // Build WebSocket URL with query params
    const queryParams = new URLSearchParams({
      ...query,
      ...(token ? { token } : {}),
      ...(tenantId ? { tenant_id: tenantId } : {}),
    });

    // Use /ws/sdui endpoint for SDUI WebSocket
    const wsPath = namespace ? `/${namespace}` : '/ws/sdui';
    const baseUrl = getWebSocketUrl();
    const url = `${baseUrl}${wsPath}?${queryParams.toString()}`;

    setStatus('connecting');

    try {
      socketRef.current = new WebSocket(url);

      socketRef.current.onopen = () => {
        if (!mountedRef.current) return;
        setStatus('connected');
        reconnectAttempts.current = 0;
        clearReconnectTimeout();
        onConnect?.();
      };

      socketRef.current.onclose = (event) => {
        if (!mountedRef.current) return;
        setStatus('disconnected');
        onDisconnect?.(event.reason || 'Connection closed');

        // Auto-reconnect if enabled and not manually closed
        if (reconnect && event.code !== 1000) {
          scheduleReconnect();
        }
      };

      socketRef.current.onerror = () => {
        if (!mountedRef.current) return;
        // Don't set error status immediately - let onclose handle reconnection
        onError?.(new Error('WebSocket connection error'));
      };

      socketRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          // Call global message handler
          onMessage?.(message);

          // Call type-specific handlers
          const handlers = eventHandlers.current.get(message.type);
          if (handlers) {
            handlers.forEach((handler) => handler(message.data || message));
          }

          // Handle ping messages with pong response
          if (message.type === 'ping') {
            socketRef.current?.send(JSON.stringify({
              type: 'pong',
              timestamp: new Date().toISOString(),
            }));
          }
        } catch {
          // Not JSON, ignore or handle as raw message
        }
      };
    } catch (error) {
      setStatus('error');
      onError?.(error instanceof Error ? error : new Error('Failed to connect'));
      if (reconnect) {
        scheduleReconnect();
      }
    }
  }, [namespace, query, reconnect, onConnect, onDisconnect, onError, onMessage, clearReconnectTimeout, scheduleReconnect]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    clearReconnectTimeout();
    reconnectAttempts.current = MAX_RECONNECT_ATTEMPTS; // Prevent auto-reconnect
    if (socketRef.current) {
      socketRef.current.close(1000, 'Client disconnect');
      socketRef.current = null;
    }
    setStatus('disconnected');
  }, [clearReconnectTimeout]);

  // Emit event (send message)
  const emit = useCallback(<T>(event: string, data: T) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: event,
        ...data,
        timestamp: new Date().toISOString(),
      }));
    }
  }, []);

  // Subscribe to event type
  const on = useCallback(<T>(event: WebSocketEventType, handler: (data: T) => void) => {
    if (!eventHandlers.current.has(event)) {
      eventHandlers.current.set(event, new Set());
    }
    eventHandlers.current.get(event)!.add(handler as (data: unknown) => void);

    // Return unsubscribe function
    return () => {
      const handlers = eventHandlers.current.get(event);
      if (handlers) {
        handlers.delete(handler as (data: unknown) => void);
      }
    };
  }, []);

  // Unsubscribe from event type
  const off = useCallback((event: WebSocketEventType) => {
    eventHandlers.current.delete(event);
  }, []);

  // Subscribe to channels
  const subscribe = useCallback((channels: string[]) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'subscribe',
        channels,
      }));
    }
  }, []);

  // Unsubscribe from channels
  const unsubscribe = useCallback((channels: string[]) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'unsubscribe',
        channels,
      }));
    }
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    mountedRef.current = true;

    if (autoConnect) {
      // Delay connection slightly to ensure DOM is ready
      const timer = setTimeout(() => {
        if (mountedRef.current) {
          connect();
        }
      }, 100);

      return () => {
        clearTimeout(timer);
        mountedRef.current = false;
        disconnect();
      };
    }

    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    socket: socketRef.current,
    status,
    connect,
    disconnect,
    emit,
    on,
    off,
    subscribe,
    unsubscribe,
  };
}

export default useWebSocket;
