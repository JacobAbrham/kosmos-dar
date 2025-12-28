'use client';

import { Suspense, lazy, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWorkspaceStore, CanvasType } from '@/stores/workspace';
import { Loader2 } from 'lucide-react';

// Lazy load canvases for code splitting
const ConversationCanvas = lazy(() => import('./canvases/ConversationCanvas'));
const AnalyticsCanvas = lazy(() => import('./canvases/AnalyticsCanvas'));
const CalendarCanvas = lazy(() => import('./canvases/CalendarCanvas'));
const EditorCanvas = lazy(() => import('./canvases/EditorCanvas'));
const FilesCanvas = lazy(() => import('./canvases/FilesCanvas'));
const WorkflowsCanvas = lazy(() => import('./canvases/WorkflowsCanvas'));
const SettingsCanvas = lazy(() => import('./canvases/SettingsCanvas'));

const canvasComponents: Record<CanvasType, React.LazyExoticComponent<React.ComponentType>> = {
  conversation: ConversationCanvas,
  analytics: AnalyticsCanvas,
  calendar: CalendarCanvas,
  editor: EditorCanvas,
  files: FilesCanvas,
  workflows: WorkflowsCanvas,
  settings: SettingsCanvas,
};

function CanvasLoader() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <span className="text-sm text-gray-500">Loading canvas...</span>
      </div>
    </div>
  );
}

export function CanvasRenderer() {
  const { activeCanvas } = useWorkspaceStore();

  const CanvasComponent = useMemo(() => {
    return canvasComponents[activeCanvas] || ConversationCanvas;
  }, [activeCanvas]);

  return (
    <div className="h-full w-full overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={activeCanvas}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
          className="h-full w-full"
        >
          <Suspense fallback={<CanvasLoader />}>
            <CanvasComponent />
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default CanvasRenderer;
