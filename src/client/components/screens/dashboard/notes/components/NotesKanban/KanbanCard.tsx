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

export function KanbanCard({ card, onMenuClick, onUpdateCard }: KanbanCardProps) {
  const timeLabel = relativeTime(card.updatedAt);
  const typeLabel = card.type || null;
  const priorityColor = card.priority ? PRIORITY_COLORS[card.priority] ?? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.25)';

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [draftTitle, setDraftTitle] = useState(card.label || '');
  const [draftDesc, setDraftDesc] = useState(card.description || '');

  const commitTitle = () => {
    setIsEditingTitle(false);
    if (draftTitle.trim() !== card.label) {
      onUpdateCard?.(card.id, { label: draftTitle.trim() });
    }
  };

  const commitDesc = () => {
    setIsEditingDesc(false);
    if (draftDesc.trim() !== card.description) {
      onUpdateCard?.(card.id, { description: draftDesc.trim() });
    }
  };

  return (
    <div className="sqhq-kcard">
      {card.cover && (
        <div className="sqhq-kcard__cover">
          <img src={card.cover} alt={card.label || ''} />
        </div>
      )}
      <div className="sqhq-kcard__body">
        {/* Top row: priority dot + 3-dot menu */}
        <div className="sqhq-kcard__toprow">
          {card.priority && (
            <span className="sqhq-kcard__priority-dot" style={{ background: priorityColor }} title={card.priority} />
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

        {isEditingTitle ? (
          <input
            className="sqhq-kcard__title-input"
            value={draftTitle}
            onChange={e => setDraftTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={e => {
              if (e.key === 'Enter') commitTitle();
              if (e.key === 'Escape') {
                setDraftTitle(card.label || '');
                setIsEditingTitle(false);
              }
            }}
            autoFocus
          />
        ) : (
          <p className="sqhq-kcard__title" onDoubleClick={() => setIsEditingTitle(true)}>
            {card.label}
          </p>
        )}
        
        {isEditingDesc || (!card.description && isEditingDesc) ? (
          <textarea
            className="sqhq-kcard__desc-input"
            value={draftDesc}
            rows={2}
            onChange={e => setDraftDesc(e.target.value)}
            onBlur={commitDesc}
            onKeyDown={e => {
              if (e.key === 'Escape') {
                setDraftDesc(card.description || '');
                setIsEditingDesc(false);
              }
            }}
            autoFocus
          />
        ) : (
          <p 
            className="sqhq-kcard__desc" 
            onDoubleClick={() => setIsEditingDesc(true)}
            title="Double-click to edit description"
          >
            {card.description || 'Double click to add description...'}
          </p>
        )}
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
