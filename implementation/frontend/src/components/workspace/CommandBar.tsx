'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Sparkles, 
  Command,
  Bell,
  User,
  Settings,
  ArrowRight,
  MessageSquare,
  BarChart3,
  Calendar,
  Code,
  FileText,
} from 'lucide-react';
import { useWorkspaceStore, selectTotalUnread, CanvasType } from '@/stores/workspace';
import { useIntentDetection, canvasConfig } from '@/hooks/useIntent';
import { cn } from '@/lib/utils';

interface CommandSuggestion {
  id: string;
  icon: React.ElementType;
  label: string;
  description?: string;
  action: () => void;
  category: 'navigation' | 'action' | 'integration' | 'recent';
}

export function CommandBar() {
  const [input, setInput] = useState('');
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<CommandSuggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    commandBarOpen,
    setCommandBarOpen,
    toggleNotifications,
    setActiveCanvas,
    contextHistory,
  } = useWorkspaceStore();

  const totalUnread = useWorkspaceStore(selectTotalUnread);
  const { processInput, detectIntent } = useIntentDetection();

  // Generate suggestions based on input
  useEffect(() => {
    const newSuggestions: CommandSuggestion[] = [];

    if (!input.trim()) {
      // Show default suggestions
      newSuggestions.push(
        {
          id: 'nav-chat',
          icon: MessageSquare,
          label: 'Go to Chat',
          description: 'Talk to KOSMOS',
          action: () => setActiveCanvas('conversation'),
          category: 'navigation',
        },
        {
          id: 'nav-analytics',
          icon: BarChart3,
          label: 'Go to Analytics',
          description: 'View metrics and data',
          action: () => setActiveCanvas('analytics'),
          category: 'navigation',
        },
        {
          id: 'nav-calendar',
          icon: Calendar,
          label: 'Go to Calendar',
          description: 'Schedule and events',
          action: () => setActiveCanvas('calendar'),
          category: 'navigation',
        },
      );

      // Add recent contexts
      contextHistory.slice(0, 3).forEach((ctx, i) => {
        const config = canvasConfig[ctx.type];
        newSuggestions.push({
          id: `recent-${i}`,
          icon: getIconForCanvas(ctx.type),
          label: ctx.title,
          description: `Recent ${config.title}`,
          action: () => setActiveCanvas(ctx.type),
          category: 'recent',
        });
      });
    } else {
      // Detect intent and generate relevant suggestions
      const intent = detectIntent(input);

      // Navigation suggestions
      Object.entries(canvasConfig).forEach(([key, config]) => {
        if (
          config.title.toLowerCase().includes(input.toLowerCase()) ||
          config.description.toLowerCase().includes(input.toLowerCase())
        ) {
          newSuggestions.push({
            id: `nav-${key}`,
            icon: getIconForCanvas(key as CanvasType),
            label: `Go to ${config.title}`,
            description: config.description,
            action: () => setActiveCanvas(key as CanvasType),
            category: 'navigation',
          });
        }
      });

      // Intent-based suggestions
      if (intent.confidence > 0.3) {
        newSuggestions.push({
          id: 'intent-action',
          icon: Sparkles,
          label: `Ask KOSMOS: "${input}"`,
          description: `Detected: ${intent.category}`,
          action: () => {
            // Send to conversation
            setActiveCanvas('conversation');
            // The actual message sending would happen in the canvas
          },
          category: 'action',
        });
      }
    }

    setSuggestions(newSuggestions);
    setSelectedIndex(0);
  }, [input, contextHistory, detectIntent, setActiveCanvas]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && suggestions[selectedIndex]) {
      e.preventDefault();
      suggestions[selectedIndex].action();
      setInput('');
      setCommandBarOpen(false);
    } else if (e.key === 'Escape') {
      setCommandBarOpen(false);
    }
  }, [suggestions, selectedIndex, setCommandBarOpen]);

  // Focus input when command bar opens
  useEffect(() => {
    if (commandBarOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [commandBarOpen]);

  return (
    <div className="h-full flex items-center px-4 gap-4">
      {/* Main Input */}
      <div className="flex-1 relative">
        <div className={cn(
          "flex items-center gap-3 px-4 py-2 rounded-lg transition-all",
          "bg-white/[0.04] border border-white/[0.06]",
          focused && "bg-white/[0.06] border-white/[0.12] ring-1 ring-indigo-500/30"
        )}>
          <Search className="w-4 h-4 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 200)}
            onKeyDown={handleKeyDown}
            placeholder="Ask KOSMOS anything..."
            className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none"
          />
          <div className="flex items-center gap-1 text-gray-500">
            <Command className="w-3 h-3" />
            <span className="text-xs">K</span>
          </div>
        </div>

        {/* Suggestions Dropdown */}
        <AnimatePresence>
          {focused && suggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a24] border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden z-50"
            >
              <div className="p-2 max-h-80 overflow-y-auto">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={suggestion.id}
                    onClick={() => {
                      suggestion.action();
                      setInput('');
                      setFocused(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left",
                      index === selectedIndex
                        ? "bg-indigo-500/20 text-white"
                        : "text-gray-300 hover:bg-white/[0.06]"
                    )}
                  >
                    <suggestion.icon className="w-4 h-4 text-gray-400" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{suggestion.label}</div>
                      {suggestion.description && (
                        <div className="text-xs text-gray-500 truncate">{suggestion.description}</div>
                      )}
                    </div>
                    <ArrowRight className="w-3 h-3 text-gray-500" />
                  </button>
                ))}
              </div>
              <div className="px-4 py-2 border-t border-white/[0.06] text-xs text-gray-500 flex items-center gap-4">
                <span>↑↓ Navigate</span>
                <span>↵ Select</span>
                <span>ESC Close</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <button
          onClick={toggleNotifications}
          className="relative p-2 text-gray-400 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors"
        >
          <Bell className="w-5 h-5" />
          {totalUnread > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          )}
        </button>

        {/* User */}
        <button className="p-2 text-gray-400 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors">
          <User className="w-5 h-5" />
        </button>

        {/* Settings */}
        <button
          onClick={() => setActiveCanvas('settings')}
          className="p-2 text-gray-400 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

function getIconForCanvas(canvas: CanvasType): React.ElementType {
  const icons: Record<CanvasType, React.ElementType> = {
    conversation: MessageSquare,
    analytics: BarChart3,
    calendar: Calendar,
    editor: Code,
    files: FileText,
    workflows: Code,
    settings: Settings,
  };
  return icons[canvas] || MessageSquare;
}

export default CommandBar;
