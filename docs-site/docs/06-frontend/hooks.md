---
sidebar_position: 3
title: Custom Hooks
description: React hooks for KOSMOS functionality
---

# Custom Hooks

Reusable React hooks for common KOSMOS functionality.

## useAgent

Get agent status and metrics.

```typescript
function useAgent(agentId: string) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch and subscribe to agent updates

  return { agent, loading, refetch };
}
```

## useChat

Manage chat interactions with streaming support.

```typescript
function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const send = async (content: string) => {
    // Send message with SSE streaming
  };

  return { messages, send, isStreaming };
}
```

## useDebounce

Debounce values for search inputs.

```typescript
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
```

## useLocalStorage

Persist state to localStorage.

```typescript
function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : initialValue;
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
}
```
