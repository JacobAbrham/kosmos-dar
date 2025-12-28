# KOSMOS UII (User Intent Interface) Architecture

## Vision Statement

KOSMOS eliminates the productivity tax of context-switching by providing a **single adaptive workspace** that morphs to user intent rather than forcing users to navigate between disconnected interfaces.

> "The interface serves the user's flow, not the other way around."

---

## Core Principles

### 1. Zero Context Switch
- User never leaves the workspace
- External tools (WhatsApp, Slack, Email, Calendar) render **within** KOSMOS
- No new tabs, no new windows, no lost focus

### 2. Intent-Driven Adaptation
- UI morphs based on detected user intent
- Irrelevant controls fade/hide automatically
- Relevant tools surface proactively

### 3. Information Density Without Overload
- Binance-style: everything visible but organized
- Progressive disclosure based on expertise level
- Ambient awareness without interruption

### 4. Persistent Context
- Current task/conversation always visible
- Quick-access to recent contexts
- Workspace state persists across sessions

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         KOSMOS WORKSPACE SHELL                          │
├─────────────────────────────────────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────────────────────────────────────────────────────┐ │
│ │         │ │                    COMMAND BAR                          │ │
│ │         │ │  [🔍 Ask KOSMOS anything... (⌘K)]           [👤] [⚙️] [🔔]│ │
│ │         │ └─────────────────────────────────────────────────────────┘ │
│ │         │ ┌─────────────────────────────────────────────────────────┐ │
│ │  DOCK   │ │                                                         │ │
│ │         │ │                                                         │ │
│ │ [💬]    │ │                   MAIN CANVAS                           │ │
│ │ [📊]    │ │              (Intent-Adaptive Area)                     │ │
│ │ [📅]    │ │                                                         │ │
│ │ [📁]    │ │    Renders based on current intent:                     │ │
│ │ [⚡]    │ │    - Conversation view                                  │ │
│ │         │ │    - Analytics dashboard                                │ │
│ │ ─────── │ │    - WhatsApp panel                                     │ │
│ │ [WA]    │ │    - Email composer                                     │ │
│ │ [📧]    │ │    - Calendar                                           │ │
│ │ [SL]    │ │    - Code editor                                        │ │
│ │         │ │    - Document viewer                                    │ │
│ │         │ │                                                         │ │
│ │         │ └─────────────────────────────────────────────────────────┘ │
│ │         │ ┌─────────────────────────────────────────────────────────┐ │
│ │         │ │ CONTEXT BAR: [Active: Sales Analysis] [📎 3] [🤖 Athena]│ │
│ └─────────┘ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘

