'use client';

import React from 'react';
import { motion, Variants } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Check, Circle, AlertCircle, Loader2, XCircle } from 'lucide-react';

export interface TimelineEvent {
  id: string;
  title: string;
  description?: string;
  timestamp?: string;
  status?: 'pending' | 'active' | 'completed' | 'error' | 'skipped';
  icon?: React.ReactNode;
}

export interface GlassTimelineProps {
  events: TimelineEvent[];
  orientation?: 'vertical' | 'horizontal';
  blur?: number;
  className?: string;
}

const eventVariants: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.15,
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  }),
};

const statusConfig = {
  pending: {
    icon: Circle,
    color: 'text-white/50',
    bgColor: 'bg-white/10',
    lineColor: 'bg-white/20',
  },
  active: {
    icon: Loader2,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    lineColor: 'bg-blue-400/50',
    animate: true,
  },
  completed: {
    icon: Check,
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    lineColor: 'bg-green-400/50',
  },
  error: {
    icon: XCircle,
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    lineColor: 'bg-red-400/50',
  },
  skipped: {
    icon: Circle,
    color: 'text-white/30',
    bgColor: 'bg-white/5',
    lineColor: 'bg-white/10',
  },
};

export const GlassTimeline: React.FC<GlassTimelineProps> = ({
  events,
  orientation = 'vertical',
  blur = 12,
  className,
}) => {
  return (
    <div
      className={cn(
        'relative rounded-xl border border-white/20 p-4',
        className
      )}
      style={{
        backdropFilter: `blur(${blur}px)`,
        WebkitBackdropFilter: `blur(${blur}px)`,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
      }}
    >
      {/* Glass highlight */}
      <div
        className="absolute inset-0 rounded-xl pointer-events-none"
        style={{
          background:
            'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, transparent 50%)',
        }}
      />

      <div
        className={cn(
          'relative',
          orientation === 'vertical' ? 'space-y-0' : 'flex gap-4'
        )}
      >
        {events.map((event, index) => {
          const status = event.status || 'pending';
          const config = statusConfig[status];
          const Icon = event.icon ? () => event.icon : config.icon;
          const isLast = index === events.length - 1;

          return (
            <motion.div
              key={event.id}
              custom={index}
              variants={eventVariants}
              initial="hidden"
              animate="visible"
              className={cn(
                orientation === 'vertical'
                  ? 'flex gap-4'
                  : 'flex flex-col items-center'
              )}
            >
              {/* Icon and line */}
              <div
                className={cn(
                  'relative flex flex-col items-center',
                  orientation === 'horizontal' && 'flex-row'
                )}
              >
                {/* Icon */}
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center z-10',
                    config.bgColor
                  )}
                >
                  {status === 'active' ? (
                    <Icon className={cn('w-4 h-4 animate-spin', config.color)} />
                  ) : (
                    <Icon className={cn('w-4 h-4', config.color)} />
                  )}
                </div>

                {/* Connecting line */}
                {!isLast && (
                  <div
                    className={cn(
                      config.lineColor,
                      orientation === 'vertical'
                        ? 'w-0.5 flex-1 min-h-[40px]'
                        : 'h-0.5 flex-1 min-w-[40px]'
                    )}
                  />
                )}
              </div>

              {/* Content */}
              <div
                className={cn(
                  orientation === 'vertical' ? 'flex-1 pb-6' : 'text-center mt-3',
                  isLast && orientation === 'vertical' && 'pb-0'
                )}
              >
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium text-white">
                    {event.title}
                  </h4>
                  {event.timestamp && (
                    <span className="text-xs text-white/40">
                      {event.timestamp}
                    </span>
                  )}
                </div>
                {event.description && (
                  <p className="mt-1 text-sm text-white/60">
                    {event.description}
                  </p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
