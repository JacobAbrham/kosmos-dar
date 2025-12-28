'use client';

import React from 'react';
import { Bot, Paperclip, Clock } from 'lucide-react';
import { useWorkspaceStore, type WorkspaceContext, type IntentCategory, type CanvasType } from '@/stores/workspace';
import { canvasConfig } from '@/hooks/useIntent';
import { cn } from '@/lib/utils';

export function ContextBar(): React.ReactElement {
  const currentContext = useWorkspaceStore((state) => state.currentContext);
  const activeCanvas = useWorkspaceStore((state) => state.activeCanvas);
  const activeIntent = useWorkspaceStore((state) => state.activeIntent);
  const contextHistory = useWorkspaceStore((state) => state.contextHistory);
  const popContext = useWorkspaceStore((state) => state.popContext);

  const canvasInfo = canvasConfig[activeCanvas];
  const recentContext: WorkspaceContext | undefined = contextHistory[0];
  const attachmentsCount = getAttachmentsCount(currentContext);

  return (
    <div className="h-full flex items-center px-4 gap-4 text-xs">
      {/* Current Canvas */}
      <div className="flex items-center gap-2 text-gray-400">
        <span className="text-gray-500">Canvas:</span>
        <span className="text-white font-medium">{canvasInfo?.title ?? String(activeCanvas)}</span>
      </div>

      {/* Separator */}
      <div className="w-px h-4 bg-white/[0.06]" />

      {/* Active Intent */}
      <div className="flex items-center gap-2">
        <span className="text-gray-500">Intent:</span>
        <span className={cn(
          "px-2 py-0.5 rounded text-[10px] font-medium",
          getIntentColor(activeIntent)
        )}>
          {activeIntent}
        </span>
      </div>

      {/* Separator */}
      <div className="w-px h-4 bg-white/[0.06]" />

      {/* Active Agent */}
      <div className="flex items-center gap-2 text-gray-400">
        <Bot className="w-3 h-3 text-yellow-500" />
        <span>Zeus</span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Context Breadcrumb */}
      {recentContext != null && (
        <div className="flex items-center gap-1 text-gray-500">
          <Clock className="w-3 h-3" />
          <button
            onClick={() => popContext()}
            className="hover:text-white transition-colors"
          >
            Back to: {recentContext.title}
          </button>
        </div>
      )}

      {/* Attachments indicator */}
      {attachmentsCount > 0 && (
        <div className="flex items-center gap-1 text-gray-400">
          <Paperclip className="w-3 h-3" />
          <span>{attachmentsCount}</span>
        </div>
      )}

      {/* Time */}
      <div className="text-gray-500">
        <CurrentTime />
      </div>
    </div>
  );
}

function getAttachmentsCount(context: WorkspaceContext | null): number {
  if (!context?.data?.attachments) return 0;
  const attachments = context.data.attachments;
  if (Array.isArray(attachments)) {
    return attachments.length;
  }
  return 0;
}

// Separate component to avoid hydration issues with time
function CurrentTime(): React.ReactElement {
  const [time, setTime] = React.useState<string>('--:--');
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    const updateTime = () => {
      setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!mounted) {
    return <span>--:--</span>;
  }

  return <span>{time}</span>;
}

function getIntentColor(intent: IntentCategory): string {
  const colors: Record<IntentCategory, string> = {
    conversation: 'bg-gray-500/20 text-gray-300',
    communication: 'bg-green-500/20 text-green-400',
    analysis: 'bg-purple-500/20 text-purple-400',
    scheduling: 'bg-blue-500/20 text-blue-400',
    development: 'bg-orange-500/20 text-orange-400',
    documentation: 'bg-cyan-500/20 text-cyan-400',
    operations: 'bg-lime-500/20 text-lime-400',
    navigation: 'bg-gray-500/20 text-gray-300',
  };
  return colors[intent] ?? 'bg-gray-500/20 text-gray-300';
}

export default ContextBar;
