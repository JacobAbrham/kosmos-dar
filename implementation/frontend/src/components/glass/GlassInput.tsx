'use client';

import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface GlassInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  blur?: number;
  variant?: 'default' | 'filled';
}

const sizeClasses = {
  sm: 'h-8 text-sm px-3',
  md: 'h-10 text-base px-4',
  lg: 'h-12 text-lg px-5',
};

export const GlassInput = React.forwardRef<HTMLInputElement, GlassInputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      size = 'md',
      blur = 8,
      variant = 'default',
      className,
      disabled,
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || `glass-input-${Math.random().toString(36).substr(2, 9)}`;

    return (
      <div className="w-full">
        {/* Label */}
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-white/80 mb-1.5"
          >
            {label}
          </label>
        )}

        {/* Input container */}
        <div className="relative">
          {/* Left icon */}
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50">
              {leftIcon}
            </div>
          )}

          {/* Input */}
          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            className={cn(
              'w-full rounded-lg border outline-none transition-all',
              sizeClasses[size],
              variant === 'default'
                ? 'bg-white/10 border-white/20 focus:border-white/40'
                : 'bg-white/15 border-transparent focus:border-white/30',
              'text-white placeholder-white/40',
              'focus:ring-2 focus:ring-white/20 focus:scale-[1.01]',
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              error && 'border-red-400/50 focus:border-red-400/70 focus:ring-red-400/20',
              disabled && 'opacity-50 cursor-not-allowed',
              className
            )}
            style={{
              backdropFilter: `blur(${blur}px)`,
              WebkitBackdropFilter: `blur(${blur}px)`,
            }}
            {...props}
          />

          {/* Right icon */}
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50">
              {rightIcon}
            </div>
          )}
        </div>

        {/* Error or helper text */}
        {(error || helperText) && (
          <p
            className={cn(
              'mt-1.5 text-sm',
              error ? 'text-red-400' : 'text-white/50'
            )}
          >
            {error || helperText}
          </p>
        )}
      </div>
    );
  }
);

GlassInput.displayName = 'GlassInput';
