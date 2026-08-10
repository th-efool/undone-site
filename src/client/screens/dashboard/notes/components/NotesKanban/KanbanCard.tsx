'use client';
import React, { useState } from 'react';

interface KanbanCardProps {
  card: {
    id: string | number;
    label?: string;
    description?: string;
    cover?: string;
    type?: string;
    priority?: string;
    updatedAt?: string;
    column?: string;
    [key: string]: any;
  };
  cardShape?: any;
  onMenuClick?: (e: React.MouseEvent) => void;
  onUpdateCard?: (id: string | number, updates: any) => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  high:   '#f87171',
  medium: '#fbbf24',
  low:    '#4ade80',
};

function relativeTime(dateStr?: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Updated today';
  if (diffDays === 1) return 'Updated 1d ago';
  if (diffDays < 7) return `Updated ${diffDays}d ago`;
  if (diffDays < 30) return `Updated ${Math.floor(diffDays / 7)}w ago`;
  return `Updated ${Math.floor(diffDays / 30)}mo ago`;
}

import { InlineEditor } from '@/src/client/components/ui/InlineEditor/InlineEditor';

export function KanbanCard({ card, onMenuClick, onUpdateCard }: KanbanCardProps) {
  const timeLabel = relativeTime(card.updatedAt);
  const typeLabel = card.type || null;
  const priorityColor = card.priority ? PRIORITY_COLORS[card.priority] ?? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.25)';

  const priorityLabel = card.priority ? card.priority.charAt(0).toUpperCase() + card.priority.slice(1) : '';

  const formatDueDate = (dateStr?: string) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  const dueDateStr = formatDueDate(card.dueDate || card.deadline);

  return (
    <div className="sqhq-kcard">
      {card.cover && (
        <div className="sqhq-kcard__cover">
          <img src={card.cover} alt={card.label || ''} />
        </div>
      )}
      <div className="sqhq-kcard__body">
        {/* Top row: priority dot + text, due date, 3-dot menu */}
        <div className="sqhq-kcard__toprow">
          <div className="sqhq-kcard__priority-group">
            {card.priority && (
              <>
                <span className="sqhq-kcard__priority-dot" style={{ background: priorityColor }} />
                <span className="sqhq-kcard__priority-label" style={{ color: priorityColor }}>{priorityLabel}</span>
              </>
            )}
          </div>
          <div className="sqhq-kcard__actions-group">
            {dueDateStr && (
              <span className="sqhq-kcard__due-date" title={dueDateStr}>{dueDateStr}</span>
            )}
            <button
              className="sqhq-kcard__menu"
              onClick={onMenuClick}
              aria-label="Card options"
              title="Edit card"
            >
              ···
            </button>
          </div>
        </div>

        <InlineEditor
          value={card.label || ''}
          onSave={(val) => onUpdateCard?.(card.id, { label: val })}
          className="sqhq-kcard__title sqhq-kcard__title-input"
          placeholder="New Task"
          type="text"
        />
        
        <InlineEditor
          value={card.description || ''}
          onSave={(val) => onUpdateCard?.(card.id, { description: val })}
          className="sqhq-kcard__desc sqhq-kcard__desc-input"
          placeholder="Double click to add description..."
          type="textarea"
        />
        <div className="sqhq-kcard__footer">
          {typeLabel && (
            <span className="sqhq-kcard__type">
              <span className="sqhq-kcard__type-dot" />
              {typeLabel}
            </span>
          )}
          {timeLabel && (
            <span className="sqhq-kcard__time">{timeLabel}</span>
          )}
        </div>
      </div>
    </div>
  );
}
