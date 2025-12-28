'use client';

import React from 'react';
import { motion, HTMLMotionProps, Variants } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface GlassCardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  footer?: React.ReactNode;
  blur?: number;
  opacity?: number;
  bordered?: boolean;
  hoverable?: boolean;
  elevated?: boolean;
  glow?: boolean;
  glowColor?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error';
}

const paddingClasses = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

const variantClasses = {
  default: 'bg-white/10 border-white/20',
  primary: 'bg-blue-500/10 border-blue-400/30',
  success: 'bg-green-500/10 border-green-400/30',
  warning: 'bg-yellow-500/10 border-yellow-400/30',
  error: 'bg-red-500/10 border-red-400/30',
};

const glowColors = {
  default: 'rgba(255,255,255,0.1)',
  primary: 'rgba(59,130,246,0.2)',
  success: 'rgba(34,197,94,0.2)',
  warning: 'rgba(234,179,8,0.2)',
  error: 'rgba(239,68,68,0.2)',
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
  hover: {
    y: -2,
    transition: {
      duration: 0.2,
      ease: 'easeOut',
    },
  },
};

export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  (
    {
      children,
      title,
      subtitle,
      icon,
      footer,
      blur = 12,
      opacity = 0.15,
      bordered = true,
      hoverable = false,
      elevated = false,
      glow = false,
      glowColor,
      padding = 'md',
      variant = 'default',
      className,
      style,
      ...props
    },
    ref
  ) => {
    const computedGlowColor = glowColor || glowColors[variant];

    return (
      <motion.div
        ref={ref}
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        whileHover={hoverable ? 'hover' : undefined}
        className={cn(
          'relative rounded-xl overflow-hidden',
          paddingClasses[padding],
          bordered && 'border',
          variantClasses[variant],
          elevated && 'shadow-lg shadow-black/10',
          hoverable && 'cursor-pointer transition-shadow hover:shadow-xl',
          className
        )}
        style={{
          backdropFilter: `blur(${blur}px)`,
          WebkitBackdropFilter: `blur(${blur}px)`,
          backgroundColor: `rgba(255, 255, 255, ${opacity})`,
          boxShadow: glow
            ? `0 0 40px ${computedGlowColor}, inset 0 0 60px rgba(255,255,255,0.05)`
            : elevated
            ? '0 8px 32px rgba(0, 0, 0, 0.12)'
            : undefined,
          ...style,
        }}
        {...props}
      >
        {/* Header */}
        {(title || icon) && (
          <div className="flex items-center gap-3 mb-4">
            {icon && (
              <div className="flex-shrink-0 text-white/70">{icon}</div>
            )}
            <div className="flex-1 min-w-0">
              {title && (
                <h3 className="text-lg font-semibold text-white truncate">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-sm text-white/60 truncate">{subtitle}</p>
              )}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="relative">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="mt-4 pt-4 border-t border-white/10">{footer}</div>
        )}

        {/* Glass highlight effect */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%)',
          }}
        />
      </motion.div>
    );
  }
);

GlassCard.displayName = 'GlassCard';
