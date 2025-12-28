'use client';

import React from 'react';
import { motion, Variants } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface GlassChartProps {
  type: 'bar' | 'line' | 'pie' | 'donut';
  data: ChartDataPoint[];
  title?: string;
  height?: number;
  showLegend?: boolean;
  showValues?: boolean;
  blur?: number;
  className?: string;
}

const chartVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.4,
      staggerChildren: 0.1,
    },
  },
};

const barVariants: Variants = {
  hidden: { scaleY: 0, originY: 1 },
  visible: {
    scaleY: 1,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
};

const defaultColors = [
  'rgba(59, 130, 246, 0.8)',   // blue
  'rgba(34, 197, 94, 0.8)',    // green
  'rgba(234, 179, 8, 0.8)',    // yellow
  'rgba(239, 68, 68, 0.8)',    // red
  'rgba(168, 85, 247, 0.8)',   // purple
  'rgba(236, 72, 153, 0.8)',   // pink
  'rgba(20, 184, 166, 0.8)',   // teal
  'rgba(249, 115, 22, 0.8)',   // orange
];

export const GlassChart: React.FC<GlassChartProps> = ({
  type,
  data,
  title,
  height = 300,
  showLegend = true,
  showValues = true,
  blur = 12,
  className,
}) => {
  const maxValue = Math.max(...data.map((d) => d.value));

  const renderBarChart = () => (
    <div className="flex items-end justify-around h-full px-4 gap-2">
      {data.map((item, index) => {
        const barHeight = (item.value / maxValue) * 100;
        const color = item.color || defaultColors[index % defaultColors.length];

        return (
          <div key={index} className="flex flex-col items-center gap-2 flex-1">
            <motion.div
              variants={barVariants}
              className="w-full max-w-12 rounded-t-lg relative group"
              style={{
                height: `${barHeight}%`,
                backgroundColor: color,
                minHeight: '8px',
              }}
            >
              {showValues && (
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs text-white/70 whitespace-nowrap">
                  {item.value.toLocaleString()}
                </div>
              )}
              {/* Glow effect on hover */}
              <div
                className="absolute inset-0 rounded-t-lg opacity-0 group-hover:opacity-100 transition-opacity"
                style={{
                  boxShadow: `0 0 20px ${color}`,
                }}
              />
            </motion.div>
            <span className="text-xs text-white/60 text-center truncate w-full">
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );

  const renderPieChart = () => {
    const total = data.reduce((sum, d) => sum + d.value, 0);
    let currentAngle = 0;

    return (
      <div className="flex items-center justify-center gap-8">
        <svg width={height * 0.6} height={height * 0.6} viewBox="0 0 100 100">
          {data.map((item, index) => {
            const percentage = item.value / total;
            const angle = percentage * 360;
            const startAngle = currentAngle;
            const endAngle = currentAngle + angle;
            currentAngle = endAngle;

            const color = item.color || defaultColors[index % defaultColors.length];

            // Calculate arc path
            const startRad = ((startAngle - 90) * Math.PI) / 180;
            const endRad = ((endAngle - 90) * Math.PI) / 180;

            const x1 = 50 + 40 * Math.cos(startRad);
            const y1 = 50 + 40 * Math.sin(startRad);
            const x2 = 50 + 40 * Math.cos(endRad);
            const y2 = 50 + 40 * Math.sin(endRad);

            const largeArc = angle > 180 ? 1 : 0;

            const innerRadius = type === 'donut' ? 25 : 0;
            const x3 = 50 + innerRadius * Math.cos(endRad);
            const y3 = 50 + innerRadius * Math.sin(endRad);
            const x4 = 50 + innerRadius * Math.cos(startRad);
            const y4 = 50 + innerRadius * Math.sin(startRad);

            const d =
              type === 'donut'
                ? `M ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4} Z`
                : `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`;

            return (
              <motion.path
                key={index}
                d={d}
                fill={color}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1, duration: 0.4 }}
                className="hover:brightness-110 transition-all cursor-pointer"
              />
            );
          })}
        </svg>

        {showLegend && (
          <div className="flex flex-col gap-2">
            {data.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{
                    backgroundColor:
                      item.color || defaultColors[index % defaultColors.length],
                  }}
                />
                <span className="text-sm text-white/70">{item.label}</span>
                <span className="text-sm text-white/50">
                  ({((item.value / total) * 100).toFixed(1)}%)
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderLineChart = () => {
    const points = data.map((d, i) => ({
      x: (i / (data.length - 1)) * 100,
      y: 100 - (d.value / maxValue) * 80,
    }));

    const pathD = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
      .join(' ');

    const areaD = `${pathD} L 100 100 L 0 100 Z`;

    return (
      <div className="relative h-full px-4">
        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((y) => (
            <line
              key={y}
              x1="0"
              y1={100 - y * 0.8}
              x2="100"
              y2={100 - y * 0.8}
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="0.5"
            />
          ))}

          {/* Area fill */}
          <motion.path
            d={areaD}
            fill="url(#areaGradient)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          />

          {/* Line */}
          <motion.path
            d={pathD}
            fill="none"
            stroke="rgba(59, 130, 246, 1)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1, ease: 'easeInOut' }}
          />

          {/* Points */}
          {points.map((p, i) => (
            <motion.circle
              key={i}
              cx={p.x}
              cy={p.y}
              r="2"
              fill="white"
              stroke="rgba(59, 130, 246, 1)"
              strokeWidth="2"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 + i * 0.1 }}
            />
          ))}

          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(59, 130, 246, 0.3)" />
              <stop offset="100%" stopColor="rgba(59, 130, 246, 0)" />
            </linearGradient>
          </defs>
        </svg>

        {/* X-axis labels */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2">
          {data.map((d, i) => (
            <span key={i} className="text-xs text-white/50">
              {d.label}
            </span>
          ))}
        </div>
      </div>
    );
  };

  const renderChart = () => {
    switch (type) {
      case 'bar':
        return renderBarChart();
      case 'pie':
      case 'donut':
        return renderPieChart();
      case 'line':
        return renderLineChart();
      default:
        return null;
    }
  };

  return (
    <motion.div
      variants={chartVariants}
      initial="hidden"
      animate="visible"
      className={cn(
        'relative rounded-xl border border-white/20 p-4 overflow-hidden',
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
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, transparent 50%)',
        }}
      />

      {title && (
        <h3 className="text-lg font-medium text-white mb-4">{title}</h3>
      )}

      <div style={{ height: type === 'pie' || type === 'donut' ? 'auto' : height - 60 }}>
        {renderChart()}
      </div>
    </motion.div>
  );
};
