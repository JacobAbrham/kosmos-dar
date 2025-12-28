'use client';

import React from 'react';
import { motion, Variants } from 'framer-motion';
import { cn } from '@/lib/utils';
import { User, Bot, Wrench, AlertCircle } from 'lucide-react';

export interface GlassChatBubbleProps {
  content: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  agent?: string;
  timestamp?: string;
  streaming?: boolean;
  error?: boolean;
  blur?: number;
  className?: string;
}

const bubbleVariants: Variants = {
  hidden: { opacity: 0, y: 10, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.3,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
};

const roleConfig = {
  user: {
    align: 'justify-end',
    bg: 'bg-blue-500/20',
    border: 'border-blue-400/30',
    icon: User,
    iconBg: 'bg-blue-500/30',
  },
  assistant: {
    align: 'justify-start',
    bg: 'bg-white/10',
    border: 'border-white/20',
    icon: Bot,
    iconBg: 'bg-purple-500/30',
  },
  system: {
    align: 'justify-center',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-400/30',
    icon: AlertCircle,
    iconBg: 'bg-yellow-500/30',
  },
  tool: {
    align: 'justify-start',
    bg: 'bg-green-500/10',
    border: 'border-green-400/30',
    icon: Wrench,
    iconBg: 'bg-green-500/30',
  },
};

export const GlassChatBubble: React.FC<GlassChatBubbleProps> = ({
  content,
  role,
  agent,
  timestamp,
  streaming = false,
  error = false,
  blur = 8,
  className,
}) => {
  const config = roleConfig[role];
  const Icon = config.icon;

  return (
    <motion.div
      variants={bubbleVariants}
      initial="hidden"
      animate="visible"
      className={cn('flex gap-3', config.align, className)}
    >
      {/* Avatar for non-user messages */}
      {role !== 'user' && (
        <div
          className={cn(
            'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
            config.iconBg
          )}
        >
          <Icon className="w-4 h-4 text-white" />
        </div>
      )}

      {/* Bubble */}
      <div
        className={cn(
          'relative max-w-[80%] rounded-2xl px-4 py-3 border',
          config.bg,
          config.border,
          error && 'border-red-400/50',
          role === 'user' && 'rounded-br-md',
          role !== 'user' && 'rounded-bl-md'
        )}
        style={{
          backdropFilter: `blur(${blur}px)`,
          WebkitBackdropFilter: `blur(${blur}px)`,
        }}
      >
        {/* Glass highlight */}
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            background:
              'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%)',
          }}
        />

        {/* Agent name */}
        {agent && role === 'assistant' && (
          <div className="text-xs font-medium text-white/60 mb-1">{agent}</div>
        )}

        {/* Content */}
        <div className="relative text-white/90 whitespace-pre-wrap">
          {content}
          {streaming && (
            <motion.span
              animate={{ opacity: [1, 0] }}
              transition={{ duration: 0.5, repeat: Infinity }}
              className="inline-block w-2 h-4 bg-white/70 ml-0.5"
            />
          )}
        </div>

        {/* Timestamp */}
        {timestamp && (
          <div className="text-xs text-white/40 mt-2">{timestamp}</div>
        )}
      </div>

      {/* Avatar for user messages */}
      {role === 'user' && (
        <div
          className={cn(
            'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
            config.iconBg
          )}
        >
          <Icon className="w-4 h-4 text-white" />
        </div>
      )}
    </motion.div>
  );
};
