'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import { Code2, FileText, Globe, Trash2, Video, Settings2 } from 'lucide-react';

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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

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
      className={`${styles.card} ${dragging ? styles.dragging : ''} ${isDropdownOpen ? styles.dropdownOpen : ''}`}
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

        <div className={styles.settingsDropdown} ref={dropdownRef}>
          <button
            type="button"
            className={styles.settingsBtn}
            aria-label="Chunking settings"
            onClick={(e) => {
              e.stopPropagation();
              setIsDropdownOpen((prev) => !prev);
            }}
          >
            <Settings2 size={16} />
          </button>
          {isDropdownOpen && (
            <div className={styles.dropdownMenu}>
              {(['semantic', 'disabled', 'fixed_interval'] as const).map((method) => (
                <button
                  key={method}
                  type="button"
                  className={`${styles.dropdownItem} ${source.chunkingMethod === method ? styles.active : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    actions.updateSourceField(source.id, 'chunkingMethod', method);
                    setIsDropdownOpen(false);
                  }}
                >
                  {method === 'semantic' ? 'Semantic Chunking' : method === 'disabled' ? 'Disabled' : 'Fixed Interval'}
                </button>
              ))}
            </div>
          )}
        </div>
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
