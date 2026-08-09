'use client';
import React, { useEffect, useRef, useState } from 'react';
import { ListTodo, Calendar, ChevronDown } from 'lucide-react';

const PRIORITY_OPTIONS = [
  { value: 'low',    label: 'Low',    color: '#4ade80' },
  { value: 'medium', label: 'Medium', color: '#fbbf24' },
  { value: 'high',   label: 'High',   color: '#f97316' },
  { value: 'urgent', label: 'Urgent', color: '#ef4444' },
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
  const [type, setType]         = useState(card.type ?? 'Audit');
  const [priority, setPriority] = useState(card.priority ?? 'high'); // Defaulting to high to match image if empty
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
    ? { position: 'fixed', left: Math.min(anchor.x, window.innerWidth - 380), top: Math.max(anchor.y, 60) }
    : { position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };

  return (
    <div
      ref={ref}
      className="sqhq-editor"
      style={style}
      onClick={e => e.stopPropagation()}
    >
      {/* Title */}
      <div className="sqhq-editor__field">
        <label className="sqhq-editor__label">Title</label>
        <input
          className="sqhq-editor__input sqhq-editor__input--title"
          spellCheck={false}
          value={label}
          placeholder="Design System Audit"
          onChange={e => setLabel(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); save(); } }}
          autoFocus
        />
      </div>

      {/* Description */}
      <div className="sqhq-editor__field">
        <label className="sqhq-editor__label">Description</label>
        <textarea
          className="sqhq-editor__textarea"
          spellCheck={false}
          value={desc}
          rows={1}
          placeholder="Audit and document all existing components, patterns, and tokens across the product."
          onInput={e => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            target.style.height = `${target.scrollHeight}px`;
          }}
          onChange={e => setDesc(e.target.value)}
        />
      </div>

      {/* Metadata row */}
      <div className="sqhq-editor__meta">
        {/* Type */}
        <div className="sqhq-editor__field">
          <label className="sqhq-editor__label">Type</label>
          <div className="sqhq-editor__select-wrapper">
            <ListTodo size={14} className="sqhq-editor__select-icon-left" />
            <select
              className="sqhq-editor__select"
              value={type}
              onChange={e => setType(e.target.value)}
            >
              <option value="Audit">Audit</option>
              <option value="Task">Task</option>
              <option value="Research">Research</option>
              <option value="Bug">Bug</option>
            </select>
            <ChevronDown size={14} className="sqhq-editor__select-icon-right pointer-events-none" />
          </div>
        </div>

        {/* Deadline */}
        <div className="sqhq-editor__field">
          <label className="sqhq-editor__label">Due</label>
          <div className="sqhq-editor__select-wrapper">
            <Calendar size={14} className="sqhq-editor__select-icon-left" />
            <input
              type="date"
              className="sqhq-editor__select sqhq-editor__select--date"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
            />
            <ChevronDown size={14} className="sqhq-editor__select-icon-right pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Priority selector */}
      <div className="sqhq-editor__field">
        <label className="sqhq-editor__label">Priority</label>
        <div className="sqhq-editor__priority-row">
          {PRIORITY_OPTIONS.map(p => {
            const isActive = priority === p.value;
            return (
              <button
                key={p.value}
                className={`sqhq-editor__priority-pill ${isActive ? 'sqhq-editor__priority-pill--active' : ''}`}
                onClick={() => setPriority(p.value)}
              >
                <span 
                  className="sqhq-editor__priority-dot"
                  style={{ backgroundColor: p.color }}
                />
                {p.label}
              </button>
            );
          })}
        </div>
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
