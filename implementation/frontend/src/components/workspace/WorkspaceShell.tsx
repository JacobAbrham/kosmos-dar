'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useWorkspaceStore } from '@/stores/workspace';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { Dock } from './Dock';
import { CommandBar } from './CommandBar';
import { ContextBar } from './ContextBar';
import { CanvasRenderer } from './CanvasRenderer';
import { OverlayManager } from './OverlayManager';
import { AmbientNotifications } from './AmbientNotifications';

interface WorkspaceShellProps {
  children?: React.ReactNode;
}

export function WorkspaceShell({ children }: WorkspaceShellProps) {
  const { dockCollapsed, workspaceMode } = useWorkspaceStore();

  // Initialize keyboard shortcuts
  useKeyboardShortcuts();

  return (
    <div className="workspace-shell h-screen w-screen overflow-hidden bg-[#0a0a0f] text-gray-100">
      {/* Main Layout */}
      <div className="flex h-full">
        {/* Dock (left side) */}
        <Dock collapsed={dockCollapsed} />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Command Bar (top) */}
          <header className="flex-shrink-0 h-14 border-b border-white/[0.06] bg-[#111118]">
            <CommandBar />
          </header>

          {/* Canvas Area */}
          <main className="flex-1 min-h-0 relative overflow-hidden bg-[#0d0d14]">
            <CanvasRenderer />
            {children}
          </main>

          {/* Context Bar (bottom) */}
          <footer className="flex-shrink-0 h-10 border-t border-white/[0.06] bg-[#111118]">
            <ContextBar />
          </footer>
        </div>
      </div>

      {/* Overlay Layer */}
      <OverlayManager />

      {/* Ambient Notifications */}
      <AmbientNotifications />

      {/* Focus Mode Vignette */}
      <AnimatePresence>
        {workspaceMode === 'focus' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 pointer-events-none z-40"
            style={{
              boxShadow: 'inset 0 0 150px 50px rgba(0,0,0,0.7)',
            }}
          />
        )}
      </AnimatePresence>

      {/* Focus Mode Indicator */}
      <AnimatePresence>
        {workspaceMode === 'focus' && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-indigo-600/90 text-white text-sm rounded-full shadow-lg"
          >
            Focus Mode • Press ⌘⇧F to exit
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default WorkspaceShell;
