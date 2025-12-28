'use client';

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  GlassCard,
  GlassButton,
  GlassInput,
  GlassModal,
  GlassMetric,
  GlassChatBubble,
  GlassDataTable,
  GlassChart,
  GlassTimeline,
  GlassKanban,
} from '@/components/glass';

// SDUI Types (matching backend protocol)
export interface SDUIComponent {
  type: string;
  id: string;
  props: Record<string, any>;
  children?: SDUIComponent[];
  style?: SDUIStyle;
  actions?: SDUIAction[];
  events?: Record<string, SDUIAction>;
  visible?: boolean;
  loading?: boolean;
  error?: string;
  key?: string;
}

export interface SDUIStyle {
  glass?: boolean;
  glass_blur?: number;
  glass_opacity?: number;
  padding?: string;
  margin?: string;
  gap?: string;
  width?: string;
  height?: string;
  animation?: string;
  animation_duration?: number;
  className?: string;
}

export interface SDUIAction {
  type: string;
  label?: string;
  icon?: string;
  target?: string;
  payload?: Record<string, any>;
  confirm?: string;
  disabled?: boolean;
  loading?: boolean;
}

export interface SDUISlot {
  name: string;
  components: SDUIComponent[];
  style?: SDUIStyle;
}

export interface SDUILayout {
  type: string;
  id: string;
  slots: Record<string, SDUISlot>;
  style?: SDUIStyle;
  title?: string;
  subtitle?: string;
  header?: SDUIComponent;
  footer?: SDUIComponent;
  sidebar?: SDUISlot;
}

interface SDUIRendererProps {
  layout?: SDUILayout;
  component?: SDUIComponent;
  onAction?: (action: SDUIAction, componentId: string) => void;
  onEvent?: (eventType: string, componentId: string, value?: any) => void;
  className?: string;
}

// Component renderer registry
type ComponentRenderer = (
  component: SDUIComponent,
  renderChildren: (children?: SDUIComponent[]) => React.ReactNode,
  onAction: (action: SDUIAction) => void,
  onEvent: (event: string, value?: any) => void
) => React.ReactNode;

