'use client';

import { useMemo } from 'react';
import { Code2, FileText, Globe, Trash2, Video } from 'lucide-react';

import { Badge } from '@/src/client/components/ui/Badge/Badge';
import type { CreateCohortSourceModel } from '../../models/createCohort';
import { useWizardContext } from '../../providers/WizardProvider';

import styles from './SourceCard.module.css';

interface SourceCardProps {
  source: CreateCohortSourceModel;
  typeOptions?: string[];
  dragging?: boolean;
  previousId?: string;
  nextId?: string;
  onDragStart?: (sourceId: string) => void;
  onDragOver?: (sourceId: string) => void;
  onDrop?: (sourceId: string) => void;
  onDragEnd?: () => void;
}

export function SourceCard({
  source,
  dragging,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: SourceCardProps) {
  const { actions } = useWizardContext();

  const domain = useMemo(() => {
    if (!source.url) return '';
    try {
      const parsed = new URL(source.url.startsWith('http') ? source.url : `https://${source.url}`);
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return source.url;
    }
  }, [source.url]);

  const IconComponent = useMemo(() => {
    const typeLower = (source.type || '').toLowerCase();
    if (typeLower.includes('youtube')) return Video;
    if (typeLower.includes('github')) return Code2;
    if (typeLower.includes('pdf') || typeLower.includes('markdown')) return FileText;
    return Globe;
  }, [source.type]);

  const displayTitle = source.title || domain || source.url || 'Untitled Source';

  return (
    <div
      className={`${styles.card} ${dragging ? styles.dragging : ''}`}
      draggable
      onDragStart={() => onDragStart?.(source.id)}
      onDragOver={(event) => {
        event.preventDefault();
        onDragOver?.(source.id);
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDrop?.(source.id);
      }}
      onDragEnd={onDragEnd}
    >
      <div className={styles.mediaContainer}>
        {source.thumbnailUrl ? (
          <img src={source.thumbnailUrl} alt={displayTitle} className={styles.thumbnailImage} />
        ) : (
          <div className={styles.fallbackBanner}>
            <IconComponent className={styles.fallbackIcon} size={36} />
          </div>
        )}
        <div className={styles.badgeOverlay}>
          <Badge variant="brand" size="sm">
            {source.typeLabel || source.type}
          </Badge>
        </div>
        <button
          type="button"
          className={styles.deleteBtn}
          aria-label="Delete source"
          onClick={(e) => {
            e.stopPropagation();
            actions.removeSource(source.id);
          }}
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className={styles.content}>
        <h4 className={styles.title} title={displayTitle}>
          {displayTitle}
        </h4>
        {domain ? (
          <p className={styles.domainSubtitle} title={source.url}>
            {domain}
          </p>
        ) : source.url ? (
          <p className={styles.domainSubtitle} title={source.url}>
            {source.url}
          </p>
        ) : null}
      </div>
    </div>
  );
}
