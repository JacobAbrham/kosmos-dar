'use client';

import React from 'react';
import { motion, Variants } from 'framer-motion';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface GlassMetricProps {
  label: string;
  value: number | string;
  change?: number;
  changeType?: 'positive' | 'negative' | 'neutral';
  format?: 'number' | 'currency' | 'percent';
  prefix?: string;
  suffix?: string;
  icon?: React.ReactNode;
  blur?: number;
  className?: string;
}

const formatValue = (
  value: number | string,
  format: 'number' | 'currency' | 'percent',
  prefix?: string,
  suffix?: string
): string => {
  if (typeof value === 'string') return value;

  let formatted: string;

  switch (format) {
    case 'currency':
      formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
      break;
    case 'percent':
      formatted = `${value.toFixed(1)}%`;
      break;
    default:
      formatted = new Intl.NumberFormat('en-US').format(value);
  }

  return `${prefix || ''}${formatted}${suffix || ''}`;
};

const metricVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
};

const valueVariants: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      delay: 0.1,
      duration: 0.3,
      ease: 'easeOut',
    },
  },
};

export const GlassMetric: React.FC<GlassMetricProps> = ({
  label,
  value,
  change,
  changeType = 'neutral',
  format = 'number',
  prefix,
  suffix,
  icon,
  blur = 12,
  className,
}) => {
  const getChangeIcon = () => {
    switch (changeType) {
      case 'positive':
        return <TrendingUp className="w-4 h-4" />;
      case 'negative':
        return <TrendingDown className="w-4 h-4" />;
      default:
        return <Minus className="w-4 h-4" />;
    }
  };

  const getChangeColor = () => {
    switch (changeType) {
      case 'positive':
        return 'text-green-400';
      case 'negative':
        return 'text-red-400';
      default:
        return 'text-white/50';
    }
  };

  return (
    <motion.div
      variants={metricVariants}
      initial="hidden"
      animate="visible"
      className={cn(
        'relative p-4 rounded-xl border border-white/20 overflow-hidden',
        className
      )}
      style={{
        backdropFilter: `blur(${blur}px)`,
        WebkitBackdropFilter: `blur(${blur}px)`,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
      }}
    >
      {/* Glass highlight */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%)',
        }}
      />

      <div className="relative">
        {/* Header with label and icon */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-white/70">{label}</span>
          {icon && <div className="text-white/50">{icon}</div>}
        </div>

        {/* Value */}
        <motion.div
          variants={valueVariants}
          className="text-3xl font-bold text-white mb-1"
        >
          {formatValue(value, format, prefix, suffix)}
        </motion.div>

        {/* Change indicator */}
        {change !== undefined && (
          <div className={cn('flex items-center gap-1 text-sm', getChangeColor())}>
            {getChangeIcon()}
            <span>
              {change > 0 ? '+' : ''}
              {change.toFixed(1)}%
            </span>
            <span className="text-white/40 ml-1">vs last period</span>
          </div>
        )}
      </div>
    </motion.div>
  );
};
