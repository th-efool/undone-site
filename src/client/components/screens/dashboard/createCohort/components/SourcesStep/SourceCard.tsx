'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Copy, GripVertical, Trash2, Link } from 'lucide-react';

import { Badge } from '@/src/client/components/ui/Badge/Badge';
import { Button } from '@/src/client/components/ui/Button/Button';
import { Surface } from '@/src/client/components/global/layout/Surface';

import type { CreateCohortSourceModel } from '../../models/createCohort';
import { useWizardContext } from '../../providers/WizardProvider';

import styles from './SourceCard.module.css';

interface SourceCardProps {
  source: CreateCohortSourceModel;
  typeOptions: string[];
  dragging: boolean;
  previousId?: string;
  nextId?: string;
  onDragStart: (sourceId: string) => void;
  onDragOver: (sourceId: string) => void;
  onDrop: (sourceId: string) => void;
  onDragEnd: () => void;
}

export function SourceCard({
  source,
  typeOptions,
  dragging,
  previousId,
  nextId,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: SourceCardProps) {
  const { actions } = useWizardContext();

  return (
    <Surface
      variant="default"
      className={`${styles.card} ${dragging ? styles.dragging : ''}`}
      draggable
      onDragStart={() => onDragStart(source.id)}
      onDragOver={(event) => {
        event.preventDefault();
        onDragOver(source.id);
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDrop(source.id);
      }}
      onDragEnd={onDragEnd}
    >
      <div className={styles.header}>
        <button
          type="button"
          className={styles.dragHandle}
          aria-label={source.dragLabel}
        >
          <GripVertical size={16} />
        </button>

        <div className={styles.headerContent}>
          <div className={styles.topRow}>
            <Badge variant="brand" size="sm">
              {source.typeLabel}
            </Badge>
          </div>
          <div className={styles.urlInputRow}>
            <Link size={16} className={styles.urlIcon} />
            <input
              className={styles.urlInput}
              value={source.url}
              onChange={(event) => actions.updateSourceField(source.id, 'url', event.target.value)}
              placeholder="Paste YouTube playlist or video URL here (e.g. https://www.youtube.com/playlist?list=...)"
              inputMode="url"
            />
          </div>
        </div>

        <div className={styles.actions}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            iconOnly
            aria-label="Move source up"
            disabled={!previousId}
            onClick={() => previousId && actions.moveSource(source.id, previousId)}
          >
            <ChevronUp size={16} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            iconOnly
            aria-label="Move source down"
            disabled={!nextId}
            onClick={() => nextId && actions.moveSource(source.id, nextId)}
          >
            <ChevronDown size={16} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            iconOnly
            aria-label="Duplicate source"
            onClick={() => actions.duplicateSource(source.id)}
          >
            <Copy size={16} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            iconOnly
            aria-label="Delete source"
            onClick={() => actions.removeSource(source.id)}
          >
            <Trash2 size={16} />
          </Button>
        </div>
      </div>
    </Surface>
  );
}