OVERLAY PANELS (slide in from edges, don't replace content):
┌──────────────┐
│ Quick Reply  │  ← WhatsApp message slides in from right
│ [John: Hey]  │     User can respond without leaving current task
│ [Reply...]   │
└──────────────┘
```

---

## Component Hierarchy

```
WorkspaceShell (persistent)
├── CommandBar (always visible, ⌘K activated)
├── Dock (left edge, collapsible)
│   ├── CoreTools (Chat, Analytics, Calendar, Files, Workflows)
│   └── Integrations (WhatsApp, Slack, Email, etc.)
├── MainCanvas (adaptive center)
│   └── IntentRenderer (switches view based on intent)
├── ContextBar (bottom, shows current task context)
├── OverlayManager (handles slide-in panels)
│   ├── QuickReplyPanel
│   ├── NotificationPanel
│   ├── PreviewPanel
│   └── ActionPanel
└── AmbientLayer (subtle indicators, toasts)
```

---

## Intent Detection System

### Intent Categories

| Category | Triggers | UI Adaptation |
|----------|----------|---------------|
| **Communication** | "message", "reply", "call", "@person" | Show messaging panels, hide analytics |
| **Analysis** | "analyze", "report", "trends", numbers | Show charts, data tables, hide messaging |
| **Scheduling** | "schedule", "meeting", "calendar", dates | Show calendar, availability, hide others |
| **Development** | "code", "build", "deploy", "bug" | Show editor, terminal, hide non-dev tools |
| **Documentation** | "document", "write", "draft" | Show editor, templates, hide clutter |
| **Operations** | "status", "health", "deploy", "logs" | Show system panels, metrics |

### Intent Flow

```
User Input → Intent Classifier → Workspace Adapter → UI Morph
     ↓              ↓                    ↓              ↓
"Reply to       COMMUNICATION      Show WhatsApp    Slide-in
 John on        intent detected    quick reply      panel,
 WhatsApp"                         panel            preserve
                                                    main view
```

---

## Panel System

### Panel Types

1. **Canvas Panels** - Full main area (mutually exclusive)
   - ConversationCanvas
   - AnalyticsCanvas  
   - CalendarCanvas
   - EditorCanvas

2. **Overlay Panels** - Slide over canvas (stackable)
   - QuickReplyOverlay (WhatsApp, Slack messages)
   - PreviewOverlay (documents, images)
   - ActionOverlay (confirmations, forms)

3. **Dock Panels** - Persistent side access
   - IntegrationDock (external services)
   - ToolDock (core KOSMOS tools)

4. **Ambient Panels** - Non-intrusive
   - NotificationToast
   - ProgressIndicator
   - StatusBadge

### Panel Behaviors

```typescript
interface PanelConfig {
  id: string;
  type: 'canvas' | 'overlay' | 'dock' | 'ambient';
  position: 'center' | 'left' | 'right' | 'top' | 'bottom';
  size: 'full' | 'half' | 'third' | 'quarter' | 'auto';
  priority: number;  // Higher = stays visible longer
  dismissable: boolean;
  persistent: boolean;  // Survives intent changes
  contextPreserving: boolean;  // Keeps underlying content visible
}
```

---

## Integration Framework

### Supported Integrations (Phase 1)

| Service | MCP Server | Capabilities |
|---------|------------|--------------|
| WhatsApp | whatsapp-mcp | Read messages, send replies, voice notes |
| Slack | slack-mcp | Channels, DMs, reactions, threads |
| Gmail | gmail-mcp | Read, compose, labels, search |
| Google Calendar | gcal-mcp | Events, availability, scheduling |
| Microsoft Teams | teams-mcp | Chat, meetings, files |
| Notion | notion-mcp | Pages, databases, search |
| GitHub | github-mcp | Issues, PRs, code, actions |

### Integration UI Pattern

When user triggers WhatsApp intent:

```
BEFORE (Traditional):
User → Leaves KOSMOS → Opens WhatsApp → Loses context → Returns → Regains context

AFTER (UII):
User → "Reply to John" → WhatsApp panel slides in → Reply sent → Panel auto-hides
       ↑                                                              ↓
       └──────────── Main task context NEVER lost ────────────────────┘
```

---

## Workspace States

### Predefined Modes

```typescript
const workspaceModes = {
  focus: {
    dock: 'collapsed',
    notifications: 'silent',
    overlays: 'disabled',
    canvas: 'maximized'
  },
  communication: {
    dock: 'expanded',
    integrations: ['whatsapp', 'slack', 'email'],
    canvas: 'conversation',
    overlays: 'enabled'
  },
  analysis: {
    dock: 'collapsed',
    canvas: 'analytics',
    panels: ['charts', 'tables', 'filters'],
    overlays: 'minimal'
  },
  development: {
    dock: 'tools-only',
    canvas: 'editor',
    panels: ['terminal', 'git', 'logs'],
    overlays: 'errors-only'
  }
};
```

---

## Technical Stack

### State Management
- **Zustand** - Workspace state, panel visibility, active contexts
- **Jotai** - Atomic state for individual panel data
- **React Query** - Server state for integrations

### UI Components
- **Framer Motion** - Panel animations, morphing transitions
- **react-resizable-panels** - Flexible panel layouts
- **Radix UI** - Accessible primitives
- **cmdk** - Command palette

### Integration Layer
- **MCP Protocol** - Standardized tool integration
- **WebSocket** - Real-time updates from integrations
- **Service Workers** - Background sync, offline support

---

## Implementation Phases

### Phase 1: Core Shell (Week 1-2)
- [ ] WorkspaceShell component
- [ ] CommandBar with ⌘K
- [ ] Dock with collapsible state
- [ ] Basic intent detection
- [ ] Panel system foundation

### Phase 2: Canvas System (Week 3-4)
- [ ] IntentRenderer component
- [ ] Canvas switching with transitions
- [ ] Context preservation
- [ ] Split view support

### Phase 3: Overlay System (Week 5-6)
- [ ] OverlayManager
- [ ] QuickReplyPanel
- [ ] NotificationPanel
- [ ] PreviewPanel

### Phase 4: Integrations (Week 7-10)
- [ ] WhatsApp MCP integration
- [ ] Slack MCP integration
- [ ] Gmail MCP integration
- [ ] Calendar MCP integration

### Phase 5: Intelligence (Week 11-12)
- [ ] AI-powered intent detection
- [ ] Proactive suggestions
- [ ] Workspace learning
- [ ] Custom shortcuts

---

## Design Tokens

```css
:root {
  /* Workspace */
  --ws-shell-bg: #0a0a0f;
  --ws-dock-bg: #111118;
  --ws-canvas-bg: #0d0d14;
  --ws-overlay-bg: rgba(17, 17, 24, 0.95);
  
  /* Panels */
  --panel-border: rgba(255, 255, 255, 0.06);
  --panel-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  --panel-blur: 20px;
  
  /* Intent Colors */
  --intent-communication: #22c55e;
  --intent-analysis: #8b5cf6;
  --intent-scheduling: #3b82f6;
  --intent-development: #f97316;
  --intent-documentation: #06b6d4;
  
  /* Animations */
  --transition-panel: 200ms cubic-bezier(0.32, 0.72, 0, 1);
  --transition-morph: 300ms cubic-bezier(0.32, 0.72, 0, 1);
}
```

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Context switches per hour | < 5 | Track tab/window changes |
| Time in flow state | > 45 min avg | Uninterrupted work sessions |
| External app opens | < 10/day | WhatsApp/Slack/Email opens |
| Task completion time | -30% | Before/after comparison |
| User satisfaction | > 4.5/5 | NPS surveys |
