'use client';
import React, { useState } from 'react';
import { ListTodo, Calendar, ChevronDown } from 'lucide-react';
import { FormEditor, FieldOrGroup } from '@/src/client/components/ui/FormEditor';

const PRIORITY_OPTIONS = [
  { value: 'low',    label: 'Low',    color: '#4ade80' },
  { value: 'medium', label: 'Medium', color: '#fbbf24' },
  { value: 'high',   label: 'High',   color: '#f97316' },
  { value: 'urgent', label: 'Urgent', color: '#ef4444' },
];

const TYPE_OPTIONS = [
  { label: 'Audit', value: 'Audit' },
  { label: 'Task', value: 'Task' },
  { label: 'Research', value: 'Research' },
  { label: 'Bug', value: 'Bug' },
];

interface CardEditorProps {
  card: any;
  anchor: { x: number; y: number } | null;
  onSave: (card: any) => void;
  onClose: () => void;
  mode?: 'create' | 'edit';
}

export function CardEditor({ card, anchor, onSave, onClose, mode = 'create' }: CardEditorProps) {
  const [label, setLabel]       = useState(card.label ?? '');
  const [desc, setDesc]         = useState(card.description ?? '');
  const [type, setType]         = useState(card.type ?? 'Audit');
  const [priority, setPriority] = useState(card.priority ?? 'high');
  const [deadline, setDeadline] = useState(card.deadline ?? '');

  // On mobile, anchor=null tells FormEditor to render as a bottom sheet
  // instead of a fixed popup anchored to mouse coords (which would be off-screen).
  const isMobile = typeof window !== 'undefined' && 'ontouchstart' in window;
  const resolvedAnchor = isMobile ? null : anchor;

  const save = () => onSave({ ...card, label, description: desc, type, priority, deadline });

  const fields: FieldOrGroup[] = [
    ...(mode === 'create' ? [{
      id: 'title',
      type: 'text' as const,
      label: 'Title',
      value: label,
      placeholder: 'Design System Audit',
      onChange: setLabel,
      autoFocus: true,
    },
    {
      id: 'desc',
      type: 'textarea' as const,
      label: 'Description',
      value: desc,
      placeholder: 'Audit and document all existing components, patterns, and tokens across the product.',
      onChange: setDesc,
    }] : []),
    [
      {
        id: 'type',
        type: 'select',
        label: 'Type',
        value: type,
        options: TYPE_OPTIONS,
        iconLeft: ListTodo,
        iconRight: ChevronDown,
        onChange: setType,
      },
      {
        id: 'deadline',
        type: 'date',
        label: 'Due',
        value: deadline,
        iconLeft: Calendar,
        iconRight: ChevronDown,
        onChange: setDeadline,
      }
    ],
    {
      id: 'priority',
      type: 'priority',
      label: 'Priority',
      value: priority,
      options: PRIORITY_OPTIONS,
      onChange: setPriority,
    }
  ];

  return (
    <FormEditor
      fields={fields}
      anchor={resolvedAnchor}
      onSave={save}
      onClose={onClose}
      isSaveDisabled={mode === 'create' && !label.trim()}
    />
  );
}
