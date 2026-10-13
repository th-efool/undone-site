'use client';
import React, { useState, useRef, useEffect, KeyboardEvent, MouseEvent } from 'react';
import styles from './InlineEditor.module.css';

interface InlineEditorProps {
  value: string;
  onSave: (val: string) => void;
  type?: 'text' | 'textarea';
  className?: string;       // Text styling class (e.g. typography)
  placeholder?: string;
  doubleClickToEdit?: boolean;
}

export function InlineEditor({
  value,
  onSave,
  type = 'text',
  className = '',
  placeholder = 'Double click to edit...',
  doubleClickToEdit = true
}: InlineEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync draft if prop changes externally while not editing
  useEffect(() => {
    if (!isEditing) {
      setDraft(value);
    }
  }, [value, isEditing]);

  // Auto-resize textarea
  useEffect(() => {
    if (isEditing && type === 'textarea' && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [draft, isEditing, type]);

  const commit = () => {
    setIsEditing(false);
    if (draft.trim() !== value) {
      onSave(draft.trim());
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    e.stopPropagation(); // Prevent Kanban or global shortcuts from intercepting Space, Arrows, etc.
    
    if (e.key === 'Escape') {
      setDraft(value);
      setIsEditing(false);
    }
    
    if (e.key === 'Enter') {
      if (type === 'text') {
        commit();
      } else if (!e.shiftKey) {
        // For textarea, enter commits unless shift is held
        e.preventDefault();
        commit();
      }
    }
  };

  const handleMouseDown = (e: MouseEvent) => {
    if (doubleClickToEdit && e.detail > 1) {
      e.preventDefault(); // Prevent text highlighting on double click
    }
  };

  const handleDoubleClick = () => {
    if (doubleClickToEdit) {
      setIsEditing(true);
    }
  };

  if (isEditing) {
    if (type === 'textarea') {
      return (
        <textarea
          ref={textareaRef}
          className={`${styles.inputBase} ${className}`}
          value={draft}
          rows={1}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus
        />
      );
    }
    
    return (
      <input
        className={`${styles.inputBase} ${className}`}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus
      />
    );
  }

  const lastTapTime = useRef(0);
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!doubleClickToEdit) return;
    const now = Date.now();
    if (now - lastTapTime.current < 300) {
      e.preventDefault();
      setIsEditing(true);
    }
    lastTapTime.current = now;
  };

  // Display Mode
  return (
    <span
      className={`${styles.displayBase} ${className} ${!value ? styles.empty : ''}`}
      onDoubleClick={handleDoubleClick}
      onMouseDown={handleMouseDown}
      onTouchEnd={handleTouchEnd}
      title={doubleClickToEdit ? "Double-click to edit" : undefined}
    >
      {value || placeholder}
    </span>
  );
}
