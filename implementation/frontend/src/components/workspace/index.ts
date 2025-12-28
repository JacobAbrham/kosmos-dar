// Workspace Components - UII (User Intent Interface) System
export { WorkspaceShell } from './WorkspaceShell';
export { Dock } from './Dock';
export { CommandBar } from './CommandBar';
export { ContextBar } from './ContextBar';
export { CanvasRenderer } from './CanvasRenderer';
export { OverlayManager } from './OverlayManager';
export { AmbientNotifications, pushNotification, removeNotification } from './AmbientNotifications';

// Canvases
export { default as ConversationCanvas } from './canvases/ConversationCanvas';
export { default as AnalyticsCanvas } from './canvases/AnalyticsCanvas';
export { default as CalendarCanvas } from './canvases/CalendarCanvas';
export { default as EditorCanvas } from './canvases/EditorCanvas';
export { default as FilesCanvas } from './canvases/FilesCanvas';
export { default as WorkflowsCanvas } from './canvases/WorkflowsCanvas';
export { default as SettingsCanvas } from './canvases/SettingsCanvas';

// Overlays
export { WhatsAppOverlay } from './overlays/WhatsAppOverlay';
export { SlackOverlay } from './overlays/SlackOverlay';
