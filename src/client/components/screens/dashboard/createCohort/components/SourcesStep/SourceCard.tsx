'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Copy, GripVertical, Trash2 } from 'lucide-react';

import { Badge } from '@/src/client/components/ui/Badge/Badge';
import { Button } from '@/src/client/components/ui/Button/Button';

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
  const [expandedUrl, setExpandedUrl] = useState(false);

  const summaryUrl = useMemo(() => {
    if (source.url.length <= 42) {
      return source.url;
    }
    return `${source.url.slice(0, 42)}...`;
  }, [source.url]);

  const urlPreview = expandedUrl ? source.url : summaryUrl;

  return (
    <article
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
          <GripVertical size={14} />
        </button>

        <div className={styles.headerContent}>
          <Badge variant="neutral" size="sm">
            {source.typeLabel}
          </Badge>
          <input
            className={styles.titleInput}
            value={source.title}
            placeholder="Optional title"
            onChange={(event) => actions.updateSourceField(source.id, 'title', event.target.value)}
            aria-label={`Title for ${source.typeLabel}`}
          />
          <div className={styles.summaryLine}>
            <span className={styles.urlSummary}>{urlPreview}</span>
            <button
              type="button"
              className={styles.summaryToggle}
              onClick={() => setExpandedUrl((current) => !current)}
            >
              {expandedUrl ? 'Collapse URL' : 'Expand URL'}
            </button>
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
            <ChevronUp size={14} />
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
            <ChevronDown size={14} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            iconOnly
            aria-label={source.collapsed ? 'Expand source' : 'Collapse source'}
            onClick={() => actions.toggleSourceCollapse(source.id)}
          >
            {source.collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            iconOnly
            aria-label="Duplicate source"
            onClick={() => actions.duplicateSource(source.id)}
          >
            <Copy size={14} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            iconOnly
            aria-label="Delete source"
            onClick={() => actions.removeSource(source.id)}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      {!source.collapsed ? (
        <div className={styles.body}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Source Type</span>
            <select
              value={source.type}
              onChange={(event) =>
                actions.updateSourceField(
                  source.id,
                  'type',
                  event.target.value as typeof source.type,
                )
              }
            >
              {typeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Source URL</span>
            <input
              value={source.url}
              onChange={(event) => actions.updateSourceField(source.id, 'url', event.target.value)}
              placeholder="https://"
              inputMode="url"
            />
            {expandedUrl ? null : <span className={styles.fieldHelper}>URL is editable inline.</span>}
          </label>
        </div>
      ) : null}
    </article>
  );
}
