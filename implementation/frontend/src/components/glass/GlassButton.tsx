'use client';

import React from 'react';
import { motion, HTMLMotionProps, Variants } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export interface GlassButtonProps
  extends Omit<HTMLMotionProps<'button'>, 'children'> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  fullWidth?: boolean;
  blur?: number;
  glow?: boolean;
}

const sizeClasses = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2 text-base gap-2',
  lg: 'px-6 py-3 text-lg gap-2.5',
};

const variantClasses = {
  primary: 'bg-blue-500/80 hover:bg-blue-500/90 text-white border-blue-400/50',
  secondary: 'bg-white/10 hover:bg-white/20 text-white border-white/20',
  outline: 'bg-transparent hover:bg-white/10 text-white border-white/30',
  ghost: 'bg-transparent hover:bg-white/10 text-white border-transparent',
  danger: 'bg-red-500/80 hover:bg-red-500/90 text-white border-red-400/50',
};

const glowColors = {
  primary: 'rgba(59,130,246,0.4)',
  secondary: 'rgba(255,255,255,0.1)',
  outline: 'rgba(255,255,255,0.1)',
  ghost: 'transparent',
  danger: 'rgba(239,68,68,0.4)',
};

const buttonVariants: Variants = {
  initial: { scale: 1 },
  hover: { scale: 1.02 },
  tap: { scale: 0.98 },
};

export const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      icon,
      iconPosition = 'left',
      loading = false,
      fullWidth = false,
      blur = 8,
      glow = false,
      disabled,
      className,
      style,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <motion.button
        ref={ref}
        variants={buttonVariants}
        initial="initial"
        whileHover={!isDisabled ? 'hover' : undefined}
        whileTap={!isDisabled ? 'tap' : undefined}
        disabled={isDisabled}
        className={cn(
          'relative inline-flex items-center justify-center font-medium rounded-lg border transition-colors',
          sizeClasses[size],
          variantClasses[variant],
          fullWidth && 'w-full',
          isDisabled && 'opacity-50 cursor-not-allowed',
          className
        )}
        style={{
          backdropFilter: `blur(${blur}px)`,
          WebkitBackdropFilter: `blur(${blur}px)`,
          boxShadow: glow ? `0 0 20px ${glowColors[variant]}` : undefined,
          ...style,
        }}
        {...props}
      >
        {/* Loading spinner */}
        {loading && (
          <Loader2 className="w-4 h-4 animate-spin" />
        )}

        {/* Left icon */}
        {!loading && icon && iconPosition === 'left' && (
          <span className="flex-shrink-0">{icon}</span>
        )}

        {/* Label */}
        <span>{children}</span>

        {/* Right icon */}
        {!loading && icon && iconPosition === 'right' && (
          <span className="flex-shrink-0">{icon}</span>
        )}

        {/* Glass highlight */}
        <div
          className="absolute inset-0 rounded-lg pointer-events-none"
          style={{
            background:
              'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 50%)',
          }}
        />
      </motion.button>
    );
  }
);

GlassButton.displayName = 'GlassButton';
