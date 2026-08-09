'use client';
import React, { useEffect, useRef } from 'react';
import styles from './FormEditor.module.css';

export interface FormField {
  id: string;
  type: 'text' | 'textarea' | 'select' | 'date' | 'priority';
  label: string;
  value: string;
  onChange: (val: string) => void;
  options?: { label: string; value: string; color?: string }[];
  placeholder?: string;
  iconLeft?: React.ElementType;
  iconRight?: React.ElementType;
  autoFocus?: boolean;
}

export type FieldOrGroup = FormField | FormField[];

export interface FormEditorProps {
  fields: FieldOrGroup[];
  anchor?: { x: number; y: number } | null;
  onSave: () => void;
  onClose: () => void;
  saveLabel?: string;
  cancelLabel?: string;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  isSaveDisabled?: boolean;
}

export function FormEditor({
  fields,
  anchor,
  onSave,
  onClose,
  saveLabel = 'Save',
  cancelLabel = 'Cancel',
  onKeyDown,
  isSaveDisabled = false,
}: FormEditorProps) {
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
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  /* Position: use anchor if provided, else center */
  const style: React.CSSProperties = anchor
    ? { position: 'fixed', left: Math.min(anchor.x, window.innerWidth - 380), top: Math.max(anchor.y, 60) }
    : { position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };

  const renderField = (field: FormField) => {
    const IconLeft = field.iconLeft;
    const IconRight = field.iconRight;

    return (
      <div key={field.id} className={styles.field}>
        <label className={styles.label}>{field.label}</label>
        {field.type === 'text' && (
          <input
            className={styles.input}
            spellCheck={false}
            value={field.value}
            placeholder={field.placeholder}
            onChange={e => field.onChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onSave();
              }
            }}
            autoFocus={field.autoFocus}
          />
        )}
        {field.type === 'textarea' && (
          <textarea
            className={styles.textarea}
            spellCheck={false}
            value={field.value}
            rows={1}
            placeholder={field.placeholder}
            ref={el => {
              if (el) {
                el.style.height = 'auto';
                el.style.height = `${el.scrollHeight}px`;
              }
            }}
            onChange={e => field.onChange(e.target.value)}
            autoFocus={field.autoFocus}
          />
        )}
        {(field.type === 'select' || field.type === 'date') && (
          <div className={styles.selectWrapper}>
            {IconLeft && <IconLeft size={14} className={styles.selectIconLeft} />}
            {field.type === 'select' ? (
              <select
                className={styles.select}
                value={field.value}
                onChange={e => field.onChange(e.target.value)}
              >
                {field.options?.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="date"
                className={`${styles.select} ${styles.selectDate || ''}`}
                value={field.value}
                onChange={e => field.onChange(e.target.value)}
              />
            )}
            {IconRight && <IconRight size={14} className={styles.selectIconRight} />}
          </div>
        )}
        {field.type === 'priority' && (
          <div className={styles.priorityRow}>
            {field.options?.map(opt => (
              <button
                key={opt.value}
                className={`${styles.priorityPill} ${
                  field.value === opt.value ? styles.priorityPillActive : ''
                }`}
                onClick={() => field.onChange(opt.value)}
              >
                <span
                  className={styles.priorityDot}
                  style={{ backgroundColor: opt.color || '#fff' }}
                />
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      ref={ref}
      className={styles.editor}
      style={style}
      onClick={e => e.stopPropagation()}
      onKeyDown={onKeyDown}
    >
      {fields.map((item, index) => {
        if (Array.isArray(item)) {
          return (
            <div key={`group-${index}`} className={styles.meta}>
              {item.map(renderField)}
            </div>
          );
        }
        return renderField(item);
      })}

      <div className={styles.actions}>
        <button className={`${styles.btn} ${styles.btnGhost}`} onClick={onClose}>
          {cancelLabel}
        </button>
        <button 
          className={`${styles.btn} ${styles.btnPrimary}`} 
          onClick={onSave}
          disabled={isSaveDisabled}
        >
          {saveLabel}
        </button>
      </div>
    </div>
  );
}
