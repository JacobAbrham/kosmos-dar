#!/usr/bin/env python3
"""
Extract frontend component documentation from React/TypeScript source.

This script:
1. Parses TSX component files
2. Extracts component names, props, and JSDoc comments
3. Generates Markdown documentation for UI components
4. Writes to docs-site/docs/06-frontend/
"""

import re
from pathlib import Path
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field

# Paths
PROJECT_ROOT = Path(__file__).parent.parent.parent
FRONTEND_SRC = PROJECT_ROOT / "implementation" / "frontend" / "src"
DOCS_OUTPUT = PROJECT_ROOT / "docs-site" / "docs" / "06-frontend"


@dataclass
class PropInfo:
    """Information about a component prop."""
    name: str
    type_hint: str
    required: bool
    description: Optional[str] = None
    default: Optional[str] = None


@dataclass
class ComponentInfo:
    """Information about a React component."""
    name: str
    file_path: str
    description: Optional[str]
    props: List[PropInfo] = field(default_factory=list)
    is_client: bool = False
    exports: List[str] = field(default_factory=list)


def parse_tsx_file(file_path: Path) -> List[ComponentInfo]:
    """Parse a TSX file and extract component information."""
    if not file_path.exists():
        return []

    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    components = []
    relative_path = str(file_path.relative_to(PROJECT_ROOT))

    # Check if client component
    is_client = "'use client'" in content or '"use client"' in content

    # Extract interfaces for props
    interfaces = extract_interfaces(content)

    # Find exported function components
    # Pattern: export function ComponentName() or export function ComponentName({...}: Props)
    func_pattern = r'(?:export\s+)?function\s+(\w+)\s*\(([^)]*)\)'
    for match in re.finditer(func_pattern, content):
        comp_name = match.group(1)
        params = match.group(2)

        # Skip non-component functions (lowercase start)
        if not comp_name[0].isupper():
            continue

        # Find preceding JSDoc comment
        preceding = content[:match.start()]
        doc_match = re.search(r'/\*\*\s*([\s\S]*?)\*\/\s*$', preceding)
        description = None
        if doc_match:
            description = clean_jsdoc(doc_match.group(1))

        # Extract props from interface
        props = []
        props_match = re.search(r'\{\s*([^}]+)\s*\}\s*:\s*(\w+)', params)
        if props_match:
            interface_name = props_match.group(2)
            if interface_name in interfaces:
                props = interfaces[interface_name]

        components.append(ComponentInfo(
            name=comp_name,
            file_path=relative_path,
            description=description,
            props=props,
            is_client=is_client,
            exports=[comp_name]
        ))

    return components


def extract_interfaces(content: str) -> Dict[str, List[PropInfo]]:
    """Extract TypeScript interfaces from content."""
    interfaces = {}

    # Pattern for interface definitions
    interface_pattern = r'interface\s+(\w+)\s*\{([^}]+)\}'

    for match in re.finditer(interface_pattern, content):
        name = match.group(1)
        body = match.group(2)

        props = []
        # Parse each property line
        prop_pattern = r'(\w+)(\?)?:\s*([^;]+);'
        for prop_match in re.finditer(prop_pattern, body):
            prop_name = prop_match.group(1)
            optional = prop_match.group(2) == '?'
            prop_type = prop_match.group(3).strip()

            props.append(PropInfo(
                name=prop_name,
                type_hint=prop_type,
                required=not optional
            ))

        interfaces[name] = props

    return interfaces


def clean_jsdoc(doc: str) -> str:
    """Clean JSDoc comment content."""
    lines = doc.strip().split('\n')
    cleaned = []
    for line in lines:
        line = re.sub(r'^\s*\*\s?', '', line)
        if not line.startswith('@'):
            cleaned.append(line)
    return ' '.join(cleaned).strip()


