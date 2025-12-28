'use client';

import { useEffect, useCallback, useMemo } from 'react';
import { useWorkspaceStore, CanvasType } from '@/stores/workspace';

interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description: string;
}

export function useKeyboardShortcuts() {
  const {
    toggleCommandBar,
    toggleDock,
    toggleNotifications,
    setActiveCanvas,
    closeAllOverlays,
    setWorkspaceMode,
    workspaceMode,
  } = useWorkspaceStore();

  // Memoize shortcuts to prevent unnecessary re-renders
  const shortcuts = useMemo<KeyboardShortcut[]>(() => [
    // Command Bar
    { key: 'k', ctrl: true, action: toggleCommandBar, description: 'Open command bar' },
    { key: 'k', meta: true, action: toggleCommandBar, description: 'Open command bar (Mac)' },
    
    // Navigation
    { key: '1', ctrl: true, action: () => setActiveCanvas('conversation'), description: 'Go to Chat' },
    { key: '2', ctrl: true, action: () => setActiveCanvas('analytics'), description: 'Go to Analytics' },
    { key: '3', ctrl: true, action: () => setActiveCanvas('calendar'), description: 'Go to Calendar' },
    { key: '4', ctrl: true, action: () => setActiveCanvas('files'), description: 'Go to Files' },
    { key: '5', ctrl: true, action: () => setActiveCanvas('workflows'), description: 'Go to Workflows' },
    
    // UI Controls
    { key: 'b', ctrl: true, action: toggleDock, description: 'Toggle sidebar' },
    { key: 'n', ctrl: true, action: toggleNotifications, description: 'Toggle notifications' },
    { key: 'Escape', action: closeAllOverlays, description: 'Close overlays' },
    
    // Workspace Modes - use current workspaceMode
    { 
      key: 'f', 
      ctrl: true, 
      shift: true, 
      action: () => setWorkspaceMode(workspaceMode === 'focus' ? 'default' : 'focus'), 
      description: 'Toggle focus mode' 
    },
  ], [toggleCommandBar, toggleDock, toggleNotifications, setActiveCanvas, closeAllOverlays, setWorkspaceMode, workspaceMode]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't trigger shortcuts when typing in inputs
    const target = e.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || 
                    target.tagName === 'TEXTAREA' || 
                    target.isContentEditable;
    
    if (isInput && e.key !== 'Escape') {
      return;
    }

    for (const shortcut of shortcuts) {
      // Check modifier keys
      const needsCtrl = shortcut.ctrl === true;
      const needsMeta = shortcut.meta === true;
      const needsShift = shortcut.shift === true;
      const needsAlt = shortcut.alt === true;

      const hasCtrl = e.ctrlKey;
      const hasMeta = e.metaKey;
      const hasShift = e.shiftKey;
      const hasAlt = e.altKey;

      // For ctrl shortcuts, allow meta as alternative (Mac compatibility)
      const ctrlMatch = needsCtrl ? (hasCtrl || hasMeta) : (!hasCtrl && !hasMeta);
      const metaMatch = needsMeta ? hasMeta : true;
      const shiftMatch = needsShift ? hasShift : !hasShift;
      const altMatch = needsAlt ? hasAlt : !hasAlt;
      const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();

      if (keyMatch && ctrlMatch && metaMatch && shiftMatch && altMatch) {
        e.preventDefault();
        e.stopPropagation();
        shortcut.action();
        return;
      }
    }
  }, [shortcuts]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);

  return { shortcuts };
}

// Keyboard shortcuts help panel data
export const keyboardShortcutsHelp = [
  {
    category: 'General',
    shortcuts: [
      { keys: ['⌘', 'K'], description: 'Open command bar' },
      { keys: ['Esc'], description: 'Close panels/overlays' },
      { keys: ['⌘', 'B'], description: 'Toggle sidebar' },
      { keys: ['⌘', 'N'], description: 'Toggle notifications' },
    ],
  },
  {
    category: 'Navigation',
    shortcuts: [
      { keys: ['⌘', '1'], description: 'Go to Chat' },
      { keys: ['⌘', '2'], description: 'Go to Analytics' },
      { keys: ['⌘', '3'], description: 'Go to Calendar' },
      { keys: ['⌘', '4'], description: 'Go to Files' },
      { keys: ['⌘', '5'], description: 'Go to Workflows' },
    ],
  },
  {
    category: 'Modes',
    shortcuts: [
      { keys: ['⌘', '⇧', 'F'], description: 'Toggle focus mode' },
    ],
  },
];

export default useKeyboardShortcuts;
