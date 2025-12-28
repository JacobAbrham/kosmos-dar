export { useConversationStore } from './conversation';
export type { Message } from './conversation';

export { useWorkspaceStore } from './workspace';
export type { 
  IntentCategory, 
  CanvasType, 
  OverlayPanel, 
  OverlayPosition, 
  OverlaySize,
  Integration,
  WorkspaceContext,
  WorkspaceMode,
} from './workspace';
export { 
  selectTotalUnread, 
  selectConnectedIntegrations, 
  selectActiveOverlays, 
  selectModalOverlays 
} from './workspace';
