'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useWorkspaceStore, OverlayPanel, OverlayPosition, OverlaySize } from '@/stores/workspace';
import { WhatsAppOverlay } from './overlays/WhatsAppOverlay';
import { SlackOverlay } from './overlays/SlackOverlay';
import { cn } from '@/lib/utils';

// Overlay size configurations
const sizeConfig: Record<OverlaySize, string> = {
  sm: 'w-80',
  md: 'w-96',
  lg: 'w-[480px]',
  xl: 'w-[600px]',
  full: 'w-full h-full',
};

// Position configurations for slide animations
const positionConfig: Record<OverlayPosition, { initial: object; animate: object; exit: object; className: string }> = {
  left: {
    initial: { x: '-100%', opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: '-100%', opacity: 0 },
    className: 'left-0 top-0 bottom-0',
  },
  right: {
    initial: { x: '100%', opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: '100%', opacity: 0 },
    className: 'right-0 top-0 bottom-0',
  },
  top: {
    initial: { y: '-100%', opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: '-100%', opacity: 0 },
    className: 'top-0 left-0 right-0',
  },
  bottom: {
    initial: { y: '100%', opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: '100%', opacity: 0 },
    className: 'bottom-0 left-0 right-0',
  },
  center: {
    initial: { scale: 0.95, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 0.95, opacity: 0 },
    className: 'inset-0 flex items-center justify-center',
  },
};