const componentRenderers: Record<string, ComponentRenderer> = {
  // Container components
  card: (comp, renderChildren, onAction) => (
    <GlassCard
      key={comp.id}
      title={comp.props.title}
      subtitle={comp.props.subtitle}
      elevated={comp.props.elevated}
      hoverable={comp.props.hoverable}
      blur={comp.style?.glass_blur}
      opacity={comp.style?.glass_opacity}
      className={comp.style?.className}
    >
      {renderChildren(comp.children)}
    </GlassCard>
  ),

  // Text components
  text: (comp) => (
    <p
      key={comp.id}
      className={`text-white/80 ${comp.style?.className || ''}`}
      style={{
        fontSize: comp.props.size,
        fontWeight: comp.props.weight,
        color: comp.props.color,
      }}
    >
      {comp.props.content}
    </p>
  ),

  heading: (comp) => {
    const Tag = `h${comp.props.level || 1}` as keyof JSX.IntrinsicElements;
    const sizeClasses: Record<number, string> = {
      1: 'text-3xl font-bold',
      2: 'text-2xl font-semibold',
      3: 'text-xl font-semibold',
      4: 'text-lg font-medium',
      5: 'text-base font-medium',
      6: 'text-sm font-medium',
    };
    return (
      <Tag
        key={comp.id}
        className={`text-white ${sizeClasses[comp.props.level || 1]} ${
          comp.style?.className || ''
        }`}
      >
        {comp.props.content}
      </Tag>
    );
  },

  markdown: (comp) => (
    <div
      key={comp.id}
      className={`prose prose-invert max-w-none ${comp.style?.className || ''}`}
      dangerouslySetInnerHTML={{ __html: comp.props.content }}
    />
  ),

  code: (comp) => (
    <pre
      key={comp.id}
      className={`bg-white/5 rounded-lg p-4 overflow-x-auto ${
        comp.style?.className || ''
      }`}
    >
      <code className="text-sm text-white/80">{comp.props.content}</code>
    </pre>
  ),

  // Button components
  button: (comp, _, onAction) => (
    <GlassButton
      key={comp.id}
      variant={comp.props.variant || 'primary'}
      size={comp.props.size || 'md'}
      disabled={comp.props.disabled || comp.loading}
      loading={comp.loading}
      fullWidth={comp.props.full_width}
      onClick={() => comp.actions?.[0] && onAction(comp.actions[0])}
      className={comp.style?.className}
    >
      {comp.props.label}
    </GlassButton>
  ),

  // Form components
  input: (comp, _, __, onEvent) => (
    <GlassInput
      key={comp.id}
      name={comp.props.name}
      type={comp.props.type || 'text'}
      label={comp.props.label}
      placeholder={comp.props.placeholder}
      defaultValue={comp.props.value}
      disabled={comp.props.disabled}
      error={comp.error}
      onChange={(e) => onEvent('change', e.target.value)}
      onBlur={(e) => onEvent('blur', e.target.value)}
      className={comp.style?.className}
    />
  ),

  textarea: (comp, _, __, onEvent) => (
    <div key={comp.id}>
      {comp.props.label && (
        <label className="block text-sm font-medium text-white/80 mb-1.5">
          {comp.props.label}
        </label>
      )}
      <textarea
        name={comp.props.name}
        placeholder={comp.props.placeholder}
        defaultValue={comp.props.value}
        rows={comp.props.rows || 4}
        disabled={comp.props.disabled}
        onChange={(e) => onEvent('change', e.target.value)}
        className={`w-full rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 px-4 py-2 focus:border-white/40 focus:ring-2 focus:ring-white/20 outline-none ${
          comp.style?.className || ''
        }`}
        style={{
          backdropFilter: 'blur(8px)',
        }}
      />
    </div>
  ),

  select: (comp, _, __, onEvent) => (
    <div key={comp.id}>
      {comp.props.label && (
        <label className="block text-sm font-medium text-white/80 mb-1.5">
          {comp.props.label}
        </label>
      )}
      <select
        name={comp.props.name}
        defaultValue={comp.props.value}
        disabled={comp.props.disabled}
        onChange={(e) => onEvent('change', e.target.value)}
        className={`w-full rounded-lg bg-white/10 border border-white/20 text-white px-4 py-2 focus:border-white/40 outline-none ${
          comp.style?.className || ''
        }`}
        style={{
          backdropFilter: 'blur(8px)',
        }}
      >
        {comp.props.placeholder && (
          <option value="" disabled>
            {comp.props.placeholder}
          </option>
        )}
        {comp.props.options?.map((opt: any) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  ),

  checkbox: (comp, _, __, onEvent) => (
    <label key={comp.id} className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        name={comp.props.name}
        defaultChecked={comp.props.checked}
        disabled={comp.props.disabled}
        onChange={(e) => onEvent('change', e.target.checked)}
        className="rounded bg-white/10 border-white/30"
      />
      <span className="text-white/80">{comp.props.label}</span>
    </label>
  ),

  // Layout components
  flex: (comp, renderChildren) => (
    <div
      key={comp.id}
      className={`flex ${comp.style?.className || ''}`}
      style={{
        flexDirection: comp.props.direction || 'row',
        alignItems: comp.props.align || 'stretch',
        justifyContent: comp.props.justify || 'flex-start',
        gap: comp.style?.gap || comp.props.gap,
      }}
    >
      {renderChildren(comp.children)}
    </div>
  ),

  grid: (comp, renderChildren) => (
    <div
      key={comp.id}
      className={`grid ${comp.style?.className || ''}`}
      style={{
        gridTemplateColumns:
          comp.props.column_template ||
          `repeat(${comp.props.columns || 3}, 1fr)`,
        gap: comp.style?.gap || '1rem',
      }}
    >
      {renderChildren(comp.children)}
    </div>
  ),

  stack: (comp, renderChildren) => (
    <div
      key={comp.id}
      className={`flex flex-col ${comp.style?.className || ''}`}
      style={{ gap: comp.style?.gap || '1rem' }}
    >
      {renderChildren(comp.children)}
    </div>
  ),

  divider: (comp) => (
    <hr
      key={comp.id}
      className={`border-white/10 ${comp.style?.className || ''}`}
    />
  ),

  spacer: (comp) => (
    <div key={comp.id} style={{ height: comp.props.size || '1rem' }} />
  ),

  // Data display
  metric: (comp) => (
    <GlassMetric
      key={comp.id}
      label={comp.props.label}
      value={comp.props.value}
      change={comp.props.change}
      changeType={comp.props.change_type}
      format={comp.props.format}
      prefix={comp.props.prefix}
      suffix={comp.props.suffix}
      className={comp.style?.className}
    />
  ),

  table: (comp, _, onAction) => (
    <GlassDataTable
      key={comp.id}
      columns={comp.props.columns}
      data={comp.props.data}
      pageSize={comp.props.page_size}
      sortable={comp.props.sortable}
      selectable={comp.props.selectable}
      onRowClick={(row) =>
        comp.events?.click &&
        onAction({ ...comp.events.click, payload: { row } })
      }
      className={comp.style?.className}
    />
  ),

  chart: (comp) => (
    <GlassChart
      key={comp.id}
      type={comp.props.chart_type}
      data={comp.props.data}
      title={comp.props.title}
      showLegend={comp.props.legend}
      showValues={comp.props.show_values}
      className={comp.style?.className}
    />
  ),

  timeline: (comp) => (
    <GlassTimeline
      key={comp.id}
      events={[
        {
          id: comp.id,
          title: comp.props.title,
          description: comp.props.description,
          timestamp: comp.props.timestamp,
          status: comp.props.status,
        },
      ]}
      className={comp.style?.className}
    />
  ),

  // Chat components
  chat_bubble: (comp) => (
    <GlassChatBubble
      key={comp.id}
      content={comp.props.content}
      role={comp.props.role}
      agent={comp.props.agent}
      timestamp={comp.props.timestamp}
      streaming={comp.props.streaming}
      error={!!comp.error}
      className={comp.style?.className}
    />
  ),

  // Kanban
  kanban: (comp, _, onAction) => (
    <GlassKanban
      key={comp.id}
      columns={comp.props.columns}
      draggable={comp.props.draggable}
      columnWidth={comp.props.column_width}
      onCardClick={(card, columnId) =>
        comp.events?.click &&
        onAction({ ...comp.events.click, payload: { card, columnId } })
      }
      className={comp.style?.className}
    />
  ),

  // Feedback
  alert: (comp) => {
    const severityClasses: Record<string, string> = {
      info: 'bg-blue-500/10 border-blue-400/30 text-blue-300',
      success: 'bg-green-500/10 border-green-400/30 text-green-300',
      warning: 'bg-yellow-500/10 border-yellow-400/30 text-yellow-300',
      error: 'bg-red-500/10 border-red-400/30 text-red-300',
    };
    const severity = (comp.props.severity as string) || 'info';
    return (
      <div
        key={comp.id}
        className={`rounded-lg border p-4 ${severityClasses[severity] || severityClasses.info} ${comp.style?.className || ''}`}
      >
        {comp.props.title && (
          <h4 className="font-medium mb-1">{String(comp.props.title)}</h4>
        )}
        <p className="text-sm opacity-90">{String(comp.props.message)}</p>
      </div>
    );
  },

  spinner: (comp) => {
    const sizeClasses: Record<string, string> = {
      sm: 'w-4 h-4',
      md: 'w-8 h-8',
      lg: 'w-12 h-12',
      xl: 'w-16 h-16',
    };
    const size = (comp.props.size as string) || 'md';
    return (
      <div
        key={comp.id}
        className={`flex items-center justify-center ${comp.style?.className || ''}`}
      >
        <div
          className={`animate-spin rounded-full border-2 border-white/20 border-t-white ${sizeClasses[size] || sizeClasses.md}`}
        />
      </div>
    );
  },

  skeleton: (comp) => (
    <div
      key={comp.id}
      className={`animate-pulse bg-white/10 rounded ${comp.style?.className || ''}`}
      style={{
        width: comp.props.width || '100%',
        height: comp.props.height || '1rem',
      }}
    />
  ),

  progress: (comp) => (
    <div key={comp.id} className={`w-full ${comp.style?.className || ''}`}>
      {comp.props.label && (
        <div className="flex justify-between mb-1 text-sm text-white/70">
          <span>{comp.props.label}</span>
          {comp.props.show_value && (
            <span>
              {comp.props.value}%
            </span>
          )}
        </div>
      )}
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-blue-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${(comp.props.value / (comp.props.max || 100)) * 100}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
    </div>
  ),

  badge: (comp) => {
    const variantClasses: Record<string, string> = {
      default: 'bg-white/10 text-white/80',
      success: 'bg-green-500/20 text-green-300',
      warning: 'bg-yellow-500/20 text-yellow-300',
      error: 'bg-red-500/20 text-red-300',
      info: 'bg-blue-500/20 text-blue-300',
    };
    const variant = (comp.props.variant as string) || 'default';
    return (
      <span
        key={comp.id}
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantClasses[variant] || variantClasses.default} ${comp.style?.className || ''}`}
      >
        {String(comp.props.content || '')}
      </span>
    );
  },
};

// Main SDUI Renderer Component
export const SDUIRenderer: React.FC<SDUIRendererProps> = ({
  layout,
  component,
  onAction,
  onEvent,
  className,
}) => {
  // Render a single component
  const renderComponent = (comp: SDUIComponent): React.ReactNode => {
    if (!comp.visible && comp.visible !== undefined) {
      return null;
    }

    const renderer = componentRenderers[comp.type];
    if (!renderer) {
      console.warn(`Unknown SDUI component type: ${comp.type}`);
      return null;
    }

    const renderChildren = (children?: SDUIComponent[]): React.ReactNode => {
      if (!children || children.length === 0) return null;
      return children.map((child) => renderComponent(child));
    };

    const handleAction = (action: SDUIAction) => {
      onAction?.(action, comp.id);
    };

    const handleEvent = (eventType: string, value?: any) => {
      onEvent?.(eventType, comp.id, value);

      // Also trigger associated action if exists
      const eventAction = comp.events?.[eventType];
      if (eventAction) {
        handleAction({ ...eventAction, payload: { ...eventAction.payload, value } });
      }
    };

    // Wrap in animation if specified
    const element = renderer(comp, renderChildren, handleAction, handleEvent);

    if (comp.style?.animation && comp.style.animation !== 'none') {
      const animationVariants: Record<string, any> = {
        fade: { hidden: { opacity: 0 }, visible: { opacity: 1 } },
        slide_up: { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } },
        slide_down: { hidden: { opacity: 0, y: -20 }, visible: { opacity: 1, y: 0 } },
        scale: { hidden: { opacity: 0, scale: 0.9 }, visible: { opacity: 1, scale: 1 } },
      };

      return (
        <motion.div
          key={comp.id}
          variants={animationVariants[comp.style.animation] || animationVariants.fade}
          initial="hidden"
          animate="visible"
          transition={{ duration: comp.style.animation_duration || 0.3 }}
        >
          {element}
        </motion.div>
      );
    }

    return element;
  };

  // Render a slot
  const renderSlot = (slot?: SDUISlot): React.ReactNode => {
    if (!slot || slot.components.length === 0) return null;

    return (
      <div
        className={slot.style?.className}
        style={{
          padding: slot.style?.padding,
          gap: slot.style?.gap,
        }}
      >
        {slot.components.map((comp) => renderComponent(comp))}
      </div>
    );
  };

  // Render layout based on type
  const renderLayout = (): React.ReactNode => {
    if (!layout) return null;

    switch (layout.type) {
      case 'chat':
        return (
          <div className="flex flex-col h-full">
            {layout.header && renderComponent(layout.header)}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {renderSlot(layout.slots.messages)}
            </div>
            <div className="p-4 border-t border-white/10">
              {renderSlot(layout.slots.input)}
            </div>
          </div>
        );

      case 'dashboard':
        return (
          <div className="p-6 space-y-6">
            {layout.title && (
              <h1 className="text-2xl font-bold text-white">{layout.title}</h1>
            )}
            {renderSlot(layout.slots.widgets)}
            {renderSlot(layout.slots.content)}
          </div>
        );

      case 'split':
        return (
          <div className="flex h-full">
            <div className="flex-1 overflow-auto p-4">
              {renderSlot(layout.slots.left)}
            </div>
            <div className="w-px bg-white/10" />
            <div className="flex-1 overflow-auto p-4">
              {renderSlot(layout.slots.right)}
            </div>
          </div>
        );

      case 'form':
        return (
          <div className="max-w-xl mx-auto p-6 space-y-6">
            {layout.title && (
              <h1 className="text-2xl font-bold text-white">{layout.title}</h1>
            )}
            <div className="space-y-4">{renderSlot(layout.slots.fields)}</div>
            <div className="flex justify-end gap-3">
              {renderSlot(layout.slots.actions)}
            </div>
          </div>
        );

      case 'list_detail':
        return (
          <div className="flex h-full">
            <div className="w-80 border-r border-white/10 overflow-auto">
              {renderSlot(layout.slots.list)}
            </div>
            <div className="flex-1 overflow-auto p-4">
              {renderSlot(layout.slots.detail)}
            </div>
          </div>
        );

      case 'kanban':
        return (
          <div className="p-4 overflow-x-auto">
            {layout.title && (
              <h1 className="text-2xl font-bold text-white mb-4">{layout.title}</h1>
            )}
            {renderSlot(layout.slots.columns)}
          </div>
        );

      case 'analytics':
        return (
          <div className="p-6 space-y-6">
            {layout.title && (
              <h1 className="text-2xl font-bold text-white">{layout.title}</h1>
            )}
            {renderSlot(layout.slots.metrics)}
            {renderSlot(layout.slots.charts)}
            {renderSlot(layout.slots.tables)}
          </div>
        );

      case 'timeline':
        return (
          <div className="p-6">
            {layout.title && (
              <h1 className="text-2xl font-bold text-white mb-6">{layout.title}</h1>
            )}
            {renderSlot(layout.slots.events)}
          </div>
        );

      case 'loading':
        return (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            {renderSlot(layout.slots.content)}
          </div>
        );

      case 'error':
        return (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
            {renderSlot(layout.slots.content)}
          </div>
        );

      case 'empty':
        return (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
            {renderSlot(layout.slots.content)}
          </div>
        );

      default:
        return (
          <div className="p-4">
            {Object.values(layout.slots).map((slot, i) => (
              <div key={i}>{renderSlot(slot)}</div>
            ))}
          </div>
        );
    }
  };

  return (
    <div className={cn('relative', className)}>
      <AnimatePresence mode="wait">
        {layout ? renderLayout() : component ? renderComponent(component) : null}
      </AnimatePresence>
    </div>
  );
};

export default SDUIRenderer;
