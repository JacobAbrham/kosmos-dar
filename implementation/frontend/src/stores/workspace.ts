import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============================================================================
// TYPES
// ============================================================================

export type IntentCategory = 
  | 'conversation'
  | 'communication'
  | 'analysis'
  | 'scheduling'
  | 'development'
  | 'documentation'
  | 'operations'
  | 'navigation';

export type CanvasType = 
  | 'conversation'
  | 'analytics'
  | 'calendar'
  | 'editor'
  | 'files'
  | 'workflows'
  | 'settings';

export type OverlayPosition = 'left' | 'right' | 'top' | 'bottom' | 'center';
export type OverlaySize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface OverlayPanel {
  id: string;
  type: string;
  position: OverlayPosition;
  size: OverlaySize;
  data?: Record<string, unknown>;
  dismissable?: boolean;
  priority?: number;
}

export interface Integration {
  id: string;
  name: string;
  icon: string;
  connected: boolean;
  unreadCount?: number;
  status: 'online' | 'offline' | 'error';
}

export interface WorkspaceContext {
  id: string;
  title: string;
  type: CanvasType;
  data?: Record<string, unknown>;
  timestamp: number;
}

export type WorkspaceMode = 'focus' | 'communication' | 'analysis' | 'development' | 'default';

// ============================================================================
// STORE STATE
// ============================================================================

interface WorkspaceState {
  // Current state
  activeCanvas: CanvasType;
  activeIntent: IntentCategory;
  currentContext: WorkspaceContext | null;
  
  // UI State
  dockCollapsed: boolean;
  commandBarOpen: boolean;
  notificationsPanelOpen: boolean;
  workspaceMode: WorkspaceMode;
  
  // Overlays (stackable)
  overlays: OverlayPanel[];
  
  // Integrations
  integrations: Integration[];
  
  // History
  contextHistory: WorkspaceContext[];
  
  // Actions
  setActiveCanvas: (canvas: CanvasType) => void;
  setActiveIntent: (intent: IntentCategory) => void;
  setCurrentContext: (context: WorkspaceContext) => void;
  
  toggleDock: () => void;
  setDockCollapsed: (collapsed: boolean) => void;
  toggleCommandBar: () => void;
  setCommandBarOpen: (open: boolean) => void;
  toggleNotifications: () => void;
  setWorkspaceMode: (mode: WorkspaceMode) => void;
  
  // Overlay management
  openOverlay: (overlay: Omit<OverlayPanel, 'id'>) => string;
  closeOverlay: (id: string) => void;
  closeAllOverlays: () => void;
  updateOverlay: (id: string, data: Partial<OverlayPanel>) => void;
  
  // Integration management
  updateIntegration: (id: string, data: Partial<Integration>) => void;
  setIntegrationUnread: (id: string, count: number) => void;
  
  // Context management
  pushContext: (context: WorkspaceContext) => void;
  popContext: () => WorkspaceContext | null;
  clearHistory: () => void;
}

// ============================================================================
// DEFAULT VALUES
// ============================================================================

const defaultIntegrations: Integration[] = [
  { id: 'whatsapp', name: 'WhatsApp', icon: 'MessageCircle', connected: false, status: 'offline', unreadCount: 0 },
  { id: 'slack', name: 'Slack', icon: 'Hash', connected: false, status: 'offline', unreadCount: 0 },
  { id: 'gmail', name: 'Gmail', icon: 'Mail', connected: false, status: 'offline', unreadCount: 0 },
  { id: 'gcal', name: 'Calendar', icon: 'Calendar', connected: false, status: 'offline' },
  { id: 'notion', name: 'Notion', icon: 'FileText', connected: false, status: 'offline' },
  { id: 'github', name: 'GitHub', icon: 'Github', connected: false, status: 'offline' },
];