export function OverlayManager() {
  const { overlays, closeOverlay } = useWorkspaceStore();

  // Separate modal (center) overlays from slide overlays
  const slideOverlays = overlays.filter((o) => o.position !== 'center');
  const modalOverlays = overlays.filter((o) => o.position === 'center');

  return (
    <>
      {/* Slide overlays */}
      <AnimatePresence>
        {slideOverlays.map((overlay) => (
          <SlideOverlay
            key={overlay.id}
            overlay={overlay}
            onClose={() => closeOverlay(overlay.id)}
          />
        ))}
      </AnimatePresence>

      {/* Modal overlays with backdrop */}
      <AnimatePresence>
        {modalOverlays.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={() => {
              const topModal = modalOverlays[modalOverlays.length - 1];
              if (topModal?.dismissable !== false) {
                closeOverlay(topModal.id);
              }
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {modalOverlays.map((overlay) => (
          <ModalOverlay
            key={overlay.id}
            overlay={overlay}
            onClose={() => closeOverlay(overlay.id)}
          />
        ))}
      </AnimatePresence>
    </>
  );
}

function SlideOverlay({ overlay, onClose }: { overlay: OverlayPanel; onClose: () => void }) {
  const position = positionConfig[overlay.position];
  const size = sizeConfig[overlay.size];

  return (
    <motion.div
      initial={position.initial}
      animate={position.animate}
      exit={position.exit}
      transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
      className={cn(
        'fixed z-50 bg-[#1a1a24] border-white/[0.06] shadow-2xl',
        position.className,
        overlay.position === 'left' || overlay.position === 'right' ? size : 'h-auto',
        overlay.position === 'left' ? 'border-r' : '',
        overlay.position === 'right' ? 'border-l' : '',
        overlay.position === 'top' ? 'border-b' : '',
        overlay.position === 'bottom' ? 'border-t' : ''
      )}
    >
      <OverlayContent overlay={overlay} onClose={onClose} />
    </motion.div>
  );
}

function ModalOverlay({ overlay, onClose }: { overlay: OverlayPanel; onClose: () => void }) {
  const size = sizeConfig[overlay.size];

  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.95, opacity: 0 }}
      transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
      className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
    >
      <div
        className={cn(
          'bg-[#1a1a24] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden pointer-events-auto',
          size,
          overlay.size !== 'full' && 'max-h-[90vh]'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <OverlayContent overlay={overlay} onClose={onClose} />
      </div>
    </motion.div>
  );
}

function OverlayContent({ overlay, onClose }: { overlay: OverlayPanel; onClose: () => void }) {
  const { updateIntegration } = useWorkspaceStore();

  // Render different overlay types
  const renderContent = () => {
    switch (overlay.type) {
      case 'quick-reply':
        return <QuickReplyOverlay data={overlay.data} onClose={onClose} />;
      case 'messages':
        return <MessagesOverlay data={overlay.data} />;
      case 'create-event':
        return <CreateEventOverlay data={overlay.data} onClose={onClose} />;
      case 'integration-whatsapp':
        return (
          <WhatsAppOverlay
            connected={false}
            onConnect={() => {
              updateIntegration('whatsapp', { connected: true, status: 'online' });
            }}
          />
        );
      case 'integration-slack':
        return (
          <SlackOverlay
            connected={false}
            onConnect={() => {
              updateIntegration('slack', { connected: true, status: 'online' });
            }}
          />
        );
      default:
        // Generic integration overlays
        if (overlay.type.startsWith('integration-')) {
          const integrationId = overlay.type.replace('integration-', '');
          return <GenericIntegrationOverlay integrationId={integrationId} />;
        }
        return (
          <div className="p-4 text-gray-400">
            Unknown overlay type: {overlay.type}
          </div>
        );
    }
  };

  // Some overlays handle their own header
  const hasCustomHeader = ['integration-whatsapp', 'integration-slack'].includes(overlay.type);

  return (
    <div className="flex flex-col h-full">
      {/* Header - only show for overlays without custom headers */}
      {!hasCustomHeader && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <h3 className="font-semibold text-white">{getOverlayTitle(overlay.type)}</h3>
          {overlay.dismissable !== false && (
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-white hover:bg-white/[0.06] rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      )}

      {/* Close button for custom header overlays */}
      {hasCustomHeader && overlay.dismissable !== false && (
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 text-gray-400 hover:text-white hover:bg-white/[0.06] rounded transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {renderContent()}
      </div>
    </div>
  );
}

function getOverlayTitle(type: string): string {
  const titles: Record<string, string> = {
    'quick-reply': 'Quick Reply',
    'messages': 'Messages',
    'create-event': 'Create Event',
    'integration-whatsapp': 'WhatsApp',
    'integration-slack': 'Slack',
    'integration-gmail': 'Gmail',
    'integration-gcal': 'Calendar',
    'integration-notion': 'Notion',
    'integration-github': 'GitHub',
  };
  return titles[type] || 'Panel';
}

// Placeholder overlay components
function QuickReplyOverlay({ data, onClose }: { data?: Record<string, unknown>; onClose: () => void }) {
  return (
    <div className="p-4">
      <div className="space-y-3">
        <div className="text-sm text-gray-400">Reply to message</div>
        <textarea
          placeholder="Type your reply..."
          className="w-full h-24 bg-white/[0.04] border border-white/[0.08] rounded-lg p-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 bg-white/[0.06] hover:bg-white/[0.1] text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors">
            Send Reply
          </button>
        </div>
      </div>
    </div>
  );
}

function MessagesOverlay({ data }: { data?: Record<string, unknown> }) {
  return (
    <div className="p-4">
      <div className="text-center py-8 text-gray-400">
        <p>No messages</p>
        <p className="text-sm mt-1">Connect integrations to see messages</p>
      </div>
    </div>
  );
}

function CreateEventOverlay({ data, onClose }: { data?: Record<string, unknown>; onClose: () => void }) {
  return (
    <div className="p-4 space-y-4">
      <input
        type="text"
        placeholder="Event title"
        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg p-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <div className="grid grid-cols-2 gap-3">
        <input
          type="date"
          className="bg-white/[0.04] border border-white/[0.08] rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <input
          type="time"
          className="bg-white/[0.04] border border-white/[0.08] rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      <textarea
        placeholder="Description (optional)"
        className="w-full h-24 bg-white/[0.04] border border-white/[0.08] rounded-lg p-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
      />
      <div className="flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 py-2 bg-white/[0.06] hover:bg-white/[0.1] text-white rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors">
          Create Event
        </button>
      </div>
    </div>
  );
}

function GenericIntegrationOverlay({ integrationId }: { integrationId: string }) {
  const { updateIntegration } = useWorkspaceStore();
  const displayName = integrationId.charAt(0).toUpperCase() + integrationId.slice(1);

  return (
    <div className="p-6">
      <div className="text-center py-8">
        <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-white/[0.06] flex items-center justify-center">
          <span className="text-2xl">{getIntegrationEmoji(integrationId)}</span>
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">Connect {displayName}</h3>
        <p className="text-gray-400 text-sm mb-6 max-w-xs mx-auto">
          Access {displayName} directly within KOSMOS without switching apps.
        </p>
        <button
          onClick={() => updateIntegration(integrationId, { connected: true, status: 'online' })}
          className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
        >
          Connect {displayName}
        </button>
      </div>
    </div>
  );
}

function getIntegrationEmoji(id: string): string {
  const emojis: Record<string, string> = {
    whatsapp: '💬',
    slack: '#️⃣',
    gmail: '📧',
    gcal: '📅',
    notion: '📝',
    github: '🐙',
  };
  return emojis[id] || '🔗';
}

export default OverlayManager;
