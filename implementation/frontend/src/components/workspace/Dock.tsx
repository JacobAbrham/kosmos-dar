'use client';

import { motion } from 'framer-motion';
import { 
  MessageSquare, 
  BarChart3, 
  Calendar, 
  FolderOpen, 
  GitBranch,
  Settings,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Hash,
  Mail,
  FileText,
  Github,
  Sparkles,
} from 'lucide-react';
import { useWorkspaceStore, CanvasType, selectTotalUnread } from '@/stores/workspace';
import { cn } from '@/lib/utils';

interface DockProps {
  collapsed: boolean;
}

interface DockItem {
  id: CanvasType | string;
  icon: React.ElementType;
  label: string;
  isCanvas?: boolean;
  badge?: number;
  color?: string;
}

const coreTools: DockItem[] = [
  { id: 'conversation', icon: MessageSquare, label: 'Chat', isCanvas: true },
  { id: 'analytics', icon: BarChart3, label: 'Analytics', isCanvas: true },
  { id: 'calendar', icon: Calendar, label: 'Calendar', isCanvas: true },
  { id: 'files', icon: FolderOpen, label: 'Files', isCanvas: true },
  { id: 'workflows', icon: GitBranch, label: 'Workflows', isCanvas: true },
];

const integrationIcons: Record<string, React.ElementType> = {
  whatsapp: MessageCircle,
  slack: Hash,
  gmail: Mail,
  gcal: Calendar,
  notion: FileText,
  github: Github,
};

export function Dock({ collapsed }: DockProps) {
  const { 
    activeCanvas, 
    setActiveCanvas, 
    toggleDock,
    integrations,
    openOverlay,
  } = useWorkspaceStore();
  
  const totalUnread = useWorkspaceStore(selectTotalUnread);

  const handleCanvasClick = (canvas: CanvasType) => {
    setActiveCanvas(canvas);
  };

  const handleIntegrationClick = (integrationId: string) => {
    openOverlay({
      type: `integration-${integrationId}`,
      position: 'right',
      size: 'lg',
      data: { integrationId },
    });
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 56 : 200 }}
      transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
      className="h-full bg-[#111118] border-r border-white/[0.06] flex flex-col"
    >
      {/* Logo */}
      <div className="h-14 flex items-center justify-between px-3 border-b border-white/[0.06]">
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-sm">KOSMOS</span>
          </motion.div>
        )}
        {collapsed && (
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
        )}
      </div>

      {/* Core Tools */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        <div className={cn("text-[10px] uppercase tracking-wider text-gray-500 mb-2", collapsed ? "text-center" : "px-2")}>
          {!collapsed && "Tools"}
        </div>
        {coreTools.map((item) => (
          <DockButton
            key={item.id}
            item={item}
            collapsed={collapsed}
            active={activeCanvas === item.id}
            onClick={() => handleCanvasClick(item.id as CanvasType)}
          />
        ))}

        {/* Integrations Divider */}
        <div className="my-4 border-t border-white/[0.06]" />
        
        <div className={cn("text-[10px] uppercase tracking-wider text-gray-500 mb-2", collapsed ? "text-center" : "px-2")}>
          {!collapsed && "Integrations"}
          {collapsed && totalUnread > 0 && (
            <span className="inline-flex items-center justify-center w-4 h-4 text-[9px] bg-red-500 text-white rounded-full">
              {totalUnread > 9 ? '9+' : totalUnread}
            </span>
          )}
        </div>
        
        {integrations.map((integration) => {
          const Icon = integrationIcons[integration.id] || MessageCircle;
          return (
            <DockButton
              key={integration.id}
              item={{
                id: integration.id,
                icon: Icon,
                label: integration.name,
                badge: integration.unreadCount,
                color: integration.connected ? 'text-green-400' : 'text-gray-500',
              }}
              collapsed={collapsed}
              active={false}
              onClick={() => handleIntegrationClick(integration.id)}
              disabled={!integration.connected}
            />
          );
        })}
      </nav>

      {/* Bottom Actions */}
      <div className="py-3 px-2 border-t border-white/[0.06] space-y-1">
        <DockButton
          item={{ id: 'settings', icon: Settings, label: 'Settings', isCanvas: true }}
          collapsed={collapsed}
          active={activeCanvas === 'settings'}
          onClick={() => handleCanvasClick('settings')}
        />
        
        {/* Collapse Toggle */}
        <button
          onClick={toggleDock}
          className="w-full flex items-center justify-center gap-2 px-2 py-2 text-gray-400 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span className="text-xs">Collapse</span>
            </>
          )}
        </button>
      </div>
    </motion.aside>
  );
}

interface DockButtonProps {
  item: DockItem;
  collapsed: boolean;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}

function DockButton({ item, collapsed, active, onClick, disabled }: DockButtonProps) {
  const Icon = item.icon;
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-3 px-2 py-2 rounded-lg transition-all",
        active 
          ? "bg-indigo-500/20 text-indigo-400" 
          : "text-gray-400 hover:text-white hover:bg-white/[0.06]",
        disabled && "opacity-50 cursor-not-allowed hover:bg-transparent hover:text-gray-400",
        collapsed && "justify-center"
      )}
    >
      <div className="relative">
        <Icon className={cn("w-5 h-5", item.color)} />
        {item.badge !== undefined && item.badge > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 text-[9px] bg-red-500 text-white rounded-full flex items-center justify-center">
            {item.badge > 9 ? '9+' : item.badge}
          </span>
        )}
      </div>
      {!collapsed && (
        <span className="text-sm truncate">{item.label}</span>
      )}
    </button>
  );
}

export default Dock;
