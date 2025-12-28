'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence, Reorder, Variants } from 'framer-motion';
import { cn } from '@/lib/utils';
import { MoreHorizontal, Plus } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { GlassButton } from './GlassButton';

export interface KanbanCard {
  id: string;
  title: string;
  description?: string;
  labels?: { text: string; color: string }[];
  assignee?: { name: string; avatar?: string };
  dueDate?: string;
}

export interface KanbanColumn {
  id: string;
  title: string;
  cards: KanbanCard[];
  color?: string;
}

export interface GlassKanbanProps {
  columns: KanbanColumn[];
  onCardMove?: (cardId: string, fromColumn: string, toColumn: string) => void;
  onCardClick?: (card: KanbanCard, columnId: string) => void;
  onAddCard?: (columnId: string) => void;
  draggable?: boolean;
  columnWidth?: string;
  blur?: number;
  className?: string;
}

const columnVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  }),
};

const cardVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.2,
    },
  },
  hover: {
    scale: 1.02,
    transition: {
      duration: 0.15,
    },
  },
  drag: {
    scale: 1.05,
    boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
  },
};

export const GlassKanban: React.FC<GlassKanbanProps> = ({
  columns: initialColumns,
  onCardMove,
  onCardClick,
  onAddCard,
  draggable = true,
  columnWidth = '300px',
  blur = 12,
  className,
}) => {
  const [columns, setColumns] = useState(initialColumns);
  const [draggedCard, setDraggedCard] = useState<{
    card: KanbanCard;
    fromColumn: string;
  } | null>(null);

  const handleDragStart = (card: KanbanCard, columnId: string) => {
    setDraggedCard({ card, fromColumn: columnId });
  };

  const handleDrop = (toColumnId: string) => {
    if (!draggedCard) return;

    const { card, fromColumn } = draggedCard;
    if (fromColumn === toColumnId) {
      setDraggedCard(null);
      return;
    }

    // Update local state
    setColumns((prev) => {
      const newColumns = [...prev];

      // Remove from source
      const sourceCol = newColumns.find((c) => c.id === fromColumn);
      if (sourceCol) {
        sourceCol.cards = sourceCol.cards.filter((c) => c.id !== card.id);
      }

      // Add to target
      const targetCol = newColumns.find((c) => c.id === toColumnId);
      if (targetCol) {
        targetCol.cards.push(card);
      }

      return newColumns;
    });

    // Notify parent
    onCardMove?.(card.id, fromColumn, toColumnId);
    setDraggedCard(null);
  };

  return (
    <div
      className={cn('flex gap-4 overflow-x-auto pb-4', className)}
      style={{ minHeight: '400px' }}
    >
      {columns.map((column, colIndex) => (
        <motion.div
          key={column.id}
          custom={colIndex}
          variants={columnVariants}
          initial="hidden"
          animate="visible"
          className="flex-shrink-0"
          style={{ width: columnWidth }}
          onDragOver={(e) => {
            e.preventDefault();
            e.currentTarget.classList.add('bg-white/5');
          }}
          onDragLeave={(e) => {
            e.currentTarget.classList.remove('bg-white/5');
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.classList.remove('bg-white/5');
            handleDrop(column.id);
          }}
        >
          {/* Column container */}
          <div
            className="rounded-xl border border-white/20 overflow-hidden h-full"
            style={{
              backdropFilter: `blur(${blur}px)`,
              WebkitBackdropFilter: `blur(${blur}px)`,
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
            }}
          >
            {/* Column header */}
            <div
              className="p-3 border-b border-white/10 flex items-center justify-between"
              style={{
                borderTop: column.color ? `3px solid ${column.color}` : undefined,
              }}
            >
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-white">{column.title}</h3>
                <span className="text-xs text-white/50 bg-white/10 px-2 py-0.5 rounded-full">
                  {column.cards.length}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {onAddCard && (
                  <GlassButton
                    size="sm"
                    variant="ghost"
                    onClick={() => onAddCard(column.id)}
                  >
                    <Plus className="w-4 h-4" />
                  </GlassButton>
                )}
                <GlassButton size="sm" variant="ghost">
                  <MoreHorizontal className="w-4 h-4" />
                </GlassButton>
              </div>
            </div>

            {/* Cards */}
            <div className="p-2 space-y-2 min-h-[200px]">
              <AnimatePresence>
                {column.cards.map((card) => (
                  <motion.div
                    key={card.id}
                    variants={cardVariants}
                    initial="hidden"
                    animate="visible"
                    whileHover="hover"
                    whileDrag="drag"
                    exit={{ opacity: 0, scale: 0.8 }}
                    draggable={draggable}
                    onDragStart={() => handleDragStart(card, column.id)}
                    onClick={() => onCardClick?.(card, column.id)}
                    className="cursor-pointer"
                  >
                    <GlassCard
                      padding="sm"
                      blur={8}
                      opacity={0.1}
                      hoverable
                      className="text-left"
                    >
                      {/* Labels */}
                      {card.labels && card.labels.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {card.labels.map((label, i) => (
                            <span
                              key={i}
                              className="text-xs px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: `${label.color}40` }}
                            >
                              {label.text}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Title */}
                      <h4 className="text-sm font-medium text-white mb-1">
                        {card.title}
                      </h4>

                      {/* Description */}
                      {card.description && (
                        <p className="text-xs text-white/60 line-clamp-2">
                          {card.description}
                        </p>
                      )}

                      {/* Footer */}
                      {(card.assignee || card.dueDate) && (
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/10">
                          {card.assignee && (
                            <div className="flex items-center gap-1.5">
                              {card.assignee.avatar ? (
                                <img
                                  src={card.assignee.avatar}
                                  alt={card.assignee.name}
                                  className="w-5 h-5 rounded-full"
                                />
                              ) : (
                                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs text-white">
                                  {card.assignee.name[0]}
                                </div>
                              )}
                              <span className="text-xs text-white/50">
                                {card.assignee.name}
                              </span>
                            </div>
                          )}
                          {card.dueDate && (
                            <span className="text-xs text-white/40">
                              {card.dueDate}
                            </span>
                          )}
                        </div>
                      )}
                    </GlassCard>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Empty state */}
              {column.cards.length === 0 && (
                <div className="py-8 text-center text-white/30 text-sm">
                  No cards
                </div>
              )}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};