// ============================================================================
// STORE
// ============================================================================

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      // Initial state
      activeCanvas: 'conversation',
      activeIntent: 'conversation',
      currentContext: null,
      dockCollapsed: false,
      commandBarOpen: false,
      notificationsPanelOpen: false,
      workspaceMode: 'default',
      overlays: [],
      integrations: defaultIntegrations,
      contextHistory: [],

      // Canvas & Intent
      setActiveCanvas: (canvas) => set({ activeCanvas: canvas }),
      setActiveIntent: (intent) => set({ activeIntent: intent }),
      setCurrentContext: (context) => {
        const { contextHistory } = get();
        set({ 
          currentContext: context,
          contextHistory: [context, ...contextHistory].slice(0, 50) // Keep last 50
        });
      },

      // UI toggles
      toggleDock: () => set((state) => ({ dockCollapsed: !state.dockCollapsed })),
      setDockCollapsed: (collapsed) => set({ dockCollapsed: collapsed }),
      toggleCommandBar: () => set((state) => ({ commandBarOpen: !state.commandBarOpen })),
      setCommandBarOpen: (open) => set({ commandBarOpen: open }),
      toggleNotifications: () => set((state) => ({ notificationsPanelOpen: !state.notificationsPanelOpen })),
      setWorkspaceMode: (mode) => {
        // Apply mode presets
        switch (mode) {
          case 'focus':
            set({ workspaceMode: mode, dockCollapsed: true, notificationsPanelOpen: false });
            break;
          case 'communication':
            set({ workspaceMode: mode, dockCollapsed: false });
            break;
          default:
            set({ workspaceMode: mode });
        }
      },

      // Overlay management
      openOverlay: (overlay) => {
        const id = `overlay-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const newOverlay: OverlayPanel = { ...overlay, id };
        set((state) => ({
          overlays: [...state.overlays, newOverlay].sort((a, b) => 
            (b.priority || 0) - (a.priority || 0)
          )
        }));
        return id;
      },
      closeOverlay: (id) => set((state) => ({
        overlays: state.overlays.filter((o) => o.id !== id)
      })),
      closeAllOverlays: () => set({ overlays: [] }),
      updateOverlay: (id, data) => set((state) => ({
        overlays: state.overlays.map((o) => o.id === id ? { ...o, ...data } : o)
      })),

      // Integration management
      updateIntegration: (id, data) => set((state) => ({
        integrations: state.integrations.map((i) => 
          i.id === id ? { ...i, ...data } : i
        )
      })),
      setIntegrationUnread: (id, count) => set((state) => ({
        integrations: state.integrations.map((i) =>
          i.id === id ? { ...i, unreadCount: count } : i
        )
      })),

      // Context history
      pushContext: (context) => set((state) => ({
        contextHistory: [context, ...state.contextHistory].slice(0, 50)
      })),
      popContext: () => {
        const { contextHistory } = get();
        if (contextHistory.length === 0) return null;
        const [popped, ...rest] = contextHistory;
        set({ contextHistory: rest, currentContext: popped });
        return popped;
      },
      clearHistory: () => set({ contextHistory: [] }),
    }),
    {
      name: 'kosmos-workspace',
      partialize: (state) => ({
        dockCollapsed: state.dockCollapsed,
        workspaceMode: state.workspaceMode,
        integrations: state.integrations,
        contextHistory: state.contextHistory.slice(0, 10), // Only persist last 10
      }),
    }
  )
);

// ============================================================================
// SELECTORS
// ============================================================================

export const selectTotalUnread = (state: WorkspaceState) =>
  state.integrations.reduce((sum, i) => sum + (i.unreadCount || 0), 0);

export const selectConnectedIntegrations = (state: WorkspaceState) =>
  state.integrations.filter((i) => i.connected);

export const selectActiveOverlays = (state: WorkspaceState) =>
  state.overlays.filter((o) => o.position !== 'center');

export const selectModalOverlays = (state: WorkspaceState) =>
  state.overlays.filter((o) => o.position === 'center');
