---
sidebar_position: 2
title: State Management
description: Zustand stores for KOSMOS frontend state
---

# State Management

KOSMOS uses Zustand for lightweight, TypeScript-first state management.

## Stores

### ConversationStore

Manages conversation state and message history.

```typescript
interface ConversationStore {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Message[];

  // Actions
  sendMessage: (content: string) => Promise<void>;
  loadConversation: (id: string) => Promise<void>;
  createConversation: () => Promise<string>;
}
```

### AgentStore

Tracks agent statuses and metrics.

```typescript
interface AgentStore {
  agents: Agent[];

  // Actions
  refreshAgents: () => Promise<void>;
  getAgent: (id: string) => Agent | undefined;
}
```

### UIStore

Manages UI state like sidebar, theme, modals.

```typescript
interface UIStore {
  sidebarOpen: boolean;
  theme: 'light' | 'dark' | 'system';

  // Actions
  toggleSidebar: () => void;
  setTheme: (theme: Theme) => void;
}
```

## Usage

```typescript
import { useConversationStore } from '@/stores/conversation';

function ChatInput() {
  const { sendMessage } = useConversationStore();

  const handleSend = () => {
    sendMessage('Hello, KOSMOS!');
  };

  return <button onClick={handleSend}>Send</button>;
}
```