def generate_components_doc(components: List[ComponentInfo]) -> str:
    """Generate Markdown documentation for components."""
    doc = """---
sidebar_position: 1
title: UI Components
description: React component library for KOSMOS frontend
---

# UI Components

KOSMOS frontend components built with React, TypeScript, and Tailwind CSS.

:::info Auto-Generated
This documentation is automatically extracted from component source files.
:::

## Component Library

| Component | File | Client | Props |
|-----------|------|--------|-------|
"""

    for comp in components:
        client = "Yes" if comp.is_client else "No"
        prop_count = len(comp.props)
        doc += f"| `{comp.name}` | `{comp.file_path}` | {client} | {prop_count} |\n"

    doc += "\n"

    # Detailed component docs
    for comp in components:
        doc += f"## {comp.name}\n\n"

        if comp.description:
            doc += f"{comp.description}\n\n"

        doc += f"**Source:** `{comp.file_path}`\n\n"

        if comp.is_client:
            doc += ":::note Client Component\nThis is a client-side component using React hooks.\n:::\n\n"

        if comp.props:
            doc += "### Props\n\n"
            doc += "| Prop | Type | Required | Description |\n"
            doc += "|------|------|----------|-------------|\n"
            for prop in comp.props:
                required = "Yes" if prop.required else "No"
                desc = prop.description or "-"
                doc += f"| `{prop.name}` | `{prop.type_hint}` | {required} | {desc} |\n"
            doc += "\n"

        # Add usage example
        props_str = ""
        if comp.props:
            example_props = [f'{p.name}={{...}}' for p in comp.props[:2]]
            props_str = " " + " ".join(example_props)

        doc += f"""### Usage

```tsx
import {{ {comp.name} }} from '@/components/{comp.name}';

function MyPage() {{
  return <{comp.name}{props_str} />;
}}
```

"""

    return doc


def generate_stores_doc() -> str:
    """Generate documentation for state stores."""
    return """---
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
"""


def generate_hooks_doc() -> str:
    """Generate documentation for custom hooks."""
    return """---
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
"""


def main():
    print("=" * 60)
    print("KOSMOS Frontend Documentation Extractor")
    print("=" * 60)
    print(f"\nSource: {FRONTEND_SRC}")
    print(f"Output: {DOCS_OUTPUT}\n")

    # Ensure output directory exists
    DOCS_OUTPUT.mkdir(parents=True, exist_ok=True)

    components = []

    # Scan components directory
    components_dir = FRONTEND_SRC / "components"
    if components_dir.exists():
        for tsx_file in components_dir.glob("*.tsx"):
            file_components = parse_tsx_file(tsx_file)
            components.extend(file_components)
            if file_components:
                print(f"   [OK] {tsx_file.name}: {len(file_components)} components")

    # Scan app directory for page components
    app_dir = FRONTEND_SRC / "app"
    if app_dir.exists():
        for tsx_file in app_dir.glob("*.tsx"):
            file_components = parse_tsx_file(tsx_file)
            components.extend(file_components)

    # Generate component documentation
    if components:
        doc_content = generate_components_doc(components)
        output_file = DOCS_OUTPUT / "components.md"
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(doc_content)
        print(f"[OK] {len(components)} components -> components.md")
    else:
        print("[WARN] No components found")

    # Generate stores documentation
    stores_doc = generate_stores_doc()
    stores_file = DOCS_OUTPUT / "state-management.md"
    with open(stores_file, "w", encoding="utf-8") as f:
        f.write(stores_doc)
    print(f"[OK] State management -> state-management.md")

    # Generate hooks documentation
    hooks_doc = generate_hooks_doc()
    hooks_file = DOCS_OUTPUT / "hooks.md"
    with open(hooks_file, "w", encoding="utf-8") as f:
        f.write(hooks_doc)
    print(f"[OK] Custom hooks -> hooks.md")

    print(f"\n[OK] Frontend documentation extraction complete")


if __name__ == "__main__":
    main()
