'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState, useEffect } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Lazy load context providers to handle failures gracefully
function SafeWebSocketProvider({ children }: { children: ReactNode }) {
  const [WebSocketProvider, setWebSocketProvider] = useState<React.ComponentType<{ children: ReactNode }> | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    import('@/context/WebSocketContext')
      .then((mod) => {
        setWebSocketProvider(() => mod.WebSocketProvider);
      })
      .catch(() => {
        console.warn('WebSocket provider failed to load, continuing without real-time updates');
        setError(true);
      });
  }, []);

  if (error || !WebSocketProvider) {
    // Render children without WebSocket - app still works, just no real-time
    return <>{children}</>;
  }

  return <WebSocketProvider>{children}</WebSocketProvider>;
}

function SafeAgentProvider({ children }: { children: ReactNode }) {
  const [AgentProvider, setAgentProvider] = useState<React.ComponentType<{ children: ReactNode }> | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    import('@/context/AgentContext')
      .then((mod) => {
        setAgentProvider(() => mod.AgentProvider);
        setLoaded(true);
      })
      .catch(() => {
        console.warn('Agent provider failed to load');
        setLoaded(true);
      });
  }, []);

  if (!loaded) {
    return <>{children}</>;
  }

  if (!AgentProvider) {
    return <>{children}</>;
  }

  return <AgentProvider>{children}</AgentProvider>;
}

function SafeSDUIProvider({ children }: { children: ReactNode }) {
  const [SDUIProvider, setSDUIProvider] = useState<React.ComponentType<{ children: ReactNode }> | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    import('@/context/SDUIContext')
      .then((mod) => {
        setSDUIProvider(() => mod.SDUIProvider);
        setLoaded(true);
      })
      .catch(() => {
        console.warn('SDUI provider failed to load');
        setLoaded(true);
      });
  }, []);

  if (!loaded) {
    return <>{children}</>;
  }

  if (!SDUIProvider) {
    return <>{children}</>;
  }

  return <SDUIProvider>{children}</SDUIProvider>;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SafeWebSocketProvider>
          <SafeAgentProvider>
            <SafeSDUIProvider>
              {children}
            </SafeSDUIProvider>
          </SafeAgentProvider>
        </SafeWebSocketProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
