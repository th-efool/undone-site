'use client';
import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

const PRIORITY_OPTIONS = [
  { value: 'low',    label: 'Low',    color: '#4ade80' },
  { value: 'medium', label: 'Medium', color: '#fbbf24' },
  { value: 'high',   label: 'High',   color: '#f87171' },
];

interface CardEditorProps {
  card: any;
  anchor: { x: number; y: number } | null;
  onSave: (card: any) => void;
  onClose: () => void;
}

export function CardEditor({ card, anchor, onSave, onClose }: CardEditorProps) {
  const [label, setLabel]       = useState(card.label ?? '');
  const [desc, setDesc]         = useState(card.description ?? '');
  const [type, setType]         = useState(card.type ?? '');
  const [priority, setPriority] = useState(card.priority ?? 'low');
  const [deadline, setDeadline] = useState(card.deadline ?? '');
  const ref = useRef<HTMLDivElement>(null);

  /* Close on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  /* Close on Escape */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const save = () => onSave({ ...card, label, description: desc, type, priority, deadline });

  /* Position: use anchor if provided, else center */
  const style: React.CSSProperties = anchor
    ? { position: 'fixed', left: Math.min(anchor.x, window.innerWidth - 320), top: Math.max(anchor.y, 60) }
    : { position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };

  const priorityColor = PRIORITY_OPTIONS.find(p => p.value === priority)?.color ?? '#64748b';

  return (
    <div
      ref={ref}
      className="sqhq-editor"
      style={style}
      onClick={e => e.stopPropagation()}
    >
      {/* Header */}
        <div className="sqhq-editor__header">
          <span className="sqhq-editor__badge" style={{ color: priorityColor }}>
            ● {priority.charAt(0).toUpperCase() + priority.slice(1)}
          </span>
          <button className="sqhq-editor__close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* Title — inline editable */}
        <textarea
          className="sqhq-editor__title"
          value={label}
          rows={2}
          placeholder="Card title…"
          onChange={e => setLabel(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); } }}
          autoFocus
        />

        {/* Description */}
        <textarea
          className="sqhq-editor__desc"
          value={desc}
          rows={3}
          placeholder="Add a description…"
          onChange={e => setDesc(e.target.value)}
        />

        {/* Metadata row */}
        <div className="sqhq-editor__meta">
          {/* Type */}
          <label className="sqhq-editor__field">
            <span className="sqhq-editor__field-label">Type</span>
            <input
              className="sqhq-editor__input"
              value={type}
              placeholder="e.g. Feature"
              onChange={e => setType(e.target.value)}
            />
          </label>

          {/* Deadline */}
          <label className="sqhq-editor__field">
            <span className="sqhq-editor__field-label">Due</span>
            <input
              className="sqhq-editor__input sqhq-editor__input--date"
              type="date"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
            />
          </label>
        </div>

        {/* Priority selector */}
        <div className="sqhq-editor__priority-row">
          {PRIORITY_OPTIONS.map(p => {
            const isActive = priority === p.value;
            // Provide a soft tinted background instead of harsh border
            const tintedBg = p.color + '15'; // 15% opacity hex
            return (
              <button
                key={p.value}
                className={`sqhq-editor__priority-chip ${isActive ? 'sqhq-editor__priority-chip--active' : ''}`}
                style={isActive ? { backgroundColor: tintedBg, borderColor: p.color, color: p.color } : {}}
                onClick={() => setPriority(p.value)}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div className="sqhq-editor__actions">
          <button className="sqhq-editor__btn sqhq-editor__btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="sqhq-editor__btn sqhq-editor__btn--primary" onClick={save}>
            Save
          </button>
        </div>
      </div>
  );
}
